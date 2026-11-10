"""The musculoskeletal hand twin (docs/glove/DIGITAL_TWIN_PLAN.md).

The glove's measurements placed on MuJoCo's MyoHand (MyoSim): hand pose, the
joint torques that hold it against gravity and the measured contact forces,
and a muscle-activation estimate. Offline, on recorded data.

Read the plan's §2 before using any output. Without EMG the muscle estimate
comes from static optimisation, which avoids co-contraction by construction,
so it is a model estimate and never a reading about the person. Pose, joint
torques and the grasp quantities in :mod:`core.twin.proxies` come from
measurements.

MuJoCo and the MyoHand model are **optional** (``python install.py --twin``).
The pure modules (:mod:`retarget`, :mod:`static_opt`, :mod:`proxies`) import
without them; :mod:`model`, :mod:`inverse` and :mod:`pipeline` need them and
are imported only when :func:`available` says so, the way pyserial is handled
in ``core/glove/serial_io.py``.
"""

from __future__ import annotations

import importlib

#: Stamped into every saved twin result. Bump it when a change would alter a
#: saved number, so a re-run is traceable (the spiral's ENGINE_VERSION rule).
TWIN_VERSION = 1

#: What ``install.py --twin`` installs. myo-sim brings MuJoCo (it pins <4 at
#: 0.2.4) and the MyoHand model; scipy is the static-optimisation solver,
#: listed because the base install does not otherwise guarantee it.
REQUIREMENTS = ("myo-sim>=0.2.4,<0.3", "scipy>=1.10")


def available() -> bool:
    """Are MuJoCo, the MyoHand model and scipy importable right now?

    Re-checked on each call (not cached as False), so a package installed
    while the hub runs is picked up without a restart.
    """
    importlib.invalidate_caches()
    try:
        for name in ("mujoco", "myo_sim", "scipy"):
            importlib.import_module(name)
    except ImportError:
        return False
    return True


def missing_message() -> str:
    """One line for a console or the hub when the twin cannot run."""
    return ("The hand twin needs MuJoCo and the MyoHand model: "
            "run 'python install.py --twin'.")
