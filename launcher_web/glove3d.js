/* ── Glove map: every glove channel drawn where it sits on a 3D hand ──────
   ES module (three.js), a sibling of hand3d.js, on the Developer page.

   It owns NO sensor maths. Each tick it reads window.devGloveSnapshot() from
   dev.js, which runs the same force/bend conversions as the channel tiles, so
   the map can never show a number a tile does not. This file only decides
   WHERE a channel sits, and how that looks.

   Layout: docs/glove/GLOVE_EXPANSION_PLAN.md §4 (decided 2026-09-21) —
   flex f0-f4 on the backs of thumb..pinky (f4 added with fw 0.10.0), FSR402
   p0-p3 on the thumb..ring tips, FlexiForce A401 h0-h2 on the thenar,
   hypothenar and distal palm, and the IMU (an MPU6050 since fw 0.10.0) on
   the back of the hand. Sites are matched by CHANNEL NAME from the banner.

   Look (redesigned 2026-11-09, GLOVE_FIRMWARE_PLAN.md §7b): nothing is laid
   over the hand. Force is heat drawn INTO the hand's own material, a warm
   glow on the fingertip (and palm, if pads are ever fitted). Bend fills a
   thin strip on the back of each finger, and its % sits just past the tip.
   The IMU is a small chip with no number. A site with no sensor fitted draws
   nothing. Values, statuses and the peak since Z are left to the channel
   tiles; the side list that repeated them was removed on 2026-11-09, and
   that column now holds the simulated glove's keys while it runs (dev.js).

   Motion: the board's raw 100 Hz accelerometer + gyro are fused into an
   orientation (glove_fusion.js), mapped onto the hand through a two-pose
   mounting calibration, and drive the whole hand; flex drives the fingers.

   The model is assets/models/hand.gltf (the same rigged hand the home page shows).
   Its bones point along local +Y and curl about local +Z — read off the
   model's own "OK hand" pose (CURL_SIGN below). */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as fusionLib from './glove_fusion.js';

const stage   = document.getElementById('g3d-stage');
const canvas  = document.getElementById('g3d-canvas');
const tagsEl  = document.getElementById('g3d-tags');
const viewsEl = document.getElementById('g3d-views');
const emptyEl = document.getElementById('g3d-empty');
if (!stage || !canvas) throw new Error('glove map elements missing');

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* i18n.js is a classic script; reach its translator through window. Never
   bind it to a bare `t` here, which is the name every loop wants. */
const tr = (s, p) => {
  if (window.t) return window.t(s, p);
  return p ? s.replace(/\{(\w+)\}/g, (m, k) => (k in p ? p[k] : m)) : s;
};

/* ── where each channel lives ─────────────────────────────────────────── */

const FINGER_BONES = {
  thumb:  ['thumb_meta_18', 'thumb_prox_17', 'thumb_dist_16'],
  index:  ['index_prox_14', 'index_midd_13', 'index_dist_12'],
  middle: ['midd_prox_10',  'midd_midd_9',   'midd_dist_8'],
  ring:   ['ring_prox_6',   'ring_midd_5',   'ring_dist_4'],
  pinky:  ['pinky_prox_2',  'pinky_midd_1',  'pinky_dist_0'],
};

/* Joint flexion at 100 % bend, radians, per bone above. ILLUSTRATIVE: flex.py
   reports a position within a recorded span, never degrees (plan §5c), so
   these only decide how a full-span reading looks. */
const CURL = {
  thumb:  [0.30, 0.75, 1.00],
  finger: [1.25, 1.50, 1.05],
};

/* Offsets in the model's bone units (a middle-finger proximal phalanx is
   ~2.8 units, so one unit is roughly 1.6 cm of real hand). */
const TIP_U      = 0.72;   // heat centre along the distal bone
const TIP_DEPTH  = 0.18;   // ...just palmar of the bone: inside the fingertip, pad side
const TIP_R      = 0.50;   // heat radius, as a share of the distal bone's length
const PALM_DEPTH = 0.70;   // palm heat centre, just under the palm skin (was 0.95 for a disc above it)
const PALM_R     = 1.00;   // palm heat radius (an A401 pad is ~1.6 units across)
const BACK_DEPTH = 0.55;   // flex strip, above the finger
const LABEL_U    = 1.60;   // flex % label, along the distal bone past the tip
const IMU_DEPTH  = 1.05;   // board, on the back of the hand

/* `at` is [bone, fraction along it] for finger sites. Palm sites are blends of
   two such points, because the thenar pad lies between two bones. */
const SITES = [
  {name: 'p0', kind: 'fsr', group: 'tip',  site: 'thumb tip',  at: ['thumb_dist_16', TIP_U]},
  {name: 'p1', kind: 'fsr', group: 'tip',  site: 'index tip',  at: ['index_dist_12', TIP_U]},
  {name: 'p2', kind: 'fsr', group: 'tip',  site: 'middle tip', at: ['midd_dist_8',   TIP_U]},
  {name: 'p3', kind: 'fsr', group: 'tip',  site: 'ring tip',   at: ['ring_dist_4',   TIP_U]},
  {name: 'h0', kind: 'flexiforce', group: 'palm', site: 'thenar (thumb base)',
   blend: [['thumb_meta_18', 0.15], ['index_meta_15', 0.30], 0.45]},
  {name: 'h1', kind: 'flexiforce', group: 'palm', site: 'hypothenar (heel)',
   blend: [['pinky_meta_3', 0.35], ['ring_meta_7', 0.35], 0.25]},
  {name: 'h2', kind: 'flexiforce', group: 'palm', site: 'distal palm',
   blend: [['index_meta_15', 0.82], ['ring_meta_7', 0.82], 0.50]},
  {name: 'f0', kind: 'flex', group: 'flex', site: 'thumb',  finger: 'thumb'},
  {name: 'f1', kind: 'flex', group: 'flex', site: 'index',  finger: 'index'},
  {name: 'f2', kind: 'flex', group: 'flex', site: 'middle', finger: 'middle'},
  {name: 'f3', kind: 'flex', group: 'flex', site: 'ring',   finger: 'ring'},
  {name: 'f4', kind: 'flex', group: 'flex', site: 'pinky',  finger: 'pinky'},
];

/* ── colours (tokens from styles.css :root) ──────────────────────────────
   Two scales that never share a hue: force is warm (--hand-glow, the home
   hero's glow, running paler toward --warm-light under a hard press), bend is
   the cool brand ramp. Grey (--text-disabled) marks a bend read against its
   placeholder span. "Beyond rated" is said in words in the list, not in
   colour on the hand (style guide 2.4).
   palette.js can re-derive the tokens. The shader uniforms hold these Color
   objects by reference, so readColours() updating them in place recolours
   the heat, rim and strips; syncColours() reaches the materials that copied
   a colour once. */
const RAMP = [new THREE.Color('#2A2E7A'), new THREE.Color('#7C83FD'), new THREE.Color('#D5D7FF')];
const C_GHOST = new THREE.Color('#8089A6');
const C_HAND  = new THREE.Color('#A3ABC8');
const C_HEAT  = new THREE.Color('#FF8F66');
const C_HEAT_CORE = new THREE.Color('#FFB59C');
const C_SLAB  = new THREE.Color('#1A2236');
const C_SLAB_GLOW = new THREE.Color('#5F66E8');
const handMats = [];
function token(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return /^#[0-9a-f]{6}$/i.test(v) ? v : fallback;
}
function readColours() {
  RAMP[0].set(token('--glove-lo', '#2A2E7A'));
  RAMP[1].set(token('--brand', '#7C83FD'));
  RAMP[2].set(token('--glove-hi', '#D5D7FF'));
  C_GHOST.set(token('--text-disabled', '#8089A6'));
  C_HAND.set(token('--glove-hand', '#A3ABC8'));
  C_HEAT.set(token('--hand-glow', '#FF8F66'));
  C_HEAT_CORE.set(token('--warm-light', '#FFB59C'));
  C_SLAB.set(token('--surface-2', '#1A2236'));
  C_SLAB_GLOW.set(token('--brand-strong', '#5F66E8'));
}
readColours();
/* Runs only from the event, after the whole module (rim, imuSite) exists. */
function syncColours() {
  readColours();
  handMats.forEach(m => m.color.copy(C_HAND));
  rim.color.copy(RAMP[1]);
  if (imuSite) {
    imuSite.chip.material.color.copy(C_SLAB);
    imuSite.chip.material.emissive.copy(C_SLAB_GLOW);
    imuSite.edge.material.color.copy(RAMP[1]);
  }
}
addEventListener('hub:palette-live', syncColours);
function ramp(x, out) {
  x = Math.max(0, Math.min(1, x));
  return x < 0.5 ? out.lerpColors(RAMP[0], RAMP[1], x * 2)
                 : out.lerpColors(RAMP[1], RAMP[2], (x - 0.5) * 2);
}

/* ── the hand's material: fresnel glass with heat in the skin ────────────
   A patch on MeshStandardMaterial (three r164 chunk names). The vertex
   stage hands the fragment its SKINNED world position, so the heat follows
   bent fingers and the mirror/tilt groups. Each heat site is a world-space
   centre, a radius and an amount (0..1); the strongest site wins per
   fragment, so two neighbouring tips never add into a false hot spot. A
   glowing patch also turns opaque, so a pressed tip reads as lit skin from
   either side of the glass. The fresnel term thins the glass in the middle
   and firms up the silhouette. */
const HEAT_N = 7;                        // p0-p3 + h0-h2
const heatU = {
  uHeatPos:  {value: Array.from({length: HEAT_N}, () => new THREE.Vector3())},
  uHeatAmt:  {value: new Array(HEAT_N).fill(0)},
  uHeatR:    {value: new Array(HEAT_N).fill(1)},
  uHeatHot:  {value: C_HEAT},
  uHeatCore: {value: C_HEAT_CORE},
  uRimCol:   {value: C_HAND},
};
const HAND_OPACITY = 0.16;               // glass, face-on; the rim adds up to +0.5
function glovePatch(shader) {
  Object.assign(shader.uniforms, heatU);
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vHeatW;')
    .replace('#include <project_vertex>',
      '#include <project_vertex>\n  vHeatW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>
#define GLOVE_HEAT_N ${HEAT_N}
varying vec3 vHeatW;
uniform vec3 uHeatPos[GLOVE_HEAT_N];
uniform float uHeatAmt[GLOVE_HEAT_N];
uniform float uHeatR[GLOVE_HEAT_N];
uniform vec3 uHeatHot;
uniform vec3 uHeatCore;
uniform vec3 uRimCol;`)
    .replace('#include <opaque_fragment>', `
  float gFr = pow(1.0 - clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0), 2.2);
  outgoingLight = mix(outgoingLight, uRimCol, 0.35 * gFr);
  diffuseColor.a = clamp(diffuseColor.a + 0.5 * gFr, 0.0, 1.0);
  float gW = 0.0, gA = 0.0;
  for (int i = 0; i < GLOVE_HEAT_N; i++) {
    vec3 d = vHeatW - uHeatPos[i];
    float w = uHeatAmt[i] * exp(-dot(d, d) / (uHeatR[i] * uHeatR[i]));
    if (w > gW) { gW = w; gA = uHeatAmt[i]; }
  }
  outgoingLight = mix(outgoingLight, mix(uHeatHot, uHeatCore, 0.6 * gA * gA), gW);
  diffuseColor.a = max(diffuseColor.a, 0.92 * gW);
#include <opaque_fragment>`);
}

/* A flex strip: a faint full-length track, and a fill from the knuckle out to
   the bend fraction. `aT` is the position along the strip, 0 at the knuckle
   and 1 at the tip (TubeGeometry's uv.x, copied by tubeGeometry() into an
   attribute of our own so it never depends on three's built-in uv). */
function tubeGeometry(pts) {
  const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 28, 0.0019, 8, false);
  const uv = g.getAttribute('uv');
  const tAlong = new Float32Array(uv.count);
  for (let i = 0; i < uv.count; i++) tAlong[i] = uv.getX(i);
  g.setAttribute('aT', new THREE.BufferAttribute(tAlong, 1));
  return g;
}
function stripMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {uTrack: {value: RAMP[1]}, uFill: {value: new THREE.Color()}, uAmt: {value: 0}},
    vertexShader: `attribute float aT; varying float vU;
      void main() { vU = aT; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 uTrack; uniform vec3 uFill; uniform float uAmt; varying float vU;
      void main() {
        float e = fwidth(vU) * 1.5;
        float on = uAmt <= 0.0 ? 0.0 : 1.0 - smoothstep(uAmt - e, uAmt + e, vU);
        float a = mix(0.22, 0.95, on) * smoothstep(0.0, 0.05, vU) * (1.0 - smoothstep(0.95, 1.0, vU));
        gl_FragColor = vec4(mix(uTrack, uFill, on), a);
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false,
  });
}

/* ── scene ───────────────────────────────────────────────────────────── */

const scene  = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 10);
/* Slightly above, looking down at the hand: reads both a raised hand and one
   lying flat, which are the two calibration poses. */
const CAM_HOME = new THREE.Vector3(0, 0.26, 0.74);
camera.position.copy(CAM_HOME);

let renderer = null, controls = null;
const tiltG = new THREE.Group();          // IMU orientation: hand + anchors
scene.add(tiltG);
/* The rig is a LEFT hand (palm to the camera, thumb on screen-left). A right
   glove mirrors it here, below the orientation, so the IMU maths never sees
   the flip: calibration measures hand axes geometrically (x = fingers x palm),
   which lands on the thumb side of a right hand and the little-finger side of
   a left one — exactly where the mirrored and unmirrored rig put them. */
const mirrorG = new THREE.Group();
tiltG.add(mirrorG);
const markers = new THREE.Group();        // world-space strips and the IMU chip
scene.add(markers);

scene.add(new THREE.AmbientLight(0xffffff, 0.75));
const keyLight = new THREE.DirectionalLight(0xffffff, 0.9);
keyLight.position.set(0.6, 1, 1.2);
scene.add(keyLight);
const rim = new THREE.DirectionalLight(RAMP[1], 0.5);
rim.position.set(-1, 0.4, -1);
scene.add(rim);

/* ── state ───────────────────────────────────────────────────────────── */

let loaded = false, loading = false, failed = false;
let running = false, raf = null, emptyTimer = null;
let follow = true;                       // hand follows the IMU (default mount until calibrated)
let handSide = 'right';                  // which hand the glove is on
const fusion = fusionLib.createFusion();
const _qShow = new THREE.Quaternion();
const STORE_KEY = 'hand3d.gloveMount';
/* One saved mount PER IMU, by the name the banner gives it. A mount describes
   how ONE chip sits on the hand, so a calibration from the board's onboard IMU
   is wrong for the MPU6050 strapped to the back of the hand, and the simulated
   glove (imu=sim) has a mount of its own. Switching chips switches mounts;
   it never throws the other one away. Stored as {hand, mounts: {imu: q}}; the
   older {mount, imu} shape is read as a single entry. */
let mountImu = null;
let mounts = {};
try {
  const saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
  if (saved) {
    if (saved.mounts && typeof saved.mounts === 'object') mounts = saved.mounts;
    else if (saved.mount && saved.imu) mounts = {[saved.imu]: saved.mount};
    if (saved.hand === 'left' || saved.hand === 'right') handSide = saved.hand;
  }
} catch (e) { /* private window or blocked storage: start uncalibrated */ }
function saveMount() {
  if (mountImu) {
    const m = fusionLib.exportMount(fusion);
    if (m) mounts[mountImu] = m; else delete mounts[mountImu];
  }
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({mounts, hand: handSide}));
  } catch (e) { /* not fatal: the calibration just will not survive a reload */ }
}
function checkMountImu(name) {
  if (!name || mountImu === name) return;
  mountImu = name;
  fusion.mount = null;
  fusionLib.importMount(fusion, mounts[name]);
  fusion.heading = null;                 // re-taken from this chip's mount
  renderViews();
}
let unit = 1;                            // world units per bone unit
/* Which way about local Z is flexion. Not measurable from the rig alone (a
   trial rotation moves the tip toward -X whichever way is "real"), so it is
   read off the model's own Pose_OK clip: index_midd sits at +0.64 rad about Z
   there, ~79°, and a PIP joint cannot hyperextend 79°. So +Z curls, and a
   curling tip moves toward the bone's -X side — the palmar side. */
const CURL_SIGN = 1;
const bones = {};                        // name -> Bone
const rest = {};                         // name -> rest quaternion
const bend = {};                         // finger -> smoothed 0..1
const sites = [];                        // runtime per site
let imuSite = null;
let snap = null;                         // last devGloveSnapshot()

const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _z = new THREE.Vector3(0, 0, 1);

/* ── model ───────────────────────────────────────────────────────────── */

function boneLength(b) {
  const child = b.children.find(c => c.isBone);
  if (child) return child.position.length();
  return 0.75 * b.position.length();     // distal bone: no child, estimate
}

/* An Object3D riding on a bone, at `u` of its length, pushed `depth` along
   local X (palmar = -CURL_SIGN, dorsal = +CURL_SIGN). It follows the finger as
   it bends, which is the whole reason sites are bone children. */
function anchorOn(boneName, u, depth) {
  const b = bones[boneName];
  const a = new THREE.Object3D();
  a.position.set(depth, u * boneLength(b), 0);
  b.add(a);
  return a;
}

function onModel(gltf) {
  const model = gltf.scene;
  model.traverse(o => {
    if (o.isBone) { bones[o.name] = o; rest[o.name] = o.quaternion.clone(); }
    if (o.isMesh) {
      o.frustumCulled = false;           // bent fingers leave the bind-pose bounds
      /* A glass hand: a strip on the far side stays visible, and the heat
         glows through. depthWrite off so it never occludes. */
      o.material = new THREE.MeshStandardMaterial({
        color: C_HAND, roughness: 0.55, metalness: 0.0,
        transparent: true, opacity: HAND_OPACITY, depthWrite: false, side: THREE.DoubleSide,
      });
      o.material.onBeforeCompile = glovePatch;
      o.material.customProgramCacheKey = () => 'glove-heat';
      handMats.push(o.material);
      o.renderOrder = 1;
    }
  });
  const need = ['radius_ulna_20', 'midd_meta_11', 'midd_prox_10', ...Object.values(FINGER_BONES).flat()];
  if (need.some(n => !bones[n])) { fail('rig'); return; }

  const align = new THREE.Group(), pivot = new THREE.Group();
  align.add(model); pivot.add(align); mirrorG.add(pivot);
  pivot.updateMatrixWorld(true);

  /* Stand the hand up, palm to the camera: fingers along +Y, palm normal +Z.
     The palm normal is the way a finger moves when it curls, so it is taken
     from a trial curl of the middle finger rather than from the rig's axes —
     the rig could be a left or a right hand. */
  const wrist = bones.radius_ulna_20.getWorldPosition(new THREE.Vector3());
  const knuckle = bones.midd_prox_10.getWorldPosition(new THREE.Vector3());
  const up = knuckle.clone().sub(wrist).normalize();
  const tip0 = bones.midd_dist_8.getWorldPosition(new THREE.Vector3());
  const midd = bones.midd_prox_10;
  midd.quaternion.multiply(_q.setFromAxisAngle(_z, CURL_SIGN * 0.6));
  pivot.updateMatrixWorld(true);
  const tip1 = bones.midd_dist_8.getWorldPosition(new THREE.Vector3());
  midd.quaternion.copy(rest.midd_prox_10);
  pivot.updateMatrixWorld(true);
  const palm = tip1.sub(tip0);
  palm.addScaledVector(up, -palm.dot(up)).normalize();
  const right = new THREE.Vector3().crossVectors(up, palm).normalize();
  const basis = new THREE.Matrix4().makeBasis(right, up, palm);
  align.quaternion.setFromRotationMatrix(basis).invert();
  pivot.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(pivot, true);
  const size = box.getSize(new THREE.Vector3());
  const s = 0.30 / Math.max(size.x, size.y, size.z);
  const centre = box.getCenter(new THREE.Vector3());
  pivot.scale.setScalar(s);
  pivot.position.copy(centre).multiplyScalar(-s);
  pivot.updateMatrixWorld(true);

  unit = bones.midd_prox_10.getWorldPosition(new THREE.Vector3())
    .distanceTo(bones.midd_meta_11.getWorldPosition(new THREE.Vector3()))
    / boneLength(bones.midd_meta_11);

  buildSites();
  applyHand();
  loaded = true; loading = false;
  renderEmpty();
}

function buildSites() {
  const palmar = -CURL_SIGN, dorsal = CURL_SIGN;
  let heatSlot = 0;
  for (const def of SITES) {
    /* heat: slot in the shader's arrays (force sites), amt: its eased amount.
       label/labelPos: where a strip's % sits, past the fingertip. */
    const r = {def, anchors: [], heat: -1, amt: 0, tube: null, tubeKey: '',
               label: null, labelPos: new THREE.Vector3()};
    if (def.at) {
      r.anchors.push(anchorOn(def.at[0], def.at[1], palmar * TIP_DEPTH));
      r.heat = heatSlot++;
      heatU.uHeatR.value[r.heat] = TIP_R * boneLength(bones[def.at[0]]) * unit;
    } else if (def.blend) {
      /* Two points, blended in world space, then parked on the middle
         metacarpal so the pad rides with the palm. The metacarpals are never
         bent, so this stays put. */
      const [[b1, u1], [b2, u2], w] = def.blend;
      const pointOn = (bn, u) => {
        const probe = anchorOn(bn, u, 0);
        const p = probe.getWorldPosition(new THREE.Vector3());
        bones[bn].remove(probe);
        return p;
      };
      const p = pointOn(b1, u1).lerp(pointOn(b2, u2), w);
      p.addScaledVector(new THREE.Vector3(0, 0, 1), PALM_DEPTH * unit);
      const a = new THREE.Object3D();
      a.position.copy(p);
      bones.midd_meta_11.attach(a);
      r.anchors.push(a);
      r.heat = heatSlot++;
      heatU.uHeatR.value[r.heat] = PALM_R * unit;
    } else if (def.finger) {
      /* Five points along the back of the finger, for the strip. */
      const [b0, b1, b2] = FINGER_BONES[def.finger];
      r.anchors.push(anchorOn(b0, 0.10, dorsal * BACK_DEPTH),
                     anchorOn(b0, 0.60, dorsal * BACK_DEPTH),
                     anchorOn(b1, 0.50, dorsal * BACK_DEPTH),
                     anchorOn(b2, 0.30, dorsal * BACK_DEPTH),
                     anchorOn(b2, 0.80, dorsal * BACK_DEPTH));
      r.label = anchorOn(b2, LABEL_U, 0);
      r.tube = new THREE.Mesh(new THREE.BufferGeometry(), stripMaterial());
      r.tube.renderOrder = 2;
      r.tube.visible = false;
      markers.add(r.tube);
      bend[def.finger] = 0;
    }
    sites.push(r);
  }

  /* The board: a small chip on the back of the hand, oriented with the palm.
     Box axes follow the bone: x = thickness, y = along the hand, z = across. */
  const a = anchorOn('midd_meta_11', 0.45, dorsal * IMU_DEPTH);
  const chipGeo = new THREE.BoxGeometry(0.0025, 0.015, 0.011);
  const chip = new THREE.Mesh(chipGeo,
    new THREE.MeshStandardMaterial({color: C_SLAB, emissive: C_SLAB_GLOW, emissiveIntensity: 0.18,
                                    roughness: 0.45, metalness: 0.1}));
  const edge = new THREE.LineSegments(new THREE.EdgesGeometry(chipGeo),
    new THREE.LineBasicMaterial({color: RAMP[1], transparent: true, opacity: 0.85}));
  chip.add(edge);
  chip.renderOrder = 2;
  chip.visible = false;
  markers.add(chip);
  imuSite = {anchor: a, chip, edge};
}

function fail(why) {
  failed = true; loading = false;
  console.warn('Glove map: model unavailable', why);
  emptyEl.textContent = tr('The hand model could not be loaded — the channel tiles above are still live.');
  emptyEl.style.display = '';
}

/* ── per-frame ───────────────────────────────────────────────────────── */

function chanByName() {
  const m = new Map();
  if (snap && snap.connected) for (const c of snap.channels) m.set(c.name, c);
  return m;
}

function smoothTo(cur, target, dt, rate) {
  return cur + (target - cur) * Math.min(1, dt * rate);
}

function frame(dt) {
  snap = window.devGloveSnapshot ? window.devGloveSnapshot() : null;
  const by = chanByName();

  /* Flex first: bones move, then every anchor is read in its new place. */
  for (const r of sites) {
    const {def} = r;
    if (!def.finger) continue;
    const c = by.get(def.name);
    const target = c && c.kind === 'flex' && c.cur !== null ? c.cur : 0;
    bend[def.finger] = REDUCED ? target : smoothTo(bend[def.finger], target, dt, 12);
    const curl = def.finger === 'thumb' ? CURL.thumb : CURL.finger;
    FINGER_BONES[def.finger].forEach((n, k) => {
      bones[n].quaternion.copy(rest[n])
        .multiply(_q.setFromAxisAngle(_z, CURL_SIGN * curl[k] * bend[def.finger]));
    });
  }

  /* Whole-hand orientation from the fused IMU. The filter already runs at the
     board's 100 Hz (glove3dFeed), so this only eases the display between
     polls; it adds no lag worth measuring. Before calibration it uses the
     default mount; with following off, or no board, the hand settles back
     to the upright reference pose. */
  const imu = snap && snap.connected ? snap.imu : null;
  if (imu && imu.present) checkMountImu(imu.imu);
  const q = follow && snap && snap.connected ? fusionLib.handToScreen(fusion) : null;
  if (q) _qShow.set(q[1], q[2], q[3], q[0]); else _qShow.identity();
  if (REDUCED) tiltG.quaternion.copy(_qShow);
  else tiltG.quaternion.slerp(_qShow, Math.min(1, dt * (q ? 25 : 4)));
  scene.updateMatrixWorld(true);
  renderCal();

  for (const r of sites) {
    const c = by.get(r.def.name);
    if (r.tube) { drawStrip(r, c); r.label.getWorldPosition(r.labelPos); }
    if (r.heat >= 0) heatSite(r, c, dt);
  }

  /* The IMU chip: there when the board reports an IMU, gone when it does
     not. No number and no halo; the whole hand turning is its reading, and
     the tremor-band share is in the Motion section above. */
  const on = !!(imu && imu.present);
  const {chip} = imuSite;
  chip.visible = on;
  if (on) {
    imuSite.anchor.getWorldPosition(chip.position);
    imuSite.anchor.getWorldQuaternion(chip.quaternion);
  }
}

/* Has this strip been bent through a real range yet? Until then its bend is
   read against a placeholder span, so it is drawn muted. */
const bendSet = c => c.basis === 'observed' || c.basis === 'calibrated';

/* Force as heat. Cold until there is a force, then rising with the square
   root of the share of rated force, so a light touch already shows and a
   full-rated press is fully hot. A channel with no curve (raw), or one the
   banner calls something else, stays cold: the map never guesses "how
   much". Past rated it simply stays fully hot; the list says so in words. */
function heatSite(r, c, dt) {
  const live = !!c && c.kind === r.def.kind && c.state !== 'raw' && typeof c.cur === 'number';
  const cur = live ? Math.max(0, Math.min(1, c.cur)) : 0;
  const target = Math.sqrt(Math.max(0, cur - 0.01) / 0.99);
  r.amt = REDUCED ? target : smoothTo(r.amt, target, dt, 14);
  heatU.uHeatAmt.value[r.heat] = r.amt < 0.003 ? 0 : r.amt;
  r.anchors[0].getWorldPosition(heatU.uHeatPos.value[r.heat]);
}

/* A strip is drawn only when the banner declares it. The fill follows the
   same eased bend as the finger, so the two move together. Grey fill while
   the strip still reads against its placeholder span. */
function drawStrip(r, c) {
  const fitted = !!c && c.kind === 'flex';
  r.tube.visible = fitted;
  if (!fitted) return;
  const pts = r.anchors.map(a => a.getWorldPosition(new THREE.Vector3()));
  const key = pts.map(p => p.x.toFixed(4) + p.y.toFixed(4) + p.z.toFixed(4)).join('|');
  if (key !== r.tubeKey) {
    r.tube.geometry.dispose();
    r.tube.geometry = tubeGeometry(pts);
    r.tubeKey = key;
  }
  const u = r.tube.material.uniforms;
  const live = typeof c.cur === 'number';
  u.uAmt.value = live ? bend[r.def.finger] : 0;
  if (!live) return;
  if (bendSet(c)) ramp(0.5 + 0.5 * u.uAmt.value, u.uFill.value);
  else u.uFill.value.copy(C_GHOST);
}

/* Each fitted strip's %, just past its fingertip. In the DOM so it stays
   crisp: bare text on a soft halo, no pill and no channel name (the list
   beside the canvas names them). The number is the tile's own (snapshot
   `pct`). No FSR or IMU numbers on the hand: force is the glow, and the
   hand turning is the IMU reading. */
const TAG_W = 28, TAG_H = 15;            // px one label claims, for de-overlap
function placeTags() {
  const w = stage.clientWidth, h = stage.clientHeight;
  const by = chanByName();
  const want = [];
  for (const r of sites) {
    if (!r.label) continue;
    const c = by.get(r.def.name);
    if (!c || c.kind !== 'flex' || typeof c.pct !== 'number') continue;
    _v.copy(r.labelPos).project(camera);
    want.push({name: r.def.name, text: c.pct.toFixed(0), muted: !bendSet(c),
               x: (_v.x + 1) / 2 * w, y: (1 - _v.y) / 2 * h, hide: _v.z > 1});
  }
  const sig = want.map(x => x.name).join(',');
  if (tagsEl.dataset.sig !== sig) {
    tagsEl.innerHTML = want.map(x => `<div class="g3d-tag" data-n="${x.name}"><span></span><i>%</i></div>`).join('');
    tagsEl.dataset.sig = sig;
  }
  /* Fingers pointed at the screen bunch their tips together: left to right,
     lift each label clear of those already placed. Each placed label can
     lift it at most once (it only ever moves up), so this ends. */
  const placed = [];
  for (const x of [...want].sort((a, b) => a.x - b.x)) {
    if (x.hide) continue;
    for (let moved = true; moved;) {
      moved = false;
      for (const p of placed) {
        if (Math.abs(x.x - p.x) < TAG_W && Math.abs(x.y - p.y) < TAG_H) { x.y = p.y - TAG_H; moved = true; }
      }
    }
    placed.push(x);
  }
  want.forEach((x, i) => {
    const el = tagsEl.children[i];
    el.style.display = x.hide ? 'none' : '';
    if (x.hide) return;
    el.style.transform = `translate(${x.x.toFixed(1)}px, ${x.y.toFixed(1)}px) translate(-50%, -50%)`;
    const sp = el.firstChild;
    if (sp.textContent !== x.text) sp.textContent = x.text;
    el.classList.toggle('muted', x.muted);
  });
}

/* ── the empty-state line over the canvas ───────────────────────────────── */

function renderEmpty() {
  if (failed) return;   // fail() has put its own message there
  const connected = !!(window.devGloveSnapshot && window.devGloveSnapshot().connected);
  emptyEl.textContent = connected ? '' : tr('Connect the board to light up the fitted sensors.');
  emptyEl.style.display = connected ? 'none' : '';
}

/* ── view controls ───────────────────────────────────────────────────── */

/* Rebuilt only when what it shows changes, so a click is never lost to a
   re-render mid-press. */
let viewsSig = '';
function renderViews(force) {
  const calibrated = !!fusion.mount;
  const sig = [calibrated, follow, handSide, !!fusion.cal, !!fingerCal, window.getLang?.() || ''].join('|');
  if (!force && sig === viewsSig) return;
  viewsSig = sig;
  viewsEl.innerHTML =
    `<button class="btn ${calibrated ? 'btn-ghost' : 'btn-primary'}" data-g3d="calibrate"` +
    ` title="${tr('Two held poses teach the map how the board sits on your hand.')}">` +
    `${tr(calibrated ? 'Recalibrate' : 'Calibrate motion')}</button>` +
    `<button class="btn btn-ghost" data-g3d="fingers"` +
    ` title="${tr('Open hand, then a fist: records the range of each flex strip, so a small shift no longer swings the reading.')}">` +
    `${tr('Calibrate fingers')}</button>` +
    `<button class="btn btn-ghost" data-g3d="heading"` +
    ` title="${tr('Point your fingers at the screen, or show it your palm, then press. Heading drifts slowly without a compass.')}">` +
    `${tr('Reset heading')}</button>` +
    /* Calibration on the left, how the hand is shown on the right. */
    `<span class="g3d-spacer"></span>` +
    `<label class="dev-check"><input type="checkbox" data-g3d="follow" ${follow ? 'checked' : ''}> ${tr('Follow hand')}</label>` +
    `<label class="dev-sel">${tr('Glove on')} <select data-g3d="hand">` +
    `<option value="right" ${handSide === 'right' ? 'selected' : ''}>${tr('right hand')}</option>` +
    `<option value="left" ${handSide === 'left' ? 'selected' : ''}>${tr('left hand')}</option></select></label>` +
    `<button class="btn btn-ghost" data-g3d="view">${tr('Reset view')}</button>`;
}
viewsEl.addEventListener('click', e => {
  const b = e.target.closest('button[data-g3d]');
  if (!b) return;
  const id = b.dataset.g3d;
  if (id === 'view' && controls) {
    camera.position.copy(CAM_HOME);
    controls.target.set(0, 0, 0);
    controls.update();
  }
  if (id === 'calibrate') { fingerCal = null; fusionLib.startCalibration(fusion); renderViews(); }
  if (id === 'fingers') { fusionLib.cancelCalibration(fusion); startFingerCal(); renderViews(); }
  if (id === 'heading') {
    const ok = fusionLib.resetHeading(fusion);
    window.toast?.(tr(ok ? 'Heading reset.' : 'Hold the hand so the fingers or the palm face the screen, then try again.'),
                   ok ? 'ok' : 'info');
  }
});
viewsEl.addEventListener('change', e => {
  const id = e.target.dataset.g3d;
  if (id === 'follow') follow = e.target.checked;
  if (id === 'hand') { handSide = e.target.value; applyHand(); saveMount(); }
  renderViews();
});

function applyHand() { mirrorG.scale.x = handSide === 'right' ? -1 : 1; }

/* ── calibration overlay ─────────────────────────────────────────────── */

const calEl = document.createElement('div');
calEl.className = 'g3d-cal';
calEl.hidden = true;
stage.appendChild(calEl);
calEl.addEventListener('change', e => {
  const n = e.target.dataset && e.target.dataset.g3dPick;
  if (!n || !fingerCal) return;
  if (e.target.checked) fingerCal.pick.add(n); else fingerCal.pick.delete(n);
});
calEl.addEventListener('click', e => {
  if (e.target.closest('[data-g3d-cal="go"]')) { beginFingerPoses(); return; }
  if (e.target.closest('[data-g3d-cal="cancel"]')) {
    fusionLib.cancelCalibration(fusion);
    fingerCal = null;
    closeCal();
    renderViews();
  }
});
let calSig = '';
/* Closing the overlay here, rather than letting renderCal notice it went
   away, is what keeps a cancel or a finished finger calibration from being
   announced as a finished MOTION calibration. */
function closeCal() { calEl.hidden = true; calSig = ''; }

/* Finger calibration: two timed poses rather than "hold still until it
   settles", because a fist is held with effort and never reads perfectly
   still. The capture itself (median of each strip's last 0.8 s) and the
   check that each strip actually moved live in dev.js, beside the buffers. */
const FINGER_POSE_MS = 3000;
let fingerCal = null;           // {step, due, flat, pick}
/* Which strips to calibrate. Step 0 lets a strip sit out (a finger that
   cannot bend, a strip being re-seated): an unticked strip is not captured,
   not warned about, and keeps whatever range it already had. Remembered as
   the strips left OUT, so a newly fitted strip starts ticked. */
const SKIP_KEY = 'hand3d.flexCalSkip';
let flexSkip = new Set();
try { flexSkip = new Set(JSON.parse(localStorage.getItem(SKIP_KEY) || '[]')); } catch (e) { /* defaults */ }
function flexNames() {
  return snap && snap.connected ? snap.channels.filter(c => c.kind === 'flex').map(c => c.name) : [];
}
function startFingerCal() {
  const names = flexNames();
  if (!names.length) {
    window.toast?.(tr('No flex strips are streaming — connect the board first.'), 'info');
    return;
  }
  fingerCal = {step: 0, due: Infinity, flat: null, pick: new Set(names.filter(n => !flexSkip.has(n)))};
}
function beginFingerPoses() {
  const c = fingerCal;
  if (!c || !c.pick.size) return;
  const names = flexNames();
  flexSkip = new Set(names.filter(n => !c.pick.has(n)));
  try { localStorage.setItem(SKIP_KEY, JSON.stringify([...flexSkip])); } catch (e) { /* not fatal */ }
  fingerCal = {step: 1, due: performance.now() + FINGER_POSE_MS, flat: null, pick: c.pick};
}
const onlyPicked = (got, pick) => Object.fromEntries(Object.entries(got).filter(([n]) => pick.has(n)));
function tickFingerCal() {
  const c = fingerCal;
  if (!c || performance.now() < c.due) return;
  /* Step 2 keeps the tightest moment of the fist, not its last 0.8 s. The
     first 0.5 s of the pose is left out: that is the hand still closing. */
  const got = onlyPicked(!window.devFlexCal ? {}
    : c.step === 1 ? window.devFlexCal.capture('flat')
    : window.devFlexCal.capture('bent', Math.round((FINGER_POSE_MS - 500) / 10)), c.pick);
  if (!Object.keys(got).length) {
    fingerCal = null;
    closeCal();
    window.toast?.(tr('No flex strips are streaming — connect the board first.'), 'info');
    renderViews();
    return;
  }
  if (c.step === 1) {
    fingerCal = {step: 2, due: performance.now() + FINGER_POSE_MS, flat: got, pick: c.pick};
    return;
  }
  const {ok, weak} = window.devFlexCal.save(c.flat, got);
  fingerCal = null;
  closeCal();
  if (ok.length) window.toast?.(tr('Fingers calibrated: {names}.', {names: ok.join(', ')}), 'ok');
  if (weak.length) {
    window.toast?.(tr('{names} barely changed between open and fist — check the strip lies over the knuckle, then try again.',
                      {names: weak.join(', ')}), 'info');
  }
  renderViews();
}

function renderCal() {
  tickFingerCal();
  if (fingerCal && fingerCal.step === 0) {
    calEl.hidden = false;
    const names = flexNames();
    const pick = fingerCal.pick;
    const sig = ['f0', names.join(','), [...pick].join(','), window.getLang?.() || ''].join('|');
    if (sig !== calSig) {
      calSig = sig;
      const site = n => (SITES.find(s => s.name === n) || {}).site;
      const boxes = names.map(n =>
        `<label class="dev-check"><input type="checkbox" data-g3d-pick="${n}" ${pick.has(n) ? 'checked' : ''}> ` +
        `<b>${n}</b>${site(n) ? ' ' + tr(site(n)) : ''}</label>`).join(' ');
      calEl.innerHTML =
        `<p>${tr('Choose the strips to calibrate. Unticked strips keep the range they already have.')}</p>` +
        `<p class="g3d-cal-picks">${boxes}</p>` +
        `<button class="btn btn-primary" data-g3d-cal="go" ${pick.size ? '' : 'disabled'}>${tr('Start')}</button> ` +
        `<button class="btn btn-ghost" data-g3d-cal="cancel">${tr('Cancel calibration')}</button>`;
    }
    return;
  }
  if (fingerCal) {
    calEl.hidden = false;
    const left = Math.max(0, fingerCal.due - performance.now());
    const sig = ['f', fingerCal.step, Math.ceil(left / 1000), window.getLang?.() || ''].join('|');
    if (sig !== calSig) {
      calSig = sig;
      const n = Math.ceil(left / 1000);
      const step = fingerCal.step === 1
        ? tr('Step 1 of 2 — open your hand, fingers straight and relaxed. Recording in {n} s.', {n})
        : tr('Step 2 of 2 — make a firm fist and hold it. Recording in {n} s.', {n});
      calEl.innerHTML = `<p>${step}</p><div class="g3d-cal-bar"><i></i></div>` +
        `<button class="btn btn-ghost" data-g3d-cal="cancel">${tr('Cancel calibration')}</button>`;
    }
    calEl.querySelector('.g3d-cal-bar i').style.width = (100 * (1 - left / FINGER_POSE_MS)).toFixed(1) + '%';
    return;
  }
  const c = fusion.cal;
  if (!c) {
    if (!calEl.hidden) {
      calEl.hidden = true;
      calSig = '';
      if (fusion.mount) { saveMount(); window.toast?.(tr('Motion calibrated — the hand now follows yours.'), 'ok'); }
      renderViews();
    }
    return;
  }
  calEl.hidden = false;
  const pct = Math.round(100 * c.n / fusionLib.CAL_SAMPLES);
  const sig = [c.step, c.error, window.getLang?.() || ''].join('|');
  if (sig !== calSig) {
    calSig = sig;
    const step = c.step === 1
      ? tr('Step 1 of 2 — lay your hand flat, palm down, and hold still.')
      : tr('Step 2 of 2 — raise it: fingers up, palm facing the screen. Hold still.');
    const err = c.error === 'too-close'
      ? `<p class="g3d-cal-err">${tr('That was too close to the first pose — turn the hand further, then hold still.')}</p>` : '';
    calEl.innerHTML = `<p>${step}</p>${err}<div class="g3d-cal-bar"><i></i></div>` +
      `<button class="btn btn-ghost" data-g3d-cal="cancel">${tr('Cancel calibration')}</button>`;
  }
  calEl.querySelector('.g3d-cal-bar i').style.width = pct + '%';
}

/* ── IMU frames in, from dev.js ──────────────────────────────────────── */

const IMU_COLS = ['ax', 'ay', 'az', 'gx', 'gy', 'gz'];
window.glove3dFeed = (frames, channels) => {
  const idx = IMU_COLS.map(n => channels.indexOf(n));
  if (idx.some(i => i < 0)) return;
  const sc = window.devImuScale ? window.devImuScale() : 1000;
  for (const f of frames) {
    const v = idx.map(i => f[2 + i]);
    if (v.some(x => x === undefined || x === null)) continue;
    fusionLib.step(fusion, [v[0] / sc, v[1] / sc, v[2] / sc], [v[3] / sc, v[4] / sc, v[5] / sc], f[1]);
  }
  /* No heading yet (fresh page, or a restored mount: the filter's own heading
     restarts at zero). Take one from the first steady moment, or after ~1.5 s
     regardless, so a hand that never holds still still gets to move. */
  if (!fusion.heading && fusion.ready) {
    headingWait += frames.length;
    if (fusion.stillFor > 0.3 || headingWait > 150) fusionLib.resetHeading(fusion);
  } else headingWait = 0;
};
let headingWait = 0;

/* ── lifecycle ───────────────────────────────────────────────────────── */

function resize() {
  if (!renderer) return;
  const w = stage.clientWidth, h = stage.clientHeight;
  if (!w || !h) return;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}

function init() {
  try {
    renderer = new THREE.WebGLRenderer({canvas, alpha: true, antialias: true, powerPreference: 'low-power'});
  } catch (e) {
    fail('webgl');
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  controls = new OrbitControls(camera, canvas);
  controls.enablePan = false;
  controls.enableDamping = !REDUCED;
  controls.minDistance = 0.45;
  controls.maxDistance = 1.4;
  new ResizeObserver(resize).observe(stage);
  resize();
  loading = true;
  new GLTFLoader().load('/assets/models/hand.gltf', onModel, undefined, () => fail('load'));
}

let last = 0;
function loop(now) {
  raf = requestAnimationFrame(loop);
  const dt = Math.min((now - last) / 1000 || 0, 0.1);
  last = now;
  if (!loaded) { renderer && renderer.render(scene, camera); return; }
  frame(dt);
  controls.update();
  renderer.render(scene, camera);
  placeTags();
}

function start() {
  if (running) return;
  running = true;
  renderViews();
  if (!renderer && !failed) init();
  renderEmpty();
  emptyTimer = setInterval(renderEmpty, 500);
  if (renderer) raf = requestAnimationFrame(loop);
}

function stop() {
  running = false;
  if (raf) cancelAnimationFrame(raf);
  raf = null;
  clearInterval(emptyTimer);
  emptyTimer = null;
}

window.glove3d = {start, stop};
if (typeof window.onLang === 'function') {
  window.onLang(() => { renderViews(); renderEmpty(); tagsEl.dataset.sig = ''; });
}
// dev.js may have called start() before this module existed.
if (document.getElementById('page-dev')?.classList.contains('active')) start();
