// One person's brain. System One (Jev) ticks over the senses and charges leaky integrators per concern.
// A fire wakes System Two (Claude), which returns what the person wants to do; the body executes it.
// Reflexes may act without thinking. Memory fills and is compacted in sleep.
import { REFLEXES } from "./types.ts";
import type { Answer, ChoiceA, Concern, Directive, JevResult, MemoryItem, MindInput, MindReply, Question, ScoreA, StoryItem, Thought } from "./types.ts";
import { World, MIN, fmtDur } from "./world.ts";
import type { Person, PersonId } from "./world.ts";
import { Jev, JEV_PRICE_PER_MTOK } from "./jev.ts";
import { Mind } from "./system2.ts";
import { baseConcerns, needQuestion, reflexQuestion, relevanceQuestion, urgencyQuestion } from "./questions.ts";

const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

export class Agent {
  world: World; me: Person; jev: Jev; mind: Mind; story: StoryItem[];
  concerns: Concern[] = baseConcerns();
  directive: Directive | null = null;
  memory: MemoryItem[] = [];
  memorySummary = "";
  thoughts: Thought[] = [];
  answers: Record<string, Answer> = {};
  last: JevResult | null = null;
  temperament = { gain: 1.0, cap: 3, fireAt: 2.0, reflexConf: 0.6, refractoryMs: 25_000, awakeMs: 1500, quietMs: 4000, asleepMs: 8000, mindCooldownMs: 25_000, memoryTokenBudget: 4500, memoryItemBudget: 110 };
  stats = { ticks: 0, latencies: [] as number[], tokenLog: [] as { t: number; tokens: number }[], tokensTotal: 0, costTotal: 0, mode: "awake" as "awake" | "quiet" | "asleep", lastTickAt: 0, lastTickMs: 0, mindCalls: 0, sleeps: 0, reflexes: 0, plans: 0, errors: 0 };
  thinking = false; sleeping = false; lastThoughtAt = 0; startedAt = Date.now();
  hasViewers: () => boolean = () => true;
  onNote: ((t: Thought) => void) | null = null;
  onStory: ((s: StoryItem) => void) | null = null;
  alwaysTick = process.env.ALWAYS_TICK === "1";
  idleReason: "" | "paused" | "no viewers" = "";
  private lastViewerAt = Date.now();
  private actedAt = 0;
  private lastPerceivedId = 0;
  private lastPlanFinishedAt = 0;
  private lastSleepDay = -1;
  private memoryId = 1;

  constructor(world: World, me: Person, jev: Jev, mind: Mind, story: StoryItem[]) {
    this.world = world; this.me = me; this.jev = jev; this.mind = mind; this.story = story;
  }

  start() { void this.loop(); }

  private async loop() {
    while (true) {
      if (this.world.paused) { this.idleReason = "paused"; await wait(500); continue; }
      if (!this.alwaysTick) {
        if (this.hasViewers()) this.lastViewerAt = Date.now();
        else if (Date.now() - this.lastViewerAt > 60_000) { this.idleReason = "no viewers"; await wait(1000); continue; }
      }
      this.idleReason = "";
      const started = Date.now();
      try { await this.tick(); }
      catch (err) { this.stats.errors++; this.note("error", `tick failed: ${(err as Error).message.slice(0, 160)}`); await wait(1500); }
      const T = this.temperament;
      const interval = this.stats.mode === "awake" ? T.awakeMs : this.stats.mode === "quiet" ? T.quietMs : T.asleepMs;
      await wait(Math.max(150, interval - (Date.now() - started)));
    }
  }

  // ---- one tick -------------------------------------------------------------
  private async tick() {
    if (this.sleeping) return;
    const now = Date.now(); const me = this.me;
    this.absorbPerception();
    const dt = this.stats.lastTickAt ? clamp((now - this.stats.lastTickAt) / 1000, 0.2, 8) : 1;
    const state = this.buildState();
    const questions = this.buildQuestions();
    const res = await this.jev.ask(state, questions, () => this.mockAnswers(questions));
    this.last = res; this.answers = res.answers;
    const s = this.stats; s.ticks++; s.lastTickMs = res.latencyMs;
    s.latencies.push(res.latencyMs); if (s.latencies.length > 90) s.latencies.shift();
    this.countTokens(res.usage.input_tokens, now); s.lastTickAt = now;
    for (const c of this.concerns) {
      const a = res.answers[c.id]; const p = a && a.type === "noul" ? a.noul : 0; c.p = p;
      c.a = clamp(c.a + this.temperament.gain * (p - 0.5) * dt, 0, this.temperament.cap);
      if (c.firedAt && now - c.firedAt > 180_000) c.fireCount = 0;
    }
    const maxCharge = Math.max(0, ...this.concerns.map(c => c.a));
    s.mode = !me.awake && !me.collapsed ? "asleep" : (me.place === "outside" && maxCharge < 0.6) ? "quiet" : (maxCharge > 0.4 || me.plan === null) ? "awake" : "quiet";
    this.decide(now);
    await this.maybeCompact(now);
  }

  private absorbPerception() {
    for (const e of this.me.perceived) {
      if (e.id <= this.lastPerceivedId) continue;
      this.lastPerceivedId = e.id;
      this.memory.push({ id: this.memoryId++, t: e.t, text: e.text });
    }
    if (this.memory.length > 400) this.memory.splice(0, this.memory.length - 400);
  }
  private countTokens(tokens: number, now: number) {
    const s = this.stats; s.tokenLog.push({ t: now, tokens });
    while (s.tokenLog.length && now - s.tokenLog[0].t > 60_000) s.tokenLog.shift();
    s.tokensTotal += tokens; s.costTotal = (s.tokensTotal * JEV_PRICE_PER_MTOK) / 1e6;
  }

  private decide(now: number) {
    const T = this.temperament; const me = this.me;
    const need = this.answers.need as ChoiceA | undefined;
    const urg = this.answers.urgency as ScoreA | undefined;
    const reflex = this.answers.reflex as ChoiceA | undefined;
    // 1. reflex: act where I stand, no thinking
    if (reflex && reflex.choice !== "none" && reflex.confidence >= T.reflexConf && (REFLEXES as readonly string[]).includes(reflex.choice)) {
      const text = this.world.reflex(me, reflex.choice);
      if (text) { this.stats.reflexes++; this.actedAt = now; this.note("act", `reflex ${reflex.choice.replaceAll("_", " ")} · ${Math.round(reflex.confidence * 100)}% → ${text}`); this.tell("act", `${text}, without thinking (${Math.round(reflex.confidence * 100)}% sure).`); }
    }
    // 2. what fired
    const fired = this.concerns.filter(c => c.a >= T.fireAt && now >= c.refractoryUntil);
    const urgent = !!urg && urg.score >= 2.4 && urg.confidence >= 0.5;
    const idle = me.awake && !me.plan && !me.collapsed && now - this.lastPlanFinishedAt > 6000 && !this.thinking;
    const newMessage = me.inbox.some(m => m.at > (this.directive?.simSince ?? -Infinity) && this.world.simMs - m.at < 5 * MIN) && me.awake;
    if (!fired.length && !urgent && !idle && !newMessage) return;
    // asleep: only danger, a loud disturbance or a message can wake the mind; hunger and boredom wait for morning
    if (!me.awake && !me.collapsed) {
      const disturbed = fired.some(c => c.id === "unusual") || urgent || (newMessage && this.world.hour() >= 6);
      if (!disturbed) { for (const c of fired) { c.fireCount++; c.firedAt = now; c.a = 0; c.refractoryUntil = now + T.refractoryMs; } return; }
    }
    const reasons: string[] = fired.map(c => c.label.toLowerCase());
    if (need && need.choice !== "none" && need.confidence >= 0.4) reasons.push(`most pressing: ${need.choice} (${Math.round(need.confidence * 100)}%)`);
    if (urgent && urg) reasons.push(`urgency ${urg.score.toFixed(1)}`);
    if (idle) reasons.push("nothing planned; deciding what to do next");
    if (newMessage) reasons.push("a new message on my phone");
    for (const c of fired) { c.fireCount++; c.firedAt = now; c.a = 0; c.refractoryUntil = now + T.refractoryMs; }
    void this.escalate(reasons.join("; "), now, urgent || newMessage || fired.some(c => c.id === "unusual"));
  }

  // ---- System Two -----------------------------------------------------------------
  private async escalate(reason: string, now: number, important: boolean) {
    if (this.thinking || this.sleeping) return;
    if (!important && now - this.lastThoughtAt < this.temperament.mindCooldownMs) return;
    if (this.me.collapsed && this.me.helpCalledAt) return; // already called for help; wait for it
    this.thinking = true; this.lastThoughtAt = now; this.world.thinkingCount++;
    try {
      this.note("note", `asking System Two because: ${reason}`);
      const reply = await this.mind.think(this.mindInput(reason, false));
      this.stats.mindCalls++;
      this.applyReply(reply, false);
    } catch (err) {
      this.stats.errors++; this.note("error", `System Two failed: ${(err as Error).message.slice(0, 160)}`);
    } finally { this.thinking = false; this.lastThoughtAt = Date.now(); this.world.thinkingCount = Math.max(0, this.world.thinkingCount - 1); }
  }
  private mindInput(reason: string, compact: boolean, items?: string[]): MindInput {
    const me = this.me;
    return {
      person: me.name, life: me.life, reason,
      senses: this.world.senses(me),
      recent: this.memory.slice(-30).map(m => this.fmtMem(m)),
      memory_summary: this.memorySummary || "nothing summarized yet",
      directive: this.directive?.text ?? null,
      current_plan: me.plan ? { label: me.plan.label, steps: me.plan.steps, at_step: me.plan.idx + 1 } : null,
      compact, ...(items ? { compact_items: items } : {}),
    };
  }
  private applyReply(reply: MindReply, compacting: boolean) {
    const me = this.me; const now = Date.now();
    this.note("thought", `${reply.thought}${reply.mock ? " [mock mind]" : ""} · ${Math.round(reply.latencyMs)} ms`);
    if (!compacting) {
      this.tell("mind", `${me.name} thinks: “${reply.thought}”`);
      if (reply.plan.length) {
        this.stats.plans++; this.actedAt = now;
        this.world.setPlan(me, reply.plan, reply.plan_label || reply.plan[0].step, reply.model);
        this.tell("act", `${me.name} decides to ${reply.plan_label || describe(reply.plan)}.`);
        this.note("act", `plan: ${reply.plan_label} → ${reply.plan.map(s => `${s.step}${s.arg ? "(" + s.arg + ")" : ""}`).join(", ")}`);
      }
      if (reply.directive.trim()) { this.directive = { text: reply.directive.trim().slice(0, 200), since: now, simSince: this.world.simMs, from: reply.model }; const st = this.concerns.find(c => c.id === "stale"); if (st) st.a = 0; }
    }
    if (compacting && reply.memory_summary.trim()) this.memorySummary = reply.memory_summary.trim().slice(0, 600);
    function describe(plan: MindReply["plan"]) { return plan.map(s => s.step.replaceAll("_", " ") + (s.arg ? " " + s.arg : "")).join(", then "); }
  }

  // ---- memory -----------------------------------------------------------------------
  memoryTokens() { return Math.ceil(this.memory.reduce((n, m) => n + m.text.length + 8, 0) / 4); }
  private async maybeCompact(now: number) {
    if (this.sleeping || this.thinking) return;
    const day = this.world.dayIndex();
    const asleepNight = !this.me.awake && this.world.hour() >= 2 && this.world.hour() < 4 && day !== this.lastSleepDay && this.memory.length > 25;
    if (this.memoryTokens() > this.temperament.memoryTokenBudget || this.memory.length > this.temperament.memoryItemBudget || asleepNight) await this.compact(asleepNight ? "night" : "memory full");
  }
  private async compact(reason: string) {
    this.sleeping = true; this.stats.sleeps++; this.lastSleepDay = this.world.dayIndex();
    const t0 = Date.now(); const keepRaw = this.memory.slice(-20); const old = this.memory.slice(0, -20);
    this.note("sleep", `compacting memory (${reason}: ${this.memory.length} items)`);
    try {
      const survivors: MemoryItem[] = [];
      for (let i = 0; i < old.length; i += 40) {
        const batch = old.slice(i, i + 40); const qs: Record<string, Question> = {};
        batch.forEach((m, j) => { qs[`e${j}`] = relevanceQuestion(this.fmtMem(m)); });
        const state = { current_summary: this.memorySummary || "none yet", directive: this.directive?.text ?? "none", time: { clock: this.world.clock(), weekday: this.world.weekday() } };
        const res = await this.jev.ask(state, qs, () => { const out: Record<string, Answer> = {}; batch.forEach((m, j) => { out[`e${j}`] = { type: "noul", noul: /talk|message|fell|alarm|smoke|fire|decided|ate|left|home|floor/.test(m.text) ? 0.8 : 0.15 }; }); return out; });
        this.countTokens(res.usage.input_tokens, Date.now());
        batch.forEach((m, j) => { const a = res.answers[`e${j}`]; const p = a && a.type === "noul" ? a.noul : 1; if (p >= 0.35) survivors.push(m); });
      }
      const reply = await this.mind.think(this.mindInput(`compacting memory (${reason})`, true, survivors.map(m => this.fmtMem(m))));
      this.stats.mindCalls++;
      if (reply.memory_summary.trim()) this.memorySummary = reply.memory_summary.trim().slice(0, 600);
      this.memory = keepRaw;
      this.note("sleep", `kept ${survivors.length} of ${old.length} old memories in the summary, forgot ${old.length - survivors.length}`);
      this.tell("sleep", `${this.me.name}'s memory was ${reason === "night" ? "tidied in sleep" : "full"}: kept ${survivors.length} of ${old.length} old memories, forgot ${old.length - survivors.length}.`);
    } catch (err) { this.stats.errors++; this.note("error", `compaction failed: ${(err as Error).message.slice(0, 160)}`); this.memory = this.memory.slice(-60); }
    finally { await wait(Math.max(0, 3000 - (Date.now() - t0))); this.sleeping = false; }
  }
  fmtMem(m: MemoryItem) { return `${this.world.clock(m.t)} ${m.text}`; }

  // ---- state and questions --------------------------------------------------------------
  buildState() {
    const senses = this.world.senses(this.me);
    return { ...senses, my_life: this.me.life, directive: this.directive ? { text: this.directive.text, age: `${fmtDur(this.world.simMs - this.directive.simSince)} on the house clock` } : "none", recent: this.memory.slice(-8).map(m => this.fmtMem(m)) };
  }
  buildQuestions(): Record<string, Question> {
    const q: Record<string, Question> = {};
    for (const c of this.concerns) { if (c.id === "stale" && !this.me.plan) continue; q[c.id] = c.question; }
    q.need = needQuestion(); q.urgency = urgencyQuestion(); q.reflex = reflexQuestion();
    return q;
  }

  // ---- mock answers when there is no TypeSafe key --------------------------------------------
  private mockAnswers(questions: Record<string, Question>): Record<string, Answer> {
    const w = this.world; const me = this.me; const d = w.dev; const b = me.body; const o = w.other(me); const now = w.simMs;
    const hour = w.hour(); const weekday = !/Saturday|Sunday/.test(w.weekday());
    const danger = d.fire ? 1 : d.smoke ? 0.9 : (me.place === "kitchen" && d.stove && !(me.plan && me.plan.steps[me.plan.idx]?.step === "cook")) ? 0.7 : d.flood ? 0.6 : (o && o.collapsed && o.place === me.place) ? 0.95 : 0;
    const obligation = me.id === "mina" && weekday && hour >= 8 && hour < 8.7 && me.place !== "outside" ? 0.9 : 0;
    const hunger = hour > 7 && hour < 23 ? b.hunger : b.hunger * 0.3;
    const sleepy = (hour >= 22.5 || hour < 6) ? Math.max(1 - b.energy, 0.6) : (1 - b.energy) * 0.5;
    const silent = (now - me.lastHeardOther) / (3600_000 * 6);
    const otherP = o ? Math.min(0.95, Math.max(b.connection * 0.7, o.collapsed ? 0.9 : 0, silent * 0.6 + (hour > 19 && o.place === "outside" ? 0.3 : 0))) : Math.min(0.9, b.connection * 0.8);
    const msg = me.inbox.some(m => now - m.at < 5 * MIN) ? 0.9 : 0;
    const needs: Record<string, number> = { hunger, sleep: me.awake ? sleepy : 0, hygiene: b.hygiene * 0.8, boredom: b.boredom * 0.7, connection: otherP, obligation, safety: danger, message: msg };
    const [needId, needP] = Object.entries(needs).sort((x, y) => y[1] - x[1])[0];
    const pressing = needP > 0.55;
    const attention = me.collapsed ? 0.95 : !me.awake ? Math.max(danger, msg * 0.3) : Math.max(pressing ? needP : 0.1, me.plan ? 0.1 : 0.6);
    const staleP = me.plan ? (danger > 0.6 || (needP > 0.85 && !["eat", "cook"].includes(me.plan.steps[me.plan.idx]?.step)) ? 0.7 : 0.1) : 0;
    const urgency = d.fire || (o && o.collapsed) || me.collapsed ? 3 : d.smoke ? 2.4 : danger > 0.5 ? 2 : pressing ? 1 : 0;
    let reflex = "none";
    if (me.place === "kitchen" && d.stove && (d.smoke || d.fire || !(me.plan && me.plan.steps[me.plan.idx]?.step === "cook"))) reflex = "turn_off_stove";
    else if (me.place === "bathroom" && d.tap && !(me.plan && me.plan.steps[me.plan.idx]?.step === "shower")) reflex = "turn_off_tap";
    else if (o && o.place === me.place && !o.awake && (d.smoke || d.fire)) reflex = "wake_other";
    const noise = () => (Math.random() - 0.5) * 0.06;
    const out: Record<string, Answer> = {};
    for (const [id, q] of Object.entries(questions)) {
      if (q.type === "noul") {
        const p = id === "attention" ? attention : id === "unusual" ? Math.max(danger, o && o.collapsed ? 0.9 : 0, o && silent > 1.5 ? 0.6 : 0.05) : id === "other" ? otherP : id === "stale" ? staleP : 0.1;
        out[id] = { type: "noul", noul: clamp(p + noise(), 0.01, 0.99) };
      } else if (q.type === "choice") {
        const opts = Object.keys(q.criteria); const pick = id === "need" ? (pressing ? needId : "none") : reflex;
        const main = pick === "none" ? 0.85 : 0.6 + Math.min(0.35, needP * 0.35);
        const probs: Record<string, number> = {}; for (const oo of opts) probs[oo] = oo === pick ? main : (1 - main) / (opts.length - 1);
        out[id] = { type: "choice", choice: pick, probabilities: probs, confidence: main };
      } else {
        const lv = q.criteria.length; const idx = clamp(Math.round(urgency), 0, lv - 1); const probs: Record<string, number> = {}; const legend: Record<string, string> = {};
        for (let i = 0; i < lv; i++) { probs[String(i)] = i === idx ? 0.8 : 0.2 / (lv - 1); legend[String(i)] = String(q.criteria[i]); }
        out[id] = { type: "score", score: clamp(urgency, 0, lv - 1), legend, probabilities: probs, confidence: 0.8 };
      }
    }
    return out;
  }

  // ---- notes, story, snapshot -------------------------------------------------------------------
  note(kind: Thought["kind"], text: string) {
    const th: Thought = { t: Date.now(), simClock: this.world.clock(), kind, text };
    this.thoughts.push(th);
    if (this.thoughts.length > 80) this.thoughts.shift();
    console.log(`[${this.world.clock()}] ${this.me.name} ${kind}: ${text}`);
    this.onNote?.(th);
  }
  tell(kind: StoryItem["kind"], text: string) {
    const item: StoryItem = { t: Date.now(), simClock: this.world.clock(), who: this.me.id, kind, text };
    this.story.push(item);
    if (this.story.length > 120) this.story.shift();
    this.onStory?.(item);
  }
  planFinished() { this.lastPlanFinishedAt = Date.now(); }
  phaseChar(): string {
    if (this.idleReason === "paused") return "p";
    if (this.idleReason) return "i";
    if (this.sleeping) return "s";
    if (this.thinking) return "t";
    if (Date.now() - this.actedAt < 2500) return "a";
    if (!this.me.awake) return "z";
    const maxCharge = Math.max(0, ...this.concerns.map(c => c.a)); const urg = this.answers.urgency as ScoreA | undefined;
    if (maxCharge >= 1 || (urg && urg.score >= 1.5)) return "w";
    return "c";
  }
  snapshot() {
    const s = this.stats; const now = Date.now();
    const sorted = [...s.latencies].sort((a, b) => a - b); const pct = (p: number) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] : 0);
    const windowMs = Math.min(60_000, Math.max(1000, now - this.startedAt)); const tokensPerSec = s.tokenLog.reduce((n, x) => n + x.tokens, 0) / (windowMs / 1000);
    const need = this.answers.need as ChoiceA | undefined; const urg = this.answers.urgency as ScoreA | undefined; const reflex = this.answers.reflex as ChoiceA | undefined;
    return {
      id: this.me.id, name: this.me.name,
      concerns: this.concerns.map(c => ({ id: c.id, label: c.label, a: c.a, p: c.p, cap: this.temperament.cap, fireAt: this.temperament.fireAt, firedAgo: c.firedAt ? now - c.firedAt : null, asked: !(c.id === "stale" && !this.me.plan) })),
      need: need ? { choice: need.choice, confidence: need.confidence, probabilities: need.probabilities } : null,
      urgency: urg ? { score: urg.score, confidence: urg.confidence, legend: urg.legend } : null,
      reflex: reflex ? { choice: reflex.choice, confidence: reflex.confidence } : null,
      directive: this.directive ? { ...this.directive, ageMs: now - this.directive.since, simAge: fmtDur(this.world.simMs - this.directive.simSince) } : null,
      thoughts: this.thoughts.slice(-8).reverse(),
      memory: { count: this.memory.length, tokens: this.memoryTokens(), budget: this.temperament.memoryTokenBudget, summary: this.memorySummary, recent: this.memory.slice(-8).map(m => this.fmtMem(m)) },
      stats: { ...s, latencies: s.latencies.slice(-60), p50: pct(0.5), p95: pct(0.95), tokensPerSec, dollarsPerHour: (tokensPerSec * 3600 * JEV_PRICE_PER_MTOK) / 1e6, intervalMs: s.mode === "awake" ? this.temperament.awakeMs : s.mode === "quiet" ? this.temperament.quietMs : this.temperament.asleepMs },
      flags: { thinking: this.thinking, sleeping: this.sleeping, idleReason: this.idleReason, actedAgo: now - this.actedAt, jevMock: this.jev.mock, mindMock: this.mind.mock, jevModel: this.last?.model ?? (this.jev.mock ? "mock" : this.jev.model), mindModel: this.mind.model, jevError: this.jev.lastError, mindError: this.mind.lastError },
      lastStateTokens: this.last ? this.last.usage.input_tokens : 0,
    };
  }
}
