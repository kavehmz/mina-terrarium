// The page: draws the house and the panels from the server's live stream. It decides nothing.
import { Scene } from "/public/scene.mjs";
import { SPOTS, OUTSIDE, ROOMS } from "/shared/layout.mjs";

const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const scene = new Scene($("scene"));
let snap = null, lastTickAt = 0, lastFireAt = 0, lastThoughtClock = null, thoughtShownAt = 0, storyKeys = new Set();
const costHistory = [];

const NEEDS = [
  ["hunger", "🍽", "Hunger", n => n.hunger],
  ["energy", "😴", "Tiredness", n => 1 - n.energy],
  ["hygiene", "🚿", "Wash", n => 1 - n.hygiene],
  ["bladder", "🚽", "Toilet", n => n.bladder],
  ["boredom", "🥱", "Boredom", n => n.boredom],
  ["loneliness", "🫂", "Loneliness", n => n.loneliness],
];
const PRESSING = {
  nothing: "Nothing pressing", hunger: "Hunger", tiredness: "Tiredness", hygiene: "Wants a wash", toilet: "Needs the toilet",
  boredom: "Boredom", loneliness: "Missing people", message: "A message to answer", door: "Someone at the door",
  obligation: "Something she must do", danger: "Something is wrong", pain: "Pain", someone_here: "Someone needs her here",
};
const PRESS_COLOR = {
  nothing: "#9fb0c4", hunger: "#ffb020", tiredness: "#7d8cff", hygiene: "#6fc7ff", toilet: "#c9a26b", boredom: "#9dd35f",
  loneliness: "#ff8fc0", message: "#2ad1c9", door: "#ffd27a", obligation: "#ff9f5a", danger: "#ff4a3a", pain: "#ff4a3a", someone_here: "#ffd27a",
};
const MOODS = ["😣 Miserable", "😕 Low", "😐 Okay", "🙂 Good", "😄 Happy"];
const ALARM_WORDS = /(smoke|burning|alarm|shriek|water on|overflow|running|doorbell|pain|floor|no power|open|dark)/i;

// ---------- live stream ----------
function connect() {
  const es = new EventSource("/api/stream");
  es.onmessage = ev => { snap = JSON.parse(ev.data); scene.update(snap); render(); };
  es.onerror = () => { es.close(); setTimeout(connect, 2000); };
}
connect();

function frame() { scene.frame(); if (snap) placeLabels(); requestAnimationFrame(frame); }
requestAnimationFrame(frame);

// ---------- panels ----------
function render() {
  const s = snap, p = s.person, b = s.brain;
  // Top bar.
  $("pauseBtn").textContent = s.run.paused ? "Resume" : "Pause";
  $("pausedCard").hidden = !s.run.paused;
  const sel = $("speedSel");
  if (!sel.options.length) sel.innerHTML = s.run.speeds.map(v => `<option value="${v}">${v === 1 ? "real time" : `${v}×`}</option>`).join("");
  if (document.activeElement !== sel) sel.value = String(s.run.quietSpeed);
  // The System Two model: switchable while she lives; the page names whichever one is deciding.
  const ms = $("modelSel");
  if (ms.options.length !== s.run.models.length) ms.innerHTML = s.run.models.map(m => `<option value="${m.id}">${esc(m.label)}</option>`).join("");
  if (document.activeElement !== ms) ms.value = s.run.mind.id;
  for (const el of document.querySelectorAll(".mindbrand")) el.textContent = s.run.mind.brand;
  $("modelName").textContent = s.run.mind.label;
  // Rate over all the time the world has actually run: pauses and empty rooms cost nothing and do not count.
  const hours = s.run.runningSeconds / 3600;
  $("costPill").textContent = `$${s.cost.total.toFixed(3)} spent${hours > 0.02 ? ` · ≈$${(s.cost.total / hours).toFixed(2)} per running hour` : ""}`;
  $("costPill").title = `Jev $${s.cost.jev.toFixed(4)} (${b.stats.ticks} ticks) · System Two as Mina $${s.cost.mind.toFixed(4)} (${b.stats.mindCalls} calls) · other people $${s.cost.people.toFixed(4)} (${b.stats.peopleCalls} calls)`;
  $("banner").hidden = !b.error; if (b.error) $("banner").textContent = `Error: ${b.error}`;
  if (!s.run.paused && !s.run.running) { $("pausedCard").hidden = false; $("pausedCard").innerHTML = "<b>Waiting</b><span>Nobody is watching, so her world is stopped.</span>"; }
  else if (s.run.paused) $("pausedCard").innerHTML = "<b>Paused</b><span>The world and her brain are stopped. No API calls, no cost.</span>";

  renderChain(s);
  renderLeft(s);
  renderBrain(s);
  renderBottom(s);
}

function feelWords(s) {
  const p = s.person, out = [];
  if (!p.awake) out.push("asleep");
  const alarms = [...(s.senses.smell || []), ...(s.senses.hear || []), ...(s.senses.see || [])].filter(x => /smoke|burning|alarm|water on|overflow|doorbell|dark|no power/i.test(x));
  if (alarms.length) out.push(alarms[0]);
  if (p.pain > 0.1) out.push(p.pain > 0.6 ? "sharp pain" : "aching");
  const ranked = NEEDS.map(([k, , , f]) => [k, f(p.needs)]).sort((a, b) => b[1] - a[1]).filter(([, v]) => v > 0.42).slice(0, 2);
  for (const [k] of ranked) out.push(p.words[k]);
  return out.length ? out.slice(0, 3).join(" · ") : "fine, nothing much";
}

function renderChain(s) {
  const b = s.brain, p = s.person;
  $("chainFeel").textContent = feelWords(s);
  const lastFire = b.fires[b.fires.length - 1];
  const cause = b.thinking ? b.thinking : b.intention ? { short: b.intention.reason, fired: b.intention.fired } : null;
  const byJev = !cause || (cause.fired && cause.fired.length);
  $("chainFireK").textContent = byJev ? "② Jev fires" : "② No Jev needed";
  $("chainFire").textContent = cause ? cause.short : "listening…";
  if (lastFire && lastFire.at !== lastFireAt) { lastFireAt = lastFire.at; flash(".link.jev"); }
  const claude = document.querySelector(".link.claude");
  claude.classList.toggle("thinking", Boolean(b.thinking));
  $("chainDecide").textContent = b.thinking ? `thinking… ${((Date.now() - b.thinking.since) / 1000).toFixed(0)} s` : b.intention ? b.intention.decision : "—";
  if (b.intention && b.intention.clock + b.intention.decision !== lastThoughtClock) {
    const first = lastThoughtClock === null;
    lastThoughtClock = b.intention.clock + b.intention.decision;
    // Only a thought that just happened pops up over her head.
    if (!first || Date.now() - (b.intention.wall || 0) < 8000) { thoughtShownAt = Date.now(); flash(".link.claude"); }
  }
  $("chainDo").textContent = doingText(s);
}
function doingText(s) {
  const p = s.person;
  if (p.location === "away") return `${p.activity || "out"} · ${p.placeShort}`;
  if (p.location === "travelling") return p.activity || "on the bus";
  if (!p.awake) return p.activity || "asleep";
  return p.activity || (p.onFloor ? "on the floor" : "standing still");
}
function flash(sel) { const el = document.querySelector(sel); el.classList.add("flash"); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove("flash"), 1600); }

function renderLeft(s) {
  const p = s.person;
  $("needs").innerHTML = NEEDS.map(([k, ic, label, f]) => {
    const v = Math.max(0, Math.min(1, f(p.needs)));
    const cls = v > 0.8 ? "bad" : v > 0.55 ? "warn" : "";
    const col = v > 0.8 ? "#ff5a4a" : v > 0.55 ? "#ffb020" : v > 0.35 ? "#c8d86a" : "#3fd08a";
    return `<div class="need ${cls}"><span class="ic">${ic}</span><span class="w">${esc(p.words[k])}<small>${label}</small></span><div class="bar"><i style="width:${(v * 100).toFixed(0)}%;background:${col}"></i></div></div>`;
  }).join("") + (p.pain > 0.1 ? `<div class="need bad"><span class="ic">🩹</span><span class="w">${p.pain > 0.6 ? "sharp pain" : "aching"}<small>Pain</small></span><div class="bar"><i style="width:${p.pain * 100}%;background:#ff5a4a"></i></div></div>` : "");
  const se = s.senses;
  const line = (ic, xs, none) => `<div class="sense"><span class="ic">${ic}</span><span class="t ${xs && xs.length ? "" : "none"}">${xs && xs.length ? xs.map(x => ALARM_WORDS.test(x) ? `<b>${esc(x)}</b>` : esc(x)).join(", ") : none}</span></div>`;
  $("senses").innerHTML = se.asleep
    ? line("💤", ["asleep: only loud sounds or smoke reach her"], "") + line("👂", se.hear, "silence") + (se.smell?.length ? line("👃", se.smell, "") : "")
    : line("📍", [p.where], "") + line("👀", se.see, "nothing special") + line("👂", se.hear, "quiet") + line("👃", se.smell, "nothing") + (se.feel?.length ? line("✋", se.feel, "") : "");
  const msgs = s.phone.recent.slice(-3);
  $("phone").innerHTML = msgs.length ? msgs.map(m => `<div class="msg ${m.dir}${m.dir === "in" && !m.read ? " unread" : ""}"><small>${m.dir === "in" ? `${esc(m.who)} · ${ago(p.t - m.t)}${m.read ? "" : " · unread"}` : `to ${esc(m.who)} · ${ago(p.t - m.t)}`}</small>${esc(m.text)}</div>`).join("") : `<div class="none">No messages yet today.</div>`;
}
function ago(sec) { const m = Math.round(sec / 60); return m < 1 ? "just now" : m < 60 ? `${m} min ago` : `${Math.floor(m / 60)} h ${m % 60} min ago`; }

function renderBrain(s) {
  const b = s.brain, L = b.last;
  if (L && L.at !== lastTickAt) { lastTickAt = L.at; const el = $("beat"); el.classList.add("on"); setTimeout(() => el.classList.remove("on"), 250); }
  $("jevMs").textContent = L ? `tick ${b.stats.ticks} · ${L.ms} ms` : "waiting";
  if (L) {
    $("pressing").textContent = PRESSING[L.pressing] || L.pressing;
    $("pressing").style.color = PRESS_COLOR[L.pressing] || "#fff";
    const probs = Object.entries(L.pressingProbs).sort((a, b) => b[1] - a[1]).slice(0, 4);
    $("pressingProbs").innerHTML = probs.map(([k, v], i) => `<li class="${i === 0 ? "top" : ""}"><span>${PRESSING[k] || k}</span><div class="bar"><i style="width:${(v * 100).toFixed(0)}%"></i></div><span class="pct">${(v * 100).toFixed(0)}%</span></li>`).join("");
    const lvl = Math.round(L.urgency);
    [...$("urgency").children].forEach((el, i) => { el.className = i <= lvl ? `on l${lvl + 1}` : ""; });
    $("urgency").title = `urgency ${L.urgency.toFixed(2)} of 3`;
    $("mood").textContent = MOODS[Math.max(0, Math.min(4, Math.round(L.mood)))];
  }
  $("feelings").innerHTML = b.feelings.map(f => {
    const scale = f.threshold * 1.45;
    const fired = Date.now() - f.fired < 2500;
    return `<div class="fl ${fired ? "fired" : ""} ${f.resting && !fired ? "resting" : ""}" title="Jev says ${(f.p * 100).toFixed(0)}% this tick · charge ${f.a.toFixed(2)} of ${f.threshold}"><span>${esc(f.label)}</span><div class="track"><i style="width:${Math.min(100, f.a / scale * 100).toFixed(1)}%"></i><b style="left:${(f.threshold / scale * 100).toFixed(1)}%"></b></div></div>`;
  }).join("");
  // System Two.
  $("spark").classList.toggle("on", Boolean(b.thinking) || b.calling);
  $("mindMs").textContent = b.stats.mindCalls ? `${b.stats.mindCalls} calls · ~${(b.stats.mindMs / 1000).toFixed(1)} s each` : "not called yet";
  const i = b.intention;
  if (b.thinking) $("why").innerHTML = `<b>Thinking now.</b> Called because ${esc(b.thinking.reason)}. The world runs at real time until she decides.`;
  else if (b.calling) $("why").innerHTML = `<b>On the phone.</b> The world runs at real time while the other person answers.`;
  else if (i) $("why").innerHTML = `Last called at ${esc(i.clock)} because: ${esc(i.reason)}. ${esc(i.model || "")} took ${(i.ms / 1000).toFixed(1)} s.`;
  $("thought").textContent = i ? `“${i.thought}”` : "";
  const plan = s.plan;
  $("plan").innerHTML = plan ? plan.steps.map(st => `<li class="${st.status}"><span>${{ done: "✓", doing: "▶", failed: "✗", dropped: "–", pending: "·" }[st.status] || "·"}</span><span>${esc(st.text)}${st.status === "failed" && st.note ? `<small>${esc(st.note)}</small>` : ""}</span></li>`).join("") : `<li><span>·</span><span>No plan yet</span></li>`;
  $("note").innerHTML = i?.note ? `Note left for System One: <b>${esc(i.note)}</b>` : "";
  // The last few thoughts before this one, newest first, so a late viewer can catch up at a glance.
  const earlier = b.thoughts.slice(0, -1).reverse().slice(0, 5);
  $("history").innerHTML = earlier.length ? earlier.map(t => `<li title="${esc(`${t.reason} → ${t.decision} · ${t.model ?? ""} ${(t.ms / 1000).toFixed(1)} s`)}"><span>${esc(t.clock)}</span>${esc(t.text)}</li>`).join("") : `<li class="none">Her first thought is the one above.</li>`;
}

function renderBottom(s) {
  const c = s.clock;
  $("day").textContent = `${c.weekday} · day ${c.day} · ${c.daylightWords}${c.weather !== "clear" ? ` · ${c.weather}` : ""}`;
  $("time").textContent = c.hm;
  const sp = $("speedNote");
  sp.className = "speed" + (s.run.speed === 1 && s.run.quietSpeed !== 1 ? " slow" : s.run.why ? " move" : "");
  sp.textContent = s.run.paused ? "paused" : !s.run.running ? "stopped: nobody watching" : `${s.run.speed === 1 ? "real time" : `${s.run.speed}× real time`}${s.run.why ? ` · ${s.run.why.replace(/^real time /, "")}` : ""}`;
  const items = [...s.story].reverse().slice(0, 7);
  $("story").innerHTML = items.map(e => { const key = e.wall + e.text; const fresh = !storyKeys.has(key); storyKeys.add(key); return `<li class="${e.kind}${fresh ? " fresh" : ""}"><span>${e.clock}</span>${esc(e.text)}</li>`; }).join("");
  const tl = s.brain.timeline;
  const recent = tl.slice(-60), pad = Math.max(0, 60 - recent.length);
  $("timeline").innerHTML = "<i style='flex-grow:0'></i>".repeat(0) + Array.from({ length: pad }, () => `<i style="background:transparent"></i>`).join("") + recent.map(t => `<i class="${t.fired.length ? "fire" : ""} ${t.awake ? "" : "sleep"}" style="background:${PRESS_COLOR[t.pressing] || "#333"};opacity:${0.35 + Math.min(1, t.urgency / 3) * 0.65}" title="${t.clock} · ${PRESSING[t.pressing] || t.pressing} · urgency ${t.urgency.toFixed(1)}${t.fired.length ? ` · fired ${t.fired.join(", ")}` : ""}"></i>`).join("");
  const m = s.brain.memory;
  $("memFill").style.width = `${Math.min(100, m.count / m.cap * 100)}%`;
  $("memFill").parentElement.classList.toggle("compacting", Boolean(m.compacting));
  $("memNote").textContent = m.compacting ? `full: Jev is sorting ${m.compacting.n} memories${m.compacting.kept != null ? `, kept ${m.compacting.kept}; Claude is writing the summary` : ""}…` : `${m.count} of ${m.cap} before it overflows${m.last ? ` · last compacted ${m.last.clock}: kept ${m.last.kept} of ${m.last.from}` : ""}`;
}

// ---------- labels over the 3D scene ----------
const labelEls = new Map();
function label(id, cls, html, x, y, hgt) {
  let el = labelEls.get(id);
  if (!el) { el = document.createElement("div"); el.className = cls; $("labels").appendChild(el); labelEls.set(id, el); }
  if (el._html !== html) { el.innerHTML = html; el._html = html; }
  el.className = cls;
  const pt = scene.toScreen(x, y, hgt);
  el.style.left = `${pt.x}px`; el.style.top = `${pt.y}px`;
  el.hidden = pt.behind;
  el._seen = true;
}
function placeLabels() {
  const s = snap, p = s.person, h = s.home, b = s.brain;
  for (const el of labelEls.values()) el._seen = false;
  const visible = p.location === "home" || p.location === "outside";
  const pos = scene.pos || { x: p.x, y: p.y };
  if (visible) {
    const lyingH = !p.awake || p.onFloor ? 1.0 : 2.05;
    label("mina", "tag mina", `<span class="name">Mina</span><span class="act">${esc(doingText(s))}</span>`, pos.x, pos.y, lyingH);
    const showThought = b.intention && Date.now() - thoughtShownAt < 9000;
    if (b.thinking) label("bubble", "bubble thinking", `💭 thinking…`, pos.x, pos.y, lyingH + 1.9);
    else if (showThought) label("bubble", "bubble", esc(b.intention.thought), pos.x, pos.y, lyingH + 1.9);
  } else {
    // A live window onto where she is: the place, her, and what she is doing there.
    const since = p.leftHomeAt ? ago(p.t - p.leftHomeAt).replace(" ago", "") : "";
    const head = p.location === "travelling"
      ? `<b>🚌 ${esc(p.activity || "On the bus")}</b><span>${p.travel ? `${Math.max(1, Math.round(p.travel.left / 60))} min to go` : ""}</span>`
      : `<b>Mina is ${esc(p.placeShort)}</b><span>${esc(p.placeLabel)} · out for ${since}</span>`;
    const html = `<div class="awayhead">${head}</div><div class="win"></div><div class="awayfoot"><span class="name">Mina</span> ${esc(p.activity || "")}</div>`;
    const anchor = scene.toScreen(OUTSIDE.bus_stop[0] - 1.5, OUTSIDE.bus_stop[1] - 0.6, 0);
    // Sit above the bus stop, but never under the side panels or the bottom strip.
    const W = 380, Hh = 214;
    const bottomTop = document.querySelector(".bottom").getBoundingClientRect().top;
    const el = awayWindow(html, 0, 0, W, Hh);
    const total = el.offsetHeight;
    const left = Math.max(310, Math.min(window.innerWidth - 370 - W, anchor.x - W / 2));
    const top = Math.max(150, Math.min(bottomTop - total - 10, anchor.y - total - 10));
    el.style.left = `${left}px`; el.style.top = `${top}px`;
    const r = el.querySelector(".win").getBoundingClientRect();
    scene.awayRect = { x: r.left, y: r.top, w: r.width, h: r.height };
    const bx = left + W / 2, by = top - 6;
    if (b.thinking) bubbleAt("💭 thinking…", bx, by, true);
    else if (b.intention && Date.now() - thoughtShownAt < 9000) bubbleAt(esc(b.intention.thought), bx, by, false);
  }
  if (visible) { scene.awayRect = null; const w = $("awayView"); if (w) w.hidden = true; }
  // Consequences and running things, where they are.
  const here = visible && p.location === "home" ? p.room : null;
  const at = (spot) => SPOTS[spot].at;
  const st = h.stove;
  if (st.on) {
    const bad = st.state === "burning" || st.state === "burnt";
    const attended = p.kind === "cook";
    if (bad || !attended) label("stove", `alert ${bad ? "pulse" : "info"}`, bad ? `🔥 ${st.dish} ${st.state}` : `stove on${st.dish ? `: ${st.dish}` : ""}`, 12.6, 9.6, 1.4);
  }
  if (h.smokeAlarm) label("smokealarm", "alert pulse", "🚨 smoke alarm", 6.5, 4.6, 1.9);
  if (h.alarmClock.ringing) label("alarmclock", "alert pulse", "⏰ alarm ringing", 1.85, 9.5, 1.3);
  if (h.kitchen_tap && p.kind !== "wash_dishes") label("ktap", "alert info", "🚰 tap running", 10.4, 9.6, 1.4);
  if (h.basin_tap && p.kind !== "freshen_up") label("btap", "alert info", "🚰 tap running", 7.65, 7.0, 1.4);
  if (h.bath.tap && p.kind !== "bath") label("bath", `alert ${h.bath.level > 1 ? "pulse" : "info"}`, h.bath.level > 1 ? "🛁 overflowing!" : "🛁 bath filling", 6.5, 9.45, 1.3);
  if (h.shower && p.kind !== "shower") label("shower", "alert info", "🚿 shower left on", 7.4, 9.5, 2.3);
  if (h.tv && p.kind !== "watch_tv") label("tv", "alert info", "📺 TV on", 0.3, 1.15, 1.5);
  for (const [room, w] of Object.entries(h.water)) if (w > 0.05) { const r = ROOMS[room]; label(`water-${room}`, "alert pulse", "💧 water on the floor", (r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2 - 0.8, 0.6); }
  if (h.door.open && !(p.walking && (p.location === "outside" || here === "hall"))) label("door", "alert info", "🚪 front door open", 6.5, -0.2, 2.2);
  if (!h.power) label("power", "alert pulse", "⚡ power cut", 7, 5, 3.2);
  if (h.visitor) label("visitor", "alert info", `🔔 ${h.visitor.who.split(",")[0]}`, 6.9, -1.1, 2.3);
  if (h.helpComing) label("help", "alert info", "🚑 help on the way", 3, -5.8, 1.2);
  if (h.doormat && !h.visitor) label("mat", "alert info", "✉️ something on the doormat", 6.3, -0.6, 0.8);
  for (const el of labelEls.values()) if (!el._seen) el.hidden = true;
}

// The "where she is" window and a bubble placed in screen pixels.
function awayWindow(html, left, top, w, h) {
  let el = $("awayView");
  if (!el) { el = document.createElement("div"); el.id = "awayView"; el.className = "awaywin"; $("labels").appendChild(el); }
  if (el._html !== html) { el.innerHTML = html; el._html = html; }
  el.hidden = false;
  Object.assign(el.style, { left: `${left}px`, top: `${top}px`, width: `${w}px` });
  el.querySelector(".win").style.height = `${h}px`;
  return el;
}
function bubbleAt(html, x, y, thinking) {
  let el = labelEls.get("bubble");
  if (!el) { el = document.createElement("div"); $("labels").appendChild(el); labelEls.set("bubble", el); }
  if (el._html !== html) { el.innerHTML = html; el._html = html; }
  el.className = thinking ? "bubble thinking" : "bubble";
  el.style.left = `${x}px`; el.style.top = `${y}px`; el.hidden = false; el._seen = true;
}

// ---------- controls ----------
const post = (url, body) => fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then(r => r.json()).catch(() => null);
$("pauseBtn").onclick = () => post("/api/control", { action: snap?.run.paused ? "resume" : "pause" });
$("speedSel").onchange = e => post("/api/control", { action: "speed", speed: Number(e.target.value) });
$("modelSel").onchange = e => { post("/api/control", { action: "model", model: e.target.value }); e.target.blur(); };
for (const btn of document.querySelectorAll("[data-poke]")) btn.onclick = () => post("/api/poke", { kind: btn.dataset.poke });
$("textForm").onsubmit = e => { e.preventDefault(); const t = $("textIn").value.trim(); if (t) post("/api/poke", { kind: "text", text: t }); $("textIn").value = ""; };
window.addEventListener("keydown", e => {
  if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
  if (e.code === "Space") { e.preventDefault(); $("pauseBtn").click(); }
  if (e.key === "i" || e.key === "I") toggleInspect();
});
let tab = "state";
async function toggleInspect(force) {
  const d = $("inspector"); d.hidden = force === false ? true : !d.hidden;
  if (!d.hidden) showTab(tab);
}
async function showTab(t) {
  tab = t;
  for (const b of document.querySelectorAll(".dhead nav button")) b.classList.toggle("on", b.dataset.tab === t);
  const data = await fetch("/api/inspect").then(r => r.json());
  const body = { state: data.state, answers: data.last, questions: data.questions, memory: data.memory, thoughts: data.thoughts }[t];
  $("inspectBody").textContent = JSON.stringify(body, null, 2);
}
$("inspectBtn").onclick = () => toggleInspect();
$("closeInspect").onclick = () => toggleInspect(false);
for (const b of document.querySelectorAll(".dhead nav button")) b.onclick = () => showTab(b.dataset.tab);
window.terrarium = { scene, get snap() { return snap; } };
