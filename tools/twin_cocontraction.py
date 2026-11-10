#!/usr/bin/env python3
"""
Simulate co-contraction on MyoHand in MuJoCo: drive the wrist's flexors and
extensors together, push the hand, and watch how far the wrist gives.

    .venv/Scripts/python tools/twin_cocontraction.py            # the numbers
    .venv/Scripts/python tools/twin_cocontraction.py --view     # live 3D window
    .venv/Scripts/python tools/twin_cocontraction.py --video cocontraction.webp

Needs ``python install.py --twin``. Plan: docs/glove/DIGITAL_TWIN_PLAN.md §4b.

**Live window keys:** Up / Down raise or lower the co-contraction level by
0.1; Space pushes the palm (4 N for 0.3 s); R resets the hand. Muscles turn
from grey-pink to red with activation. Mouse: the usual MuJoCo viewer (drag
to orbit, right-drag to pan, scroll to zoom).

This is a simulation of what co-contraction does to a hand. The level is
set here; it is not read from anyone (core/twin/forward.py).
"""

from __future__ import annotations

import argparse
import math
import sys
import time
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(_REPO_ROOT))

from core import twin  # noqa: E402

LEVELS = (0.0, 0.1, 0.2, 0.4, 0.7)
PUSH_N = 4.0
PUSH_S = 0.3


def table() -> None:
    from core.twin.forward import Sim, push_response
    sim = Sim()
    print(f"Wrist co-contraction against a {PUSH_N:.0f} N push on the palm "
          f"({PUSH_S:.1f} s), thumb-up posture:\n")
    print("  level   moves before the push   wrist gives   left bent after")
    for c in LEVELS:
        r = push_response(c, PUSH_N, push_s=PUSH_S, sim=sim)
        print(f"  {c:4.1f}    {r['drift_deg']:+6.2f} deg              "
              f"{r['peak_deg']:5.1f} deg     {r['end_offset_deg']:+6.1f} deg")
    pat = {n[:-2]: round(float(sim.pattern[sim.m.actuator(n).id]), 2) for n in sim.group}
    print(f"\nPattern at level 1 (zero net torque at every joint): {pat}")
    print("The level is an input to the simulation, not a reading of anyone.")


def _camera(sim, mujoco):
    """Look down on the thumb side so wrist bend sweeps across the picture."""
    from core.twin.model import load
    hm = load()
    hm.set_pose(sim.pose)
    distal = hm.hand_frame()[:, 1]
    cam = mujoco.MjvCamera()
    cam.type = mujoco.mjtCamera.mjCAMERA_FREE
    wrist = sim.d.xpos[sim.m.body("lunate_r").id]
    cam.lookat[:] = wrist + 0.07 * distal
    cam.distance = 0.27
    cam.azimuth = math.degrees(math.atan2(distal[0], -distal[1]))
    cam.elevation = -35.0
    return cam


def _add_arrow(scene, mujoco, tail, head, rgba=(1.0, 0.78, 0.2, 1.0), width=0.006):
    if scene.ngeom >= scene.maxgeom:
        return
    g = scene.geoms[scene.ngeom]
    mujoco.mjv_initGeom(g, mujoco.mjtGeom.mjGEOM_ARROW, [0, 0, 0], [0, 0, 0],
                        [1, 0, 0, 0, 1, 0, 0, 0, 1], list(rgba))
    mujoco.mjv_connector(g, mujoco.mjtGeom.mjGEOM_ARROW, width, tail, head)
    scene.ngeom += 1


HELP = ("Up / Down: co-contraction +/- 0.1", "Space: push the palm (4 N)", "R: reset")
LINE_PX = 30


def _add_label(scene, mujoco, pos, text):
    if scene.ngeom >= scene.maxgeom:
        return
    g = scene.geoms[scene.ngeom]
    mujoco.mjv_initGeom(g, mujoco.mjtGeom.mjGEOM_LABEL, [0, 0, 0], pos,
                        [1, 0, 0, 0, 1, 0, 0, 0, 1], [1, 1, 1, 1])
    g.label = text
    scene.ngeom += 1


def _add_overlay(scene, mujoco, cam, fovy_deg, width, height, lines):
    """Text pinned to the window's top-left corner: labels placed on the plane
    through the camera's look-at point, recomputed from the live camera.

    Not ``Handle.set_texts``: that waits for the render thread to draw a
    frame, and with it in the loop the window froze (2026-11-10)."""
    import numpy as np
    az, el = math.radians(cam.azimuth), math.radians(cam.elevation)
    fwd = np.array([math.cos(el) * math.cos(az), math.cos(el) * math.sin(az), math.sin(el)])
    up = np.array([-math.sin(el) * math.cos(az), -math.sin(el) * math.sin(az), math.cos(el)])
    right = np.cross(fwd, up)
    half_h = cam.distance * math.tan(math.radians(fovy_deg) / 2)
    px = 2 * half_h / height                       # metres per pixel on that plane
    left = np.asarray(cam.lookat) - right * (half_h * width / height - 16 * px)
    for i, text in enumerate(lines):
        if text:
            _add_label(scene, mujoco, left + up * (half_h - (28 + i * LINE_PX) * px), text)


def _overlay_lines(sim, peak):
    return (f"Co-contraction  {sim.level:.1f}",
            f"Wrist bend  {sim.angle_deg():+.1f} deg",
            f"Last push gave  {peak:.1f} deg", "") + HELP


def view() -> None:
    import mujoco
    import mujoco.viewer
    from core.twin.forward import Sim

    print("Loading MyoHand and working out the holding activations "
          "(5-15 s; the window opens after) ...", flush=True)
    sim = Sim()
    # The stock scene took ~180 ms a frame on Iris Xe (5 fps; worse full
    # screen): the shadow pass and the floor and skin reflections draw all
    # ~300 muscle segments twice more. Without them ~40 ms (2026-11-10).
    # Rendering only; the physics is untouched.
    sim.m.light_castshadow[:] = 0
    sim.m.mat_reflectance[:] = 0
    keys = []
    UP, DOWN, SPACE, R = 265, 264, 32, 82

    def on_key(code: int) -> None:
        keys.append(code)

    with mujoco.viewer.launch_passive(sim.m, sim.d, key_callback=on_key,
                                      show_left_ui=False, show_right_ui=False) as v:
        print("Window open. Up / Down: co-contraction, Space: push, R: reset. "
              "Close the window to quit.", flush=True)
        cam = _camera(sim, mujoco)
        v.cam.lookat[:] = cam.lookat
        v.cam.distance, v.cam.azimuth, v.cam.elevation = cam.distance, cam.azimuth, cam.elevation
        start_wall, start_sim = time.perf_counter(), sim.time
        peak, base = 0.0, sim.angle_deg()
        while v.is_running():
            while keys:
                k = keys.pop(0)
                with v.lock():
                    if k == UP:
                        sim.set_level(round(sim.level + 0.1, 2))
                    elif k == DOWN:
                        sim.set_level(round(sim.level - 0.1, 2))
                    elif k == SPACE and not sim.pushing:
                        base, peak = sim.angle_deg(), 0.0
                        sim.push(PUSH_N, PUSH_S)
                    elif k == R:
                        sim.reset()
                        base, peak = sim.angle_deg(), 0.0
                        start_wall, start_sim = time.perf_counter(), sim.time
            # Real time: step until the simulation catches the wall clock.
            target = start_sim + (time.perf_counter() - start_wall)
            with v.lock():
                n = 0
                while sim.time < target and n < 50:
                    sim.step()
                    peak = max(peak, abs(sim.angle_deg() - base))
                    n += 1
                if n == 50:                           # fell behind: do not spiral
                    start_wall, start_sim = time.perf_counter(), sim.time
                sim.colour_muscles()
                v.user_scn.ngeom = 0
                if sim.pushing:
                    _add_arrow(v.user_scn, mujoco, *sim.push_arrow())
                vp = v.viewport
                w, h = ((vp.width, vp.height) if vp is not None and vp.width > 0 and vp.height > 0
                        else (1600, 900))
                _add_overlay(v.user_scn, mujoco, v.cam, sim.m.vis.global_.fovy, w, h,
                             _overlay_lines(sim, peak))
            v.sync()
            time.sleep(0.004)


def video(path: Path, level: float, fps: int = 30, slow: float = 2.0) -> None:
    import mujoco
    import numpy as np
    from PIL import Image, ImageDraw, ImageFont
    from core.twin.forward import Sim

    W, H = 560, 440
    sims = [Sim(), Sim()]
    sims[0].reset(0.0)
    sims[1].reset(level)
    rend = mujoco.Renderer(sims[0].m, H, W)
    rend2 = mujoco.Renderer(sims[1].m, H, W)
    cam = _camera(sims[0], mujoco)
    dt = sims[0].m.opt.timestep
    per_frame = max(1, int(round(1.0 / (fps * slow) / dt)))
    settle, push_at, end = 0.3, 0.3, 1.5
    for s in sims:
        s.step(int(round(settle / dt)))
    base = [s.angle_deg() for s in sims]
    peak = [0.0, 0.0]
    try:
        font = ImageFont.truetype("arial.ttf", 20)
        small = ImageFont.truetype("arial.ttf", 15)
    except OSError:
        font = small = ImageFont.load_default()
    frames = []
    t = 0.0
    pushed = False
    while t < end:
        if not pushed and t >= push_at:
            for s in sims:
                s.push(PUSH_N, PUSH_S)
            pushed = True
        tiles = []
        for k, (s, r) in enumerate(zip(sims, (rend, rend2))):
            s.colour_muscles()
            r.update_scene(s.d, camera=cam)
            if s.pushing:
                _add_arrow(r.scene, mujoco, *s.push_arrow())
            img = Image.fromarray(r.render())
            dr = ImageDraw.Draw(img)
            title = "Relaxed" if k == 0 else "Co-contracting"
            dr.rectangle([0, 0, W, 64], fill=(11, 16, 32))
            dr.text((14, 8), f"{title}  ·  level {s.level:.1f}", font=font, fill=(245, 247, 250))
            peak[k] = max(peak[k], abs(s.angle_deg() - base[k]))
            dr.text((14, 36), f"wrist gives {peak[k]:4.1f} deg"
                    + ("   ← 4 N push" if s.pushing else ""), font=small, fill=(184, 190, 208))
            tiles.append(np.asarray(img))
        frames.append(Image.fromarray(np.hstack([tiles[0], np.full((H, 6, 3), 11, np.uint8), tiles[1]])))
        for s in sims:
            s.step(per_frame)
        t += per_frame * dt
    frames += [frames[-1]] * fps                     # hold the last frame a second
    path.parent.mkdir(parents=True, exist_ok=True)
    kw = dict(save_all=True, append_images=frames[1:], duration=int(1000 / fps), loop=0)
    if path.suffix.lower() == ".webp":
        frames[0].save(path, quality=80, method=0, **kw)
    else:
        frames[0].save(path, **kw)
    print(f"Wrote {len(frames)} frames ({slow:g}x slow motion) to {path}")
    print(f"Wrist gave {peak[0]:.1f} deg relaxed, {peak[1]:.1f} deg at level {level:.1f}.")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--view", action="store_true", help="open the live MuJoCo window")
    ap.add_argument("--video", type=Path, help="render relaxed vs co-contracting (.webp or .gif)")
    ap.add_argument("--level", type=float, default=0.5, help="co-contraction level for --video")
    args = ap.parse_args()
    if not twin.available():
        print(twin.missing_message())
        return 2
    if args.view:
        view()
    elif args.video:
        video(args.video, args.level)
    else:
        table()
    return 0


if __name__ == "__main__":
    sys.exit(main())
