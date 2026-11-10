/* ── Developer page: sensor-glove toolchain + live scope ──────────────
   Classic script (loaded after app.js) so it shares that file's top-level
   `I` icon library, `toast()` and `reducedMotion` bindings.

   Data path:  Arduino --USB--> launcher.py GloveReader --> /api/glove/samples
               --> ring buffers here --> canvas scope + per-channel tiles.

   Polling runs ONLY while this page is on screen; app.js's showPage() calls
   startDev()/stopDev(). */

/* Categorical series palette — validated with the dataviz skill's checker
   against this page's surface (#1A2236, dark): lightness band, chroma floor,
   CVD separation, normal-vision floor and contrast all pass. Slots are
   assigned to channels in FIXED ORDER and never cycled; past slot 8 the
   per-channel tiles below act as small multiples instead of new hues.
   Status colors (--success/--warning/--danger) are reserved and never used
   as a series color. */
const DEV_SERIES = ["#3987e5", "#d95926", "#199e70", "#c98500",
                    "#d55181", "#008300", "#9085e9", "#e66767"];
const DEV_MAX_SERIES = DEV_SERIES.length;
/* Grid and axis ink are tokens (palette.js can re-derive them; hubTok caches
   per palette, so reading them every frame is cheap). The series hues above
   stay fixed: they name channels and were checked for colour-blind spread. */
const devTok = (name, fallback) => (window.hubTok && window.hubTok(name)) || fallback;

const DEV_CAP = 1500;            // samples retained per channel (~15 s at 100 Hz)
const DEV_CONSOLE_CAP = 200;
const DEV_POLL_MS = 100;
const DEV_ENV_MS = 4000;

const DEV_IMU_MS = 500;          // derived motion readout; runs a small DFT

/* Full-scale for the per-axis bars and the motion plots, in physical units.
   Chosen for a HAND, not for the sensor's range: a glove sees roughly +/-2 g
   and a few hundred deg/s, and scaling to the chip's +/-2000 dps would leave
   every real gesture an invisible sliver. Values past full scale clamp the
   bar; the number beside it stays authoritative. */
/* Canvas text needs its own stack: JetBrains Mono has no CJK glyphs, and a
   canvas silently draws tofu rather than falling back per-glyph. */
const DEV_FONT = "11px 'JetBrains Mono','Noto Sans TC','Microsoft JhengHei',monospace";

const DEV_ACCEL_FS = 2;          // g
const DEV_GYRO_FS = 250;         // deg/s

const dev = {
  built: false, fastTimer: null, envTimer: null, imuTimer: null, raf: null,
  env: null, status: null, imu: null,
  channels: [], series: [], span: [],   // per channel: values[], {min,max}
  bendSpan: [],                        // flex only: outlier-resistant {min,max}
  lastSeq: -1, paused: false,
  window_s: 5, yAuto: false, unit: "force", smooth: false,
  view: "stacked",     // "stacked" = one lane per channel | "overlaid" = shared axis
  console: [], autoscroll: true,
  selected: new Set(),
  port: null,          // port shown in the select, survives re-renders
  portPinned: false,   // true only once the user has picked one by hand
  connSig: null,       // last rendered connection-row signature
  linkSig: null,       // last seen stream state, from the 100 ms sample poll
};

/* ── helpers ─────────────────────────────────────────────────────── */

// Conductance, which a FlexiForce A401 is linear in. Shown in place of
// newtons until the pad has its own calibration (GRIP_TEST_PLAN.md G1).
function devUsText(ohm){
  if(!ohm) return t("open");
  const us = 1e6/ohm;
  return (us >= 10 ? us.toFixed(0) : us.toFixed(1)) + " µS";
}
function devOhmText(v){
  if(v === null || v === undefined) return t("open");
  if(v >= 1e6) return (v/1e6).toFixed(2) + " MΩ";
  if(v >= 1e3) return (v/1e3).toFixed(1) + " kΩ";
  return v + " Ω";
}
// Mirrors core/glove/protocol.py — integer math, so the page and the board's
// own #DIAG output can never disagree.
function devMv(adc, b){
  const ref = b ? b.adc_ref_mv : 3300, bits = b ? b.adc_bits : 10;
  return Math.floor((adc * ref) / ((1 << bits) - 1));
}
// rFixed is passed in rather than read off the banner's global, because each
// channel has its own low-side resistor (see devRFixed). Falls back to the
// global when a caller has no channel in hand.
function devOhm(adc, b, rFixed){
  const mv = devMv(adc, b);
  const vdiv = b ? b.vdiv_mv : 3300;
  const rf = (rFixed && rFixed > 0) ? rFixed : (b ? b.r_fixed : 10000);
  if(mv <= 0) return null;
  if(mv >= vdiv) return 0;
  return Math.floor((rf * (vdiv - mv)) / mv);
}

/* ── force estimation ─────────────────────────────────────────────────
   Interpolates the curve the SERVER sends (dev.status.force_model), which
   comes from core/glove/force.py. The anchor points are deliberately not
   duplicated here — one definition, in Python. */

function devForceModel(){
  return (dev.status && dev.status.force_model) || null;
}
// Log-log piecewise interpolation, mirroring force.force_newtons().
function devForce(ohm){
  const m = devForceModel();
  if(!m || ohm === null || ohm === undefined) return null;
  const p = m.points;                       // [[newtons, ohms], ...] asc force
  if(ohm <= 0) return ohm === 0 ? p[p.length-1][0] : null;
  const last = p.length - 2;
  let seg;
  if(ohm >= p[0][1]) seg = 0;
  else if(ohm <= p[p.length-1][1]) seg = last;
  else { seg = last;
    for(let i=0;i<=last;i++){ if(p[i+1][1] <= ohm && ohm <= p[i][1]){ seg = i; break; } } }
  const [f0,r0] = p[seg], [f1,r1] = p[seg+1];
  if(r1 === r0) return f0;
  const t = (Math.log(ohm) - Math.log(r0)) / (Math.log(r1) - Math.log(r0));
  return Math.exp(Math.log(f0) + t * (Math.log(f1) - Math.log(f0)));
}
function devForceRange(n){
  const m = devForceModel();
  if(n === null || n === undefined) return "open";
  if(!m) return "rated";
  if(n < m.rated_min_n) return "below";
  if(n > m.rated_max_n) return "above";
  return "rated";
}
function devForceText(n){
  if(n === null || n === undefined) return "—";
  return (n < 10 ? n.toFixed(2) : n.toFixed(1)) + " N";
}
function devGramsText(n){
  if(n === null || n === undefined) return "";
  const g = n / 9.80665 * 1000;
  return g >= 1000 ? (g/1000).toFixed(2) + " kgf" : g.toFixed(0) + " gf";
}
// Honest badge — never present an out-of-spec reading as a measurement.
function devForceBadge(range){
  const m = devForceModel();
  const tol = m ? m.tolerance_pct : 6;
  const lo = m ? m.rated_min_n : 0.2, hi = m ? m.rated_max_n : 20;
  const map = {
    open:   ["dev-badge-dim",  "no contact", t("no contact")],
    below:  ["dev-badge-dim",  "light", t("below {n} N actuation", {n: lo})],
    rated:  ["dev-badge-ok",   "in range", t("datasheet ±{tol}%", {tol})],
    above:  ["dev-badge-warn", "over range", t("beyond rated {n} N — upper bound only", {n: hi})],
  };
  const [cls, short, full] = map[range] || map.rated;
  return devTag(cls, short, full);
}
/* A row's status note: a word or two on the row, the full sentence on hover,
   so every row keeps the same shape whatever its state. */
function devTag(cls, short, full){
  return `<span class="dev-badge ${cls}" title="${full}">${t(short)}</span>`;
}
/* ── bend estimation ──────────────────────────────────────────────────
   Same contract as force above: the span comes from the SERVER
   (dev.status.flex_model / core/glove/flex.py), never a copy kept here.
   Deliberately thinner than the force path — there is no published curve for
   a bend sensor, so this is a position within a recorded span, not an angle. */

function devFlexModel(){
  return (dev.status && dev.status.flex_model) || null;
}

/* Which span to measure a bend against.

   The server's default span is a placeholder (§5c) — real flex strips vary
   enough part-to-part that a reading will often sit entirely outside it, which
   clamps the trace flat at 0% or 100% and looks like a dead sensor.

   So until a calibration exists, prefer the span this channel has ACTUALLY
   been seen to cover. That is not a fudge: §5c's whole position is that bend
   is a position within a recorded range, and the live min/max is a recorded
   range. It is labelled "observed" rather than "calibrated" so nobody mistakes
   it for a measurement, and it widens as the finger moves further.

   Direction matters. Both sensors sit on the high side of their divider, so
   rising resistance pulls the count down. Bending a flex strip raises its
   resistance, so the HIGHEST count is flattest and the LOWEST is most bent. */
function devFlexSpan(i){
  // A span recorded on purpose (open hand, then a fist) beats everything
  // below: it is per strip, and it spans the travel a hand really has.
  const cal = devFlexCalStore()[dev.channels[i]];
  if(cal && cal.fw === devFirmware()) return {flat: cal.flat, bent: cal.bent, basis: "calibrated"};
  const m = devFlexModel();
  if(m && m.calibrated && m.usable){
    return {flat: m.flat_ohm, bent: m.bent_ohm, basis: "calibrated"};
  }
  // Deliberately NOT m.min_span_ratio: see DEV_OBSERVED_MIN_RATIO.
  const ratio = DEV_OBSERVED_MIN_RATIO;
  const b = dev.status && dev.status.banner;
  const s = dev.bendSpan[i];
  if(s && s.min !== null && s.max !== null){
    const rf = devRFixed(i);
    const flat = devOhm(s.max, b, rf);      // highest count  -> lowest R
    const bent = devOhm(s.min, b, rf);      // lowest count   -> highest R
    // Same "is this travel or noise?" guard flex.py applies: dividing by a
    // span narrower than this turns jitter into a full-scale swing.
    if(flat !== null && bent !== null && flat > 0 && bent / flat >= ratio){
      return {flat, bent, basis: "observed"};
    }
  }
  if(m && m.usable) return {flat: m.flat_ohm, bent: m.bent_ohm, basis: "provisional"};
  return null;
}

/* ── finger calibration: a recorded span per flex strip ──────────────────
   The observed span above is inferred, and it switches on once a strip has
   moved 1.5x in resistance. On a glove that can be a strap tugging, not a
   bend, and a span that narrow maps a small shift onto half the scale. So the
   glove map offers a deliberate recording: open hand = flat, fist = bent,
   per strip (plan §5c, gate 9). Kept in this browser, keyed by channel name
   AND the firmware version it was recorded under: a reflash is when strips get
   rewired onto different pins, and a range recorded on one strip must never be
   applied to another. Re-record after moving a strip or changing its resistor.

   The simulated glove keeps its spans in a store of its own: its strips are
   named f0-f4 like the glove's, so a shared store would let a calibration
   made on the simulator overwrite the real one. */
const DEV_FLEXCAL_KEY = "hand3d.flexCal";
const DEV_FLEXCAL_MIN_RATIO = 1.2;   // flex.py MIN_SPAN_RATIO: narrower is noise
const DEV_FLEXCAL_WINDOW = 80;       // samples medianed per pose (0.8 s at 100 Hz)
dev.flexCalStores = {};
function devFlexCalKey(){ return devIsSim() ? DEV_FLEXCAL_KEY + ".sim" : DEV_FLEXCAL_KEY; }
function devFlexCalStore(){
  const key = devFlexCalKey();
  if(!dev.flexCalStores[key]){
    try { dev.flexCalStores[key] = JSON.parse(localStorage.getItem(key) || "{}") || {}; }
    catch(e){ dev.flexCalStores[key] = {}; }
  }
  return dev.flexCalStores[key];
}

/* Each flex strip's resistance, as the median of 0.8 s.

   Open hand ("flat"): the last 0.8 s. Fist ("bent"): the MOST-bent 0.8 s
   anywhere in the pose's last `poseSamples`. A fist is held with effort and
   starts to loosen before a fixed countdown ends; measured 2026-11-08 on the
   mux glove, a real fist moved the strips only 25-39 % and the loosening tail
   alone was enough to land under DEV_FLEXCAL_MIN_RATIO. Bending lowers the
   count (see devFlexSpan), so most bent = lowest windowed median. */
function devFlexCalCapture(mode, poseSamples){
  const b = dev.status && dev.status.banner;
  const W = DEV_FLEXCAL_WINDOW;
  const out = {};
  dev.channels.forEach((name, i) => {
    if(devKind(i) !== "flex") return;
    const buf = dev.series[i] || [];
    if(buf.length < W / 2) return;
    let adc = devMedian(buf.slice(-W));
    if(mode === "bent"){
      const tail = buf.slice(-Math.max(W, poseSamples || W));
      for(let s = 0; s + W <= tail.length; s += 10){
        const m = devMedian(tail.slice(s, s + W));
        if(m !== null && m < adc) adc = m;
      }
    }
    const r = devOhm(adc, b, devRFixed(i));
    if(r !== null && r > 0) out[name] = r;
  });
  return out;
}
/* Store the strips whose two poses differ enough to be travel; report the rest
   rather than quietly keeping a span made of noise. */
function devFlexCalSave(flat, bent){
  const ok = [], weak = [];
  const store = devFlexCalStore();
  for(const name of Object.keys(flat)){
    const f = flat[name], k = bent[name];
    if(!k || Math.max(f, k) / Math.min(f, k) < DEV_FLEXCAL_MIN_RATIO){ weak.push(name); continue; }
    store[name] = {flat: f, bent: k, fw: devFirmware()};
    ok.push(name);
  }
  try { localStorage.setItem(devFlexCalKey(), JSON.stringify(store)); } catch(e){}
  return {ok, weak};
}
function devFirmware(){
  const b = dev.status && dev.status.banner;
  return b ? b.fw : null;
}
window.devFlexCal = {capture: devFlexCalCapture, save: devFlexCalSave};

// Linear in resistance, mirroring flex.bend_fraction(). Clamped at both ends:
// past the span the sensor has left the range that was recorded, and
// extrapolating would invent travel nobody measured.
function devBend(ohm, span){
  if(!span || ohm === null || ohm === undefined || ohm <= 0) return null;
  const {flat, bent} = span;
  if(bent === flat) return null;
  return Math.max(0, Math.min(1, (ohm - flat) / (bent - flat))) * 100;
}
function devBendRange(ohm, span){
  if(!span || ohm === null || ohm === undefined || ohm <= 0) return "open";
  const lo = Math.min(span.flat, span.bent), hi = Math.max(span.flat, span.bent);
  const flatIsLow = span.flat <= span.bent;
  if(ohm < lo) return flatIsLow ? "below" : "above";
  if(ohm > hi) return flatIsLow ? "above" : "below";
  return "in";
}
function devBendText(pct){
  if(pct === null || pct === undefined) return "—";
  return t("{pct}% bend", {pct: pct.toFixed(0)});
}
// An uncalibrated span must never look like a measurement, and the badge has
// to say WHICH span produced the number.
function devBendBadge(range, span){
  const basis = span ? span.basis : null;
  if(range === "open" || !basis){
    return devTag("dev-badge-dim", "no signal", t("no signal"));
  }
  if(basis === "provisional"){
    return devTag("dev-badge-warn", "provisional", t("provisional span — bend the sensor to set its range"));
  }
  if(range === "below" || range === "above"){
    // On an observed span this cannot persist: the span grows to include the
    // new extreme on the next frame. On a calibrated one it is a real warning.
    return devTag("dev-badge-warn", "re-record", range === "below"
      ? t("flatter than recorded — re-record span")
      : t("bent than recorded — re-record span"));
  }
  return basis === "calibrated"
    ? devTag("dev-badge-ok", "calibrated", t("calibrated span"))
    : devTag("dev-badge-warn", "uncalibrated", t("observed span — not calibrated"));
}

/* Which channels get which curve. The kind comes from the firmware's banner
   (chan=name:kind:rFixed); the f./p. name check is the fallback for boards
   still running firmware that predates that field. Getting this wrong is the
   bug this whole branch exists to prevent: the FSR402 force curve applied to
   a bending finger prints a confident newton figure that means nothing. */
function devKind(i){
  const b = dev.status && dev.status.banner;
  if(b && b.chan && b.chan[i] && b.chan[i].kind) return b.chan[i].kind;
  const n = dev.channels[i] || "";
  if(n[0] === "f") return "flex";
  if(n[0] === "p") return "fsr";
  if(n[0] === "h") return "flexiforce";
  return "unknown";
}
// Per-channel resistor, for the same reason: the FSR and the flex strip sit on
// different low-side resistors and sharing one mis-scales whichever lost.
function devRFixed(i){
  const b = dev.status && dev.status.banner;
  if(b && b.chan && b.chan[i] && b.chan[i].r_fixed > 0) return b.chan[i].r_fixed;
  return b ? b.r_fixed : 10000;
}

/* -- onboard IMU ----------------------------------------------------
   Motion channels are NOT divider sensors. They carry no low-side resistor,
   so every ohm/force/bend helper above is meaningless for them - applying one
   would print a confident resistance for an acceleration, the same class of
   bug the fsr/flex split exists to prevent. They convert with one scale from
   the banner and nothing else. */
function devIsImu(kind){ return kind === "accel" || kind === "gyro"; }
function devImuScale(){
  const b = dev.status && dev.status.banner;
  return (b && b.imu_scale > 0) ? b.imu_scale : 1000;
}
// Raw milli-units -> g or deg/s. Never hardcode the divisor: the banner owns it.
function devImuVal(raw){
  if(raw === null || raw === undefined) return null;
  return raw / devImuScale();
}
function devImuUnit(kind){ return kind === "gyro" ? " \u00B0/s" : " g"; }
function devImuFS(kind){ return kind === "gyro" ? DEV_GYRO_FS : DEV_ACCEL_FS; }
function devImuText(v, kind){
  if(v === null || v === undefined) return "\u2014";
  return (kind === "gyro" ? v.toFixed(0) : v.toFixed(2)) + devImuUnit(kind);
}

/* Median-of-N, for the DISPLAY ONLY.

   At the top of the FSR's range the force curve is steep enough that one ADC
   count is worth about a newton, so ordinary count noise reads as large force
   swings. A median rejects those single-sample spikes without smearing real
   edges the way a moving average would.

   This must never touch recorded data. Jitter is signal — tremor and
   micro-instability are precisely what this suite measures (plan §2, and the
   same rule spiral_test.py enforces on the raw fingertip). Recording happens
   server-side from raw frames and does not pass through here. */
const DEV_SMOOTH_N = 5;

/* ── the bend span's own accumulator ───────────────────────────────────
   dev.span is the RAW min/max, and it has to stay raw: it feeds the peak
   readout, and a peak must never be quietly lowered by a display filter.

   But the same raw min/max was also serving as the denominator for bend %,
   and those two jobs want opposite things. A denominator built from raw
   extremes is destroyed by a single sample:

     * Measured 2026-09-20 on a 150 s recording, an untouched sensor's own
       noise gave a raw min/max ratio of 1.377 — above MIN_SPAN_RATIO — so
       pure jitter was promoted to an "observed span" and then mapped across
       the full 0-100%. That is the trace filling the plot while nothing is
       being bent.
     * Worse, the span only ever widens. One touch transient took it to
       241..4095 counts, and a genuine 11-36 kΩ bend then occupied 3.3% of
       it. That is why a full bend was reading as a move from 1% to 26%.

   So the bend denominator gets its own accumulator, fed a MEDIAN and with
   the ADC rails excluded. This is not a display filter — it decides what the
   number means, which is exactly why it must be robust. */
const DEV_BEND_SPAN_N = 9;       // median width feeding the bend span
const DEV_RAIL_MARGIN = 8;       // counts from either rail = saturation, not travel
/* An OBSERVED span is inferred from live data, so it has to clear a higher
   bar than a span somebody deliberately recorded. flex.py's MIN_SPAN_RATIO
   (1.2) is the latter; at these resistances it is inside the noise. */
const DEV_OBSERVED_MIN_RATIO = 1.5;
function devMedian(values){
  const v = values.filter(x => x !== null && x !== undefined);
  if(!v.length) return null;
  const s = v.slice().sort((a,b)=>a-b);
  return s[Math.floor(s.length/2)];
}
/* Widen a flex channel's bend span, from a median and never from a rail.
   Called per sample; cheap because it only medians the tail of the buffer. */
function devTrackBendSpan(c, buf){
  if(buf.length < DEV_BEND_SPAN_N) return;
  const v = devMedian(buf.slice(-DEV_BEND_SPAN_N));
  if(v === null) return;
  const b = dev.status && dev.status.banner;
  const full = (1 << ((b && b.adc_bits) || 10)) - 1;
  // A reading pinned at either rail is saturation - an open sensor, a short,
  // or a transient - and admitting it would define the span by the fault.
  if(v <= DEV_RAIL_MARGIN || v >= full - DEV_RAIL_MARGIN) return;
  const s = dev.bendSpan[c];
  if(s.min === null || v < s.min) s.min = v;
  if(s.max === null || v > s.max) s.max = v;
}

function devSmoothSeries(data){
  if(!dev.smooth || data.length < DEV_SMOOTH_N) return data;
  const out = new Array(data.length);
  for(let i=0;i<data.length;i++){
    if(data[i] === null){ out[i] = null; continue; }   // keep breaks in the line
    const lo = Math.max(0, i - (DEV_SMOOTH_N - 1));
    out[i] = devMedian(data.slice(lo, i + 1));
  }
  return out;
}

function devPill(state, label, value){
  // Style guide 2.4: never encode meaning in colour alone — icon + word always.
  const map = {ok:["st-yes", I.check], bad:["st-no", I.x], warn:["st-partial", I.minus]};
  const [cls, icon] = map[state] || map.warn;
  return `<span class="dev-pill ${cls}">${icon}<b>${label}</b><span>${value}</span></span>`;
}
function devBtn(id, label, icon, cls){
  return `<button class="btn ${cls || "btn-ghost"}" data-dev="${id}">${icon ? icon+" " : ""}${label}</button>`;
}
/* A status flag: the glyph carries the status colour, the words stay in the
   text colour. No box, no tint, so status never rests on colour alone and
   never turns into a pill. */
const DEV_STATE_ICON = () => ({ok: I.check, warn: I.alert, bad: I.x});
function devFlag(state, text, title){
  return `<span class="dev-flag dev-ck-${state}"${title ? ` title="${esc(title)}"` : ""}>` +
         `${DEV_STATE_ICON()[state] || ""}<span>${text}</span></span>`;
}
/* Segmented choice for the scope bar. data-devopt, not data-dev: devClick
   hands any unknown data-dev id to /api/dev/run as a task. */
function devSeg(opt, label, choices, showLabel){
  return `<div class="dev-seg" role="group" aria-label="${esc(label)}">` +
    (showLabel ? `<span class="dev-seg-lab" aria-hidden="true">${label}</span>` : "") + choices.map(([v, text]) =>
    `<button type="button" data-devopt="${opt}" data-v="${v}" aria-pressed="false">${text}</button>`).join("") +
    `</div>`;
}

async function devPost(path, body){
  try{
    const r = await fetch(path, {method:"POST", headers:{"Content-Type":"application/json"},
                                body: JSON.stringify(body || {})});
    const d = await r.json();
    // Server text is English; tMsg maps the known strings (i18n.zh.js).
    toast(tMsg(d.message) || t(d.ok ? "Done" : "Failed"), d.ok ? "ok" : "fail");
    return d;
  }catch(e){ toast(t("Request failed"), "fail"); return {ok:false}; }
}

/* ── static build ────────────────────────────────────────────────── */

/* Markup only — safe to run again when the language changes. The delegated
   listeners are bound once, separately, or a switch would stack them up. */
function devBuildStatic(){
  const icon = document.getElementById("dev-icon");
  if(icon) icon.innerHTML = I.code;

  // Firmware work, always on offer. Installs appear beside whatever is
  // missing (devRenderEnv); the rarely needed ones live under Details.
  document.getElementById("dev-tasks").innerHTML =
    devBtn("compile", t("Compile firmware")) +
    devBtn("upload", t("Upload firmware")) +
    devBtn("tests", t("Run tests"));
  document.getElementById("dev-tasks-more").innerHTML =
    devBtn("setup", t("Run setup")) +
    devBtn("install_imu_bmi270", t("IMU lib: Rev2 (BMI270)")) +
    devBtn("install_imu_lsm9ds1", t("IMU lib: original (LSM9DS1)"));

  // While connected: recording is the one filled key. The commands only a
  // firmware developer reaches for sit under Board.
  document.getElementById("dev-cmds").innerHTML =
    devBtn("rec", t(dev.status && dev.status.recording ? "Stop recording" : "Record"),
           null, "btn-primary") +
    devBtn("cmd:Z", t("Zero span"));
  document.getElementById("dev-cmds-more").innerHTML =
    devBtn("cmd:?", t("Re-read banner")) +
    devBtn("cmd:S", t("Start stream")) +
    devBtn("cmd:X", t("Stop stream")) +
    devBtn("cmd:D", t("Diagnostics"));

  // One unit at a time, never two y-scales on one plot. Unit stays a
  // <select>: devSyncUnitOptions hides the units no fitted sensor has.
  document.getElementById("dev-scope-tools").innerHTML =
    devSeg("view", t("View"), [["stacked", t("Stacked")], ["overlaid", t("Overlaid")]]) +
    `<label class="dev-sel"><span class="dev-sr">${t("Unit")}</span>
       <select data-dev="unit" aria-label="${esc(t("Unit"))}"><option value="force" selected>${t("Force (N)")}</option>
       <option value="bend" data-kind="flex">${t("Bend (%)")}</option>
       <option value="accel" data-kind="accel">${t("Accel (g)")}</option>
       <option value="gyro" data-kind="gyro">${t("Gyro (°/s)")}</option>
       <option value="adc">${t("Raw ADC")}</option><option value="ohm">${t("Resistance (Ω)")}</option>
       <option value="us">${t("Conductance (µS)")}</option></select></label>` +
    devSeg("window", t("Window"), [2, 5, 10].map(n => [String(n), t("{n} s", {n})])) +
    devSeg("yaxis", t("Y axis"), [["fixed", t("Fixed")], ["auto", t("Auto")]], true) +
    `<div class="dev-seg" title="${esc(t("Median of {n} samples. Display only — recordings stay raw.", {n:DEV_SMOOTH_N}))}">` +
    `<button type="button" data-devopt="smooth" aria-pressed="false">${t("Smooth")}</button></div>` +
    `<span class="dev-bar-gap"></span>` +
    `<button type="button" class="btn btn-ghost dev-pause" data-devopt="pause" aria-pressed="false"></button>`;

  document.getElementById("dev-console-tools").innerHTML =
    `<label class="dev-check"><input type="checkbox" data-dev="autoscroll" checked> ${t("Auto-scroll")}</label>` +
    devBtn("clearconsole", t("Clear"));

  devRestoreControls();
}

/* The rebuilt controls come back on their defaults; put the user's choices
   back so a language switch never silently changes what is being plotted. */
function devRestoreControls(){
  const unit = document.querySelector('[data-dev="unit"]');
  if(unit) unit.value = dev.unit;
  const as = document.querySelector('[data-dev="autoscroll"]');
  if(as) as.checked = dev.autoscroll;
  devSyncOpts();
  devSyncUnitOptions();
}

/* The scope bar's pressed states, read back from `dev`. */
function devSyncOpts(){
  const now = {view: dev.view, window: String(dev.window_s), yaxis: dev.yAuto ? "auto" : "fixed"};
  document.querySelectorAll("#dev-scope-tools [data-devopt]").forEach(b => {
    const k = b.dataset.devopt;
    const on = k === "smooth" ? dev.smooth : k === "pause" ? dev.paused : now[k] === b.dataset.v;
    b.setAttribute("aria-pressed", on ? "true" : "false");
  });
  const p = document.querySelector('[data-devopt="pause"]');
  if(p) p.innerHTML = (dev.paused ? I.play : I.pause) + " " + t(dev.paused ? "Resume" : "Pause");
}
function devSetOpt(k, v){
  if(k === "view") dev.view = v;
  else if(k === "window") dev.window_s = +v;
  else if(k === "yaxis") dev.yAuto = v === "auto";
  else if(k === "smooth") dev.smooth = !dev.smooth;
  else if(k === "pause") dev.paused = !dev.paused;
  devSyncOpts();
}

function devBuild(){
  if(dev.built) return;
  devBuildStatic();

  // One delegated listener for every control on the page.
  document.getElementById("page-dev").addEventListener("click", devClick);
  document.getElementById("page-dev").addEventListener("change", devChange);
  // A closed console has no height to scroll; catch up when it opens.
  document.getElementById("dev-console-fold").addEventListener("toggle", e => {
    if(e.target.open) devRenderConsole();
  });
  devRenderConsole();          // the folded row's "0 lines" readout
  devSimBind();

  dev.built = true;
}

/* ── event handling ──────────────────────────────────────────────── */

async function devClick(e){
  // Scope bar choices first: they must never reach the task fallthrough below.
  const opt = e.target.closest("[data-devopt]");
  if(opt){ devSetOpt(opt.dataset.devopt, opt.dataset.v); return; }

  const btn = e.target.closest("[data-dev]");
  if(!btn || btn.tagName === "SELECT" || btn.tagName === "INPUT") return;
  const id = btn.dataset.dev;

  if(id === "clearconsole"){ dev.console = []; devRenderConsole(); return; }
  if(id === "refreshports"){ await devLoadEnv(); toast(t("Ports refreshed"), "info"); return; }

  /* Bluetooth gloves (fw 0.11.0+) are found by a scan, not by the port
     list's poll: it takes ~5 s, so it runs only when asked, and what it finds
     joins the port list as BLE:<address> entries. */
  if(id === "blescan"){
    if(dev.bleScanning) return;
    dev.bleScanning = true;
    dev.connSig = null; devRenderConn();
    try{
      await devPost("/api/glove/scan");
      await devLoadEnv();
      const hit = ((dev.env && dev.env.ports) || []).find(p => p.transport === "ble");
      if(hit){ dev.port = hit.port; dev.portPinned = true; }
    } finally {
      dev.bleScanning = false;
      dev.connSig = null; devRenderConn();
    }
    return;
  }

  if(id === "connect"){
    const sel = document.querySelector('[data-dev="port"]');
    const d = await devPost("/api/glove/connect", {port: sel ? sel.value : ""});
    if(d.ok) devResetBuffers();
    await devPollStatus();
    return;
  }
  if(id === "simulate"){
    const d = await devPost("/api/glove/connect", {port: DEV_SIM_PORT});
    if(d.ok) devResetBuffers();
    await devPollStatus();
    return;
  }
  if(id === "disconnect"){
    devSimReleaseAll(false);
    await devPost("/api/glove/disconnect");
    await devPollStatus();
    return;
  }

  if(id === "rec"){
    const on = !(dev.status && dev.status.recording);
    await devPost("/api/glove/record", {on});
    await devPollStatus();
    return;
  }
  if(id.startsWith("cmd:")){
    const cmd = id.slice(4);
    await devPost("/api/glove/command", {cmd});
    // The board restarts its counters on Z, so the on-screen spans must too.
    if(cmd === "Z") devResetBuffers();
    return;
  }

  // Remaining ids are dev tasks; upload needs the chosen port.
  const sel = document.querySelector('[data-dev="port"]');
  await devPost("/api/dev/run", {task:id, port: sel ? sel.value : null});
  if(id === "upload"){ devResetBuffers(); setTimeout(devPollStatus, 500); }
  setTimeout(devLoadEnv, 1500);
}

function devChange(e){
  const el = e.target.closest("[data-dev]");
  if(!el) return;
  if(el.dataset.dev === "unit") dev.unit = el.value;
  if(el.dataset.dev === "autoscroll") dev.autoscroll = el.checked;
  if(el.dataset.dev === "port"){
    dev.port = el.value; dev.portPinned = true;
    // Connect's readiness depends on the kind of port picked (USB or BLE).
    dev.connSig = null; devRenderConn();
  }
  if(el.dataset.dev === "chan"){
    const i = +el.dataset.i;
    if(el.checked){
      if(dev.selected.size >= DEV_MAX_SERIES){
        el.checked = false;
        toast(t("Scope shows at most {n} channels — the tiles below cover the rest.",
                {n: DEV_MAX_SERIES}), "info");
        return;
      }
      dev.selected.add(i);
    } else dev.selected.delete(i);
    devRenderLegend();
  }
}

/* ── data ────────────────────────────────────────────────────────── */

function devResetBuffers(){
  dev.lastSeq = -1;
  dev.series = dev.channels.map(()=>[]);
  dev.span = dev.channels.map(()=>({min:null, max:null}));
  dev.bendSpan = dev.channels.map(()=>({min:null, max:null}));
}

function devSetChannels(names){
  const same = names.length === dev.channels.length &&
               names.every((n,i)=> n === dev.channels[i]);
  if(same) return;
  dev.channels = names.slice();
  dev.selected = new Set(names.map((_,i)=>i).slice(0, DEV_MAX_SERIES));
  devResetBuffers();
  devRenderChannelTiles();
  devRenderLegend();
  devSyncUnitOptions();
}

/* Only offer units that some fitted channel can actually be shown in.
   With no flex strip wired, "Bend (%)" previously stayed selectable and drew
   an empty chart — an offered control that does nothing reads as a bug. */
function devSyncUnitOptions(){
  const sel = document.querySelector('[data-dev="unit"]');
  if(!sel) return;
  let hidActive = false;
  for(const opt of sel.options){
    const kind = opt.dataset.kind;
    const ok = !kind || dev.channels.some((_,i) => devKind(i) === kind);
    opt.hidden = !ok;
    opt.disabled = !ok;
    if(!ok && opt.value === dev.unit) hidActive = true;
  }
  // Never leave the page on a unit that just disappeared.
  if(hidActive){ dev.unit = "force"; sel.value = "force"; }
}

async function devPollStatus(){
  try{
    const r = await fetch("/api/glove/status");
    dev.status = await r.json();
    devRenderConn();
    devRenderSim();
    devRenderBanner();
    devRenderHealth();
  }catch(e){}
}

async function devPollSamples(){
  try{
    const r = await fetch(`/api/glove/samples?since=${dev.lastSeq}&max=2000`);
    const d = await r.json();
    if(d.channels && d.channels.length) devSetChannels(d.channels);

    // The stream changed state (stalled, lost, back, ended): refresh the
    // status now rather than on the next 4 s poll, so the pills and the rate
    // never show a healthy stream for seconds after it stopped.
    const linkSig = d.connected + "|" + d.link;
    if(linkSig !== dev.linkSig){ dev.linkSig = linkSig; devPollStatus(); }

    if(d.console && d.console.length){
      dev.console.push(...d.console);
      if(dev.console.length > DEV_CONSOLE_CAP)
        dev.console = dev.console.slice(-DEV_CONSOLE_CAP);
      devRenderConsole();
    }

    if(d.frames && d.frames.length){
      dev.lastSeq = d.frames[d.frames.length-1][0];
      // The glove map fuses the raw IMU columns into an orientation, so it
      // needs every frame in order, not the latest value. Fed even while the
      // scope is paused: pausing freezes the trace, not the hand.
      window.glove3dFeed?.(d.frames, dev.channels);
      if(!dev.paused){
        for(const f of d.frames){
          for(let c=0; c<dev.channels.length; c++){
            const v = f[2+c];
            if(v === undefined) continue;
            const buf = dev.series[c];
            buf.push(v);
            if(buf.length > DEV_CAP) buf.splice(0, buf.length - DEV_CAP);
            const s = dev.span[c];
            if(s.min === null || v < s.min) s.min = v;
            if(s.max === null || v > s.max) s.max = v;
            if(devKind(c) === "flex") devTrackBendSpan(c, buf);
          }
        }
        devRenderChannelValues();
      }
    }
    document.getElementById("dev-scope-empty").style.display =
      (d.connected && dev.series.some(s=>s.length>1)) ? "none" : "";
  }catch(e){}
}

async function devPollImu(){
  try{
    const r = await fetch("/api/glove/imu");
    dev.imu = await r.json();
  }catch(e){ dev.imu = null; }
  devRenderImu();
}

async function devLoadEnv(){
  try{
    const r = await fetch("/api/dev/env");
    dev.env = await r.json();
    devRenderEnv();
    devRenderConn();
  }catch(e){}
}

/* ── rendering ───────────────────────────────────────────────────── */

/* The toolchain as a list of items, each {state, name, value, fix, note}.
   One list feeds the summary line, the fix rows (anything not ok, always
   shown, with its install button beside it) and the Details checklist. */
function devEnvItems(e){
  const missing = e.missing_deps || [];
  const cli = !!e.arduino_cli_present;
  const py = e.python_exe ? e.python_exe.split(/[\\/]/).slice(-3).join("\\") : "?";
  const item = (state, name, value, fix, note) => ({state, name, value, fix: fix || "", note: note || ""});
  const items = [];

  // The interpreter row reports CONSEQUENCES, not identity. A non-venv python
  // with every package importable is fine and must not be flagged red — the
  // old version kept shouting after the underlying problem had been fixed.
  items.push(missing.length
    ? item("bad", t("Interpreter"), t("missing {names}", {names: esc(missing.join(", "))}),
           devBtn("setup", t("Run setup")),
           t("This hub runs <code>{py}</code>{venv}. Restart it with <code>run_hub.bat</code>, " +
             "or install here, into the interpreter it is actually using.",
             {py: esc(py), venv: e.on_venv ? "" : t(", which is not the project's <code>.venv</code>")}))
    : item("ok", t("Interpreter"), `Python ${esc(e.python_version || "?")}${e.on_venv ? " (.venv)" : ""}`));

  items.push(e.pyserial
    ? item("ok", "pyserial", t("Installed"))
    : item("bad", "pyserial", t("Missing"), devBtn("install_pyserial", t("Install pyserial"))));
  // Optional: only a Bluetooth glove needs these, so missing is a warning.
  items.push(e.bleak
    ? item("ok", "bleak", t("Installed"))
    : item("warn", "bleak", t("Missing, needed for Bluetooth"), devBtn("install_bleak", t("Install bleak"))));
  items.push(e.ble_lib
    ? item("ok", "ArduinoBLE", t("Installed"))
    : item("warn", "ArduinoBLE", t("Missing"),
           cli ? devBtn("install_arduinoble", t("Install {name}", {name: "ArduinoBLE"})) : ""));
  items.push(cli
    ? item("ok", "arduino-cli", t("Found"))
    : item("bad", "arduino-cli", t("Not found"), "",
           t("Expected in <code>%LOCALAPPDATA%\\Programs\\arduino-cli\\</code> or on PATH.")));
  items.push(e.mbed_core
    ? item("ok", t("mbed_nano core"), t("Installed"))
    : item("bad", t("mbed_nano core"), t("Missing"), "",
           t("Install it with <code>arduino-cli core install arduino:mbed_nano</code>.")));
  items.push(devImuItem(e, item, cli));
  items.push(e.sketch_present
    ? item("ok", t("Sketch"), "glove.ino")
    : item("bad", t("Sketch"), t("Missing")));
  return items;
}

/* Which IMU the SKETCH is set to build against, and whether that library is
   installed. The selection is a one-line #define in glove.ino chosen by board
   revision (plan §1.3), so "installed" on its own answers the wrong question:
   what matters is whether the compile will find the header it asks for. */
function devImuItem(e, item, cli){
  const sel = e.imu_selected;
  if(!sel) return item("warn", "IMU", t("Sketch selection unreadable"));
  if(sel === "none") return item("warn", "IMU", t("Sketch builds without motion"));
  // The external MPU6050 is driven by register in glove.ino: nothing to install.
  if(sel === "MPU6050") return item("ok", "IMU", t("{imu} on A4/A5, no library needed", {imu: sel}));
  if(e.imu_ready) return item("ok", "IMU", esc(sel));
  // A compile blocker, not a runtime one: the sketch asks for a header that
  // is not there, and says so rather than quietly building without motion.
  const task = {BMI270: "install_imu_bmi270", LSM9DS1: "install_imu_lsm9ds1"}[sel];
  return item("bad", "IMU", t("{imu} selected, not installed", {imu: esc(sel)}),
              cli && task ? devBtn(task, t("Install {name}", {name: esc(sel)})) : "",
              t("Compiling will fail on the missing header. If this is the wrong chip for this " +
                "board, change the <code>#define GLOVE_IMU_…</code> line at the top of " +
                "<code>firmware/glove/glove.ino</code>."));
}

function devRenderEnv(){
  const e = dev.env; if(!e) return;
  const items = devEnvItems(e);
  const bad = items.filter(i => i.state === "bad").length;
  const warn = items.filter(i => i.state === "warn").length;
  const icon = s => DEV_STATE_ICON()[s];

  const [state, word] = bad ? ["bad", t("{n} to fix", {n: bad})]
                      : warn ? ["warn", t("{n} to check", {n: warn})]
                      : ["ok", t("Ready")];
  const sel = e.imu_selected && e.imu_selected !== "none" ? e.imu_selected : null;
  const facts = [`Python ${e.python_version || "?"}`, (e.fqbn || "").split(":").pop(), sel]
    .filter(Boolean).map(esc).join(" · ");
  document.getElementById("dev-env-sum").innerHTML =
    `<span class="dev-read-v dev-ck-${state}">${icon(state)}${word}</span>` +
    `<span class="dev-val" title="${esc([e.fqbn, e.python_exe].filter(Boolean).join("\n"))}">${facts}</span>`;

  // Everything, as name-over-value pairs, for whoever opens the row.
  document.getElementById("dev-env").innerHTML = items.map(i =>
    `<div class="dev-spec-i dev-ck-${i.state}"><dt>${icon(i.state)}${i.name}</dt><dd>${i.value}</dd></div>`).join("");

  // What needs doing, always in view, each with its own fix.
  document.getElementById("dev-env-fix").innerHTML = items.filter(i => i.state !== "ok").map(i =>
    `<div class="dev-fix-row dev-ck-${i.state}"><span class="dev-fix-name">${icon(i.state)}${i.name}</span>` +
    `<span class="dev-fix-val">${i.value}</span>${i.fix}` +
    (i.note ? `<p class="dev-fix-note">${i.note}</p>` : "") + `</div>`).join("");
}

/* ── simulated glove (core/glove/sim.py) ─────────────────────────────
   For working on this page without the glove. The hub runs a stand-in
   board that speaks the firmware's protocol, so the scope, tiles, glove map,
   Motion card and recording are all fed exactly as by the glove. This panel
   only tells it which controls are held.

   Keys are matched on e.code, the physical key, so the layout holds under
   any keyboard layout and with the Chinese IME on. `ctl` names are the
   contract with sim.CONTROLS (test_glove.py checks every one exists there),
   except the two the page keeps for itself: "hard" rides as a flag on the
   POST, and "tremor" toggles the tremor settings. */
const DEV_SIM_PORT = "SIM";
const DEV_SIM_BEAT_MS = 300;   // resend while held: the sim lets go after 1 s of silence
const DEV_SIM_KEYS = [
  {code:"Digit1", cap:"1", ctl:"bend0",  group:"bend",   label:"thumb"},
  {code:"Digit2", cap:"2", ctl:"bend1",  group:"bend",   label:"index"},
  {code:"Digit3", cap:"3", ctl:"bend2",  group:"bend",   label:"middle"},
  {code:"Digit4", cap:"4", ctl:"bend3",  group:"bend",   label:"ring"},
  {code:"Digit5", cap:"5", ctl:"bend4",  group:"bend",   label:"pinky"},
  {code:"KeyG",   cap:"G", ctl:"fist",   group:"bend",   label:"fist"},
  {code:"KeyQ",   cap:"Q", ctl:"press0", group:"press",  label:"thumb"},
  {code:"KeyW",   cap:"W", ctl:"press1", group:"press",  label:"index"},
  {code:"KeyE",   cap:"E", ctl:"press2", group:"press",  label:"middle"},
  {code:"KeyR",   cap:"R", ctl:"press3", group:"press",  label:"ring"},
  {code:"ShiftLeft", alt:["ShiftRight"], cap:"Shift", ctl:"hard", group:"press", label:"press hard"},
  {code:"ArrowUp",    cap:"↑", ctl:"pitch+", group:"move", label:"fingers up"},
  {code:"ArrowDown",  cap:"↓", ctl:"pitch-", group:"move", label:"fingers down"},
  {code:"ArrowLeft",  cap:"←", ctl:"roll-",  group:"move", label:"roll left"},
  {code:"ArrowRight", cap:"→", ctl:"roll+",  group:"move", label:"roll right"},
  {code:"KeyZ",   cap:"Z", ctl:"yaw+",   group:"move",   label:"turn left"},
  {code:"KeyX",   cap:"X", ctl:"yaw-",   group:"move",   label:"turn right"},
  {code:"KeyL",   cap:"L", ctl:"level",  group:"move",   label:"level"},
  {code:"KeyT",   cap:"T", ctl:"tremor", group:"tremor", label:"tremor on/off"},
];
const DEV_SIM_BY_CODE = {};
for(const k of DEV_SIM_KEYS) for(const c of [k.code, ...(k.alt || [])]) DEV_SIM_BY_CODE[c] = k;
const DEV_SIM_GROUPS = [
  {id:"bend",   title:"Bend a finger"},
  {id:"press",  title:"Press a fingertip"},
  {id:"move",   title:"Move the hand"},
  {id:"tremor", title:"Tremor"},
];

dev.sim = {
  held: new Set(),             // controls held by key or pointer, incl. "hard"
  pointers: new Map(),         // pointerId -> control, for press-and-hold keycaps
  tremor: {on: false, hz: 5, mg: 60},
  range: {hz: [2, 14], mg: [5, 400]},
  synced: false,               // tremor settings read back from the hub once
  sig: null, beat: null, inflight: false, dirty: false,
};

function devIsSim(){ return !!(dev.status && dev.status.simulated); }
// Keys only steer the simulator while this page is running and it is on.
function devSimArmed(){ return !!dev.fastTimer && devIsSim(); }
// Where a key belongs to the page instead: text entry, a <select>, an open
// session report (which takes the arrows itself).
function devSimFocusTaken(el){
  if(el && el.closest && el.closest(
      'input:not([type=range]):not([type=checkbox]):not([type=button]),select,textarea,[contenteditable=""],[contenteditable="true"]'))
    return true;
  const rep = document.getElementById("report");
  return !!(rep && !rep.hidden);
}

/* Sends are serialised: a keyup posted while the keydown is still in flight
   could otherwise land first and leave the key held at the hub. */
async function devSimSend(){
  if(!devIsSim()) return;
  if(dev.sim.inflight){ dev.sim.dirty = true; return; }
  dev.sim.inflight = true;
  try{
    do{
      dev.sim.dirty = false;
      const held = [...dev.sim.held].filter(c => c !== "hard");
      await fetch("/api/glove/sim", {method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({held, hard: dev.sim.held.has("hard"), tremor: dev.sim.tremor})});
    } while(dev.sim.dirty);
  }catch(e){ /* the next change or heartbeat retries */ }
  finally{ dev.sim.inflight = false; }
}

function devSimChanged(){
  devSimPaint();
  devSimSend();
  const active = dev.sim.held.size > 0;
  if(active && !dev.sim.beat) dev.sim.beat = setInterval(devSimSend, DEV_SIM_BEAT_MS);
  if(!active && dev.sim.beat){ clearInterval(dev.sim.beat); dev.sim.beat = null; }
}

function devSimPress(ctl, down){
  if(ctl === "tremor"){
    if(down){ dev.sim.tremor.on = !dev.sim.tremor.on; devSimChanged(); }
    return;
  }
  if(down === dev.sim.held.has(ctl)) return;
  if(down) dev.sim.held.add(ctl); else dev.sim.held.delete(ctl);
  devSimChanged();
}

/* Let go of everything: on blur, on leaving the page, on stopping the sim. */
function devSimReleaseAll(send = true){
  dev.sim.pointers.clear();
  if(!dev.sim.held.size) return;
  dev.sim.held.clear();
  if(send) devSimChanged();
  else {
    if(dev.sim.beat){ clearInterval(dev.sim.beat); dev.sim.beat = null; }
    devSimPaint();
  }
}

function devSimKey(e, down){
  const k = DEV_SIM_BY_CODE[e.code];
  if(!k || !devSimArmed()) return;
  if(!down){
    // A release always counts, even if focus moved into a field meanwhile.
    if(dev.sim.held.has(k.ctl)){ e.preventDefault(); devSimPress(k.ctl, false); }
    return;
  }
  if(e.ctrlKey || e.altKey || e.metaKey || e.isComposing) return;
  if(devSimFocusTaken(e.target)) return;
  e.preventDefault();               // arrows would scroll the page
  if(e.repeat) return;
  devSimPress(k.ctl, true);
}

/* Built once per simulator session (and on a language switch), then only
   repainted, so the 4 s status poll never rebuilds a slider mid-drag.
   It sits in a side column of the glove map, beside the hand it moves. That
   column exists only while the simulator runs; otherwise the hand takes the
   full width. */
function devRenderSim(){
  const el = document.getElementById("dev-sim");
  if(!el) return;
  const sim = devIsSim();
  const sig = sim ? "on" : "off";
  if(sig !== dev.sim.sig){
    dev.sim.sig = sig;
    document.getElementById("g3d")?.classList.toggle("with-sim", sim);
    if(!sim){
      el.hidden = true; el.innerHTML = "";
      devSimReleaseAll(false);
      dev.sim.synced = false;
      return;
    }
    const s = dev.status.sim;
    if(!dev.sim.synced && s && s.tremor){
      dev.sim.tremor = {on: !!s.tremor.on, hz: s.tremor.hz, mg: s.tremor.mg};
      if(s.tremor.hz_range) dev.sim.range.hz = s.tremor.hz_range;
      if(s.tremor.mg_range) dev.sim.range.mg = s.tremor.mg_range;
      dev.sim.synced = true;
    }
    el.innerHTML = devSimPanelHtml();
    el.hidden = false;
  }
  if(sim) devSimPaint();
}

function devSimPanelHtml(){
  const cap = k => `<button type="button" class="dev-kc${k.cap.length > 1 ? " wide" : ""}" data-sim="${k.ctl}"
      aria-pressed="false"><kbd>${k.cap}</kbd><span>${t(k.label)}</span></button>`;
  const {hz, mg} = dev.sim.tremor, R = dev.sim.range;
  return DEV_SIM_GROUPS.map((g, gi) => {
    let body = `<div class="dev-sim-caps">${DEV_SIM_KEYS.filter(k => k.group === g.id).map(cap).join("")}</div>`;
    if(g.id === "tremor"){
      body += `<div class="dev-sim-sliders">
        <label class="dev-sim-slider">${t("Frequency")}
          <input type="range" data-simset="hz" min="${R.hz[0]}" max="${R.hz[1]}" step="0.5" value="${hz}">
          <output id="dev-sim-hz">${t("{n} Hz", {n: hz})}</output></label>
        <label class="dev-sim-slider">${t("Size")}
          <input type="range" data-simset="mg" min="${R.mg[0]}" max="${R.mg[1]}" step="5" value="${mg}">
          <output id="dev-sim-mg">${t("{n} mg", {n: mg})}</output></label>
      </div>`;
    }
    // The first heading also carries the "keys ready / paused" tag.
    const armed = gi === 0 ? `<span id="dev-sim-armed"></span>` : "";
    return `<div class="dev-sim-group"><div class="dev-sim-gh"><h3>${t(g.title)}</h3>${armed}</div>${body}</div>`;
  }).join("");
}

function devSimPaint(){
  const el = document.getElementById("dev-sim");
  if(!el || el.hidden) return;
  for(const b of el.querySelectorAll("[data-sim]")){
    const ctl = b.dataset.sim;
    const on = ctl === "tremor" ? dev.sim.tremor.on : dev.sim.held.has(ctl);
    b.classList.toggle("on", on);
    b.setAttribute("aria-pressed", on ? "true" : "false");
  }
  const hz = document.getElementById("dev-sim-hz");
  if(hz) hz.textContent = t("{n} Hz", {n: dev.sim.tremor.hz});
  const mg = document.getElementById("dev-sim-mg");
  if(mg) mg.textContent = t("{n} mg", {n: dev.sim.tremor.mg});
  devSimPaintArmed();
}

// Say when the keys are going somewhere else, rather than leave them dead.
function devSimPaintArmed(){
  const el = document.getElementById("dev-sim-armed");
  if(!el) return;
  const taken = devSimFocusTaken(document.activeElement);
  el.innerHTML = taken
    ? devPill("warn", t("Keys"), t("paused — the cursor is in a field"))
    : devPill("ok", t("Keys"), t("ready"));
}

/* Bound once, from devBuild. */
function devSimBind(){
  document.addEventListener("keydown", e => devSimKey(e, true));
  document.addEventListener("keyup", e => devSimKey(e, false));
  window.addEventListener("blur", () => devSimReleaseAll());
  document.addEventListener("visibilitychange", () => { if(document.hidden) devSimReleaseAll(); });
  document.addEventListener("focusin", devSimPaintArmed);
  document.addEventListener("focusout", () => setTimeout(devSimPaintArmed, 0));

  const el = document.getElementById("dev-sim");
  if(!el) return;
  // Keycaps are press-and-hold for a mouse or a finger, like the keys.
  el.addEventListener("pointerdown", e => {
    const b = e.target.closest("[data-sim]");
    if(!b || e.button !== 0 || b.dataset.sim === "tremor") return;
    e.preventDefault();
    try { b.setPointerCapture(e.pointerId); } catch(err){}
    dev.sim.pointers.set(e.pointerId, b.dataset.sim);
    devSimPress(b.dataset.sim, true);
  });
  const lift = e => {
    const ctl = dev.sim.pointers.get(e.pointerId);
    if(ctl === undefined) return;
    dev.sim.pointers.delete(e.pointerId);
    devSimPress(ctl, false);
  };
  el.addEventListener("pointerup", lift);
  el.addEventListener("pointercancel", lift);
  el.addEventListener("lostpointercapture", lift);
  // The toggle is a click, so Enter and Space on a focused keycap work too.
  el.addEventListener("click", e => {
    const b = e.target.closest('[data-sim="tremor"]');
    if(b) devSimPress("tremor", true);
  });
  el.addEventListener("input", e => {
    const s = e.target.closest("[data-simset]");
    if(!s) return;
    dev.sim.tremor[s.dataset.simset] = +s.value;
    devSimPaint();
    devSimSend();
  });
}

/* A port as one short line: Windows repeats the port in its description
   ("Standard Serial over Bluetooth link (COM11)"), so that tail goes. */
function devPortLabel(p){
  if(p.transport === "ble") return `${t("Bluetooth")} · ${esc(p.description || p.port)}`;
  let d = String(p.description || "");
  const tail = "(" + p.port + ")";
  if(d.endsWith(tail)) d = d.slice(0, -tail.length).trim();
  const parts = [p.port];
  if(p.is_glove && !/arduino/i.test(d)) parts.push("Arduino");
  if(d) parts.push(d);
  return parts.map(esc).join(" · ");
}

function devRenderConn(){
  devRenderState();
  const e = dev.env, st = dev.status;
  const connected = !!(st && st.connected);
  const sim = devIsSim();
  const ports = (e && e.ports) || [];

  // Rebuilding this row on every 4 s status poll would reset the <select> and
  // steal focus mid-interaction, so only redraw when something actually moved.
  const sig = JSON.stringify([connected, sim, st && st.port, e && e.pyserial,
                              e && e.bleak, dev.bleScanning,
                              ports.map(p=>p.port + p.is_glove)]);
  if(sig === dev.connSig) return;
  dev.connSig = sig;

  // The simulator is not a serial port, so it only appears in the list while
  // it is the thing connected; it starts from its own button.
  const simOpt = sim ? `<option value="${DEV_SIM_PORT}">${t("Simulated glove")}</option>` : "";
  const opts = simOpt + (ports.length
    ? ports.map(p => `<option value="${esc(p.port)}">${devPortLabel(p)}</option>`).join("")
    : (sim ? "" : `<option value="">${t("No serial ports found")}</option>`));

  // While connected the state line names the port, so the picker and Refresh
  // step aside (.dev-idle). The <select> stays in the DOM: Upload reads it.
  document.getElementById("dev-conn").innerHTML = `
    <label class="dev-sel dev-idle"><span class="dev-sr">${t("Port")}</span>
      <select data-dev="port" aria-label="${esc(t("Port"))}" ${connected?"disabled":""}>${opts}</select></label>
    <button class="btn btn-ghost dev-icon-btn dev-idle" data-dev="refreshports"
      aria-label="${esc(t("Refresh"))}" title="${esc(t("Refresh"))}">${I.refresh}</button>
    ${connected
      ? devBtn("disconnect",t(sim ? "Stop simulation" : "Disconnect"), I.stop, "btn-ghost dev-key-stop")
      : devBtn("connect",t("Connect"), I.play, "btn-primary") +
        devBtn("blescan", t(dev.bleScanning ? "Scanning…" : "Scan Bluetooth")) +
        devBtn("simulate",t("Simulate glove"), I.hand)}`;

  // Restore the port: what the board reports, else a pick the user actually
  // made, else the one that looks like an Arduino. The pin is what separates
  // those last two -- dev.port is also written from whatever the box happened
  // to be showing, so without it a board plugged in while this page was
  // already open loses to the Bluetooth port that was sitting in the select,
  // and each Refresh re-selects that dead port instead of the Arduino.
  // A pinned port that has gone away releases the pin rather than holding a
  // selection that cannot be opened: flashing re-enumerates the board on a
  // different COM number (GLOVE_FIRMWARE_PLAN.md 7.2), so the port the user
  // picked by hand a minute ago is routinely not the port it is on now.
  const sel = document.querySelector('[data-dev="port"]');
  if(sel){
    const has = v => !!v && [...sel.options].some(o => o.value === v);
    if(dev.portPinned && !has(dev.port)) dev.portPinned = false;
    const want = (st && st.port) ||
                 (dev.portPinned ? dev.port : null) ||
                 (ports.find(p => p.is_glove) || {}).port;
    if(has(want)) sel.value = want;
    dev.port = sel.value;
  }
  // Connect needs the library for the kind of port selected: pyserial for a
  // COM port, bleak for a Bluetooth glove.
  const cbtn = document.querySelector('[data-dev="connect"]');
  if(cbtn){
    const viaBle = (sel ? sel.value : "").startsWith("BLE:");
    const ready = viaBle ? !!(e && e.bleak) : !!(e && e.pyserial);
    cbtn.disabled = !ready;
    cbtn.title = ready ? "" : t(viaBle ? "Install bleak first, under Toolchain below."
                                       : "Install pyserial first, under Toolchain below.");
  }
  const sbtn = document.querySelector('[data-dev="blescan"]');
  if(sbtn){
    sbtn.disabled = !!dev.bleScanning || !(e && e.bleak);
    if(!(e && e.bleak)) sbtn.title = t("Install bleak first, under Toolchain below.");
  }
}

/* The Connection row's readout: the state in words, what it is connected
   to, and a line under it for each problem. Also sets the card's data-state,
   which shows or hides the connected-only rows and keys. */
function devRenderState(){
  const e = dev.env, st = dev.status;
  const connected = !!(st && st.connected);
  const b = st && st.banner;
  const state = !connected ? "off" : devIsSim() ? "sim" : "on";
  const card = document.getElementById("dev-card");
  if(card && card.dataset.state !== state) card.dataset.state = state;

  let word, aside = "";
  if(state === "sim"){
    // Real as a connection, not as data, and it says so beside the name.
    word = t("Simulated glove");
    aside = devFlag("warn", t("not real data"));
  } else if(state === "on"){
    word = t("Connected");
    const via = st.transport === "ble"
      ? `${t("Bluetooth")} ${esc((st.port || "").slice(4))}${st.ble_mtu ? ` · MTU ${st.ble_mtu}` : ""}`
      : esc(st.port || "");
    aside = `<span class="dev-val">${[via, b && b.fw ? "fw " + esc(b.fw) : ""].filter(Boolean).join(" · ")}</span>`;
  } else {
    word = t("Disconnected");
    // "Cannot tell" is its own state. Without pyserial there is no way to look
    // at the USB bus, so claiming "not plugged in" would be a false negative.
    if(e) aside = `<span class="dev-aside">${e.board_detected === null ? t("Board unknown, needs pyserial")
                  : t(e.board_detected ? "Board detected" : "Board not plugged in")}</span>`;
  }

  // Board is folded, so what in it needs attention is raised up here.
  const flags = [devLinkFlag(st)];
  if(connected && b){
    if(!b.supported) flags.push(devFlag("warn", t("Protocol {p} unsupported", {p: esc(b.proto)})));
    if(b.rst && /lockup|dog/.test(b.rst))
      flags.push(devFlag("warn", t("Last reset: {why}", {why: esc(devResetText(b.rst))})));
  }

  const head = `<b class="dev-read-v">${word}</b>${aside}`;
  const lines = flags.filter(Boolean).join("");
  if(head + lines === dev.stateHtml) return;    // an unchanged line keeps its hovered tooltip
  dev.stateHtml = head + lines;
  document.getElementById("dev-conn-state").innerHTML = head;
  document.getElementById("dev-conn-flags").innerHTML = lines;
}

/* What the hub's reader knows about the stream (core/glove/serial_io.py,
   "link health"). Before this the page could not tell a lost port, a board
   blocked on an unread port and a hung board apart: the traces stopped and
   every pill stayed green. Nothing is shown while the stream is fine. */
const DEV_LINK = {
  stalled:      ["warn", "No data — reopening the port"],
  unresponsive: ["bad",  "Board not responding — press its reset button or replug it"],
  lost:         ["bad",  "Port lost — reconnecting"],
};
function devLinkFlag(st){
  if(!st) return "";
  const known = st.connected && DEV_LINK[st.link];
  // The cause (e.g. the read error) rides in the tooltip: the flag says what
  // to do, the error says why.
  if(known) return devFlag(known[0], t(known[1]), st.last_error ? tMsg(st.last_error) : "");
  // Ended on its own (the hub gave up on a lost port): say why it is off.
  if(!st.connected && st.last_error)
    return devFlag("bad", `${t("Last error")}: ${esc(tMsg(st.last_error))}`);
  return "";
}

/* fw 0.10.3+ reports why it last booted. A freeze that ended in a reboot
   reads here as a power dip (por), the reset button (pin) or a crash. */
const DEV_RESET = {
  pin: "reset button", por: "power-on or brown-out",
  sreq: "software reset (e.g. after an upload)", lockup: "CPU lockup (crash)",
  dog: "watchdog", off: "wake from System OFF", vbus: "USB power",
};
function devResetText(rst){
  return String(rst).split("+").map(k => DEV_RESET[k] ? t(DEV_RESET[k]) : k).join(" + ");
}

/* Board: what the firmware announced, folded under one line. The fold is
   static markup (index.html), so the 4 s poll refills it without closing it,
   and only when the banner actually changed. The pairs sit on a transparent
   grid: a short last row leaves empty space, never a filled block. */
function devRenderBanner(){
  const b = dev.status && dev.status.banner;
  const sig = JSON.stringify(b || null);       // onLang clears it
  if(sig === dev.bannerSig) return;
  dev.bannerSig = sig;
  const el = document.getElementById("dev-banner");
  const meta = document.getElementById("dev-board-meta");
  if(!b){
    // Connected but silent (an old firmware, or the banner was missed). The
    // Re-read banner key sits right under this, in the opened row.
    meta.textContent = t("No banner yet");
    el.innerHTML = "";
    return;
  }
  meta.textContent = [b.board, b.rate ? b.rate + " Hz" : "", b.imu ? "IMU " + b.imu : ""]
    .filter(Boolean).join(" · ");
  const rows = [
    [t("Firmware"), esc(b.fw)],
    [t("Protocol"), esc(b.proto) + (b.supported ? t(" (supported)") : t(" (UNSUPPORTED)"))],
    [t("Board"), esc(b.board)], [t("Rate"), esc(b.rate) + " Hz"],
    ["ADC", t("{bits}-bit @ {mv} mV", {bits: esc(b.adc_bits), mv: esc(b.adc_ref_mv)})],
    [t("Divider"), esc(b.vdiv_mv) + " mV / " + esc(b.r_fixed) + " Ω"],
    ["IMU", esc(b.imu)],
  ];
  if(b.rst) rows.push([t("Last reset"), esc(devResetText(b.rst))]);
  // Channels is the long one: it gets the full width, as plain tokens.
  rows.push([t("Channels"), esc((b.channels || []).join("  ")) || "—", "dev-spec-wide"]);
  el.innerHTML = rows.map(([k, v, cls]) =>
    `<div class="dev-spec-i${cls ? " " + cls : ""}"><dt>${k}</dt><dd>${v}</dd></div>`).join("");
}

function devRenderLegend(){
  const el = document.getElementById("dev-legend");
  const sel = [...dev.selected].sort((a,b)=>a-b);
  if(!dev.channels.length || sel.length < 2){ el.innerHTML = ""; return; }
  // A legend is always present for >= 2 series; the name sits beside the
  // swatch so identity never rides on colour alone.
  el.innerHTML = sel.map(i =>
    `<span class="dev-key"><i style="background:${DEV_SERIES[i % DEV_MAX_SERIES]}"></i>${dev.channels[i]}</span>`).join("");
}

function devRenderChannelTiles(){
  const el = document.getElementById("dev-channels");
  dev.groupSig = dev.channels.map((_, i) => devGroupOf(i)).join();
  if(!dev.channels.length){
    el.innerHTML = `<div class="dev-banner-empty">${t("No channels yet.")}</div>`;
    return;
  }
  // One group per sensor type, one row per channel. The raw counts behind a
  // reading sit in the row's tooltip.
  const byGroup = new Map(DEV_GROUPS.map(([k]) => [k, []]));
  dev.channels.forEach((_, i) => byGroup.get(devGroupOf(i)).push(i));
  el.innerHTML = DEV_GROUPS.filter(([k]) => byGroup.get(k).length).map(([k, label]) => `
    <section class="dev-group" data-group="${k}">
      <div class="dev-group-head">
        <span class="dev-group-title">${t(label)}</span>
        ${k === "fsr" || k === "flex" ? `<span class="dev-chan-kind">${t(k)}</span>`
          : k === "flexiforce" ? `<span class="dev-chan-kind">A401</span>` : ""}
      </div>
      ${byGroup.get(k).map(i => {
        const c = DEV_SERIES[i % DEV_MAX_SERIES];
        return `<div class="dev-row" id="dev-row-${i}">
        <label class="dev-check dev-row-name"><input type="checkbox" data-dev="chan" data-i="${i}"
          ${dev.selected.has(i)?"checked":""}> <i class="dev-swatch" style="background:${c}"></i>${dev.channels[i]}</label>
        <span class="dev-row-val" id="dev-force-${i}">&#8212;</span>
        <span class="dev-row-sub" id="dev-gram-${i}"></span>
        <div class="dev-chan-bar"><i id="dev-bar-${i}" style="background:${c}"></i><u id="dev-barpk-${i}"></u></div>
        <span class="dev-row-peak" id="dev-span-${i}">${t("peak")} &#8212;</span>
        <span class="dev-row-badge" id="dev-badge-${i}"></span>
      </div>`;}).join("")}
    </section>`).join("");
}

const DEV_GROUPS = [["fsr", "Force"], ["flexiforce", "Palm force"], ["flex", "Bend"], ["accel", "Acceleration"],
                    ["gyro", "Rotation"], ["unknown", "Other"]];
function devGroupOf(i){
  const k = devKind(i);
  return DEV_GROUPS.some(g => g[0] === k) ? k : "unknown";
}

function devSetRowTip(i, text){
  const row = document.getElementById("dev-row-" + i);
  if(row && row.title !== text) row.title = text;
}

/* Fraction of the tile bar to fill, 0-1, for the current reading and the peak.
   Force scales against the FSR402's rated band and bend against its span, so
   in both cases "full bar" means "top of what this part is specified for". */
function devSetBar(i, kind, ohm, b, rf){
  const fill = document.getElementById("dev-bar-" + i);
  const notch = document.getElementById("dev-barpk-" + i);
  if(!fill && !notch) return;

  const {cur, peak} = devFractions(i, kind, ohm, b, rf);
  const pct = x => (x === null ? 0 : Math.max(0, Math.min(1, x)) * 100).toFixed(1) + "%";
  if(fill) fill.style.width = pct(cur);
  if(notch){
    notch.style.display = peak === null ? "none" : "block";
    notch.style.left = pct(peak);
  }
}

/* The same two fractions, without the DOM. Shared by the tile bars and the
   3D glove map (glove3d.js), so "how full" means one thing on both. */
function devFractions(i, kind, ohm, b, rf){
  let cur = null, peak = null;
  if(devIsImu(kind)){
    // Signed value, unsigned bar: the tile shows HOW MUCH this axis is moving,
    // and the number above it carries the direction.
    const fs = devImuFS(kind);
    const buf = dev.series[i] || [];
    const last = buf.length ? devImuVal(buf[buf.length-1]) : null;
    cur = last === null ? null : Math.abs(last) / fs;
    const s = dev.span[i];
    if(s && s.min !== null){
      peak = Math.max(Math.abs(devImuVal(s.min)), Math.abs(devImuVal(s.max))) / fs;
    }
  } else if(kind === "flex"){
    const sp = devFlexSpan(i);
    cur = devBend(ohm, sp);
    const s = dev.span[i];
    if(s && s.min !== null) peak = devBend(devOhm(s.min, b, rf), sp);
    cur = cur === null ? null : cur / 100;
    peak = peak === null ? null : peak / 100;
  } else if(kind === "fsr"){
    const m = devForceModel();
    const max = (m && m.rated_max_n) || 20;
    const n = devForce(ohm);
    cur = n === null ? null : n / max;
    const s = dev.span[i];
    if(s && s.max !== null){
      const pn = devForce(devOhm(s.max, b, rf));
      peak = pn === null ? null : pn / max;
    }
  } else if(kind === "flexiforce"){
    // No calibration to scale against yet, so the bar is the share of the
    // ADC's range the divider has reached: measured, not a force estimate.
    const adcMax = b ? (1 << b.adc_bits) - 1 : 1023;
    const buf = dev.series[i] || [];
    cur = buf.length ? buf[buf.length-1] / adcMax : null;
    const s = dev.span[i];
    if(s && s.max !== null) peak = s.max / adcMax;
  }
  return {cur, peak};
}

/* What the 3D glove map (glove3d.js, an ES module) reads each tick. Every
   number here goes through the same conversions as the channel tiles, so the
   map cannot show a force the tile does not. The map only decides WHERE a
   channel sits; it never converts a count itself. */
function devGloveSnapshot(){
  const b = dev.status && dev.status.banner;
  const channels = dev.channels.map((name, i) => {
    const kind = devKind(i);
    if(devIsImu(kind)) return {name, kind};
    const buf = dev.series[i] || [];
    if(!buf.length) return {name, kind, cur: null, peak: null, text: "—", state: "waiting"};
    const v = dev.smooth ? devMedian(buf.slice(-DEV_SMOOTH_N)) : buf[buf.length-1];
    const rf = devRFixed(i);
    const ohm = devOhm(v, b, rf);
    const {cur, peak} = devFractions(i, kind, ohm, b, rf);
    let text, state = "live", basis = null, pct = null;
    if(kind === "flex"){
      const span = devFlexSpan(i);
      basis = span ? span.basis : null;
      // The map's "% past the fingertip" is this number, never re-parsed from
      // the translated text, so it always matches the tile.
      pct = devBend(ohm, span);
      text = devBendText(pct);
    } else if(kind === "fsr"){
      const n = devForce(ohm);
      text = devForceText(n);
      if(devForceRange(n) === "above") state = "above";
    } else if(kind === "flexiforce"){
      text = devUsText(ohm);
      state = "uncalibrated";
    } else {
      text = devOhmText(ohm);
      state = "raw";
    }
    return {name, kind, cur, peak, text, state, basis, pct};
  });
  return {connected: !!(dev.status && dev.status.connected), channels, imu: dev.imu};
}
window.devGloveSnapshot = devGloveSnapshot;

/* One motion channel's tile: value, full-scale bar, and the extreme seen
   since the last Z. Peak is |value|: an accelerometer swings both ways, and
   taking the maximum alone would report a hand that only ever accelerated
   downward as having done nothing. */
function devRenderImuChannel(i, kind){
  const buf = dev.series[i];
  if(!buf || !buf.length) return;
  const raw = dev.smooth ? devMedian(buf.slice(-DEV_SMOOTH_N)) : buf[buf.length-1];
  const v = devImuVal(raw);
  const fs = devImuFS(kind);
  const set = (id, text) => { const el = document.getElementById(id+i); if(el) el.textContent = text; };

  set("dev-force-", devImuText(v, kind));
  const bd = document.getElementById("dev-badge-"+i);
  const b = dev.status && dev.status.banner;
  const imuName = b && b.imu ? b.imu : "IMU";
  const where = imuName === "sim" ? "simulated IMU"
              : imuName === "MPU6050" ? "{imu} on A4/A5" : "onboard {imu}";
  const tag = devTag("dev-badge-dim", imuName === "sim" ? "simulated" : imuName, t(where, {imu: imuName}));
  if(bd && bd.innerHTML !== tag) bd.innerHTML = tag;
  devSetRowTip(i, `${t(kind === "gyro" ? "rotation rate" : "proper acceleration")}\n` +
    `${raw} m${kind === "gyro" ? "dps" : "g"} \u00b7 ${t("bar")} \u00b1${fs}${devImuUnit(kind)}`);

  devSetBar(i, kind, null, b, null);

  const sp = document.getElementById("dev-span-"+i);
  const s = dev.span[i];
  if(sp){
    if(!s || s.min === null) sp.textContent = t("peak") + " \u2014";
    else {
      const peak = Math.max(Math.abs(devImuVal(s.min)), Math.abs(devImuVal(s.max)));
      sp.textContent = `${t("peak")} \u00b1${devImuText(peak, kind)}`;
    }
  }
}

function devRenderChannelValues(){
  const b = dev.status && dev.status.banner;
  // Kinds can arrive with the banner after the channel names; regroup then.
  if(dev.channels.map((_, i) => devGroupOf(i)).join() !== dev.groupSig) devRenderChannelTiles();
  for(let i=0;i<dev.channels.length;i++){
    const buf = dev.series[i];
    if(!buf || !buf.length) continue;
    const kind = devKind(i);
    const rf = devRFixed(i);

    // Motion channels leave before any divider maths happens. Not a style
    // choice: mv/ohm/force computed from an acceleration are numbers with no
    // meaning, and a tile that prints them is worse than one that prints
    // nothing.
    if(devIsImu(kind)){ devRenderImuChannel(i, kind); continue; }
    // Smoothing applies to the headline number as well as the trace, so the
    // tile and the plot never disagree about what is on screen.
    const v = dev.smooth
      ? devMedian(buf.slice(-DEV_SMOOTH_N))
      : buf[buf.length-1];
    const ohm = devOhm(v, b, rf);
    const us = ohm ? 1e6/ohm : null;

    const set = (id, text) => { const el = document.getElementById(id+i); if(el) el.textContent = text; };
    const bd = document.getElementById("dev-badge-"+i);

    // Branch by sensor kind. The FSR402 force curve is meaningless for a bend
    // sensor — applying it anyway would print confident newtons for a bending
    // finger, which is exactly the kind of dressed-up guess this project
    // refuses to show.
    if(kind === "flex"){
      const span = devFlexSpan(i);
      const pct = devBend(ohm, span);
      set("dev-force-", devBendText(pct));
      set("dev-gram-", devOhmText(ohm));
      if(bd) bd.innerHTML = devBendBadge(devBendRange(ohm, span), span);
    } else if(kind === "fsr"){
      const n = devForce(ohm);
      set("dev-force-", devForceText(n));
      set("dev-gram-", devGramsText(n) || "—");
      if(bd) bd.innerHTML = devForceBadge(devForceRange(n));
    } else if(kind === "flexiforce"){
      // A401: linear in conductance, so that is the headline. Newtons wait for
      // this pad's own calibration; the FSR402 curve never applies to it.
      set("dev-force-", devUsText(ohm));
      set("dev-gram-", devOhmText(ohm));
      const tag = devTag("dev-badge-dim", "uncalibrated",
        t("A401 — no force calibration yet; conductance rises linearly with force"));
      if(bd && bd.innerHTML !== tag) bd.innerHTML = tag;
    } else {
      // Unknown kind: stop at what was actually measured rather than guess.
      set("dev-force-", devOhmText(ohm));
      set("dev-gram-", "—");
      if(bd) bd.innerHTML = devTag("dev-badge-dim", "raw only", t("unknown sensor — raw only"));
    }
    let tip = `${v} adc · ${devOhmText(ohm)} · ${us === null ? "—" : us.toFixed(0)+" µS"}`;

    // Fill + peak notch, so "which sensor is pressed hardest" is a glance
    // rather than a comparison of numbers across tiles. Scaled to the part's
    // rated band; the numeric readout and badge above stay authoritative
    // (style guide 2.4 — never meaning in colour or length alone).
    devSetBar(i, kind, ohm, b, rf);

    // Peak latches from the extreme ADC already tracked for the span — the
    // number that matters for a grip, a tap, or a full finger curl. Peak is
    // always taken from RAW counts, never the smoothed value: smoothing is a
    // display aid and must not quietly lower a recorded maximum.
    const s = dev.span[i];
    const sp = document.getElementById("dev-span-"+i);
    if(sp){
      if(s.max === null || s.min === null) sp.textContent = t("peak") + " —";
      else {
        // Which end of the ADC span is the "peak" depends on the sensor. Both
        // sit on the high side of their divider, so resistance rising pulls
        // the reading DOWN. Pressing an FSR lowers its resistance, so hardest
        // press = highest count; bending a flex strip raises its resistance,
        // so most bend = LOWEST count. Taking s.max for both would report a
        // flex sensor's peak as the moment it was straightest.
        const peakAdc = kind === "flex" ? s.min : s.max;
        const peakOhm = devOhm(peakAdc, b, rf);
        const peak = kind === "flex" ? devBendText(devBend(peakOhm, devFlexSpan(i)))
          : kind === "fsr" ? devForceText(devForce(peakOhm))
          : kind === "flexiforce" ? devUsText(peakOhm)
          : devOhmText(peakOhm);
        sp.textContent = `${t("peak")} ${peak}`;
        tip += "\n" + t("peak {peak}  ·  adc span {lo}–{hi} of {max}",
          {peak, lo: s.min, hi: s.max, max: b ? (1<<b.adc_bits)-1 : 1023});
      }
    }
    devSetRowTip(i, tip);
  }
}

/* ── Motion card (onboard IMU) ───────────────────────────────────────

   The camera measures WHERE the hand is; this measures how it is moving,
   sampled on the hand itself at 100 Hz. Every derived number here comes from
   core/glove/imu.py via /api/glove/imu — the tremor band and its minimum
   window are defined there and shipped in the payload, so this page never
   carries its own copy of a threshold. */

function devRenderImu(){
  const el = document.getElementById("dev-imu");
  if(!el) return;
  const d = dev.imu;

  if(!d || !d.present){
    // Say WHY there is nothing, always. A blank motion card is
    // indistinguishable from a board sitting perfectly still.
    const note = (d && d.note) ? tMsg(d.note)
      : t("Connect the board to read its accelerometer and gyroscope.");
    el.innerHTML = `<div class="dev-banner-empty">${note}</div>`;
    return;
  }

  const tilt = d.tilt || {};   // not `t` — that is the translator
  const tr = d.tremor;
  const stat = (n, l, cls) =>
    `<div class="dev-stat"><div class="dev-stat-n ${cls || ""}">${n}</div>
     <div class="dev-stat-l">${l}</div></div>`;
  const f = (v, dp, suffix) =>
    (v === null || v === undefined) ? "\u2014" : v.toFixed(dp) + (suffix || "");

  // Tilt is only gravity when the hand is still; during movement the vector is
  // gravity PLUS whatever the hand is doing, and an angle read off it is a
  // guess. The server decides which case this is; the card just reports it.
  const tiltVal = tilt.static
    ? `${f(tilt.pitch_deg, 0, "\u00b0")} / ${f(tilt.roll_deg, 0, "\u00b0")}`
    : t("moving");
  const tiltLbl = tilt.static
    ? t("Tilt pitch / roll \u2014 board axes")
    : t("Tilt \u2014 hold still, this needs gravity alone");

  const stats =
    stat(tiltVal, tiltLbl, tilt.static ? "" : "bad") +
    stat(f(d.accel && d.accel.magnitude, 2, " g"), t("Acceleration magnitude \u2014 1.00 g at rest")) +
    stat(f(d.motion_rms_g == null ? null : d.motion_rms_g * 1000, 0, " mg"),
         t("Motion RMS \u2014 movement about its own mean")) +
    stat(f(d.gyro_rms_dps, 1, " \u00b0/s"), t("Rotation RMS")) +
    stat(tr ? f(tr.peak_hz, 1, " Hz") : "\u2014",
         tr ? t("Tremor peak in {lo}\u2013{hi} Hz",
                {lo: tr.band[0].toFixed(1), hi: tr.band[1].toFixed(1)})
            : t("Tremor peak \u2014 not enough data yet")) +
    stat(tr ? f(tr.band_frac * 100, 1, " %") : "\u2014",
         t("Share of movement power in the tremor band"));

  // Honesty row. Each badge names a specific reason the numbers above are
  // weaker than they look, and is absent when it does not apply.
  const badges = [];
  if(d.held_frac !== null && d.held_frac !== undefined && d.held_frac > 0.02){
    badges.push(`<span class="dev-badge dev-badge-warn">${t(
      "{pct}% of frames repeated the previous IMU sample \u2014 the chip's own rate is below {fs} Hz, which flattens the top of the band",
      {pct: (d.held_frac*100).toFixed(0), fs: d.fs})}</span>`);
  }
  if(!tr && d.tremor_note){
    badges.push(`<span class="dev-badge dev-badge-dim">${tMsg(d.tremor_note)}</span>`);
  }
  if(tr){
    badges.push(`<span class="dev-badge dev-badge-dim">${t(
      "{s} s window at {fs} Hz \u00b7 {imu}",
      {s: tr.window_s.toFixed(1), fs: d.fs, imu: d.imu})}</span>`);
  }

  el.innerHTML = `<div class="dev-health">${stats}</div>
    <div class="dev-imu-badges">${badges.join(" ")}</div>`;
}

// Uptime as a clock reading: 2:45, 1:02:45.
function devClock(sec){
  const s = Math.max(0, Math.round(sec)), two = n => String(n).padStart(2, "0");
  return s < 3600 ? `${Math.floor(s / 60)}:${two(s % 60)}`
                  : `${Math.floor(s / 3600)}:${two(Math.floor(s % 3600 / 60))}:${two(s % 60)}`;
}
const devCount = n => Number(n || 0).toLocaleString("en-US");

/* Stream health as meters on the Connection row, connected only: a printed
   label over each reading. The rate shows its target beside it, so being
   off target reads in figures, not in colour. Its own slot, outside the
   connection row's signature: these tick on every poll and must never
   rebuild the port picker. */
function devRenderHealth(){
  const s = dev.status; if(!s) return;
  let html = "";
  if(s.connected){
    const target = s.banner ? s.banner.rate : 0;
    const meter = (label, value, unit, title) =>
      `<span class="dev-m"${title ? ` title="${esc(title)}"` : ""}><i>${label}</i>` +
      `<b>${value}</b>${unit ? `<u>${unit}</u>` : ""}</span>`;
    const parts = [
      meter(t("Rate"), s.rate_hz ? s.rate_hz.toFixed(1) : "—",
            target ? `/ ${esc(target)} Hz` : "Hz", t("Measured rate")),
      meter(t("Dropped"), devCount(s.dropped), "", t("Dropped frames")),
      meter(t("Frames"), devCount(s.total), "", t("Frames received")),
      meter(t("Uptime"), s.uptime_s ? devClock(s.uptime_s) : "—", "", t("Connected for")),
    ];
    if(s.recording) parts.push(meter(t("Recording"), devCount(s.record_rows), t("rows"), s.record_path || ""));
    html = parts.join("");
  }
  if(html !== dev.statsHtml){
    dev.statsHtml = html;
    document.getElementById("dev-conn-stats").innerHTML = html;
  }

  const rec = document.querySelector('[data-dev="rec"]');
  if(rec) rec.textContent = t(s.recording ? "Stop recording" : "Record");
}

function devRenderConsole(){
  const el = document.getElementById("dev-console");
  el.textContent = dev.console.join("\n");
  if(dev.autoscroll) el.scrollTop = el.scrollHeight;
  const n = document.getElementById("dev-console-count");
  if(n) n.textContent = t("{n} lines", {n: dev.console.length});
}

/* ── scope ───────────────────────────────────────────────────────── */

function devDraw(){
  const cv = document.getElementById("dev-scope");
  if(!cv || !cv.clientWidth) return;
  const dpr = window.devicePixelRatio || 1;
  const w = cv.clientWidth, h = cv.clientHeight;
  if(cv.width !== w*dpr || cv.height !== h*dpr){ cv.width = w*dpr; cv.height = h*dpr; }
  const g = cv.getContext("2d");
  g.setTransform(dpr,0,0,dpr,0,0);
  g.clearRect(0,0,w,h);

  const b = dev.status && dev.status.banner;
  const rate = (b && b.rate) || 100;
  const adcMax = b ? (1<<b.adc_bits)-1 : 1023;
  const n = Math.max(2, Math.round(rate * dev.window_s));
  const pad = {l:46, r:10, t:10, b:20};
  const pw = w - pad.l - pad.r, ph = h - pad.t - pad.b;
  if(pw <= 0 || ph <= 0) return;

  const sel = [...dev.selected].sort((a,b)=>a-b);

  // Map raw ADC into the selected unit. One unit for the whole plot — a second
  // y-scale would make two series silently incomparable.
  const fm = devForceModel();
  const convFor = (i) => {
    // Both resolved once per channel per redraw, not per sample: they depend
    // only on the channel, and the window holds hundreds of samples.
    const rf = devRFixed(i);
    const sp = dev.unit === "bend" ? devFlexSpan(i) : null;
    return {
      adc:   v => v,
      ohm:   v => devOhm(v, b, rf),
      us:    v => { const r = devOhm(v, b, rf); return r ? 1e6/r : null; },
      force: v => devForce(devOhm(v, b, rf)),
      bend:  v => devBend(devOhm(v, b, rf), sp),
      accel: devImuVal,
      gyro:  devImuVal,
    }[dev.unit] || (v => v);
  };
  const fixedRange = {
    adc:   [0, adcMax],
    force: [0, fm ? fm.rated_max_n : 20],   // default to the part's rated band
    bend:  [0, 100],
    ohm:   [0, (b ? b.r_fixed : 10000) * 3],
    us:    [0, 2000],
    // Motion is signed and centred on zero - a 0-based axis would put a hand
    // at rest against the floor of the plot and hide half of every wobble.
    accel: [-DEV_ACCEL_FS, DEV_ACCEL_FS],
    gyro:  [-DEV_GYRO_FS, DEV_GYRO_FS],
  }[dev.unit] || [0, adcMax];
  const label = {adc:"", ohm:" Ω", us:" µS", force:" N", bend:" %",
                 accel:" g", gyro:" °/s"}[dev.unit] || "";

  // Newtons and bend-percent cannot share a y-axis without being misleading,
  // so a kind-specific unit draws only the channels it applies to. The
  // kind-neutral units (adc/ohm/us) still draw everything.
  const unitKind = {force:"fsr", bend:"flex", accel:"accel", gyro:"gyro"}[dev.unit] || null;
  const drawable = sel.filter(i => !unitKind || devKind(i) === unitKind);

  const traces = drawable.map(i => devSmoothSeries(
    (dev.series[i] || []).slice(-n).map(convFor(i))));

  // Stacked gives every channel its own band, so traces cannot overlap however
  // many sensors are fitted — the failure mode of the shared axis is that
  // unpressed sensors all sit on zero and draw on top of each other. Overlaid
  // stays available because it is still the right view for comparing two
  // channels' magnitudes directly.
  if(dev.view === "stacked"){
    devDrawStacked(g, {pad, pw, ph, n, traces, drawable, fixedRange, label, unitKind, sel});
    return;
  }

  let [lo, hi] = fixedRange;
  if(dev.yAuto){
    lo = Infinity; hi = -Infinity;
    for(const t of traces) for(const v of t){
      if(v === null) continue;
      if(v<lo) lo=v; if(v>hi) hi=v;
    }
    if(!isFinite(lo)){ [lo, hi] = fixedRange; }
    const min = dev.unit === "force" ? 0.5 : 10;
    if(hi - lo < min){ const m=(hi+lo)/2; lo=Math.max(0,m-min/2); hi=m+min/2; }
  }
  const yOf = v => pad.t + ph * (1 - (v-lo)/((hi-lo)||1));
  const fmtTick = v => Math.abs(v) >= 100 ? Math.round(v).toString()
                     : (Math.abs(v) >= 10 ? v.toFixed(0) : v.toFixed(1));

  // Recessive grid + axis labels in text tokens, never a series colour.
  g.strokeStyle = devTok("--border", "#2A3350"); g.lineWidth = 1;
  g.fillStyle = devTok("--chart-axis", "#6F7896"); g.font = DEV_FONT;
  g.textAlign = "right"; g.textBaseline = "middle";
  for(let k=0;k<=4;k++){
    const v = lo + (hi-lo)*k/4, y = Math.round(yOf(v))+0.5;
    g.beginPath(); g.moveTo(pad.l, y); g.lineTo(pad.l+pw, y); g.stroke();
    g.fillText(fmtTick(v) + (k===4 ? label : ""), pad.l-8, y);
  }
  // In force mode, mark the actuation floor: below it the part is unspecified.
  if(dev.unit === "force" && fm && fm.rated_min_n > lo && fm.rated_min_n < hi){
    const y = Math.round(yOf(fm.rated_min_n)) + 0.5;
    g.save(); g.strokeStyle = devTok("--chart-axis", "#6F7896"); g.setLineDash([3,4]);
    g.beginPath(); g.moveTo(pad.l, y); g.lineTo(pad.l+pw, y); g.stroke(); g.restore();
  }
  g.textAlign = "center"; g.textBaseline = "top";
  g.fillText(`-${dev.window_s}s`, pad.l+14, pad.t+ph+5);
  g.fillText(t("now"), pad.l+pw-14, pad.t+ph+5);

  // 2px lines, one per drawable channel, in fixed palette order.
  //
  // Clip to the plot rectangle. The fixed force range stops at the part's
  // rated 20 N, but nothing clamps the values, so a hard press maps above the
  // top gridline and used to draw over the axis labels and out to the canvas
  // edge — which read as the trace flattening out at 20 N when it was really
  // running off the chart. Clipping makes "off the top" look like off the top.
  // Switch the Y axis to Auto to see where it actually went.
  g.save();
  g.beginPath();
  g.rect(pad.l, pad.t, pw, ph);
  g.clip();
  g.lineWidth = 2; g.lineJoin = "round"; g.lineCap = "round";
  drawable.forEach((i, s) => {
    const data = traces[s];
    if(!data || data.length < 2) return;
    g.strokeStyle = DEV_SERIES[i % DEV_MAX_SERIES];
    g.beginPath();
    let pen = false;
    for(let k=0;k<data.length;k++){
      const v = data[k];
      // An open sensor has no resistance/force — break the line rather than
      // drawing a fake zero.
      if(v === null){ pen = false; continue; }
      const x = pad.l + pw * (k/(n-1));
      const y = yOf(v);
      if(pen) g.lineTo(x,y); else g.moveTo(x,y);
      pen = true;
    }
    g.stroke();
  });
  g.restore();   // release the plot-rectangle clip

  g.fillStyle = devTok("--chart-axis", "#6F7896"); g.font = DEV_FONT;
  g.textAlign = "left"; g.textBaseline = "top";
  if(!drawable.length && unitKind){
    devDrawEmptyNote(g, pad, pw, unitKind, sel);
  } else {
    const hidden = sel.length - drawable.length;
    if(hidden > 0){
      g.fillText(t("{n} channels hidden — not {kind}",
                   {n: hidden, kind: devKindWord(unitKind)}), pad.l + 6, pad.t + 6);
    }
    // On an observed span, say so on the plot too — the y-axis reads 0-100%
    // and that is 100% of what has been SEEN, not of the sensor's travel.
    if(dev.unit === "bend" && drawable.length){
      const sp = devFlexSpan(drawable[0]);
      if(sp && sp.basis !== "calibrated"){
        g.textAlign = "right";
        g.fillText(t(sp.basis === "observed" ? "% of observed range" : "provisional range"),
                   pad.l + pw - 6, pad.t + 6);
      }
    }
  }
}

/* One lane per channel, sharing a single time axis.

   Each lane scales to its OWN data. That is the point: on a shared axis a
   light touch is invisible next to a hard press, and every idle sensor sits
   on the same zero line. Per-lane scaling costs direct magnitude comparison
   between lanes, which is exactly what the Overlaid view is still there for.

   The shared time axis is kept deliberately — it is what lets you see which
   sensor moved first, and separate mini-charts would lose that. */
function devDrawStacked(g, o){
  const {pad, pw, ph, n, traces, drawable, fixedRange, label, unitKind, sel} = o;
  const TEXT = devTok("--chart-axis", "#6F7896"), GRID = devTok("--border", "#2A3350");
  g.font = DEV_FONT;

  if(!drawable.length){
    devDrawEmptyNote(g, pad, pw, unitKind, sel);
    return;
  }

  const GAP = 8;
  const laneH = Math.max(18, (ph - GAP * (drawable.length - 1)) / drawable.length);
  const fmt = v => Math.abs(v) >= 100 ? Math.round(v).toString()
                 : (Math.abs(v) >= 10 ? v.toFixed(0) : v.toFixed(1));

  drawable.forEach((ch, s) => {
    const data = traces[s] || [];
    const top = pad.t + s * (laneH + GAP);
    const bot = top + laneH;
    const colour = DEV_SERIES[ch % DEV_MAX_SERIES];

    // Lane range: start from the unit's fixed range so an idle lane still has
    // a sensible scale, then grow to fit anything that exceeds it. Never
    // shrink below the fixed range, or resting noise would fill the lane and
    // read as violent activity.
    let lo = fixedRange[0], hi = fixedRange[1];
    for(const v of data){ if(v === null) continue; if(v < lo) lo = v; if(v > hi) hi = v; }
    if(hi - lo <= 0) hi = lo + 1;
    const yOf = v => bot - (bot - top) * ((v - lo) / (hi - lo));

    // Baseline + top rule bound the lane so it reads as its own strip.
    g.strokeStyle = GRID; g.lineWidth = 1;
    g.beginPath();
    g.moveTo(pad.l, Math.round(bot) + 0.5); g.lineTo(pad.l + pw, Math.round(bot) + 0.5);
    g.stroke();

    // Peak marker — the hardest press since the last reset, from the raw ADC
    // span the poll loop already tracks. Faint: it is a reference, not data.
    const sp = dev.span[ch];
    if(sp && sp.max !== null){
      const b = dev.status && dev.status.banner;
      const pv = devLaneValue(ch, unitKind === "flex" ? sp.min : sp.max, b);
      if(pv !== null && pv > lo && pv < hi){
        g.save();
        g.strokeStyle = colour; g.globalAlpha = 0.35; g.setLineDash([2,3]);
        const y = Math.round(yOf(pv)) + 0.5;
        g.beginPath(); g.moveTo(pad.l, y); g.lineTo(pad.l + pw, y); g.stroke();
        g.restore();
      }
    }

    // Trace, clipped to its own lane so an over-range press cannot bleed into
    // a neighbour and be mistaken for that sensor firing.
    g.save();
    g.beginPath(); g.rect(pad.l, top, pw, bot - top); g.clip();
    g.strokeStyle = colour; g.lineWidth = 2; g.lineJoin = "round"; g.lineCap = "round";
    g.beginPath();
    let pen = false;
    for(let k = 0; k < data.length; k++){
      const v = data[k];
      if(v === null){ pen = false; continue; }   // open sensor: break the line
      const x = pad.l + pw * (k / (n - 1));
      const y = yOf(v);
      if(pen) g.lineTo(x, y); else g.moveTo(x, y);
      pen = true;
    }
    g.stroke();
    g.restore();

    // Channel name left, live value right — the trace and its number in one
    // place, instead of glancing down at the tiles to read the graph.
    g.fillStyle = colour;
    g.textAlign = "right"; g.textBaseline = "middle";
    g.fillText(dev.channels[ch] || ("ch" + ch), pad.l - 8, (top + bot) / 2);

    let last = null;
    for(let k = data.length - 1; k >= 0; k--){ if(data[k] !== null){ last = data[k]; break; } }
    g.textAlign = "right"; g.textBaseline = "top";
    g.fillStyle = last === null ? TEXT : colour;
    g.fillText(last === null ? "—" : fmt(last) + label, pad.l + pw - 4, top + 2);

    // Lane ceiling, so "how much headroom is left" is legible at a glance.
    g.fillStyle = TEXT; g.textAlign = "left"; g.textBaseline = "top";
    g.fillText(fmt(hi) + label, pad.l + 4, top + 2);
  });

  g.fillStyle = TEXT; g.textAlign = "center"; g.textBaseline = "top";
  g.fillText(`-${dev.window_s}s`, pad.l + 14, pad.t + ph + 5);
  g.fillText(t("now"), pad.l + pw - 14, pad.t + ph + 5);

  const hidden = sel.length - drawable.length;
  if(hidden > 0){
    g.textAlign = "left";
    g.fillText(t("{n} hidden — not {kind}", {n: hidden, kind: devKindWord(unitKind)}),
               pad.l + 4, pad.t + ph + 5);
  }
}

/* One raw ADC count → the currently selected unit, for a given channel.
   Mirrors convFor() inside devDraw but is callable from the lane renderer. */
function devLaneValue(ch, adc, b){
  if(adc === null || adc === undefined) return null;
  const rf = devRFixed(ch);
  switch(dev.unit){
    case "accel":
    case "gyro": return devImuVal(adc);
    case "adc":  return adc;
    case "ohm":  return devOhm(adc, b, rf);
    case "us":   { const r = devOhm(adc, b, rf); return r ? 1e6/r : null; }
    case "bend": return devBend(devOhm(adc, b, rf), devFlexSpan(ch));
    default:     return devForce(devOhm(adc, b, rf));
  }
}

/* A blank plot must say why it is blank — silently drawing nothing is
   indistinguishable from a dead sensor. */
/* What a unit's channels are called in prose, so every "nothing to draw"
   message names the right thing. */
function devKindWord(unitKind){
  const en = {fsr:"a force sensor", flex:"a bend sensor",
              accel:"an accelerometer axis", gyro:"a gyroscope axis"}[unitKind] || "that kind";
  return t(en);
}

function devDrawEmptyNote(g, pad, pw, unitKind, sel){
  g.fillStyle = devTok("--chart-axis", "#6F7896"); g.font = DEV_FONT;
  g.textAlign = "left"; g.textBaseline = "top";
  const word = devKindWord(unitKind);
  const anyOfKind = dev.channels.some((_, i) => devKind(i) === unitKind);
  const msg = !dev.channels.length
    ? t("no channels yet — connect the board")
    : !anyOfKind
      ? t("no {kind} on this board — check the banner's chan= field", {kind: word})
      : t("no {kind} selected — tick one in the tiles below", {kind: word});
  g.fillText(msg, pad.l + 6, pad.t + 6);
}

function devLoop(){
  devDraw();
  dev.raf = requestAnimationFrame(devLoop);
}

/* ── lifecycle (called from app.js showPage) ─────────────────────── */

function startDev(){
  devBuild();
  devLoadEnv();
  devPollStatus();
  devRenderChannelTiles();
  devRenderImu();
  if(!dev.fastTimer){
    dev.fastTimer = setInterval(()=>{
      devPollSamples();
      // Under reduced motion the scope refreshes on the poll tick instead of
      // running a continuous animation frame loop.
      if(reducedMotion) devDraw();
    }, DEV_POLL_MS);
  }
  if(!dev.envTimer) dev.envTimer = setInterval(devPollStatus, DEV_ENV_MS);
  // Slower than the sample poll on purpose: this endpoint runs a DFT, and the
  // raw motion columns are already live in the scope at DEV_POLL_MS.
  if(!dev.imuTimer) dev.imuTimer = setInterval(devPollImu, DEV_IMU_MS);
  if(!reducedMotion && !dev.raf) dev.raf = requestAnimationFrame(devLoop);
  // glove3d.js is a module and loads after this file; if it is not there yet
  // it starts itself once it sees this page is showing.
  window.glove3d?.start();
}

function stopDev(){
  // Leaving the page lets go of every simulator key: nothing here could
  // send the keyup once the page is gone.
  devSimReleaseAll();
  clearInterval(dev.fastTimer); dev.fastTimer = null;
  clearInterval(dev.envTimer);  dev.envTimer = null;
  clearInterval(dev.imuTimer);  dev.imuTimer = null;
  if(dev.raf){ cancelAnimationFrame(dev.raf); dev.raf = null; }
  window.glove3d?.stop();
}

/* A language switch redraws everything this page built. If the page has not
   been built yet, startDev() will build it in the new language anyway. */
onLang(() => {
  if(!dev.built) return;
  devBuildStatic();
  dev.connSig = null;          // force the connection row to redraw
  dev.sim.sig = null;          // ...and the simulator panel
  dev.stateHtml = dev.statsHtml = dev.bannerSig = null;   // ...and the glove card's text
  devRenderEnv();
  devRenderConn();
  devRenderSim();
  devRenderBanner();
  devRenderChannelTiles();
  devRenderLegend();
  devRenderHealth();
  devRenderImu();
  devRenderConsole();
});

window.startDev = startDev;
window.stopDev = stopDev;
