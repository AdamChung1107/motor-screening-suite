"""Sensor-glove wire protocol — pure parsing, no I/O.

Implements the frame and banner format specified in
``docs/glove/GLOVE_FIRMWARE_PLAN.md`` §4 and emitted by ``firmware/glove/glove.ino``.

Everything here is deliberately hardware-free and total: no function raises on
malformed input, they return ``None`` instead. A glove on a USB cable produces
truncated lines whenever a read straddles a frame boundary, so "returns None"
is the normal path, not an error path.

Unit-tested in ``screening_tests/tests/test_glove.py``.
"""

from __future__ import annotations

from dataclasses import dataclass, field

# Wire-format version this parser understands. The firmware announces its own
# in the boot banner; a mismatch means the column layout may have changed and
# frames must not be trusted.
PROTO_SUPPORTED = 1

_UINT32 = 0xFFFFFFFF

# A sequence jump larger than this is read as a counter reset (the 'Z' command)
# or line corruption rather than that many genuinely dropped frames. At 100 Hz
# this is ~2.8 hours of continuous loss, which never happens in practice.
_MAX_SANE_GAP = 1_000_000


#: Sensor kinds the host knows how to interpret. ``fsr`` goes through the
#: published FSR402 force curve (:mod:`core.glove.force`); ``flex`` through the
#: calibrated bend estimate (:mod:`core.glove.flex`). Anything else is carried
#: through as raw counts and resistance only — better to show less than to
#: apply the wrong curve and print a confident, wrong number.
KIND_FSR = "fsr"
KIND_FLEX = "flex"
#: FlexiForce A401 palm pads (``h0..h2``, GRIP_TEST_PLAN.md §0.3). Never the
#: FSR402 curve: the A401 is linear in conductance and needs its own per-sensor
#: calibration, so until one exists it is shown as resistance and conductance.
#: Fw 0.11.1 wires h0 as a plain divider, so ``sensor_ohms()`` still applies.
KIND_FLEXIFORCE = "flexiforce"
#: Onboard IMU channels. Deliberately *not* divider sensors: they carry no
#: ``r_fixed``, and running them through :func:`sensor_ohms` would produce a
#: confident resistance for an acceleration. Values arrive as integer
#: milli-units (see :attr:`GloveBanner.imu_scale`).
KIND_ACCEL = "accel"
KIND_GYRO = "gyro"
KIND_UNKNOWN = "unknown"

#: Kinds the host knows are motion, not resistance.
IMU_KINDS = (KIND_ACCEL, KIND_GYRO)

#: Kinds a banner may declare. Anything else is carried through as unknown.
KNOWN_KINDS = (KIND_FSR, KIND_FLEX, KIND_FLEXIFORCE, KIND_ACCEL, KIND_GYRO)

#: IMU column names in frame order, matching the firmware's ``IMU_COLS``.
IMU_COLS = ("ax", "ay", "az", "gx", "gy", "gz")

#: Milli-units per physical unit when the banner omits ``imu_scale``.
IMU_SCALE_DEFAULT = 1000


def kind_from_name(name: str) -> str:
    """Guess a channel's sensor kind from its name.

    The fallback for firmware older than the banner's ``chan=`` field. The
    naming convention predates that field and is stable: ``f0..f4`` are flex,
    ``p0..p5`` are pressure (GLOVE_FIRMWARE_PLAN.md §4.1), ``h0..h2`` the palm
    A401s (GRIP_TEST_PLAN.md §5), and the six IMU
    columns are named exactly ``ax..gz``.

    The IMU names are matched in full, before the single-letter rule: ``f0`` is
    a flex strip but ``fx`` is nothing, and a prefix rule on ``g``/``a`` would
    start claiming kinds for column names that do not exist yet.
    """
    if not name:
        return KIND_UNKNOWN
    lowered = name.lower()
    if lowered in IMU_COLS:
        return KIND_ACCEL if lowered.startswith("a") else KIND_GYRO
    head = lowered[0]
    if head == "f":
        return KIND_FLEX
    if head == "p":
        return KIND_FSR
    if head == "h":
        return KIND_FLEXIFORCE
    return KIND_UNKNOWN


@dataclass(frozen=True)
class ChannelMeta:
    """What the host needs to interpret one channel's raw counts.

    ``r_fixed`` is per-channel because the FSR and the flex strip sit on
    different low-side resistors — a divider is most sensitive near the
    sensor's own resistance, and those two parts live in very different bands.
    Sharing one value would silently mis-scale one of them.
    """

    name: str
    kind: str = KIND_UNKNOWN
    r_fixed: int = 10000

    @property
    def is_imu(self) -> bool:
        """True for motion channels, where ``r_fixed`` is meaningless."""
        return self.kind in IMU_KINDS


@dataclass(frozen=True)
class GloveBanner:
    """Parsed ``#GLOVE ...`` boot banner.

    ``cols`` is the authoritative column layout — consumers should read channel
    names from here rather than hardcoding them, so adding sensors to the
    firmware's CHANNELS[] table needs no host-side change.

    ``chan`` carries the per-channel kind and resistor. It is an *additive*
    field: firmware 0.2.0 and earlier omit it, so :attr:`channel_meta` falls
    back to the global ``r_fixed`` plus :func:`kind_from_name`. That keeps old
    recordings and un-reflashed boards working, which is why ``proto`` did not
    need a bump when the field was added.
    """

    fw: str = ""
    proto: int = 0
    board: str = ""
    rate: int = 0
    adc_bits: int = 10
    adc_ref_mv: int = 3300
    vdiv_mv: int = 3300
    r_fixed: int = 10000
    imu: str = "none"
    imu_scale: int = IMU_SCALE_DEFAULT
    #: Why the board last booted (fw 0.10.3+): nRF52840 RESETREAS names joined
    #: with '+', e.g. "pin", "sreq", "lockup", or "por" for power-on/brown-out.
    #: Empty from older firmware and the simulator.
    rst: str = ""
    emg: int = 0
    cols: tuple[str, ...] = ()
    chan: tuple[ChannelMeta, ...] = ()

    @property
    def channels(self) -> tuple[str, ...]:
        """Sensor column names — everything after the seq/t_us housekeeping."""
        return self.cols[2:] if len(self.cols) > 2 else ()

    @property
    def channel_meta(self) -> tuple[ChannelMeta, ...]:
        """Per-channel kind and resistor, one entry per name in :attr:`channels`.

        Prefers the banner's ``chan=`` field, matched by name. Any channel it
        does not cover — older firmware, or a name mismatch — falls back to the
        global ``r_fixed`` and a kind guessed from the name, so this always
        returns exactly one entry per channel and callers never index off the
        end.
        """
        by_name = {c.name: c for c in self.chan}
        return tuple(
            by_name.get(name, ChannelMeta(name=name,
                                          kind=kind_from_name(name),
                                          r_fixed=self.r_fixed))
            for name in self.channels
        )

    def meta_for(self, index: int) -> ChannelMeta | None:
        """Channel details by column index, or None if out of range."""
        metas = self.channel_meta
        if 0 <= index < len(metas):
            return metas[index]
        return None

    @property
    def imu_present(self) -> bool:
        """Did the board's IMU actually initialise?

        The firmware writes ``imu=none`` when ``IMU.begin()`` fails *and* omits
        the six columns, so this and the column list can never disagree.
        """
        return bool(self.imu) and self.imu.lower() != "none"

    def imu_index(self) -> dict[str, int]:
        """Column index of each IMU channel, by name — ``{}`` when none.

        Looked up by name rather than assumed to be the last six columns: the
        analog table is expected to grow to eleven channels, and an offset
        guess would silently read a flex strip as an accelerometer.
        """
        names = self.channels
        found = {n: i for i, n in enumerate(names) if n.lower() in IMU_COLS}
        return found if len(found) == len(IMU_COLS) else {}

    @property
    def supported(self) -> bool:
        return self.proto == PROTO_SUPPORTED

    @property
    def adc_max(self) -> int:
        return (1 << self.adc_bits) - 1


@dataclass(frozen=True)
class GloveFrame:
    """One sampled timestep. ``values`` holds raw ADC counts, one per channel."""

    seq: int
    t_us: int
    values: tuple[int, ...]


def _to_int(text: str, default: int = 0) -> int:
    try:
        return int(text)
    except (TypeError, ValueError):
        return default


def _parse_chan(text: str, default_r: int) -> tuple[ChannelMeta, ...]:
    """Parse the banner's ``chan=name:kind:r_fixed,...`` field.

    Total, like everything else here: a malformed entry is skipped rather than
    raising, and a short entry keeps the defaults for the parts it omits. A
    channel that drops out this way still gets covered by
    :attr:`GloveBanner.channel_meta`'s fallback, so a garbled field degrades to
    the old naming-convention behaviour rather than losing the channel.
    """
    out: list[ChannelMeta] = []
    for entry in text.split(","):
        entry = entry.strip()
        if not entry:
            continue
        parts = entry.split(":")
        name = parts[0].strip()
        if not name:
            continue
        kind = parts[1].strip().lower() if len(parts) > 1 and parts[1].strip() else kind_from_name(name)
        if kind not in KNOWN_KINDS:
            kind = KIND_UNKNOWN
        r_fixed = _to_int(parts[2], default_r) if len(parts) > 2 else default_r
        # A non-positive resistor would divide by zero downstream and is never
        # a real wiring choice — treat it as "not stated".
        if r_fixed <= 0:
            r_fixed = default_r
        out.append(ChannelMeta(name=name, kind=kind, r_fixed=r_fixed))
    return tuple(out)


def parse_banner(line: str) -> GloveBanner | None:
    """Parse a ``#GLOVE k=v k=v ...`` banner. Returns None if it isn't one."""
    if not line:
        return None
    line = line.strip()
    if not line.startswith("#GLOVE"):
        return None

    kv: dict[str, str] = {}
    for token in line[len("#GLOVE"):].split():
        if "=" not in token:
            continue
        key, _, value = token.partition("=")
        kv[key] = value

    cols = tuple(c for c in kv.get("cols", "").split(",") if c)
    default_r = _to_int(kv.get("r_fixed", "10000"), 10000)
    return GloveBanner(
        fw=kv.get("fw", ""),
        proto=_to_int(kv.get("proto", "0")),
        board=kv.get("board", ""),
        rate=_to_int(kv.get("rate", "0")),
        adc_bits=_to_int(kv.get("adc_bits", "10"), 10) or 10,
        adc_ref_mv=_to_int(kv.get("adc_ref_mv", "3300"), 3300),
        vdiv_mv=_to_int(kv.get("vdiv_mv", "3300"), 3300),
        r_fixed=default_r,
        imu=kv.get("imu", "none"),
        imu_scale=_to_int(kv.get("imu_scale", ""), IMU_SCALE_DEFAULT) or IMU_SCALE_DEFAULT,
        rst=kv.get("rst", ""),
        emg=_to_int(kv.get("emg", "0")),
        cols=cols,
        chan=_parse_chan(kv.get("chan", ""), default_r),
    )


def parse_frame(line: str, n_values: int | None = None) -> GloveFrame | None:
    """Parse a ``G,seq,t_us,v0,...`` data frame.

    ``n_values`` is the expected channel count from the banner; a frame with a
    different count is rejected rather than silently mapped onto the wrong
    columns. Pass ``None`` to accept whatever arrives (used before the banner
    is known).
    """
    if not line:
        return None
    line = line.strip()
    if not line.startswith("G,"):
        return None

    parts = line.split(",")
    if len(parts) < 3:
        return None
    if n_values is not None and len(parts) != n_values + 3:
        return None

    try:
        seq = int(parts[1])
        t_us = int(parts[2])
        values = tuple(int(p) for p in parts[3:])
    except ValueError:
        return None

    # Channel values are deliberately NOT range-checked: ADC counts are
    # non-negative but IMU milli-units are signed, and a check here would have
    # to know the column layout. Only the housekeeping fields are validated.
    if seq < 0 or t_us < 0:
        return None
    return GloveFrame(seq=seq, t_us=t_us, values=values)


def seq_gap(prev: int, cur: int) -> int:
    """Frames lost between two sequence numbers, wrap-safe.

    The firmware's counter is a uint32 and is also reset to 0 by the 'Z'
    command, so an implausible jump is reported as 0 loss rather than billions.
    """
    delta = (cur - prev) & _UINT32
    if delta == 0 or delta > _MAX_SANE_GAP:
        return 0
    return delta - 1


def us_delta(prev: int, cur: int) -> int:
    """Microseconds between two device timestamps, wrap-safe (uint32, ~71 min)."""
    return (cur - prev) & _UINT32


def adc_to_mv(adc: int, ref_mv: int = 3300, bits: int = 10) -> int:
    """ADC counts → millivolts.

    Uses integer division to match the firmware's ``adcToMillivolts()`` exactly,
    so the page and the board's own ``#DIAG`` output never disagree.
    """
    full = (1 << bits) - 1
    if full <= 0:
        return 0
    return (adc * ref_mv) // full


def sensor_ohms(adc: int, ref_mv: int = 3300, vdiv_mv: int = 3300,
                r_fixed: int = 10000, bits: int = 10) -> int | None:
    """Divider resistance of the sensor leg, in ohms.

    ``R_sensor = R_fixed * (Vsupply - Vout) / Vout``. Returns ``None`` for an
    open sensor (0 mV), and 0 at or above the supply rail. Mirrors the
    firmware's ``sensorOhms()``.
    """
    mv = adc_to_mv(adc, ref_mv, bits)
    if mv <= 0:
        return None
    if mv >= vdiv_mv:
        return 0
    return (r_fixed * (vdiv_mv - mv)) // mv


@dataclass
class FrameAccumulator:
    """Feeds raw serial lines in, yields frames and stream health out.

    Stateful but pure — no I/O — so a recorded capture can be replayed through
    it in a unit test.
    """

    banner: GloveBanner | None = None
    total: int = 0
    dropped: int = 0
    _prev_seq: int | None = field(default=None, repr=False)
    _window: list[tuple[int, int]] = field(default_factory=list, repr=False)

    #: frames retained for the rolling rate estimate
    WINDOW = 200

    def feed(self, line: str) -> GloveFrame | None:
        """Consume one line. Returns a frame, or None for banners/noise."""
        banner = parse_banner(line)
        if banner is not None:
            self.banner = banner
            return None

        n = len(self.banner.channels) if self.banner else None
        frame = parse_frame(line, n)
        if frame is None:
            return None

        if self._prev_seq is not None:
            self.dropped += seq_gap(self._prev_seq, frame.seq)
        self._prev_seq = frame.seq
        self.total += 1

        self._window.append((frame.seq, frame.t_us))
        if len(self._window) > self.WINDOW:
            del self._window[0]
        return frame

    def reset_counters(self) -> None:
        """Clear stream stats — used after a 'Z' zero command."""
        self.total = 0
        self.dropped = 0
        self._prev_seq = None
        self._window.clear()

    @property
    def rate_hz(self) -> float:
        """Measured sample rate from device timestamps, 0.0 until enough data."""
        if len(self._window) < 2:
            return 0.0
        (first_seq, first_us), (last_seq, last_us) = self._window[0], self._window[-1]
        span_us = us_delta(first_us, last_us)
        span_seq = (last_seq - first_seq) & _UINT32
        if span_us <= 0 or span_seq <= 0 or span_seq > _MAX_SANE_GAP:
            return 0.0
        return span_seq / (span_us / 1_000_000.0)
