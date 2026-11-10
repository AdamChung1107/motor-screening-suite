"""Glove orientation: the hub's IMU fusion and two-pose mounting calibration.

A line-for-line Python port of ``launcher_web/glove_fusion.js``, so a recorded
session gets the same orientation the hub's 3D hand showed live. The two must
agree: ``test_glove.py`` runs both on the same samples when Node is present.
Change one, change both. Pure, stdlib-only, like :mod:`core.glove.imu`.

What the board gives: accelerometer (g) and gyroscope (deg/s) at 100 Hz in
the BOARD's axes, no magnetometer. Tilt (which way is down) is absolute,
because gravity pins it; heading is not, and the hub's heading (which way the
screen is) is left out here because nothing offline needs it.

Fusion is Mahony's complementary filter (Mahony, Hamel & Pflimlin 2008),
proportional term only: the gyro carries the motion and gravity pulls the
tilt back, trusted only while |a| is near 1 g. A slow tracker learns the
gyro's bias while the hand is still.

Quaternions are ``(w, x, y, z)``. ``Fusion.q`` maps BOARD -> EARTH (z up);
``mount`` maps HAND -> BOARD. Hand axes are ``(fingers x palmar, fingers,
palmar)``, which on a right hand is (radial, distal, palmar):
``core.twin.retarget.HAND_FRAME``. The glove is a right hand (CAD V1-V6).

Mounting is measured with two held poses (the Developer page's Calibrate):
  1. palm down, flat: gravity reads along the back of the hand;
  2. fingers up: gravity reads along the fingers.
Until then :data:`DEFAULT_MOUNT` stands in: the board flat on the back of the
hand, chip side out, its +Y arrow toward the fingers.

Added here, not in the JS: :meth:`Fusion.gravity_in_hand` (the twin's gravity
direction) and :meth:`Fusion.vertical_g` (the lift signal for a
pinch-and-lift).
"""

from __future__ import annotations

import math
from typing import Sequence

Vec = tuple[float, float, float]
Quat = tuple[float, float, float, float]

KP = 1.0                 # gravity pull on tilt, 1/s
ACC_TRUST_G = 0.15       # use gravity only while | |a| - 1 g | < this
STILL_GYRO_DPS = 4.0     # still: rotating slower than this...
STILL_ACC_G = 0.05       # ...and |a| within this of 1 g
BIAS_AFTER_S = 0.5       # still this long before gyro bias learns
BIAS_RATE = 0.02         # per-sample EMA weight for the bias
CAL_SAMPLES = 80         # 0.8 s of stillness per calibration pose
CAL_MIN_DEG = 50.0       # the two poses must differ by at least this

_UINT32 = 1 << 32


# ── small vector / quaternion helpers ─────────────────────────────────────

def _dot(a: Sequence[float], b: Sequence[float]) -> float:
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def _cross(a: Sequence[float], b: Sequence[float]) -> Vec:
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2],
            a[0] * b[1] - a[1] * b[0])


def _norm(a: Sequence[float]) -> Vec | None:
    n = math.hypot(a[0], a[1], a[2])
    return (a[0] / n, a[1] / n, a[2] / n) if n else None


def qmul(a: Sequence[float], b: Sequence[float]) -> Quat:
    return (a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
            a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
            a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
            a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0])


def qconj(q: Sequence[float]) -> Quat:
    return (q[0], -q[1], -q[2], -q[3])


def qrot(q: Sequence[float], v: Sequence[float]) -> Vec:
    r = qmul(qmul(q, (0.0, v[0], v[1], v[2])), qconj(q))
    return (r[1], r[2], r[3])


def q_from_basis(x: Sequence[float], y: Sequence[float], z: Sequence[float]) -> Quat:
    """Rotation whose columns are the given orthonormal axes, i.e. it maps
    (1,0,0)->x, (0,1,0)->y, (0,0,1)->z."""
    m00, m01, m02 = x[0], y[0], z[0]
    m10, m11, m12 = x[1], y[1], z[1]
    m20, m21, m22 = x[2], y[2], z[2]
    tr = m00 + m11 + m22
    if tr > 0:
        s = 0.5 / math.sqrt(tr + 1)
        q = (0.25 / s, (m21 - m12) * s, (m02 - m20) * s, (m10 - m01) * s)
    elif m00 > m11 and m00 > m22:
        s = 2 * math.sqrt(1 + m00 - m11 - m22)
        q = ((m21 - m12) / s, 0.25 * s, (m01 + m10) / s, (m02 + m20) / s)
    elif m11 > m22:
        s = 2 * math.sqrt(1 + m11 - m00 - m22)
        q = ((m02 - m20) / s, (m01 + m10) / s, 0.25 * s, (m12 + m21) / s)
    else:
        s = 2 * math.sqrt(1 + m22 - m00 - m11)
        q = ((m10 - m01) / s, (m02 + m20) / s, (m12 + m21) / s, 0.25 * s)
    n = math.hypot(*q)
    return (q[0] / n, q[1] / n, q[2] / n, q[3] / n)


def _q_between(a: Sequence[float], b: Sequence[float]) -> Quat:
    """Shortest rotation taking unit vector a onto unit vector b."""
    c, d = _cross(a, b), _dot(a, b)
    if d < -0.999999:
        axis = _norm(_cross(a, (1, 0, 0)) if abs(a[0]) < 0.9 else _cross(a, (0, 1, 0)))
        return (0.0, axis[0], axis[1], axis[2])
    q = (1 + d, c[0], c[1], c[2])
    n = math.hypot(*q)
    return (q[0] / n, q[1] / n, q[2] / n, q[3] / n)


def _default_mount() -> Quat:
    fingers, palmar = (0.0, 1.0, 0.0), (0.0, 0.0, -1.0)
    return q_from_basis(_cross(fingers, palmar), fingers, palmar)


#: Before calibration: board flat on the back of the hand, chip side out,
#: +Y toward the fingers (how the MPU6050 breakout is strapped on).
DEFAULT_MOUNT: Quat = _default_mount()


# ── the filter ────────────────────────────────────────────────────────────

class Fusion:
    """One glove's orientation filter (``createFusion()`` in the JS)."""

    def __init__(self, mount: Sequence[float] | None = None) -> None:
        self.q: Quat = (1.0, 0.0, 0.0, 0.0)
        self.ready = False
        self.last_t: int | None = None
        self.bias = [0.0, 0.0, 0.0]
        self.still_for = 0.0
        self.still = False
        self.mount: Quat | None = None
        #: ``{"step", "sum", "n", "first", "error"}`` while calibrating.
        self.cal: dict | None = None
        if mount is not None:
            self.import_mount(mount)

    def step(self, a: Sequence[float], g_dps: Sequence[float], t_us: int) -> None:
        """One IMU sample: ``a`` in g, ``g_dps`` in deg/s, board axes;
        ``t_us`` the board's own microsecond clock (u32, wraps every ~71 min)."""
        dt = 0.0
        if self.last_t is not None:
            dt = ((int(t_us) - self.last_t) % _UINT32) / 1e6
        self.last_t = int(t_us)
        if not (0 < dt < 0.1):
            dt = 0.0             # first sample, or a gap: do not integrate across it

        an = math.hypot(a[0], a[1], a[2])
        gm = math.hypot(g_dps[0], g_dps[1], g_dps[2])
        self.still = gm < STILL_GYRO_DPS and abs(an - 1) < STILL_ACC_G
        self.still_for = self.still_for + dt if self.still else 0.0
        if self.still_for > BIAS_AFTER_S:
            for k in range(3):
                self.bias[k] += BIAS_RATE * (g_dps[k] - self.bias[k])
        if self.cal is not None:
            self._cal_sample(a)

        if not self.ready:
            if an > 0.5:
                self.q = _q_between(_norm(a), (0.0, 0.0, 1.0))
                self.ready = True
            return
        if dt == 0:
            return

        d2r = math.pi / 180
        gx = (g_dps[0] - self.bias[0]) * d2r
        gy = (g_dps[1] - self.bias[1]) * d2r
        gz = (g_dps[2] - self.bias[2]) * d2r
        q0, q1, q2, q3 = self.q

        if abs(an - 1) < ACC_TRUST_G:
            ax, ay, az = a[0] / an, a[1] / an, a[2] / an
            # Where the current estimate thinks "up" is, in board axes.
            vx = 2 * (q1 * q3 - q0 * q2)
            vy = 2 * (q0 * q1 + q2 * q3)
            vz = q0 * q0 - q1 * q1 - q2 * q2 + q3 * q3
            gx += KP * (ay * vz - az * vy)
            gy += KP * (az * vx - ax * vz)
            gz += KP * (ax * vy - ay * vx)

        h = 0.5 * dt
        n0 = q0 + (-q1 * gx - q2 * gy - q3 * gz) * h
        n1 = q1 + (q0 * gx + q2 * gz - q3 * gy) * h
        n2 = q2 + (q0 * gy - q1 * gz + q3 * gx) * h
        n3 = q3 + (q0 * gz + q1 * gy - q2 * gx) * h
        n = math.hypot(n0, n1, n2, n3)
        self.q = (n0 / n, n1 / n, n2 / n, n3 / n)

    # ── calibration ───────────────────────────────────────────────────────

    def start_calibration(self) -> None:
        self.cal = {"step": 1, "sum": [0.0, 0.0, 0.0], "n": 0, "first": None,
                    "error": None}

    def cancel_calibration(self) -> None:
        self.cal = None

    def _cal_sample(self, a: Sequence[float]) -> None:
        c = self.cal
        if not self.still:                       # any movement restarts the hold
            c["sum"], c["n"] = [0.0, 0.0, 0.0], 0
            return
        for k in range(3):
            c["sum"][k] += a[k]
        c["n"] += 1
        if c["n"] < CAL_SAMPLES:
            return
        up = _norm(c["sum"])                     # at rest, the accelerometer reads UP
        c["sum"], c["n"] = [0.0, 0.0, 0.0], 0
        if c["step"] == 1:
            c["first"] = up                      # back of the hand
            c["step"], c["error"] = 2, None
            return
        deg = math.degrees(math.acos(max(-1.0, min(1.0, _dot(up, c["first"])))))
        if deg < CAL_MIN_DEG:
            c["error"] = "too-close"
            return
        dorsal = c["first"]
        d = _dot(up, dorsal)
        fingers = _norm(tuple(up[k] - d * dorsal[k] for k in range(3)))
        palmar = (-dorsal[0], -dorsal[1], -dorsal[2])
        side = _cross(fingers, palmar)
        # Hand axes: x = fingers x palm, y = fingers, z = palm normal.
        self.mount = q_from_basis(side, fingers, palmar)
        self.cal = None

    # ── mount ─────────────────────────────────────────────────────────────

    def mount_of(self) -> Quat:
        return self.mount or DEFAULT_MOUNT

    def export_mount(self) -> list[float] | None:
        return list(self.mount) if self.mount else None

    def import_mount(self, m: Sequence[float]) -> None:
        """Take a saved mount (the hub keeps one per IMU); ignores bad input,
        as the JS does."""
        try:
            vals = [float(x) for x in m]
        except (TypeError, ValueError):
            return
        if len(vals) == 4 and all(math.isfinite(x) for x in vals):
            self.mount = (vals[0], vals[1], vals[2], vals[3])

    # ── readings (Python only) ────────────────────────────────────────────

    def gravity_board(self) -> Vec | None:
        """Unit direction gravity points, in board axes; None until ready."""
        if not self.ready:
            return None
        return qrot(qconj(self.q), (0.0, 0.0, -1.0))

    def gravity_in_hand(self) -> Vec | None:
        """Unit direction gravity points, in hand axes (fingers x palmar,
        fingers, palmar); None until ready. Palm down reads (0, 0, 1)."""
        g = self.gravity_board()
        return None if g is None else hand_from_board(self.mount_of(), g)

    def vertical_g(self, a: Sequence[float]) -> float | None:
        """Specific force along the vertical, g, for the sample just stepped:
        1.0 at rest, above it while accelerating upward. Unlike |a| it ignores
        sideways moves, so it marks a lift."""
        if not self.ready:
            return None
        return qrot(self.q, a)[2]


def hand_from_board(mount: Sequence[float], v: Sequence[float]) -> Vec:
    """A board-axes direction in hand axes, through a mount (hand -> board)."""
    return qrot(qconj(mount), v)
