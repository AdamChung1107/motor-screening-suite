"""Static optimisation: joint torques → muscle activations. numpy + scipy.

docs/glove/DIGITAL_TWIN_PLAN.md §2 and §4. No MuJoCo here: the caller hands
over the torque each muscle makes per unit activation (``A``) and the torque
the muscles must supply (``b``), so this module is unit-tested on toy systems.

**What this cannot do, by construction.** Among all activations that produce
the required torques, it picks the cheapest. Two opposing muscles both
pulling (co-contraction) always costs more than one pulling alone, so the
answer never shows co-contraction unless a torque *requires* it.
:func:`solve` on a one-joint flexor/extensor pair returns the extensor at
zero for any flexion torque, which ``test_twin.py`` pins down. That is the
reason no co-contraction index is computed from these activations anywhere
in the project while EMG is deferred.

**Two costs, compared** (plan §2). Both are standard in the literature and
both avoid co-contraction; they differ in how they share a torque between
synergists, which is exactly where the estimate is weakest:

* ``"activation"``: sum of squared activations (each muscle's effort);
* ``"force"``: sum of squared muscle forces, which loads small muscles first.

A muscle whose activation moves a lot between the two is reported as
cost-sensitive (:func:`cost_sensitive`) and is not shown as a reading.

**Joint limits carry torque.** A joint at the end of its range is held there
by its ligaments and capsule as well as by muscle. MyoHand's finger flexion
joints range 0-90 degrees, so a straight finger sits on its limit, and with
the limit ignored the muscles were asked to hold off MyoHand's passive
tension alone: holding a straight hand palm down took EDC2 at 0.6-0.7, an
extensor-flexor tangle. :func:`solve` takes the side each joint's limit is on
and lets the limit supply any torque that pushes into it, free; the muscles
make the rest. The torque the limits carried is returned and reported.
"""

from __future__ import annotations

import numpy as np

COSTS = ("activation", "force")

#: Weight on the activation term against the torque-tracking term, which is
#: measured as a fraction of each joint's capacity. Small enough that the
#: muscles make every torque they can and the cost only chooses among the ways
#: to make it: at 1e-3 (the first value) it was cheaper to leave a 0.03 N*m
#: wrist torque unmade, about 1 % of the wrist's capacity, and it was reported
#: as torque the muscles cannot make. Swept on six poses (straight, pinch,
#: index press, fist; 2026-11-09): the dropped torque vanished at 1e-5 with
#: joint limits carrying their share, and 1e-6 sits a decade below.
REG = 1e-6

#: A muscle is cost-sensitive in a frame when its two activations differ by
#: more than ABS_TOL and by more than REL_TOL of the larger one.
ABS_TOL = 0.05
REL_TOL = 0.5


def cost_weights(cost: str, f0: np.ndarray) -> np.ndarray:
    """Per-muscle weights for :func:`solve`.

    ``f0`` is each muscle's peak isometric force (N). For ``"force"``,
    activation a_i makes force ~ a_i * F0_i, so weighting a_i by F0_i makes the
    cost the sum of squared forces (scaled by the mean so the two costs sit on
    the same footing against :data:`REG`).
    """
    f0 = np.asarray(f0, dtype=float)
    if cost == "activation":
        return np.ones_like(f0)
    if cost == "force":
        return f0 / float(np.mean(f0))
    raise ValueError(f"unknown cost {cost!r}; expected one of {COSTS}")


def solve(A: np.ndarray, b: np.ndarray, weights: np.ndarray | None = None,
          reg: float = REG, limit: np.ndarray | None = None) -> dict:
    """Activations in [0, 1] that best produce torques ``b``.

    Minimises ``sum_j ((A a + l - b)_j / cap_j)^2 + reg * sum_i (w_i a_i)^2``
    with ``0 <= a <= 1``, where ``cap_j`` is joint j's capacity (the torque its
    muscles make when all fully active, by magnitude) and ``l`` is the torque
    the joint limits carry: free, but only at a joint on a limit and only in
    the direction that pushes into it.

    A     : (n_joints, n_muscles) torque per unit activation, N*m
    b     : (n_joints,) torque the muscles must supply, N*m
    limit : (n_joints,) per joint, the sign of torque its limit can supply:
            +1 on the lower limit, -1 on the upper, 0 inside the range
            (core.twin.model.HandModel.limit_sides). None: no limits.

    Returns ``{"a", "residual", "limit", "unactuated", "saturated"}``:

    * ``residual`` (N*m, per joint) is the torque left unexplained. It is
      large when a torque exceeds what the muscles can make, or when no muscle
      crosses the joint (``unactuated``), and it is reported, never hidden.
    * ``limit`` (N*m, per joint) is the torque the joint limits carried.
    * ``saturated`` lists muscles at full activation.
    """
    from scipy.optimize import lsq_linear, nnls

    A = np.asarray(A, dtype=float)
    b = np.asarray(b, dtype=float)
    n_j, n_m = A.shape
    w = np.ones(n_m) if weights is None else np.asarray(weights, dtype=float)

    side = np.zeros(n_j) if limit is None else np.sign(np.asarray(limit, dtype=float))

    cap = np.abs(A).sum(axis=1)
    act = cap > 1e-12
    a = np.zeros(n_m)
    lim_t = np.zeros(n_j)
    if act.any():
        An = A[act] / cap[act, None]
        bn = b[act] / cap[act]
        # One free, one-sided column per joint on a limit (normalised units).
        rows = np.flatnonzero(side[act])
        L = np.zeros((len(bn), len(rows)))
        L[rows, np.arange(len(rows))] = side[act][rows]
        M = np.vstack([np.hstack([An, L]),
                       np.hstack([np.sqrt(reg) * np.diag(w), np.zeros((n_m, len(rows)))])])
        y = np.concatenate([bn, np.zeros(n_m)])
        # The upper bound is rarely active, so try the lower-bounded problem
        # first (nnls, ~100x faster than bvls here) and fall back to the
        # fully bounded solver only when a muscle would exceed full activation.
        # Same objective either way, so the answer is the same.
        x, _ = nnls(M, y)
        if x[:n_m].max(initial=0.0) > 1.0:
            hi = np.concatenate([np.ones(n_m), np.full(len(rows), np.inf)])
            x = lsq_linear(M, y, bounds=(np.zeros(n_m + len(rows)), hi), method="bvls").x
        a = np.clip(x[:n_m], 0.0, 1.0)
        j = np.flatnonzero(act)[rows]
        lim_t[j] = side[j] * np.maximum(x[n_m:], 0.0) * cap[j]
    # A joint no muscle crosses still rests on its limit, when it is on one.
    rest = ~act & (side * b > 0)
    lim_t[rest] = b[rest]
    residual = b - A @ a - lim_t
    return {
        "a": a,
        "residual": residual,
        "limit": lim_t,
        "unactuated": np.flatnonzero(~act),
        "saturated": np.flatnonzero(a > 0.999),
    }


def cost_sensitive(a1: np.ndarray, a2: np.ndarray,
                   abs_tol: float = ABS_TOL, rel_tol: float = REL_TOL) -> np.ndarray:
    """Boolean mask: muscles whose activation depends on the cost chosen."""
    a1 = np.asarray(a1, dtype=float)
    a2 = np.asarray(a2, dtype=float)
    diff = np.abs(a1 - a2)
    big = np.maximum(np.abs(a1), np.abs(a2))
    return (diff > abs_tol) & (diff > rel_tol * big)
