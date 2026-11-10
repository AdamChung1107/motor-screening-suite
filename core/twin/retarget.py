"""Glove and camera readings → MyoHand joint angles. Pure, no MuJoCo.

docs/glove/DIGITAL_TWIN_PLAN.md §4 ("Retarget") and §5 ("Model fit").

Two sources, each with a known gap:

* **Glove flex.** One strip per finger, along the back of the finger to the
  nail (CAD V4+), so it reads MCP, PIP and DIP bend as ONE number. It is split
  across the three joints by a fixed synergy (:data:`FIST_DEG`): each joint
  takes the same fraction of its full-fist angle. That split is an assumption
  until gate 9 (GLOVE_INTEGRATION_PLAN.md §3) measures it per person on
  camera, and every result built on it says so.
* **Camera landmarks.** MediaPipe's 21 points give each joint separately, but
  unsigned (hyperextension reads as flexion) and only while the finger is
  visible. Where both exist, the camera decides (:func:`merge`).

The wrist, forearm rotation and finger spread are held neutral: the glove has
no sensor across the wrist, and abduction is not read from either source yet.
The IMU on the back of the hand sets **which way gravity points in the hand**
instead (:data:`HAND_FRAME`), which is what the joint torques need.

Raw values in, no smoothing (CLAUDE.md guardrail 4).
"""

from __future__ import annotations

import math
from typing import Mapping, Sequence

#: Digits in glove order, thumb to little. Flex channel f0..f4 and fingertip
#: force channel p0..p3 follow the same order (the little finger has no FSR).
DIGITS = ("thumb", "index", "middle", "ring", "little")
FLEX_CHANNEL = {d: f"f{i}" for i, d in enumerate(DIGITS)}

#: MyoHand flexion joints per digit, proximal to distal.
DIGIT_JOINTS = {
    "thumb":  ("cmc_flexion_r", "mp_flexion_r", "ip_flexion_r"),
    "index":  ("mcp2_flexion_r", "pm2_flexion_r", "md2_flexion_r"),
    "middle": ("mcp3_flexion_r", "pm3_flexion_r", "md3_flexion_r"),
    "ring":   ("mcp4_flexion_r", "pm4_flexion_r", "md4_flexion_r"),
    "little": ("mcp5_flexion_r", "pm5_flexion_r", "md5_flexion_r"),
}

#: MyoHand's thumb flexes with NEGATIVE angles (its ranges run to -0.78,
#: -0.79 and -1.31 rad, and a negative angle brings the thumb tip toward the
#: index tip); the fingers flex positive. Measured on the model 2026-11-09.
FLEX_SIGN = {"thumb": -1.0, "index": 1.0, "middle": 1.0, "ring": 1.0, "little": 1.0}

#: Joint angles at a full fist, degrees, proximal to distal: the fixed synergy
#: the single flex strip is split by. Typical active ranges, held inside
#: MyoHand's limits (90 degrees for every finger joint). PROVISIONAL until
#: gate 9 measures the split per person.
FIST_DEG = {
    "thumb":  (15.0, 45.0, 70.0),
    "index":  (85.0, 90.0, 70.0),
    "middle": (85.0, 90.0, 70.0),
    "ring":   (85.0, 90.0, 70.0),
    "little": (85.0, 90.0, 70.0),
}

#: The frame a gravity direction is given in, for :func:`gravity_world` in
#: core.twin.model: x toward the thumb side (radial), y toward the fingertips
#: (distal), z out of the palm (palmar). Unit vectors, so a few named poses:
HAND_FRAME = ("radial", "distal", "palmar")
PALM_DOWN = (0.0, 0.0, 1.0)     # gravity leaves through the palm
PALM_UP = (0.0, 0.0, -1.0)
THUMB_UP = (-1.0, 0.0, 0.0)     # handshake; the Jamar grip posture
FINGERS_UP = (0.0, -1.0, 0.0)

#: MediaPipe hand landmark indices: wrist, then four per digit, base to tip.
LM_WRIST = 0
LM_DIGIT = {"thumb": (1, 2, 3, 4), "index": (5, 6, 7, 8),
            "middle": (9, 10, 11, 12), "ring": (13, 14, 15, 16),
            "little": (17, 18, 19, 20)}


def bend_to_angles(bend: Mapping[str, float | None],
                   fist_deg: Mapping[str, Sequence[float]] = FIST_DEG) -> dict[str, float]:
    """Glove bend fractions (0 flat .. 1 full fist) → joint angles in radians.

    ``bend`` is keyed by digit name or flex channel (``"index"`` or ``"f1"``).
    A missing or None digit is left out, not set to zero: an absent strip is
    not a straight finger. Fractions outside 0..1 are clipped, because the
    span they come from is itself uncalibrated (core/glove/flex.py).
    """
    out: dict[str, float] = {}
    for digit in DIGITS:
        b = bend.get(digit, bend.get(FLEX_CHANNEL[digit]))
        if b is None or not math.isfinite(b):
            continue
        b = min(1.0, max(0.0, float(b)))
        for joint, deg in zip(DIGIT_JOINTS[digit], fist_deg[digit]):
            out[joint] = FLEX_SIGN[digit] * math.radians(deg) * b
    return out


def _angle(u: Sequence[float], v: Sequence[float]) -> float | None:
    """Unsigned angle between two vectors, radians; None for a zero vector."""
    nu = math.sqrt(sum(x * x for x in u))
    nv = math.sqrt(sum(x * x for x in v))
    if nu < 1e-9 or nv < 1e-9:
        return None
    c = sum(a * b for a, b in zip(u, v)) / (nu * nv)
    return math.acos(max(-1.0, min(1.0, c)))


def _sub(a: Sequence[float], b: Sequence[float]) -> tuple[float, ...]:
    return tuple(x - y for x, y in zip(a, b))


def landmarks_to_angles(lm: Sequence[Sequence[float]]) -> dict[str, float]:
    """MediaPipe's 21 landmarks → flexion angles in radians, per joint.

    Each joint's flexion is the angle between the segment before it and the
    segment after it, so a straight finger reads 0. Use world landmarks
    (metres) when available; image landmarks with z = 0 work but foreshorten
    any bend toward the camera. The thumb's CMC is left out: its landmark
    angle does not correspond to MyoHand's CMC flexion axis.
    """
    if len(lm) < 21:
        raise ValueError(f"need 21 landmarks, got {len(lm)}")
    p = [tuple(float(c) for c in pt[:3]) + (0.0,) * (3 - len(pt[:3])) for pt in lm]
    out: dict[str, float] = {}
    for digit in DIGITS:
        a, b, c, d = (p[i] for i in LM_DIGIT[digit])
        joints = DIGIT_JOINTS[digit]
        if digit == "thumb":
            pairs = ((joints[1], _sub(b, a), _sub(c, b)),
                     (joints[2], _sub(c, b), _sub(d, c)))
        else:
            meta = _sub(a, p[LM_WRIST])
            pairs = ((joints[0], meta, _sub(b, a)),
                     (joints[1], _sub(b, a), _sub(c, b)),
                     (joints[2], _sub(c, b), _sub(d, c)))
        for joint, u, v in pairs:
            ang = _angle(u, v)
            if ang is not None:
                out[joint] = FLEX_SIGN[digit] * ang
    return out


def merge(camera: Mapping[str, float] | None,
          glove: Mapping[str, float] | None) -> dict[str, float]:
    """Camera angles where the camera has them, glove angles elsewhere."""
    out = dict(glove or {})
    out.update(camera or {})
    return out


def source_of(camera: Mapping[str, float] | None,
              glove: Mapping[str, float] | None) -> dict[str, str]:
    """Which source each joint's angle came from, for the record (plan §5)."""
    src = {j: "glove" for j in (glove or {})}
    src.update({j: "camera" for j in (camera or {})})
    return src
