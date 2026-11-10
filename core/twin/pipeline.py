"""Run the twin over a recording, frame by frame. Needs MuJoCo.

docs/glove/DIGITAL_TWIN_PLAN.md §4. Each frame: pose MyoHand, compute the
torques the muscles must make against gravity and the measured contact forces
(core.twin.inverse), then estimate activations under both costs
(core.twin.static_opt) and flag the muscles whose estimate depends on the cost.

:func:`summarise` turns the result into the JSON-ready block a session
record carries (``raw.twin`` traces are left to the caller, so it can decimate).
Every summary lists its assumptions; they are part of the reading.
"""

from __future__ import annotations

import math
from typing import Callable, Iterable, Sequence

import numpy as np

from . import TWIN_VERSION
from .inverse import muscle_terms, required_torque
from .model import HandModel, load
from .proxies import internal_force
from .recording import TwinFrame
from .static_opt import COSTS, cost_sensitive, cost_weights, solve

#: A muscle's estimate is reported only if it is cost-sensitive in fewer than
#: this share of frames (plan §2: "if a reading changes a lot between the two,
#: it is the cost talking").
REPORTABLE_MAX_SENSITIVE = 0.1

ASSUMPTIONS = (
    "Each flex strip is split across its finger's joints by a fixed synergy "
    "(core/twin/retarget.py FIST_DEG), provisional until gate 9 measures it.",
    "Wrist, forearm rotation and finger spread are held neutral.",
    "Each force is applied along its pad's normal: an FSR measures only the "
    "normal component.",
    "Pads are placed from MyoHand's anatomy, not measured on the glove.",
    "Quasi-static: inertial torques are left out.",
    "A joint at the end of its range (within 1 degree) carries the torque "
    "that pushes into that end itself, as ligaments do; the muscles make the "
    "rest. A straight finger is at its end.",
    "Muscle activations are a static-optimisation estimate. It avoids "
    "co-contraction by construction, so no co-contraction index is computed.",
)


def run(frames: Iterable[TwinFrame], costs: Sequence[str] = COSTS,
        hm: HandModel | None = None,
        progress: Callable[[int], None] | None = None) -> dict:
    """The twin over every frame. Returns numpy arrays, frame-major."""
    hm = hm or load()
    dof_names = sorted(hm.joints, key=lambda n: hm.dofadr[n])
    weights = {c: cost_weights(c, hm.f0) for c in costs}

    t, tau, clipped, inner = [], [], [], []
    act = {c: [] for c in costs}
    resid = {c: [] for c in costs}
    limit = {c: [] for c in costs}
    for k, fr in enumerate(frames):
        clip = hm.set_pose(fr.angles)
        req = required_torque(hm, fr.forces, fr.g_hand)
        mus = muscle_terms(hm)
        b = req["tau"] - mus["bias"]
        sides = hm.limit_sides()
        for c in costs:
            sol = solve(mus["A"], b, weights[c], limit=sides)
            act[c].append(sol["a"])
            resid[c].append(sol["residual"])
            limit[c].append(sol["limit"])
        t.append(float(fr.t))
        tau.append(req["tau"])
        clipped.append(sum(clip.values()))
        inner.append(internal_force(req["vectors"].values()))
        if progress is not None:
            progress(k)

    out = {
        "t": np.asarray(t),
        "dofs": dof_names,
        "muscles": list(hm.muscles),
        "tau": np.asarray(tau).reshape(len(t), -1),
        "activation": {c: np.asarray(v).reshape(len(t), -1) for c, v in act.items()},
        "residual": {c: np.asarray(v).reshape(len(t), -1) for c, v in resid.items()},
        "limit_torque": {c: np.asarray(v).reshape(len(t), -1) for c, v in limit.items()},
        "internal_force": inner,
        "clipped_joints": np.asarray(clipped),
        "model": hm.info(),
    }
    if len(costs) >= 2 and len(t):
        a1, a2 = (out["activation"][c] for c in costs[:2])
        out["sensitive"] = cost_sensitive(a1, a2)
    return out


def _r(x: float, nd: int = 4) -> float | None:
    return None if x is None or not math.isfinite(x) else round(float(x), nd)


def summarise(res: dict) -> dict:
    """The JSON-ready summary a record carries (English labels, guardrail 8)."""
    n = len(res["t"])
    s: dict = {"twin_version": TWIN_VERSION, "model": res["model"],
               "frames": n, "assumptions": list(ASSUMPTIONS)}
    if n == 0:
        return s
    tau = res["tau"]
    s["duration_s"] = _r(float(res["t"][-1] - res["t"][0]), 3)
    s["peak_torque_nm"] = {d: _r(float(np.max(np.abs(tau[:, i])))) for i, d in enumerate(res["dofs"])}
    s["frames_with_clipped_joints"] = int(np.count_nonzero(res["clipped_joints"]))
    s["max_unexplained_torque_nm"] = {
        c: {d: _r(float(np.max(np.abs(r[:, i])))) for i, d in enumerate(res["dofs"])}
        for c, r in res["residual"].items()}
    s["max_limit_torque_nm"] = {
        c: {d: _r(float(np.max(np.abs(r[:, i])))) for i, d in enumerate(res["dofs"])
            if np.any(r[:, i])}
        for c, r in res["limit_torque"].items()}
    inner = res["internal_force"]
    s["internal_force_n"] = {
        k: {"median": _r(float(np.median([x[k] for x in inner])), 3),
            "max": _r(float(np.max([x[k] for x in inner])), 3)}
        for k in ("total", "net", "internal")}
    if "sensitive" in res:
        frac = res["sensitive"].mean(axis=0)
        s["cost_sensitive_share"] = {m: _r(float(f), 3) for m, f in zip(res["muscles"], frac)}
        s["reportable_muscles"] = [m for m, f in zip(res["muscles"], frac)
                                   if f < REPORTABLE_MAX_SENSITIVE]
        costs = list(res["activation"])
        s["mean_activation_estimate"] = {
            m: {c: _r(float(res["activation"][c][:, i].mean()), 3) for c in costs}
            for i, m in enumerate(res["muscles"]) if m in s["reportable_muscles"]}
    return s
