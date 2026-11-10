"""
Unit tests for the musculoskeletal hand twin (docs/glove/DIGITAL_TWIN_PLAN.md).

The pure parts (retargeting, static optimisation, grasp readings) always run.
The MuJoCo parts (MyoHand, inverse dynamics, the pipeline) skip with a note
when the twin is not installed (``python install.py --twin``). No camera, no
glove.

Run:  python -m pytest screening_tests/tests/test_twin.py
 or:  python screening_tests/tests/test_twin.py   (self-runs without pytest)
"""

from __future__ import annotations

import ast
import math
import sys
from pathlib import Path

import numpy as np

_REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_REPO_ROOT))

from core import twin  # noqa: E402
from core.twin import proxies, retarget, static_opt  # noqa: E402


class _Skip(Exception):
    pass


def _need_twin():
    if twin.available():
        return
    if "pytest" in sys.modules:
        import pytest
        pytest.skip(twin.missing_message())
    raise _Skip(twin.missing_message())


def _hand():
    from core.twin.model import load
    return load()


# ── retarget (pure) ─────────────────────────────────────────────────────────

def test_bend_flat_is_zero_and_full_is_the_fist_synergy():
    flat = retarget.bend_to_angles({d: 0.0 for d in retarget.DIGITS})
    assert all(v == 0.0 for v in flat.values()) and len(flat) == 15
    fist = retarget.bend_to_angles({d: 1.0 for d in retarget.DIGITS})
    assert math.isclose(fist["pm2_flexion_r"], math.radians(90.0))
    assert math.isclose(fist["md5_flexion_r"], math.radians(70.0))
    # MyoHand's thumb flexes negative
    assert fist["ip_flexion_r"] < 0 and fist["cmc_flexion_r"] < 0


def test_bend_keys_by_channel_skips_missing_and_clips():
    a = retarget.bend_to_angles({"f1": 0.5, "f2": None, "f3": 1.7, "f4": float("nan")})
    assert math.isclose(a["mcp2_flexion_r"], math.radians(85.0) * 0.5)
    assert "mcp3_flexion_r" not in a           # an absent strip is not a straight finger
    assert math.isclose(a["mcp4_flexion_r"], math.radians(85.0))   # clipped to 1
    assert "mcp5_flexion_r" not in a and "cmc_flexion_r" not in a


def _straight_landmarks():
    lm = [(0.0, 0.0, 0.0)]                      # wrist
    lm += [(0.02 * k, 0.02 * k, 0.0) for k in range(1, 5)]   # thumb, straight diagonal
    for x in (0.02, 0.0, -0.02, -0.04):         # index..little, straight along +y
        lm += [(x, 0.08 + 0.03 * k, 0.0) for k in range(4)]
    return lm


def test_landmarks_straight_hand_reads_near_zero():
    a = retarget.landmarks_to_angles(_straight_landmarks())
    finger_joints = [j for d in retarget.DIGITS[1:] for j in retarget.DIGIT_JOINTS[d][1:]]
    assert all(abs(a[j]) < 1e-6 for j in finger_joints), a
    assert "cmc_flexion_r" not in a             # thumb CMC deliberately not read


def test_landmarks_bent_pip_reads_ninety_degrees():
    lm = _straight_landmarks()
    pip = lm[6]                                 # index PIP
    lm[7] = (pip[0], pip[1], 0.03)              # DIP straight out of the plane
    lm[8] = (pip[0], pip[1], 0.06)
    a = retarget.landmarks_to_angles(lm)
    assert math.isclose(a["pm2_flexion_r"], math.pi / 2, abs_tol=1e-6)
    assert abs(a["md2_flexion_r"]) < 1e-6


def test_merge_prefers_camera_and_records_source():
    cam, glove = {"pm2_flexion_r": 0.5}, {"pm2_flexion_r": 0.2, "mcp2_flexion_r": 0.3}
    assert retarget.merge(cam, glove) == {"pm2_flexion_r": 0.5, "mcp2_flexion_r": 0.3}
    assert retarget.source_of(cam, glove) == {"pm2_flexion_r": "camera",
                                              "mcp2_flexion_r": "glove"}


# ── static optimisation (pure) ──────────────────────────────────────────────

def test_static_opt_never_co_contracts():
    # One joint, a flexor (+0.02 N*m per unit activation) and an extensor
    # (-0.02). Any flexion torque is met by the flexor alone: this is the
    # property that rules out a co-contraction index without EMG (plan §2).
    A = np.array([[0.02, -0.02]])
    for tau in (0.001, 0.005, 0.015):
        sol = static_opt.solve(A, np.array([tau]))
        assert sol["a"][1] < 1e-6, sol["a"]
        assert math.isclose(sol["a"][0], tau / 0.02, rel_tol=0.01)


def test_static_opt_reports_torque_it_cannot_make():
    A = np.array([[0.02, -0.02]])
    sol = static_opt.solve(A, np.array([0.05]))     # capacity is 0.02
    assert math.isclose(sol["a"][0], 1.0) and list(sol["saturated"]) == [0]
    assert math.isclose(sol["residual"][0], 0.03, abs_tol=1e-6)


def test_static_opt_unactuated_joint_keeps_its_residual():
    A = np.array([[0.02, 0.01], [0.0, 0.0]])
    sol = static_opt.solve(A, np.array([0.01, 0.3]))
    assert list(sol["unactuated"]) == [1]
    assert math.isclose(sol["residual"][1], 0.3)


def test_joint_limit_carries_only_torque_into_it():
    A = np.array([[0.02, -0.02]])                # flexor, extensor
    on_lower = np.array([1.0])                   # the limit can push +
    into = static_opt.solve(A, np.array([0.01]), limit=on_lower)
    assert into["a"].max() < 1e-6 and math.isclose(into["limit"][0], 0.01, rel_tol=1e-6)
    assert abs(into["residual"][0]) < 1e-9
    away = static_opt.solve(A, np.array([-0.01]), limit=on_lower)
    assert away["limit"][0] == 0.0 and away["a"][1] > 0.4 and away["a"][0] < 1e-6
    # A joint no muscle crosses rests on its limit too, in that direction only.
    A2 = np.array([[0.02, 0.01], [0.0, 0.0]])
    rest = static_opt.solve(A2, np.array([0.01, 0.3]), limit=np.array([0.0, 1.0]))
    assert rest["residual"][1] == 0.0 and rest["limit"][1] == 0.3
    pull = static_opt.solve(A2, np.array([0.01, -0.3]), limit=np.array([0.0, 1.0]))
    assert math.isclose(pull["residual"][1], -0.3)


def test_force_cost_loads_the_small_muscle():
    # Two synergists with equal moment arms; the big one (F0 400 N) and the
    # small one (F0 100 N) make torque in proportion to F0.
    f0 = np.array([400.0, 100.0])
    A = np.array([[0.01 * 4, 0.01 * 1]])
    b = np.array([0.02])
    act = static_opt.solve(A, b, static_opt.cost_weights("activation", f0))["a"]
    frc = static_opt.solve(A, b, static_opt.cost_weights("force", f0))["a"]
    assert act[0] > act[1]                      # effort: the strong muscle
    assert frc[1] > act[1]                      # forces: shifts to the small one
    mask = static_opt.cost_sensitive(act, frc)
    assert mask.any()


def test_cost_sensitive_ignores_small_differences():
    assert not static_opt.cost_sensitive(np.array([0.20]), np.array([0.23])).any()
    assert static_opt.cost_sensitive(np.array([0.05]), np.array([0.30])).all()


# ── grasp readings (pure) ───────────────────────────────────────────────────

def test_internal_force_squeeze_vs_push():
    squeeze = proxies.internal_force([(5, 0, 0), (-5, 0, 0)])
    assert squeeze == {"total": 10.0, "net": 0.0, "internal": 10.0}
    push = proxies.internal_force([(0, 0, -3), (0, 0, -4)])
    assert math.isclose(push["internal"], 0.0, abs_tol=1e-12)
    assert proxies.internal_force([])["total"] == 0.0


def _lift_trace(preload=0.6, rate=10.0):
    t = np.arange(0, 3.0, 0.01)
    f = np.clip((t - 0.5) * rate, 0, 5.0)
    lift = 0.5 + preload
    a = np.where((t >= lift) & (t < lift + 0.2), 1.12, 1.0)
    return t, f, a


def test_pinch_lift_reads_preload_rate_and_hold():
    t, f, a = _lift_trace(preload=0.6, rate=10.0)
    r = proxies.pinch_lift(t, f, a)
    # contact is when grip passes 0.5 N, 0.05 s after the ramp starts
    assert math.isclose(r["preload_s"], 0.55, abs_tol=0.02), r
    assert math.isclose(r["grip_rate_n_per_s"], 10.0, rel_tol=0.05)
    assert math.isclose(r["hold_force_n"], 5.0)


def test_pinch_lift_needs_contact_and_lift():
    t, f, a = _lift_trace()
    assert proxies.pinch_lift(t, np.zeros_like(f), a) is None
    assert proxies.pinch_lift(t, f, np.ones_like(a)) is None


def test_still_force_fraction():
    t = np.arange(0, 2.0, 0.01)
    f = np.where(t > 0.5, 4.0, 0.0)
    bend = np.where(t < 1.0, 0.3, 0.3 + (t - 1.0))   # moves after 1 s
    frac = proxies.still_force_fraction(t, f, bend=bend)
    assert 0.3 < frac < 0.4                      # still from 0.5 to 1.0 of 0.5..2.0


def test_grip_rate_is_not_one_adc_step():
    t, f, a = _lift_trace(preload=0.6, rate=10.0)
    f = f + np.where(np.arange(len(f)) % 2, 0.03, -0.03)   # +-0.03 N sample to sample
    r = proxies.pinch_lift(t, f, a)
    assert math.isclose(r["grip_rate_n_per_s"], 10.0, rel_tol=0.2), r


# ── recordings: glove CSV, IMU orientation (pure) ───────────────────────────

def _axis_angle(axis, deg):
    n = math.sqrt(sum(x * x for x in axis))
    h = math.radians(deg) / 2
    return (math.cos(h), *(math.sin(h) * x / n for x in axis))


#: A board strapped on crooked: hand -> board, 70 degrees about (1, 2, 3).
_CROOKED = _axis_angle((1.0, 2.0, 3.0), 70.0)


def _pinch_session(mount):
    """A 100 Hz session in board axes, physically consistent: palm down 1.2 s,
    turn fingers up at 90 deg/s, hold 1.2 s, turn back, then a pinch-and-lift
    (grip from 4.6 s at 10 N/s to 5 N; 0.15 g upward from 5.3 to 5.5 s)."""
    from core.glove import fusion as fz
    h0 = (0.0, 0.0, 1.0, 0.0)          # hand -> earth: palm down, fingers along +y
    out = []

    def emit(h, w_earth=(0.0, 0.0, 0.0), lift=0.0, grip=0.0):
        q = fz.qmul(h, fz.qconj(mount))                     # board -> earth
        out.append((len(out) / 100, grip,
                    fz.qrot(fz.qconj(q), (0.0, 0.0, 1.0 + lift)),
                    fz.qrot(fz.qconj(q), w_earth)))

    for _ in range(120):
        emit(h0)
    for k in range(1, 101):
        emit(fz.qmul(_axis_angle((1, 0, 0), 0.9 * k), h0), (90.0, 0.0, 0.0))
    for _ in range(120):
        emit(fz.qmul(_axis_angle((1, 0, 0), 90.0), h0))
    for k in range(1, 101):
        emit(fz.qmul(_axis_angle((1, 0, 0), 90.0 - 0.9 * k), h0), (-90.0, 0.0, 0.0))
    for k in range(200):
        tt = k / 100
        emit(h0, lift=0.15 if 0.9 <= tt < 1.1 else 0.0,
             grip=0.0 if tt < 0.2 else min(5.0, (tt - 0.2) * 10.0))
    return out


def _write_glove_csv(path, session, imu=True):
    """The Developer page's Record format, 12-bit, 10k FSR / 47k flex."""
    import csv
    from core.glove.protocol import IMU_COLS
    from core.glove.sim import adc_for_ohms, ohms_for_force

    def fsr(n):
        return 0 if n <= 0 else int(round(adc_for_ohms(ohms_for_force(n), 10_000)))

    with open(path, "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["host_time", "seq", "t_us", "p0", "p1", "f1"]
                   + (list(IMU_COLS) if imu else []))
        t0 = (1 << 32) - 3_000_000                          # the clock wraps 3 s in
        for k, (t, grip, a, g) in enumerate(session):
            row = [f"{1.7e9 + t:.6f}", k, (t0 + round(t * 1e6)) % (1 << 32),
                   fsr(grip), fsr(grip), 2100]               # index bent 35 %
            if imu:
                row += [round(x * 1000) for x in a] + [round(x * 1000) for x in g]
            w.writerow(row)


def _angle_deg(u, v):
    c = sum(a * b for a, b in zip(u, v)) / math.sqrt(sum(a * a for a in u))
    return math.degrees(math.acos(max(-1.0, min(1.0, c))))


def test_imu_hand_axes_are_the_twin_hand_frame():
    from core.glove.fusion import Fusion
    for up_board, want in (((0, 0, 1), retarget.PALM_DOWN), ((0, 0, -1), retarget.PALM_UP),
                           ((0, 1, 0), retarget.FINGERS_UP), ((-1, 0, 0), retarget.THUMB_UP)):
        f = Fusion()                                # default mount
        f.step(up_board, (0, 0, 0), 0)
        assert _angle_deg(f.gravity_in_hand(), want) < 1e-6, (up_board, want)


def test_recording_calibrates_the_mount_from_its_opening_poses():
    import tempfile
    from core.glove import fusion as fz
    from core.twin import recording
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "glove.csv"
        _write_glove_csv(path, _pinch_session(_CROOKED))
        rec = recording.read_glove_csv(path, mount="start")
        rec5 = recording.read_glove_csv(path, mount="start", every=5)
    assert len(rec.frames) == 640 and len(rec5.frames) == 128
    for e in ((1, 0, 0), (0, 1, 0), (0, 0, 1)):
        assert _angle_deg(fz.qrot(rec.mount, e), fz.qrot(_CROOKED, e)) < 0.5, e
        assert _angle_deg(fz.qrot(rec5.mount, e), fz.qrot(_CROOKED, e)) < 0.5, e
    by_t = {round(fr.t, 2): fr for fr in rec.frames}
    assert _angle_deg(by_t[0.5].g_hand, retarget.PALM_DOWN) < 2.0
    assert _angle_deg(by_t[3.2].g_hand, retarget.FINGERS_UP) < 2.0
    assert _angle_deg(by_t[6.0].g_hand, retarget.PALM_DOWN) < 2.0
    assert set(by_t[6.0].forces) == {"p0", "p1"} and 4.5 < by_t[6.0].forces["p0"] < 5.5
    assert any("calibrated from the recording" in n for n in rec.notes)

    r = recording.grasp_readings(rec)
    pl = r["pinch_lift"]
    assert math.isclose(pl["lift_t"], 5.3, abs_tol=0.03), pl
    assert 0.5 < pl["preload_s"] < 0.75, pl     # contact once grip passes 0.5 N
    assert math.isclose(pl["grip_rate_n_per_s"], 10.0, rel_tol=0.25), pl
    assert math.isclose(pl["hold_force_n"], 5.0, rel_tol=0.1), pl
    assert r["still_force_fraction"] > 0.9      # the hand never turns while pressing


def test_recording_without_an_imu_holds_one_pose():
    import tempfile
    from core.twin import recording
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "glove.csv"
        _write_glove_csv(path, _pinch_session(_CROOKED), imu=False)
        rec = recording.read_glove_csv(path)
        fixed = recording.read_glove_csv(path, pose=retarget.PALM_DOWN)
    assert all(fr.g_hand is None for fr in rec.frames)
    assert any("No IMU columns" in n for n in rec.notes)
    assert all(tuple(fr.g_hand) == retarget.PALM_DOWN for fr in fixed.frames)
    assert rec.vertical_g is None and rec.mount is None
    r = recording.grasp_readings(rec)
    assert "pinch_lift" not in r and r["still_force_fraction"] is not None


def test_recording_start_mount_needs_the_two_poses():
    import tempfile
    from core.twin import recording
    turning = [(k / 100, 0.0, (0.0, 0.0, 1.0), (0.0, 0.0, 30.0)) for k in range(300)]
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "glove.csv"
        _write_glove_csv(path, turning)
        try:
            recording.read_glove_csv(path, mount="start")
        except ValueError as e:
            assert "palm down, then fingers up" in str(e)
        else:
            raise AssertionError("a recording with no held poses calibrated")
        rec = recording.read_glove_csv(path)        # the default mount still runs
    assert any("default mount" in n for n in rec.notes)


# ── packaging ───────────────────────────────────────────────────────────────

def test_install_flag_matches_requirements():
    tree = ast.parse((_REPO_ROOT / "install.py").read_text(encoding="utf-8"))
    pkgs = next(ast.literal_eval(n.value) for n in ast.walk(tree)
                if isinstance(n, ast.Assign)
                and any(getattr(t, "id", None) == "TWIN_PACKAGES" for t in n.targets))
    assert tuple(pkgs) == twin.REQUIREMENTS


def test_pure_modules_do_not_import_mujoco():
    # The reader too: a session record or the hub may read a recording on an
    # install without the twin.
    heavy = {"mujoco", "myo_sim", "scipy"}
    needs_mujoco = {"model", "inverse", "pipeline"}
    for name in ("retarget", "static_opt", "proxies", "recording", "__init__"):
        src = (_REPO_ROOT / "core" / "twin" / f"{name}.py").read_text(encoding="utf-8")
        tree = ast.parse(src)
        top = [n for n in tree.body if isinstance(n, (ast.Import, ast.ImportFrom))]
        mods = {a.name for n in top if isinstance(n, ast.Import) for a in n.names}
        mods |= {n.module for n in top if isinstance(n, ast.ImportFrom) and n.module}
        rel = {n.module for n in top if isinstance(n, ast.ImportFrom) and n.level and n.module}
        assert not (heavy & mods) and not (needs_mujoco & rel), (name, mods)


# ── MyoHand (needs the twin installed) ──────────────────────────────────────

def test_model_is_a_right_hand_with_every_pad():
    _need_twin()
    hm = _hand()
    assert len(hm.joints) == 23 and len(hm.muscles) == 39
    assert set(hm.pads) == {"p0", "p1", "p2", "p3", "h0", "h1", "h2"}
    for d in retarget.DIGITS:
        for j in retarget.DIGIT_JOINTS[d]:
            assert j in hm.qadr, j
    hm.set_pose({})
    radial = hm.hand_frame()[:, 0]
    thumb, little = hm.pad_world("p0")[0], hm.pad_world("p3")[0]
    assert (thumb - little) @ radial > 0.02      # thumb on the radial side


def test_pad_normals_face_out_of_the_pads():
    _need_twin()
    hm = _hand()
    hm.set_pose({})
    palmar = hm.hand_frame()[:, 2]
    for ch in ("p1", "p2", "p3"):
        assert hm.pad_world(ch)[1] @ palmar > 0.8, ch
    for ch in ("h0", "h1", "h2"):
        assert hm.pad_world(ch)[1] @ palmar > 0.99, ch
    # MyoHand's neutral thumb rests in front of the palm with its pad facing
    # across it, toward the little-finger (ulnar) side
    radial = hm.hand_frame()[:, 0]
    assert hm.pad_world("p0")[1] @ radial < -0.8


def test_pinch_torque_matches_the_lever_arm():
    # Gate T2 in miniature: 10 N into the index pad, the torque the muscles
    # must add at each index joint equals r x F about that joint's axis,
    # computed here independently of MuJoCo's projection.
    _need_twin()
    import mujoco
    from core.twin.inverse import required_torque
    hm = _hand()
    hm.set_pose(retarget.bend_to_angles({"index": 0.3}))
    base = required_torque(hm, {}, None)["tau"]
    t10 = required_torque(hm, {"p1": 10.0}, None)["tau"] - base
    t20 = required_torque(hm, {"p1": 20.0}, None)["tau"] - base
    p, n = hm.pad_world("p1")
    f = -10.0 * n
    for jn in ("mcp2_flexion_r", "pm2_flexion_r", "md2_flexion_r"):
        j = mujoco.mj_name2id(hm.m, mujoco.mjtObj.mjOBJ_JOINT, jn)
        by_hand = -float(np.cross(p - hm.d.xanchor[j], f) @ hm.d.xaxis[j])
        twin_tau = t10[hm.dofadr[jn]]
        assert twin_tau > 0, (jn, twin_tau)                 # flexors must push back
        assert math.isclose(twin_tau, by_hand, rel_tol=1e-6), (jn, twin_tau, by_hand)
        assert math.isclose(t20[hm.dofadr[jn]], 2 * twin_tau, rel_tol=1e-6)
    assert 0.3 < t10[hm.dofadr["mcp2_flexion_r"]] < 1.5      # ~8 cm lever


def test_gravity_follows_the_hand():
    _need_twin()
    from core.twin.inverse import required_torque
    hm = _hand()
    hm.set_pose({})
    w = hm.dofadr["flexion_r"]
    down = required_torque(hm, {}, retarget.PALM_DOWN)["tau"][w]
    up = required_torque(hm, {}, retarget.PALM_UP)["tau"][w]
    assert abs(down) > 0.01 and math.isclose(down, -up, rel_tol=1e-6)
    required_torque(hm, {}, None)               # restore the default
    assert np.allclose(hm.m.opt.gravity, hm._gravity_default)


def test_straight_hand_held_palm_down_takes_no_strain():
    # A straight finger rests on its 0-degree limit. Before the limits carried
    # torque, holding this took EDC2 at ~0.7 against MyoHand's passive pull,
    # and a 0.03 N*m wrist torque was reported as one the muscles cannot make.
    _need_twin()
    from core.twin.inverse import muscle_terms, required_torque
    hm = _hand()
    hm.set_pose({})
    sides = hm.limit_sides()
    dofs = sorted(hm.joints, key=lambda n: hm.dofadr[n])
    assert sides[dofs.index("pm2_flexion_r")] == 1.0 and sides[dofs.index("flexion_r")] == 0.0
    b = required_torque(hm, {}, retarget.PALM_DOWN)["tau"] - muscle_terms(hm)["bias"]
    for cost in static_opt.COSTS:
        sol = static_opt.solve(muscle_terms(hm)["A"], b,
                               static_opt.cost_weights(cost, hm.f0), limit=sides)
        assert sol["a"].max() < 0.3, (cost, sol["a"].max())
        assert np.abs(sol["residual"]).max() < 0.005, (cost, np.abs(sol["residual"]).max())


def test_index_press_recruits_index_flexors_not_extensors():
    _need_twin()
    from core.twin.inverse import muscle_terms, required_torque
    hm = _hand()
    hm.set_pose(retarget.bend_to_angles({"index": 0.3}))
    req = required_torque(hm, {"p1": 10.0}, retarget.PALM_UP)
    mus = muscle_terms(hm)
    a = static_opt.solve(mus["A"], req["tau"] - mus["bias"])["a"]
    act = dict(zip(hm.muscles, a))
    flex = act["FDS2_r"] + act["FDP2_r"]
    ext = act["EDC2_r"] + act["EIP_r"]
    assert flex > 0.05 and flex > 5 * ext, (flex, ext)


def test_pipeline_summary_lists_assumptions_and_no_cci():
    _need_twin()
    from core.twin.pipeline import TwinFrame, run, summarise
    frames = [TwinFrame(t=k * 0.01, angles=retarget.bend_to_angles({"index": 0.3, "thumb": 0.3}),
                        forces={"p0": 0.08 * k, "p1": 0.08 * k}, g_hand=retarget.PALM_DOWN)
              for k in range(40)]
    res = run(frames)
    assert res["tau"].shape == (40, 23)
    assert res["activation"]["activation"].shape == (40, 39)
    s = summarise(res)
    assert s["twin_version"] == twin.TWIN_VERSION and s["frames"] == 40
    assert len(s["assumptions"]) >= 5
    assert not any("co_contraction" in k or "cci" in k.lower() for k in s)
    assert s["internal_force_n"]["total"]["max"] > 5.0



def test_cocontraction_pattern_moves_nothing_until_pushed():
    # Forward simulation (core/twin/forward.py): the hold activations come from
    # the inverse twin, so a still hand here also cross-checks that solver.
    _need_twin()
    from core.twin.forward import Sim, push_response
    from core.twin.inverse import muscle_terms
    sim = Sim()
    hm = _hand()
    hm.set_pose(sim.pose)
    net = muscle_terms(hm)["A"] @ sim.pattern
    assert np.abs(net).max() < 1e-3, np.abs(net).max()
    assert set(np.flatnonzero(sim.pattern)) <= {hm.muscles.index(n) for n in sim.group}
    for level in (0.0, 0.6):
        r = push_response(level, sim=sim)
        assert abs(r["drift_deg"]) < 0.2, r


def test_cocontraction_stiffens_the_wrist_in_simulation():
    _need_twin()
    from core.twin.forward import Sim, push_response
    sim = Sim()
    relaxed = push_response(0.0, sim=sim)["peak_deg"]
    tight = push_response(0.5, sim=sim)["peak_deg"]
    assert relaxed > 8.0 and tight < 0.4 * relaxed, (relaxed, tight)

if __name__ == "__main__":
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    failed = skipped = 0
    for fn in fns:
        try:
            fn()
            print(f"  PASS  {fn.__name__}")
        except _Skip as e:
            skipped += 1
            print(f"  SKIP  {fn.__name__}: {e}")
        except AssertionError as e:
            failed += 1
            print(f"  FAIL  {fn.__name__}: {e}")
    print(f"\n{len(fns) - failed - skipped}/{len(fns)} passed, {skipped} skipped")
    sys.exit(1 if failed else 0)
