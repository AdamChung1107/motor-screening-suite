"""A glove recording as twin input. Pure: no MuJoCo.

docs/glove/DIGITAL_TWIN_PLAN.md §4. Reads the CSV that the Developer page's
Record button writes (``core/glove/serial_io.GloveReader``: ``host_time, seq,
t_us``, then one raw column per banner channel, the IMU's included) and turns it
into :class:`TwinFrame` s, plus the traces the grasp readings need
(:func:`grasp_readings`).

* **Force:** fingertip FSRs through the FSR402 curve (core/glove/force.py).
  Palm channels (``h0``-``h2``) wait for the flexiforce kind
  (GLOVE_INTEGRATION_PLAN.md §0).
* **Bend:** the uncalibrated default span (core/glove/flex.py).
* **Orientation:** the IMU through :mod:`core.glove.fusion`, the hub's own
  filter, so gravity in the twin points where the hub's 3D hand showed it. The
  mount is the default one (board flat on the back of the hand, +Y toward the
  fingers), a saved one, or measured from the recording itself:
  ``mount="start"`` runs the Developer page's two-pose calibration over the
  first seconds (palm down, then fingers up, each held still about a second).
* **Lift:** the specific force along the vertical, from the same filter
  (:meth:`core.glove.fusion.Fusion.vertical_g`).

The CSV carries no banner, so the divider resistors, ADC bits and IMU scale
are arguments; the defaults are the current firmware's.
"""

from __future__ import annotations

import csv
import math
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Mapping, Sequence

from core.glove.flex import bend_fraction
from core.glove.force import force_newtons
from core.glove.fusion import Fusion, hand_from_board
from core.glove.protocol import IMU_COLS, IMU_SCALE_DEFAULT, sensor_ohms

from . import proxies, retarget

#: Channel columns: p0.., f0.., h0..; not host_time.
CHANNEL_RE = re.compile(r"^[pfh]\d+$")
#: ``pose=IMU``: take the hand's orientation from the glove's IMU.
IMU = "imu"
#: The pinch pads: thumb and index fingertips.
PINCH_PADS = ("p0", "p1")

_UINT32 = 1 << 32


@dataclass
class TwinFrame:
    """One instant of input. Angles in radians by MyoHand joint name (from
    core.twin.retarget), forces in N by glove channel, gravity as a direction
    in the hand frame (None: MyoHand's thumb-up default)."""
    t: float
    angles: Mapping[str, float]
    forces: Mapping[str, float | None] = field(default_factory=dict)
    g_hand: Sequence[float] | None = None


@dataclass
class Recording:
    """Twin frames plus per-frame traces for the grasp readings. A trace is
    None when the recording lacks the channels for it."""
    frames: list[TwinFrame]
    notes: list[str]
    grip_n: list[float] | None = None       # (p0 + p1) / 2, pinch_lift's grip
    total_n: list[float] | None = None      # every fingertip pad, summed
    bend: list[float] | None = None         # mean bend fraction over the strips
    vertical_g: list[float] | None = None   # specific force along the vertical, g
    gyro_dps: list[float] | None = None     # rotation-rate magnitude
    mount: list[float] | None = None        # hand -> board quaternion used

    @property
    def t(self) -> list[float]:
        return [f.t for f in self.frames]


def _mount_arg(mount) -> tuple[str, tuple[float, ...] | None]:
    if isinstance(mount, str):
        if mount not in ("default", "start"):
            raise ValueError(f"mount must be 'default', 'start' or a quaternion, not {mount!r}")
        return mount, None
    q = tuple(float(x) for x in mount)
    n = math.sqrt(sum(x * x for x in q)) if len(q) == 4 else 0.0
    if not (len(q) == 4 and math.isfinite(n) and abs(n - 1.0) < 0.01):
        raise ValueError("a mount is a unit quaternion w, x, y, z")
    return "given", q


def read_glove_csv(path: Path | str, *, adc_bits: int = 12, fsr_r: int = 10_000,
                   flex_r: int = 47_000, imu_scale: int = IMU_SCALE_DEFAULT,
                   pose=IMU, mount="default", every: int = 1) -> Recording:
    """A GloveReader CSV → :class:`Recording`.

    pose  : :data:`IMU` (orientation from the glove, when it has an IMU), or a
            fixed gravity direction in the hand frame for the whole run
            (retarget.PALM_DOWN etc.; None is MyoHand's thumb-up default).
    mount : ``"default"``, ``"start"`` (calibrate from the recording's first
            seconds) or a saved mount quaternion (w, x, y, z), hand -> board.
    every : keep every Nth frame. The IMU filter still sees every sample.

    Raises ValueError on an empty file, a file with no sensor columns, or
    ``mount="start"`` when the recording does not open with the two poses.
    """
    path = Path(path)
    every = max(1, int(every))
    mount_kind, mount_q = _mount_arg(mount)
    notes = [f"ADC {adc_bits}-bit, FSR divider {fsr_r} ohm, flex divider "
             f"{flex_r} ohm (arguments; the CSV has no banner).",
             "Bend from the uncalibrated default span (core/glove/flex.py)."]
    with path.open(newline="", encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))
    if not rows:
        raise ValueError(f"{path.name}: no rows")
    header = list(rows[0].keys())
    cols = [c for c in header if CHANNEL_RE.match(c or "")]
    fsr = [c for c in cols if c[0] == "p"]
    flex = [c for c in cols if c[0] == "f"]
    palm = [c for c in cols if c[0] == "h"]
    has_imu = all(c in header for c in IMU_COLS)
    if palm:
        notes.append(f"Palm channels {', '.join(palm)} skipped: no flexiforce "
                     "conversion yet.")
    if not fsr and not flex:
        raise ValueError(f"{path.name}: no p* or f* channel columns")
    use_imu = pose == IMU and has_imu

    fus = Fusion(mount=mount_q)
    if use_imu and mount_kind == "start":
        fus.start_calibration()
    t_out, forces_out, bend_out, gb_out, vg_out, gm_out = [], [], [], [], [], []
    t_acc, prev = 0.0, None
    for i, row in enumerate(rows):
        us = int(row["t_us"])
        if prev is not None:
            t_acc += ((us - prev) % _UINT32) / 1e6     # uint32 wraps every ~71 min
        prev = us
        if has_imu:
            try:
                raw = [int(row[c]) for c in IMU_COLS]
            except (TypeError, ValueError):
                raw = None
            if raw is not None:
                a = tuple(v / imu_scale for v in raw[:3])
                g = tuple(v / imu_scale for v in raw[3:])
                fus.step(a, g, us)
                vg, gm = fus.vertical_g(a), math.hypot(*g)
            else:
                vg, gm = None, None
        if i % every:
            continue
        t_out.append(t_acc)
        forces_out.append({c: force_newtons(sensor_ohms(int(row[c]), r_fixed=fsr_r,
                                                        bits=adc_bits)) for c in fsr})
        bend_out.append({c: bend_fraction(sensor_ohms(int(row[c]), r_fixed=flex_r,
                                                      bits=adc_bits)) for c in flex})
        if has_imu:
            gb_out.append(fus.gravity_board())
            vg_out.append(vg)
            gm_out.append(gm)

    if use_imu and mount_kind == "start" and fus.mount is None:
        why = (" The two poses were less than 50 degrees apart."
               if fus.cal and fus.cal.get("error") == "too-close" else "")
        raise ValueError(
            f"{path.name}: no two-pose calibration at the start of the recording "
            "(hold palm down, then fingers up, each still for about a second)." + why)

    m = fus.mount_of()
    if use_imu:
        how = {"default": "the default mount (board flat on the back of the hand, "
                          "+Y toward the fingers)",
               "start": "a mount calibrated from the recording's opening poses",
               "given": "the saved mount given"}[mount_kind]
        notes.append(f"Hand orientation from the glove IMU, {how}.")
        g_hand = [None if gb is None else hand_from_board(m, gb) for gb in gb_out]
    else:
        if pose == IMU:
            notes.append("No IMU columns: hand orientation held at MyoHand's "
                         "default (thumb up) for the whole run.")
            fixed = None
        else:
            fixed = None if pose is None else tuple(float(x) for x in pose)
            notes.append(f"Hand orientation held fixed for the whole run "
                         f"(gravity {fixed or 'thumb up'} in the hand frame).")
        g_hand = [fixed] * len(t_out)

    frames = [TwinFrame(t=t_out[k], angles=retarget.bend_to_angles(bend_out[k]),
                        forces=forces_out[k], g_hand=g_hand[k])
              for k in range(len(t_out))]

    def _f(v):
        return float(v) if v is not None and math.isfinite(v) else 0.0

    rec = Recording(frames=frames, notes=notes)
    if fsr:
        rec.total_n = [sum(_f(v) for v in fr.values()) for fr in forces_out]
    if all(p in fsr for p in PINCH_PADS):
        rec.grip_n = [sum(_f(fr[p]) for p in PINCH_PADS) / len(PINCH_PADS)
                      for fr in forces_out]
    if flex:
        rec.bend = [_mean([b[c] for c in flex]) for b in bend_out]
    if has_imu:
        rec.vertical_g = [1.0 if v is None else v for v in vg_out]
        rec.gyro_dps = [0.0 if v is None else v for v in gm_out]
        if use_imu:
            rec.mount = [round(x, 6) for x in m]
    return rec


def _mean(vals) -> float:
    vals = [v for v in vals if v is not None and math.isfinite(v)]
    return sum(vals) / len(vals) if vals else 0.0


def grasp_readings(rec: Recording) -> dict:
    """The no-EMG grasp readings (core.twin.proxies) the recording supports.

    ``pinch_lift`` needs both pinch pads and the IMU's lift signal;
    ``still_force_fraction`` needs fingertip force and either bend or the
    gyro to say what "still" is.
    """
    out: dict = {}
    t = rec.t
    if rec.grip_n is not None and rec.vertical_g is not None:
        out["pinch_lift"] = proxies.pinch_lift(t, rec.grip_n, rec.vertical_g)
    if rec.total_n is not None and (rec.bend is not None or rec.gyro_dps is not None):
        out["still_force_fraction"] = proxies.still_force_fraction(
            t, rec.total_n, bend=rec.bend, gyro_dps=rec.gyro_dps)
    return out
