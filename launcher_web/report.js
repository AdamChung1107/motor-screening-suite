/* Session report panel — everything behind one point on an Analysis chart.

   A classic script like dev.js / remote.js, loaded after app.js so it shares
   that file's `I` (icons), `t()` (i18n), `TREND`, `ST`, `statusOf`, `fmtNum`,
   `fmtDate`/`fmtDateTime` and `reducedMotion` bindings. Never shadow `t` — it
   is the translator.

   app.js delegates a click on any [data-sid] (chart dot or calendar row) to
   window.openReport(). The chart payload (/api/sessions) has `raw` stripped,
   so the panel fetches the one session it needs from /api/session?id=… and
   draws the actual recording: the tapping distance trace with every tap on it,
   the traced spiral over the template it was aiming at, the saccade trials one
   by one. Records are cached, so re-opening one is instant. */
(function () {
  "use strict";

  const box = document.getElementById("report");
  const backdrop = document.getElementById("report-backdrop");
  if (!box || !backdrop) return;

  const cache = new Map();      // session_id → full record (with raw)
  let openId = null;            // null while closed
  let lastFocus = null;         // element to restore focus to on close
  let ctx = [];                 // ordered ids of the chart the panel was opened from
  let selTrial = null;          // oculomotor: "pro:3" of the expanded trial
  let hideTimer = null;         // closing animation; cancelled if another report opens

  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g,
    c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ── Open / close ───────────────────────────────────────────────── */

  async function openReport(id) {
    if (!id) return;
    const wasClosed = openId === null;
    openId = id;
    selTrial = null;
    ctx = contextIds(id);
    markStrip();
    if (wasClosed) {
      lastFocus = document.activeElement;
      show();
    }

    const hit = cache.get(id);
    if (hit) { paint(hit); return; }

    box.innerHTML = shell(`<div class="rep-msg">${t("Loading session…")}</div>`);
    try {
      const r = await fetch("/api/session?id=" + encodeURIComponent(id));
      const rec = r.ok ? await r.json() : null;
      if (!rec || !rec.session_id) throw new Error("not found");
      cache.set(id, rec);
      if (openId === id) paint(rec);
    } catch (e) {
      if (openId === id)
        box.innerHTML = shell(`<div class="rep-msg rep-fail">${I.info}
          ${t("That session could not be loaded. Reports are read from this machine's results folder, so the hub has to be running.")}</div>`);
    }
  }

  function show() {
    // A quick close -> open used to let the old close timeout hide the newly
    // opened report. Cancel it before changing any visibility state.
    if (hideTimer !== null) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
    backdrop.hidden = false;
    box.hidden = false;
    document.body.classList.add("report-open");
    // The frame gap lets the panel fade in. rAF is suspended while the tab is
    // hidden, and `on` is what carries opacity:1 — without this the panel would
    // sit there un-hidden and fully transparent, eating every click.
    const reveal = () => {
      backdrop.classList.add("on");
      box.classList.add("on");
      const first = box.querySelector(".rep-close");
      if (first) first.focus();
    };
    if (document.hidden) reveal(); else requestAnimationFrame(reveal);
  }

  function closeReport() {
    if (openId === null) return;
    openId = null;
    markStrip();
    backdrop.classList.remove("on");
    box.classList.remove("on");
    document.body.classList.remove("report-open");
    const hide = () => {
      // Do not hide a report that was reopened while the close animation ran.
      if (openId !== null) return;
      backdrop.hidden = true;
      box.hidden = true;
      hideTimer = null;
    };
    if (reducedMotion) hide(); else hideTimer = setTimeout(hide, 260);
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
    lastFocus = null;
  }

  // Sessions of the chart this report was opened from, in chart order, so the
  // arrows walk the same list the person is looking at (filters and the
  // Big & Fast / Paced toggle included).
  function contextIds(id) {
    const el = document.querySelector('[data-sid="' + id + '"]');
    const card = el && el.closest(".trend-card");
    if (!card) return [id];
    const calendar = card.querySelector(".session-calendar[data-context]");
    return calendar ? calendar.dataset.context.split(",").filter(Boolean) : [id];
  }

  function step(dir) {
    const i = ctx.indexOf(openId);
    if (i < 0) return;
    const next = ctx[i + dir];
    if (next) openReport(next);
  }

  // Highlight the open session in every visible calendar list on the page.
  // The arrows walk the whole card, not just the open day, so first ask the
  // calendar to move to this session's month and day — otherwise you read a
  // July report with August highlighted. revealSession rebuilds those rows,
  // so it has to run before we query them.
  function markStrip() {
    if (openId !== null) window.revealSession?.(openId);
    document.querySelectorAll(".cal-session[data-sid]").forEach(b =>
      b.classList.toggle("is-open", b.dataset.sid === openId));
  }

  /* ── Chrome ─────────────────────────────────────────────────────── */

  function shell(inner, head) {
    const i = ctx.indexOf(openId);
    const pos = i >= 0 && ctx.length > 1 ? `${i + 1} / ${ctx.length}` : "";
    return `<div class="rep-bar">
        <button class="rep-nav" data-step="-1" ${i > 0 ? "" : "disabled"}
          aria-label="${t("Previous session")}">${I.arrowLeft}</button>
        <span class="rep-pos">${pos}</span>
        <button class="rep-nav" data-step="1" ${i >= 0 && i < ctx.length - 1 ? "" : "disabled"}
          aria-label="${t("Next session")}">${I.arrowRight}</button>
        <div class="rep-bar-line"></div>
        <button class="rep-close" aria-label="${t("Close")}">${I.x}</button>
      </div>${head || ""}<div class="rep-body">${inner}</div>`;
  }

  const sec = (title, inner, note) => inner
    ? `<div class="rep-sec"><h3>${title}</h3>${note ? `<p class="rep-note">${note}</p>` : ""}${inner}</div>`
    : "";

  function modeLabel(rec) {
    const cfg = TREND[rec.test];
    const m = cfg && cfg.modes && cfg.modes.find(x => x.key === rec.mode);
    if (m) return t(m.label);
    return String(rec.mode || "").replace(/_/g, " ");
  }

  // The one place a tremor finding reaches another test
  // (TREMOR_RESTRUCTURE_PLAN.md §2): a note on a tapping or spiral report when
  // the same person had a tremor check near it that found a rhythm. A note,
  // never a change to the score. Only for a named person: unassigned sessions
  // may be anybody's.
  const CONFOUND_DAYS = 30;
  function tremorContext(rec) {
    if (rec.test !== "finger_tapping" && rec.test !== "spiral") return "";
    const who = rec.profile && rec.profile.id;
    // A group is different people; one visitor's tremor says nothing of another's.
    if (!who || rec.profile.kind === "group") return "";
    const list = (typeof analysisSessions !== "undefined" && analysisSessions) || [];
    const at = Date.parse(rec.timestamp);
    const gap = sn => Math.abs(Date.parse(sn.timestamp) - at);
    const near = list.filter(sn => sn.test === "tremor" && sn.metrics
        && sn.metrics.tremor_peak_hz != null
        && sn.profile && sn.profile.id === who
        && gap(sn) <= CONFOUND_DAYS * 864e5)
      .sort((a, b) => gap(a) - gap(b));
    if (!near.length) return "";
    return `<div class="rep-label rep-confound">${t(
      "A tremor check on {date} found: {finding}. Shaking can raise this reading.",
      { date: fmtDate(near[0].timestamp), finding: tremorFinding(near[0].metrics) })}</div>`;
  }

  // Eye-test parts skipped with S (oculomotor_test.py). Only what was run is
  // drawn; this line says what is missing and why.
  const GAZE_PARTS = { pro: "Part 1 - Look Toward", anti: "Part 2 - Look Away",
                       fix: "Part 3 - Hold Still" };
  function skippedNote(rec) {
    const sk = (rec.raw || {}).parts_skipped || (rec.metrics || {}).parts_skipped;
    if (rec.test !== "oculomotor" || !sk || !sk.length) return "";
    return `<div class="rep-label">${t("Skipped: {parts}",
      { parts: sk.map(k => t(GAZE_PARTS[k] || k)).join(", ") })}</div>`;
  }

  // Part 2 skipped: no error rate, so the report leads with what was measured
  // - the pro-saccade latency, else the fixation jitter - as a reading, with no
  // verdict colour, and says plainly which part is missing.
  function partialEyeVerdict(m, rec) {
    const lead = m.prosaccade_latency_ms != null
      ? [m.prosaccade_latency_ms, "ms", "Pro-saccade latency"]
      : m.fixation_rms_pct != null
      ? [m.fixation_rms_pct, "%", "Fixation jitter (RMS)"] : null;
    return `<div class="rep-verdict vs-none">
        ${lead ? `<div class="rep-val">${fmtNum(lead[0])}<span class="rep-unit">${lead[1]}</span></div>` : ""}
        <div class="rep-vtext">
          <span class="badge badge-none"><span class="badge-dot"></span>${t("Partial run")}</span>
          ${lead ? `<div class="rep-metricname">${t(lead[2])}</div>` : ""}
          <div class="rep-label">${t("Part 2 was skipped, so there is no anti-saccade error rate. Everything below is from the parts that were done.")}</div>
          ${m.fixation_label ? `<div class="rep-label">${t("Holding still")}: ${t(m.fixation_label)}</div>` : ""}
          ${skippedNote(rec)}
        </div>
      </div>`;
  }

  /* Spiral engine 4: tremor is the second score, with its own band, and the
     run's verdict (the worse of the two) is said in words underneath. */
  function spiralSecond(m) {
    const ts = VERDICT[m.tremor_status] || "none";
    const tremor = m.tremor_score == null ? "" : `<div class="rep-second">
        <span class="rep-second-val vs-${ts}">${fmtNum(m.tremor_score)}</span>
        <span class="badge badge-${ts}"><span class="badge-dot"></span>${t(ST[ts].word)}</span>
        <span class="rep-metricname">${t("Tremor (higher = more)")}${m.tremor_pct != null
          ? ` · ${t("{pct} % of the spiral's size", { pct: fmtNum(m.tremor_pct) })}` : ""}${m.tremor_dominant_hz
          ? ` · ${fmtNum(m.tremor_dominant_hz)} Hz` : ""}</span>
      </div>`;
    return tremor + (m.label ? `<div class="rep-label"><strong>${t("Verdict")}:</strong> ${t(m.label)}</div>` : "");
  }

  function paint(rec) {
    const cfg = TREND[rec.test] || { label: rec.test, icon: "chart", headline: null };
    const h = cfg.headline;
    const m = rec.metrics || {};
    const st = h ? statusOf(rec, h) : "none";
    const val = h ? m[h.key] : null;

    const who = rec.profile && rec.profile.name;
    const face = window.profileAvatar ? window.profileAvatar(rec.profile, "xs") : I.person;
    const pt = patientOf(rec);
    const chips = [
      who ? (rec.profile.kind === "group"
        ? `${face}${t("Group: {name}", { name: esc(who) })}` : `${face}${esc(who)}`) : null,
      pt ? esc(t("Patient #{n} · {dx}", { n: pt.number, dx: diagName(pt) })) : null,
      pt && pt.demo ? t("Demo run") : null,
      modeLabel(rec),
      rec.hand ? t(rec.hand) : null,
      m.duration_s != null ? `${fmtNum(m.duration_s)}s`
        : (rec.duration_s != null ? `${fmtNum(rec.duration_s)}s` : null),
      rec.source === "remote"
        ? t("remote · {who}", { who: esc(rec.participant || t("unnamed")) }) : null,
    ].filter(Boolean).map(c => `<span class="rep-chip">${c}</span>`).join("");

    const head = `<div class="rep-head">
        <div class="rep-ic">${I[cfg.icon] || I.chart}</div>
        <div class="rep-headtext">
          <h2 id="report-title">${t(cfg.label)}</h2>
          <div class="rep-when">${fmtDateTime(rec.timestamp)}</div>
        </div>
      </div>
      <div class="rep-chips">${chips}</div>`;

    const scored = m.scoreable !== false && val != null && isFinite(val);
    // spiral: the box is bordered by the run's verdict (the worse of its two
    // scores); the big number and its badge are line accuracy's own
    const boxSt = rec.test === "spiral" && VERDICT[m.status] ? VERDICT[m.status] : st;
    // app-0.2 spiral runs predate SPARC: they passed their gate, but there is
    // no smoothness index to lead with, which is not the same as unscoreable
    const legacy = !scored && rec.test === "spiral" && m.scoreable !== false
      && m.sparc == null;
    const partial = !scored && rec.test === "oculomotor"
      && ((rec.raw || {}).parts_skipped || m.parts_skipped || []).includes("anti");
    const verdict = scored
      ? `<div class="rep-verdict vs-${boxSt}">
          <div class="rep-val">${fmtNum(val)}<span class="rep-unit">${h.unit}</span></div>
          <div class="rep-vtext">
            ${rec.test === "tremor" ? tremorTag(m)
              : `<span class="badge badge-${st}"><span class="badge-dot"></span>${t(ST[st].word)}</span>`}
            <div class="rep-metricname">${t(h.name)}</div>
            ${(rec.test === "finger_tapping" || rec.test === "ddk") && m.cv_ci_low_pct != null
              ? `<div class="rep-label">95% CI ${fmtNum(m.cv_ci_low_pct)}-${fmtNum(m.cv_ci_high_pct)}% · ${t("Confidence")} ${fmtNum(m.confidence_pct)}%</div>` : ""}
            ${rec.test === "tremor"
              ? `<div class="rep-label">${tremorFinding(m)} · ${t("Confidence")} ${fmtNum(m.confidence_pct)}%</div>
                 <div class="rep-label">${t("A supporting check: it helps explain the tapping and spiral readings.")}</div>` : ""}
            ${rec.test === "spiral" ? spiralSecond(m) : ""}
            ${rec.test === "gait" && m.label
              ? `<div class="rep-label">${t(m.label)} · ${m.weaker_leg ? t("{leg} weaker", { leg: t(m.weaker_leg === "right" ? "Right leg" : "Left leg") }) : t("No clear difference between the legs")} · ${t("Confidence")} ${fmtNum(m.confidence_pct)}%</div>` : ""}
            ${rec.test === "oculomotor" && m.error_ci_low_pct != null
              ? `<div class="rep-label">95% CI ${fmtNum(m.error_ci_low_pct)}-${fmtNum(m.error_ci_high_pct)}% · ${t("Confidence")} ${fmtNum(m.confidence_pct)}%</div>` : ""}
            ${skippedNote(rec)}
            ${tremorContext(rec)}
          </div>
        </div>`
      : partial ? partialEyeVerdict(m, rec)
      : legacy
      ? `<div class="rep-verdict vs-none">
          <div class="rep-vtext">
            <span class="badge badge-none"><span class="badge-dot"></span>${t(ST.none.word)}</span>
            <div class="rep-label">${t("Recorded before the smoothness score existed, so this run has no verdict.")}</div>
          </div>
        </div>`
      : `<div class="rep-verdict vs-none">
          <div class="rep-vtext">
            <span class="badge badge-none"><span class="badge-dot"></span>${t("Not scoreable")}</span>
            <div class="rep-label">${m.reason ? esc(t(m.reason))
              : m.label ? t(m.label)
              : t("This recording did not meet the quality gate, so no score was computed.")}</div>
            ${skippedNote(rec)}
          </div>
        </div>`;

    const trace = (TRACE[rec.test] || (() => ""))(rec);
    box.innerHTML = shell(verdict + trace + metricGrid(rec) + footprint(rec)
      + recordingRow(rec), head);
  }

  // Only when R was pressed during the run: the hub matches the clip in
  // recordings/ to this session (launcher.py recording_for) and opens it in
  // the computer's own video player, since a browser cannot play mp4v.
  function recordingRow(rec) {
    if (!rec.recording) return "";
    return `<div class="rep-rec">
        <button class="rep-recbtn" data-recording="${esc(rec.session_id)}"
          title="${esc(rec.recording)}">${I.play}${t("Open recording")}</button>
        <span>${t("Opens in this computer's video player")}</span>
      </div>`;
  }

  async function openRecording(id) {
    try {
      const r = await fetch("/api/session/recording", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const res = await r.json();
      if (res.ok) toast(t("Recording opened"), "ok");
      else toast(t("The recording could not be opened"), "fail");
    } catch (e) {
      toast(t("The recording could not be opened"), "fail");
    }
  }

  /* ── Metric grid ────────────────────────────────────────────────── */

  // name + unit per metric key. Names that already exist in the Analysis
  // config are spelled the same way here so one Chinese entry covers both.
  const MET = {
    // finger tapping
    taps: ["Taps", ""], frequency_hz: ["Tap frequency", "Hz"],
    mean_iti_ms: ["Mean interval", "ms"], iiv_ms: ["Interval SD", "ms"],
    cv_pct: ["Rhythm variability", "%"], amplitude_mean: ["Mean amplitude", ""],
    amplitude_cv_pct: ["Amplitude CV", "%"],
    decrement_pct_per_s: ["Speed decrement", "%/s"],
    sync_sd_ms: ["Beat-sync SD", "ms"], mean_latency_ms: ["Beat latency", "ms"],
    hits: ["Hits", ""], misses: ["Misses", ""],
    n_intervals: ["Intervals", ""], confidence_pct: ["Confidence", "%"],
    cv_ci_low_pct: ["CV 95% CI low", "%"], cv_ci_high_pct: ["CV 95% CI high", "%"],
    error_ci_low_pct: ["Error rate 95% CI low", "%"],
    error_ci_high_pct: ["Error rate 95% CI high", "%"],
    anticipatory_rate_pct: ["Started too early", "%"],
    taps_w10: ["Taps (first 10 s)", ""], frequency_hz_w10: ["Frequency (first 10 s)", "Hz"],
    cv_pct_w10: ["Rhythm variability (first 10 s)", "%"], near_miss_taps: ["Shallow closures", ""],
    missed_tap_forgiven: ["Missed taps forgiven", ""], interruptions: ["Interruptions", ""],
    cv_pct_unrepaired: ["Rhythm variability as recorded", "%"],
    rate_vs_usual: ["Speed vs your usual", "×"], opening_vs_usual: ["Opening vs your usual", "×"],
    baseline_runs: ["Earlier runs compared", ""], baseline_rate_hz: ["Your usual tap rate", "Hz"],
    slower_than_usual: ["Slower than usual", ""], opening_shrink_ratio: ["Last vs first openings", "×"],
    band_edge: ["Close to a band edge", ""], pause_count: ["Pauses, hand out of view", ""],
    paused_s: ["Time paused", "s"],
    // spiral
    frames: ["Frames", ""], sparc: ["SPARC", ""],
    smoothness_index: ["Smoothness index", ""], norm_jerk: ["Normalized jerk", ""],
    vel_mean_px_s: ["Mean speed", "px/s"], vel_sd_px_s: ["Speed SD", "px/s"],
    vel_cv_pct: ["Velocity variability", "%"],
    tremor_power_frac: ["Tremor band power", ""],
    tremor_dominant_hz: ["Tremor peak", "Hz"],
    accuracy_score: ["Line accuracy", ""], tremor_score: ["Tremor (higher = more)", ""],
    tremor_pct: ["Tremor amplitude", "%"], tremor_px: ["Tremor amplitude", "px"],
    mean_dev_pct: ["Mean deviation", "%"], mean_dev_px: ["Mean deviation", "px"],
    completion_pct: ["Completion", "%"], active_ratio_pct: ["Active time", "%"],
    // oculomotor
    error_rate_pct: ["Anti-saccade error rate", "%"],
    corrected_rate_pct: ["Corrected errors", "%"],
    antisaccade_latency_ms: ["Anti-saccade latency", "ms"],
    prosaccade_latency_ms: ["Pro-saccade latency", "ms"],
    anti_minus_pro_ms: ["Anti − Pro latency", "ms"],
    latency_cv_pct: ["Latency CV", "%"],
    anticipatory_count: ["Anticipatory", ""], valid_trials: ["Valid trials", ""],
    valid_anti_trials: ["Valid anti trials", ""], valid_pro_trials: ["Valid pro trials", ""],
    face_visible_ratio: ["Face visible", ""],
    engine_version: ["Scoring engine", "v"],
    fixation_rms_pct: ["Fixation jitter (RMS)", "%"],
    fixation_bcea: ["Fixation BCEA", "×10⁻³"],
    intrusion_count: ["Saccadic intrusions", ""],
    intrusion_rate_per_min: ["Intrusion rate", "/min"],
    fixation_valid_s: ["Fixation analysed", "s"],
    // speech rhythm (DDK)
    rhythm_cv_pct: ["Syllable rhythm variability", "%"],
    syllable_rate_hz: ["Syllable rate", "/s"], syllables: ["Syllables", ""],
    mean_isi_ms: ["Mean interval", "ms"], isi_sd_ms: ["Interval SD", "ms"],
    npvi: ["nPVI", ""], snr_db: ["Signal / noise", "dB"],
    clipping_pct: ["Clipped samples", "%"],
    // The phoneme model's readings are experimental (SPEECH_TEST_PLAN.md
    // §3.1b) and say so wherever they appear.
    sequence_error_pct: ["Order errors (experimental)", "%"],
    sequence_transitions: ["Order transitions checked (experimental)", ""],
    ml_syllables: ["Syllables, phoneme model (experimental)", ""],
    count_agreement_pct: ["Model agreement (experimental)", "%"],
    // sustained phonation
    jitter_pct: ["Jitter", "%"], shimmer_pct: ["Shimmer", "%"], hnr_db: ["HNR", "dB"],
    f0_mean_hz: ["Mean pitch", "Hz"], f0_sd_hz: ["Pitch SD", "Hz"],
    vocal_tremor_hz: ["Vocal tremor", "Hz"], vocal_tremor_pct: ["Vocal tremor size", "%"],
    voiced_s: ["Steady voice", "s"], voiced_pct: ["Voiced", "%"],
    // hand tremor
    tremor_amp_pct: ["Tremor-band movement", "%"], tremor_peak_hz: ["Tremor peak", "Hz"],
    rest_amp_left_pct: ["Rest, left hand", "%"], rest_amp_right_pct: ["Rest, right hand", "%"],
    rest_peak_hz: ["Rest peak", "Hz"],
    palm_up_amp_pct: ["Palms up in the lap", "%"],
    palm_down_amp_pct: ["Palms down in the lap", "%"],
    count_amp_pct: ["While counting", "%"],
    postural_amp_pct: ["Arms out", "%"], postural_peak_hz: ["Arms-out peak", "Hz"],
    asymmetry_ratio: ["Left / right ratio", "×"],
    emergence_ratio: ["Counting / rest ratio", "×"],
    glove_rest_peak_hz: ["Glove peak at rest", "Hz"],
    cam_glove_hz_diff: ["Camera vs glove", "Hz"],
    scored_cells: ["Holds measured", "/6"], detected_cells: ["Tremor found in", ""],
    possible_cells: ["Possible tremor in", ""], sample_fps: ["Camera rate", "fps"],
    band_hi_hz: ["Highest frequency seen", "Hz"], edge_clipped_pct: ["Hand at the edge", "%"],
    // walking test, seated part
    sts5_s: ["Five sit-to-stands", "s"], sts5_sit_s: ["Five sit-to-stands, seated again", "s"],
    n_stands: ["Stands", ""], failed_attempts: ["Failed rises", ""],
    hands_used: ["Rises using the hands", ""], rise_s_median: ["Time to rise", "s"],
    lean_deg_median: ["Forward lean on rising", "°"],
    leg_right_rate_hz: ["Right leg stamps", "/s"], leg_left_rate_hz: ["Left leg stamps", "/s"],
    leg_right_amp_pct: ["Right knee lift", "%"], leg_left_amp_pct: ["Left knee lift", "%"],
    rate_hz_diff_pct: ["Stamp rate, left vs right", "%"],
    amp_pct_diff_pct: ["Knee lift, left vs right", "%"],
    trusted_pct: ["Body in view", "%"], fps: ["Camera rate", "fps"],
  };
  // Shown elsewhere in the report, or not a number.
  const SKIP = new Set(["status", "label", "reason", "scoreable", "latency_note",
    "duration_s", "pro_block", "anti_block", "fixation_status", "fixation_label",
    "fixation_scoreable", "fixation_reason", "confidence_level", "tremor_where",
    "weaker_leg", "weaker_by", "smoothness_status", "verdict_from",
    "accuracy_status", "tremor_status", "shake_pct", "shake_rms_px"]);
  // Saved as 0/1 by the engine, read as a yes/no.
  const FLAGS = new Set(["band_edge", "slower_than_usual"]);

  function metricGrid(rec) {
    const m = rec.metrics || {};
    const keys = Object.keys(m).filter(k =>
      !SKIP.has(k) && m[k] != null && typeof m[k] !== "object");
    if (!keys.length) return "";
    // Known metrics first, in the order they are declared above; anything the
    // table has not heard of still shows, so a new metric never goes missing.
    const known = Object.keys(MET);
    keys.sort((a, b) => {
      const ia = known.indexOf(a), ib = known.indexOf(b);
      return (ia < 0 ? 1e9 : ia) - (ib < 0 ? 1e9 : ib);
    });
    const cells = keys.map(k => {
      const info = MET[k];
      const name = info ? t(info[0]) : esc(k);
      const unit = info ? info[1] : "";
      const raw = FLAGS.has(k) && typeof m[k] === "number" ? m[k] !== 0 : m[k];
      // A whole number (a count, a flag's 0) reads "35", not fmtNum's "35.0".
      const v = typeof raw === "number"
        ? (Number.isInteger(raw) ? raw.toLocaleString() : fmtNum(raw))
        : (raw === true ? t("yes") : raw === false ? t("no") : esc(raw));
      return `<div class="rep-metric"><div class="rep-mname" title="${name}">${name}</div>
        <div class="rep-mval">${v}${unit ? `<span class="rep-munit">${unit}</span>` : ""}</div></div>`;
    }).join("");
    const note = m.latency_note ? esc(m.latency_note) : "";
    return sec(t("Every metric"), `<div class="rep-metrics">${cells}</div>`, note);
  }

  // How a tremor cell was measured (core/tremor/offline.py; older runs say
  // "flow"/"landmarks", which were live).
  const TREMOR_METHOD = {
    offline_flow: "every frame, optical flow", offline_landmarks: "every frame, landmarks",
    live_landmarks: "live landmarks", flow: "live optical flow", landmarks: "live landmarks",
    mixed: "a mix of methods",
  };

  function footprint(rec) {
    const d = rec.device || {}, raw = rec.raw || {};
    const cal = raw.calibration || {};
    const rows = [];
    if (d.camera_fps != null) rows.push([t("Camera"), `${fmtNum(d.camera_fps)} fps · ${esc(d.resolution || "")}`]);
    // What the capture really negotiated (core/camera.Capture.info), where
    // the session carries it: which camera, which backend, the rate delivered.
    if (d.camera_name || d.backend) rows.push([t("Camera device"),
      [d.camera_name ? esc(d.camera_name) : null, d.backend ? esc(d.backend) : null,
       d.fps_measured != null ? t("{fps} fps delivered", { fps: fmtNum(d.fps_measured) }) : null]
        .filter(Boolean).join(" · ")]);
    const meth = rec.test === "tremor" && rec.metrics ? rec.metrics.method : null;
    if (meth) rows.push([t("Measured from"),
      t(TREMOR_METHOD[meth] || meth) + (rec.metrics.capture_fps
        ? ` · ${fmtNum(rec.metrics.capture_fps)} fps` : "")]);
    if (d.microphone != null) rows.push([t("Microphone"),
      `${esc(d.microphone || "?")}${d.sample_rate ? ` · ${fmtNum(d.sample_rate / 1000)} kHz` : ""}`]);
    if (rec.test === "ddk") rows.push([t("Phoneme model"),
      d.recogniser ? `<code>${esc(d.recogniser)}</code>` : t("not used")]);
    if (d.app_version) rows.push([t("App version"), esc(d.app_version)]);
    if (raw.hand_visible_ratio != null) rows.push([t("Hand in frame"), `${Math.round(raw.hand_visible_ratio * 100)}%`]);
    if (raw.face_visible_ratio != null) rows.push([t("Face in frame"), `${Math.round(raw.face_visible_ratio * 100)}%`]);
    if (cal.d_closed != null) rows.push([t("Calibration"),
      `${t("closed")} ${fmtNum(cal.d_closed)} · ${t("open")} ${fmtNum(cal.d_open)}`]);
    if (cal.center != null) rows.push([t("Calibration"),
      `${t("centre")} ${fmtNum(cal.center)} · L ${fmtNum(cal.left)} · R ${fmtNum(cal.right)}`]);
    rows.push([t("Session id"), `<code>${esc(rec.session_id).slice(0, 8)}</code>`]);
    // The snapshot this session was saved with, not a live lookup: it is what
    // was true of the person at the time, which is the point of storing it.
    const p = rec.profile || {};
    if (p.sex && p.sex !== "unspecified") rows.push([t("Sex"), t(SEX_LABEL[p.sex] || p.sex)]);
    if (p.age_years != null) rows.push([t("Age at test"), fmtNum(p.age_years)]);
    if (p.dominant_hand && p.dominant_hand !== "unknown")
      rows.push([t("Dominant hand"), t(HAND_LABEL[p.dominant_hand] || p.dominant_hand)]);
    return sec(t("How it was recorded"),
      `<div class="rep-foot">${rows.map(([k, v]) =>
        `<div><span>${k}</span><b>${v}</b></div>`).join("")}</div>${assignRow(rec)}`);
  }

  const SEX_LABEL = {female: "Female", male: "Male", other: "Other",
                     unspecified: "Not specified"};
  const HAND_LABEL = {right: "Right-handed", left: "Left-handed",
                      ambidextrous: "Ambidextrous", unknown: "Not specified"};

  /* A run filed under the wrong person is fixed here rather than only in the
     moment it finished — this is where somebody notices, reading it back. */
  function assignRow(rec) {
    const roster = window.profileList ? window.profileList() : [];
    const chosen = (rec.profile && rec.profile.id) || "";
    if (!roster.length && !chosen) return "";
    const opt = p => `<option value="${esc(p.id)}" ${p.id === chosen ? "selected" : ""}
        >${esc(p.name)}</option>`;
    const people = roster.filter(p => p.kind !== "group"), groups = roster.filter(p => p.kind === "group");
    const options = `<option value="">${t("No profile")}</option>` + people.map(opt).join("")
      + (groups.length ? `<optgroup label="${esc(t("Groups"))}">${groups.map(opt).join("")}</optgroup>` : "");
    return `<label class="rep-assign"><span>${t("Belongs to")}</span>
      <select class="rep-who" data-assign="${esc(rec.session_id)}">${options}</select></label>`;
  }

  /* ── Shared chart bits ──────────────────────────────────────────── */

  const svgWrap = inner => `<div class="rep-chart">${inner}</div>`;
  const AX = "#8089A6";

  // The halo (the chart well's own colour, painted under the glyphs) keeps a
  // label legible where it lands on a trace or a bar.
  function axisLabel(x, y, text, anchor) {
    return `<text x="${x}" y="${y}" text-anchor="${anchor || "start"}" font-size="11"
      fill="${AX}" style="stroke:var(--r-well);stroke-width:4px;stroke-linejoin:round;paint-order:stroke"
      font-family="'JetBrains Mono',monospace">${text}</text>`;
  }

  /* ── Finger tapping ─────────────────────────────────────────────── */

  function tapTrace(rec) {
    return sec(t("The recording"), tapTraceChart(rec),
      t("Thumb-to-finger distance for the whole take. Every tap the detector accepted is marked."));
  }

  // The chart alone (well + legend), also drawn on the Finger Tapping page.
  function tapTraceChart(rec) {
    const raw = rec.raw || {}, series = raw.distance_series || [];
    if (series.length < 2) return "";
    const cal = raw.calibration || {};
    const W = 640, H = 200, padL = 40, padR = 14, padT = 14, padB = 28;
    const iw = W - padL - padR, ih = H - padT - padB;
    const t0 = series[0][0], t1 = series[series.length - 1][0];
    const span = (t1 - t0) || 1;
    let lo = Infinity, hi = -Infinity;
    series.forEach(p => { lo = Math.min(lo, p[1]); hi = Math.max(hi, p[1]); });
    const thr = raw.threshold_series || [];
    [cal.d_closed, cal.d_open].forEach(v => {
      if (v != null) { lo = Math.min(lo, v); hi = Math.max(hi, v); } });
    thr.forEach(p => { lo = Math.min(lo, p[1]); hi = Math.max(hi, p[2]);
                       hi = Math.max(hi, p[1]); lo = Math.min(lo, p[2]); });
    const pad = (hi - lo) * 0.12 || 0.1; lo -= pad; hi += pad;
    const X = v => padL + iw * ((v - t0) / span);
    const Y = v => padT + ih * (1 - (v - lo) / ((hi - lo) || 1));

    let s = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img"
      aria-label="${t("Finger distance over the recording, with each tap marked")}">`;

    // Metronome beats first, so everything else sits on top of them.
    (raw.beat_times_s || []).forEach(b => {
      if (b < t0 || b > t1) return;
      s += `<line x1="${X(b).toFixed(1)}" y1="${padT}" x2="${X(b).toFixed(1)}" y2="${padT + ih}"
        stroke="${LINE_C}" stroke-width="1" opacity=".28" stroke-dasharray="2 4"/>`;
    });

    // The hysteresis the detector actually used. It tracks the excursion
    // being performed, so it is a path, not a level — sessions recorded before
    // that still carry only the two calibration levels, hence the fallback.
    if (thr.length > 1) {
      [[2, t("open")], [1, t("closed")]].forEach(([col, lbl]) => {
        const path = thr.map((p, i) =>
          `${i ? "L" : "M"}${X(p[0]).toFixed(1)},${Y(p[col]).toFixed(1)}`).join("");
        s += `<path d="${path}" fill="none" stroke="${GRID}" stroke-width="1.4"
          stroke-dasharray="5 5"/>`
          + axisLabel(padL + 3, Y(thr[0][col]) - 4, lbl);
      });
    } else {
      [["d_open", t("open")], ["d_closed", t("closed")]].forEach(([k, lbl]) => {
        if (cal[k] == null) return;
        const y = Y(cal[k]).toFixed(1);
        s += `<line x1="${padL}" y1="${y}" x2="${padL + iw}" y2="${y}" stroke="${GRID}"
          stroke-width="1.4" stroke-dasharray="5 5"/>` + axisLabel(padL + 3, +y - 4, lbl);
      });
    }

    // Long gaps and their cause (core/tapping/gaps.py). Pauses and partial
    // closures count against the rhythm, so they are shaded; a missed tap
    // the scoring forgave is drawn as a hollow tap instead.
    const gaps = (raw.gap_labels || []).filter(g => g[2] !== "missed_tap");
    gaps.forEach(([a, b]) => {
      if (b < t0 || a > t1) return;
      s += `<rect x="${X(a).toFixed(1)}" y="${padT}" width="${(X(b) - X(a)).toFixed(1)}"
        height="${ih}" fill="${ST.warn.dot}" opacity=".13"/>`;
    });
    if (raw.restored_tap_s != null) {
      const x = X(raw.restored_tap_s).toFixed(1);
      s += `<path d="M${x},${padT + ih} l-4,7 l8,0 Z" fill="none" stroke="${ST.ok.dot}"
        stroke-width="1.4"/>`;
    }

    // Taps.
    (raw.tap_times_s || []).forEach(tp => {
      const x = X(tp).toFixed(1);
      s += `<line x1="${x}" y1="${padT}" x2="${x}" y2="${padT + ih}" stroke="${ST.ok.dot}"
        stroke-width="1" opacity=".35"/>`
        + `<path d="M${x},${padT + ih} l-4,7 l8,0 Z" fill="${ST.ok.dot}"/>`;
    });

    const line = series.map((p, i) =>
      `${i ? "L" : "M"}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join("");
    s += `<path d="${line}" fill="none" stroke="${LINE_C}" stroke-width="2"
      stroke-linejoin="round" stroke-linecap="round"/>`;
    s += axisLabel(padL, H - 10, "0s") + axisLabel(padL + iw, H - 10, `${fmtNum(t1 - t0)}s`, "end");
    s += `</svg>`;

    const legend = `<div class="rep-legend">
      <span><i class="lg-tri" style="background:${ST.ok.dot}"></i>${t("tap")}</span>
      ${raw.restored_tap_s != null
        ? `<span><svg width="10" height="9" viewBox="0 0 10 9" aria-hidden="true"><path d="M5,1 L9,8 L1,8 Z" fill="none" stroke="${ST.ok.dot}" stroke-width="1.4"/></svg>${t("missed tap, forgiven")}</span>` : ""}
      ${gaps.length
        ? `<span><i class="lg-box" style="background:${ST.warn.dot}"></i>${t("pause or hesitation")}</span>` : ""}
      <span><i class="lg-dash"></i>${thr.length > 1
        ? t("tap thresholds") : t("calibrated open / closed")}</span>
      ${(raw.beat_times_s || []).length
        ? `<span><i class="lg-dash" style="border-color:${LINE_C}"></i>${t("metronome beat")}</span>` : ""}
    </div>`;
    return svgWrap(s) + legend;
  }

  function itiBars(rec) {
    return intervalBars((rec.raw || {}).tap_times_s || [],
      t("Each interval between taps"),
      t("Bar height is the gap between two taps; colour is how far that gap sat from your own mean. An even row is a low CV%."));
  }

  function intervalBars(taps, aria, note) {
    return sec(t("Interval by interval"), intervalChart(taps, aria), note);
  }

  function intervalChart(taps, aria) {
    if (taps.length < 3) return "";
    const iti = [];
    for (let i = 1; i < taps.length; i++) iti.push((taps[i] - taps[i - 1]) * 1000);
    const mean = iti.reduce((a, b) => a + b, 0) / iti.length;
    const hi = Math.max(...iti) * 1.15;
    const W = 640, H = 130, padL = 40, padR = 14, padT = 12, padB = 24;
    const iw = W - padL - padR, ih = H - padT - padB;
    const bw = Math.max(2, iw / iti.length - 3);
    const Y = v => padT + ih * (1 - v / hi);

    let s = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img"
      aria-label="${aria}">`;
    s += `<line x1="${padL}" y1="${Y(mean).toFixed(1)}" x2="${padL + iw}" y2="${Y(mean).toFixed(1)}"
      stroke="${GRID}" stroke-width="1.4" stroke-dasharray="5 5"/>`;
    iti.forEach((v, i) => {
      const off = Math.abs(v - mean) / (mean || 1);
      const c = off < 0.15 ? ST.ok.dot : off < 0.30 ? ST.warn.dot : ST.bad.dot;
      const x = padL + iw * i / iti.length;
      s += `<rect x="${x.toFixed(1)}" y="${Y(v).toFixed(1)}" width="${bw.toFixed(1)}"
        height="${(padT + ih - Y(v)).toFixed(1)}" fill="${c}" opacity=".85" rx="2">
        <title>${t("interval {n}",{n:i+1})} — ${Math.round(v)} ms</title></rect>`;
    });
    // Drawn after the bars so the tallest one cannot cover it.
    s += axisLabel(padL + iw, Y(mean) - 5, `${Math.round(mean)} ms ${t("mean")}`, "end");
    s += `<line x1="${padL}" y1="${padT + ih}" x2="${padL + iw}" y2="${padT + ih}"
      stroke="${GRID}" stroke-width="1"/></svg>`;
    return svgWrap(s);
  }

  /* ── Speech rhythm (DDK) ────────────────────────────────────────── */

  // The loudness envelope the detector read, the room's noise floor, and one
  // marker per syllable it accepted. The first trim_s seconds are shaded:
  // they were recorded but not scored (warm-up). When the phoneme model ran,
  // its reading of each syllable is written above the envelope.
  // Sustained vowel: the pitch Praat tracked, frame by frame. Only the band
  // between the two dashed edges was scored — the onset and release of a
  // vowel are meant to be unstable. Unvoiced frames (0 Hz) break the line.
  function pitchTrace(rec) {
    const raw = rec.raw || {}, f0 = raw.f0 || [];
    const voiced = f0.filter(p => p[1] > 0);
    if (voiced.length < 2) return "";
    const W = 640, H = 180, padL = 44, padR = 14, padT = 14, padB = 28;
    const iw = W - padL - padR, ih = H - padT - padB;
    const seg = raw.segment_s || [f0[0][0], f0[f0.length - 1][0]];
    const t0 = 0, t1 = Math.max(seg[1] + 0.5, f0[f0.length - 1][0]), span = (t1 - t0) || 1;
    const mean = voiced.reduce((a, p) => a + p[1], 0) / voiced.length;
    // ±8% of the mean pitch: wide enough to show a real wobble, narrow enough
    // that a steady voice reads as the flat line it is.
    let lo = mean * 0.92, hi = mean * 1.08;
    voiced.forEach(p => { lo = Math.min(lo, p[1]); hi = Math.max(hi, p[1]); });
    const X = v => padL + iw * ((v - t0) / span);
    const Y = v => padT + ih * (1 - (v - lo) / ((hi - lo) || 1));
    let s = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img"
      aria-label="${t("Pitch of the held vowel over the recording")}">`;
    seg.forEach(edge => {
      const x = X(edge).toFixed(1);
      s += `<line x1="${x}" y1="${padT}" x2="${x}" y2="${padT + ih}" stroke="${GRID}"
        stroke-width="1.4" stroke-dasharray="5 5"/>`;
    });
    s += axisLabel(X(seg[0]) + 4, padT + 12, t("scored"));
    let d = "", pen = false;
    f0.forEach(p => {
      if (!(p[1] > 0)) { pen = false; return; }
      d += `${pen ? "L" : "M"}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`;
      pen = true;
    });
    s += `<path d="${d}" fill="none" stroke="${LINE_C}" stroke-width="1.8"
      stroke-linejoin="round" stroke-linecap="round"/>`;
    s += axisLabel(padL - 4, Y(hi) + 4, `${Math.round(hi)} Hz`, "end")
      + axisLabel(padL - 4, Y(lo), `${Math.round(lo)} Hz`, "end");
    s += axisLabel(padL, H - 10, "0s") + axisLabel(padL + iw, H - 10, `${fmtNum(t1)}s`, "end");
    s += `</svg>`;
    return sec(t("The recording"), svgWrap(s),
      t("The pitch of your voice through the held vowel. A steady voice is a flat line; jitter is the cycle-to-cycle roughness too fine to see at this scale, and a slow regular wave is vocal tremor. The audio itself is not kept."));
  }

  function ddkTrace(rec) {
    const raw = rec.raw || {}, env = raw.envelope || [];
    if (env.length < 2) return "";
    const W = 640, H = 200, padL = 40, padR = 14, padT = 22, padB = 28;
    const iw = W - padL - padR, ih = H - padT - padB;
    const t0 = env[0][0], t1 = env[env.length - 1][0], span = (t1 - t0) || 1;
    let lo = Infinity, hi = -Infinity;
    env.forEach(p => { lo = Math.min(lo, p[1]); hi = Math.max(hi, p[1]); });
    if (raw.floor_db != null) lo = Math.min(lo, raw.floor_db);
    lo -= 3; hi += 3;
    const X = v => padL + iw * ((v - t0) / span);
    const Y = v => padT + ih * (1 - (v - lo) / ((hi - lo) || 1));

    let s = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img"
      aria-label="${t("Loudness over the recording, with each syllable marked")}">`;
    const trim = raw.trim_s || 0;
    if (trim > t0) {
      s += `<rect x="${padL}" y="${padT}" width="${(X(Math.min(trim, t1)) - padL).toFixed(1)}"
        height="${ih}" fill="${GRID}" opacity=".35"/>`
        + axisLabel(padL + 3, padT + 12, t("warm-up"));
    }
    if (raw.floor_db != null) {
      const y = Y(raw.floor_db).toFixed(1);
      s += `<line x1="${padL}" y1="${y}" x2="${padL + iw}" y2="${y}" stroke="${GRID}"
        stroke-width="1.4" stroke-dasharray="5 5"/>` + axisLabel(padL + iw, +y - 4, t("room noise"), "end");
    }
    (raw.onsets_s || []).forEach(o => {
      const x = X(o).toFixed(1);
      s += `<line x1="${x}" y1="${padT}" x2="${x}" y2="${padT + ih}" stroke="${ST.ok.dot}"
        stroke-width="1" opacity=".3"/>`
        + `<path d="M${x},${padT + ih} l-4,7 l8,0 Z" fill="${ST.ok.dot}"/>`;
    });
    const line = env.map((p, i) =>
      `${i ? "L" : "M"}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join("");
    s += `<path d="${line}" fill="none" stroke="${LINE_C}" stroke-width="1.8"
      stroke-linejoin="round" stroke-linecap="round"/>`;
    // Phoneme model: only the stop consonants mark a syllable (see phonemes.py).
    const SYL = {p:"pa", b:"pa", t:"ta", d:"ta", k:"ka", g:"ka", "\u0261":"ka"};
    (raw.phones || []).forEach(ph => {
      const lab = SYL[(ph[0] || "")[0]];
      if (!lab || ph[1] < t0 || ph[1] > t1) return;
      s += `<text x="${X(ph[1]).toFixed(1)}" y="${padT - 8}" text-anchor="middle"
        font-size="9" fill="${INK_DIM}">${lab}</text>`;
    });
    s += axisLabel(padL, H - 10, "0s") + axisLabel(padL + iw, H - 10, `${fmtNum(t1 - t0)}s`, "end");
    s += `</svg>`;
    const legend = `<div class="rep-legend">
      <span><i class="lg-tri" style="background:${ST.ok.dot}"></i>${t("syllable")}</span>
      ${raw.floor_db != null ? `<span><i class="lg-dash"></i>${t("room noise")}</span>` : ""}
    </div>`;
    return sec(t("The recording"), svgWrap(s) + legend,
      t("Loudness of the voice for the whole take. Each peak is a vowel; every syllable the detector accepted is marked. The audio itself is not kept."));
  }

  /* ── Hand tremor ────────────────────────────────────────────────── */

  // One spectrum per hold, both hands on the same axes: a tremor is a peak
  // standing out of the flat tracking-noise floor, and the left/right gap is
  // the finding a one-sided rest tremor makes. Units are the same RMS % of
  // hand length the headline uses, per 0.25 Hz step.
  const HAND_C = { left: LINE_C, right: "#FF9B7A" };
  // Current holds first; "rest" / "rest_count" are the retired table
  // protocol (before 2026-09-27), kept so those sessions still draw.
  const TREMOR_PHASES = [["rest_palm_up", "Palms up"], ["rest_palm_down", "Palms down"],
                         ["rest", "Rest"], ["rest_count", "Counting"],
                         ["postural", "Arms out"]];

  /* The tremor finding as a plain tag, so a run with no peak (a small number
     that is only noise) cannot be read as a smaller version of one with a
     peak. Run level: no peak / a weak peak (status "warning") / a peak.
     Per hold and hand: the cell's own verdict. */
  const TREMOR_TAGS = {
    none:     ["ok",   "No tremor detected"],
    possible: ["warn", "Possible tremor"],
    detected: ["bad",  "Tremor detected"],
  };
  function tremorTagHtml(kind) {
    const [cls, word] = TREMOR_TAGS[kind] || TREMOR_TAGS.none;
    return `<span class="badge badge-${cls}"><span class="badge-dot"></span>${t(word)}</span>`;
  }
  function tremorTag(m) {
    return tremorTagHtml(m.tremor_peak_hz == null ? "none"
      : m.status === "warning" ? "possible" : "detected");
  }

  function tremorSpectra(rec) {
    const raw = rec.raw || {}, phases = raw.phases || {};
    const cells = (rec.metrics || {}).cells || {};
    const W = 640, H = 150, padL = 40, padR = 14, padT = 16, padB = 26;
    const iw = W - padL - padR, ih = H - padT - padB;
    let out = "";
    TREMOR_PHASES.forEach(([key, name]) => {
      const spectra = (phases[key] || {}).spectra || {};
      const hands = Object.keys(spectra).filter(h => (spectra[h] || []).length > 1);
      if (!hands.length) return;
      let fMax = 0, vMax = 0;
      hands.forEach(h => spectra[h].forEach(([f, v]) => {
        fMax = Math.max(fMax, f); vMax = Math.max(vMax, v); }));
      const f0 = 1, span = (fMax - f0) || 1;
      vMax = vMax * 1.15 || 1;
      const X = f => padL + iw * ((f - f0) / span);
      const Y = v => padT + ih * (1 - v / vMax);
      let s = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img"
        aria-label="${t("Tremor spectrum for each hand")}">`;
      // the band the test scores, shaded
      const b0 = X(3.5), b1 = X(Math.min(12, fMax));
      s += `<rect x="${b0.toFixed(1)}" y="${padT}" width="${Math.max(0, b1 - b0).toFixed(1)}"
        height="${ih}" fill="${GRID}" opacity=".35"/>`;
      hands.forEach(h => {
        const path = spectra[h].map(([f, v], i) =>
          `${i ? "L" : "M"}${X(f).toFixed(1)},${Y(v).toFixed(1)}`).join("");
        s += `<path d="${path}" fill="none" stroke="${HAND_C[h] || INK_DIM}" stroke-width="2"
          stroke-linejoin="round" stroke-linecap="round"/>`;
        const c = (cells[key] || {})[h] || {};
        if (c.peak_hz != null && c.verdict && c.verdict !== "none") {
          const pv = spectra[h].reduce((best, p) =>
            Math.abs(p[0] - c.peak_hz) < Math.abs(best[0] - c.peak_hz) ? p : best);
          const col = c.verdict === "detected" ? ST.bad.dot : ST.warn.dot;
          s += `<circle cx="${X(pv[0]).toFixed(1)}" cy="${Y(pv[1]).toFixed(1)}" r="4.5" fill="${col}"/>`;
        }
      });
      s += axisLabel(padL, H - 8, `${fmtNum(f0)} Hz`)
        + axisLabel(b0 + 3, padT + 11, "3.5")
        + axisLabel(padL + iw, H - 8, `${fmtNum(fMax)} Hz`, "end");
      s += `</svg>`;
      const facts = hands.map(h => {
        const c = (cells[key] || {})[h] || {};
        if (!c.verdict) return "";
        // no peak, no frequency: the tallest noise bin's Hz means nothing
        const nums = c.verdict !== "none" && c.peak_hz != null
          ? ` · ${fmtNum(c.peak_hz)} Hz · ${fmtNum(c.amp_pct)}%` : "";
        return `<span><i class="lg-line" style="background:${HAND_C[h] || INK_DIM}"></i>${t(h === "left" ? "Left hand" : "Right hand")}
              ${tremorTagHtml(c.verdict)}${nums}</span>`;
      }).join("");
      out += `<h4 class="rep-sub">${t(name)}</h4>${svgWrap(s)}<div class="rep-legend">${facts}</div>`;
    });
    if (!out) return "";
    return sec(t("Tremor spectrum"), out,
      t("How much each hand moved at each frequency, in % of hand length. A tremor is a single peak standing out of the flat noise floor; the shaded band is what the test scores. A dot marks a peak it reported."));
  }

  function tremorGlove(rec) {
    const g = (rec.raw || {}).glove;
    if (!g) return "";
    const rows = TREMOR_PHASES.map(([key, name]) => {
      const c = g[key];
      const src = c && (c.gyro || c.accel);
      return src ? `<div><span>${t(name)}</span><b>${fmtNum(src.peak_hz)} Hz · ${fmtNum(src.band_frac * 100)}%</b></div>` : "";
    }).join("");
    return rows ? sec(t("Glove sensor"), `<div class="rep-foot">${rows}</div>`,
      t("Peak frequency and tremor-band share of the glove's gyroscope over each hold — the reference the camera's peak is compared against.")) : "";
  }

  /* ── Walking test, seated part ──────────────────────────────────── */

  // Knee lift for each leg with every stamp the detector counted, then the
  // sit-to-stand trace with each full stand marked. Both are in body units
  // (thigh lengths), so camera distance cancels out.
  const LEG_C = { right: "#FF9B7A", left: LINE_C };

  function gaitLegs(rec) {
    const blocks = (rec.raw || {}).blocks || {};
    const W = 640, H = 120, padL = 36, padR = 12, padT = 12, padB = 22;
    const iw = W - padL - padR, ih = H - padT - padB;
    let out = "";
    [["leg_right", "right"], ["leg_left", "left"]].forEach(([key, side]) => {
      const b = blocks[key] || {}, lift = b.lift || [];
      if (lift.length < 2) return;
      const t1 = lift[lift.length - 1][0] || 1;
      const vMax = Math.max(0.1, ...lift.map(p => p[1])) * 1.15;
      const vMin = Math.min(0, ...lift.map(p => p[1]));
      const X = tt => padL + iw * (tt / t1);
      const Y = v => padT + ih * (1 - (v - vMin) / (vMax - vMin));
      const path = lift.map(([tt, v], i) => `${i ? "L" : "M"}${X(tt).toFixed(1)},${Y(v).toFixed(1)}`).join("");
      let g = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img"
        aria-label="${t("Knee lift over time")}">`;
      (b.blackouts || []).forEach(([a, z]) => {
        g += `<rect x="${X(Math.max(0, a)).toFixed(1)}" y="${padT}" width="${Math.max(0, X(Math.min(t1, z)) - X(Math.max(0, a))).toFixed(1)}"
          height="${ih}" fill="${GRID}" opacity=".45"/>`;
      });
      g += `<path d="${path}" fill="none" stroke="${LEG_C[side]}" stroke-width="1.8" stroke-linejoin="round"/>`;
      (b.stamps || []).forEach(tt => {
        g += `<circle cx="${X(tt).toFixed(1)}" cy="${Y(0).toFixed(1)}" r="3" fill="${ST.ok.dot}"/>`;
      });
      g += axisLabel(padL, H - 6, "0s") + axisLabel(padL + iw, H - 6, `${fmtNum(t1)}s`, "end") + `</svg>`;
      const c = (((rec.metrics || {}).blocks || {})[key]) || {};
      const facts = c.scored
        ? `${t("{n} stamps", { n: c.n_stamps })} · ${fmtNum(c.rate_hz)}/s · ${t("lift")} ${fmtNum(c.amp_pct)}%`
          + (c.amp_decrement_pct != null ? ` · ${t("lift change")} ${fmtNum(c.amp_decrement_pct)}%` : "")
        : (c.reason ? t(c.reason) : "");
      out += `<h4 class="rep-sub">${t(side === "right" ? "Right leg" : "Left leg")}</h4>${svgWrap(g)}
        <div class="rep-legend"><span>${facts}</span></div>`;
    });
    if (!out) return "";
    return sec(t("Leg stamps"), out,
      t("How high the knee rose, in thigh lengths, for ten seconds of stamping. Each dot is a stamp the test counted; shaded stretches are where the leg was out of view and nothing was scored."));
  }

  function gaitStands(rec) {
    const b = ((rec.raw || {}).blocks || {}).sts5 || {}, si = b.stand_index || [];
    if (si.length < 2) return "";
    const W = 640, H = 150, padL = 36, padR = 12, padT = 12, padB = 22;
    const iw = W - padL - padR, ih = H - padT - padB;
    const t1 = si[si.length - 1][0] || 1;
    const X = tt => padL + iw * (tt / t1);
    const Y = v => padT + ih * (1 - (Math.max(-0.2, Math.min(1.3, v)) + 0.2) / 1.5);
    const path = si.map(([tt, v], i) => `${i ? "L" : "M"}${X(tt).toFixed(1)},${Y(v).toFixed(1)}`).join("");
    let g = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img"
      aria-label="${t("Hip height over time")}">`;
    g += `<line x1="${padL}" y1="${Y(0.75).toFixed(1)}" x2="${padL + iw}" y2="${Y(0.75).toFixed(1)}"
      stroke="${GRID}" stroke-width="1.2" stroke-dasharray="5 5"/>`;
    g += `<path d="${path}" fill="none" stroke="${LINE_C}" stroke-width="2" stroke-linejoin="round"/>`;
    (b.stands || []).forEach((st, i) => {
      if (st.up == null) return;
      const col = st.hands ? ST.warn.dot : ST.ok.dot;
      g += `<circle cx="${X(st.up).toFixed(1)}" cy="${Y(0.75).toFixed(1)}" r="4.5" fill="${col}"/>`
        + axisLabel(X(st.up), Y(0.75) - 8, String(i + 1), "middle");
    });
    g += axisLabel(padL, H - 6, "0s") + axisLabel(padL + iw, H - 6, `${fmtNum(t1)}s`, "end") + `</svg>`;
    const m = rec.metrics || {};
    const legend = `<div class="rep-legend">
      <span><i class="lg-dot" style="background:${ST.ok.dot}"></i>${t("full stand")}</span>
      <span><i class="lg-dot" style="background:${ST.warn.dot}"></i>${t("used the hands")}</span>
      ${m.failed_attempts ? `<span>${t("{n} failed rises", { n: m.failed_attempts })}</span>` : ""}
    </div>`;
    return sec(t("Five sit-to-stands"), svgWrap(g) + legend,
      t("How high the hips were above the knees: 0 is seated, 1 is standing. The dashed line is where a rise counts as a full stand."));
  }

  /* ── Spiral ─────────────────────────────────────────────────────── */

  function spiralTrace(rec) {
    const raw = rec.raw || {}, sm = raw.samples || [], sp = raw.spiral || {};
    if (sm.length < 2) return "";
    const c = sp.center || [320, 240];
    const cx = c[0], cy = c[1];
    // Newer records carry the frame and radius; older ones were always
    // centred with a 0.4 radius, so both can be recovered from the centre.
    const fw = sp.frame ? sp.frame[0] : Math.round(cx * 2);
    const fh = sp.frame ? sp.frame[1] : Math.round(cy * 2);
    const turns = sp.turns || 3.5;
    const maxR = sp.radius || 0.4 * Math.min(fw, fh);
    const b = maxR / (turns * 2 * Math.PI);
    // Older records stored the deviation in pixels (5 columns); the current
    // ones store it as a percentage of the outer radius. Normalise to %.
    const asPct = sm[0].length >= 5 ? (d => d / maxR * 100) : (d => d);

    // Template: the same r = b·θ the test drew (core/spiral/geometry.py). The
    // equal-arc-length resampling only matters for pacing, not for drawing.
    const N = 700, maxT = turns * 2 * Math.PI;
    let guide = "";
    for (let i = 0; i < N; i++) {
      const th = maxT * i / (N - 1), r = b * th;
      guide += `${i ? "L" : "M"}${(cx + r * Math.cos(th)).toFixed(1)},${(cy - r * Math.sin(th)).toFixed(1)}`;
    }

    // The traced path, split into runs of the same deviation band so the whole
    // thing is a handful of paths instead of one per sample.
    const band = d => d < 5 ? 0 : d < 12 ? 1 : 2;
    const COL = [ST.ok.dot, ST.warn.dot, ST.bad.dot];
    let runs = [], cur = null;
    sm.forEach(p => {
      const bnd = band(asPct(p[3] == null ? 0 : p[3]));
      if (!cur || cur.b !== bnd) { cur = { b: bnd, pts: [] }; runs.push(cur); }
      cur.pts.push(p);
      if (cur.pts.length === 1 && runs.length > 1) {
        const prev = runs[runs.length - 2].pts;      // bridge the gap between runs
        cur.pts.unshift(prev[prev.length - 1]);
      }
    });

    let s = `<svg viewBox="0 0 ${fw} ${fh}" preserveAspectRatio="xMidYMid meet" role="img"
      aria-label="${t("The spiral you traced over the template you were following")}">`;
    s += `<path d="${guide}" fill="none" stroke="${GRID}" stroke-width="2.4" opacity=".9"/>`;
    runs.forEach(r => {
      if (r.pts.length < 2) return;
      const d = r.pts.map((p, i) => `${i ? "L" : "M"}${p[1].toFixed(1)},${p[2].toFixed(1)}`).join("");
      s += `<path d="${d}" fill="none" stroke="${COL[r.b]}" stroke-width="2.6"
        stroke-linecap="round" stroke-linejoin="round" opacity=".95"/>`;
    });
    const last = sm[sm.length - 1];
    s += `<circle cx="${sm[0][1]}" cy="${sm[0][2]}" r="5" fill="none" stroke="${LINE_C}" stroke-width="2"/>`
      + `<circle cx="${last[1]}" cy="${last[2]}" r="4" fill="${LINE_C}"/></svg>`;

    const legend = `<div class="rep-legend">
      <span><i class="lg-line" style="background:${GRID}"></i>${t("template")}</span>
      <span><i class="lg-line" style="background:${COL[0]}"></i>${t("on the line")}</span>
      <span><i class="lg-line" style="background:${COL[1]}"></i>${t("drifting")}</span>
      <span><i class="lg-line" style="background:${COL[2]}"></i>${t("off the line")}</span>
    </div>`;
    return sec(t("What you drew"), svgWrap(s) + legend,
      t("Your fingertip path over the template it was aiming at, coloured by how far off the line it was (as a share of the spiral's radius). The ring marks the start."));
  }

  function spiralSpeed(rec) {
    const sm = (rec.raw || {}).samples || [];
    if (sm.length < 8) return "";
    const v = [];
    for (let i = 1; i < sm.length; i++) {
      const dt = sm[i][0] - sm[i - 1][0];
      if (dt <= 0) continue;
      v.push([sm[i][0], Math.hypot(sm[i][1] - sm[i - 1][1], sm[i][2] - sm[i - 1][2]) / dt]);
    }
    if (v.length < 4) return "";
    const W = 640, H = 140, padL = 46, padR = 14, padT = 12, padB = 24;
    const iw = W - padL - padR, ih = H - padT - padB;
    const t0 = v[0][0], t1 = v[v.length - 1][0], span = (t1 - t0) || 1;
    const hi = Math.max(...v.map(p => p[1])) * 1.1 || 1;
    const mean = v.reduce((a, p) => a + p[1], 0) / v.length;
    const X = x => padL + iw * ((x - t0) / span);
    const Y = y => padT + ih * (1 - y / hi);
    const line = v.map((p, i) => `${i ? "L" : "M"}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join("");
    let s = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img"
        aria-label="${t("Tracing speed over time")}">`
      + `<line x1="${padL}" y1="${Y(mean).toFixed(1)}" x2="${padL + iw}" y2="${Y(mean).toFixed(1)}"
          stroke="${GRID}" stroke-width="1.4" stroke-dasharray="5 5"/>`
      + axisLabel(padL + iw, Y(mean) - 5, `${Math.round(mean)} px/s ${t("mean")}`, "end")
      + `<path d="${line}" fill="none" stroke="${LINE_C}" stroke-width="1.8"
          stroke-linejoin="round" stroke-linecap="round"/>`
      + axisLabel(padL, H - 8, "0s") + axisLabel(padL + iw, H - 8, `${fmtNum(t1 - t0)}s`, "end")
      + `</svg>`;
    return sec(t("Speed through the turn"), svgWrap(s),
      t("How fast the fingertip moved. Even tracing holds one height; velocity variability is this line's scatter."));
  }

  /* ── Oculomotor ─────────────────────────────────────────────────── */

  const OUT = {
    correct: ["ok", "correct"],
    error_uncorrected: ["bad", "looked at the target"],
    error_corrected: ["warn", "corrected"],
    anticipatory: ["warn", "too early"],
    no_response: ["none", "no response"],
    face_lost: ["none", "face lost"],
  };

  // `sel` is the open trial; the report passes its own, a test page its own.
  function gazeTrace(rec, sel = selTrial) {
    const raw = rec.raw || {}, trials = raw.trials || {};
    const blocks = [["pro", "Pro-saccade — look at it"], ["anti", "Anti-saccade — look away"]];
    if (!(trials.pro || trials.anti)) return "";

    const rows = blocks.map(([key, title]) => {
      const list = trials[key] || [];
      if (!list.length) return "";
      const chips = list.map((tr, i) => {
        const o = OUT[tr.outcome] || ["none", tr.outcome];
        const id = `${key}:${i}`;
        return `<button class="tr-chip vs-${o[0]}${sel === id ? " is-open" : ""}"
          data-trial="${id}" title="${t(o[1])}${tr.latency_ms ? ` · ${Math.round(tr.latency_ms)} ms` : ""}">
          <span class="tr-n">${i + 1}</span>
          <span class="tr-lat">${tr.latency_ms ? Math.round(tr.latency_ms) : "—"}</span></button>`;
      }).join("");
      return `<div class="tr-block"><div class="tr-title">${t(title)}</div>
        <div class="tr-chips">${chips}</div></div>`;
    }).join("");

    const key = ["correct", "error_uncorrected", "error_corrected", "anticipatory", "no_response"]
      .map(k => `<span><i class="lg-dot vs-${OUT[k][0]}"></i>${t(OUT[k][1])}</span>`).join("");

    return sec(t("Trial by trial"),
      rows + `<div class="rep-legend">${key}</div>` + `<div data-trial-panel>${trialPanel(rec, sel)}</div>`,
      t("Each square is one trial, numbered in order, showing its latency in ms. Open one to see where the eyes actually went."));
  }

  function trialPanel(rec, sel = selTrial) {
    const raw = rec.raw || {}, trials = raw.trials || {};
    if (!sel) return `<div class="rep-msg rep-quiet">${t("Select a trial above.")}</div>`;
    const [key, idxs] = sel.split(":");
    const tr = (trials[key] || [])[+idxs];
    if (!tr || !(tr.series || []).length)
      return `<div class="rep-msg rep-quiet">${t("That trial has no gaze trace.")}</div>`;

    const pts = tr.series.filter(p => p[1] != null);
    if (pts.length < 2) return `<div class="rep-msg rep-quiet">${t("That trial has no gaze trace.")}</div>`;
    const W = 640, H = 170, padL = 46, padR = 14, padT = 12, padB = 26;
    const iw = W - padL - padR, ih = H - padT - padB;
    const t1 = pts[pts.length - 1][0] || 1;
    // The detector measures from where the eye was resting when the dot
    // appeared, not from an absolute zero, so the chart has to as well —
    // otherwise the drawn line disagrees with the verdict beside it.
    // Sessions from engine v1 carry no baseline; they were scored against 0.
    const base = tr.baseline != null ? tr.baseline : 0;
    const conf = tr.confirm_thr != null ? tr.confirm_thr : null;
    const lim = Math.max(1, conf ? conf * 1.4 : 0,
                         ...pts.map(p => Math.abs(p[1] - base))) * 1.1;
    const X = x => padL + iw * (x / t1);
    const Y = y => padT + ih * (1 - ((y - base) + lim) / (2 * lim));
    // Which side was the right answer: pro → toward the target, anti → away.
    const good = key === "anti" ? -tr.dir : tr.dir;
    const goodTop = good < 0;   // negative gaze values are drawn upward

    let s = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img"
      aria-label="${t("Gaze position through one trial")}">`;
    s += `<rect x="${padL}" y="${goodTop ? padT : padT + ih / 2}" width="${iw}" height="${ih / 2}"
        fill="${ST.ok.band}"/>`
      + `<rect x="${padL}" y="${goodTop ? padT + ih / 2 : padT}" width="${iw}" height="${ih / 2}"
        fill="${ST.bad.band}"/>`
      + `<line x1="${padL}" y1="${Y(base).toFixed(1)}" x2="${padL + iw}" y2="${Y(base).toFixed(1)}"
        stroke="${GRID}" stroke-width="1.2"/>`;
    // The excursion the trace had to reach to count as a saccade at all.
    if (conf) [base + conf, base - conf].forEach(v => {
      s += `<line x1="${padL}" y1="${Y(v).toFixed(1)}" x2="${padL + iw}" y2="${Y(v).toFixed(1)}"
        stroke="${GRID}" stroke-width="1" opacity=".55" stroke-dasharray="4 4"/>`;
    });
    if (tr.latency_ms) {
      const lx = X(tr.latency_ms / 1000).toFixed(1);
      s += `<line x1="${lx}" y1="${padT}" x2="${lx}" y2="${padT + ih}" stroke="${LINE_C}"
        stroke-width="1.4" stroke-dasharray="4 4"/>`
        + axisLabel(+lx + 4, padT + 12, `${Math.round(tr.latency_ms)} ms`);
    }
    const line = pts.map((p, i) => `${i ? "L" : "M"}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join("");
    s += `<path d="${line}" fill="none" stroke="${LINE_C}" stroke-width="2.2"
        stroke-linejoin="round" stroke-linecap="round"/>`
      + axisLabel(padL + 4, goodTop ? padT + 13 : padT + ih - 5, t("correct side"))
      + axisLabel(padL, H - 8, "0s") + axisLabel(padL + iw, H - 8, `${fmtNum(t1)}s`, "end")
      + `</svg>`;
    const o = OUT[tr.outcome] || ["none", tr.outcome];
    const head = `<div class="tr-head"><span class="badge badge-${o[0]}">
        <span class="badge-dot"></span>${t(o[1])}</span>
      <span class="tr-meta">${t(tr.dir < 0 ? "target on the left" : "target on the right")}</span></div>`;
    return head + svgWrap(s);
  }

  function fixationPanel(rec) {
    const f = (rec.raw || {}).fixation;
    if (!f || !(f.series || []).length) return "";
    const m = rec.metrics || {};
    const pts = f.series.filter(p => p[1] != null);
    if (pts.length < 4) return "";
    const W = 640, H = 130, padL = 46, padR = 14, padT = 12, padB = 22;
    const iw = W - padL - padR, ih = H - padT - padB;
    const t0 = pts[0][0], t1 = pts[pts.length - 1][0], span = (t1 - t0) || 1;
    const lim = Math.max(0.05, ...pts.map(p => Math.abs(p[1]))) * 1.15;
    const X = x => padL + iw * ((x - t0) / span);
    const Y = y => padT + ih * (1 - (y + lim) / (2 * lim));
    const line = pts.map((p, i) => `${i ? "L" : "M"}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join("");
    const s = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img"
        aria-label="${t("Gaze position while holding still")}">
        <line x1="${padL}" y1="${Y(0).toFixed(1)}" x2="${padL + iw}" y2="${Y(0).toFixed(1)}"
          stroke="${GRID}" stroke-width="1.2" stroke-dasharray="5 5"/>
        <path d="${line}" fill="none" stroke="${LINE_C}" stroke-width="1.8"
          stroke-linejoin="round" stroke-linecap="round"/>
        ${axisLabel(padL, H - 6, "0s")}${axisLabel(padL + iw, H - 6, `${fmtNum(t1 - t0)}s`, "end")}
      </svg>`;
    const note = m.fixation_label
      ? `${t(m.fixation_label)} · ${t("{n} intrusions", { n: f.intrusion_count || 0 })}`
      : t("{n} intrusions", { n: f.intrusion_count || 0 });
    return sec(t("Holding still"), svgWrap(s), note);
  }

  const TRACE = {
    finger_tapping: rec => tapTrace(rec) + itiBars(rec),
    spiral: rec => spiralTrace(rec) + spiralSpeed(rec),
    oculomotor: rec => gazeTrace(rec) + fixationPanel(rec),
    tremor: rec => tremorSpectra(rec) + tremorGlove(rec),
    gait: rec => gaitLegs(rec) + gaitStands(rec),
    ddk: rec => ddkTrace(rec) + intervalBars((rec.raw || {}).onsets_s || [],
      t("Each interval between syllables"),
      t("Bar height is the gap between two syllables; colour is how far that gap sat from your own mean. Breath pauses show as tall bars and are left out of the score.")),
    phonation: rec => pitchTrace(rec),
  };

  /* ── Events ─────────────────────────────────────────────────────── */

  // Reassigning repaints the panel from the updated record, so the change is
  // shown where it was made rather than only on the page behind.
  box.addEventListener("change", async e => {
    const sel = e.target.closest("[data-assign]");
    if (!sel || !window.assignSession) return;
    const id = sel.dataset.assign;
    const ok = await window.assignSession(id, sel.value);
    if (!ok) return;
    const rec = cache.get(id);
    if (rec) {
      rec.profile = window.profileById?.(sel.value) || {};
      if (openId === id) paint(rec);
    }
  });

  box.addEventListener("click", e => {
    const stepBtn = e.target.closest("[data-step]");
    if (stepBtn) { step(+stepBtn.dataset.step); return; }
    if (e.target.closest(".rep-close")) { closeReport(); return; }
    const recBtn = e.target.closest("[data-recording]");
    if (recBtn) { openRecording(recBtn.dataset.recording); return; }
    const chip = e.target.closest("[data-trial]");
    if (chip) {
      selTrial = selTrial === chip.dataset.trial ? null : chip.dataset.trial;
      box.querySelectorAll("[data-trial]").forEach(c =>
        c.classList.toggle("is-open", c.dataset.trial === selTrial));
      // Scoped to the panel: a test page can show the same chart behind it.
      const panel = box.querySelector("[data-trial-panel]");
      if (panel) panel.innerHTML = trialPanel(cache.get(openId) || {});
    }
  });
  backdrop.addEventListener("click", closeReport);

  document.addEventListener("keydown", e => {
    if (openId === null) return;
    if (e.key === "Escape") { closeReport(); return; }
    if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
    if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
    if (e.key === "Tab") {
      // aria-modal claims the rest of the page is inert, so keep Tab inside.
      const f = box.querySelectorAll("button:not([disabled]), [href], [tabindex]:not([tabindex='-1'])");
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  // Language switch: repaint whatever is open (app.js owns the hook list).
  // The switch also re-renders the Analysis page, so the strips come back
  // fresh and the open session has to be re-marked on them.
  onLang(() => {
    if (openId === null) return;
    if (cache.has(openId)) paint(cache.get(openId));
    setTimeout(markStrip, 0);
  });

  // profiles.js calls this after moving a session, so a reopened report is
  // never the stale copy from before the move.
  window.forgetReport = id => cache.delete(id);
  window.openReport = openReport;
  // The test pages' "What we measure" card draws one real run with these, so
  // it shows exactly what a session report shows.
  window.recordingSections = (rec, opts = {}) => rec.test === "oculomotor"
    ? gazeTrace(rec, opts.trial || null) + fixationPanel(rec)
    : (TRACE[rec.test] || (() => ""))(rec);
  window.trialPanelFor = (rec, sel) => trialPanel(rec, sel);
  window.tapCharts = rec => ({
    trace: tapTraceChart(rec),
    intervals: intervalChart((rec.raw || {}).tap_times_s || [], t("Each interval between taps")),
  });
  window.closeReport = closeReport;
})();
