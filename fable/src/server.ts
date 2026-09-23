// HTTP server: two people, two brains. Serves the page and Three.js, streams snapshots over SSE, takes pokes.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { World } from "./world.ts";
import type { PersonId } from "./world.ts";
import { Jev } from "./jev.ts";
import { Mind } from "./system2.ts";
import { Agent } from "./agent.ts";
import type { StoryItem } from "./types.ts";
import { Log } from "./log.ts";

try { (process as unknown as { loadEnvFile?: (p: string) => void }).loadEnvFile?.(".env"); } catch { /* no .env file */ }

const world = new World();
world.speed = Math.max(1, Number(process.env.SIM_SPEED ?? 60) || 60);
const jev = new Jev();
const mind = new Mind();
const story: StoryItem[] = [];
const log = new Log();
const agents: Record<string, Agent> = {};
for (const p of Object.values(world.people)) agents[p.id] = new Agent(world, p, jev, mind, story);
const ids = Object.keys(agents) as PersonId[];
const clients = new Set<http.ServerResponse>();
for (const a of Object.values(agents)) {
  a.hasViewers = () => clients.size > 0;
  a.onNote = (t) => log.write(t.simClock, a.me.name, t.kind, t.text);
  a.onStory = (s) => log.write(s.simClock, a.me.name, "story", s.text);
}
world.onEvent((e, who) => log.write(world.clock(e.t), who ?? e.source, "event", e.text));
setInterval(() => {
  const w = world;
  for (const p of Object.values(w.people)) {
    const b = p.body; const step = p.plan ? `${p.plan.idx + 1}/${p.plan.steps.length} ${p.plan.steps[p.plan.idx].step} ${p.plan.steps[p.plan.idx].arg}`.trim() : "-";
    log.write(w.clock(), p.name, "state", `${p.place}${p.moving ? "→" + p.moving.to : ""} ${p.awake ? "awake" : "asleep"}${p.collapsed ? " COLLAPSED" : ""} · ${p.activity} · plan: ${p.plan ? p.plan.label : "none"} (${step}) · hunger ${b.hunger.toFixed(2)} energy ${b.energy.toFixed(2)} hygiene ${b.hygiene.toFixed(2)} boredom ${b.boredom.toFixed(2)} connection ${b.connection.toFixed(2)}`);
  }
  const d = w.dev; const a = agents;
  log.write(w.clock(), "house", "state", `stove ${d.stove ? "ON" : "off"} tap ${d.tap ? "ON" : "off"} tv ${d.tv ? "ON" : "off"} door ${d.doorOpen ? "OPEN" : d.doorLocked ? "locked" : "unlocked"} power ${d.power ? "on" : "OUT"}${d.smoke ? " SMOKE" : ""}${d.fire ? " FIRE" : ""}${d.flood ? " FLOOD" : ""}${d.doorbellPending ? " doorbell" : ""} · lights ${Object.entries(w.rooms).filter(([, r]) => r.light).map(([k]) => k).join(",") || "none"} · viewers ${clients.size} · speed ${w.thinkingCount > 0 ? "1 (thinking)" : w.speed} · ticks ${ids.map(id => a[id].stats.ticks).join("/")} · decisions ${ids.map(id => a[id].stats.mindCalls).join("/")} · Jev $${ids.reduce((n, id) => n + a[id].stats.costTotal, 0).toFixed(3)}`);
}, 30_000);
world.onPlanEnd = (id) => agents[id].planFinished();
// World events that the viewer should read as story lines.
const ALARM = /smoke|fire|leak|open for|outage|power is back|doorbell|not locked/;
world.onEvent((e, who) => {
  const push = (kind: StoryItem["kind"], text: string) => { story.push({ t: Date.now(), simClock: world.clock(e.t), who: who ?? "world", kind, text }); if (story.length > 120) story.shift(); };
  if (e.source === "mina" || e.source === "otto") { if (!/decided:/.test(e.text)) push("life", e.text.charAt(0).toUpperCase() + e.text.slice(1) + "."); }
  else if (e.source === "world") push("world", e.text.charAt(0).toUpperCase() + e.text.slice(1) + ".");
  else if (e.source === "viewer") push("viewer", "You sent " + e.text + ".");
  else if (e.source === "sensor" && ALARM.test(e.text)) push("sense", e.text.charAt(0).toUpperCase() + e.text.slice(1) + ".");
});
for (const a of Object.values(agents)) a.start();

let lastWall = Date.now();
setInterval(() => { const now = Date.now(); world.advance(now - lastWall); lastWall = now; }, 250);
const phases: Record<string, string> = {}; for (const id of ids) phases[id] = "";
setInterval(() => { for (const id of ids) phases[id] = (phases[id] + agents[id].phaseChar()).slice(-600); }, 1000);

function snapshot() {
  const ag: Record<string, unknown> = {}; for (const id of ids) ag[id] = agents[id].snapshot();
  return { world: world.snapshot(), agents: ag, story: story.slice(-16), phases, viewers: clients.size, now: Date.now() };
}
setInterval(() => { if (!clients.size) return; const data = `data: ${JSON.stringify(snapshot())}\n\n`; for (const c of clients) c.write(data); }, 500);

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const pub = path.join(root, "public");
const threeDir = path.join(root, "node_modules", "three");
const types: Record<string, string> = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json; charset=utf-8" };

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (c: Buffer) => { body += c.toString(); if (body.length > 20_000) { reject(new Error("body too large")); req.destroy(); } });
    req.on("end", () => resolve(body)); req.on("error", reject);
  });
}
function json(res: http.ServerResponse, obj: unknown, status = 200) { res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }); res.end(JSON.stringify(obj)); }
function serveFile(res: http.ServerResponse, file: string, base: string, cache: string) {
  if (!file.startsWith(base) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return json(res, { error: "not found" }, 404);
  res.writeHead(200, { "Content-Type": types[path.extname(file)] ?? "application/octet-stream", "Cache-Control": cache });
  fs.createReadStream(file).pipe(res);
}
const personId = (s: string | null): PersonId => (s && agents[s] ? (s as PersonId) : ids[0]);

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  try {
    if (url.pathname === "/events") {
      res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", "X-Accel-Buffering": "no" });
      res.write(`data: ${JSON.stringify(snapshot())}\n\n`); clients.add(res); req.on("close", () => clients.delete(res)); return;
    }
    if (url.pathname === "/snapshot") return json(res, snapshot());
    if (url.pathname === "/inspect") {
      const a = agents[personId(url.searchParams.get("who"))];
      return json(res, { person: a.me.name, state: a.buildState(), questions: a.buildQuestions(), answers: a.answers, thoughts: a.thoughts, memory: a.memory.map(m => a.fmtMem(m)), memory_summary: a.memorySummary, directive: a.directive, plan: a.me.plan, story, stats: a.stats });
    }
    if (req.method === "POST" && url.pathname === "/poke") {
      const b = JSON.parse((await readBody(req)) || "{}") as { incident?: string; to?: string; text?: string };
      if (b.incident) world.incident(String(b.incident));
      if (b.text && b.text.trim()) world.viewerMessage(personId(b.to ?? null), b.text);
      return json(res, { ok: true });
    }
    if (req.method === "POST" && url.pathname === "/control") {
      const b = JSON.parse((await readBody(req)) || "{}") as { speed?: number; paused?: boolean };
      if (b.speed) world.speed = Math.max(1, Math.min(3600, Number(b.speed)));
      if (typeof b.paused === "boolean") world.paused = b.paused;
      return json(res, { speed: world.speed, paused: world.paused });
    }
    if (url.pathname === "/vendor/three.module.js") return serveFile(res, path.join(threeDir, "build", "three.module.js"), threeDir, "public, max-age=86400");
    if (url.pathname === "/vendor/three.core.js") return serveFile(res, path.join(threeDir, "build", "three.core.js"), threeDir, "public, max-age=86400");
    if (url.pathname.startsWith("/vendor/addons/")) return serveFile(res, path.resolve(threeDir, "examples", "jsm", "." + url.pathname.slice("/vendor/addons".length)), path.join(threeDir, "examples", "jsm"), "public, max-age=86400");
    const rel = url.pathname === "/" ? "/index.html" : url.pathname;
    return serveFile(res, path.resolve(pub, "." + rel), pub, "no-cache");
  } catch (err) { json(res, { error: (err as Error).message }, 500); }
});

const port = Number(process.env.PORT ?? 8080);
server.listen(port, "0.0.0.0", () => {
  console.log(`log file: ${log.file ?? "none"}`);
  console.log(`Terrarium on http://localhost:${port}  speed ${world.speed}x  Jev: ${jev.mock ? "MOCK (no TYPESAFE_API_KEY)" : jev.model}  System Two: ${mind.mock ? "MOCK (no ANTHROPIC_API_KEY)" : mind.model}  people: ${ids.join(", ")}  brains tick ${agents[ids[0]].alwaysTick ? "always" : "only while someone watches"}`);
});
