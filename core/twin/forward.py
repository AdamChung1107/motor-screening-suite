"""Forward simulation: what co-contraction does to the hand. Needs MuJoCo.

docs/glove/DIGITAL_TWIN_PLAN.md §4b. The inverse twin (``pipeline.py``) cannot
show co-contraction: static optimisation avoids it by construction (§2). This
module runs MyoHand the other way. The muscles are **driven** with a chosen
co-contraction level and the hand's response to a push is simulated, so it
shows what co-contraction does mechanically: the same push bends a
co-contracting wrist less, with no net torque and no movement before the push.

**A level here is an input, never a reading.** It answers "what would
co-contraction do to this hand", not "how much is this person
co-contracting". Comparing a measured push response against this curve is a
research path (plan §3 item 4), not something the project does.

* :func:`hold_activations` - the inverse twin's own activations for holding a
  pose against gravity and passive tension. In forward simulation they hold
  the hand still, which cross-checks the inverse solver.
* :func:`balanced_pattern` - co-contraction over a muscle group with zero net
  torque at every joint.
* :class:`Sim` - MyoHand stepping forward with ``hold + level * pattern``, a
  push on the hand, and muscle colours by activation.
"""

from __future__ import annotations

from typing import Mapping, Sequence

import mujoco
import numpy as np

from . import retarget
from .inverse import muscle_terms, required_torque
from .model import HandModel, load, load_myohand
from .static_opt import cost_weights, solve

#: The wrist's own muscles: three flexors, three extensors. Finger muscles
#: also cross the wrist but are left out, so the fingers keep their pose.
WRIST_MUSCLES = ("FCR_r", "FCU_r", "PL_r", "ECRL_r", "ECRB_r", "ECU_r")
#: Default posture: every digit bent 25 %, wrist neutral, thumb up (MyoHand's
#: own orientation, so gravity loads the wrist sideways, not in flexion).
REST_BEND = 0.25
#: Weight on "sum of the pattern = 1" against "no net torque" (normalised).
_SUM_WEIGHT = 30.0
#: Muscle colours: relaxed, fully active (RGBA).
RELAXED_RGBA = np.array([0.62, 0.52, 0.58, 1.0])
ACTIVE_RGBA = np.array([1.0, 0.12, 0.08, 1.0])


def rest_pose() -> dict[str, float]:
    return retarget.bend_to_angles({d: REST_BEND for d in retarget.DIGITS})


def hold_activations(hm: HandModel, pose: Mapping[str, float],
                     g_hand: Sequence[float] | None = None) -> np.ndarray:
    """Activations that hold ``pose`` still against gravity and passive tension."""
    hm.set_pose(pose)
    b = required_torque(hm, {}, g_hand)["tau"] - muscle_terms(hm)["bias"]
    sol = solve(muscle_terms(hm)["A"], b, cost_weights("activation", hm.f0),
                limit=hm.limit_sides())
    return sol["a"]


def balanced_pattern(hm: HandModel, pose: Mapping[str, float],
                     group: Sequence[str] = WRIST_MUSCLES) -> np.ndarray:
    """Activation pattern over ``group`` (strongest muscle = 1, the rest 0..1)
    whose net torque is zero at every joint, so adding it moves nothing.
    Returned over all muscles, zero outside the group."""
    from scipy.optimize import nnls

    hm.set_pose(pose)
    A_all = muscle_terms(hm)["A"]
    idx = [hm.muscles.index(n) for n in group]
    cap = np.abs(A_all).sum(axis=1)
    An = A_all[:, idx] / np.where(cap > 0, cap, 1.0)[:, None]
    M = np.vstack([An, _SUM_WEIGHT * np.ones((1, len(idx)))])
    y = np.concatenate([np.zeros(An.shape[0]), [_SUM_WEIGHT]])
    x, _ = nnls(M, y)
    out = np.zeros(len(hm.muscles))
    out[idx] = x / x.max()
    return out


class Sim:
    """MyoHand stepping forward with a co-contraction level and pushes.

    Joint limits are on (the forward model is MyoSim's as shipped); the
    inverse model's switches do not apply here. Not thread-safe.
    """

    def __init__(self, pose: Mapping[str, float] | None = None,
                 group: Sequence[str] = WRIST_MUSCLES) -> None:
        self.m, self.d = load_myohand()
        hm = load()
        self.pose = dict(rest_pose() if pose is None else pose)
        self.a_hold = hold_activations(hm, self.pose)
        self.pattern = balanced_pattern(hm, self.pose, group)
        self.group = tuple(group)
        hm.set_pose(self.pose)
        #: Push direction: out of the back of the hand's palm side, i.e. a
        #: force on the palm pushing it dorsally (extends the wrist).
        self.push_dir = -hm.hand_frame()[:, 2]
        m = self.m
        self._qadr = {mujoco.mj_id2name(m, mujoco.mjtObj.mjOBJ_JOINT, j): int(m.jnt_qposadr[j])
                      for j in range(m.njnt)}
        self.hand_body = mujoco.mj_name2id(m, mujoco.mjtObj.mjOBJ_BODY, "thirdmc_r")
        self.tendon_of = np.array([int(m.actuator_trnid[i, 0])
                                   if m.actuator_trntype[i] == mujoco.mjtTrn.mjTRN_TENDON else -1
                                   for i in range(m.nu)])
        self.level = 0.0
        self.push_n = 0.0
        self._push_left = 0.0
        self.reset()

    # ── control ───────────────────────────────────────────────────────────

    def command(self) -> np.ndarray:
        return np.clip(self.a_hold + self.level * self.pattern, 0.0, 1.0)

    def set_level(self, level: float) -> None:
        self.level = float(np.clip(level, 0.0, 1.0))
        self.d.ctrl[:] = self.command()

    def reset(self, level: float | None = None) -> None:
        """Back to the pose, at rest, activations already at the command."""
        if level is not None:
            self.level = float(np.clip(level, 0.0, 1.0))
        mujoco.mj_resetData(self.m, self.d)
        for j, v in self.pose.items():
            self.d.qpos[self._qadr[j]] = v
        self.d.act[:] = self.command()
        self.d.ctrl[:] = self.command()
        self._push_left = 0.0
        self.d.xfrc_applied[:] = 0.0
        mujoco.mj_forward(self.m, self.d)

    def push(self, newtons: float = 4.0, duration_s: float = 0.3) -> None:
        self.push_n = float(newtons)
        self._push_left = float(duration_s)

    @property
    def pushing(self) -> bool:
        return self._push_left > 0

    def step(self, n: int = 1) -> None:
        dt = self.m.opt.timestep
        for _ in range(n):
            if self._push_left > 0:
                self.d.xfrc_applied[self.hand_body, :3] = self.push_n * self.push_dir
                self._push_left -= dt
            else:
                self.d.xfrc_applied[self.hand_body, :3] = 0.0
            mujoco.mj_step(self.m, self.d)

    # ── readings and drawing ──────────────────────────────────────────────

    @property
    def time(self) -> float:
        return float(self.d.time)

    def angle_deg(self, joint: str = "flexion_r") -> float:
        return float(np.degrees(self.d.qpos[self._qadr[joint]]))

    def colour_muscles(self) -> None:
        """Muscle paths from relaxed grey-pink to red with activation."""
        act = np.clip(self.d.act, 0.0, 1.0)
        for i, t in enumerate(self.tendon_of):
            if t >= 0:
                k = act[i] ** 0.6               # low activations stay visible
                self.m.tendon_rgba[t] = RELAXED_RGBA + k * (ACTIVE_RGBA - RELAXED_RGBA)

    def push_arrow(self, scale_m_per_n: float = 0.012) -> tuple[np.ndarray, np.ndarray]:
        """(tail, head) of the push in world, ending on the palm."""
        head = self.d.xpos[self.hand_body].copy()
        return head - self.push_dir * self.push_n * scale_m_per_n, head


def push_response(level: float, newtons: float = 4.0, settle_s: float = 0.6,
                  push_s: float = 0.3, after_s: float = 0.6, sim: Sim | None = None) -> dict:
    """One push at one level: drift before it, and the peak wrist excursion."""
    sim = sim or Sim()
    sim.reset(level)
    dt = sim.m.opt.timestep
    start = sim.angle_deg()
    sim.step(int(round(settle_s / dt)))
    base = sim.angle_deg()
    sim.push(newtons, push_s)
    peak = 0.0
    for _ in range(int(round((push_s + after_s) / dt))):
        sim.step()
        peak = max(peak, abs(sim.angle_deg() - base))
    return {"level": level, "drift_deg": base - start, "peak_deg": peak,
            "end_offset_deg": sim.angle_deg() - base}
