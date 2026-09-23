// HTTP server: static page, a live stream of the world and the brain, controls and pokes.
// The world and the brain run here, not in the browser, so a hidden tab never changes what happens.
// They run only while a page is open (or ALWAYS_TICK=1) and not paused: a paused Terrarium makes no API calls.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { World, needWords, describeStep, CONTACTS } from "./world.mjs";
import { Brain } from "./brain.mjs";
import { createLog } from "./log.mjs";
import { PLACES, ROOMS } from "./layout.mjs";
import { setMindModel, mindInfo, availableModels } from "./llm.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const PORT = Number(process.env.PORT || 3000);
const TICK_MS = Number(process.env.TICK_MS || 1000);
const ALWAYS = process.env.ALWAYS_TICK === "1";
const SPEEDS = [1, 10, 30, 60, 120];

const log = createLog();
const world = new World({ startDay: 1, startHour: Number(process.env.START_HOUR || 6.5) });
const brain = new Brain(world, log);
const story = [];
world.on(e => {
  if (e.internal) return;
  if (e.story || e.noticed || e.kind === "reflex" || e.kind === "decided" || e.kind === "fail") {
    story.push({ clock: e.clock, kind: e.kind, text: storyText(e), wall: Date.now() });
    if (story.length > 60) story.shift();
  }
});
function storyText(e) {
  if (e.kind === "act") return `Mina ${e.text}.`;
  if (e.kind === "decided") return `Mina decides: ${e.text}.`;
  if (e.kind === "fail") return `Mina ${e.text}.`;
  if (e.kind === "reflex") return `${e.text.charAt(0).toUpperCase()}${e.text.slice(1)}.`;
  return /[.!?]$/.test(e.text) ? e.text : `${e.text}.`;
}

let paused = false;
let quietSpeed = Number(process.env.SIM_SPEED || 60);
let viewers = 0;
let lastTickAt = 0;
let lastStep = performance.now();
let lastSummary = 0;
let mode = { speed: quietSpeed, why: "" };
let runningSeconds = 0; // wall seconds the world has actually been running (not paused, someone watching)
const running = () => !paused && (viewers > 0 || ALWAYS);

// Time runs fast through quiet stretches and slows down whenever something is happening, so it can be seen,
// and to real time while she thinks, so a thought never costs her ten minutes of life.
function currentMode() {
  const p = world.person, d = world.d;
  if (brain.busyThinking) return { speed: 1, why: brain.thinking ? "real time while she thinks" : "real time while she is on the phone" };
  const visible = p.location === "home" || p.location === "outside";
  if (visible && p.walk) return { speed: Math.min(quietSpeed, 3), why: "slowed while she moves" };
  if (visible && p.awake && ((d.visitor && !d.visitor.answered) || d.smokeAlarm || d.alarmClock.ringing)) return { speed: Math.min(quietSpeed, 6), why: "slowed: something is happening" };
  if (p.location === "away" && world.work.pending.some(e => !e.handling)) return { speed: Math.min(quietSpeed, 6), why: "slowed: someone needs her at work" };
  return { speed: quietSpeed, why: "" };
}

setInterval(() => {
  const now = performance.now();
  const dtWall = Math.min(0.5, (now - lastStep) / 1000);
  lastStep = now;
  if (!running()) return;
  runningSeconds += dtWall;
  mode = currentMode();
  // Small sub-steps keep walking and wake-ups smooth at high speed.
  let dt = dtWall * mode.speed;
  while (dt > 0) { const s = Math.min(dt, 5); world.step(s); dt -= s; }
  brain.update();
  const interval = world.person.awake ? TICK_MS : TICK_MS * 3;
  if (now - lastTickAt >= interval && !brain.jevBusy && !brain.thinking) { lastTickAt = now; brain.tick(); }
  if (now - lastSummary > 30000) { lastSummary = now; summaryLine(); }
}, 100);

function summaryLine() {
  const p = world.person, d = world.d, s = brain.stats;
  const n = Object.entries(p.needs).map(([k, v]) => `${k} ${v.toFixed(2)}`).join(" ");
  log.line(world.clock.hm, "state", `${world.whereWords()} · ${p.awake ? "awake" : "asleep"} · ${p.activity?.label || "-"} · plan: ${p.plan ? `${p.plan.decision} (${Math.min(p.plan.idx + 1, p.plan.steps.length)}/${p.plan.steps.length})` : "none"} · ${n}`);
  log.line(world.clock.hm, "house", `on: ${world.devicesOn().join(", ") || "nothing"} · door ${d.door.open ? "open" : "shut"}${d.door.locked ? " locked" : ""} · smoke k${d.smoke.kitchen.toFixed(2)} · water b${d.water.bathroom.toFixed(2)} h${d.water.hall.toFixed(2)} · speed ${mode.speed}${mode.why ? ` (${mode.why})` : ""} · ticks ${s.ticks} · S2 ${s.mindCalls} · $${(s.jevCost + s.mindCost + s.peopleCost).toFixed(3)}`);
}

// ---------- what the page sees ----------
function snapshot() {
  const p = world.person, d = world.d, c = world.clock;
  const plan = p.plan ? { decision: p.plan.decision, idx: p.plan.idx, steps: p.plan.steps.map(s => ({ text: describeStep(s), do: s.do, status: s.status, note: s.note })) } : null;
  const s = brain.stats;
  return {
    clock: { weekday: c.weekday, hm: c.hm, day: c.day, hours: c.hours, daylight: world.daylight.level, daylightWords: world.daylight.words, weather: d.weather },
    run: { paused, running: running(), runningSeconds, mind: mindInfo(), models: availableModels(), viewers, quietSpeed, speed: running() ? mode.speed : 0, why: mode.why, speeds: SPEEDS, always: ALWAYS },
    person: {
      name: p.name, x: p.x, y: p.y, room: p.room, facing: p.facing, location: p.location,
      place: p.place, placeLabel: p.place ? PLACES[p.place].label : null, placeShort: p.place ? PLACES[p.place].short : null,
      travel: p.travel ? { to: p.travel.to, label: p.travel.to === "home" ? "home" : PLACES[p.travel.to].label, left: Math.max(0, p.travel.arrive - world.t) } : null,
      awake: p.awake, onFloor: p.onFloor, pain: p.pain, walking: Boolean(p.walk),
      activity: p.activity?.label || "", kind: p.activity?.kind || "idle", where: world.whereWords(),
      needs: p.needs, words: needWords(p.needs), leftHomeAt: p.leftHomeAt, t: world.t,
      attend: p.activity?.attend ?? null, work: world.work.pending.map(e => e.kind),
    },
    plan,
    home: {
      stove: d.stove, food: d.food, kitchen_tap: d.kitchen_tap, basin_tap: d.basin_tap, shower: d.shower, bath: d.bath, tv: d.tv,
      lights: d.lights, windows: d.windows, door: d.door, alarmClock: { ringing: d.alarmClock.ringing, at: d.alarmClock.at }, smokeAlarm: d.smokeAlarm,
      power: d.power, smoke: d.smoke, water: d.water, visitor: d.visitor ? { who: d.visitor.who, answered: d.visitor.answered } : null,
      doormat: d.doormat, parcel: d.parcelInHall || d.parcelOnStep, fridge: d.fridge, helpComing: Boolean(d.helpComing),
    },
    senses: world.senses(),
    phone: { unread: world.phoneView().unread, recent: [...d.phone.messages.slice(-4).map(m => ({ dir: "in", who: m.name, text: m.text, t: m.t, read: m.read })), ...(p.outbox ?? []).slice(-4).map(m => ({ dir: "out", who: m.name, text: m.text, t: m.t }))].sort((a, b) => a.t - b.t).slice(-5) },
    brain: brain.view(),
    story: story.slice(-14),
    cost: { jev: s.jevCost, mind: s.mindCost, people: s.peopleCost, total: s.jevCost + s.mindCost + s.peopleCost },
  };
}

// ---------- HTTP ----------
const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".mjs": "text/javascript", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png" };
const clients = new Set();
setInterval(() => {
  if (!clients.size) return;
  const data = `data: ${JSON.stringify(snapshot())}\n\n`;
  for (const res of clients) res.write(data);
}, 200);

function send(res, code, body, type = "application/json") {
  res.writeHead(code, { "content-type": type, "cache-control": "no-store" });
  res.end(typeof body === "string" ? body : JSON.stringify(body));
}
async function readBody(req) {
  let s = ""; for await (const ch of req) { s += ch; if (s.length > 10000) break; }
  try { return JSON.parse(s || "{}"); } catch { return {}; }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const p = url.pathname;
  if (p === "/api/stream") {
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive" });
    res.write(`data: ${JSON.stringify(snapshot())}\n\n`);
    clients.add(res); viewers = clients.size;
    log.line(world.clock.hm, "viewer", `a page connected (${viewers} watching)`);
    req.on("close", () => { clients.delete(res); viewers = clients.size; log.line(world.clock.hm, "viewer", `a page left (${viewers} watching)${viewers || ALWAYS ? "" : ": the world and the brain stop"}`); });
    return;
  }
  if (p === "/api/control" && req.method === "POST") {
    const b = await readBody(req);
    if (b.action === "pause") { paused = true; log.line(world.clock.hm, "control", "paused: no ticks, no thinking, no cost"); }
    if (b.action === "resume") { paused = false; log.line(world.clock.hm, "control", "resumed"); }
    if (b.action === "speed" && SPEEDS.includes(Number(b.speed))) { quietSpeed = Number(b.speed); log.line(world.clock.hm, "control", `quiet speed ${quietSpeed}x`); }
    if (b.action === "model") {
      if (!setMindModel(String(b.model))) return send(res, 400, { ok: false, error: "unknown model or missing key" });
      log.line(world.clock.hm, "control", `System Two model: ${mindInfo().label} (${mindInfo().id})`);
    }
    return send(res, 200, { ok: true, paused, quietSpeed });
  }
  if (p === "/api/poke" && req.method === "POST") {
    const b = await readBody(req);
    if (!running()) return send(res, 409, { ok: false, error: "The Terrarium is paused." });
    const said = world.poke(String(b.kind || ""), b.text);
    if (said) log.line(world.clock.hm, "poke", `viewer: ${said}${b.text ? ` “${String(b.text).slice(0, 200)}”` : ""}`);
    return send(res, said ? 200 : 400, { ok: Boolean(said), said });
  }
  if (p === "/api/inspect") {
    return send(res, 200, { state: brain.lastState, questions: brain.lastQuestions, last: { summary: brain.last, answers: brain.lastAnswers, charge: brain.feelings }, thoughts: brain.thoughts, memory: brain.memory, logFiles: log.files });
  }
  if (p === "/api/health") return send(res, 200, { ok: true });
  // Static files.
  let file = null;
  if (p === "/" || p === "/index.html") file = path.join(root, "public/index.html");
  else if (p.startsWith("/public/")) file = path.join(root, p);
  else if (p === "/shared/layout.mjs") file = path.join(root, "src/layout.mjs");
  else if (p === "/vendor/three.module.js") file = path.join(root, "node_modules/three/build/three.module.js");
  else if (p === "/vendor/three.core.js") file = path.join(root, "node_modules/three/build/three.core.js");
  if (!file || !file.startsWith(root)) return send(res, 404, "not found", "text/plain");
  fs.readFile(file, (err, buf) => {
    if (err) return send(res, 404, "not found", "text/plain");
    res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" });
    res.end(buf);
  });
});
server.listen(PORT, () => {
  log.line(world.clock.hm, "start", `Terrarium on :${PORT} · Jev ${process.env.TYPESAFE_MODEL || "jev-latest"} · System Two ${mindInfo().label} (${process.env.SYSTEM_TWO_EFFORT || "low"} effort) · quiet speed ${quietSpeed}x · tick ${TICK_MS} ms · ${ALWAYS ? "always running" : "runs only while a page is open"}`);
  log.line(world.clock.hm, "start", `log files: ${Object.values(log.files).join(", ")}`);
});
