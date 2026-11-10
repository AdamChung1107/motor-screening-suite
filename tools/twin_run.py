#!/usr/bin/env python3
"""
Run the musculoskeletal hand twin on a glove recording, or on a built-in demo.

    .venv/Scripts/python tools/twin_run.py --demo
    .venv/Scripts/python tools/twin_run.py results/glove/glove_YYYYMMDD_HHMMSS.csv
    .venv/Scripts/python tools/twin_run.py <csv> --mount start --every 2 --out twin.json

Needs ``python install.py --twin`` (MuJoCo + MyoSim's MyoHand + scipy).
Plan: docs/glove/DIGITAL_TWIN_PLAN.md (§4 pipeline, §2 what not to read into
the muscle estimate).

**Input.** A CSV from the Developer page's Record button, read by
``core/twin/recording.py``. The CSV does not carry the boot banner, so the
divider resistors, ADC resolution and IMU scale are flags here (defaults: the
current firmware's 10 kOhm FSR, 47 kOhm flex, 12-bit, milli-units). Fingertip
force goes through the FSR402 curve; bend through the uncalibrated default
span, and the summary says so. Palm channels (``h0``-``h2``) are skipped until
the ``flexiforce`` kind exists (GLOVE_INTEGRATION_PLAN.md §0).

**Gravity.** From the glove's IMU through the hub's own fusion filter
(core/glove/fusion.py), when the recording has IMU columns. ``--mount``
says how the board sits on the hand: ``default`` (flat on the back, +Y toward
the fingers), ``start`` (the recording opens with the Developer page's two
poses: palm down, then fingers up, each held still about a second), or a
saved quaternion ``w,x,y,z``. ``--pose`` holds one orientation for the whole
run instead; it is also what a recording without an IMU gets (thumb up,
MyoHand's own, unless given).

**Grasp readings.** Pinch-and-lift (needs p0, p1 and the IMU) and the share
of pressing time spent still, printed when the recording supports them.

**The demo** is a synthetic pinch-and-lift with no hardware: thumb and index
bend to 35 %, both fingertip pads ramp to 6 N, the object lifts at 1.2 s and is
held. It exercises the whole pipeline and the grasp readings.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
import time
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(_REPO_ROOT))

from core import twin  # noqa: E402
from core.twin import recording, retarget  # noqa: E402

POSES = {"thumb-up": None, "palm-down": retarget.PALM_DOWN,
         "palm-up": retarget.PALM_UP, "fingers-up": retarget.FINGERS_UP}


def demo_recording(g_hand) -> recording.Recording:
    """Synthetic pinch-and-lift at 100 Hz, with its vertical IMU trace."""
    angles = retarget.bend_to_angles({"thumb": 0.35, "index": 0.35})
    frames, grip, accel = [], [], []
    for k in range(300):
        t = k / 100.0
        f = 0.0 if t < 0.5 else min(6.0, (t - 0.5) * 12.0)   # 12 N/s rise
        if t > 2.6:
            f = 0.0
        a = 1.0 + (0.15 * math.sin(math.pi * (t - 1.2) / 0.3) if 1.2 <= t < 1.5 else 0.0)
        frames.append(recording.TwinFrame(t=t, angles=angles,
                                          forces={"p0": f, "p1": f}, g_hand=g_hand))
        grip.append(f)
        accel.append(a)
    return recording.Recording(frames=frames, notes=["Synthetic demo, no hardware."],
                               grip_n=grip, total_n=[2 * f for f in grip],
                               bend=[0.35] * len(grip), vertical_g=accel)


def _mount(text: str):
    if text in ("default", "start"):
        return text
    try:
        q = [float(x) for x in text.split(",")]
    except ValueError:
        raise argparse.ArgumentTypeError("default, start, or w,x,y,z") from None
    if len(q) != 4:
        raise argparse.ArgumentTypeError("a mount quaternion has four numbers: w,x,y,z")
    return q


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("csv", nargs="?", type=Path, help="GloveReader CSV")
    ap.add_argument("--demo", action="store_true", help="synthetic pinch-and-lift")
    ap.add_argument("--pose", choices=sorted(POSES),
                    help="hold one orientation for the whole run (default: "
                         "from the IMU; thumb-up without one)")
    ap.add_argument("--mount", type=_mount, default="default",
                    help="IMU mount: default, start, or w,x,y,z (hand->board)")
    ap.add_argument("--imu-scale", type=int, default=1000,
                    help="IMU milli-units per g and per deg/s")
    ap.add_argument("--adc-bits", type=int, default=12)
    ap.add_argument("--fsr-r", type=int, default=10000)
    ap.add_argument("--flex-r", type=int, default=47000)
    ap.add_argument("--every", type=int, default=1, help="use every Nth frame")
    ap.add_argument("--out", type=Path, help="write the summary as JSON")
    args = ap.parse_args()

    if not args.demo and args.csv is None:
        ap.error("give a CSV or --demo")
    if not twin.available():
        print(twin.missing_message())
        return 2

    from core.twin import pipeline
    from core.twin.model import load

    if args.demo:
        pose = args.pose or "thumb-up"
        rec = demo_recording(POSES[pose])
        rec.notes.append(f"Hand orientation held at '{pose}'.")
    else:
        try:
            rec = recording.read_glove_csv(
                args.csv, adc_bits=args.adc_bits, fsr_r=args.fsr_r,
                flex_r=args.flex_r, imu_scale=args.imu_scale,
                pose=recording.IMU if args.pose is None else POSES[args.pose],
                mount=args.mount, every=args.every)
        except (OSError, ValueError) as e:
            print(f"Cannot read the recording: {e}")
            return 2
    frames, notes = rec.frames, rec.notes

    print("Loading MyoHand ...", flush=True)
    hm = load()
    print(f"Running the twin on {len(frames)} frames ...", flush=True)
    t0 = time.time()
    res = pipeline.run(frames, hm=hm)
    summary = pipeline.summarise(res)
    summary["input_notes"] = notes
    summary.update(recording.grasp_readings(rec))
    if rec.mount is not None:
        summary["imu_mount"] = rec.mount
    print(f"  done in {time.time() - t0:.1f} s\n")

    print("Peak joint torque the muscles supply (N*m, |max|), nonzero joints:")
    for d, v in summary["peak_torque_nm"].items():
        if v and v >= 0.005:
            print(f"  {d:18s} {v:7.3f}")
    print("\nTorque left unexplained (N*m, |max|) where above 0.02:")
    for c, per in summary["max_unexplained_torque_nm"].items():
        big = {d: v for d, v in per.items() if v and v > 0.02}
        print(f"  {c:10s} " + (", ".join(f"{d} {v:.3f}" for d, v in big.items()) or "none"))
    inner = summary["internal_force_n"]
    print(f"\nContact force, median: total {inner['total']['median']} N, net "
          f"{inner['net']['median']} N, internal {inner['internal']['median']} N")
    if "pinch_lift" in summary:
        pl = summary["pinch_lift"]
        if pl is None:
            print("Pinch-and-lift: no contact followed by a lift found.")
        else:
            rate = pl["grip_rate_n_per_s"]
            hold = pl["hold_force_n"]
            rate_txt = "-" if rate is None else f"{rate:.1f}"
            hold_txt = "-" if hold is None else f"{hold:.2f}"
            print(f"Pinch-and-lift: preload {pl['preload_s']:.2f} s, grip rate "
                  f"{rate_txt} N/s, hold {hold_txt} N")
    if summary.get("still_force_fraction") is not None:
        print(f"Pressing while still: {100 * summary['still_force_fraction']:.0f} % "
              f"of the pressing time")
    rep = summary.get("reportable_muscles", [])
    print(f"\nMuscle estimates stable across both costs: {len(rep)} of "
          f"{len(res['muscles'])} muscles (a model estimate; see the plan's "
          f"section 2).")
    print("\nAssumptions:")
    for a in summary["assumptions"] + notes:
        print(f"  - {a}")
    if args.out:
        args.out.write_text(json.dumps(summary, indent=2), encoding="utf-8")
        print(f"\nSummary written to {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
