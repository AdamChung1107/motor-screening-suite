/* ── Glove orientation: IMU fusion + mounting calibration ──────────────────
   Pure maths, no three.js and no DOM, so it runs under Node for testing.
   Used by glove3d.js to make the 3D hand follow the real one.

   What the board gives us: accelerometer (g) and gyroscope (deg/s), 100 Hz,
   in the BOARD's axes. No magnetometer is streamed, so:
     * tilt (which way is down) is absolute — gravity pins it;
     * heading (which way the screen is) is NOT, and drifts slowly with any
       gyro bias the stillness tracker below has not yet removed. It is set
       by resetHeading() and re-set by the "Reset heading" button.

   Fusion is Mahony's complementary filter (Mahony, Hamel & Pflimlin 2008),
   proportional term only: the gyro carries the motion, gravity pulls tilt
   back. Gravity is trusted only while |a| is near 1 g, because during a
   quick move the accelerometer measures the move too.

   Quaternions are [w, x, y, z] and map BODY (board) -> EARTH (z up).

   Mounting: nobody knows which way the board sits on the hand, so it is
   measured with two held poses:
     1. palm down, flat      -> gravity reads along the back of the hand
     2. fingers up, palm to the screen -> gravity reads along the fingers
   From those two directions (in board axes) comes the board->hand rotation,
   and pose 2 also fixes the heading. Before that, DEFAULT_MOUNT stands in,
   so the hand moves from the first frame. */

export const KP = 1.0;               // gravity pull on tilt, 1/s
export const ACC_TRUST_G = 0.15;     // use gravity only while | |a| - 1 g | < this
export const STILL_GYRO_DPS = 4;     // still: rotating slower than this...
export const STILL_ACC_G = 0.05;     // ...and |a| within this of 1 g
export const BIAS_AFTER_S = 0.5;     // still this long before gyro bias learns
export const BIAS_RATE = 0.02;       // per-sample EMA weight for the bias
export const CAL_SAMPLES = 80;       // 0.8 s of stillness per calibration pose
export const CAL_MIN_DEG = 50;       // the two poses must differ by at least this

/* ── small vector / quaternion helpers ─────────────────────────────────── */

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => { const n = Math.hypot(a[0], a[1], a[2]); return n ? a.map(x => x / n) : null; };

export function qmul(a, b) {
  return [
    a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
    a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
    a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
    a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0],
  ];
}
export const qconj = q => [q[0], -q[1], -q[2], -q[3]];
export function qrot(q, v) {
  const r = qmul(qmul(q, [0, v[0], v[1], v[2]]), qconj(q));
  return [r[1], r[2], r[3]];
}
/* Rotation whose columns are the given orthonormal axes, i.e. it maps
   (1,0,0)->x, (0,1,0)->y, (0,0,1)->z. */
export function qFromBasis(x, y, z) {
  const m00 = x[0], m01 = y[0], m02 = z[0];
  const m10 = x[1], m11 = y[1], m12 = z[1];
  const m20 = x[2], m21 = y[2], m22 = z[2];
  const tr = m00 + m11 + m22;
  let q;
  if (tr > 0) {
    const s = 0.5 / Math.sqrt(tr + 1);
    q = [0.25 / s, (m21 - m12) * s, (m02 - m20) * s, (m10 - m01) * s];
  } else if (m00 > m11 && m00 > m22) {
    const s = 2 * Math.sqrt(1 + m00 - m11 - m22);
    q = [(m21 - m12) / s, 0.25 * s, (m01 + m10) / s, (m02 + m20) / s];
  } else if (m11 > m22) {
    const s = 2 * Math.sqrt(1 + m11 - m00 - m22);
    q = [(m02 - m20) / s, (m01 + m10) / s, 0.25 * s, (m12 + m21) / s];
  } else {
    const s = 2 * Math.sqrt(1 + m22 - m00 - m11);
    q = [(m10 - m01) / s, (m02 + m20) / s, (m12 + m21) / s, 0.25 * s];
  }
  const n = Math.hypot(...q);
  return q.map(c => c / n);
}
/* Shortest rotation taking unit vector a onto unit vector b. */
function qBetween(a, b) {
  const c = cross(a, b), d = dot(a, b);
  if (d < -0.999999) {
    const axis = norm(Math.abs(a[0]) < 0.9 ? cross(a, [1, 0, 0]) : cross(a, [0, 1, 0]));
    return [0, axis[0], axis[1], axis[2]];
  }
  const q = [1 + d, c[0], c[1], c[2]];
  const n = Math.hypot(...q);
  return q.map(x => x / n);
}

/* ── the filter ───────────────────────────────────────────────────────── */

export function createFusion() {
  return {
    q: [1, 0, 0, 0], ready: false, lastT: null,
    bias: [0, 0, 0], stillFor: 0, still: false,
    mount: null,          // board->hand quaternion, from calibrate()
    heading: null,        // earth->screen quaternion, from resetHeading()
    cal: null,            // {step, sum, n, first, error} while calibrating
  };
}

/* One IMU sample. a in g, gDps in deg/s, both board axes; tUs is the board's
   own microsecond clock (u32, wraps every ~71 min). */
export function step(f, a, gDps, tUs) {
  let dt = 0;
  if (f.lastT !== null) dt = ((tUs - f.lastT) >>> 0) / 1e6;
  f.lastT = tUs;
  if (!(dt > 0 && dt < 0.1)) dt = 0;       // first sample, or a gap: do not integrate across it

  const an = Math.hypot(a[0], a[1], a[2]);
  const gm = Math.hypot(gDps[0], gDps[1], gDps[2]);
  f.still = gm < STILL_GYRO_DPS && Math.abs(an - 1) < STILL_ACC_G;
  f.stillFor = f.still ? f.stillFor + dt : 0;
  if (f.stillFor > BIAS_AFTER_S) {
    for (let k = 0; k < 3; k++) f.bias[k] += BIAS_RATE * (gDps[k] - f.bias[k]);
  }
  if (f.cal) calSample(f, a);

  if (!f.ready) {
    if (an > 0.5) { f.q = qBetween(norm(a), [0, 0, 1]); f.ready = true; }
    return;
  }
  if (dt === 0) return;

  const D2R = Math.PI / 180;
  let gx = (gDps[0] - f.bias[0]) * D2R;
  let gy = (gDps[1] - f.bias[1]) * D2R;
  let gz = (gDps[2] - f.bias[2]) * D2R;
  let [q0, q1, q2, q3] = f.q;

  if (Math.abs(an - 1) < ACC_TRUST_G) {
    const ax = a[0] / an, ay = a[1] / an, az = a[2] / an;
    // Where the current estimate thinks "up" is, in board axes.
    const vx = 2 * (q1 * q3 - q0 * q2);
    const vy = 2 * (q0 * q1 + q2 * q3);
    const vz = q0 * q0 - q1 * q1 - q2 * q2 + q3 * q3;
    gx += KP * (ay * vz - az * vy);
    gy += KP * (az * vx - ax * vz);
    gz += KP * (ax * vy - ay * vx);
  }

  const h = 0.5 * dt;
  const n0 = q0 + (-q1 * gx - q2 * gy - q3 * gz) * h;
  const n1 = q1 + (q0 * gx + q2 * gz - q3 * gy) * h;
  const n2 = q2 + (q0 * gy - q1 * gz + q3 * gx) * h;
  const n3 = q3 + (q0 * gz + q1 * gy - q2 * gx) * h;
  const n = Math.hypot(n0, n1, n2, n3);
  f.q = [n0 / n, n1 / n, n2 / n, n3 / n];
}

/* ── calibration ──────────────────────────────────────────────────────── */

export function startCalibration(f) {
  f.cal = {step: 1, sum: [0, 0, 0], n: 0, first: null, error: null};
}
export function cancelCalibration(f) { f.cal = null; }

function calSample(f, a) {
  const c = f.cal;
  if (!f.still) { c.sum = [0, 0, 0]; c.n = 0; return; }   // any movement restarts the hold
  for (let k = 0; k < 3; k++) c.sum[k] += a[k];
  c.n++;
  if (c.n < CAL_SAMPLES) return;
  const up = norm(c.sum);                                  // at rest, the accelerometer reads UP
  c.sum = [0, 0, 0]; c.n = 0;
  if (c.step === 1) {
    c.first = up;                                          // back of the hand
    c.step = 2; c.error = null;
    return;
  }
  const deg = Math.acos(Math.max(-1, Math.min(1, dot(up, c.first)))) * 180 / Math.PI;
  if (deg < CAL_MIN_DEG) { c.error = 'too-close'; return; }
  const dorsal = c.first;
  const fingers = norm(up.map((x, k) => x - dot(up, dorsal) * dorsal[k]));
  const palmar = dorsal.map(x => -x);
  const side = cross(fingers, palmar);
  // Hand axes in the model: x = fingers x palm, y = fingers, z = palm normal.
  f.mount = qFromBasis(side, fingers, palmar);
  f.cal = null;
  resetHeading(f);
}

/* ── heading ──────────────────────────────────────────────────────────────
   The view is over the shoulder: you see the virtual hand the way you see
   your own, so whatever the hand points at the screen points INTO it. The
   direction used is the fingers' when they are fairly level, else the palm's
   (fingers up, palm to the screen — calibration pose 2). */
export function resetHeading(f) {
  if (!f.ready) return false;
  const toEarth = qmul(f.q, mountOf(f));                   // hand -> earth
  const fingers = qrot(toEarth, [0, 1, 0]);
  const palm = qrot(toEarth, [0, 0, 1]);
  let d = [fingers[0], fingers[1], 0];
  if (Math.hypot(d[0], d[1]) < 0.5) d = [palm[0], palm[1], 0];
  d = norm(d);
  if (!d) return false;
  const sz = d.map(x => -x), sy = [0, 0, 1], sx = cross(sy, sz);
  f.heading = qconj(qFromBasis(sx, sy, sz));               // earth -> screen
  return true;
}

/* hand -> screen, or null until there is a heading. */
export function handToScreen(f) {
  if (!f.ready || !f.heading) return null;
  return qmul(f.heading, qmul(f.q, mountOf(f)));
}

/* Until the two-pose calibration has run, the hand still moves: it assumes
   the board lies flat on the back of the hand, chip side out, with its +Y
   arrow toward the fingers (how the MPU6050 breakout is strapped on). Tilt
   is right whenever that holds; if the board sits another way the hand
   turns the wrong way round, and the calibration is what fixes that. */
export const DEFAULT_MOUNT = (() => {
  const fingers = [0, 1, 0], palmar = [0, 0, -1];
  return qFromBasis(cross(fingers, palmar), fingers, palmar);
})();
export function mountOf(f) { return f.mount || DEFAULT_MOUNT; }

/* Mount + hand side survive a reload; heading cannot (the filter's heading
   restarts from zero each time), so it is re-set from the current pose. */
export function exportMount(f) { return f.mount ? f.mount.slice() : null; }
export function importMount(f, m) {
  if (Array.isArray(m) && m.length === 4 && m.every(Number.isFinite)) f.mount = m.slice();
}
