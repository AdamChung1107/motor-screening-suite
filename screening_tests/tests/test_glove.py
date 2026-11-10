"""
Unit tests for the glove wire protocol (GLOVE_FIRMWARE_PLAN.md §4 + gate 7):
pure parsing exercised against recorded and synthetic serial lines — no board,
no pyserial.

Run:  python -m pytest screening_tests/tests/test_glove.py
 or:  python screening_tests/tests/test_glove.py   (self-runs without pytest)
"""

from __future__ import annotations

import sys
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_REPO_ROOT))

from core.glove.force import (FSR402_CURVE, PART_TO_PART_PCT, RATED_MAX_N,
                              RATED_MIN_N, conductance_us, force_model,
                              force_newtons, force_range, grams_force)
from core.glove.flex import (MIN_SPAN_RATIO, NOMINAL_BENT_OHM,
                             NOMINAL_FLAT_OHM, FlexSpan, bend_fraction,
                             bend_percent, bend_range, default_span,
                             flex_model, is_calibrated, span_from_ohms)
from core.glove.imu import (MIN_WINDOW_S, TREMOR_BAND, band_power,
                            held_fraction, magnitude, rms, tilt, to_units)
from core.glove.protocol import (IMU_COLS, KIND_ACCEL, KIND_FLEX, KIND_FLEXIFORCE, KIND_FSR,
                                 KIND_GYRO, KIND_UNKNOWN, PROTO_SUPPORTED,
                                 ChannelMeta, FrameAccumulator, adc_to_mv,
                                 kind_from_name, parse_banner, parse_frame,
                                 sensor_ohms, seq_gap, us_delta)

# Captured verbatim from the Nano 33 BLE on COM10, 2026-07-26.
REAL_BANNER = ("#GLOVE fw=0.1.0 proto=1 board=nano33ble rate=100 adc_bits=10 "
               "adc_ref_mv=3300 vdiv_mv=3300 r_fixed=10000 imu=none emg=0 "
               "cols=seq,t_us,p0")

# Firmware 0.3.0: FSR on A0 + flex on A1, each with its own low-side resistor.
TWO_CHANNEL_BANNER = (
    "#GLOVE fw=0.3.0 proto=1 board=nano33ble rate=100 adc_bits=12 "
    "adc_ref_mv=3300 vdiv_mv=3300 r_fixed=10000 imu=none emg=0 "
    "cols=seq,t_us,p0,f0 chan=p0:fsr:10000,f0:flex:47000")


# Firmware 0.5.0: two FSRs plus the onboard IMU's six motion columns (gate 5).
IMU_BANNER = (
    "#GLOVE fw=0.5.0 proto=1 board=nano33ble rate=100 adc_bits=12 "
    "adc_ref_mv=3300 vdiv_mv=3300 r_fixed=10000 imu=BMI270_BMM150 "
    "imu_scale=1000 emg=0 cols=seq,t_us,p0,p1,ax,ay,az,gx,gy,gz "
    "chan=p0:fsr:10000,p1:fsr:10000,ax:accel,ay:accel,az:accel,"
    "gx:gyro,gy:gyro,gz:gyro")


# Firmware 0.6.0, captured verbatim from COM10 on 2026-09-20: three FSRs, a
# flex strip on its own 47k leg, and the IMU. This is the first layout that
# mixes both analog kinds AHEAD of the motion columns, which is where an
# off-by-one in the chan= parser would show up as a force curve applied to a
# bending finger.
MIXED_BANNER = (
    "#GLOVE fw=0.6.0 proto=1 board=nano33ble rate=100 adc_bits=12 "
    "adc_ref_mv=3300 vdiv_mv=3300 r_fixed=10000 imu=BMI270_BMM150 "
    "imu_scale=1000 emg=0 cols=seq,t_us,p0,p1,p2,f0,ax,ay,az,gx,gy,gz "
    "chan=p0:fsr:10000,p1:fsr:10000,p2:fsr:10000,f0:flex:47000,"
    "ax:accel,ay:accel,az:accel,gx:gyro,gy:gyro,gz:gyro")


def test_mixed_banner_keeps_kinds_and_resistors_in_column_order():
    b = parse_banner(MIXED_BANNER)
    assert b is not None and b.supported
    assert b.channels == ("p0", "p1", "p2", "f0", "ax", "ay", "az",
                          "gx", "gy", "gz")
    meta = {m.name: m for m in b.channel_meta}
    assert [m.kind for m in b.channel_meta] == [
        KIND_FSR, KIND_FSR, KIND_FSR, KIND_FLEX,
        KIND_ACCEL, KIND_ACCEL, KIND_ACCEL, KIND_GYRO, KIND_GYRO, KIND_GYRO]
    # The flex strip's own leg, not the banner's legacy global r_fixed.
    assert meta["f0"].r_fixed == 47000
    assert meta["p2"].r_fixed == 10000
    assert b.r_fixed == 10000


# fw 0.10.0 as flashed 2026-11-08: four FSRs (A1, A2, A3, A6), five flex strips
# on the mux and an external MPU6050 on A4/A5. The frame is a real one from it.
MPU_BANNER = (
    "#GLOVE fw=0.10.0 proto=1 board=nano33ble rate=100 adc_bits=12 "
    "adc_ref_mv=3300 vdiv_mv=3300 r_fixed=10000 imu=MPU6050 imu_scale=1000 "
    "emg=0 cols=seq,t_us,p0,p1,p2,p3,f0,f1,f2,f3,f4,ax,ay,az,gx,gy,gz "
    "chan=p0:fsr:10000,p1:fsr:10000,p2:fsr:10000,p3:fsr:10000,"
    "f0:flex:47000,f1:flex:47000,f2:flex:47000,f3:flex:47000,f4:flex:47000,"
    "ax:accel,ay:accel,az:accel,gx:gyro,gy:gyro,gz:gyro")


def test_mpu6050_banner_and_frame():
    b = parse_banner(MPU_BANNER)
    assert b is not None and b.supported
    assert b.imu == "MPU6050" and b.imu_present
    kinds = [m.kind for m in b.channel_meta]
    assert kinds[:4] == [KIND_FSR] * 4 and kinds[4:9] == [KIND_FLEX] * 5
    assert {m.name: m for m in b.channel_meta}["f4"].r_fixed == 47000
    line = "G,140,1894268,2,5,1,4,2005,2559,2707,2173,2327,487,-366,744,-1707,457,-854"
    f = parse_frame(line, len(b.channels))
    assert f is not None


def test_mixed_banner_frame_parses_at_full_width():
    b = parse_banner(MIXED_BANNER)
    line = "G,742,7425108,0,1,8,2396,15,-10,1011,183,-61,0"
    f = parse_frame(line, len(b.channels))
    assert f is not None
    assert f.values == (0, 1, 8, 2396, 15, -10, 1011, 183, -61, 0)
    # One column short must be refused, not silently shifted onto the IMU.
    assert parse_frame("G,742,7425108,0,1,8,2396,15,-10,1011,183,-61",
                       len(b.channels)) is None


def _sine(hz, amp, n, fs, offset=0.0):
    import math
    return [offset + amp * math.sin(2 * math.pi * hz * i / fs) for i in range(n)]


def test_banner_parses_all_fields():
    b = parse_banner(REAL_BANNER)
    assert b is not None
    assert b.fw == "0.1.0"
    assert b.proto == PROTO_SUPPORTED and b.supported
    assert b.board == "nano33ble"
    assert b.rate == 100
    assert b.adc_ref_mv == 3300 and b.vdiv_mv == 3300 and b.r_fixed == 10000
    assert b.cols == ("seq", "t_us", "p0")
    assert b.channels == ("p0",)
    assert b.adc_max == 1023


def test_banner_rejects_non_banner_lines():
    for line in ("", "G,1,1703,7", "#DIAG p0 adc=2", "#ZERO", "garbage"):
        assert parse_banner(line) is None


def test_banner_proto_mismatch_is_unsupported():
    b = parse_banner(REAL_BANNER.replace("proto=1", "proto=99"))
    assert b is not None and not b.supported


def test_frame_parses_real_line():
    f = parse_frame("G,1,1703,7", 1)
    assert f is not None
    assert (f.seq, f.t_us, f.values) == (1, 1703, (7,))


def test_frame_rejects_wrong_channel_count():
    # Guarding this stops values being silently mapped onto the wrong columns.
    assert parse_frame("G,1,1703,7,9", 1) is None
    assert parse_frame("G,1,1703", 1) is None
    assert parse_frame("G,1,1703,7,9", 2) is not None


def test_frame_accepts_any_count_before_banner_known():
    f = parse_frame("G,5,100,1,2,3", None)
    assert f is not None and f.values == (1, 2, 3)


def test_frame_never_raises_on_junk():
    junk = ["", "   ", "G,", "G,a,b,c", "G,1,1703,xx", "#GLOVE fw=1",
            "G,1,-5,7", "\x00\xff garbage", "G,1"]
    for line in junk:
        assert parse_frame(line, 1) is None


def test_frame_tolerates_truncation_mid_line():
    # A read straddling a frame boundary is the normal case, not an error.
    assert parse_frame("G,12,3456", 1) is None
    assert parse_frame("G,12,3456,88", 1) is not None


def test_seq_gap_counts_losses():
    assert seq_gap(10, 11) == 0        # consecutive
    assert seq_gap(10, 14) == 3        # three lost
    assert seq_gap(10, 10) == 0        # duplicate


def test_seq_gap_survives_uint32_wrap():
    assert seq_gap(0xFFFFFFFF, 0) == 0
    assert seq_gap(0xFFFFFFFE, 1) == 2


def test_seq_gap_treats_reset_as_no_loss():
    # The 'Z' command zeroes the counter; that is not 4 billion dropped frames.
    assert seq_gap(5000, 0) == 0


def test_us_delta_survives_wrap():
    assert us_delta(100, 400) == 300
    assert us_delta(0xFFFFFF00, 0x00000100) == 512


def test_adc_to_mv_matches_firmware_integer_math():
    # Values printed by the board's own #DIAG output.
    assert adc_to_mv(2, 3300, 10) == 6
    assert adc_to_mv(13, 3300, 10) == 41
    assert adc_to_mv(0, 3300, 10) == 0
    assert adc_to_mv(1023, 3300, 10) == 3300


def test_sensor_ohms_matches_firmware():
    assert sensor_ohms(2, 3300, 3300, 10000, 10) == 5490000
    assert sensor_ohms(13, 3300, 3300, 10000, 10) == 794878


def test_sensor_ohms_edges():
    assert sensor_ohms(0, 3300, 3300, 10000, 10) is None     # open sensor
    assert sensor_ohms(1023, 3300, 3300, 10000, 10) == 0     # at the rail


def test_sensor_ohms_falls_as_force_rises():
    # Physical sanity: harder press -> higher ADC -> lower resistance.
    readings = [sensor_ohms(a) for a in (50, 200, 512, 900)]
    assert all(r is not None for r in readings)
    assert readings == sorted(readings, reverse=True)


def test_accumulator_reads_banner_then_frames():
    acc = FrameAccumulator()
    assert acc.feed(REAL_BANNER) is None
    assert acc.banner is not None and acc.banner.channels == ("p0",)
    f = acc.feed("G,1,1703,7")
    assert f is not None and f.values == (7,)
    assert acc.total == 1 and acc.dropped == 0


def test_accumulator_counts_dropped_frames():
    acc = FrameAccumulator()
    acc.feed(REAL_BANNER)
    for seq in (1, 2, 5, 6):          # 3 and 4 lost
        acc.feed(f"G,{seq},{seq * 10000},{seq}")
    assert acc.total == 4
    assert acc.dropped == 2


def test_accumulator_ignores_noise_lines():
    acc = FrameAccumulator()
    acc.feed(REAL_BANNER)
    for line in ("#DIAG p0 adc=2 mv=6", "#ZERO", "", "junk"):
        assert acc.feed(line) is None
    assert acc.total == 0 and acc.dropped == 0


def test_accumulator_measures_rate():
    acc = FrameAccumulator()
    acc.feed(REAL_BANNER)
    for i in range(1, 201):           # exactly 100 Hz -> 10000 us apart
        acc.feed(f"G,{i},{i * 10000},{i % 1024}")
    assert abs(acc.rate_hz - 100.0) < 0.01


def test_accumulator_rate_matches_measured_hardware():
    # The real capture: seq 1..295 spanning 2931819 -> 2941910 us per frame.
    acc = FrameAccumulator()
    acc.feed(REAL_BANNER)
    for i in range(1, 101):
        acc.feed(f"G,{i},{1703 + (i - 1) * 10009},5")
    assert 99.0 < acc.rate_hz < 101.0


def test_accumulator_reset_clears_counters():
    acc = FrameAccumulator()
    acc.feed(REAL_BANNER)
    acc.feed("G,1,1000,5")
    acc.feed("G,9,2000,5")
    assert acc.dropped > 0
    acc.reset_counters()
    assert acc.total == 0 and acc.dropped == 0 and acc.rate_hz == 0.0
    # Banner survives a counter reset — the board did not reboot.
    assert acc.banner is not None


def test_accumulator_rate_is_zero_before_data():
    assert FrameAccumulator().rate_hz == 0.0


# ── force estimation (Interlink FSR402 published curve) ──────────────────

def test_force_is_exact_at_every_published_anchor():
    # The whole point of interpolating in log-log space rather than fitting one
    # global power law: the datasheet's own points come back unchanged.
    for newtons, ohms in FSR402_CURVE:
        got = force_newtons(ohms)
        assert abs(got - newtons) < 1e-9, f"{ohms} ohm -> {got}, want {newtons}"


def test_force_beats_a_single_power_law_fit():
    # A global least-squares fit R = 7138 * F**-0.7654 misses the published
    # anchors by up to ~20%; this is the regression guard for that choice.
    import math
    worst_fit = 0.0
    worst_ours = 0.0
    for newtons, ohms in FSR402_CURVE:
        fit_r = 7138.0 * newtons ** -0.7654
        worst_fit = max(worst_fit, abs(fit_r - ohms) / ohms)
        worst_ours = max(worst_ours, abs(force_newtons(ohms) - newtons) / newtons)
    assert worst_fit > 0.15, "the power-law fit should be visibly bad"
    assert worst_ours < 1e-9, "piecewise interpolation must be exact"


def test_force_rises_monotonically_as_resistance_falls():
    forces = [force_newtons(r) for r in (30000, 10000, 6000, 3000, 1000, 500, 250)]
    assert all(a < b for a, b in zip(forces, forces[1:])), forces


def test_force_interpolates_between_anchors():
    # 2 kOhm sits between the 1 N and 10 N anchors, so must land between them.
    f = force_newtons(2000)
    assert 1.0 < f < 10.0


def test_force_extrapolates_past_the_ends():
    assert force_newtons(1_000_000) < RATED_MIN_N   # barely touched
    assert force_newtons(150) > 100.0               # crushed


def test_force_open_and_invalid_inputs():
    assert force_newtons(None) is None
    assert force_newtons(-5) is None
    # 0 ohm means at/past the rail (protocol.sensor_ohms), not a crash.
    assert force_newtons(0) == FSR402_CURVE[-1][0]


def test_force_range_classifies_against_the_datasheet_band():
    assert force_range(None) == "open"
    assert force_range(0.05) == "below"            # under 0.2 N actuation
    assert force_range(RATED_MIN_N) == "rated"
    assert force_range(5.0) == "rated"
    assert force_range(RATED_MAX_N) == "rated"
    assert force_range(RATED_MAX_N + 0.1) == "above"


def test_hard_press_is_flagged_not_silently_reported():
    # 250 ohm reads 100 N off the curve, but the part is only rated to 20 N.
    # The UI must be able to badge that rather than print a confident number.
    assert force_range(force_newtons(250)) == "above"


def test_grams_force_conversion():
    assert grams_force(None) is None
    assert abs(grams_force(9.80665) - 1000.0) < 1e-6   # 1 kgf
    assert abs(grams_force(1.0) - 101.97) < 0.01


def test_conductance_is_reciprocal_resistance():
    assert conductance_us(1_000_000) == 1.0
    assert conductance_us(1000) == 1000.0
    assert conductance_us(None) is None
    assert conductance_us(0) is None


def test_force_model_payload_is_transportable():
    m = force_model()
    assert m["points"] == [[f, r] for f, r in FSR402_CURVE]
    assert m["rated_min_n"] == RATED_MIN_N and m["rated_max_n"] == RATED_MAX_N
    assert m["tolerance_pct"] == PART_TO_PART_PCT
    assert "FSR402" in m["source"]


def test_full_chain_adc_to_force_at_12_bit():
    # 12-bit ADC, 10k pulldown, 3.3 V: an ADC count all the way through to a
    # force, the way the dev page does it.
    r = sensor_ohms(3723, 3300, 3300, 10000, 12)
    assert r is not None and 900 < r < 1100        # ~1 kOhm
    f = force_newtons(r)
    assert 8.0 < f < 12.0                          # ~10 N per the curve
    assert force_range(f) == "rated"


# ── per-channel banner metadata (firmware 0.3.0) ────────────────────────────


def test_banner_parses_per_channel_kind_and_resistor():
    b = parse_banner(TWO_CHANNEL_BANNER)
    assert b is not None
    assert b.channels == ("p0", "f0")
    metas = b.channel_meta
    assert [m.name for m in metas] == ["p0", "f0"]
    assert metas[0].kind == KIND_FSR and metas[0].r_fixed == 10000
    assert metas[1].kind == KIND_FLEX and metas[1].r_fixed == 47000
    # The added field must not disturb the layout contract.
    assert b.proto == PROTO_SUPPORTED and b.supported
    assert b.adc_max == 4095


def test_banner_parses_two_force_channels():
    # fw 0.4.0 bench layout: force sensors on the EVEN analog pins, p<n> on
    # A(2n). The host must carry both channels with the right kind and
    # resistor, since the whole point of the layout is that adding a sensor is
    # a firmware table edit with no host change.
    b = parse_banner(
        "#GLOVE fw=0.4.0 proto=1 board=nano33ble rate=100 adc_bits=12 "
        "adc_ref_mv=3300 vdiv_mv=3300 r_fixed=10000 imu=none emg=0 "
        "cols=seq,t_us,p0,p1 chan=p0:fsr:10000,p1:fsr:10000")
    assert b is not None and b.supported
    assert b.channels == ("p0", "p1")
    metas = b.channel_meta
    assert len(metas) == 2
    assert all(m.kind == KIND_FSR and m.r_fixed == 10000 for m in metas)
    # A frame must carry exactly one value per declared channel, or the host
    # would map readings onto the wrong sensor.
    assert parse_frame("G,7,1703,120,2048", n_values=len(b.channels)) is not None
    assert parse_frame("G,7,1703,120", n_values=len(b.channels)) is None


def test_banner_without_chan_field_falls_back_to_naming_convention():
    # Firmware 0.2.0 and earlier emit no chan= at all. Every channel must still
    # come back with a kind and a resistor, or the dev page shifts its readouts.
    b = parse_banner(REAL_BANNER)
    metas = b.channel_meta
    assert len(metas) == len(b.channels)
    assert metas[0].kind == KIND_FSR          # "p0" -> pressure
    assert metas[0].r_fixed == b.r_fixed      # global fallback


def test_channel_meta_covers_channels_the_chan_field_missed():
    # A chan= naming only some channels must not drop the rest - one entry per
    # column, always, in column order.
    b = parse_banner(TWO_CHANNEL_BANNER.replace(
        "chan=p0:fsr:10000,f0:flex:47000", "chan=p0:fsr:10000"))
    metas = b.channel_meta
    assert [m.name for m in metas] == ["p0", "f0"]
    assert metas[1].kind == KIND_FLEX         # guessed from the name
    assert metas[1].r_fixed == 10000          # global fallback


def test_banner_chan_field_never_raises_on_junk():
    junk = ("chan=", "chan=,,,", "chan=:::", "chan=p0", "chan=p0:",
            "chan=p0:fsr", "chan=p0:fsr:", "chan=p0:fsr:abc",
            "chan=p0:fsr:0", "chan=p0:fsr:-5", "chan=p0:bogus:10000",
            "chan=p0:fsr:10000,,f0:flex:47000")
    for bad in junk:
        b = parse_banner(TWO_CHANNEL_BANNER.replace(
            "chan=p0:fsr:10000,f0:flex:47000", bad))
        assert b is not None, bad
        metas = b.channel_meta
        assert len(metas) == len(b.channels), bad
        for m in metas:
            # A bad resistor must never reach the divider maths as <= 0.
            assert m.r_fixed > 0, bad
            assert m.kind in (KIND_FSR, KIND_FLEX, KIND_UNKNOWN), bad


def test_banner_chan_rejects_an_unknown_kind():
    b = parse_banner(TWO_CHANNEL_BANNER.replace("f0:flex:47000",
                                                "f0:magnetic:47000"))
    meta = b.meta_for(1)
    # Unknown kinds stop at resistance rather than being guessed into a curve.
    assert meta.kind == KIND_UNKNOWN and meta.r_fixed == 47000


def test_meta_for_out_of_range_is_none():
    b = parse_banner(TWO_CHANNEL_BANNER)
    assert b.meta_for(0) is not None and b.meta_for(1) is not None
    assert b.meta_for(2) is None and b.meta_for(-1) is None


def test_kind_from_name_follows_the_plan_convention():
    assert kind_from_name("f0") == KIND_FLEX
    assert kind_from_name("f4") == KIND_FLEX
    assert kind_from_name("p0") == KIND_FSR
    assert kind_from_name("p5") == KIND_FSR
    # Palm A401s must never fall back to the FSR402 curve (GRIP_TEST_PLAN §5).
    assert kind_from_name("h0") == KIND_FLEXIFORCE
    assert kind_from_name("h2") == KIND_FLEXIFORCE
    # ax/gz became IMU columns in fw 0.5.0 and are covered by
    # test_kind_from_name_separates_imu_columns_from_sensors; everything else
    # with no declared kind must still fall through to unknown.
    for name in ("", "emg", "x1", "a", "g"):
        assert kind_from_name(name) == KIND_UNKNOWN, name


def test_per_channel_resistor_changes_the_resistance():
    # The whole point of the per-channel field: the same counts on different
    # resistors are different resistances. Sharing one value silently
    # mis-scales whichever sensor did not own it.
    b = parse_banner(TWO_CHANNEL_BANNER)
    fsr, flex = b.meta_for(0), b.meta_for(1)
    counts = 2048
    r_fsr = sensor_ohms(counts, 3300, 3300, fsr.r_fixed, 12)
    r_flex = sensor_ohms(counts, 3300, 3300, flex.r_fixed, 12)
    assert r_fsr is not None and r_flex is not None
    assert r_flex > r_fsr * 4          # 47k vs 10k


# ── flex / bend estimation ──────────────────────────────────────────────────


def test_default_flex_span_is_flagged_uncalibrated():
    # The nominal span exists so the UI has something to draw, and must never
    # pass itself off as measured.
    span = default_span()
    assert span.flat_ohm == NOMINAL_FLAT_OHM
    assert span.bent_ohm == NOMINAL_BENT_OHM
    assert span.usable
    assert not is_calibrated(span)


def test_bend_fraction_runs_flat_to_bent():
    span = FlexSpan(flat_ohm=10_000, bent_ohm=110_000, calibrated=True)
    assert bend_fraction(10_000, span) == 0.0
    assert bend_fraction(110_000, span) == 1.0
    mid = bend_fraction(60_000, span)
    assert 0.49 < mid < 0.51
    assert bend_percent(60_000, span) == mid * 100.0


def test_bend_fraction_clamps_outside_the_recorded_span():
    # Past either end the sensor has left the range it was calibrated over.
    # Extrapolating would invent travel that was never measured.
    span = FlexSpan(flat_ohm=10_000, bent_ohm=110_000, calibrated=True)
    assert bend_fraction(500, span) == 0.0
    assert bend_fraction(10_000_000, span) == 1.0


def test_bend_range_flags_a_clamped_reading():
    span = FlexSpan(flat_ohm=10_000, bent_ohm=110_000, calibrated=True)
    assert bend_range(9_000, span) == "below"
    assert bend_range(50_000, span) == "in"
    assert bend_range(200_000, span) == "above"
    assert bend_range(None, span) == "open"
    assert bend_range(0, span) == "open"


def test_bend_handles_a_reversed_span():
    # A sensor can be mounted or wired so that bending lowers resistance.
    # "below" must keep meaning the flat end either way.
    span = FlexSpan(flat_ohm=110_000, bent_ohm=10_000, calibrated=True)
    assert bend_fraction(110_000, span) == 0.0
    assert bend_fraction(10_000, span) == 1.0
    assert bend_range(200_000, span) == "below"
    assert bend_range(5_000, span) == "above"


def test_bend_rejects_a_span_too_narrow_to_be_travel():
    narrow = FlexSpan(flat_ohm=10_000, bent_ohm=10_100, calibrated=True)
    assert not narrow.usable
    assert bend_fraction(10_050, narrow) is None
    assert bend_range(10_050, narrow) == "open"
    assert not is_calibrated(narrow)
    # span_from_ohms refuses to build one, handing back the default instead.
    assert span_from_ohms(10_000, 10_100) == default_span()
    assert span_from_ohms(10_000, 10_000 * MIN_SPAN_RATIO * 2).calibrated


def test_bend_open_and_invalid_inputs():
    span = FlexSpan(flat_ohm=10_000, bent_ohm=110_000, calibrated=True)
    for bad in (None, 0, -1):
        assert bend_fraction(bad, span) is None
        assert bend_percent(bad, span) is None
    assert span_from_ohms(None, 110_000) == default_span()
    assert span_from_ohms(10_000, None) == default_span()
    for bad_span in (FlexSpan(flat_ohm=0, bent_ohm=110_000),
                     FlexSpan(flat_ohm=10_000, bent_ohm=-5)):
        assert not bad_span.usable
        assert bend_fraction(50_000, bad_span) is None


def test_flex_model_payload_is_transportable():
    m = flex_model(FlexSpan(flat_ohm=12_000, bent_ohm=90_000, calibrated=True))
    assert m["flat_ohm"] == 12_000 and m["bent_ohm"] == 90_000
    assert m["calibrated"] is True and m["usable"] is True
    assert "no published curve" in m["source"]
    # The dev page derives a span from live readings and needs the same
    # "travel or noise?" threshold, so it must travel with the payload.
    assert m["min_span_ratio"] == MIN_SPAN_RATIO
    # The default span ships as explicitly uncalibrated.
    assert flex_model(default_span())["calibrated"] is False


def test_flex_channel_carries_the_signal_that_stops_the_force_curve():
    # Guards the exact bug this change exists to prevent: the FSR402 curve
    # applied to a bending finger. force_newtons() will happily return a
    # number for any resistance - the channel's kind is what stops the caller
    # from asking, so assert that signal is present and correct.
    b = parse_banner(TWO_CHANNEL_BANNER)
    flex = b.meta_for(1)
    assert flex.kind == KIND_FLEX and flex.kind != KIND_FSR
    ohm = sensor_ohms(2048, 3300, 3300, flex.r_fixed, 12)
    assert force_newtons(ohm) is not None
    assert isinstance(flex, ChannelMeta)


# -- onboard IMU (gate 5) ---------------------------------------------------

def test_imu_banner_declares_columns_scale_and_kinds():
    b = parse_banner(IMU_BANNER)
    assert b is not None and b.supported
    assert b.imu == "BMI270_BMM150" and b.imu_present
    assert b.imu_scale == 1000
    assert b.channels == ("p0", "p1") + IMU_COLS
    metas = {m.name: m for m in b.channel_meta}
    assert metas["ax"].kind == KIND_ACCEL and metas["gz"].kind == KIND_GYRO
    assert metas["p0"].kind == KIND_FSR
    # One entry per column, in order, or the page indexes off the end.
    assert len(b.channel_meta) == len(b.channels)


def test_imu_channels_are_never_divider_sensors():
    # The guard this branch exists for, the motion counterpart of the
    # flex/force split: an accelerometer has no low-side resistor, and any
    # resistance computed for one is a number with no meaning.
    b = parse_banner(IMU_BANNER)
    for name in IMU_COLS:
        meta = next(m for m in b.channel_meta if m.name == name)
        assert meta.is_imu
    assert not next(m for m in b.channel_meta if m.name == "p0").is_imu


def test_imu_absent_is_reported_as_absent():
    # Firmware whose IMU.begin() failed writes imu=none AND omits the columns,
    # so six flat zeroes can never masquerade as a still hand.
    b = parse_banner(TWO_CHANNEL_BANNER)
    assert not b.imu_present
    assert b.imu_index() == {}


def test_imu_index_refuses_a_partial_column_set():
    partial = IMU_BANNER.replace(",gy,gz", "")
    b = parse_banner(partial)
    # Better to report nothing than to guess an offset and read a flex strip
    # as an accelerometer.
    assert b.imu_index() == {}


def test_imu_index_is_by_name_not_by_position():
    b = parse_banner(IMU_BANNER)
    idx = b.imu_index()
    assert idx["ax"] == 2 and idx["gz"] == 7


def test_kind_from_name_separates_imu_columns_from_sensors():
    assert kind_from_name("ax") == KIND_ACCEL
    assert kind_from_name("gy") == KIND_GYRO
    # The single-letter fallback must not start claiming kinds for names the
    # firmware never emits.
    assert kind_from_name("f0") == KIND_FLEX
    assert kind_from_name("p3") == KIND_FSR
    assert kind_from_name("a") == KIND_UNKNOWN
    assert kind_from_name("gyro") == KIND_UNKNOWN


def test_frame_accepts_signed_imu_values():
    b = parse_banner(IMU_BANNER)
    line = "G,42,1000000,2048,900,-16,-30,1012,-1500,20,-7"
    f = parse_frame(line, len(b.channels))
    assert f is not None
    assert f.values[2] == -16 and f.values[5] == -1500
    assert to_units(f.values[4], b.imu_scale) == 1.012


def test_to_units_uses_the_banner_scale():
    assert to_units(1000, 1000) == 1.0
    assert to_units(-2500, 1000) == -2.5
    assert to_units(1000, 0) is None


def test_tilt_reads_gravity_and_flips_sign():
    # Gate 5 in one assertion: flat on a desk reads about 1 g on one axis, and
    # flipping the board flips it.
    flat = tilt(0.0, 0.0, 1.0)
    assert flat["static"] and abs(flat["magnitude_g"] - 1.0) < 1e-9
    assert abs(flat["pitch_deg"]) < 1e-6 and abs(flat["roll_deg"]) < 1e-6
    flipped = tilt(0.0, 0.0, -1.0)
    assert abs(abs(flipped["roll_deg"]) - 180.0) < 1e-6
    on_edge = tilt(1.0, 0.0, 0.0)
    assert abs(on_edge["pitch_deg"] + 90.0) < 1e-6


def test_tilt_refuses_to_claim_an_angle_while_moving():
    # 2 g means the hand is accelerating, so the vector is not gravity alone
    # and an angle read off it would be a guess.
    assert tilt(0.0, 0.0, 2.0)["static"] is False
    assert tilt(0.0, 0.0, 1.0)["static"] is True


def test_magnitude_and_rms():
    assert magnitude(3.0, 4.0, 0.0) == 5.0
    assert magnitude(1.0, None, 0.0) is None
    assert rms([1.0, 1.0, 1.0]) == 0.0     # gravity alone is not movement
    assert rms([1.0]) is None


def test_band_power_finds_a_planted_tremor():
    fs, n = 100.0, 300
    sig = _sine(6.0, 0.05, n, fs, offset=1.0)   # 6 Hz wobble riding on gravity
    out = band_power(sig, fs)
    assert out is not None
    assert abs(out["peak_hz"] - 6.0) < 0.5
    assert out["band_frac"] > 0.9
    assert out["band"] == list(TREMOR_BAND)


def test_band_power_ignores_slow_voluntary_motion():
    # A 1 Hz sweep is someone moving their hand, not tremor. Four times the
    # amplitude of the test above, and it must still not land in the band.
    out = band_power(_sine(1.0, 0.2, 300, 100.0, offset=1.0), 100.0)
    assert out is not None and out["band_frac"] < 0.05


def test_band_power_refuses_windows_that_cannot_support_a_claim():
    fs = 100.0
    short = _sine(6.0, 0.05, int(MIN_WINDOW_S * fs) - 10, fs)
    assert band_power(short, fs) is None
    # A rate that cannot resolve the band must return None, never a number:
    # the camera path makes the same refusal in core/spiral/metrics.py.
    assert band_power(_sine(2.0, 0.05, 300, 6.0), 6.0) is None
    assert band_power([1.0] * 300, 100.0) is None    # perfectly flat


def test_band_power_clamps_the_upper_edge_to_nyquist():
    # 20 Hz sampling can only resolve to 10 Hz, below the band's 12 Hz top.
    out = band_power(_sine(5.0, 0.05, 200, 20.0), 20.0)
    assert out is not None and out["band"][1] <= 10.0


def test_held_fraction_counts_repeated_imu_samples():
    fresh = [(1, 2, 3), (1, 2, 4), (1, 2, 5), (1, 2, 6)]
    assert held_fraction(fresh) == 0.0
    held = [(1, 2, 3), (1, 2, 3), (1, 2, 4), (1, 2, 4)]
    assert abs(held_fraction(held) - 2 / 3) < 1e-9
    assert held_fraction([(1, 2, 3)]) is None


def test_derived_routes_motion_away_from_the_divider_maths():
    # End to end through the reader: an accelerometer column must come back as
    # g, with no resistance, no force and no bend anywhere in the payload.
    import tempfile
    from core.glove.serial_io import GloveReader
    reader = GloveReader(tempfile.gettempdir())
    reader._acc.feed(IMU_BANNER)
    out = reader.derived(-2000, "ax")
    assert out["kind"] == KIND_ACCEL
    assert out["value"] == -2.0 and out["unit"] == "g"
    assert out["ohm"] is None and out["newtons"] is None and out["bend_pct"] is None
    # And a force channel on the same board still gets its curve.
    fsr = reader.derived(2048, "p0")
    assert fsr["kind"] == KIND_FSR and fsr["ohm"] is not None


# ── simulated glove (core/glove/sim.py) ─────────────────────────────────────

def _sim_run(sim, t1, step=0.1):
    """Every line the simulator emits up to t1, pulled the way the port is."""
    out = []
    t = sim.next_due()
    while t < t1 - 1e-9:
        t = min(t1, t + step)
        out.extend(sim.lines_until(t))
    return out


def _sim_frames(lines, acc):
    return [f for f in (acc.feed(line) for line in lines) if f is not None]


def _sim_fresh(seed=7):
    from core.glove.sim import GloveSim, banner
    sim = GloveSim(now=0.0, seed=seed)
    acc = FrameAccumulator()
    acc.feed(banner())
    return sim, acc


def test_sim_channel_table_matches_the_firmware():
    # The simulator is only useful while it looks like the board on the bench.
    import re
    from core.glove.sim import CHANNELS
    src = (_REPO_ROOT / "firmware" / "glove" / "glove.ino").read_text(encoding="utf-8")
    block = src[src.index("AnalogChannel CHANNELS[] = {"):]
    block = block[:block.index("};")]
    rows = re.findall(r'\{\s*"(\w+)",\s*"(\w+)",\s*\w+,\s*-?\d+,\s*(\d+)\s*\}', block)
    assert rows, "could not read CHANNELS[] from glove.ino"
    fw = tuple((n, k, int(r)) for n, k, r in rows)
    assert CHANNELS == fw, f"sim.CHANNELS {CHANNELS} != glove.ino {fw}"


def test_sim_banner_names_itself_and_parses():
    from core.glove.sim import CHANNELS, SIM_FW, SIM_IMU, banner
    b = parse_banner(banner())
    assert b is not None and b.supported
    assert b.fw == SIM_FW and b.board == "sim" and b.imu == SIM_IMU and b.imu_present
    assert b.adc_bits == 12 and b.imu_scale == 1000 and b.rate == 100
    metas = b.channel_meta
    assert [(m.name, m.kind, m.r_fixed) for m in metas[:len(CHANNELS)]] == list(CHANNELS)
    assert [m.kind for m in metas[len(CHANNELS):]] == [KIND_ACCEL] * 3 + [KIND_GYRO] * 3
    assert b.imu_index()


def test_sim_frames_parse_at_full_width_and_rate():
    sim, acc = _sim_fresh()
    lines = [ln for ln in _sim_run(sim, 2.0) if ln.startswith("G,")]
    frames = _sim_frames(lines, acc)
    assert len(frames) == len(lines) >= 199
    assert abs(acc.rate_hz - 100.0) < 0.5
    assert acc.dropped == 0


def test_sim_rest_pose_reads_like_the_board_at_rest():
    from core.glove.sim import ADC_BITS, CHANNELS, FLEX_FLAT_OHM, OPEN_COUNTS
    sim, acc = _sim_fresh()
    f = _sim_frames(_sim_run(sim, 1.0), acc)[-1]
    n = len(CHANNELS)
    ax, ay, az = (to_units(v, 1000) for v in f.values[n:n + 3])
    assert abs(ax) < 0.03 and abs(ay) < 0.03 and abs(az - 1.0) < 0.03   # palm down
    flex_i = 0
    for c, (_name, kind, r_fixed) in enumerate(CHANNELS):
        if kind in ("fsr", "flexiforce"):
            assert f.values[c] <= OPEN_COUNTS                            # no contact
        else:
            r = sensor_ohms(f.values[c], 3300, 3300, r_fixed, ADC_BITS)
            assert abs(r / FLEX_FLAT_OHM[flex_i] - 1) < 0.05
            flex_i += 1


def test_sim_force_curve_inverts_exactly():
    from core.glove.sim import ohms_for_force
    for n in (0.2, 0.5, 1.0, 3.3, 10.0, 20.0, 30.0, 100.0):
        assert abs(force_newtons(ohms_for_force(n)) - n) < 1e-6 * n


def test_sim_bend_and_press_reach_the_page_maths():
    from core.glove.sim import ADC_BITS, FLEX_FLAT_OHM, PRESS_N
    sim, acc = _sim_fresh()
    _sim_run(sim, 0.5)
    sim.set_input(["bend1", "press0"], now=0.5)
    f = _sim_frames(_sim_run(sim, 1.4), acc)[-1]
    p0 = force_newtons(sensor_ohms(f.values[0], 3300, 3300, 10000, ADC_BITS))
    assert abs(p0 - PRESS_N) / PRESS_N < 0.1 and force_range(p0) == "rated"
    assert f.values[1] <= 5                                   # p1 untouched
    f1 = sensor_ohms(f.values[5], 3300, 3300, 47000, ADC_BITS)
    f0 = sensor_ohms(f.values[4], 3300, 3300, 47000, ADC_BITS)
    # Past the page's 1.5x "observed span" bar, so a bend promotes the span.
    assert f1 / FLEX_FLAT_OHM[1] >= 1.5
    assert abs(f0 / FLEX_FLAT_OHM[0] - 1) < 0.05              # thumb stays flat
    sim.set_input(["press0"], hard=True, now=1.4)
    f = _sim_frames(_sim_run(sim, 1.6), acc)[-1]
    hard = force_newtons(sensor_ohms(f.values[0], 3300, 3300, 10000, ADC_BITS))
    assert force_range(hard) == "above"


def test_sim_fist_bends_every_finger_and_eases_back():
    from core.glove.sim import N_BEND
    sim, _acc = _sim_fresh()
    sim.set_input(["fist"], now=0.0)
    _sim_run(sim, 0.7)
    assert all(b == 1.0 for b in sim.bend[:N_BEND])
    sim.set_input([], now=0.7)
    _sim_run(sim, 1.2)
    assert all(b == 0.0 for b in sim.bend)


def test_sim_turn_is_consistent_between_gyro_and_gravity():
    import math
    from core.glove.sim import CHANNELS, TURN_DPS
    n = len(CHANNELS)
    sim, acc = _sim_fresh()
    _sim_run(sim, 0.5)
    sim.set_input(["pitch+"], now=0.5)
    frames = _sim_frames(_sim_run(sim, 1.0), acc)
    gx = [to_units(f.values[n + 3], 1000) for f in frames]
    assert abs(gx[-1] - TURN_DPS) < 3                         # eased up to the rate
    # Integrate the gyro (bias removed) and compare with the gravity angle.
    from core.glove.sim import GYRO_BIAS_DPS
    angle = sum(g - GYRO_BIAS_DPS[0] for g in gx) / 100.0
    ay, az = (to_units(v, 1000) for v in frames[-1].values[n + 1:n + 3])
    assert ay > 0                                             # fingers (+Y) now up
    assert abs(math.degrees(math.atan2(ay, az)) - angle) < 3


def test_sim_level_returns_to_palm_down():
    from core.glove.sim import CHANNELS
    n = len(CHANNELS)
    sim, acc = _sim_fresh()
    sim.set_input(["roll+", "pitch-"], now=0.0)
    _sim_run(sim, 0.6)
    sim.set_input(["level"], now=0.6)                         # a tap is enough
    sim.set_input([], now=0.65)
    f = _sim_frames(_sim_run(sim, 3.0), acc)[-1]
    ax, ay, az = (to_units(v, 1000) for v in f.values[n:n + 3])
    assert abs(az - 1.0) < 0.03 and abs(ax) < 0.03 and abs(ay) < 0.03


def test_sim_tremor_is_found_where_it_was_set():
    from core.glove.sim import CHANNELS
    n = len(CHANNELS)
    for hz, mg in ((5.0, 60.0), (8.5, 30.0)):
        sim, acc = _sim_fresh()
        sim.set_input([], tremor={"on": True, "hz": hz, "mg": mg}, now=0.0)
        frames = _sim_frames(_sim_run(sim, 4.0), acc)[-300:]
        mags = [magnitude(*(to_units(v, 1000) for v in f.values[n:n + 3])) for f in frames]
        bp = band_power(mags, 100.0)
        assert bp is not None and abs(bp["peak_hz"] - hz) <= 0.5, (hz, bp)
        assert bp["band_frac"] > 0.5


def test_sim_answers_the_firmware_commands():
    sim, _acc = _sim_fresh()
    _sim_run(sim, 0.3)
    sim.command("?", 0.3)
    assert _sim_run(sim, 0.31)[0].startswith("#GLOVE")
    sim.command("Z", 0.31)
    out = _sim_run(sim, 0.4)
    assert out[0] == "#ZERO"
    first = parse_frame(out[1])
    assert first.seq == 0 and first.t_us == 0
    sim.command("X", 0.4)
    assert not [ln for ln in _sim_run(sim, 0.8) if ln.startswith("G,")]
    sim.command("S", 0.8)
    sim.command("D", 0.8)
    out = _sim_run(sim, 1.0)
    assert [ln for ln in out if ln.startswith("G,")]
    assert any(ln.startswith("#DIAG p0 adc=") for ln in out)


def test_sim_dead_man_lets_go_of_a_lost_key():
    from core.glove.sim import DEADMAN_S
    sim, _acc = _sim_fresh()
    sim.set_input(["bend0"], now=0.0)            # and then the page goes quiet
    _sim_run(sim, DEADMAN_S - 0.1)
    assert sim.state()["held"] == ["bend0"] and sim.bend[0] == 1.0
    _sim_run(sim, DEADMAN_S + 0.6)
    assert sim.state()["held"] == [] and sim.bend[0] == 0.0


def test_sim_drops_unknown_controls_and_clamps_tremor():
    from core.glove.sim import TREMOR_HZ_RANGE, TREMOR_MG_RANGE
    sim, _acc = _sim_fresh()
    sim.set_input(["bogus", "bend0", 3], tremor={"on": 1, "hz": 99, "mg": -5}, now=0.0)
    st = sim.state()
    assert st["held"] == ["bend0"]
    assert st["tremor"]["on"] is True
    assert st["tremor"]["hz"] == TREMOR_HZ_RANGE[1] and st["tremor"]["mg"] == TREMOR_MG_RANGE[0]
    sim.set_input([], tremor={"hz": "nan", "mg": None}, now=0.1)
    assert sim.state()["tremor"]["hz"] == TREMOR_HZ_RANGE[1]   # unchanged, not NaN


def test_sim_stall_is_counted_as_dropped_frames():
    sim, acc = _sim_fresh()
    _sim_frames(_sim_run(sim, 0.5), acc)
    _sim_frames(sim.lines_until(4.0), acc)       # a 3.5 s gap in one pull
    assert acc.dropped > 200


def test_sim_runs_through_the_reader_without_pyserial():
    import os
    import tempfile
    import time
    from core.glove import serial_io
    real = serial_io.has_pyserial
    serial_io.has_pyserial = lambda: False       # the simulator must not need it
    try:
        with tempfile.TemporaryDirectory() as tmp:
            reader = serial_io.GloveReader(tmp)
            ok, msg = reader.connect("SIM")
            assert ok, msg
            assert reader.is_simulated()
            ok, msg = reader.sim_input({"held": ["press1"], "tremor": {"on": True}})
            assert ok, msg
            ok, msg = reader.start_recording()
            assert ok and "glove_sim_" in msg, msg
            time.sleep(0.5)
            snap = reader.snapshot()
            assert len(snap["frames"]) >= 20 and snap["connected"]
            st = reader.stats()
            assert st["simulated"] and st["port"] == "SIM"
            assert st["banner"]["fw"] == "sim-1" and st["banner"]["imu"] == "sim"
            assert st["sim"]["held"] == ["press1"] and st["sim"]["tremor"]["on"]
            assert reader.imu_summary()["present"]
            ok, msg = reader.disconnect()
            assert ok and msg == "Stopped the simulated glove."
            assert not reader.is_simulated()
            assert reader.sim_input({"held": []})[0] is False
            saved = os.listdir(os.path.join(tmp, "glove"))
            assert len(saved) == 1 and saved[0].startswith("glove_sim_")
    finally:
        serial_io.has_pyserial = real


def test_dev_page_sim_keys_name_real_controls():
    # dev.js holds controls by name; the simulator drops names it does not
    # know, so a typo there would be a key that silently does nothing.
    import re
    from core.glove.sim import CONTROLS
    src = (_REPO_ROOT / "launcher_web" / "dev.js").read_text(encoding="utf-8")
    block = src[src.index("const DEV_SIM_KEYS = ["):]
    block = block[:block.index("];")]
    ctls = set(re.findall(r'ctl:"([^"]+)"', block))
    page_only = {"hard", "tremor"}     # a flag on the POST, and a local toggle
    assert ctls - page_only == set(CONTROLS), sorted(ctls ^ set(CONTROLS))


# ── link health: stalls, lost ports, write timeouts (2026-11-09) ───────────
#
# The 2026-11-08 freezes, replayed against a scripted port. No board and no
# pyserial: GloveReader._open_port is swapped for _Board.open.

import threading as _threading
import time as _time
from contextlib import contextmanager


class SerialTimeoutException(Exception):
    """Named like pyserial's, which is how the reader recognises one."""


class _Board:
    """What sits behind the fake COM port, kept across reopens.

    mode: "stream"  sends a frame every read
          "silent"  sends nothing, however often the port is reopened
          "blocked" sends nothing until the port is reopened (a board stuck in
                    a write until DTR drops), then streams
          "gone"    the USB device has vanished: reads and opens both fail
    """

    def __init__(self, mode="stream"):
        self.mode = mode
        self.seq = 0
        self.opens = 0
        self.writes: list[bytes] = []
        self.write_hangs = False
        self._lock = _threading.Lock()

    def open(self, port):
        with self._lock:
            if self.mode == "gone":
                raise OSError(f"could not open port '{port}'")
            self.opens += 1
            if self.mode == "blocked":
                self.mode = "stream"
        return _FakePort(self)

    def read(self):
        with self._lock:
            mode = self.mode
        if mode == "gone":
            raise OSError("ClearCommError failed")
        _time.sleep(0.01)
        if mode != "stream":
            return b""
        with self._lock:
            self.seq += 1
            s = self.seq
        return f"G,{s},{s * 10000},512\r\n".encode("ascii")


class _FakePort:
    def __init__(self, board):
        self.board = board
        self.closed = False
        self.dtr = True

    def read(self, size=1):
        if self.closed:
            raise OSError("port is closed")
        return self.board.read()

    def write(self, data):
        if self.board.write_hangs:
            _time.sleep(0.3)
            raise SerialTimeoutException("Write timeout")
        self.board.writes.append(bytes(data))
        return len(data)

    def close(self):
        self.closed = True


@contextmanager
def _fast_link(board):
    """A reader on `board` with the link timings shrunk to test speed."""
    import tempfile
    from core.glove import serial_io as sio
    names = ("STALL_S", "REOPEN_GAP_S", "RETRY_S", "RECONNECT_S",
             "UNRESPONSIVE_RETRY_S", "RATE_STALE_S")
    saved = {n: getattr(sio, n) for n in names}
    real_has = sio.has_pyserial
    sio.STALL_S, sio.REOPEN_GAP_S, sio.RETRY_S = 0.25, 0.02, 0.05
    sio.RECONNECT_S, sio.UNRESPONSIVE_RETRY_S, sio.RATE_STALE_S = 0.4, 0.3, 0.15
    sio.has_pyserial = lambda: True
    tmp = tempfile.TemporaryDirectory()
    reader = sio.GloveReader(tmp.name)
    reader.SETTLE_S = 0.0
    reader._open_port = board.open
    try:
        yield reader, tmp.name
    finally:
        if reader.is_connected():
            reader.disconnect()
        for n, v in saved.items():
            setattr(sio, n, v)
        sio.has_pyserial = real_has
        tmp.cleanup()


def _wait_for(pred, timeout=3.0):
    end = _time.monotonic() + timeout
    while _time.monotonic() < end:
        if pred():
            return True
        _time.sleep(0.01)
    return False


def _events(tmp):
    import os
    path = os.path.join(tmp, "glove", "events.log")
    if not os.path.exists(path):
        return []
    with open(path, encoding="utf-8") as fh:
        return [line.split()[1] for line in fh if line.strip()]


def test_link_reopens_a_board_blocked_on_an_unread_port():
    # The fw 0.10.2 failure: the board stops mid-write until DTR drops.
    board = _Board("stream")
    with _fast_link(board) as (reader, tmp):
        assert reader.connect("COM5")[0]
        assert _wait_for(lambda: reader.stats()["total"] > 5)
        board.mode = "blocked"
        assert _wait_for(lambda: reader.stats()["link"] == "stalled")
        assert _wait_for(lambda: reader.stats()["link"] == "ok")
        st = reader.stats()
        assert st["connected"] and st["stalls"] == 1 and board.opens == 2
        before = st["total"]
        assert _wait_for(lambda: reader.stats()["total"] > before + 5)
        # The reopen asked for the banner and the stream again.
        assert board.writes[-2:] == [b"?\n", b"S\n"]
        ev = _events(tmp)
    assert ev[:1] == ["connect"] and "stall" in ev and "recovered" in ev, ev


def test_link_names_a_board_that_stays_silent():
    # The 23:13 freeze on 2026-11-08: reopening does not bring it back.
    board = _Board("stream")
    with _fast_link(board) as (reader, tmp):
        assert reader.connect("COM5")[0]
        assert _wait_for(lambda: reader.stats()["total"] > 5)
        board.mode = "silent"
        assert _wait_for(lambda: reader.stats()["link"] == "unresponsive")
        st = reader.stats()
        assert st["connected"]                         # still Disconnect-able
        assert "reset button" in st["last_error"]
        assert st["rate_hz"] == 0.0                    # not a stale green 100 Hz
        # Quiet retries continue, but are not logged again.
        opens = board.opens
        assert _wait_for(lambda: board.opens > opens + 1)
        assert reader.stats()["link"] == "unresponsive"
        # And a board that comes back is picked up without the user.
        board.mode = "stream"
        assert _wait_for(lambda: reader.stats()["link"] == "ok")
        assert reader.stats()["last_error"] == ""
        ok, msg = reader.disconnect()
        assert ok and not reader.is_connected()
        ev = _events(tmp)
    assert ev.count("unresponsive") == 1, ev
    assert ev[-1] == "disconnect", ev


def test_link_rides_out_a_port_that_vanishes_and_returns():
    # A board reset (brown-out, button): the COM port drops and comes back.
    board = _Board("stream")
    with _fast_link(board) as (reader, tmp):
        assert reader.connect("COM5")[0]
        assert _wait_for(lambda: reader.stats()["total"] > 5)
        board.mode = "gone"
        assert _wait_for(lambda: reader.stats()["link"] == "lost")
        st = reader.stats()
        assert st["connected"] and "Read failed" in st["last_error"]
        ok, msg = reader.send_command("D")
        assert not ok and "recovering" in msg
        board.mode = "stream"
        assert _wait_for(lambda: reader.stats()["link"] == "ok")
        st = reader.stats()
        assert st["connected"] and st["reconnects"] == 1 and st["port"] == "COM5"
        ev = _events(tmp)
    assert ["lost", "reopened", "recovered"] == [e for e in ev if e in ("lost", "reopened", "recovered")], ev


def test_link_gives_up_on_a_port_that_stays_gone_and_says_why():
    board = _Board("stream")
    with _fast_link(board) as (reader, tmp):
        assert reader.connect("COM5")[0]
        assert _wait_for(lambda: reader.stats()["total"] > 5)
        board.mode = "gone"
        assert _wait_for(lambda: not reader.is_connected())
        st = reader.stats()
        assert st["link"] == "idle" and st["port"] is None
        assert "did not come back" in st["last_error"] and "COM5" in st["last_error"]
        # Connect is offered again, not "Already connected".
        board.mode = "stream"
        ok, msg = reader.connect("COM5")
        assert ok, msg
        assert "gave_up" in _events(tmp)


def test_link_disconnect_during_a_reconnect_ends_it_cleanly():
    board = _Board("stream")
    with _fast_link(board) as (reader, tmp):
        assert reader.connect("COM5")[0]
        assert _wait_for(lambda: reader.stats()["total"] > 2)
        board.mode = "gone"
        assert _wait_for(lambda: reader.stats()["link"] == "lost")
        ok, _msg = reader.disconnect()
        assert ok and not reader.is_connected()
        board.mode = "stream"
        _time.sleep(0.2)                          # a straggling retry must not reopen
        assert reader.stats()["port"] is None and board.opens == 1


def test_link_stop_command_is_not_a_stall():
    board = _Board("stream")
    with _fast_link(board) as (reader, tmp):
        assert reader.connect("COM5")[0]
        assert _wait_for(lambda: reader.stats()["total"] > 2)
        assert reader.send_command("X")[0]
        board.mode = "silent"                     # what X does on the board
        _time.sleep(0.6)
        st = reader.stats()
        assert st["link"] == "ok" and st["stalls"] == 0 and board.opens == 1
        assert st["rate_hz"] == 0.0               # quiet, so no live rate either


def test_link_write_timeout_never_blocks_the_status_poll():
    board = _Board("stream")
    with _fast_link(board) as (reader, tmp):
        assert reader.connect("COM5")[0]
        board.write_hangs = True
        result = {}
        t = _threading.Thread(target=lambda: result.update(r=reader.send_command("D")))
        t.start()
        _time.sleep(0.05)                         # the write is now in flight
        t0 = _time.monotonic()
        reader.stats()
        reader.snapshot()
        assert _time.monotonic() - t0 < 0.1       # did not wait on the write
        t.join()
        ok, msg = result["r"]
        assert not ok and "did not take the command" in msg
        assert "write_timeout" in _events(tmp)


def test_link_snapshot_carries_the_link_state():
    board = _Board("stream")
    with _fast_link(board) as (reader, tmp):
        assert reader.connect("COM5")[0]
        assert _wait_for(lambda: reader.stats()["total"] > 2)
        snap = reader.snapshot()
        assert snap["connected"] and snap["link"] == "ok"


def test_event_log_records_the_banner_and_board_warnings():
    board = _Board("silent")
    with _fast_link(board) as (reader, tmp):
        assert reader.connect("COM5")[0]
        reader._ingest(REAL_BANNER + " rst=pin")
        reader._ingest("!IMU MPU6050 not answering on A4/A5 (0x68/0x69) - no motion columns")
        reader._ingest("#DIAG imu mg=1,2,3 mdps=4,5,6 held=0 who=0x68 addr=0x68 i2c_fail=7")
        assert reader.stats()["i2c_fail"] == 7
        assert reader.stats()["banner"]["rst"] == "pin"
        reader.disconnect()
        import os
        with open(os.path.join(tmp, "glove", "events.log"), encoding="utf-8") as fh:
            lines = fh.read().splitlines()
    kinds = [ln.split()[1] for ln in lines]
    assert kinds[:3] == ["connect", "banner", "board_says"], kinds
    banner = lines[1]
    assert "fw=0.1.0" in banner and "rst=pin" in banner and "port=COM5" in banner
    assert 'text="!IMU MPU6050 not answering' in lines[2]       # spaces quoted
    assert "i2c_fail=7" in lines[-1] and kinds[-1] == "disconnect"


def test_banner_reads_the_reset_reason():
    b = parse_banner(REAL_BANNER + " rst=pin+sreq")
    assert b.rst == "pin+sreq"
    assert parse_banner(REAL_BANNER).rst == ""          # older firmware: absent


def test_firmware_sends_only_through_its_transmit_queue():
    # glove.ino 0.10.3: Serial.print/write block on this core (USBCDC::send
    # waits with no timeout), so everything goes through TX_RING. One direct
    # write is allowed: txPump()'s fallback for non-mbed boards.
    import re
    src = (_REPO_ROOT / "firmware" / "glove" / "glove.ino").read_text(encoding="utf-8")
    code = re.sub(r"/\*.*?\*/", "", src, flags=re.S)
    code = re.sub(r"//[^\n]*", "", code)
    calls = re.findall(r"\bSerial\.(?:print|println|write)\s*\(([^;]*)\)\s*;", code)
    assert calls == ["p, n"], calls
    # The same rule for the radio (fw 0.11.0): a BLE notify can spin until
    # the controller has a buffer, so only blePump() notifies, after checking.
    assert code.count(".writeValue(") == 1
    pump = code[code.index("static void blePump()"):]
    pump = pump[:pump.index("\n}\n")]
    assert "_pendingPkt >= HCI._maxPkt" in pump and ".writeValue(" in pump
    # And nothing tests `!Serial` per frame: that operator sleeps 1 ms here.
    assert code.count("!Serial") == 1                    # setup()'s bounded wait


# ── IMU fusion (core/glove/fusion.py, the port of glove_fusion.js) ─────────

def _fz():
    from core.glove import fusion
    return fusion


def _close(u, v, tol=1e-6):
    return all(abs(a - b) <= tol for a, b in zip(u, v))


def _axis_angle(axis, deg):
    import math
    n = math.sqrt(sum(a * a for a in axis))
    h = math.radians(deg) / 2
    return (math.cos(h), *(math.sin(h) * a / n for a in axis))


# A board strapped on crooked: hand -> board, 70 degrees about (1, 2, 3).
_CROOKED = _axis_angle((1.0, 2.0, 3.0), 70.0)


def _hold(fz, f, up_board, n, t0, gyro=(0.0, 0.0, 0.0)):
    """n still samples at 100 Hz with the accelerometer reading up_board."""
    for k in range(n):
        f.step(up_board, gyro, t0 + k * 10_000)
    return t0 + n * 10_000


def test_fusion_default_mount_reads_the_hand_poses():
    fz = _fz()
    # Default mount: board flat on the back, +Z out of the back, +Y to the fingers.
    for up_board, gravity_hand in (((0, 0, 1), (0, 0, 1)),     # palm down
                                   ((0, 1, 0), (0, -1, 0)),    # fingers up
                                   ((-1, 0, 0), (-1, 0, 0))):  # thumb up (right hand)
        f = fz.Fusion()
        _hold(fz, f, up_board, 5, 0)
        assert _close(f.gravity_in_hand(), gravity_hand), (up_board, f.gravity_in_hand())


def test_fusion_two_pose_calibration_recovers_a_crooked_mount():
    fz = _fz()
    f = fz.Fusion()
    f.start_calibration()
    up1 = fz.qrot(_CROOKED, (0, 0, -1))              # palm down: up is the back of the hand
    # Fingers up, but leaning 15 degrees: calibration keeps only the part
    # square to the first pose.
    up2 = fz.qrot(_CROOKED, (0, 0.9659258, -0.2588190))
    t = _hold(fz, f, up1, 100, 0)
    assert f.cal["step"] == 2 and f.mount is None
    t = _hold(fz, f, up1, 5, t, gyro=(40.0, 0.0, 0.0))   # turning: not still
    _hold(fz, f, up2, 100, t)
    assert f.cal is None and f.mount is not None
    for e in ((1, 0, 0), (0, 1, 0), (0, 0, 1)):
        assert _close(fz.qrot(f.mount, e), fz.qrot(_CROOKED, e)), e
    g = fz.Fusion(mount=f.export_mount())
    _hold(fz, g, fz.qrot(_CROOKED, (1, 0, 0)), 5, 0)    # thumb up
    assert _close(g.gravity_in_hand(), (-1, 0, 0))


def test_fusion_calibration_wants_two_distinct_still_poses():
    fz = _fz()
    f = fz.Fusion()
    f.start_calibration()
    t = _hold(fz, f, (0, 0, 1), fz.CAL_SAMPLES, 0)
    assert f.cal["step"] == 2
    _hold(fz, f, (0, 0.5, 0.8660254), fz.CAL_SAMPLES, t)   # only 30 degrees off
    assert f.cal["error"] == "too-close" and f.mount is None
    g = fz.Fusion()
    g.start_calibration()
    t = _hold(fz, g, (0, 0, 1), 60, 0)
    t = _hold(fz, g, (0, 0, 1), 1, t, gyro=(0, 0, 30.0))   # one twitch restarts the hold
    _hold(fz, g, (0, 0, 1), 60, t)
    assert g.cal["step"] == 1 and g.cal["n"] == 60


def test_fusion_follows_a_turn_learns_the_bias_and_rides_the_clock_wrap():
    import math
    fz = _fz()
    bias = (0.6, -0.4, 0.3)
    f = fz.Fusion()
    t = (1 << 32) - 1_500_000              # the board's u32 clock wraps 1.5 s in
    for _ in range(300):                   # 3 s still, palm down
        f.step((0, 0, 1), bias, t)
        t = (t + 10_000) % (1 << 32)
    assert _close(f.bias, bias, 0.02), f.bias
    w = 90.0                               # then pitch the fingers up, 90 deg/s for 1 s
    for k in range(1, 101):
        q_true = _axis_angle((1, 0, 0), w * k / 100)
        a = fz.qrot(fz.qconj(q_true), (0, 0, 1))
        f.step(a, (w + bias[0], bias[1], bias[2]), t)
        t = (t + 10_000) % (1 << 32)
    g = f.gravity_in_hand()
    err = math.degrees(math.acos(max(-1.0, min(1.0, -g[1]))))
    assert err < 2.0, (g, err)             # fingers up: gravity runs down the fingers


def test_fusion_vertical_g_sees_a_lift_not_a_sideways_move():
    fz = _fz()
    f = fz.Fusion()
    t = _hold(fz, f, (0, 0, 1), 20, 0)
    f.step((0.2, 0, 1.0), (0, 0, 0), t)         # 0.2 g sideways: |a| moves, vertical barely
    assert abs(f.vertical_g((0.2, 0, 1.0)) - 1.0) < 0.01
    f.step((0, 0, 1.2), (0, 0, 0), t + 10_000)  # 0.2 g upward
    assert abs(f.vertical_g((0, 0, 1.2)) - 1.2) < 0.01


def test_fusion_constants_match_the_hub_js():
    import re
    fz = _fz()
    js = (_REPO_ROOT / "launcher_web" / "glove_fusion.js").read_text(encoding="utf-8")
    found = dict(re.findall(r"export const ([A-Z_]+) = ([0-9.]+);", js))
    for name in ("KP", "ACC_TRUST_G", "STILL_GYRO_DPS", "STILL_ACC_G",
                 "BIAS_AFTER_S", "BIAS_RATE", "CAL_SAMPLES", "CAL_MIN_DEG"):
        assert name in found, name
        assert float(found[name]) == float(getattr(fz, name)), name


_FUSION_RUNNER = """
import { readFileSync } from 'node:fs';
const F = await import(new URL('./glove_fusion.mjs', import.meta.url));
const inp = JSON.parse(readFileSync(0, 'utf8'));
const f = F.createFusion();
const q = [];
inp.samples.forEach((s, i) => {
  if (i === inp.cal_at) F.startCalibration(f);
  F.step(f, s[0], s[1], s[2]);
  if (i % inp.every === 0) q.push(f.q);
});
console.log(JSON.stringify({q, bias: f.bias, mount: f.mount, ready: f.ready}));
"""


def test_fusion_matches_the_hub_js_on_the_same_samples():
    import json
    import random
    import shutil
    import subprocess
    import tempfile
    fz = _fz()
    node = shutil.which("node")
    if not node:
        print("    (node not found: parity with glove_fusion.js not checked)")
        return
    rng = random.Random(7)
    samples, t = [], (1 << 32) - 2_000_000

    def add(a, g, n):
        nonlocal t
        for _ in range(n):
            samples.append([[x + rng.gauss(0, 0.004) for x in a],
                            [x + rng.gauss(0, 0.25) for x in g], t])
            t = (t + 10_000) % (1 << 32)

    bias = (0.6, -0.4, 0.3)
    add(fz.qrot(_CROOKED, (0, 0, -1)), bias, 120)       # pose 1
    add(fz.qrot(_CROOKED, (0, 0, -1)), (30, 0, 0), 10)  # moving
    add(fz.qrot(_CROOKED, (0, 1, 0)), bias, 120)        # pose 2
    for k in range(150):                                # a turn about a skew axis
        q_true = _axis_angle((1, 1, 0), 60 * k / 100)
        add(fz.qrot(fz.qconj(q_true), (0, 0, 1)), (42.4 + bias[0], 42.4 + bias[1], bias[2]), 1)
    t = (t + 300_000) % (1 << 32)                       # a dropped-frame gap
    add((0.1, 0.2, 1.3), (5, -3, 8), 30)                # shaking: gravity not trusted
    inp = {"samples": samples, "cal_at": 0, "every": 7}

    f = fz.Fusion()
    q_py = []
    for i, (a, g, tu) in enumerate(samples):
        if i == inp["cal_at"]:
            f.start_calibration()
        f.step(a, g, tu)
        if i % inp["every"] == 0:
            q_py.append(f.q)

    with tempfile.TemporaryDirectory() as tmp:
        shutil.copyfile(_REPO_ROOT / "launcher_web" / "glove_fusion.js",
                        Path(tmp) / "glove_fusion.mjs")
        (Path(tmp) / "run.mjs").write_text(_FUSION_RUNNER, encoding="utf-8")
        r = subprocess.run([node, str(Path(tmp) / "run.mjs")], input=json.dumps(inp),
                           capture_output=True, text=True, timeout=60)
    assert r.returncode == 0, r.stderr
    js = json.loads(r.stdout)
    assert js["ready"] and f.ready
    assert js["mount"] is not None and f.mount is not None
    assert _close(js["mount"], f.mount, 1e-9), (js["mount"], f.mount)
    assert _close(js["bias"], f.bias, 1e-9), (js["bias"], f.bias)
    assert len(js["q"]) == len(q_py)
    worst = max(max(abs(a - b) for a, b in zip(qj, qp)) for qj, qp in zip(js["q"], q_py))
    assert worst < 1e-9, worst


# ── Bluetooth stream (core/glove/ble_io.py) ───────────────────────────────

_BLE_BANNER = ("#GLOVE fw=0.11.0 proto=1 board=nano33ble rate=100 adc_bits=12 "
               "adc_ref_mv=3300 vdiv_mv=3300 r_fixed=10000 imu=MPU6050 imu_scale=1000 "
               "rst=por ble=1 emg=0 cols=seq,t_us,p0,f0,ax,ay,az,gx,gy,gz "
               "chan=p0:fsr:10000,f0:flex:47000,ax:accel,ay:accel,az:accel,"
               "gx:gyro,gy:gyro,gz:gyro\r\n")


def _ble_record(seq, t_us, analog, imu):
    """A record laid out the way glove.ino's emitFrame() builds it."""
    import struct
    body = struct.pack("<II" + "H" * len(analog) + "i" * len(imu), seq, t_us, *analog, *imu)
    return bytes([0x01, len(body)]) + body


def test_ble_stream_rebuilds_usb_lines_across_any_split():
    from core.glove.ble_io import BleStreamDecoder
    imu = [-149, 31, 915, -1_707_000, 213, 1_000_000]
    stream = (_BLE_BANNER.encode() + _ble_record(7, 70_000, [4095, 12], imu)
              + b"#ZERO\r\n" + _ble_record(8, 80_000, [0, 65535], [0] * 6))
    want = (_BLE_BANNER + "G,7,70000,4095,12," + ",".join(map(str, imu)) + "\r\n"
            + "#ZERO\r\n" + "G,8,80000,0,65535,0,0,0,0,0,0\r\n").encode()
    # A notification boundary can fall anywhere, inside a record included.
    for size in (1, 2, 3, 7, 20, 64, 244, len(stream)):
        dec = BleStreamDecoder()
        out = b"".join(dec.feed(stream[i:i + size]) for i in range(0, len(stream), size))
        assert out == want, size
        assert dec.records == 2 and dec.undecoded == 0


def test_ble_lines_parse_like_usb():
    from core.glove.ble_io import BleStreamDecoder
    dec = BleStreamDecoder()
    text = dec.feed(_BLE_BANNER.encode() + _ble_record(1, 10_000, [2048, 1000], [1] * 6))
    acc = FrameAccumulator()
    frames = [acc.feed(line) for line in text.decode().splitlines()]
    assert acc.banner is not None and acc.banner.imu_present
    f = frames[-1]
    assert f is not None and f.seq == 1 and tuple(f.values[:2]) == (2048, 1000)


def test_ble_records_before_banner_or_of_wrong_size_are_skipped():
    from core.glove.ble_io import BleStreamDecoder
    dec = BleStreamDecoder()
    assert dec.feed(_ble_record(1, 1, [1, 2], [0] * 6)) == b""
    assert dec.undecoded == 1
    dec.feed(_BLE_BANNER.encode())
    # One analog column short of the banner's layout: skipped, stream stays in sync.
    out = dec.feed(_ble_record(2, 2, [1], [0] * 6) + b"#ZERO\r\n")
    assert out == b"#ZERO\r\n" and dec.undecoded == 2


def test_ble_ports_are_told_apart_from_com_ports():
    from core.glove.ble_io import ble_address, is_ble_port
    assert is_ble_port("BLE:AA:BB:CC:DD:EE:FF")
    assert ble_address("BLE:AA:BB:CC:DD:EE:FF") == "AA:BB:CC:DD:EE:FF"
    assert not is_ble_port("COM5") and not is_ble_port("SIM") and not is_ble_port(None)


def test_palm_a401_parses_as_flexiforce_and_loads_with_a_fist():
    """fw 0.11.1's h0 (A401 on mux C15, 47k divider) is its own kind, so no
    page or reader can route it through the FSR402 curve, and the sim's fist
    loads it the way a closed hand bears on the palm."""
    from core.glove.sim import ADC_BITS, CHANNELS, PALM_FIST_N, PALM_US_PER_N
    b = parse_banner("#GLOVE fw=0.11.1 proto=1 board=nano33ble rate=100 adc_bits=12 "
                     "adc_ref_mv=3300 vdiv_mv=3300 r_fixed=10000 imu=none "
                     "cols=seq,t_us,p0,h0 chan=p0:fsr:10000,h0:flexiforce:47000")
    assert [(m.name, m.kind, m.r_fixed) for m in b.channel_meta] ==         [("p0", KIND_FSR, 10000), ("h0", KIND_FLEXIFORCE, 47000)]
    h = [n for n, _k, _r in CHANNELS].index("h0")
    sim, acc = _sim_fresh()
    _sim_run(sim, 0.5)
    sim.set_input(["fist"], now=0.5)
    f = _sim_frames(_sim_run(sim, 1.4), acc)[-1]          # inside the 1 s dead-man
    us = 1e6 / sensor_ohms(f.values[h], 3300, 3300, 47000, ADC_BITS)
    assert abs(us / (PALM_US_PER_N * PALM_FIST_N) - 1) < 0.05


def test_ble_identity_matches_firmware():
    """The host finds the glove by these; a typo on either side is a glove
    that never shows up in a scan."""
    import re
    from core.glove import ble_io
    src = (_REPO_ROOT / "firmware" / "glove" / "glove.ino").read_text(encoding="utf-8")
    for name, value in (("NUS_SERVICE", ble_io.NUS_SERVICE), ("NUS_RX", ble_io.NUS_RX),
                        ("NUS_TX", ble_io.NUS_TX)):
        m = re.search(rf'\b{name}\s*=\s*"([0-9A-Fa-f-]+)"', src)
        assert m and m.group(1).lower() == value, name
    m = re.search(r'#define\s+BLE_NAME\s+"([^"]+)"', src)
    assert m and m.group(1) == ble_io.GLOVE_NAME
    m = re.search(r"BLE_REC_MARK\s*=\s*(0x[0-9A-Fa-f]+)", src)
    assert m and int(m.group(1), 16) == ble_io.REC_MARK


if __name__ == "__main__":
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    failed = 0
    for fn in fns:
        try:
            fn()
            print(f"  PASS  {fn.__name__}")
        except AssertionError as e:
            failed += 1
            print(f"  FAIL  {fn.__name__}: {e}")
    print(f"\n{len(fns) - failed}/{len(fns)} passed")
    sys.exit(1 if failed else 0)
