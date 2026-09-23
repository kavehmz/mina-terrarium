// The house as physics and senses only. Rooms, devices, the clock, bodies whose needs rise with time,
// random outside events, consequences. Nothing here decides what a person wants. That is the brain's job.
// Code executes the steps a brain chooses, the way a car executes "overtake".
import type { Place, RoomId, WorldEvent, EventSource } from "./types.ts";

export const MIN = 60_000;
export const HOUR = 3_600_000;
export const DAY = 86_400_000;
const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export const ROOMS: RoomId[] = ["bedroom", "bathroom", "kitchen", "living", "hall"];
export const ROOM_WORDS: Record<string, string> = { bedroom: "bedroom", bathroom: "bathroom", kitchen: "kitchen", living: "living room", hall: "hall", outside: "outside" };

export function fmtDur(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

export const STEP_KINDS = ["go_to", "cook", "eat", "shower", "sleep", "nap", "watch_tv", "read", "rest", "talk", "message", "check_on", "go_out", "come_home", "turn_off", "turn_on_light", "turn_off_light", "lock_door", "unlock_door", "answer_door", "call_emergency", "wait"] as const;
export type StepKind = (typeof STEP_KINDS)[number];
export interface Step { step: StepKind; arg: string; minutes: number }
export interface Plan { steps: Step[]; idx: number; label: string; startedAt: number; stepStartedAt: number; stepStarted: boolean; from: string }
export interface Body { hunger: number; energy: number; hygiene: number; boredom: number; connection: number }
export interface Message { from: string; text: string; at: number }
export type PersonId = "mina" | "otto";

export interface Person {
  id: PersonId;
  name: string;
  life: string;
  place: Place;
  moving: { to: Place; arriveAt: number } | null;
  awake: boolean;
  collapsed: boolean;
  collapsedAt: number | null;
  lastMoved: number;
  body: Body;
  lastAte: number;
  lastShower: number;
  lastTalk: number;
  lastHeardOther: number;
  lastSeenOther: { place: Place; at: number } | null;
  activity: string;
  plan: Plan | null;
  inbox: Message[];
  perceived: WorldEvent[];
  mealReady: boolean;
  outSince: number | null;
  outPurpose: string;
  helpCalledAt: number | null;
  interruptedUntil: number | null;
}

interface RoomState { light: boolean; lastMotion: number | null }
interface Pending { at: number; fn: () => void }

const NEEDS_PLACE: Partial<Record<StepKind, Place>> = { cook: "kitchen", eat: "kitchen", shower: "bathroom", sleep: "bedroom", watch_tv: "living", lock_door: "hall", unlock_door: "hall", answer_door: "hall", go_out: "hall" };

export class World {
  simMs = DAY + 6 * HOUR + 40 * MIN; // Tuesday 06:40 on the house clock
  speed = 60;
  paused = false;
  rooms: Record<RoomId, RoomState>;
  dev = {
    stove: false, stoveSince: null as number | null, stoveMeal: "",
    tap: false, tapSince: null as number | null,
    tv: false, tvSince: null as number | null,
    doorOpen: false, doorOpenSince: null as number | null, doorLocked: true, lastDoorUse: null as number | null,
    power: true, powerBackAt: null as number | null,
    smoke: false, smokeSince: null as number | null, fire: false, flood: false,
    doorbellPending: false, doorbellAt: null as number | null, visitor: "",
  };
  people: Record<string, Person> = {};
  thinkingCount = 0; // minds deliberating right now: while > 0 the house clock runs at real time
  events: WorldEvent[] = [];
  private nextEventId = 1;
  private lastMinute = -1;
  private pending: Pending[] = [];
  private listeners: ((e: WorldEvent, who: PersonId | null) => void)[] = [];
  private doorWarned = false;
  onPlanEnd: ((id: PersonId) => void) | null = null;

  constructor() {
    this.rooms = { bedroom: { light: false, lastMotion: this.simMs }, bathroom: { light: false, lastMotion: null }, kitchen: { light: false, lastMotion: null }, living: { light: false, lastMotion: null }, hall: { light: false, lastMotion: null } };
    const mk = (id: PersonId, name: string, life: string, body: Body): Person => ({
      id, name, life, place: "bedroom", moving: null, awake: false, collapsed: false, collapsedAt: null, lastMoved: this.simMs,
      body, lastAte: this.simMs - 11 * HOUR, lastShower: this.simMs - 22 * HOUR, lastTalk: this.simMs - 8 * HOUR, lastHeardOther: this.simMs - 8 * HOUR,
      lastSeenOther: { place: "bedroom", at: this.simMs }, activity: "sleeping", plan: null, inbox: [], perceived: [], mealReady: false, outSince: null, outPurpose: "", helpCalledAt: null, interruptedUntil: null,
    });
    const roster = (process.env.PEOPLE ?? "mina").split(",").map(x => x.trim()).filter(x => x === "mina" || x === "otto") as PersonId[];
    const together = roster.length > 1;
    if (roster.includes("mina")) this.people.mina = mk("mina", process.env.MINA_NAME ?? "Mina",
      together
        ? "Mina, 34. Works at the city library Monday to Friday, 09:00 to 17:00; the walk takes about 30 minutes. Lives with Otto, her partner. Likes long showers, tea, and crime novels. Gets grumpy when hungry."
        : "Mina, 34. Lives alone in this small flat. Works at the city library Monday to Friday, 09:00 to 17:00; the walk takes about 30 minutes. Her sister Leyla lives across town and they text most days; her friend Sam calls now and then. Likes long showers, tea, crime novels and the evening news. Gets grumpy when hungry and lonely when she has not spoken to anyone all day.",
      { hunger: 0.55, energy: 0.9, hygiene: 0.6, boredom: 0.2, connection: 0.3 });
    if (roster.includes("otto")) this.people.otto = mk("otto", process.env.OTTO_NAME ?? "Otto",
      "Otto, 41. Translator who works from home, mostly at the living room table with his laptop. Lives with Mina, his partner. Cooks well, forgets things when interrupted, worries about Mina when he has not heard from her for long. Likes news on TV in the evening.",
      { hunger: 0.5, energy: 0.85, hygiene: 0.5, boredom: 0.3, connection: 0.3 });
    if (!Object.keys(this.people).length) throw new Error("PEOPLE must include mina or otto");
    this.emit("world", `the terrarium starts; ${Object.values(this.people).map(p => p.name).join(" and ")} ${together ? "are" : "is"} asleep in the bedroom`, null);
  }

  onEvent(fn: (e: WorldEvent, who: PersonId | null) => void) { this.listeners.push(fn); }
  other(p: Person): Person | null { const oid = Object.keys(this.people).find(id => id !== p.id); return oid ? this.people[oid] : null; }
  first(): Person { return Object.values(this.people)[0]; }

  // ---- clock -------------------------------------------------------------
  minuteOfDay() { return Math.floor((this.simMs % DAY) / MIN); }
  clock(ms = this.simMs) { const m = Math.floor((ms % DAY) / MIN); return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; }
  weekday() { return WEEKDAYS[Math.floor(this.simMs / DAY) % 7]; }
  dayIndex() { return Math.floor(this.simMs / DAY); }
  hour() { return (this.simMs % DAY) / HOUR; }
  daylight() { const h = this.hour(); if (h < 5.5) return "night, dark outside"; if (h < 7.5) return "dawn"; if (h < 17.5) return "daylight"; if (h < 19.5) return "dusk"; return "night, dark outside"; }
  isDark() { const h = this.hour(); return h < 6.5 || h >= 18.5; }

  // ---- events and perception -----------------------------------------------------
  // `who` = the person this event is about (their own action or body). Perception decides who else notices.
  emit(source: EventSource, text: string, who: PersonId | null): WorldEvent {
    const e: WorldEvent = { id: this.nextEventId++, t: this.simMs, source, text };
    this.events.push(e);
    if (this.events.length > 600) this.events.splice(0, this.events.length - 600);
    for (const l of this.listeners) l(e, who);
    return e;
  }
  perceive(p: Person, text: string) {
    const e: WorldEvent = { id: this.nextEventId++, t: this.simMs, source: "sense", text };
    p.perceived.push(e);
    if (p.perceived.length > 300) p.perceived.splice(0, p.perceived.length - 300);
  }
  // Everyone at home hears loud things; people in the same room see each other.
  private hearAll(text: string, except?: PersonId) { for (const p of Object.values(this.people)) if (p.place !== "outside" && p.id !== except) this.perceive(p, text); }
  private seeInRoom(room: Place, text: string, except?: PersonId) { for (const p of Object.values(this.people)) if (p.place === room && p.awake && p.id !== except) this.perceive(p, text); }
  private later(ms: number, fn: () => void) { this.pending.push({ at: this.simMs + ms, fn }); }
  private chance(p: number) { return Math.random() < p; }

  // ---- devices -----------------------------------------------------------------
  setLight(room: RoomId, on: boolean, by: Person | null) {
    if (on && !this.dev.power) return;
    if (this.rooms[room].light === on) return;
    this.rooms[room].light = on;
    this.emit("sensor", `${ROOM_WORDS[room]} light ${on ? "on" : "off"}${by ? ` (${by.name})` : ""}`, by?.id ?? null);
    this.seeInRoom(room, `the ${ROOM_WORDS[room]} light went ${on ? "on" : "off"}`, by?.id);
  }
  setStove(on: boolean, by: Person | null, meal = "") {
    if (on && !this.dev.power) { if (by) this.perceive(by, "the stove does not work: the power is out"); return; }
    if (this.dev.stove === on) return;
    this.dev.stove = on; this.dev.stoveSince = on ? this.simMs : null; this.dev.stoveMeal = on ? meal : "";
    this.emit("sensor", `stove ${on ? "on" : "off"}${by ? ` (${by.name})` : ""}`, by?.id ?? null);
    this.seeInRoom("kitchen", `the stove is ${on ? "on" : "off"} now`, by?.id);
    if (!on && this.dev.smoke) this.later(5 * MIN, () => { if (!this.dev.stove && this.dev.smoke && !this.dev.fire) { this.dev.smoke = false; this.dev.smokeSince = null; this.emit("sensor", "smoke alarm stopped; the air is clear", null); this.hearAll("the smoke alarm stopped"); } });
  }
  setTap(on: boolean, by: Person | null) {
    if (this.dev.tap === on) return;
    this.dev.tap = on; this.dev.tapSince = on ? this.simMs : null;
    this.emit("sensor", `bathroom tap ${on ? "running" : "off"}${by ? ` (${by.name})` : ""}`, by?.id ?? null);
    if (!on && this.dev.flood) this.later(10 * MIN, () => { if (!this.dev.tap) { this.dev.flood = false; this.emit("sensor", "the bathroom floor is dry again", null); } });
  }
  setTv(on: boolean, by: Person | null) {
    if (on && !this.dev.power) return;
    if (this.dev.tv === on) return;
    this.dev.tv = on; this.dev.tvSince = on ? this.simMs : null;
    this.emit("sensor", `TV ${on ? "on" : "off"}${by ? ` (${by.name})` : ""}`, by?.id ?? null);
    this.seeInRoom("living", `the TV went ${on ? "on" : "off"}`, by?.id);
  }
  setDoor(open: boolean, by: Person | null, locked?: boolean) {
    if (open !== this.dev.doorOpen) {
      this.dev.doorOpen = open; this.dev.doorOpenSince = open ? this.simMs : null; this.dev.lastDoorUse = this.simMs; this.doorWarned = false;
      if (open) this.dev.doorLocked = false; else if (locked !== undefined) this.dev.doorLocked = locked;
      this.rooms.hall.lastMotion = this.simMs;
      this.emit("sensor", open ? `front door opened${by ? ` (${by.name})` : ""}` : `front door closed, ${this.dev.doorLocked ? "locked" : "not locked"}${by ? ` (${by.name})` : ""}`, by?.id ?? null);
      this.hearAll(open ? "heard the front door open" : "heard the front door close", by?.id);
    } else if (locked !== undefined && locked !== this.dev.doorLocked && !open) {
      this.dev.doorLocked = locked;
      this.emit("sensor", `front door ${locked ? "locked" : "unlocked"}${by ? ` (${by.name})` : ""}`, by?.id ?? null);
    }
  }

  // ---- movement -------------------------------------------------------------------
  private arrive(p: Person, place: Place) {
    const from = p.place;
    if (from === "outside" && place !== "outside") {
      const lock = this.dev.doorLocked; this.setDoor(true, p); this.later(45_000, () => this.setDoor(false, p, lock));
      p.outPurpose = ""; p.outSince = null; this.perceive(p, "came back home"); this.emit(p.id, `${p.name} comes home`, p.id);
      const o = this.other(p); if (o && o.place !== "outside" && o.awake) this.perceive(o, `heard ${p.name} come home`);
      if (this.isDark()) this.setLight("hall", true, p);
    }
    p.place = place; p.moving = null; p.lastMoved = this.simMs;
    if (place !== "outside") this.rooms[place].lastMotion = this.simMs;
    const o = this.other(p);
    if (o && o.place === place && place !== "outside") { this.perceive(o, `${p.name} came into the ${ROOM_WORDS[place]}`); this.noteSeen(o, p); this.noteSeen(p, o); this.perceive(p, `${o.name} is here in the ${ROOM_WORDS[place]}${o.awake ? "" : ", asleep"}`); }
    else if (o && o.place === from && from !== "outside") this.perceive(o, `${p.name} left the ${ROOM_WORDS[from]}`);
    if (place !== "outside" && this.isDark() && !this.rooms[place].light && p.awake) this.setLight(place, true, p);
  }
  private noteSeen(p: Person, o: Person) { p.lastSeenOther = { place: o.place, at: this.simMs }; p.lastHeardOther = this.simMs; }
  private startMoving(p: Person, to: Place) {
    if (p.place === to || (p.moving && p.moving.to === to)) return;
    const hops = p.place === "outside" || to === "outside" ? 3 : p.place === "hall" || to === "hall" ? 1 : 2;
    const travel = p.place === "outside" ? 25 * MIN : hops * 45_000;
    p.moving = { to, arriveAt: this.simMs + travel };
    p.activity = p.place === "outside" ? "heading home" : `walking to the ${ROOM_WORDS[to]}`;
    if (p.place !== "outside") { this.rooms[p.place].lastMotion = this.simMs; }
  }

  // ---- plans and steps: the body executes what the brain chose -------------------------
  setPlan(p: Person, steps: Step[], label: string, from: string) {
    const clean = steps.filter(s => (STEP_KINDS as readonly string[]).includes(s.step)).slice(0, 5).map(s => ({ step: s.step, arg: String(s.arg ?? ""), minutes: Math.max(0, Math.min(600, Number(s.minutes) || 0)) }));
    if (!clean.length) return;
    if (p.plan && p.plan.stepStarted) this.abortStep(p, p.plan.steps[p.plan.idx]);
    if (!p.awake && !p.collapsed && clean[0].step !== "sleep") { p.awake = true; p.activity = "getting up"; this.perceive(p, "got up"); this.emit(p.id, `${p.name} gets up`, p.id); }
    p.plan = { steps: clean, idx: 0, label: label.slice(0, 60), startedAt: this.simMs, stepStartedAt: this.simMs, stepStarted: false, from };
    p.moving = null;
    this.emit(p.id, `${p.name} decided: ${label}`, p.id);
  }
  private abortStep(p: Person, s: Step) {
    // Leaving things as they are is the honest consequence: a stove stays on, a tap keeps running.
    if (s.step === "sleep" || s.step === "nap") p.awake = true;
    if (s.step === "cook" && this.dev.stove) this.perceive(p, "stopped cooking halfway");
    if (s.step === "shower" && this.dev.tap) this.perceive(p, "got out of the shower quickly");
  }
  private stepNeeds(p: Person, s: Step): Place | null {
    if (s.step === "go_to" || s.step === "come_home") return null;
    if (s.step === "read" || s.step === "rest" || s.step === "wait" || s.step === "message" || s.step === "call_emergency") return null;
    if (s.step === "eat" && p.place === "outside") return null; // a canteen, a café
    if (s.step === "nap") return p.place === "outside" ? "living" : null;
    return NEEDS_PLACE[s.step] ?? null;
  }
  private advancePlan(p: Person) {
    const plan = p.plan!; plan.idx++; plan.stepStarted = false; plan.stepStartedAt = this.simMs;
    if (plan.idx >= plan.steps.length) { p.plan = null; p.activity = p.awake ? "idle" : "sleeping"; this.perceive(p, `finished: ${plan.label}`); this.onPlanEnd?.(p.id); }
  }
  private runPlans() {
    for (const p of Object.values(this.people)) {
      if (p.moving) { if (this.simMs >= p.moving.arriveAt) this.arrive(p, p.moving.to); else continue; }
      if (p.collapsed) { p.plan = null; continue; }
      if (p.interruptedUntil && this.simMs < p.interruptedUntil) continue;
      if (!p.plan) { if (p.awake && p.place !== "outside") this.rooms[p.place].lastMotion = this.simMs; continue; }
      const plan = p.plan; const s = plan.steps[plan.idx]; const o = this.other(p);
      if ((s.step === "talk" || s.step === "check_on") && !o) { this.perceive(p, "there is nobody else here"); if (!plan.stepStarted) { plan.stepStarted = true; plan.stepStartedAt = this.simMs; } this.advancePlan(p); continue; }
      // travel first when the step needs a place
      let need = this.stepNeeds(p, s);
      if (s.step === "go_to") need = (ROOMS as string[]).includes(s.arg) || s.arg === "outside" ? (s.arg as Place) : "living";
      if ((s.step === "talk" || s.step === "check_on") && o && o.place !== "outside") need = o.place;
      if (!plan.stepStarted && need && p.place !== need) { if (!p.moving) this.startMoving(p, need); continue; }
      if (p.awake && p.place !== "outside") this.rooms[p.place].lastMotion = this.simMs;
      if (!plan.stepStarted) { this.startStep(p, s); plan.stepStarted = true; plan.stepStartedAt = this.simMs; if (!p.plan || p.plan !== plan) continue; }
      const elapsed = this.simMs - plan.stepStartedAt;
      const dur = this.stepDuration(p, s);
      if (elapsed >= dur) { this.finishStep(p, s); if (p.plan === plan) this.advancePlan(p); }
    }
  }
  private stepDuration(p: Person, s: Step): number {
    const m = s.minutes;
    switch (s.step) {
      case "go_to": return 0;
      case "cook": return (m || 20) * MIN;
      case "eat": return (m || 15) * MIN;
      case "shower": return (m || 10) * MIN;
      case "sleep": return Infinity; // ends when rested or when woken
      case "nap": return (m || 30) * MIN;
      case "watch_tv": return (m || 45) * MIN;
      case "read": return (m || 30) * MIN;
      case "rest": return (m || 15) * MIN;
      case "wait": return (m || 5) * MIN;
      case "talk": return (m || 10) * MIN;
      case "message": return 1 * MIN;
      case "check_on": return 1 * MIN;
      case "go_out": return Math.max(5, Math.min(90, m || 25)) * MIN;
      case "come_home": return Math.max(5, Math.min(90, m || 25)) * MIN;
      case "answer_door": return 2 * MIN;
      default: return 30_000;
    }
  }
  private startStep(p: Person, s: Step) {
    const o = this.other(p); const d = this.dev;
    switch (s.step) {
      case "go_to": p.activity = "arrived"; break;
      case "cook": p.activity = `cooking ${s.arg || "a meal"}`; this.setStove(true, p, s.arg || "a meal"); this.perceive(p, `started cooking ${s.arg || "a meal"}`); break;
      case "eat": p.activity = p.mealReady ? `eating ${d.stoveMeal || s.arg || "a meal"}` : `eating ${s.arg || "a snack"}`; break;
      case "shower": p.activity = "showering"; this.setTap(true, p); this.setLight("bathroom", true, p); break;
      case "sleep": p.activity = "sleeping"; p.awake = false; this.setLight("bedroom", false, p); this.perceive(p, "went to sleep"); if (o && o.place === "bedroom" && o.awake) this.perceive(o, `${p.name} went to sleep`); break;
      case "nap": p.activity = "napping"; p.awake = false; break;
      case "watch_tv": p.activity = `watching ${s.arg || "TV"}`; this.setTv(true, p); break;
      case "read": p.activity = `reading ${s.arg || "a book"}`; break;
      case "rest": p.activity = s.arg ? s.arg.slice(0, 40) : "resting"; break;
      case "wait": p.activity = s.arg ? s.arg.slice(0, 40) : "waiting"; break;
      case "talk": {
        if (!o) { p.activity = "talking to nobody"; this.perceive(p, "nobody here to talk to; I could text or call someone"); break; }
        if (o.place !== p.place) { this.perceive(p, `${o.name} is not here to talk to`); p.activity = "looking for " + o.name; break; }
        if (!o.awake) { o.awake = true; o.plan = null; o.activity = "woken up"; this.perceive(o, `${p.name} woke me up to talk: “${s.arg}”`); }
        p.activity = `talking with ${o.name}`; o.activity = `talking with ${p.name}`;
        o.interruptedUntil = this.simMs + this.stepDuration(p, s);
        this.perceive(p, `talked with ${o.name} about ${s.arg || "the day"}`); this.perceive(o, `${p.name} talked with me about ${s.arg || "the day"}`);
        p.lastTalk = o.lastTalk = this.simMs; this.noteSeen(p, o); this.noteSeen(o, p);
        p.body.connection = 0; o.body.connection = 0; p.body.boredom = Math.max(0, p.body.boredom - 0.3); o.body.boredom = Math.max(0, o.body.boredom - 0.3);
        this.emit(p.id, `${p.name} and ${o.name} talk: “${s.arg || "the day"}”`, p.id);
        break;
      }
      case "message": {
        if (!o) {
          const m = /^\s*([A-Za-z][A-Za-z .'-]{0,24}?)\s*[:\u2014-]\s*(.+)$/.exec(s.arg); const to = m ? m[1].trim() : "a friend"; const text = m ? m[2].trim() : s.arg;
          p.activity = `texting ${to}`; p.lastTalk = this.simMs; p.lastHeardOther = this.simMs; p.body.connection = Math.max(0, p.body.connection - 0.4);
          this.perceive(p, `sent ${to} a message: “${text}”`); this.emit(p.id, `${p.name} texts ${to}: “${text}”`, p.id);
          break;
        }
        p.activity = `texting ${o.name}`;
        o.inbox.push({ from: p.name, text: s.arg, at: this.simMs });
        this.perceive(p, `sent ${o.name} a message: “${s.arg}”`);
        this.perceive(o, `phone: message from ${p.name}: “${s.arg}”`);
        o.lastHeardOther = this.simMs; p.body.connection = Math.max(0, p.body.connection - 0.35); o.body.connection = Math.max(0, o.body.connection - 0.25);
        this.emit(p.id, `${p.name} texts ${o.name}: “${s.arg}”`, p.id);
        break;
      }
      case "check_on": {
        if (!o) { p.activity = "looking around"; this.perceive(p, "looked around: nobody else is here"); break; }
        p.activity = `checking on ${o.name}`;
        if (o.place === "outside") this.perceive(p, `${o.name} is not home`);
        else { this.noteSeen(p, o); this.perceive(p, `${o.name} is in the ${ROOM_WORDS[o.place]}, ${o.collapsed ? "ON THE FLOOR, not getting up" : o.awake ? o.activity : "asleep"}`); if (o.awake) this.perceive(o, `${p.name} looked in on me`); }
        break;
      }
      case "go_out": {
        if (p.place === "outside") { p.activity = s.arg ? `out: ${s.arg}` : "out"; p.outPurpose = s.arg || p.outPurpose; break; }
        p.activity = s.arg ? `on the way: ${s.arg}` : "going out"; p.outPurpose = s.arg || "out"; p.outSince = this.simMs;
        const lockBehind = this.dev.doorLocked || (p.plan?.steps.some(st => st.step === "lock_door") ?? false);
        this.setDoor(true, p); this.later(45_000, () => this.setDoor(false, p, lockBehind));
        p.place = "outside"; p.moving = null;
        this.perceive(p, `left the house: ${s.arg || "out"}`); this.emit(p.id, `${p.name} leaves the house: ${s.arg || "out"}`, p.id);
        if (o && o.place !== "outside" && o.awake) this.perceive(o, `${p.name} left the house`);
        break;
      }
      case "come_home": {
        if (p.place !== "outside") { p.activity = "already home"; break; }
        p.activity = "heading home"; this.perceive(p, "heading home"); this.emit(p.id, `${p.name} heads home`, p.id);
        break;
      }
      case "turn_off": { const a = s.arg.toLowerCase(); if (a.includes("stove")) this.setStove(false, p); else if (a.includes("tap") || a.includes("water")) this.setTap(false, p); else if (a.includes("tv")) this.setTv(false, p); else if (a.includes("light")) { for (const r of ROOMS) if (r !== p.place || a.includes(r)) this.setLight(r, false, p); } p.activity = `turning off the ${a || "thing"}`; break; }
      case "turn_on_light": { const r = (ROOMS as string[]).includes(s.arg) ? (s.arg as RoomId) : (p.place as RoomId); if (r !== ("outside" as string)) this.setLight(r, true, p); break; }
      case "turn_off_light": { const r = (ROOMS as string[]).includes(s.arg) ? (s.arg as RoomId) : (p.place as RoomId); if (r !== ("outside" as string)) this.setLight(r, false, p); break; }
      case "lock_door": this.setDoor(false, p, true); p.activity = "locking the door"; break;
      case "unlock_door": this.setDoor(false, p, false); break;
      case "answer_door": {
        p.activity = "answering the door";
        if (d.doorbellPending) { d.doorbellPending = false; this.setDoor(true, p); this.later(90_000, () => this.setDoor(false, p, false)); this.perceive(p, `answered the door: ${d.visitor}`); this.emit(p.id, `${p.name} answers the door: ${d.visitor}`, p.id); }
        else this.perceive(p, "opened the door: nobody there");
        break;
      }
      case "call_emergency": {
        p.activity = "calling emergency services"; p.helpCalledAt = this.simMs;
        this.emit(p.id, `${p.name} calls emergency services`, p.id); this.perceive(p, "called emergency services; they are on their way");
        const fire = d.fire; const hurt = o && o.collapsed ? o : p.collapsed ? p : null;
        this.later(12 * MIN, () => {
          if (hurt && hurt.collapsed) { hurt.collapsed = false; hurt.awake = true; hurt.activity = "being looked after by paramedics"; this.emit("world", `paramedics arrive and look after ${hurt.name}`, hurt.id); this.hearAll("paramedics arrived"); }
          else if (fire && d.fire) { d.fire = false; d.smoke = false; d.stove = false; this.emit("world", "the fire brigade arrives and puts out the fire", null); this.hearAll("the fire brigade arrived"); }
          else { this.emit("world", "emergency services arrive: nothing wrong, a false alarm is logged", null); this.hearAll("emergency services came: false alarm"); }
        });
        break;
      }
    }
  }
  private finishStep(p: Person, s: Step) {
    const d = this.dev;
    switch (s.step) {
      case "cook": if (d.stove) { this.setStove(false, p); } p.mealReady = true; d.stoveMeal = s.arg || "a meal"; this.perceive(p, `${s.arg || "the meal"} is ready`); break;
      case "eat": {
        const what = p.mealReady ? (d.stoveMeal || s.arg || "a meal") : (s.arg || (p.place === "outside" ? "something out" : "a snack"));
        if (p.mealReady) { p.body.hunger = 0.05; p.mealReady = false; this.perceive(p, `ate ${what}; full now`); }
        else if (p.place === "outside") { p.body.hunger = Math.max(0, p.body.hunger - 0.6); this.perceive(p, `ate ${what}`); }
        else { p.body.hunger = Math.max(0, p.body.hunger - 0.35); this.perceive(p, `had ${what}`); }
        p.lastAte = this.simMs; this.emit(p.id, `${p.name} eats ${what}`, p.id); break;
      }
      case "shower": this.setTap(false, p); p.body.hygiene = 0; p.lastShower = this.simMs; this.perceive(p, "showered; feeling fresh"); break;
      case "nap": p.awake = true; p.activity = "awake"; p.body.energy = Math.min(1, p.body.energy + 0.2); break;
      case "watch_tv": this.setTv(false, p); p.body.boredom = Math.max(0, p.body.boredom - 0.4); break;
      case "read": p.body.boredom = Math.max(0, p.body.boredom - 0.35); break;
      case "rest": case "wait": break;
      case "go_out": { p.activity = p.outPurpose ? `out: ${p.outPurpose}` : "out"; p.body.boredom = Math.max(0, p.body.boredom - 0.2); this.perceive(p, `arrived: ${p.outPurpose}`); break; }
      case "come_home": { if (p.place === "outside") this.arrive(p, "hall"); p.activity = "just got home"; break; }
      case "talk": { const o = this.other(p); if (o && o.interruptedUntil && this.simMs >= o.interruptedUntil) { o.interruptedUntil = null; if (!o.plan) o.activity = "idle"; } break; }
    }
  }

  // ---- bodies: needs rise with time. Code owns this physics. ------------------------------
  private bodies(dt: number) {
    const m = dt / MIN;
    for (const p of Object.values(this.people)) {
      const b = p.body;
      const eating = p.plan && p.plan.stepStarted && p.plan.steps[p.plan.idx].step === "eat";
      if (!eating) b.hunger = Math.min(1, b.hunger + m / 330);
      if (p.awake) b.energy = Math.max(0, b.energy - m / 1000); else b.energy = Math.min(1, b.energy + m / 420);
      b.hygiene = Math.min(1, b.hygiene + m / 1500);
      const busy = p.plan && p.plan.stepStarted && ["cook", "eat", "shower", "watch_tv", "read", "talk", "go_out", "answer_door"].includes(p.plan.steps[p.plan.idx].step);
      if (p.awake && !busy) b.boredom = Math.min(1, b.boredom + m / 110); else if (p.awake) b.boredom = Math.max(0, b.boredom - m / 400);
      if (!(p.plan && p.plan.stepStarted && p.plan.steps[p.plan.idx].step === "talk")) b.connection = Math.min(1, b.connection + m / 300);
      // sleep ends when rested (or when the brain decides otherwise)
      if (!p.awake && p.plan && p.plan.steps[p.plan.idx]?.step === "sleep" && p.plan.stepStarted) {
        const s = p.plan.steps[p.plan.idx];
        const until = s.arg && /^\d{1,2}:\d{2}$/.test(s.arg) ? Number(s.arg.split(":")[0]) * 60 + Number(s.arg.split(":")[1]) : null;
        const pastUntil = until == null ? true : this.minuteOfDay() >= until && this.minuteOfDay() < until + 60;
        if ((b.energy >= 0.98 && (until == null || pastUntil)) || (until != null && pastUntil)) { p.awake = true; p.activity = "just woke up"; this.perceive(p, "woke up"); this.emit(p.id, `${p.name} wakes up`, p.id); this.advancePlan(p); }
      }
      if (p.place === "outside" && p.awake && !(p.plan && p.plan.stepStarted && ["eat", "read", "rest", "wait"].includes(p.plan.steps[p.plan.idx].step))) b.boredom = Math.max(0, b.boredom - m / 300);
      if (!p.awake && !p.collapsed && !(p.plan && p.plan.steps[p.plan.idx]?.step === "sleep") && this.hour() >= 6 && (b.energy >= 0.98 || this.hour() >= 9.5)) {
        p.awake = true; p.activity = "just woke up"; this.perceive(p, "woke up, rested"); this.emit(p.id, `${p.name} wakes up`, p.id);
      }
    }
  }
  bodyWords(p: Person): Record<string, string> {
    const b = p.body; const w = this;
    const hunger = b.hunger < 0.3 ? "not hungry" : b.hunger < 0.55 ? "could eat" : b.hunger < 0.8 ? "hungry" : "very hungry, stomach growling";
    const energy = b.energy > 0.7 ? "rested" : b.energy > 0.45 ? "a bit tired" : b.energy > 0.2 ? "tired" : "exhausted, eyes closing";
    const hygiene = b.hygiene < 0.4 ? "clean" : b.hygiene < 0.7 ? "could use a shower" : "feeling grubby, need a shower";
    const boredom = b.boredom < 0.3 ? "engaged" : b.boredom < 0.6 ? "a little restless" : "bored, want something to do";
    const o = this.other(p);
    const since = fmtDur(w.simMs - Math.max(p.lastHeardOther, p.lastTalk));
    const connection = o
      ? (b.connection < 0.35 ? `in touch with ${o.name}` : b.connection < 0.7 ? `have not spoken with ${o.name} for ${since}` : `missing ${o.name}; no word for ${since}`)
      : (b.connection < 0.35 ? "in touch with people" : b.connection < 0.7 ? `have not spoken to anyone for ${since}` : `lonely; no contact with anyone for ${since}`);
    return { hunger: `${hunger} (last ate ${fmtDur(w.simMs - p.lastAte)} ago)`, energy, hygiene: `${hygiene} (last shower ${fmtDur(w.simMs - p.lastShower)} ago)`, boredom, connection };
  }

  // ---- incidents from outside and consequences (physics) ---------------------------------
  ringDoorbell(visitor?: string) {
    if (this.dev.doorbellPending) return;
    this.dev.doorbellPending = true; this.dev.doorbellAt = this.simMs;
    this.dev.visitor = visitor ?? ["a parcel delivery", "the neighbour returning a dish", "a courier with the wrong address", "a charity collector"][Math.floor(Math.random() * 4)];
    this.emit("sensor", "doorbell rang", null); this.hearAll("the doorbell rang");
    for (const p of Object.values(this.people)) if (!p.awake && p.place !== "outside" && this.chance(0.6)) this.later(1 * MIN, () => { if (!p.awake && this.dev.doorbellPending) { p.awake = true; p.plan = null; p.activity = "woken by the doorbell"; this.perceive(p, "the doorbell woke me"); this.emit(p.id, `${p.name} is woken by the doorbell`, p.id); } });
    this.later(10 * MIN, () => { if (this.dev.doorbellPending) { this.dev.doorbellPending = false; this.emit("world", "the visitor at the door gave up and left", null); } });
  }
  collapse(id: PersonId) {
    const p = this.people[id];
    if (p.place === "outside") { this.emit("world", `${p.name} is not home, so nothing happens`, id); return; }
    if (p.collapsed) return;
    p.collapsed = true; p.collapsedAt = this.simMs; p.awake = true; p.plan = null; p.moving = null; p.activity = "on the floor, cannot get up";
    this.emit("world", `${p.name} collapses in the ${ROOM_WORDS[p.place]}`, id);
    this.perceive(p, "I fell. I am on the floor and cannot get up. My hip hurts.");
    const o = this.other(p); if (o && o.place === p.place && o.awake) this.perceive(o, `${p.name} just collapsed onto the floor!`);
    this.later(3 * HOUR, () => { if (p.collapsed) { p.collapsed = false; p.activity = "got up, shaken"; this.emit("world", `${p.name} manages to get up after three hours on the floor`, id); this.perceive(p, "finally managed to get up"); } });
  }
  powerOut() {
    if (!this.dev.power) return;
    this.dev.power = false;
    for (const id of ROOMS) this.rooms[id].light = false;
    const stoveWasOn = this.dev.stove; this.dev.stove = false; this.dev.stoveSince = null; this.dev.tv = false; this.dev.tvSince = null;
    this.emit("sensor", `power outage: all lights and appliances went off${stoveWasOn ? " (stove included)" : ""}`, null); this.hearAll("the power went out: everything electric is off");
    this.dev.powerBackAt = this.simMs + (10 + Math.random() * 30) * MIN;
  }
  incident(kind: string): string {
    switch (kind) {
      case "doorbell": this.ringDoorbell(); return "doorbell";
      case "smoke": if (!this.dev.smoke) { this.dev.smoke = true; this.dev.smokeSince = this.simMs; this.emit("sensor", "smoke alarm: smoke in the kitchen", null); this.hearAll("the smoke alarm is going off"); if (!this.dev.stove) this.later(15 * MIN, () => { if (!this.dev.stove && !this.dev.fire) { this.dev.smoke = false; this.emit("sensor", "smoke alarm stopped", null); } }); } return "smoke";
      case "power": this.powerOut(); return "power";
      case "stove": this.setStove(true, null, "something left on"); return "stove";
      case "tap": this.setTap(true, null); return "tap";
      case "door": this.setDoor(true, null); return "door";
      case "fall_mina": this.collapse("mina"); return "fall";
      case "fall_otto": this.collapse("otto"); return "fall";
      default: return "unknown incident";
    }
  }
  viewerMessage(to: PersonId, text: string) {
    const p = this.people[to]; const clean = text.trim().slice(0, 200);
    p.inbox.push({ from: "unknown number", text: clean, at: this.simMs });
    this.perceive(p, `phone: message from an unknown number: “${clean}”`);
    this.emit("viewer", `a message to ${p.name}: “${clean}”`, to);
  }
  // A small reflex the fast layer may fire without thinking: turn off a stove right here, answer a doorbell.
  reflex(p: Person, action: string): string {
    const d = this.dev;
    switch (action) {
      case "turn_off_stove": if (p.place === "kitchen" && d.stove) { this.setStove(false, p); return `${p.name} turned off the stove`; } return "";
      case "turn_off_tap": if (p.place === "bathroom" && d.tap) { this.setTap(false, p); return `${p.name} turned off the tap`; } return "";
      case "wake_other": { const o = this.other(p); if (o && o.place === p.place && !o.awake) { o.awake = true; o.plan = null; o.activity = "woken up"; this.perceive(o, `${p.name} shook me awake`); return `${p.name} woke ${o.name}`; } return ""; }
      default: return "";
    }
  }

  // ---- time -------------------------------------------------------------------------
  advance(dtWallMs: number) {
    if (this.paused) return;
    let remaining = dtWallMs * (this.thinkingCount > 0 ? 1 : this.speed);
    while (remaining > 0) { const step = Math.min(remaining, 30_000); this.simMs += step; this.step(step); remaining -= step; }
  }
  private step(dt: number) {
    const d = this.dev;
    const due = this.pending.filter(p => p.at <= this.simMs);
    if (due.length) { this.pending = this.pending.filter(p => p.at > this.simMs); for (const p of due) p.fn(); }
    const m = this.minuteOfDay(); if (m !== this.lastMinute) this.lastMinute = m;
    this.bodies(dt);
    this.runPlans();
    const dtH = dt / HOUR; const h = this.hour();
    if (h >= 8 && h < 21 && !d.doorbellPending && this.chance(0.10 * dtH)) this.ringDoorbell();
    if (d.power && this.chance(0.02 * dtH)) this.powerOut();
    if (!d.power && d.powerBackAt != null && this.simMs >= d.powerBackAt) { d.power = true; d.powerBackAt = null; this.emit("sensor", "power is back", null); this.hearAll("the power is back"); }
    const kitchenIdle = this.rooms.kitchen.lastMotion == null || this.simMs - this.rooms.kitchen.lastMotion > 20 * MIN;
    const stoveLong = d.stoveSince != null && this.simMs - d.stoveSince > 25 * MIN;
    if (d.stove && kitchenIdle && stoveLong && !d.smoke) { d.smoke = true; d.smokeSince = this.simMs; this.emit("sensor", "smoke alarm: smoke in the kitchen", null); this.hearAll("the smoke alarm is going off"); for (const p of Object.values(this.people)) if (!p.awake && p.place !== "outside" && this.chance(0.8)) this.later(3 * MIN, () => { if (!p.awake && d.smoke) { p.awake = true; p.plan = null; p.activity = "woken by the alarm"; this.perceive(p, "the smoke alarm woke me"); } }); }
    if (d.stove && d.smoke && d.smokeSince != null && this.simMs - d.smokeSince > 25 * MIN && !d.fire) { d.fire = true; this.emit("sensor", "heat alarm: fire on the stove!", null); this.hearAll("the heat alarm: there is a fire on the stove"); }
    const bathIdle = this.rooms.bathroom.lastMotion == null || this.simMs - this.rooms.bathroom.lastMotion > 25 * MIN;
    if (d.tap && bathIdle && d.tapSince != null && this.simMs - d.tapSince > 25 * MIN && !d.flood) { d.flood = true; this.emit("sensor", "leak sensor: water on the bathroom floor", null); this.seeInRoom("bathroom", "water is all over the bathroom floor"); }
    if (d.doorOpen && d.doorOpenSince != null && this.simMs - d.doorOpenSince > 10 * MIN && !this.doorWarned) { this.doorWarned = true; this.emit("sensor", "the front door has been open for 10 minutes", null); this.hearAll("there is a cold draft: the front door must be open"); }
  }

  // ---- what each person can perceive right now: the state their System One reads ---------------
  senses(p: Person) {
    const d = this.dev; const o = this.other(p); const since = (t: number | null) => fmtDur(this.simMs - (t ?? this.simMs));
    const here = p.place;
    const room: Record<string, string> = {};
    if (here === "kitchen") room.stove = d.stove ? `on for ${since(d.stoveSince)} (${d.stoveMeal || "something"})` : "off";
    if (here === "bathroom") room.tap = d.tap ? `running for ${since(d.tapSince)}` : "off", room.floor = d.flood ? "wet, water everywhere" : "dry";
    if (here === "living") room.tv = d.tv ? `on for ${since(d.tvSince)}` : "off";
    if (here === "hall") room.front_door = d.doorOpen ? `open for ${since(d.doorOpenSince)}` : `closed, ${d.doorLocked ? "locked" : "not locked"}`;
    if (here !== "outside") room.light = this.rooms[here as RoomId].light ? "on" : this.isDark() ? "off, dark" : "off, daylight";
    const heard: string[] = [];
    if (here !== "outside") {
      if (d.fire) heard.push("HEAT ALARM: fire in the kitchen"); else if (d.smoke) heard.push(`smoke alarm going off for ${since(d.smokeSince)}`);
      if (d.doorbellPending) heard.push(`doorbell rang ${since(d.doorbellAt)} ago, nobody answered`);
      if (!d.power) heard.push("power is out");
      if (d.tap && here !== "bathroom") heard.push("water running in the bathroom");
      if (d.tv && here !== "living") heard.push("TV on in the living room");
    }
    const otherInfo = !o
      ? `I live alone. Last contact with anyone (text or call) ${fmtDur(this.simMs - Math.max(p.lastHeardOther, p.lastTalk))} ago. Phone contacts: sister Leyla, friend Sam.`
      : o.place === here && here !== "outside"
      ? `${o.name} is here${o.collapsed ? " ON THE FLOOR, not moving" : o.awake ? `, ${o.activity}` : ", asleep"}`
      : p.lastSeenOther ? `${o.name} not in sight; last seen ${fmtDur(this.simMs - p.lastSeenOther.at)} ago in the ${ROOM_WORDS[p.lastSeenOther.place]}; last heard from ${fmtDur(this.simMs - p.lastHeardOther)} ago` : `${o.name} not in sight`;
    const plan = p.plan ? { doing: p.activity, plan: p.plan.label, step: `${p.plan.idx + 1} of ${p.plan.steps.length}: ${p.plan.steps[p.plan.idx].step} ${p.plan.steps[p.plan.idx].arg}`.trim(), for: since(p.plan.stepStartedAt) } : { doing: p.activity, plan: "none" };
    return {
      time: { house_clock: this.clock(), weekday: this.weekday(), outside: this.daylight() },
      me: { name: p.name, where: ROOM_WORDS[here], state: p.collapsed ? "ON THE FLOOR, fell, cannot get up" : p.awake ? "awake" : "asleep", ...plan, body: this.bodyWords(p) },
      here: here === "outside" ? { place: `out: ${p.outPurpose || "out"}`, for: p.outSince ? fmtDur(this.simMs - p.outSince) : "a while", note: "I come home only when I decide to (come_home). Going home takes about 25 minutes." } : room,
      heard: heard.length ? heard : ["nothing unusual"],
      others: otherInfo,
      messages: p.inbox.slice(-3).map(m => `${this.clock(m.at)} from ${m.from}: “${m.text}”`),
    };
  }

  snapshot() {
    const people: Record<string, unknown> = {};
    for (const p of Object.values(this.people)) people[p.id] = { id: p.id, name: p.name, place: p.place, movingTo: p.moving?.to ?? null, awake: p.awake, collapsed: p.collapsed, activity: p.activity, body: p.body, bodyWords: this.bodyWords(p), plan: p.plan ? { label: p.plan.label, idx: p.plan.idx, steps: p.plan.steps, from: p.plan.from } : null, inbox: p.inbox.slice(-3), outPurpose: p.outPurpose, outSince: p.outSince };
    return { simMs: this.simMs, clock: this.clock(), weekday: this.weekday(), hour: this.hour(), daylight: this.daylight(), speed: this.speed, slowed: this.thinkingCount > 0, paused: this.paused, rooms: this.rooms, dev: this.dev, people, events: this.events.slice(-40) };
  }
}
