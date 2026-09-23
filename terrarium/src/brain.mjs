// Mina's brain. System One (Jev) ticks like a heartbeat over her body and senses; each feeling charges a
// leaky integrator; when one crosses its line, System Two (Claude) is called to decide what she does.
// Memory accumulates; when it overflows (or she goes to bed) Jev picks what is worth keeping and Claude
// folds it into the story so far. Nothing here chooses what she wants.
import { askJev, JEV_PRICE_PER_TOKEN, JEV_MODEL } from "./jev.mjs";
import { FEELINGS, tickQuestions, relevanceQuestions } from "./questions.mjs";
import { decide, summarise, LIFE } from "./mind.mjs";
import { mindInfo } from "./llm.mjs";
import { replyTo, takeCall, maybeText, PEOPLE } from "./contacts.mjs";
import { needWords, ago, describeStep, CONTACTS } from "./world.mjs";

const LEAK = 0.85, BASELINE = 0.15;
const MEMORY_CAP = 48;          // episodes before the memory overflows and is compacted
const COOLDOWN_SIM = 45 * 60;   // a feeling System Two has just weighed rests for 45 sim minutes, unless something new comes up
const SETTLE_SIM = 12 * 60;     // after a decision, feelings can charge but only an urgent one fires for 12 sim minutes
const SETTLE_TICKS = 5;         // ...and for at least 5 ticks, so it never re-decides seconds after deciding
const H = 3600;

const PRESSING_WORDS = {
  nothing: "nothing pressing", hunger: "hunger", tiredness: "tiredness", hygiene: "feeling grubby", toilet: "needing the toilet",
  boredom: "boredom", loneliness: "missing people", message: "an unanswered message", door: "someone at the door",
  obligation: "something she must do", danger: "something wrong in the house", pain: "pain", someone_here: "someone waiting for her here",
};

export class Brain {
  constructor(world, log) {
    this.world = world;
    this.log = log;
    this.feelings = FEELINGS.map(f => ({ id: f.id, label: f.label, threshold: f.threshold, a: 0, p: 0, restUntil: 0, fired: 0 }));
    this.last = null;             // last Jev answers, shaped for the page
    this.lastState = null; this.lastQuestions = tickQuestions();
    this.jevBusy = false; this.thinking = null; this.compacting = null; this.callsInFlight = 0;
    this.pendingReason = null;    // a reason to think that arrived while already thinking
    this.retryAt = 0;
    this.memory = { story: "", episodes: [], compactions: 0 };
    this.intention = null;        // what System Two last decided
    this.thoughts = [];           // recent thoughts, newest last
    this.timeline = [];           // recent ticks for the strip on the page
    this.fires = [];
    this.stats = { ticks: 0, jevTokens: 0, jevCost: 0, jevMs: [], mindCalls: 0, mindCost: 0, mindMs: [], peopleCalls: 0, peopleCost: 0, errors: 0 };
    this.threads = { leyla: [], sam: [], dana: [], unknown: [] };
    this.deliveries = [];         // replies from people, delivered at a sim time
    this.nextInitiative = { leyla: world.t + (2 + Math.random() * 6) * H, sam: world.t + (4 + Math.random() * 8) * H };
    this.lastError = null;

    world.on(e => this.onWorldEvent(e));
  }

  get busyThinking() { return Boolean(this.thinking) || this.callsInFlight > 0; }

  onWorldEvent(e) {
    const clock = e.clock;
    if (!e.internal) {
      this.log.line(clock, e.kind, e.text);
      if (e.noticed || e.kind === "fail" || (e.kind === "act" && e.story)) this.remember(e.kind === "act" ? `Mina ${e.text}` : e.text);
    }
    switch (e.kind) {
      case "plan_done": this.requestThought("her plan is finished; what next?", "plan finished"); break;
      case "step_failed": this.requestThought(`a step could not be done: ${e.text}`, "a step failed"); break;
      case "woke": this.requestThought(`she just woke up (${e.text})`, "woke up"); break;
      case "sleep_started": if (this.memory.episodes.length >= 8) this.compact("going to sleep"); break;
      case "message_sent": this.onMessageSent(e.to, e.text); break;
      case "call_request": this.onCall(e.who, e.minutes, e.step); break;
      case "event": if (e.message) this.threads[this.threadOf(e.message.from)]?.push({ clock, from: e.message.from, text: e.message.text }); break;
    }
  }

  threadOf(name) { const n = String(name).toLowerCase(); return Object.keys(this.threads).find(k => n.includes(k)) || "unknown"; }

  remember(text) {
    this.memory.episodes.push({ t: this.world.t, clock: this.world.clock.hm, text });
    if (this.memory.episodes.length >= MEMORY_CAP && !this.compacting) this.compact("memory full");
  }

  // ---------- the state System One reads (and System Two too) ----------
  buildState() {
    const w = this.world, p = w.person, c = w.clock, t = w.t;
    const weekday = c.day % 7 < 5;
    const intention = this.intention ? {
      decided: `${this.intention.clock} (${ago(t - this.intention.t)})`,
      decision: this.intention.decision,
      steps: p.plan ? p.plan.steps.map((s, i) => `${s.status === "doing" ? "NOW" : s.status}: ${describeStep(s)}${s.note && s.status === "failed" ? ` (${s.note})` : ""}`) : [],
      note_for_system_one: this.intention.note,
    } : "nothing decided yet";
    return {
      now: { clock: `${c.weekday} ${c.hm}`, part_of_day: partOfDayWords(c.hours), daylight: w.daylight.words, weather: w.d.weather, day_type: weekday ? "workday" : "weekend" },
      me: {
        name: "Mina",
        where: w.whereWords(),
        state: !p.awake ? "asleep" : p.onFloor ? "on the floor, hurt" : "awake",
        doing: p.activity?.label ? `${p.activity.label} (for ${ago(t - p.activity.since).replace(" ago", "")})` : "nothing in particular",
      },
      body: { ...needWords(p.needs), pain: p.pain > 0.1 ? (p.pain > 0.6 ? "sharp pain" : "aching") : "none" },
      senses: w.senses(),
      phone: w.phoneView(),
      time_since: {
        woke_up: p.awake ? ago(t - (p.wokeAt ?? t)) : `asleep since ${ago(t - p.sleptAt)}`,
        last_meal: ago(t - p.lastMealAt),
        last_wash: ago(t - p.lastShowerAt),
        talked_to_someone: ago(t - p.lastTalkAt),
        last_text_message: p.lastContactAt ? ago(t - p.lastContactAt) : "none today",
        at_home_since: p.location === "home" ? ago(t - p.cameHomeAt) : null,
        out_since: p.location !== "home" && p.leftHomeAt ? ago(t - p.leftHomeAt) : null,
      },
      // Asleep, she knows nothing about the house beyond what wakes her.
      home: p.awake ? w.situation() : "asleep: unaware of the house",
      my_life: LIFE,
      intention,
      memory: { story_so_far: this.memory.story || "(nothing yet)", recent: this.memory.episodes.slice(-14).map(e => `${e.clock} ${e.text}`) },
    };
  }

  // ---------- heartbeat ----------
  async tick() {
    if (this.jevBusy || this.thinking) return;
    this.jevBusy = true;
    const w = this.world;
    const state = this.buildState();
    this.lastState = state;
    const simAt = w.t;
    try {
      const r = await askJev(state, this.lastQuestions);
      this.onTick(r, state, simAt);
    } catch (err) {
      this.stats.errors++;
      this.lastError = { at: Date.now(), text: String(err.message || err) };
      this.log.line(w.clock.hm, "error", `Jev: ${this.lastError.text}`);
    } finally { this.jevBusy = false; }
  }

  onTick(r, state, simAt) {
    const w = this.world, p = w.person, a = r.answers;
    this.lastAnswers = a;
    const s = this.stats;
    s.ticks++; s.jevTokens += r.usage?.input_tokens || 0; s.jevCost += (r.usage?.input_tokens || 0) * JEV_PRICE_PER_TOKEN;
    s.jevMs.push(r.ms); if (s.jevMs.length > 50) s.jevMs.shift();
    // Charge the feelings.
    const fired = [];
    for (const f of this.feelings) {
      f.p = a[f.id]?.noul ?? 0;
      f.a = Math.max(0, f.a * LEAK + f.p - BASELINE);
      if (f.a >= f.threshold && w.t >= f.restUntil && !this.settling()) fired.push(f);
    }
    const pressing = a.pressing?.choice ?? "nothing";
    const urgency = a.urgency?.score ?? 0;
    // A resting feeling may still fire if the situation is new: a different most-pressing thing, or clearly more urgent.
    for (const f of this.feelings) {
      if (fired.includes(f) || this.settling() || f.a < f.threshold || w.t >= f.restUntil) continue;
      if ((f.ackPressing && pressing !== f.ackPressing && pressing !== "nothing") || urgency >= (f.ackUrgency ?? 9) + 0.7) fired.push(f);
    }
    this.last = {
      at: Date.now(), clock: w.clock.hm, ms: r.ms, tokens: r.usage?.input_tokens, model: r.model,
      pressing, pressingProbs: a.pressing?.probabilities ?? {}, pressingConf: a.pressing?.confidence ?? 0,
      urgency, mood: a.mood?.score ?? 2, attention: a.attention?.choice ?? "her_task", attentionProbs: a.attention?.probabilities ?? {},
      reflex: a.reflex?.choice ?? "none", reflexP: a.reflex?.probabilities?.[a.reflex?.choice] ?? 0,
    };
    this.timeline.push({ at: Date.now(), clock: w.clock.hm, pressing, urgency, fired: fired.map(f => f.id), awake: p.awake });
    if (this.timeline.length > 240) this.timeline.shift();
    this.log.tick({ wall: new Date().toISOString(), clock: w.clock.hm, ms: r.ms, tokens: r.usage?.input_tokens, answers: a, charge: Object.fromEntries(this.feelings.map(f => [f.id, +f.a.toFixed(2)])), state: s.ticks % 20 === 1 || fired.length ? state : undefined });

    this.reflex(a.reflex);
    // A tick that read the world before her latest decision cannot judge that decision.
    if (this.intention && simAt < this.intention.t) return;
    this.freshTicks = (this.freshTicks ?? 0) + 1;

    // Urgent skips the integrators, but only for something new since her last decision: a different most-pressing
    // thing, or clearly more urgent than what she last weighed, and never within 3 ticks of deciding.
    const ack = this.lastAck;
    const fresh = (this.freshTicks ?? 99) >= 5 && (!ack || (this.stats.ticks - ack.tick >= 3 && (pressing !== ack.pressing || urgency > ack.urgency + 0.4 || w.t - ack.t > 10 * 60)));
    const urgent = fresh && urgency >= 2.4 && ((a.wrong?.noul ?? 0) > 0.6 || ["danger", "pain", "door", "someone_here"].includes(pressing));
    if (!p.awake) {
      // Asleep, System One still feels. Something badly wrong jolts her awake; the rest waits for morning.
      const wrong = this.feelings.find(f => f.id === "wrong");
      if (wrong.a >= wrong.threshold || (urgent && pressing === "danger")) {
        this.fire([wrong], pressing, urgency, "jolted awake");
        w.wake("jolted awake: something feels wrong");
      }
      return;
    }
    if (fired.length || urgent) {
      const list = fired.length ? fired : [this.feelings.reduce((x, y) => (y.p > x.p ? y : x))];
      this.fire(list, pressing, urgency, urgent && !fired.length ? "urgent" : "fired");
      const words = list.map(f => f.label.toLowerCase()).join(" + ");
      this.requestThought(`System One fired: ${words}. Most pressing: ${PRESSING_WORDS[pressing]} (urgency ${urgency.toFixed(1)} of 3)`, `${list.map(f => f.label).join(" + ")} → ${PRESSING_WORDS[pressing]}`, list.map(f => f.id));
    }
  }

  settling() { const i = this.intention; return Boolean(i) && (this.world.t - i.t < SETTLE_SIM || this.stats.ticks - i.tick < SETTLE_TICKS); }

  fire(list, pressing, urgency, how) {
    const w = this.world;
    this.lastAck = { pressing, urgency, t: w.t, tick: this.stats.ticks };
    for (const f of list) { f.fired = Date.now(); f.restUntil = w.t + COOLDOWN_SIM; f.ackPressing = pressing; f.ackUrgency = urgency; }
    this.fires.push({ at: Date.now(), clock: w.clock.hm, ids: list.map(f => f.id), pressing, how });
    if (this.fires.length > 40) this.fires.shift();
    this.log.line(w.clock.hm, "fire", `${how}: ${list.map(f => `${f.label} (${f.a.toFixed(2)}/${f.threshold})`).join(", ")} · most pressing ${PRESSING_WORDS[pressing]} · urgency ${urgency.toFixed(2)}`);
  }

  // A tiny automatic action. Jev suggests it; code checks the body can really do it right here.
  reflex(ans) {
    if (!ans || ans.choice === "none") return;
    const pr = ans.probabilities?.[ans.choice] ?? 0;
    if (pr < 0.7) return;
    const w = this.world, p = w.person, d = w.d, room = p.location === "home" ? p.room : null;
    if (!p.awake || p.onFloor || p.walk) return;
    let did = null;
    if (ans.choice === "switch_off_alarm_clock" && room === "bedroom" && d.alarmClock.ringing) { d.alarmClock.ringing = false; did = "switches off the alarm clock"; }
    if (ans.choice === "turn_off_stove" && room === "kitchen" && d.stove.on && p.activity?.kind !== "cook") {
      if (d.stove.dish && ["ready", "cooking"].includes(d.stove.state)) d.food = d.stove.dish;
      d.stove.on = false; d.stove.dish = null; d.stove.state = "off"; d.stove.cooked = 0; did = "turns the stove off";
    }
    if (ans.choice === "turn_off_tap") {
      if (room === "kitchen" && d.kitchen_tap && p.activity?.kind !== "wash_dishes") { d.kitchen_tap = false; did = "turns off the kitchen tap"; }
      if (room === "bathroom" && d.basin_tap && p.activity?.kind !== "freshen_up") { d.basin_tap = false; did = "turns off the basin tap"; }
      if (room === "bathroom" && d.bath.tap && p.activity?.kind !== "bath") { d.bath.tap = false; did = "turns off the bath tap"; }
      if (room === "bathroom" && d.shower && p.activity?.kind !== "shower") { d.shower = false; did = "turns off the shower"; }
    }
    if (did) {
      this.lastReflex = { at: Date.now(), clock: w.clock.hm, text: did };
      w.emit("reflex", `without thinking, Mina ${did}`, { story: true });
      this.remember(`Mina ${did} without thinking`);
    }
  }

  // ---------- System Two ----------
  requestThought(reason, short, fired = []) {
    if (this.thinking) { this.pendingReason = { reason, short, fired }; return; }
    this.think(reason, short, fired);
  }

  async think(reason, short, fired) {
    const w = this.world;
    if (!w.person.awake && !/woke/.test(short)) return;
    if (Date.now() < this.retryAt) { setTimeout(() => this.requestThought(reason, short, fired), this.retryAt - Date.now()); return; }
    const state = this.buildState();
    this.thinking = { since: Date.now(), clock: w.clock.hm, reason, short, fired };
    this.log.line(w.clock.hm, "think", `System Two called: ${reason}`);
    try {
      const r = await decide({ state, reason, recentThoughts: this.thoughts.slice(-4).map(t => `${t.clock} ${t.text}`) });
      const s = this.stats;
      s.mindCalls++; const cost = r.cost; s.mindCost += cost;
      s.mindMs.push(r.ms); if (s.mindMs.length > 30) s.mindMs.shift();
      const o = r.out;
      // Whatever she just weighed counts as acknowledged, whether a fire, a failed step or a finished plan called her.
      this.lastAck = { pressing: this.last?.pressing ?? "nothing", urgency: this.last?.urgency ?? 0, t: w.t, tick: this.stats.ticks };
      this.freshTicks = 0;
      this.intention = { model: mindInfo(r.model).label ?? r.model, t: w.t, wall: Date.now(), tick: this.stats.ticks, fired, clock: w.clock.hm, decision: o.decision, thought: o.thought, note: o.note_for_system_one, reason: short, ms: r.ms };
      this.thoughts.push({ clock: w.clock.hm, text: o.thought, decision: o.decision, reason: short, ms: r.ms, model: mindInfo(r.model).label ?? r.model });
      if (this.thoughts.length > 30) this.thoughts.shift();
      this.log.line(w.clock.hm, "thought", `“${o.thought}” · ${mindInfo(r.model).label ?? r.model} · ${r.ms} ms · $${cost.toFixed(4)}`);
      this.log.line(w.clock.hm, "plan", `${o.decision} → ${o.finish_current_step ? "(finish current step first) · " : ""}${o.steps.map(describeStep).join(" · ")} | note: ${o.note_for_system_one}`);
      this.log.mind({ wall: new Date().toISOString(), clock: w.clock.hm, reason, ms: r.ms, usage: r.usage, model: r.model, prompt: r.prompt, out: o });
      this.remember(`Mina decided: ${o.decision}`);
      if (o.remember) this.remember(`To remember: ${o.remember}`);
      w.emit("decided", o.decision, { story: true, thought: o.thought });
      // Settle the feelings that led here.
      for (const f of this.feelings) f.a *= 0.25;
      w.setPlan({ decision: o.decision, steps: o.steps.map(s => ({ ...s })) }, { finishCurrent: Boolean(o.finish_current_step) });
    } catch (err) {
      this.stats.errors++;
      this.lastError = { at: Date.now(), text: String(err.message || err) };
      this.log.line(w.clock.hm, "error", `System Two: ${this.lastError.text}`);
      this.retryAt = Date.now() + 15000;
    } finally {
      this.thinking = null;
      // A plan that ended or failed while she was deciding belongs to the old plan: nothing to do.
      const next = this.pendingReason; this.pendingReason = null;
      if (next && !["plan finished", "a step failed"].includes(next.short)) this.requestThought(next.reason, next.short, next.fired);
    }
  }

  // ---------- memory compaction ----------
  async compact(why) {
    if (this.compacting || this.memory.episodes.length < 4) return;
    const w = this.world;
    const items = this.memory.episodes.slice(0, -4); // keep the very latest as they are
    this.compacting = { since: Date.now(), why, n: items.length };
    this.log.line(w.clock.hm, "memory", `compacting ${items.length} memories (${why})`);
    try {
      const state = { memory: { story_so_far: this.memory.story || "(nothing yet)", recent: items.map(e => `${e.clock} ${e.text}`) }, now: `${w.clock.weekday} ${w.clock.hm}`, my_life: LIFE };
      const r = await askJev(state, relevanceQuestions(items.length));
      this.stats.jevTokens += r.usage?.input_tokens || 0; this.stats.jevCost += (r.usage?.input_tokens || 0) * JEV_PRICE_PER_TOKEN;
      const kept = items.filter((_, i) => (r.answers[`keep_${i}`]?.noul ?? 1) >= 0.5);
      this.compacting.kept = kept.length;
      const s = await summarise({ storySoFar: this.memory.story, kept: kept.map(e => `${e.clock} ${e.text}`), now: `${w.clock.weekday} ${w.clock.hm}` });
      const cost = s.cost; this.stats.mindCost += cost; this.stats.mindCalls++;
      this.memory.story = s.story;
      this.memory.episodes = this.memory.episodes.slice(items.length);
      this.memory.compactions++;
      this.memory.lastCompaction = { clock: w.clock.hm, why, from: items.length, kept: kept.length };
      this.log.line(w.clock.hm, "memory", `Jev kept ${kept.length} of ${items.length}; story so far: ${s.story}`);
      this.log.mind({ wall: new Date().toISOString(), clock: w.clock.hm, kind: "compaction", why, kept: kept.map(e => e.text), dropped: items.filter(e => !kept.includes(e)).map(e => e.text), story: s.story, usage: s.usage });
    } catch (err) {
      this.stats.errors++;
      this.log.line(w.clock.hm, "error", `compaction: ${err.message || err}`);
    } finally { this.compacting = null; }
  }

  // ---------- other people ----------
  async onMessageSent(id, text) {
    if (!PEOPLE[id]) return;
    const w = this.world;
    this.threads[id].push({ clock: w.clock.hm, from: "Mina", text });
    try {
      const r = await replyTo(id, { now: `${w.clock.weekday} ${w.clock.hm}`, history: this.threads[id], text });
      this.countPeople(r.cost);
      if (r.out?.reply) this.deliveries.push({ at: w.t + Math.max(1, r.out.delay_minutes) * 60, id, text: r.out.reply });
      if (r.out?.visit_in_minutes != null) this.scheduleVisit(id, r.out.visit_in_minutes);
      else this.log.line(w.clock.hm, "world", `${CONTACTS[id].name} did not reply`);
    } catch (err) { this.log.line(w.clock.hm, "error", `reply from ${id}: ${err.message}`); }
  }

  async onCall(id, minutes, step) {
    const w = this.world;
    this.callsInFlight++;
    try {
      const r = await takeCall(id, { now: `${w.clock.weekday} ${w.clock.hm}`, history: this.threads[id], reason: this.intention ? `${this.intention.thought} (${this.intention.decision})` : null, minutes });
      this.countPeople(r.cost);
      const out = r.out ?? { answered: false, gist: "" };
      if (out.answered) this.threads[id].push({ clock: w.clock.hm, from: "phone call", text: out.gist });
      if (out.answered && out.visit_in_minutes != null) this.scheduleVisit(id, out.visit_in_minutes);
      w.callResult(id, out, minutes);
    } catch (err) {
      this.log.line(w.clock.hm, "error", `call to ${id}: ${err.message}`);
      w.callResult(id, { answered: false, gist: "" }, minutes);
    } finally { this.callsInFlight--; }
  }

  scheduleVisit(id, minutes) {
    const w = this.world;
    this.visits = this.visits ?? [];
    this.visits.push({ at: w.t + Math.max(5, minutes) * 60, id });
    this.log.line(w.clock.hm, "world", `${CONTACTS[id].name} plans to come round in about ${minutes} min`);
  }

  countPeople(cost) { this.stats.peopleCalls++; this.stats.peopleCost += cost || 0; }

  // Called every server step while the world runs.
  update() {
    const w = this.world;
    for (const dl of this.deliveries.filter(d => w.t >= d.at)) w.receiveMessage(dl.id, dl.text);
    this.deliveries = this.deliveries.filter(d => w.t < d.at);
    for (const v of (this.visits ?? []).filter(v => w.t >= v.at)) {
      if (w.friendArrives(v.id, CONTACTS[v.id].name)) this.visits = this.visits.filter(x => x !== v);
      else v.at = w.t + 5 * 60; // someone else is at the door; they arrive a little later
    }
    for (const id of Object.keys(this.nextInitiative)) {
      if (w.t < this.nextInitiative[id]) continue;
      this.nextInitiative[id] = w.t + (5 + Math.random() * 9) * H;
      const h = w.clock.hours;
      if (h < 8 || h > 22) continue;
      maybeText(id, { now: `${w.clock.weekday} ${w.clock.hm}`, history: this.threads[id], story: this.memory.story })
        .then(r => { this.countPeople(r.cost); if (r.out?.text) w.receiveMessage(id, r.out.text); })
        .catch(err => this.log.line(w.clock.hm, "error", `${id} initiative: ${err.message}`));
    }
  }

  // ---------- for the page ----------
  view() {
    const s = this.stats, avg = xs => xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null;
    return {
      jevModel: JEV_MODEL, mind: mindInfo(),
      feelings: this.feelings.map(f => ({ id: f.id, label: f.label, a: +f.a.toFixed(3), p: +f.p.toFixed(3), threshold: f.threshold, fired: f.fired, resting: this.world.t < f.restUntil })),
      last: this.last,
      thinking: this.thinking && { since: this.thinking.since, reason: this.thinking.reason, short: this.thinking.short, fired: this.thinking.fired },
      calling: this.callsInFlight > 0,
      intention: this.intention,
      thoughts: this.thoughts.slice(-6),
      fires: this.fires.slice(-12),
      reflex: this.lastReflex,
      memory: { story: this.memory.story, count: this.memory.episodes.length, cap: MEMORY_CAP, recent: this.memory.episodes.slice(-8), compacting: this.compacting, last: this.memory.lastCompaction, compactions: this.memory.compactions },
      timeline: this.timeline.slice(-120),
      stats: { ticks: s.ticks, jevTokens: s.jevTokens, jevCost: s.jevCost, jevMs: avg(s.jevMs), mindCalls: s.mindCalls, mindCost: s.mindCost, mindMs: avg(s.mindMs), peopleCalls: s.peopleCalls, peopleCost: s.peopleCost, errors: s.errors },
      error: this.lastError && Date.now() - this.lastError.at < 20000 ? this.lastError.text : null,
    };
  }
}

function partOfDayWords(h) {
  if (h < 5) return "the middle of the night";
  if (h < 7) return "early morning";
  if (h < 12) return "morning";
  if (h < 14) return "midday";
  if (h < 17.5) return "afternoon";
  if (h < 21) return "evening";
  if (h < 23) return "late evening";
  return "night";
}
