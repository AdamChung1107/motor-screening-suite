"""Grasp quantities that need no EMG. Pure numpy.

docs/glove/DIGITAL_TWIN_PLAN.md §3, gate T4. These are the twin's readings
that come from measurements (contact forces, and the pose that places them),
unlike the muscle activations, which are a model estimate.

* :func:`internal_force` — the part of the contact force that cancels between
  pads (squeezing) against the part that does the task (net force). The
  grasp-level counterpart of co-contraction: force spent beyond what the task
  needs. It needs each force's direction, which only the twin's pose gives.
* :func:`pinch_lift` — preload time, grip force rate and hold force for a
  pinch-and-lift of a known object. Ingvarsson, Gordon & Forssberg (1997)
  found the preload (first contact to lift-off) prolonged in PD, and Fellows,
  Noth & Schwarz (1998) a slower grip force rise and a raised hold force with
  a normal grip/load ratio (docs/research/11-hand-rehab.md). Readings to
  check on our own runs, not assumed markers.
* :func:`still_force_fraction` — share of a window spent pressing while the
  hand is not moving: the design notes' "effort with no net motion", stated
  as what is measured.

Thresholds below are starting points for gate T4, not validated values.
"""

from __future__ import annotations

from typing import Iterable, Sequence

import numpy as np

#: A pad is in contact above this force, N (just above the FSR402's rated
#: 0.2 N floor, so sensor noise does not start a contact).
CONTACT_N = 0.5
#: Lift-off: acceleration magnitude departs from 1 g by more than this, g.
LIFT_G = 0.05
#: How long the departure must last to count as the lift, s.
LIFT_HOLD_S = 0.05
#: Hold window, s after lift-off, for the hold force.
HOLD_WINDOW_S = (0.5, 1.5)
#: Grip force rate is taken over this span, s, not sample to sample: at
#: 100 Hz a single ADC step would otherwise read as the fastest rise.
RATE_SPAN_S = 0.05
#: "Still": bend changing slower than this (fraction of span per second) and
#: rotation slower than this (deg/s).
STILL_BEND_PER_S = 0.05
STILL_GYRO_DPS = 5.0


def internal_force(vectors: Iterable[Sequence[float]]) -> dict:
    """Total, net and internal contact force, N, from force vectors.

    ``internal = sum |F_i| - |sum F_i|``: zero when every pad pushes the same
    way (nothing cancels), and the whole total when the pads push straight
    against each other (a pure squeeze with no net force).
    """
    F = np.asarray(list(vectors), dtype=float).reshape(-1, 3)
    if F.size == 0:
        return {"total": 0.0, "net": 0.0, "internal": 0.0}
    total = float(np.linalg.norm(F, axis=1).sum())
    net = float(np.linalg.norm(F.sum(axis=0)))
    return {"total": total, "net": net, "internal": max(0.0, total - net)}


def _first_run(mask: np.ndarray, t: np.ndarray, min_s: float, start: int = 0) -> int | None:
    """Index where ``mask`` first stays True for at least ``min_s``."""
    i = start
    n = len(mask)
    while i < n:
        if mask[i]:
            j = i
            while j < n and mask[j]:
                j += 1
            if t[j - 1] - t[i] >= min_s:
                return i
            i = j
        else:
            i += 1
    return None


def pinch_lift(t: Sequence[float], grip_n: Sequence[float],
               accel_g: Sequence[float]) -> dict | None:
    """Preload time, grip force rate and hold force for one pinch-and-lift.

    t       : seconds
    grip_n  : grip force, N (the thumb and index pads, ``(p0 + p1) / 2``)
    accel_g : the lift signal, g, 1.0 at rest: the specific force along the
              vertical (core.glove.fusion.Fusion.vertical_g), or failing that
              the acceleration magnitude, which also moves with sideways moves

    Returns None when there is no contact, or no lift after it.
    """
    t = np.asarray(t, dtype=float)
    f = np.asarray(grip_n, dtype=float)
    a = np.asarray(accel_g, dtype=float)
    if len(t) < 3:
        return None
    contact = _first_run(f > CONTACT_N, t, 0.0)
    if contact is None:
        return None
    lift = _first_run(np.abs(a - 1.0) > LIFT_G, t, LIFT_HOLD_S, start=contact)
    if lift is None:
        return None
    rate = _peak_rate(t[contact:lift + 1], f[contact:lift + 1])
    h0, h1 = t[lift] + HOLD_WINDOW_S[0], t[lift] + HOLD_WINDOW_S[1]
    hold = (t >= h0) & (t <= h1)
    return {
        "contact_t": float(t[contact]),
        "lift_t": float(t[lift]),
        "preload_s": float(t[lift] - t[contact]),
        "grip_rate_n_per_s": None if rate is None or not np.isfinite(rate) else rate,
        "hold_force_n": float(np.median(f[hold])) if hold.any() else None,
    }


def _peak_rate(t: np.ndarray, f: np.ndarray) -> float | None:
    """Fastest rise over :data:`RATE_SPAN_S`, N/s; the whole segment's mean
    rise when it is shorter than the span."""
    if len(t) < 2 or t[-1] <= t[0]:
        return None
    j = np.searchsorted(t, t + RATE_SPAN_S - 1e-9)
    i = np.nonzero(j < len(t))[0]
    if not len(i):
        return float((f[-1] - f[0]) / (t[-1] - t[0]))
    return float(np.max((f[j[i]] - f[i]) / (t[j[i]] - t[i])))


def still_force_fraction(t: Sequence[float], total_n: Sequence[float],
                         bend: Sequence[float] | None = None,
                         gyro_dps: Sequence[float] | None = None) -> float | None:
    """Share of the time pressing (total force above contact) while still.

    ``bend`` is a bend fraction trace (any one strip, or the mean), ``gyro_dps``
    the rotation-rate magnitude. Either may be None; with both None every
    pressing sample counts as still, which is only useful in tests.
    """
    t = np.asarray(t, dtype=float)
    f = np.asarray(total_n, dtype=float)
    if len(t) < 2:
        return None
    pressing = f > CONTACT_N
    still = np.ones(len(t), dtype=bool)
    if bend is not None:
        b = np.asarray(bend, dtype=float)
        speed = np.abs(np.gradient(b, t))
        still &= speed < STILL_BEND_PER_S
    if gyro_dps is not None:
        still &= np.asarray(gyro_dps, dtype=float) < STILL_GYRO_DPS
    if not pressing.any():
        return 0.0
    return float((pressing & still).sum() / pressing.sum())
