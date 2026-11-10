"""Quasi-static inverse dynamics on MyoHand: the torques the muscles must make.

docs/glove/DIGITAL_TWIN_PLAN.md §4 ("Inverse dynamics"), gate T2.

For a held pose (zero velocity and acceleration), MuJoCo's ``mj_inverse``
gives the generalised force needed against gravity and the joints' passive
forces. MuJoCo defines that as everything applied to the hand together:
``qfrc_inverse = qfrc_actuator + J^T * external``. The external part is the
measured contact forces, projected onto the joints with ``mj_applyFT``, so
what the muscles must supply is the difference.

Muscles in MuJoCo make ``force = gain(length, velocity) * activation +
bias(length, velocity)``, where the bias is passive tension. Both are read off
the model at the current pose by evaluating the actuators at activation 0 and
1, which makes the muscle side linear in activation for core.twin.static_opt.
"""

from __future__ import annotations

from typing import Mapping, Sequence

import mujoco
import numpy as np

from .model import HandModel


def external_torque(hm: HandModel, vectors: Mapping[str, np.ndarray]) -> np.ndarray:
    """Joint-space torque (n_dof,) from contact force vectors on the pads."""
    m, d = hm.m, hm.d
    q = np.zeros(m.nv)
    zero = np.zeros(3)
    for ch, f in vectors.items():
        point, _ = hm.pad_world(ch)
        mujoco.mj_applyFT(m, d, np.asarray(f, dtype=float), zero, point,
                          hm.pads[ch].body, q)
    return q


def required_torque(hm: HandModel, forces: Mapping[str, float | None] | None = None,
                    g_hand: Sequence[float] | None = None) -> dict:
    """The torque the muscles must supply to hold the current pose.

    Call after ``hm.set_pose()``. ``forces`` are measured normal forces in N by
    channel (p0..p3, h0..h2); ``g_hand`` the gravity direction in the hand
    frame (None: MyoHand's thumb-up default).

    Returns ``{"tau", "tau_inverse", "tau_external", "vectors"}``, torques in
    N*m per dof. ``tau`` is the muscles' share: positive along each joint's
    positive direction (flexion for the fingers, extension for the thumb's
    flexion joints, whose flexion is negative in MyoHand).
    """
    m, d = hm.m, hm.d
    hm.set_gravity(g_hand)
    d.qvel[:] = 0.0
    d.qacc[:] = 0.0
    mujoco.mj_inverse(m, d)
    tau_inv = d.qfrc_inverse.copy()
    vectors = hm.contact_vectors(forces or {})
    tau_ext = external_torque(hm, vectors)
    return {"tau": tau_inv - tau_ext, "tau_inverse": tau_inv,
            "tau_external": tau_ext, "vectors": vectors}


def muscle_terms(hm: HandModel) -> dict:
    """The muscles' torque, linear in activation, at the current pose.

    Returns ``{"A", "bias", "gain", "f_bias", "moment"}``: joint torque =
    ``A @ a + bias`` with ``A`` (n_dof, n_muscles) and ``bias`` (n_dof,), both
    N*m; ``gain``/``f_bias`` are the per-muscle forces behind them (N, MuJoCo's
    sign: negative pulls).
    """
    m, d = hm.m, hm.d
    act0 = d.act.copy()
    d.act[:] = 0.0
    mujoco.mj_fwdActuation(m, d)
    f_bias = d.actuator_force.copy()
    d.act[:] = 1.0
    mujoco.mj_fwdActuation(m, d)
    gain = d.actuator_force.copy() - f_bias
    d.act[:] = act0
    mujoco.mj_fwdActuation(m, d)
    moment = hm.moment_matrix()
    A = moment.T * gain[None, :]
    return {"A": A, "bias": moment.T @ f_bias, "gain": gain,
            "f_bias": f_bias, "moment": moment}
