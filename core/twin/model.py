"""MyoHand in MuJoCo: pose it, place the glove's force sites, orient gravity.

docs/glove/DIGITAL_TWIN_PLAN.md §4–5. Needs MuJoCo and myo-sim
(``python install.py --twin``); check :func:`core.twin.available` first.

**The model.** MyoSim's ``myohand_r``: the right wrist and hand from the MoBL
upper-extremity and 2nd-Hand OpenSim models, 23 joints, 39 muscles. The glove
is a right hand too (CAD V1–V6). The hub's display rig ``hand.gltf`` is a
LEFT hand and plays no part here. The rest of the arm and torso are fixed in
space, so only the hand's joints move.

**Contact sites.** Each glove force channel maps to a pad on a MyoHand body
(:data:`CONTACTS`). A pad is a point and an outward normal, fixed in its
bone's frame, worked out once on the neutral pose:

* fingertip pads sit 60 % of the way from the last joint to MyoHand's own tip
  site, 6 mm out from the bone; the normal is the way the tip moves when that
  last joint flexes, which is palmar for the fingers and toward the index for
  the thumb;
* palm pads (the A401s) sit 10 mm out from the palm over the thenar, the
  hypothenar and the third metacarpal head, along the palm normal.

These are placed from the model's anatomy, not measured on the glove;
GLOVE_CAD_PLAN.md has the real sites, and matching them is open work.

**An FSR measures the normal component only**, so the twin applies each
measured force straight into its pad (plan §2): the object pushes on the
skin along −normal.
"""

from __future__ import annotations

import warnings
from dataclasses import dataclass
from typing import Mapping, Sequence

import mujoco
import numpy as np

from .retarget import DIGIT_JOINTS, FLEX_SIGN

MODEL_NAME = "myohand_r"

#: Fingertip pad placement (see module docstring).
TIP_PAD_FRACTION = 0.6
TIP_PAD_DEPTH_M = 0.006
PALM_PAD_DEPTH_M = 0.010

#: Glove force channel → MyoHand pad. Fingertips by MyoHand's tip site;
#: palm pads by body (and geom, for the metacarpal head).
TIP_SITES = {"thumb": "THtip_r", "index": "IFtip_r", "middle": "MFtip_r",
             "ring": "RFtip_r", "little": "LFtip_r"}
CONTACTS = {
    "p0": ("tip", "thumb"),
    "p1": ("tip", "index"),
    "p2": ("tip", "middle"),
    "p3": ("tip", "ring"),
    "h0": ("palm", "thenar"),
    "h1": ("palm", "hypothenar"),
    "h2": ("palm", "distal_palm"),
}
#: Palm pad → (body it rides on, where on it the pad centre sits). A pad
#: centre is the mean of the listed geoms' centres (bone landmarks).
PALM_PADS = {
    "thenar":      ("firstmc_r", ("1mcskin_r",)),
    "hypothenar":  ("fifthmc_r", ("5mcskin_r", "pisiform_r")),
    "distal_palm": ("thirdmc_r", ("3rdmcp_ellipsoid_wrap",)),
}

G = 9.81

#: A joint this close to an end of its range rests on that limit (radians).
LIMIT_TOL_RAD = np.radians(1.0)


@dataclass(frozen=True)
class Pad:
    """A contact pad fixed in a bone's frame."""
    channel: str
    body: int
    local_point: np.ndarray    # metres, in the body frame
    local_normal: np.ndarray   # unit, out of the skin, in the body frame


def _mujoco_warning(msg: str) -> None:
    """MuJoCo warnings during load: drop the known-harmless one, keep others."""
    if "empty prefix" not in msg:
        warnings.warn(f"MuJoCo: {msg}", RuntimeWarning, stacklevel=2)


def load_myohand():
    """MyoSim's ``myohand_r`` as a fresh ``(MjModel, MjData)``, unmodified.

    myo_sim's composer warns about an empty attach prefix, harmless for a
    model that is never saved back to XML. MuJoCo's native handler would also
    append every warning to MUJOCO_LOG.TXT in the working directory (the repo
    root, usually), so warnings go through Python while loading, that one is
    dropped, and the previous handler is put back.
    """
    import myo_sim
    previous = mujoco.get_mju_user_warning()
    mujoco.set_mju_user_warning(_mujoco_warning)
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            return myo_sim.load(MODEL_NAME)
    finally:
        mujoco.set_mju_user_warning(previous)


def _id(m, kind, name: str) -> int:
    i = mujoco.mj_name2id(m, kind, name)
    if i < 0:
        raise KeyError(f"MyoHand has no {kind.name.lower()} named {name!r}")
    return i


def _unit(v: np.ndarray) -> np.ndarray:
    n = float(np.linalg.norm(v))
    if n < 1e-12:
        raise ValueError("zero-length direction")
    return v / n


class HandModel:
    """One loaded MyoHand with the glove's pads on it.

    Not thread-safe: it owns one ``MjData``. Make one per worker.
    """

    def __init__(self) -> None:
        import myo_sim
        self.m, self.d = load_myohand()
        m = self.m
        # Quasi-static inverse dynamics only: no contacts (the arm touching
        # the torso), no joint-limit forces. Out-of-range angles are clipped
        # in set_pose() instead.
        m.opt.disableflags |= int(mujoco.mjtDisableBit.mjDSBL_CONSTRAINT)
        m.opt.disableflags |= int(mujoco.mjtDisableBit.mjDSBL_CONTACT)
        self.myo_sim_version = myo_sim.__version__
        self.mujoco_version = mujoco.__version__

        self.joints = [mujoco.mj_id2name(m, mujoco.mjtObj.mjOBJ_JOINT, j)
                       for j in range(m.njnt)]
        self.qadr = {n: int(m.jnt_qposadr[j]) for j, n in enumerate(self.joints)}
        self.dofadr = {n: int(m.jnt_dofadr[j]) for j, n in enumerate(self.joints)}
        self.ranges = {n: tuple(float(x) for x in m.jnt_range[j])
                       for j, n in enumerate(self.joints)}
        self.muscles = [mujoco.mj_id2name(m, mujoco.mjtObj.mjOBJ_ACTUATOR, i)
                        for i in range(m.nu)]
        #: Peak isometric force per muscle, N (MuJoCo muscle gainprm[2]).
        self.f0 = np.array(m.actuator_gainprm[:, 2], dtype=float)
        self._moment = np.zeros((m.nu, m.nv))
        self._gravity_default = np.array(m.opt.gravity, dtype=float)
        self.set_pose({})
        self.pads = self._build_pads()

    # ── pose ────────────────────────────────────────────────────────────────

    def set_pose(self, angles: Mapping[str, float]) -> dict[str, bool]:
        """Put the hand in a pose (radians by joint name; others neutral).

        Velocities are zero: the twin is quasi-static (plan §4), because
        differentiating a noisy angle twice would swamp the hand's tiny
        inertial torques. Returns which joints were clipped to range.
        """
        m, d = self.m, self.d
        d.qpos[:] = 0.0
        d.qvel[:] = 0.0
        clipped = {}
        for name, val in angles.items():
            if name not in self.qadr:
                raise KeyError(f"MyoHand has no joint {name!r}")
            lo, hi = self.ranges[name]
            v = min(hi, max(lo, float(val)))
            clipped[name] = v != float(val)
            d.qpos[self.qadr[name]] = v
        mujoco.mj_forward(m, d)
        return clipped

    def limit_sides(self, tol: float = LIMIT_TOL_RAD) -> np.ndarray:
        """Per DoF (in DoF order, the rows of the muscle matrix): +1 when the
        joint is within ``tol`` of its lower limit, -1 of its upper, else 0.
        The sign is the way the limit can push (core.twin.static_opt.solve).
        Read after set_pose(); a straight finger is on its lower limit."""
        m = self.m
        out = np.zeros(m.nv)
        for j, name in enumerate(self.joints):
            if not m.jnt_limited[j]:
                continue
            q = self.d.qpos[self.qadr[name]]
            lo, hi = self.ranges[name]
            if q <= lo + tol:
                out[self.dofadr[name]] = 1.0
            elif q >= hi - tol:
                out[self.dofadr[name]] = -1.0
        return out

    def hand_frame(self) -> np.ndarray:
        """Columns: radial, distal, palmar unit vectors in world, this pose.

        Taken from the bones (second-to-fifth metacarpal for radial, capitate
        to the middle finger's base for distal), so it follows the wrist.
        """
        x = lambda n: self.d.xpos[_id(self.m, mujoco.mjtObj.mjOBJ_BODY, n)]
        radial = _unit(x("secondmc_r") - x("fifthmc_r"))
        distal = _unit(x("3proxph_r") - x("capitate_r"))
        palmar = _unit(np.cross(radial, distal))
        radial = np.cross(distal, palmar)       # re-orthogonalise
        return np.column_stack([radial, distal, palmar])

    def set_gravity(self, g_hand: Sequence[float] | None) -> None:
        """Point gravity the way it points in the real hand.

        ``g_hand`` is a direction in the hand frame (retarget.HAND_FRAME:
        radial, distal, palmar), e.g. from the glove IMU once its mount is
        calibrated. None keeps MyoHand's default, which in its neutral pose is
        thumb up (gravity toward the little finger), the grip test's posture.
        Call after set_pose(): the frame follows the pose.
        """
        if g_hand is None:
            self.m.opt.gravity[:] = self._gravity_default
            return
        g = _unit(np.asarray(g_hand, dtype=float))
        self.m.opt.gravity[:] = G * (self.hand_frame() @ g)

    # ── pads ────────────────────────────────────────────────────────────────

    def _build_pads(self) -> dict[str, Pad]:
        m, d = self.m, self.d
        pads: dict[str, Pad] = {}
        frame = self.hand_frame()
        palmar = frame[:, 2]
        jacp = np.zeros((3, m.nv))
        for ch, (kind, where) in CONTACTS.items():
            if kind == "tip":
                site = _id(m, mujoco.mjtObj.mjOBJ_SITE, TIP_SITES[where])
                body = int(m.site_bodyid[site])
                base, tip = d.xpos[body].copy(), d.site_xpos[site].copy()
                p = base + TIP_PAD_FRACTION * (tip - base)
                # Direction the pad moves when the last joint flexes.
                last = DIGIT_JOINTS[where][-1]
                mujoco.mj_jac(m, d, jacp, None, p, body)
                n = _unit(FLEX_SIGN[where] * jacp[:, self.dofadr[last]].copy())
                p = p + TIP_PAD_DEPTH_M * n
            else:
                body_name, geoms = PALM_PADS[where]
                body = _id(m, mujoco.mjtObj.mjOBJ_BODY, body_name)
                centre = np.mean([d.geom_xpos[_id(m, mujoco.mjtObj.mjOBJ_GEOM, g)]
                                  for g in geoms], axis=0)
                n = palmar.copy()
                p = centre + PALM_PAD_DEPTH_M * n
            R = d.xmat[body].reshape(3, 3)
            pads[ch] = Pad(ch, body, R.T @ (p - d.xpos[body]), R.T @ n)
        return pads

    def pad_world(self, channel: str) -> tuple[np.ndarray, np.ndarray]:
        """(point, outward normal) of a pad in world, at the current pose."""
        pad = self.pads[channel]
        R = self.d.xmat[pad.body].reshape(3, 3)
        return self.d.xpos[pad.body] + R @ pad.local_point, R @ pad.local_normal

    def contact_vectors(self, forces: Mapping[str, float | None]) -> dict[str, np.ndarray]:
        """Measured normal forces (N) → force vectors on the hand, world frame.

        The object pushes into each pad, along −normal. Channels the model
        has no pad for, and None or non-positive readings, are left out.
        """
        out = {}
        for ch, f in forces.items():
            if ch in self.pads and f is not None and np.isfinite(f) and f > 0:
                _, n = self.pad_world(ch)
                out[ch] = -float(f) * n
        return out

    # ── muscles ─────────────────────────────────────────────────────────────

    def moment_matrix(self) -> np.ndarray:
        """(n_muscles, n_dof) moment arms at the current pose, metres."""
        d = self.d
        mujoco.mju_sparse2dense(self._moment, d.actuator_moment,
                                d.moment_rownnz, d.moment_rowadr, d.moment_colind)
        return self._moment.copy()

    def info(self) -> dict:
        """What the twin ran on, for the saved record."""
        return {"model": MODEL_NAME, "myo_sim": self.myo_sim_version,
                "mujoco": self.mujoco_version, "joints": len(self.joints),
                "muscles": len(self.muscles),
                "pads": {ch: [round(float(x), 4) for x in p.local_point]
                         for ch, p in self.pads.items()}}


_CACHED: HandModel | None = None


def load() -> HandModel:
    """A shared HandModel, loaded once (about 2 s)."""
    global _CACHED
    if _CACHED is None:
        _CACHED = HandModel()
    return _CACHED
