"""Simulated sensor glove: the board's serial stream without the board.

For working on the Developer page when the glove is not to hand. It speaks the
firmware's wire protocol (``docs/glove/GLOVE_FIRMWARE_PLAN.md`` §4): a
``#GLOVE`` banner, ``G,…`` frames at 100 Hz, ``#ZERO`` and ``#DIAG``. So
everything downstream runs unchanged: the parser, the ring buffer, rate and
drop counters, ``imu_summary()`` (tilt and the tremor DFT), CSV recording and
every renderer on the page.

``GloveSim`` is pure: no I/O, an injected clock and a seeded RNG, so a test can
step it frame by frame. ``SimSerial`` puts it on the real clock behind the
slice of ``serial.Serial`` that ``GloveReader`` uses, which is how
``GloveReader.connect(SIM_PORT)`` swaps it in for a COM port.

Driven by named controls (``CONTROLS``), held or released from the page's
keyboard. A dead-man switch releases everything if the page stops reporting,
so a keyup lost to a closed tab cannot leave a finger bent for ever.

What it does NOT model: mux crosstalk, I2C dropouts, held IMU samples,
dropped frames, drift with temperature, or a strip shifting on the finger.
It is for exercising the page, never for judging the hardware or a test.
Its banner names itself (``fw=sim-1 board=sim imu=sim``) and its recordings
are named ``glove_sim_*``, so its data cannot pass for the glove's.
"""

from __future__ import annotations

import math
import random
import threading
import time

from .force import FSR402_CURVE
from .protocol import IMU_COLS, PROTO_SUPPORTED, sensor_ohms

SIM_PORT = "SIM"
SIM_FW = "sim-1"
SIM_BOARD = "sim"
SIM_IMU = "sim"

RATE_HZ = 100
DT = 1.0 / RATE_HZ
ADC_BITS = 12
ADC_MAX = (1 << ADC_BITS) - 1
ADC_REF_MV = 3300
VDIV_MV = 3300
R_FIXED_DEFAULT = 10000
IMU_SCALE = 1000            # milli-units per g and per deg/s, as the firmware

#: (name, kind, r_fixed) in frame order. A copy of ``CHANNELS[]`` in
#: firmware/glove/glove.ino (fw 0.11.1); test_glove.py fails when they drift.
CHANNELS = (
    ("p0", "fsr", 10000), ("p1", "fsr", 10000),
    ("p2", "fsr", 10000), ("p3", "fsr", 10000),
    ("f0", "flex", 47000), ("f1", "flex", 47000), ("f2", "flex", 47000),
    ("f3", "flex", 47000), ("f4", "flex", 47000),
    ("h0", "flexiforce", 47000),
)
N_PRESS = sum(1 for _n, k, _r in CHANNELS if k == "fsr")
N_BEND = sum(1 for _n, k, _r in CHANNELS if k == "flex")
N_PALM = sum(1 for _n, k, _r in CHANNELS if k == "flexiforce")

#: Every control the page may hold. The page's key map uses these names
#: (launcher_web/dev.js DEV_SIM_KEYS); test_glove.py checks the two agree.
CONTROLS = (
    tuple(f"bend{i}" for i in range(N_BEND)) + ("fist",)
    + tuple(f"press{i}" for i in range(N_PRESS))
    + ("pitch+", "pitch-", "roll+", "roll-", "yaw+", "yaw-", "level")
)

# ── how the simulated hand moves ─────────────────────────────────────────

BEND_RISE_S = 0.5           # straight -> fully bent while held
BEND_FALL_S = 0.35          # ...and back on release
PRESS_RISE_S = 0.8          # no contact -> full press
PRESS_FALL_S = 0.25

#: Resting flex resistance per finger, thumb -> pinky. The real strips sit
#: around 24-49 kOhm flat on their 47k legs (fw 0.10.0 frame in test_glove.py).
FLEX_FLAT_OHM = (30000.0, 26000.0, 24000.0, 32000.0, 28000.0)
#: Fully bent / flat. Above the page's 1.5x "observed span" bar, so one full
#: bend promotes the provisional span, as it does on the glove.
FLEX_BENT_RATIO = 2.6

PRESS_MIN_N = 0.2           # the FSR402's actuation force: where a press starts
PRESS_N = 8.0               # a firm fingertip press
HARD_PRESS_N = 30.0         # past the rated 20 N, to show the "above" badge
PRESS_OPEN_BELOW = 0.02     # press level under this reads as no contact

#: Palm A401s load with the fist control: a closed hand bears on the palm.
#: The A401 is linear in conductance, G = PALM_US_PER_N * F, so a fist's
#: PALM_FIST_N lands near 20 kOhm, partway up its 47k divider.
PALM_FIST_N = 15.0
PALM_US_PER_N = 3.3

TURN_DPS = 90.0             # hand rotation while an arrow key is held
TURN_EASE_S = 0.08          # time constant easing into and out of a turn
LEVEL_DONE_DEG = 0.3        # "level" stops this close to palm down

#: The tremor is a wrist oscillation seen by a board this far from the wrist:
#: it rotates the board (gyro) and swings it (linear accel). The linear part is
#: what moves ||a||, which is what core/glove/imu.band_power measures.
TREMOR_RADIUS_M = 0.07
TREMOR_HZ_RANGE = (2.0, 14.0)
TREMOR_MG_RANGE = (5.0, 400.0)
TREMOR_EASE_S = 0.3
G0 = 9.80665

ACCEL_NOISE_G = 0.004
GYRO_NOISE_DPS = 0.25
#: A small constant gyro offset, as a real MPU6050 has. glove_fusion.js learns
#: it while the hand is still, the same as on the glove.
GYRO_BIAS_DPS = (0.6, -0.4, 0.3)
ADC_NOISE = 1.2             # counts, one sigma
OPEN_COUNTS = 5             # an unpressed FSR reads 0..this, like the board

DEADMAN_S = 1.0             # release everything after this long without input
MAX_CATCH_UP_S = 1.0        # never synthesise more than this in one call


# ── small maths ──────────────────────────────────────────────────────────

def _qmul(a, b):
    return (
        a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
        a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
        a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
        a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0],
    )


def _qrot(q, v):
    """Rotate v by q (body -> earth when q is the board's orientation)."""
    r = _qmul(_qmul(q, (0.0, v[0], v[1], v[2])), (q[0], -q[1], -q[2], -q[3]))
    return (r[1], r[2], r[3])


def _qrot_inv(q, v):
    """Rotate v by q's inverse (earth -> body)."""
    return _qrot((q[0], -q[1], -q[2], -q[3]), v)


def _qnorm(q):
    n = math.sqrt(sum(c * c for c in q)) or 1.0
    return tuple(c / n for c in q)


def _cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2],
            a[0] * b[1] - a[1] * b[0])


def ohms_for_force(newtons: float) -> float:
    """FSR resistance for a force: the inverse of ``force.force_newtons``.

    Same log-log segments over ``FSR402_CURVE``, so the page reads back the
    force the simulator meant, and the curve is still written down only once.
    """
    pts = FSR402_CURVE
    last = len(pts) - 2
    if newtons <= pts[0][0]:
        seg = 0
    elif newtons >= pts[-1][0]:
        seg = last
    else:
        seg = next(i for i in range(last + 1) if pts[i][0] <= newtons <= pts[i + 1][0])
    (f0, r0), (f1, r1) = pts[seg], pts[seg + 1]
    t = (math.log(newtons) - math.log(f0)) / (math.log(f1) - math.log(f0))
    return math.exp(math.log(r0) + t * (math.log(r1) - math.log(r0)))


def adc_for_ohms(r_ohm: float, r_fixed: int) -> float:
    """Counts the divider gives for a sensor resistance (sensor on the high
    side, fixed resistor to ground), before noise and rounding."""
    mv = VDIV_MV * r_fixed / (r_fixed + r_ohm)
    return mv * ADC_MAX / ADC_REF_MV


def banner() -> str:
    """The simulated board's ``#GLOVE`` line, in the firmware's field order."""
    names = [n for n, _k, _r in CHANNELS] + list(IMU_COLS)
    chan = [f"{n}:{k}:{r}" for n, k, r in CHANNELS]
    chan += [f"{c}:{'accel' if c.startswith('a') else 'gyro'}" for c in IMU_COLS]
    return (f"#GLOVE fw={SIM_FW} proto={PROTO_SUPPORTED} board={SIM_BOARD} "
            f"rate={RATE_HZ} adc_bits={ADC_BITS} adc_ref_mv={ADC_REF_MV} "
            f"vdiv_mv={VDIV_MV} r_fixed={R_FIXED_DEFAULT} imu={SIM_IMU} "
            f"imu_scale={IMU_SCALE} emg=0 cols=seq,t_us,{','.join(names)} "
            f"chan={','.join(chan)}")


def _ramp(cur: float, up: bool, rise_s: float, fall_s: float, dt: float) -> float:
    if up:
        return min(1.0, cur + dt / rise_s)
    return max(0.0, cur - dt / fall_s)


class GloveSim:
    """The simulated board. Every method takes ``now`` from the caller's clock.

    Thread-safe: the reader thread pulls frames while HTTP threads send keys
    and commands.
    """

    def __init__(self, now: float = 0.0, seed: int | None = None):
        self._lock = threading.Lock()
        self._rng = random.Random(seed)
        self.streaming = True        # the firmware boots streaming
        self.diag = False
        self._seq = 0
        self._t0 = now               # t_us epoch, moved by 'Z'
        self._next_t = now           # when the next frame is due
        self._last_diag = now
        self._pending: list[str] = []

        self._held: frozenset[str] = frozenset()
        self._hard = False
        self._input_at = now
        self.tremor_on = False
        self.tremor_hz = 5.0
        self.tremor_mg = 60.0

        self.bend = [0.0] * N_BEND           # 0 straight .. 1 fully bent
        self.press = [0.0] * N_PRESS         # 0 no contact .. 1 full press
        self.palm = [0.0] * N_PALM           # 0 unloaded .. 1 a fist's load
        self.q = (1.0, 0.0, 0.0, 0.0)        # board -> earth; palm down, z up
        self._w = [0.0, 0.0, 0.0]            # eased body rate, rad/s
        self._leveling = False
        self._phase = 0.0
        self._tremor_env = 0.0
        self._min = [None] * len(CHANNELS)
        self._max = [None] * len(CHANNELS)
        self._last_values: list[int] = []

    # ── input ─────────────────────────────────────────────────────────

    def set_input(self, held, hard: bool = False, tremor: dict | None = None,
                  now: float = 0.0) -> None:
        """Replace the held set. Unknown names are dropped, not trusted."""
        keep = frozenset(str(h) for h in (held or ()) if str(h) in CONTROLS)
        with self._lock:
            self._held = keep
            self._hard = bool(hard)
            self._input_at = now
            if "level" in keep:
                self._leveling = True
            if isinstance(tremor, dict):
                if "on" in tremor:
                    self.tremor_on = bool(tremor["on"])
                self.tremor_hz = _clamp_num(tremor.get("hz"), self.tremor_hz, *TREMOR_HZ_RANGE)
                self.tremor_mg = _clamp_num(tremor.get("mg"), self.tremor_mg, *TREMOR_MG_RANGE)

    def state(self) -> dict:
        """What the page shows back: held controls and the tremor settings."""
        with self._lock:
            return {"held": sorted(self._held), "hard": self._hard,
                    "tremor": {"on": self.tremor_on, "hz": self.tremor_hz,
                               "mg": self.tremor_mg,
                               "hz_range": list(TREMOR_HZ_RANGE),
                               "mg_range": list(TREMOR_MG_RANGE)}}

    # ── commands, as the firmware's handleCommand() ───────────────────

    def command(self, cmd: str, now: float = 0.0) -> None:
        cmd = (cmd or "").strip().upper()
        with self._lock:
            if cmd == "?":
                self._pending.append(banner())
            elif cmd == "S":
                self.streaming = True
            elif cmd == "X":
                self.streaming = False
            elif cmd == "D":
                self.diag = not self.diag
                self._last_diag = self._next_t - 1.0   # first report on the next frame
            elif cmd == "Z":
                self._seq = 0
                self._t0 = self._next_t
                self._min = [None] * len(CHANNELS)
                self._max = [None] * len(CHANNELS)
                self._pending.append("#ZERO")

    # ── output ────────────────────────────────────────────────────────

    def next_due(self) -> float:
        with self._lock:
            return self._next_t

    def has_pending(self) -> bool:
        with self._lock:
            return bool(self._pending)

    def lines_until(self, now: float) -> list[str]:
        """Every line due by ``now``: queued replies first, then frames."""
        with self._lock:
            out, self._pending = self._pending, []
            if now - self._next_t > MAX_CATCH_UP_S:
                # A stalled reader: skip ahead rather than replay the gap, and
                # let seq jump so the host counts the gap as dropped frames,
                # the way it sees frames the firmware could not send.
                skip = int((now - MAX_CATCH_UP_S - self._next_t) / DT)
                self._next_t += skip * DT
                self._seq = (self._seq + skip) & 0xFFFFFFFF
            while self._next_t <= now:
                values = self._advance(self._next_t)
                if self.streaming:
                    t_us = int(round((self._next_t - self._t0) * 1e6)) & 0xFFFFFFFF
                    out.append(f"G,{self._seq},{t_us}," + ",".join(map(str, values)))
                    self._seq = (self._seq + 1) & 0xFFFFFFFF
                if self.diag and self._next_t - self._last_diag >= 1.0:
                    self._last_diag = self._next_t
                    out.extend(self._diag_lines(values))
                self._next_t += DT
            return out

    # ── one timestep ──────────────────────────────────────────────────

    def _advance(self, t: float) -> list[int]:
        if self._held and t - self._input_at > DEADMAN_S:
            self._held = frozenset()
            self._leveling = False
        held = self._held
        fist = "fist" in held

        for i in range(N_BEND):
            self.bend[i] = _ramp(self.bend[i], fist or f"bend{i}" in held,
                                 BEND_RISE_S, BEND_FALL_S, DT)
        for i in range(N_PRESS):
            self.press[i] = _ramp(self.press[i], f"press{i}" in held,
                                  PRESS_RISE_S, PRESS_FALL_S, DT)
        for i in range(N_PALM):
            self.palm[i] = _ramp(self.palm[i], fist, PRESS_RISE_S, PRESS_FALL_S, DT)

        accel, gyro = self._move(held)

        values: list[int] = []
        flex_i = press_i = palm_i = 0
        for name, kind, r_fixed in CHANNELS:
            if kind == "fsr":
                values.append(self._fsr_counts(self.press[press_i], r_fixed))
                press_i += 1
            elif kind == "flexiforce":
                values.append(self._palm_counts(self.palm[palm_i], r_fixed))
                palm_i += 1
            else:
                r = FLEX_FLAT_OHM[flex_i] * (1.0 + (FLEX_BENT_RATIO - 1.0) * self.bend[flex_i])
                values.append(self._counts(adc_for_ohms(r, r_fixed)))
                flex_i += 1
        for c, v in enumerate(values):
            if self._min[c] is None or v < self._min[c]:
                self._min[c] = v
            if self._max[c] is None or v > self._max[c]:
                self._max[c] = v
        values += [int(round(a * IMU_SCALE)) for a in accel]
        values += [int(round(g * IMU_SCALE)) for g in gyro]
        self._last_values = values
        return values

    def _fsr_counts(self, level: float, r_fixed: int) -> int:
        if level < PRESS_OPEN_BELOW:
            return self._rng.randint(0, OPEN_COUNTS)
        fmax = HARD_PRESS_N if self._hard else PRESS_N
        newtons = PRESS_MIN_N * (fmax / PRESS_MIN_N) ** level
        return self._counts(adc_for_ohms(ohms_for_force(newtons), r_fixed))

    def _palm_counts(self, level: float, r_fixed: int) -> int:
        if level < PRESS_OPEN_BELOW:
            return self._rng.randint(0, OPEN_COUNTS)
        return self._counts(adc_for_ohms(1e6 / (PALM_US_PER_N * PALM_FIST_N * level), r_fixed))

    def _counts(self, ideal: float) -> int:
        return max(0, min(ADC_MAX, int(round(ideal + self._rng.gauss(0.0, ADC_NOISE)))))

    def _move(self, held) -> tuple[tuple, tuple]:
        """Advance the orientation; return (accel g, gyro deg/s) in board axes.

        Board axes as glove_fusion.DEFAULT_MOUNT assumes: palm down puts +Z up
        (the accelerometer reads +1 g on z), +Y points along the fingers.
        Pitch turns about board X (+ tips the fingers up), roll about board Y,
        yaw about the vertical.
        """
        rate = math.radians(TURN_DPS)
        tgt = [0.0, 0.0, 0.0]
        turning = False
        for name, axis, sign in (("pitch+", 0, 1), ("pitch-", 0, -1),
                                 ("roll+", 1, 1), ("roll-", 1, -1)):
            if name in held:
                tgt[axis] += sign * rate
                turning = True
        yaw = (1 if "yaw+" in held else 0) - (1 if "yaw-" in held else 0)
        if yaw:
            turning = True
            wb = _qrot_inv(self.q, (0.0, 0.0, yaw * rate))
            tgt = [tgt[k] + wb[k] for k in range(3)]
        if turning:
            self._leveling = False
        elif self._leveling:
            # Turn the board's z back onto the vertical, about the horizontal
            # axis between them, so heading is kept.
            z_e = _qrot(self.q, (0.0, 0.0, 1.0))
            axis = _cross(z_e, (0.0, 0.0, 1.0))
            s = math.sqrt(sum(a * a for a in axis))
            angle = math.atan2(s, z_e[2])
            if math.degrees(angle) < LEVEL_DONE_DEG:
                self._leveling = False
            elif s > 1e-9:
                speed = min(rate, angle * 4.0)
                we = tuple(a / s * speed for a in axis)
                tgt = list(_qrot_inv(self.q, we))
            else:
                # Upside down: any horizontal axis will do.
                tgt = [rate, 0.0, 0.0]

        k = min(1.0, DT / TURN_EASE_S)
        self._w = [self._w[i] + (tgt[i] - self._w[i]) * k for i in range(3)]
        w = self._w
        wn = math.sqrt(w[0] ** 2 + w[1] ** 2 + w[2] ** 2)
        if wn > 1e-12:
            half = wn * DT / 2.0
            s = math.sin(half) / wn
            self.q = _qnorm(_qmul(self.q, (math.cos(half), w[0] * s, w[1] * s, w[2] * s)))

        # Tremor, laid on top of the posture rather than integrated into it,
        # so switching it off leaves the hand exactly where it was.
        env_up = self.tremor_on
        self._tremor_env = _ramp(self._tremor_env, env_up, TREMOR_EASE_S, TREMOR_EASE_S, DT)
        om = 2.0 * math.pi * self.tremor_hz
        self._phase = (self._phase + om * DT) % (2.0 * math.pi)
        a_lin = self._tremor_env * self.tremor_mg / 1000.0          # g, peak
        theta0 = a_lin * G0 / (om * om * TREMOR_RADIUS_M)          # rad, peak
        theta = theta0 * math.sin(self._phase)
        theta_dot = theta0 * om * math.cos(self._phase)
        q_out = _qmul(self.q, (math.cos(theta / 2), math.sin(theta / 2), 0.0, 0.0))

        up = _qrot_inv(q_out, (0.0, 0.0, 1.0))      # at rest the accelerometer reads up
        # Tangential acceleration of a point TREMOR_RADIUS_M along +Y, turning
        # about X: alpha x r = -theta0*om^2*r*sin(phase) along Z.
        lin_z = -a_lin * math.sin(self._phase)
        accel = (up[0] + self._rng.gauss(0, ACCEL_NOISE_G),
                 up[1] + self._rng.gauss(0, ACCEL_NOISE_G),
                 up[2] + lin_z + self._rng.gauss(0, ACCEL_NOISE_G))
        gyro = tuple(math.degrees(w[i] + (theta_dot if i == 0 else 0.0))
                     + GYRO_BIAS_DPS[i] + self._rng.gauss(0, GYRO_NOISE_DPS)
                     for i in range(3))
        return accel, gyro

    def _diag_lines(self, values: list[int]) -> list[str]:
        out = []
        for c, (name, _kind, r_fixed) in enumerate(CHANNELS):
            v = values[c]
            mv = v * ADC_REF_MV // ADC_MAX
            ohm = sensor_ohms(v, ADC_REF_MV, VDIV_MV, r_fixed, ADC_BITS)
            out.append(f"#DIAG {name} adc={v} mv={mv} ohm={'open' if ohm is None else ohm} "
                       f"min={self._min[c]} max={self._max[c]} missed=0")
        imu = values[len(CHANNELS):]
        out.append("#DIAG timing us sample=0/0 imu=0/0 tx=0/0  (simulated board)")
        out.append(f"#DIAG imu mg={imu[0]},{imu[1]},{imu[2]} "
                   f"mdps={imu[3]},{imu[4]},{imu[5]} held=0")
        return out


def _clamp_num(value, default: float, lo: float, hi: float) -> float:
    try:
        v = float(value)
    except (TypeError, ValueError):
        return default
    if not math.isfinite(v):
        return default
    return max(lo, min(hi, v))


class SimSerial:
    """A ``GloveSim`` on the real clock, shaped like the slice of
    ``serial.Serial`` that ``GloveReader`` touches: ``read``, ``write``,
    ``close`` and ``dtr``."""

    def __init__(self, sim: GloveSim | None = None, clock=time.monotonic,
                 timeout: float = 0.2):
        self._clock = clock
        self.sim = sim if sim is not None else GloveSim(now=clock())
        self.timeout = timeout
        self.dtr = True
        self._closed = False
        self._buf = b""

    def read(self, size: int = 1) -> bytes:
        if self._closed:
            return b""
        if not self._buf:
            now = self._clock()
            wait = self.sim.next_due() - now
            if wait > 0 and not self.sim.has_pending():
                time.sleep(min(wait, self.timeout))
                now = self._clock()
            lines = self.sim.lines_until(now)
            if lines:
                self._buf = ("\n".join(lines) + "\n").encode("ascii")
        out, self._buf = self._buf[:size], self._buf[size:]
        return out

    def write(self, data: bytes) -> int:
        if self._closed:
            raise OSError("simulated port is closed")
        for line in data.decode("ascii", "replace").splitlines():
            self.sim.command(line, self._clock())
        return len(data)

    def set_input(self, held, hard=False, tremor=None) -> None:
        self.sim.set_input(held, hard, tremor, self._clock())

    def close(self) -> None:
        self._closed = True
