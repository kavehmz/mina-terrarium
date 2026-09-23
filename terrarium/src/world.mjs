// The world: clock, home, devices, body, senses, outside events and consequences.
// It also carries out plan steps the way a body would. Nothing here decides what Mina wants:
// the brain (brain.mjs) chooses; this file only makes the chosen step happen, or reports why it cannot.
import { ROOMS, ROOM_IDS, DOORS, SPOTS, ROOM_CENTRE, OUTSIDE, PLACES, roomAt, pathBetween } from "./layout.mjs";

const H = 3600, M = 60;
const WALK_SPEED = 1.3; // metres per sim second
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (xs) => xs[Math.floor(Math.random() * xs.length)];

export const CONTACTS = {
  leyla: { name: "Leyla", who: "her older sister" },
  sam: { name: "Sam", who: "her close friend" },
  dana: { name: "Dana", who: "her manager at the library" },
};

// Actions her System Two may choose. `where` says where the body can do it.
export const ACTIONS = {
  go_to: "walk to a room at home (where = room)",
  cook: "cook a meal on the stove (what = dish); uses one meal's ingredients from the fridge; about 12 min",
  eat: "eat: at home the cooked food or a snack from the fridge; away, buy and eat something",
  drink: "make and drink tea, coffee or water (what)",
  shower: "take a shower, about 12 min",
  bath: "run a bath and soak (minutes); the bath fills for about 11 min first",
  toilet: "use the toilet",
  freshen_up: "wash face and brush teeth at the basin",
  wash_dishes: "wash up at the kitchen sink",
  sleep: "go to bed and sleep (until = HH:MM sets the alarm clock, optional)",
  nap: "nap on the sofa or bed (minutes)",
  watch_tv: "watch TV on the sofa (minutes, what = show)",
  read: "read (minutes, what = book); at home in the armchair",
  relax: "sit and do nothing much (minutes)",
  exercise: "exercise (minutes); at home on the living room floor, or at the gym",
  tidy: "tidy up a room (where, minutes)",
  work: "work a stretch of her shift (minutes); only at the library",
  shop: "buy groceries (what); only at the shop; restocks the fridge",
  meet: "spend time with someone who is there (who, minutes); only away from home",
  walk: "go for a walk (minutes); only away from home, e.g. in the park",
  message: "send a text message (who, text)",
  call: "phone someone (who = leyla | sam | dana | plumber, minutes); people may not pick up; a plumber comes to the house a couple of hours later",
  check_phone: "read unread messages",
  set_alarm: "set the alarm clock (until = HH:MM)",
  go_out: "leave home for a place (where = place); she stays out until she chooses come_home; lock_door = lock the front door behind her",
  come_home: "travel back home from wherever she is",
  turn_off: "turn off a device (what = stove | kitchen tap | basin tap | bath tap | shower | tv | alarm clock | stopcock | lights; where = room for lights). The stopcock under the kitchen sink shuts off all water to the house",
  turn_on: "turn on a device (what = tv | stopcock | lights; where = room for lights)",
  lock_door: "lock the front door",
  unlock_door: "unlock the front door",
  answer_door: "go to the front door and open it",
  attend: "deal with something or someone waiting for her right where she is, e.g. at work (what = the reader, the student, the returns, Priya, Dana, the phone)",
  open_window: "open the windows in a room (where) to air it",
  mop_floor: "mop up water on the floor in a room (where)",
  call_emergency: "phone emergency services (what = reason)",
  get_up: "get up off the floor",
  wait: "wait where she is (minutes)",
};
export const ACTION_IDS = Object.keys(ACTIONS);

const DEVICE_ALIASES = {
  stove: "stove", cooker: "stove", hob: "stove", oven: "stove",
  "kitchen tap": "kitchen_tap", kitchen_tap: "kitchen_tap", tap: "kitchen_tap", "sink tap": "kitchen_tap",
  "basin tap": "basin_tap", basin_tap: "basin_tap", "bathroom tap": "basin_tap",
  "bath tap": "bath_tap", bath_tap: "bath_tap", bath: "bath_tap",
  shower: "shower", tv: "tv", television: "tv", lights: "lights", light: "lights",
  "alarm clock": "alarm_clock", alarm: "alarm_clock", alarm_clock: "alarm_clock",
  stopcock: "stopcock", "water main": "stopcock", "main water": "stopcock", "water supply": "stopcock", "mains water": "stopcock", water: "stopcock", "stop valve": "stopcock",
};
const DEVICE_SPOT = { stopcock: "kitchen_sink", alarm_clock: "bed", stove: "stove", kitchen_tap: "kitchen_sink", basin_tap: "basin", bath_tap: "bathtub", shower: "bathtub", tv: "sofa" };
const DEVICE_LABEL = { stopcock: "the water at the stopcock", alarm_clock: "the alarm clock", stove: "the stove", kitchen_tap: "the kitchen tap", basin_tap: "the basin tap", bath_tap: "the bath tap", shower: "the shower", tv: "the TV", lights: "the lights" };

const PLACE_SENSES = {
  library: "the quiet of the library, colleagues at the desks, readers coming and going",
  shop: "bright aisles, a queue at the till",
  cafe: "the smell of coffee, chatter at the tables",
  park: "trees, joggers, open sky",
  leyla_home: "Leyla's busy flat, her kids' toys on the floor",
  gym: "music, the clank of weights",
  doctor: "a waiting room, magazines, a receptionist",
};

const VISITORS = [
  { kind: "courier", who: "a courier with a parcel", note: "a 'Sorry we missed you' card on the doormat" },
  { kind: "neighbour", who: "Mrs Hale, the neighbour from next door", note: "a note from Mrs Hale: 'Popped by, nothing urgent. H.'" },
  { kind: "neighbour_dish", who: "Mr Okafor from across the road, returning a baking dish", note: "a baking dish left on the doorstep with a thank-you note" },
];

// Ordinary things that happen to her at work. They wait a while for her; ignored, they have consequences.
// `patience` and `takes` are minutes; `key` is how an attend step names them.
const WORK_EVENTS = [
  { kind: "reader", key: /reader|book|enquir|desk/i, text: "a reader at the enquiry desk is waiting for help finding a book", doing: "helping a reader find a book", patience: 15, takes: 12, done: "Mina helped the reader find the book; he left pleased", ignored: "The reader gave up waiting at the desk and left, grumbling" },
  { kind: "student", key: /student|print|dissertation/i, text: "a student is stuck at the printer and asking for help", doing: "helping a student at the printer", patience: 20, takes: 15, done: "Mina got the printer working; the student thanked her", ignored: "The student gave up on the printer and left in a hurry" },
  { kind: "trolley", key: /trolley|returns|shelv/i, text: "a full trolley of returned books needs shelving", doing: "shelving the returns", patience: 120, takes: 35, done: "Mina shelved the whole trolley of returns", ignored: "The returns trolley is overflowing; Dana raised an eyebrow at it" },
  { kind: "colleague", key: /priya|colleague|chat/i, text: "Priya, a colleague, has come over to chat about her weekend", doing: "chatting with Priya", patience: 10, takes: 10, social: true, done: "Mina and Priya had a laugh about Priya's weekend", ignored: "Priya wandered back to her desk" },
  { kind: "dana", key: /dana|manager|cover/i, text: "Dana asks if Mina could cover the front desk this afternoon while she is in a meeting", doing: "talking to Dana", patience: 10, takes: 3, social: true, done: "Mina told Dana she would cover the front desk this afternoon", ignored: "Dana went to ask someone else to cover the desk" },
  { kind: "phone", key: /phone|call|ring/i, text: "the desk phone is ringing: someone wants to renew their books", doing: "on the desk phone, renewing books", patience: 4, takes: 5, done: "Mina renewed the caller's books over the phone", ignored: "The desk phone stopped ringing; nobody answered it" },
];

// Whoever rings late at night or very early: a stranger at the wrong door.
const NIGHT_CALLER = { kind: "stranger", who: "a man at the wrong house", note: null, waitMinutes: 5, ringEvery: 1.5 };

export function clockParts(t) {
  const day = Math.floor(t / 86400);
  const s = t - day * 86400;
  const hh = Math.floor(s / H), mm = Math.floor((s % H) / M);
  return { day, weekday: DAYS[day % 7], hh, mm, hours: s / H, hm: `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}` };
}
export function partOfDay(h) {
  if (h < 5) return "the middle of the night";
  if (h < 7) return "early morning";
  if (h < 12) return "morning";
  if (h < 14) return "midday";
  if (h < 17.5) return "afternoon";
  if (h < 21) return "evening";
  if (h < 23) return "late evening";
  return "night";
}
function daylightOf(h) {
  if (h < 6.3 || h > 20.4) return { level: 0, words: "dark outside" };
  if (h < 7.2) return { level: (h - 6.3) / 0.9, words: "dawn, getting light" };
  if (h > 19.5) return { level: (20.4 - h) / 0.9, words: "dusk, getting dark" };
  return { level: 1, words: "daylight" };
}
export function parseHM(s) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || "").trim());
  if (!m) return null;
  const h = Number(m[1]), mi = Number(m[2]);
  return h < 24 && mi < 60 ? h * H + mi * M : null;
}
export function ago(seconds) {
  if (seconds == null) return "never today";
  const m = Math.round(seconds / 60);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} h ${r} min ago` : `${h} h ago`;
}
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// Body needs in plain words (what System One reads). Numbers stay for the viewer.
export function needWords(n) {
  const band = (v, words) => words.find(([lim]) => v < lim)?.[1] ?? words[words.length - 1][1];
  return {
    hunger: band(n.hunger, [[0.25, "not hungry"], [0.45, "a little peckish"], [0.65, "hungry"], [0.82, "very hungry"], [2, "starving"]]),
    energy: band(1 - n.energy, [[0.25, "rested"], [0.5, "fine"], [0.7, "tired"], [0.85, "very tired"], [2, "exhausted"]]),
    hygiene: band(1 - n.hygiene, [[0.3, "fresh"], [0.55, "okay"], [0.75, "feels grubby"], [2, "badly needs a wash"]]),
    bladder: band(n.bladder, [[0.5, "fine"], [0.7, "will need the toilet soon"], [0.85, "needs the toilet"], [2, "desperate for the toilet"]]),
    boredom: band(n.boredom, [[0.3, "content"], [0.55, "a bit bored"], [0.8, "bored"], [2, "very bored and restless"]]),
    loneliness: band(n.loneliness, [[0.3, "connected"], [0.55, "a bit lonely"], [0.8, "lonely"], [2, "very lonely"]]),
  };
}

export class World {
  constructor({ startDay = 1, startHour = 6.5, log = () => {} } = {}) {
    this.t = startDay * 86400 + startHour * H;
    this.log = log; // (kind, text, extra) — every event goes to the log and the story
    this.listeners = [];
    const bed = SPOTS.bed.at;
    this.person = {
      name: "Mina",
      x: bed[0], y: bed[1], room: "bedroom", facing: 0,
      location: "home", // home | outside | travelling | away
      place: null, travel: null,
      awake: false, sleepKind: "night", sleptAt: this.t - 7.5 * H, wokeAt: null,
      onFloor: false, pain: 0,
      needs: { hunger: 0.42, energy: 0.8, hygiene: 0.55, bladder: 0.5, boredom: 0.2, loneliness: 0.35 },
      activity: { kind: "sleep", label: "asleep", since: this.t - 7.5 * H },
      walk: null,
      plan: null,
      lastMealAt: this.t - 11 * H, lastShowerAt: this.t - 22 * H, lastTalkAt: this.t - 14 * H, lastToiletAt: this.t - 8 * H,
      leftHomeAt: null, cameHomeAt: this.t - 13 * H,
    };
    this.d = {
      stove: { on: false, dish: null, cooked: 0, state: "off" }, // off | heating | cooking | ready | burning | burnt
      kitchen_tap: false, basin_tap: false, shower: false,
      bath: { tap: false, level: 0 },
      water_on: true,   // the stopcock under the kitchen sink
      leak: false,      // a burst pipe under the basin
      plumberAt: null,
      tv: false,
      lights: Object.fromEntries(ROOM_IDS.map(r => [r, false])),
      windows: Object.fromEntries(ROOM_IDS.map(r => [r, false])),
      door: { open: false, locked: true },
      alarmClock: { at: 7.5 * H, ringing: false, since: null },
      smokeAlarm: false,
      power: true, powerBackAt: null,
      fridge: { meals: 3, snacks: 3 },
      food: null, // cooked dish waiting on the counter
      phone: { messages: [], ringing: null },
      smoke: Object.fromEntries(ROOM_IDS.map(r => [r, 0])),
      water: Object.fromEntries(ROOM_IDS.map(r => [r, 0])),
      visitor: null, doormat: null, parcelInHall: false,
      helpComing: null,
      weather: "clear",
    };
    this.pendingSounds = []; // short sounds this moment: { text, room, loud }
    this.nextVisitorAt = this.t + rand(3, 9) * H;
    this.nextWeatherAt = this.t + rand(2, 6) * H;
    this.danaCheckedDay = -1;
    this.work = { pending: [], nextAt: 0 }; // things waiting for her at the library
    this.recentEvents = []; // perceived events for the brain: { t, text }
  }

  on(fn) { this.listeners.push(fn); }
  emit(kind, text, extra = {}) {
    const e = { t: this.t, clock: clockParts(this.t).hm, kind, text, ...extra };
    this.log(kind, text, extra);
    for (const fn of this.listeners) fn(e);
    return e;
  }
  // Something she noticed: goes into her short-term memory as well as the log.
  notice(text, extra = {}) {
    this.recentEvents.push({ t: this.t, text });
    if (this.recentEvents.length > 40) this.recentEvents.shift();
    return this.emit("event", text, { noticed: true, ...extra });
  }
  // Something that happened in the world that she did not necessarily notice.
  happen(text, extra = {}) { return this.emit("world", text, extra); }

  get clock() { return clockParts(this.t); }
  get daylight() { return daylightOf(this.clock.hours); }
  get atHome() { return this.person.location === "home"; }

  // ---------- time passes ----------
  step(dt) {
    if (dt <= 0) return;
    this.t += dt;
    this.stepDevices(dt);
    this.stepBody(dt);
    this.stepOutsideEvents(dt);
    this.stepExecutor(dt);
  }

  stepDevices(dt) {
    const d = this.d, h = dt / H;
    if (d.powerBackAt && this.t >= d.powerBackAt) { d.power = true; d.powerBackAt = null; this.notice("The power came back on"); }
    const s = d.stove;
    if (s.on && d.power) {
      if (s.dish) {
        s.cooked += dt;
        const was = s.state;
        s.state = s.cooked < 2 * M ? "heating" : s.cooked < 12 * M ? "cooking" : s.cooked < 20 * M ? "ready" : s.cooked < 24 * M ? "burning" : "burnt";
        if (s.state !== was && (s.state === "burning" || s.state === "burnt")) this.happen(`The ${s.dish} on the stove is ${s.state === "burning" ? "starting to burn" : "burnt black and smoking"}`);
        if (s.cooked > 20 * M) d.smoke.kitchen = clamp(d.smoke.kitchen + (s.cooked > 24 * M ? 1.4 : 0.5) * h * 4);
      }
    }
    // Smoke drifts to the neighbouring rooms and clears slowly, fast with windows open.
    for (const door of DOORS) {
      if (door.b === "outside") continue;
      const a = d.smoke[door.a], b = d.smoke[door.b], flow = (a - b) * 3 * h;
      d.smoke[door.a] -= flow; d.smoke[door.b] += flow;
    }
    for (const r of ROOM_IDS) {
      const burning = r === "kitchen" && s.on && s.cooked > 20 * M;
      d.smoke[r] = clamp(d.smoke[r] - (d.windows[r] ? 3 : burning ? 0 : 0.25) * h);
    }
    const smokeAlarmNow = d.smoke.kitchen > 0.3 || d.smoke.hall > 0.2;
    if (smokeAlarmNow && !d.smokeAlarm) { d.smokeAlarm = true; this.notice("The smoke alarm is shrieking", { loud: true }); }
    if (!smokeAlarmNow && d.smokeAlarm && d.smoke.kitchen < 0.15) { d.smokeAlarm = false; this.notice("The smoke alarm stopped"); }
    // A burst pipe keeps pouring until the water is shut off at the stopcock.
    if (d.leak && d.water_on) d.water.bathroom = clamp(d.water.bathroom + 0.9 * h);
    // With the stopcock closed nothing runs: taps, shower and bath go dry.
    if (!d.water_on) { d.kitchen_tap = false; d.basin_tap = false; d.shower = false; d.bath.tap = false; }
    if (d.plumberAt && this.t >= d.plumberAt && !d.visitor) {
      d.plumberAt = null;
      this.arriveVisitor({ kind: "plumber", who: "the plumber", note: "a card from the plumber: 'Came by, nobody answered. Call to rebook.'", waitMinutes: 12 });
    }
    // Water: a running bath overflows onto the floor and spreads to the hall.
    if (d.bath.tap) {
      d.bath.level += dt / (11 * M);
      if (d.bath.level > 1.05) {
        if (d.water.bathroom === 0) this.happen("The bath is overflowing onto the bathroom floor");
        d.water.bathroom = clamp(d.water.bathroom + 1.6 * h);
        d.bath.level = 1.05;
      }
    }
    if (d.water.bathroom > 0.3) d.water.hall = clamp(d.water.hall + (d.water.bathroom - 0.3) * 2.5 * h);
    // Alarm clock rings at its time and keeps ringing for 30 minutes unless switched off.
    const ac = d.alarmClock, sod = this.t % 86400;
    if (ac.at != null && !ac.ringing && sod >= ac.at && sod - dt < ac.at) { ac.ringing = true; ac.since = this.t; this.notice("The alarm clock is ringing", { loud: true, room: "bedroom" }); }
    if (ac.ringing && this.t - ac.since > 30 * M) { ac.ringing = false; this.happen("The alarm clock stopped ringing by itself"); }
    if (!d.power) { d.tv = false; }
    // Help she called arrives.
    if (d.helpComing && this.t >= d.helpComing.at) this.helpArrives();
  }

  stepBody(dt) {
    const p = this.person, n = p.needs, h = dt / H, a = p.activity?.kind;
    const asleep = !p.awake;
    n.hunger = clamp(n.hunger + (asleep ? 0.02 : 0.06) * h + (a === "exercise" ? 0.08 * h : 0));
    n.bladder = clamp(n.bladder + (asleep ? 0.045 : 0.12) * h);
    n.hygiene = clamp(n.hygiene - (asleep ? 0.015 : 0.035) * h - (a === "exercise" ? 0.3 * h : 0));
    if (asleep) n.energy = clamp(n.energy + (p.sleepKind === "nap" ? 0.1 : 0.13) * h);
    else n.energy = clamp(n.energy - ({ exercise: 0.18, work: 0.07, walk: 0.08 }[a] ?? 0.055) * h);
    const boredomRate = asleep ? -0.05 : ({ watch_tv: -0.45, read: -0.4, exercise: -0.4, walk: -0.45, talk: -0.4, meet: -0.5, call: -0.4, bath: -0.3, relax: -0.08, work: 0.04, shop: -0.1, tidy: -0.12, cook: -0.1, eat: -0.1, travel: 0.03, attend: -0.2 }[a] ?? 0.12);
    n.boredom = clamp(n.boredom + boredomRate * h);
    const social = { talk: -0.9, meet: -0.8, call: -0.8, work: -0.05, attend: -0.2 }[a];
    n.loneliness = clamp(n.loneliness + (social ?? (asleep ? 0.01 : 0.04)) * h);
    if (social) p.lastTalkAt = this.t;
    p.pain = clamp(p.pain - 0.12 * h);
    // Consequences of neglect, as a body would have them.
    if (n.bladder >= 1 && p.awake) { n.bladder = 0; n.hygiene = Math.min(n.hygiene, 0.1); this.notice("Mina could not hold it any longer and wet herself"); }
    if (n.energy <= 0.02 && p.awake && !p.onFloor) {
      this.abortActivity("fell asleep");
      p.awake = false; p.sleepKind = "nap"; p.sleptAt = this.t; p.activity = { kind: "sleep", label: "dozed off", since: this.t };
      this.notice(`Mina is so exhausted she dozes off ${this.whereWords()}`);
    }
    if (!p.awake) this.stepSleep(dt);
    if (p.location === "home" && this.d.water[p.room] > 0.2 && Math.random() < dt / (20 * M)) this.notice(`Mina's feet are wet: there is water on the ${ROOMS[p.room].label.toLowerCase()} floor`);
  }

  stepSleep(dt) {
    const p = this.person, d = this.d;
    const loud = [];
    if (d.alarmClock.ringing && p.room === "bedroom") loud.push(["the alarm clock", 0.9]);
    if (d.smokeAlarm) loud.push(["the smoke alarm", 0.9]);
    if (d.visitor && this.t - d.visitor.lastRing < dt + 1) loud.push(["the doorbell", 0.8]);
    if (d.phone.ringing) loud.push(["the phone ringing", 0.5]);
    if (d.weather === "storm" && Math.random() < dt / (40 * M)) loud.push(["a crack of thunder", 0.5]);
    for (const [what, chance] of loud) {
      if (Math.random() < 1 - Math.pow(1 - chance, Math.max(1, dt / 30))) return this.wake(`woken by ${what}`);
    }
    // Rested enough: a night sleep ends in the morning light, a nap after its time.
    const h = this.clock.hours;
    if (p.sleepKind === "night" && p.needs.energy > 0.97 && h > 5 && h < 12 && Math.random() < dt / (15 * M)) return this.wake("woke up naturally, rested");
    if (p.sleepKind === "nap" && p.napUntil && this.t >= p.napUntil) return this.wake("woke from a nap");
    if (p.needs.bladder > 0.9 && Math.random() < dt / (10 * M)) return this.wake("woke needing the toilet");
    if (p.needs.hunger > 0.9 && Math.random() < dt / (30 * M)) return this.wake("woke up hungry");
  }

  wake(why) {
    const p = this.person;
    if (p.awake) return;
    p.awake = true; p.wokeAt = this.t; p.napUntil = null;
    p.activity = { kind: "idle", label: "just woke up", since: this.t };
    this.notice(`Mina ${why}`);
    const cur = p.plan?.steps[p.plan.idx];
    // Waking is its own reason to think; a sleep step ending here does not also count as "plan finished".
    if (cur && (cur.do === "sleep" || cur.do === "nap") && cur.status === "doing") { this.quietPlanEnd = true; this.finishStep(cur, why); this.quietPlanEnd = false; }
    this.emit("woke", why, { internal: true });
  }

  stepOutsideEvents(dt) {
    const d = this.d, c = this.clock;
    // Visitors ring, wait a few minutes, ring again, then leave something on the doormat.
    if (!d.visitor && this.t >= this.nextVisitorAt) {
      if (c.hours > 8.5 && c.hours < 19.5) this.arriveVisitor(pick(VISITORS));
      this.nextVisitorAt = this.t + rand(4, 11) * H;
    }
    const v = d.visitor;
    if (v && !v.answered) {
      if (this.t - v.lastRing > (v.ringEvery ?? 2.5) * M && this.t < v.leavesAt) { v.lastRing = this.t; this.ding(v); }
      if (this.t >= v.leavesAt) {
        d.doormat = v.note; if (v.kind === "courier") d.parcelOnStep = true;
        this.happen(`${cap(v.who)} gave up${v.note ? ` and left ${v.note}` : " and went away"}`);
        d.visitor = null;
      }
    }
    this.stepWork();
    // Weather.
    if (this.t >= this.nextWeatherAt) {
      const next = pick(["clear", "clear", "cloudy", "rain", "rain", "storm"]);
      if (next !== d.weather) { d.weather = next; this.notice({ clear: "The sky cleared", cloudy: "It clouded over", rain: "It started to rain", storm: "A storm rolled in: wind, rain and thunder" }[next]); }
      this.nextWeatherAt = this.t + rand(2, 7) * H;
    }
    // Work notices if she does not turn up on a weekday and has not said anything.
    const weekday = c.day % 7 < 5;
    if (weekday && c.hours > 12.6 && c.hours < 13 && this.danaCheckedDay !== c.day) {
      this.danaCheckedDay = c.day;
      const atWork = this.person.place === "library" || this.person.travel?.to === "library";
      const toldWork = this.person.messagesToday?.dana === c.day;
      if (!atWork && !toldWork) this.receiveMessage("dana", "Morning Mina, are you coming in today? The desk is busy.");
    }
  }

  // Work life: while she is at the library during opening hours, ordinary things come up every so often.
  stepWork() {
    const p = this.person, w = this.work, h = this.clock.hours;
    const atWork = p.location === "away" && p.place === "library";
    if (!atWork) { w.pending = []; w.nextAt = 0; return; }
    if (!w.nextAt) w.nextAt = this.t + rand(20, 45) * M;
    if (this.t >= w.nextAt && h >= 12 && h < 18 && w.pending.length < 2) {
      const busy = new Set(w.pending.map(e => e.kind));
      const choices = WORK_EVENTS.filter(e => !busy.has(e.kind));
      const e = pick(choices);
      w.pending.push({ ...e, since: this.t });
      this.notice(`At work: ${e.text}`, { story: true });
      w.nextAt = this.t + rand(35, 80) * M;
    }
    for (const e of [...w.pending]) {
      if (e.handling || this.t - e.since < e.patience * M) continue;
      w.pending = w.pending.filter(x => x !== e);
      this.notice(e.ignored, { story: true });
    }
  }

  arriveVisitor(v) {
    this.d.visitor = { ...v, arrivedAt: this.t, lastRing: this.t, leavesAt: this.t + (v.waitMinutes ?? rand(6, 9)) * M, answered: false };
    this.happen(`${cap(v.who)} is at the front door`);
    this.ding(this.d.visitor);
  }
  ding(v) {
    const p = this.person;
    if (p.location === "home") this.notice("The doorbell rang", { loud: true });
    else this.happen("The doorbell rang in the empty house");
    v.lastRing = this.t;
  }

  receiveMessage(from, text) {
    const c = CONTACTS[from];
    const name = c ? c.name : from;
    this.d.phone.messages.push({ from, name, text, t: this.t, read: false });
    if (this.d.phone.messages.length > 30) this.d.phone.messages.shift();
    this.person.needs.loneliness = clamp(this.person.needs.loneliness - 0.06);
    this.person.lastContactAt = this.t;
    this.notice(`Her phone buzzed: a message from ${name}`, { message: { from: name, text } });
  }

  // A friend or relative said they would come round; they arrive, text, and ring.
  friendArrives(id, name) {
    if (this.d.visitor) return false;
    this.arriveVisitor({ kind: "friend", id, who: name, note: `a note from ${name}: 'Came round, no answer. Call me!'`, waitMinutes: 15 });
    this.receiveMessage(id, "I'm at your door!");
    return true;
  }

  helpArrives() {
    const d = this.d, h = d.helpComing; d.helpComing = null;
    this.notice(`${h.who} arrived at the door`);
    if (d.smoke.kitchen > 0.05 || d.stove.state === "burnt" || d.stove.state === "burning") {
      d.stove.on = false; d.stove.state = "off"; d.stove.dish = null; d.stove.cooked = 0;
      for (const r of ROOM_IDS) { d.smoke[r] = 0; d.windows[r] = true; }
      this.notice("The firefighters switched off the stove, cleared the smoke and opened the windows");
    }
    if (this.person.onFloor || this.person.pain > 0.3) {
      this.person.pain = 0.15; this.person.onFloor = false;
      this.notice("The paramedics checked Mina over, strapped her ankle and helped her onto the sofa");
      const s = SPOTS.sofa.at; this.person.x = s[0]; this.person.y = s[1]; this.person.room = "living";
    }
    d.door.open = false; d.door.locked = false;
  }

  // ---------- pokes: the viewer changes the world, never Mina ----------
  poke(kind, arg) {
    const d = this.d, p = this.person;
    switch (kind) {
      case "doorbell": {
        const h = this.clock.hours;
        if (d.visitor) this.ding(d.visitor);
        else if (h < 8 || h > 21) this.arriveVisitor(NIGHT_CALLER);
        else this.arriveVisitor(pick(VISITORS));
        return "Someone rings the doorbell.";
      }
      case "text": {
        const text = String(arg || "").slice(0, 200).trim();
        if (!text) return null;
        this.receiveMessage("unknown", text); return "A text arrives from an unknown number.";
      }
      case "power": d.power = false; d.powerBackAt = this.t + rand(40, 90) * M; for (const r of ROOM_IDS) d.lights[r] = false; this.notice("The power went out: lights, TV and stove are dead"); return "Power cut.";
      case "leak": d.leak = true; d.water.bathroom = clamp(d.water.bathroom + 0.15); this.notice("A pipe under the basin burst: water is spraying out and spreading over the bathroom floor"); return "A pipe bursts in the bathroom.";
      case "fall": {
        if (p.location !== "home" || !p.awake) return null;
        this.abortActivity("fell");
        p.onFloor = true; p.pain = 0.8;
        p.activity = { kind: "floor", label: "on the floor, hurt", since: this.t };
        this.notice(`Mina tripped and fell hard ${this.whereWords()}. Her ankle hurts badly`);
        return "Mina trips and falls.";
      }
      case "storm": d.weather = "storm"; this.nextWeatherAt = this.t + rand(2, 4) * H; this.notice("A storm rolled in: wind, rain and thunder"); return "A storm arrives.";
      case "leyla": case "sam": return null; // handled by contacts
    }
    return null;
  }

  // ---------- senses: what she can perceive right now ----------
  whereWords() {
    const p = this.person;
    if (p.location === "away") return PLACES[p.place].short;
    if (p.location === "travelling") return p.travel.to === "home" ? "on the way home" : `on the way to ${PLACES[p.travel.to].label}`;
    if (p.location === "outside") return "outside the house";
    return `in the ${ROOMS[p.room].label.toLowerCase()}`;
  }

  // Rooms one doorway away.
  adjacent(room) { return DOORS.filter(d => d.a === room || d.b === room).map(d => d.a === room ? d.b : d.a).filter(r => r !== "outside"); }

  senses() {
    const p = this.person, d = this.d, awake = p.awake;
    const see = [], hear = [], smell = [], feel = [];
    const here = p.location === "home" ? p.room : null;
    const roomName = (r) => ROOMS[r].label.toLowerCase();
    const from = (r) => r === here ? "" : ` from the ${roomName(r)}`;
    const audible = (r, loud) => loud || r === here || (here && this.adjacent(here).includes(r)) || (p.location === "outside" && r === "hall");
    const soundAt = (r, text, loud = false) => { if (p.location === "home" || p.location === "outside") { if ((awake || loud) && audible(r, loud)) hear.push(text + from(r)); } };
    if (p.location === "home" || p.location === "outside") {
      if (d.tv) soundAt("living", "the TV");
      if (d.kitchen_tap) soundAt("kitchen", "the kitchen tap running");
      if (d.basin_tap) soundAt("bathroom", "the basin tap running");
      if (d.shower) soundAt("bathroom", "the shower running");
      if (d.bath.tap) soundAt("bathroom", "the bath tap running");
      if (d.leak && d.water_on) soundAt("bathroom", "water hissing and spraying");
      if (d.stove.on && d.stove.dish && ["cooking", "ready", "burning"].includes(d.stove.state)) soundAt("kitchen", "sizzling on the stove");
      if (d.alarmClock.ringing) soundAt("bedroom", "the alarm clock ringing", true);
      if (d.smokeAlarm) hear.push("the smoke alarm shrieking");
      if (d.visitor && this.t - d.visitor.lastRing < 90) hear.push("the doorbell ringing");
      if (d.visitor && p.location === "outside") see.push(`${d.visitor.who} at the front door`);
      if (d.weather === "rain") hear.push("rain on the windows");
      if (d.weather === "storm") hear.push("wind and thunder outside");
      if (d.phone.ringing) hear.push("her phone ringing");
      // Smell carries through the house.
      for (const r of ROOM_IDS) {
        const sm = d.smoke[r];
        if (sm > 0.05 && (r === here || (here && this.adjacent(here).includes(r)) || sm > 0.3)) smell.push(`${sm > 0.4 ? "thick smoke" : sm > 0.15 ? "smoke" : "a burning smell"}${from(r)}`);
      }
      if (d.stove.state === "cooking" && (here === "kitchen" || here === "dining")) smell.push(`${d.stove.dish} cooking`);
      if (d.stove.state === "ready" && (here === "kitchen" || here === "dining")) smell.push(`${d.stove.dish}, done and still on the heat`);
    }
    if (awake && here) {
      const dark = !d.lights[here] && this.daylight.level < 0.3;
      see.push(dark ? `the ${roomName(here)}, dark` : `the ${roomName(here)}${d.lights[here] ? ", light on" : ""}`);
      if (here === "kitchen") {
        if (d.stove.on) see.push(`the stove on${d.stove.dish ? ` with ${d.stove.dish} (${d.stove.state})` : ", nothing on it"}`);
        if (d.food) see.push(`${d.food} ready on a plate`);
        if (d.kitchen_tap) see.push("the kitchen tap running");
      }
      if (here === "bathroom") {
        if (d.bath.tap || d.bath.level > 0.1) see.push(`the bath ${d.bath.level > 1 ? "overflowing" : d.bath.level > 0.8 ? "full" : "filling"}${d.bath.tap ? ", tap running" : ""}`);
        if (d.basin_tap) see.push("the basin tap running");
        if (d.leak) see.push(d.water_on ? "water spraying from a burst pipe under the basin" : "a burst pipe under the basin, dripping (water shut off)");
      }
      if (here === "living" && d.tv) see.push("the TV on");
      if (here === "hall") {
        if (d.door.open) see.push("the front door standing open");
        if (d.doormat) see.push(`on the doormat: ${d.doormat}`);
        if (d.parcelInHall) see.push("a parcel in the hall");
      }
      if (d.water[here] > 0.05) see.push(`water on the floor (${d.water[here] > 0.5 ? "deep" : "a puddle"})`);
      if (d.smoke[here] > 0.1) see.push("smoke in the air");
      const litElsewhere = ROOM_IDS.filter(r => r !== here && d.lights[r]);
      if (litElsewhere.length && this.adjacent(here).some(r => litElsewhere.includes(r))) see.push(`light on in the ${this.adjacent(here).filter(r => litElsewhere.includes(r)).map(roomName).join(" and ")}`);
      if (!d.power) see.push("no power: lights and appliances dead");
      if (!d.water_on && (here === "kitchen" || here === "bathroom")) see.push("the water is shut off at the stopcock");
      if (d.windows[here]) see.push("windows open");
    }
    if (p.location === "away") see.push(PLACE_SENSES[p.place]);
    // Something she is already dealing with is what she is doing, not something waiting for her.
    if (p.location === "away") for (const e of this.work.pending.filter(x => !x.handling)) (e.kind === "phone" ? hear : see).push(`${e.text} (for ${Math.max(1, Math.round((this.t - e.since) / M))} min)`);
    if (p.location === "travelling") see.push(p.travel.to === "home" ? "the bus home" : "the bus through town");
    if (p.pain > 0.1) feel.push(p.pain > 0.6 ? "sharp pain in her ankle" : p.pain > 0.3 ? "her ankle aching" : "a dull ache in her ankle");
    if (p.onFloor) feel.push("lying on the floor");
    if (here && d.water[here] > 0.2) feel.push("wet feet");
    if (here && d.door.open && this.daylight.level < 0.5) feel.push("a cold draught from the open front door");
    if (!awake) return { asleep: true, hear, smell: smell.filter(s => s.startsWith("thick")), feel: [] };
    return { see, hear: [...new Set(hear)], smell: [...new Set(smell)], feel };
  }

  phoneView() {
    const unread = this.d.phone.messages.filter(m => !m.read).map(m => ({ from: m.name, sent: ago(this.t - m.t), text: m.text }));
    const lastOut = [...(this.person.outbox ?? [])].slice(-3).map(m => ({ to: m.name, sent: ago(this.t - m.t), text: m.text }));
    return { unread, recently_sent: lastOut };
  }

  // Where she can be and what the body can do from here: the brain reads this.
  situation() {
    const p = this.person, d = this.d;
    return {
      location: p.location, where: this.whereWords(), room: p.location === "home" ? p.room : null, place: p.place,
      fridge: `${this.d.fridge.meals} meals' worth of ingredients, ${this.d.fridge.snacks} snacks`,
      food_ready: this.d.food,
      front_door: `${this.d.door.open ? "open" : "closed"}, ${this.d.door.locked ? "locked" : "unlocked"}`,
      alarm_clock: this.d.alarmClock.at != null ? `set for ${fmtSod(this.d.alarmClock.at)}${this.d.alarmClock.ringing ? ", RINGING" : ""}` : "not set",
      devices_on: this.devicesOn(),
      water_supply: d.water_on ? "on" : "shut off at the stopcock",
      waiting_for_her_here: this.work.pending.filter(e => !e.handling).map(e => e.text),
    };
  }
  devicesOn() {
    const d = this.d, on = [];
    if (d.stove.on) on.push(`stove${d.stove.dish ? ` (${d.stove.dish}, ${d.stove.state})` : ""}`);
    if (d.kitchen_tap) on.push("kitchen tap");
    if (d.basin_tap) on.push("basin tap");
    if (d.shower) on.push("shower");
    if (d.bath.tap) on.push("bath tap");
    if (d.tv) on.push("TV");
    const lit = ROOM_IDS.filter(r => d.lights[r]);
    if (lit.length) on.push(`lights in ${lit.map(r => ROOMS[r].label.toLowerCase()).join(", ")}`);
    return on;
  }

  // ---------- the body carries out a plan ----------
  // A new plan replaces the old one. Whatever the old step left running keeps running.
  setPlan(plan, { finishCurrent = false } = {}) {
    const p = this.person;
    const cur = p.plan?.steps[p.plan.idx];
    if (finishCurrent && cur && cur.status === "doing") {
      // Keep going with what she is doing; the new steps follow it.
      for (const s of p.plan.steps) if (s.status === "pending") s.status = "dropped";
      const done = p.plan.steps.filter((s, i) => i < p.plan.idx);
      p.plan = { ...plan, steps: [...done, cur, ...plan.steps.map(s => ({ ...s, status: "pending" }))], idx: done.length, startedAt: this.t };
      return;
    }
    if (p.plan) {
      const cur = p.plan.steps[p.plan.idx];
      if (cur && cur.status === "doing") { this.abortActivity("changed plan"); cur.status = "dropped"; }
      for (const s of p.plan.steps) if (s.status === "pending") s.status = "dropped";
    }
    p.plan = { ...plan, idx: 0, startedAt: this.t };
    for (const s of p.plan.steps) s.status = "pending";
    this.startStep();
  }

  // Leave the current activity the way a person leaves it when interrupted: things keep running.
  abortActivity(why) {
    const p = this.person, a = p.activity;
    p.walk = null;
    if (!a) return;
    if (a.kind === "shower" && this.d.shower) { this.d.shower = false; this.emit("act", "turns off the shower and gets out"); }
    if (a.kind === "cook" && this.d.stove.on) this.happen(`The stove was left on with ${this.d.stove.dish} (${why})`);
    if (a.kind === "watch_tv" && this.d.tv) this.happen("The TV was left on");
    if (a.kind === "bath" && this.d.bath.tap) this.happen("The bath tap was left running");
    if (a.kind === "wash_dishes" && this.d.kitchen_tap) this.happen("The kitchen tap was left running");
    if (a.kind === "freshen_up" && this.d.basin_tap) this.happen("The basin tap was left running");
    p.activity = { kind: "idle", label: "", since: this.t };
  }

  currentStep() { const p = this.person.plan; return p ? p.steps[p.idx] : null; }

  startStep() {
    const plan = this.person.plan;
    if (!plan) return;
    const step = plan.steps[plan.idx];
    if (!step) {
      this.person.activity = { kind: "idle", label: this.person.onFloor ? "on the floor" : "", since: this.t };
      plan.finishedAt = this.t;
      if (!this.quietPlanEnd) this.emit("plan_done", `finished: ${plan.decision}`, { internal: true });
      return;
    }
    step.status = "doing"; step.startedAt = this.t;
    const err = this.beginAction(step);
    if (err) this.failStep(step, err);
  }

  failStep(step, why) {
    step.status = "failed"; step.note = why;
    const p = this.person;
    for (const s of p.plan.steps) if (s.status === "pending") s.status = "dropped";
    p.walk = null;
    p.activity = { kind: "idle", label: p.onFloor ? "on the floor" : "", since: this.t };
    this.emit("fail", `could not ${describeStep(step)}: ${why}`, { story: true });
    this.recentEvents.push({ t: this.t, text: `Tried to ${describeStep(step)} but ${why}` });
    this.emit("step_failed", why, { internal: true, step });
  }

  finishStep(step, note) {
    step.status = "done"; step.note = note || step.note;
    const p = this.person;
    if (p.activity && p.activity.kind !== "sleep") p.activity = { kind: "idle", label: "", since: this.t };
    p.plan.idx++;
    this.startStep();
  }

  // Walk to a spot at home, then run `then`. Returns an error string if the body cannot get there.
  walkTo(spotId, then, label) {
    const p = this.person;
    const s = SPOTS[spotId];
    if (p.location !== "home") return `she is ${this.whereWords()}, not at home`;
    const pts = pathBetween(p.room, p.x, p.y, s.room, s.at[0], s.at[1]);
    if (!pts) return "no way through";
    // Hurt and on the floor, she can still drag herself along, slowly.
    const crawl = p.onFloor;
    p.walk = { pts, then, target: s.room, speed: crawl ? 0.2 : WALK_SPEED };
    p.activity = { kind: "walk", label: crawl ? `crawling to the ${s.label}` : label || `going to the ${s.label}`, since: this.t };
    return null;
  }

  stepExecutor(dt) {
    const p = this.person;
    if (p.walk) return this.stepWalk(dt);
    if (p.location === "travelling") return this.stepTravel();
    const a = p.activity, step = this.currentStep();
    if (!a || !step || step.status !== "doing") return;
    if (a.until && this.t >= a.until) { const done = a.onDone; a.until = null; if (done) done(); else this.finishStep(step); return; }
    if (a.tick) a.tick(dt);
  }

  stepWalk(dt) {
    const p = this.person, w = p.walk;
    let budget = (w.speed ?? WALK_SPEED) * dt;
    while (budget > 0 && w.pts.length) {
      const [tx, ty] = w.pts[0];
      const dx = tx - p.x, dy = ty - p.y, dd = Math.hypot(dx, dy);
      if (dd > 1e-6) p.facing = Math.atan2(dx, dy);
      if (dd <= budget) { p.x = tx; p.y = ty; budget -= dd; w.pts.shift(); }
      else { p.x += dx / dd * budget; p.y += dy / dd * budget; budget = 0; }
      const r = roomAt(p.x, p.y);
      if (r !== "outside" && r !== p.room) { p.room = r; this.enteredRoom(r); }
    }
    if (!w.pts.length) { p.walk = null; w.then?.(); }
  }

  // Lights are her choice alone: no habit switches them for her.
  enteredRoom(r) {}

  stepTravel() {
    const p = this.person, tr = p.travel;
    if (this.t < tr.arrive) return;
    if (tr.to === "home") {
      p.location = "outside"; p.travel = null; p.place = null;
      [p.x, p.y] = OUTSIDE.bus_stop;
      this.emit("act", "gets off the bus near home", { story: true });
      const pts = [OUTSIDE.pavement, OUTSIDE.gate, OUTSIDE.porch];
      p.walk = { pts: pts.map(q => [...q]), then: () => this.enterHome() };
      p.activity = { kind: "walk", label: "walking up to the house", since: this.t };
    } else {
      p.location = "away"; p.place = tr.to; p.travel = null;
      this.notice(`Mina arrived ${PLACES[tr.to].short.replace(/^at /, "at ")}`, { story: true });
      this.finishStep(this.currentStep(), "arrived");
    }
  }

  enterHome() {
    const p = this.person, d = this.d;
    if (d.visitor && !d.visitor.answered) { this.meetVisitor(); }
    if (d.doormat) { this.notice(`Mina found ${d.doormat}`); d.doormat = null; }
    if (d.parcelOnStep) { d.parcelOnStep = false; d.parcelInHall = true; this.notice("Mina found a parcel on the step and brought it in"); }
    if (d.door.locked) { d.door.locked = false; this.emit("act", "unlocks the front door with her key"); }
    d.door.open = true;
    p.location = "home"; p.room = "hall"; p.cameHomeAt = this.t;
    const pts = [[6.5, 0.2], SPOTS.front_door.at];
    p.walk = { pts: pts.map(q => [...q]), then: () => { d.door.open = false; this.emit("act", "is home and closes the door behind her", { story: true }); this.finishStep(this.currentStep(), "home"); } };
    this.enteredRoom("hall");
  }

  meetVisitor() {
    const d = this.d, v = d.visitor;
    v.answered = true;
    if (v.kind === "courier") { d.parcelInHall = true; this.notice("The courier handed Mina a parcel"); d.visitor = null; return null; }
    if (v.kind === "plumber") { this.notice("The plumber is at the door, here for the burst pipe"); return v; }
    if (v.kind === "stranger") { this.notice("A man at the door, looking for number 14, apologised for the hour and left"); d.visitor = null; return null; }
    if (v.kind === "friend") {
      this.notice(`${v.who} is at the door`);
      if (this.person.onFloor) {
        this.person.onFloor = false; this.person.pain = clamp(this.person.pain - 0.1);
        const s = SPOTS.sofa.at; this.person.x = s[0]; this.person.y = s[1]; this.person.room = "living";
        this.notice(`${v.who} helped Mina up off the floor and onto the sofa, and put her foot up`);
      }
      return v;
    }
    this.notice(`${cap(v.who)} is at the door and wants a quick chat`);
    return v;
  }

  // Start the body on one step. Returns an error string when the body cannot do it here and now.
  beginAction(step) {
    const p = this.person, d = this.d, act = step.do;
    const home = p.location === "home", away = p.location === "away";
    const mins = (def, lo = 1, hi = 600) => clamp(Math.round(step.minutes ?? def), lo, hi) * M;
    const doing = (kind, label, extra = {}) => { p.activity = { kind, label, since: this.t, ...extra }; };
    const at = (spot, fn, label) => this.walkTo(spot, fn, label);
    const done = (note) => this.finishStep(step, note);
    if (!p.awake && !["sleep", "nap"].includes(act)) return "she is asleep";
    if (p.onFloor && !["get_up", "call", "message", "check_phone", "call_emergency", "wait", "relax", "sleep", "nap", "go_to", "answer_door", "unlock_door", "lock_door"].includes(act)) return "she is on the floor and has to get up first (she can only crawl, phone, or open the front door from the floor)";
    if (p.location === "travelling" && !["message", "call", "check_phone", "wait", "read", "set_alarm", "relax"].includes(act)) return "she is on the bus";
    if (p.location === "outside" && !["message", "call", "check_phone", "wait", "lock_door", "unlock_door", "go_out", "answer_door", "come_home"].includes(act)) {
      // Standing in the garden: anything else happens indoors, so go back in first.
      return "she is outside the house; she would have to go back in (come_home) first";
    }
    const needHome = (what) => home ? null : `she is ${this.whereWords()}; ${what} needs her to be at home`;
    switch (act) {
      case "go_to": {
        const room = normRoom(step.where);
        if (!room) return `"${step.where}" is not a room in the house`;
        return needHome("walking to a room") || at(ROOM_CENTRE[room], () => done(), `going to the ${ROOMS[room].label.toLowerCase()}`);
      }
      case "cook": {
        const e = needHome("cooking"); if (e) return e;
        if (!d.power) return "the power is out, so the electric stove does not work";
        if (d.fridge.meals <= 0) return "the fridge has no ingredients for a meal (she would need to shop)";
        if (d.stove.on && d.stove.dish) return `the stove is already busy with ${d.stove.dish}`;
        const dish = (step.what || "a simple dinner").slice(0, 60);
        return at("stove", () => {
          d.fridge.meals--; d.stove.on = true; d.stove.dish = dish; d.stove.cooked = 0; d.stove.state = "heating";
          this.emit("act", `starts cooking ${dish}`, { story: true });
          doing("cook", `cooking ${dish}`, {
            tick: () => {
              if (!d.stove.on || d.stove.dish !== dish) return this.failStep(step, "the stove went off");
              if (d.stove.state === "ready") {
                d.stove.on = false; d.food = dish; d.stove.dish = null; d.stove.state = "off"; d.stove.cooked = 0;
                this.emit("act", `turns off the stove; ${dish} is ready`, { story: true });
                done("ready");
              }
            },
          });
        }, "going to the stove");
      }
      case "eat": {
        if (away) { doing("eat", `eating ${step.what || "something"} ${PLACES[p.place].short}`, { until: this.t + mins(20, 5, 60), onDone: () => { this.ate(0.6); done(); } }); return null; }
        const e = needHome("eating that"); if (e) return e;
        if (d.food) {
          const dish = d.food;
          return at("kitchen_mid", () => { d.food = null; at("table", () => { doing("eat", `eating ${dish}`, { until: this.t + mins(15, 8, 45), onDone: () => { this.ate(0.62); this.emit("act", `finished eating ${dish}`, { story: true }); done(); } }); }, "carrying the plate to the table"); }, "fetching the food");
        }
        if (d.fridge.snacks > 0) return at("fridge", () => { d.fridge.snacks--; doing("eat", "eating a snack from the fridge", { until: this.t + 5 * M, onDone: () => { this.ate(0.25); done("snack"); } }); }, "going to the fridge");
        return d.fridge.meals > 0 ? "nothing is cooked and there are no snacks; the fridge has ingredients to cook" : "there is nothing to eat in the house";
      }
      case "drink": {
        const what = step.what || "tea";
        if (!home) { doing("drink", `having ${what}`, { until: this.t + 10 * M, onDone: () => { p.needs.energy = clamp(p.needs.energy + 0.04); done(); } }); return null; }
        return at("kettle", () => doing("drink", `making ${what}`, { until: this.t + 6 * M, onDone: () => { p.needs.energy = clamp(p.needs.energy + 0.04); this.emit("act", `drinks ${what}`); done(); } }));
      }
      case "shower": {
        const e = needHome("a shower"); if (e) return e;
        if (!d.water_on) return "the water is shut off at the stopcock";
        return at("bathtub", () => { d.shower = true; doing("shower", "in the shower", { until: this.t + mins(12, 5, 30), onDone: () => { d.shower = false; p.needs.hygiene = 1; p.lastShowerAt = this.t; this.emit("act", "finished her shower", { story: true }); done(); } }); });
      }
      case "bath": {
        const e = needHome("a bath"); if (e) return e;
        if (!d.water_on) return "the water is shut off at the stopcock";
        const soak = mins(25, 10, 90);
        return at("bathtub", () => {
          d.bath.tap = true; d.bath.level = Math.max(d.bath.level, 0);
          doing("bath", "running a bath", {
            tick: () => {
              if (d.bath.level >= 0.9 && d.bath.tap) {
                d.bath.tap = false;
                p.activity = { kind: "bath", label: "soaking in the bath", since: this.t, until: this.t + soak, onDone: () => { d.bath.level = 0; p.needs.hygiene = 1; p.lastShowerAt = this.t; p.needs.boredom = clamp(p.needs.boredom - 0.2); this.emit("act", "got out of the bath", { story: true }); done(); } };
              }
            },
          });
        });
      }
      case "toilet": {
        if (!home) { doing("toilet", "in the toilets", { until: this.t + 5 * M, onDone: () => { p.needs.bladder = 0; done(); } }); return null; }
        return at("toilet", () => doing("toilet", "on the toilet", { until: this.t + 4 * M, onDone: () => { p.needs.bladder = 0; p.lastToiletAt = this.t; done(); } }));
      }
      case "freshen_up": {
        const e = needHome("the basin"); if (e) return e;
        if (!d.water_on) return "the water is shut off at the stopcock";
        return at("basin", () => { d.basin_tap = true; doing("freshen_up", "washing her face, brushing teeth", { until: this.t + 5 * M, onDone: () => { d.basin_tap = false; p.needs.hygiene = clamp(p.needs.hygiene + 0.12); done(); } }); });
      }
      case "wash_dishes": {
        const e = needHome("washing up"); if (e) return e;
        if (!d.water_on) return "the water is shut off at the stopcock";
        return at("kitchen_sink", () => { d.kitchen_tap = true; doing("wash_dishes", "washing up", { until: this.t + mins(10, 5, 30), onDone: () => { d.kitchen_tap = false; done(); } }); });
      }
      case "sleep": {
        const e = needHome("going to bed"); if (e) return e;
        return at("bed", () => {
          const alarm = parseHM(step.until);
          if (alarm != null) d.alarmClock.at = alarm;
          if (d.alarmClock.ringing) d.alarmClock.ringing = false;
          p.awake = false; p.sleepKind = "night"; p.sleptAt = this.t;
          doing("sleep", "asleep");
          this.notice(`Mina went to sleep${alarm != null ? ` with the alarm set for ${step.until}` : ""}`, { story: true });
          this.emit("sleep_started", "", { internal: true });
        }, "going to bed");
      }
      case "nap": {
        const e = needHome("a nap"); if (e) return e;
        const spot = normRoom(step.where) === "bedroom" ? "bed" : "sofa";
        const len = mins(30, 10, 180);
        return at(spot, () => { p.awake = false; p.sleepKind = "nap"; p.sleptAt = this.t; p.napUntil = this.t + len; doing("sleep", "napping"); this.emit("act", `lies down for a nap on the ${SPOTS[spot].label}`, { story: true }); }, "lying down");
      }
      case "watch_tv": {
        const e = needHome("the TV"); if (e) return e;
        if (!d.power) return "the power is out";
        return at("sofa", () => { d.tv = true; doing("watch_tv", `watching ${step.what || "TV"}`, { until: this.t + mins(45, 10, 240), onDone: () => { d.tv = false; this.emit("act", "switches the TV off"); done(); } }); });
      }
      case "read": {
        const label = `reading${step.what ? ` ${step.what}` : ""}`;
        if (!home) { doing("read", label, { until: this.t + mins(40, 5, 240) }); return null; }
        return at("armchair", () => doing("read", label, { until: this.t + mins(40, 5, 240) }));
      }
      case "relax": {
        if (!home) { doing("relax", "taking it easy", { until: this.t + mins(20, 5, 180) }); return null; }
        if (p.onFloor) { doing("relax", "lying still on the floor", { until: this.t + mins(20, 5, 180) }); return null; }
        return at("sofa", () => doing("relax", "resting on the sofa", { until: this.t + mins(20, 5, 180) }));
      }
      case "exercise": {
        if (away && p.place !== "gym" && p.place !== "park") return `she is ${this.whereWords()}; exercise needs home, the park or the gym`;
        if (away) { doing("exercise", `working out ${PLACES[p.place].short}`, { until: this.t + mins(45, 10, 120) }); return null; }
        return at("living_mid", () => doing("exercise", "doing yoga on the living room floor", { until: this.t + mins(30, 10, 90) }));
      }
      case "tidy": {
        const e = needHome("tidying"); if (e) return e;
        const room = normRoom(step.where) || p.room;
        return at(ROOM_CENTRE[room], () => {
          doing("tidy", `tidying the ${ROOMS[room].label.toLowerCase()}`, { until: this.t + mins(20, 5, 90), onDone: () => { if (room === "hall" && d.parcelInHall) { d.parcelInHall = false; this.emit("act", "opens the parcel and puts things away"); } done(); } });
        });
      }
      case "work": {
        if (p.place !== "library") return `she can only work at the library; she is ${this.whereWords()}`;
        doing("work", "working at the library", { until: this.t + mins(120, 15, 300) });
        return null;
      }
      case "shop": {
        if (p.place !== "shop") return `she is ${this.whereWords()}, not at the shop`;
        doing("shop", "buying groceries", { until: this.t + mins(20, 10, 60), onDone: () => { d.fridge.meals += 5; d.fridge.snacks += 4; this.emit("act", "bought groceries (5 meals, snacks)", { story: true }); done(); } });
        return null;
      }
      case "meet": {
        if (!away) return "meeting someone needs her to be out, somewhere they are";
        const who = contactName(step.who) || step.who || "a friend";
        doing("meet", `spending time with ${who}`, { until: this.t + mins(60, 15, 240), onDone: () => { p.lastTalkAt = this.t; done(); } });
        return null;
      }
      case "walk": {
        if (!away) return "a walk means going out (go_out to the park, for example)";
        doing("walk", `walking ${PLACES[p.place].short}`, { until: this.t + mins(30, 10, 120) });
        return null;
      }
      case "message": {
        const id = contactId(step.who);
        if (!id) return `she has no number for "${step.who}"`;
        const text = String(step.text || "").slice(0, 280) || "Hi";
        doing("message", `texting ${CONTACTS[id]?.name ?? id}`, { until: this.t + 2 * M, onDone: () => { this.sendMessage(id, text); done(); } });
        return null;
      }
      case "call": {
        const id = contactId(step.who);
        if (!id || id === "unknown") return `she has no number for "${step.who}"`;
        if (id === "plumber") {
          doing("call", "phoning a plumber", { until: this.t + 5 * M, onDone: () => {
            d.plumberAt = this.t + rand(100, 160) * M;
            this.notice(`A plumber said they can come at about ${clockParts(d.plumberAt).hm}`);
            done();
          } });
          return null;
        }
        const len = mins(10, 2, 90);
        doing("call", `phoning ${CONTACTS[id].name}…`, { waitingFor: id });
        this.emit("call_request", CONTACTS[id].name, { internal: true, who: id, minutes: len / M, step });
        return null;
      }
      case "check_phone": {
        doing("check_phone", "reading her messages", { until: this.t + 2 * M, onDone: () => { const n = this.readMessages(); this.emit("act", n ? `read ${n} message${n > 1 ? "s" : ""}` : "checked her phone: nothing new"); done(); } });
        return null;
      }
      case "set_alarm": {
        const at2 = parseHM(step.until);
        if (at2 == null) return `"${step.until}" is not a time like 07:00`;
        d.alarmClock.at = at2; this.emit("act", `sets the alarm for ${step.until}`); done(); return null;
      }
      case "go_out": {
        const to = normPlace(step.where);
        if (!to) return `"${step.where}" is not a place she can go (${Object.keys(PLACES).join(", ")})`;
        if (p.location === "away" && p.place === to) return `she is already ${PLACES[to].short}`;
        if (p.location === "away") { p.location = "travelling"; p.travel = { to, arrive: this.t + PLACES[to].travel * M, from: p.place }; p.place = null; doing("travel", `on the way to ${PLACES[to].label}`); this.emit("act", `heads to ${PLACES[to].label}`, { story: true }); return null; }
        const leave = () => {
          if (d.door.locked) { d.door.locked = false; }
          d.door.open = true;
          p.location = "outside"; p.leftHomeAt = this.t;
          this.emit("act", `leaves the house for ${PLACES[to].label}`, { story: true });
          p.activity = { kind: "walk", label: `leaving for ${PLACES[to].label}`, since: this.t };
          p.walk = {
            pts: [[6.5, -0.4], [...OUTSIDE.porch]],
            then: () => {
              // Pull the door shut on the way out; locking it is her choice.
              d.door.open = false;
              if (step.lock_door) { d.door.locked = true; this.emit("act", "locks the front door behind her"); }
              else this.emit("act", "pulls the front door shut without locking it");
              p.walk = {
                pts: [OUTSIDE.gate, OUTSIDE.pavement, OUTSIDE.bus_stop].map(q => [...q]),
                then: () => {
                  p.location = "travelling"; p.travel = { to, arrive: this.t + PLACES[to].travel * M }; doing("travel", `on the bus to ${PLACES[to].label}`);
                  this.emit("act", `takes the bus to ${PLACES[to].label}`);
                },
              };
            },
          };
        };
        if (p.location === "outside") { leave(); return null; }
        return at("front_door", leave, "going to the front door");
      }
      case "come_home": {
        if (p.location === "home") return "she is already at home";
        if (p.location === "outside") { p.walk = { pts: [[...OUTSIDE.porch]], then: () => this.enterHome() }; doing("walk", "going back inside"); return null; }
        const from = p.place;
        p.location = "travelling"; p.travel = { to: "home", arrive: this.t + (PLACES[from]?.travel ?? 20) * M, from }; p.place = null;
        doing("travel", "on the way home");
        this.emit("act", `heads home from ${PLACES[from]?.label ?? "town"}`, { story: true });
        return null;
      }
      case "turn_off": case "turn_on": {
        const dev = DEVICE_ALIASES[String(step.what || "").toLowerCase().trim()];
        if (!dev) return `"${step.what}" is not something she can switch`;
        const e = needHome(`switching ${DEVICE_LABEL[dev]}`); if (e) return e;
        const on = act === "turn_on";
        if (dev === "lights") {
          const room = normRoom(step.where) || p.room;
          if (on && !d.power) return "the power is out";
          return at(ROOM_CENTRE[room], () => { d.lights[room] = on; this.emit("act", `turns the ${ROOMS[room].label.toLowerCase()} light ${on ? "on" : "off"}`); done(); });
        }
        if (on && dev !== "tv" && dev !== "stopcock") return `she only turns ${DEVICE_LABEL[dev]} on as part of doing something`;
        return at(DEVICE_SPOT[dev], () => {
          if (dev === "stove") { if (d.stove.dish && ["ready", "cooking"].includes(d.stove.state)) d.food = d.stove.dish; d.stove.on = false; d.stove.dish = null; d.stove.state = "off"; d.stove.cooked = 0; }
          else if (dev === "bath_tap") d.bath.tap = false;
          else if (dev === "tv") d.tv = on;
          else if (dev === "alarm_clock") d.alarmClock.ringing = false;
          else if (dev === "stopcock") d.water_on = on;
          else d[dev] = false;
          this.emit("act", `turns ${DEVICE_LABEL[dev]} ${on ? "on" : "off"}`, { story: true }); done();
        });
      }
      case "lock_door": case "unlock_door": {
        const lock = act === "lock_door";
        const doIt = () => { d.door.open = false; d.door.locked = lock; this.emit("act", `${lock ? "locks" : "unlocks"} the front door`); done(); };
        if (p.location === "outside") { p.walk = { pts: [[...OUTSIDE.porch]], then: doIt }; return null; }
        return needHome("the front door") || at("front_door", doIt);
      }
      case "answer_door": {
        const e = needHome("answering the door"); if (e) return e;
        return at("front_door", () => {
          d.door.open = true;
          if (d.doormat) { this.notice(`Mina found ${d.doormat}`); d.doormat = null; }
          if (d.parcelOnStep) { d.parcelOnStep = false; d.parcelInHall = true; this.notice("Mina brought in a parcel from the step"); }
          const v = d.visitor;
          if (!v) { this.notice("Mina opened the door: nobody there"); d.door.open = false; return done("nobody"); }
          const guest = this.meetVisitor();
          if (!guest) { d.door.open = false; return done("parcel"); }
          if (guest.kind === "plumber") {
            doing("talk", "letting the plumber fix the pipe", { until: this.t + rand(25, 40) * M, onDone: () => { d.leak = false; d.water_on = true; d.visitor = null; d.door.open = false; this.notice("The plumber fixed the burst pipe and turned the water back on"); done(); } });
            return;
          }
          if (guest.kind === "friend") {
            d.door.open = false;
            doing("talk", `with ${guest.who}`, { until: this.t + rand(30, 60) * M, onDone: () => { d.visitor = null; p.lastTalkAt = this.t; this.notice(`${guest.who} went home`); done(); } });
            return;
          }
          doing("talk", `chatting with ${guest.who.split(",")[0]} at the door`, { until: this.t + rand(6, 12) * M, onDone: () => { d.visitor = null; d.door.open = false; p.lastTalkAt = this.t; this.notice(`${cap(guest.who.split(",")[0])} said goodbye`); done(); } });
        }, "going to answer the door");
      }
      case "open_window": {
        const e = needHome("opening windows"); if (e) return e;
        const room = normRoom(step.where) || p.room;
        return at(ROOM_CENTRE[room], () => { d.windows[room] = true; this.emit("act", `opens the ${ROOMS[room].label.toLowerCase()} windows`); done(); });
      }
      case "mop_floor": {
        const e = needHome("mopping"); if (e) return e;
        const room = normRoom(step.where) || p.room;
        return at(ROOM_CENTRE[room], () => doing("mop", `mopping the ${ROOMS[room].label.toLowerCase()} floor`, {
          tick: (dt) => { d.water[room] = clamp(d.water[room] - dt / (12 * M)); if (d.water[room] <= 0) { this.emit("act", `mopped the ${ROOMS[room].label.toLowerCase()} dry`); done(); } },
        }));
      }
      case "call_emergency": {
        doing("call", "on the phone to emergency services", { until: this.t + 3 * M, onDone: () => {
          const fire = d.smoke.kitchen > 0.1 || d.smoke.hall > 0.1;
          d.helpComing = { at: this.t + rand(9, 15) * M, who: fire ? "The fire brigade" : "Paramedics" };
          this.notice(`Emergency services said ${fire ? "a fire crew" : "an ambulance"} is on its way`);
          done();
        } });
        return null;
      }
      case "get_up": {
        if (!p.onFloor) return done("already up");
        if (p.pain > 0.55) return "the pain is too sharp; she cannot get up yet";
        p.onFloor = false; this.emit("act", "gets up off the floor, carefully", { story: true }); done(); return null;
      }
      case "attend": {
        const w = this.work;
        if (!away || !w.pending.length) return "nothing and nobody is waiting for her here right now";
        const e = w.pending.find(x => x.key.test(String(step.what || ""))) ?? w.pending[0];
        e.handling = true;
        doing("attend", e.doing, { attend: e.kind, until: this.t + e.takes * M, onDone: () => {
          w.pending = w.pending.filter(x => x !== e);
          if (e.social) { p.lastTalkAt = this.t; p.needs.loneliness = clamp(p.needs.loneliness - 0.15); }
          p.needs.boredom = clamp(p.needs.boredom - 0.1);
          this.notice(e.done, { story: true });
          done();
        } });
        return null;
      }
      case "wait": {
        doing("wait", step.what ? `waiting: ${step.what}` : "waiting", { until: this.t + mins(10, 1, 240) });
        return null;
      }
    }
    return `"${act}" is not something she knows how to do`;
  }

  ate(amount) {
    const p = this.person;
    p.needs.hunger = clamp(p.needs.hunger - amount);
    if (amount > 0.4) p.lastMealAt = this.t;
  }

  sendMessage(id, text) {
    const p = this.person;
    const name = CONTACTS[id]?.name ?? "the unknown number";
    p.outbox = p.outbox ?? [];
    p.outbox.push({ to: id, name, text, t: this.t });
    if (p.outbox.length > 20) p.outbox.shift();
    p.messagesToday = p.messagesToday ?? {};
    p.messagesToday[id] = this.clock.day;
    // Reading a thread before answering it.
    for (const m of this.d.phone.messages) if (m.from === id) m.read = true;
    p.needs.loneliness = clamp(p.needs.loneliness - 0.05);
    p.lastContactAt = this.t;
    this.emit("act", `texts ${name}: “${text}”`, { story: true, outgoing: { to: id, text } });
    this.emit("message_sent", text, { internal: true, to: id });
  }

  readMessages() {
    let n = 0;
    for (const m of this.d.phone.messages) if (!m.read) { m.read = true; n++; }
    return n;
  }

  // A phone call finished: the other person's side comes from contacts.mjs.
  callResult(id, { answered, gist }, minutes) {
    const step = this.currentStep(), p = this.person;
    if (!step || step.do !== "call" || p.activity?.waitingFor !== id) return;
    const name = CONTACTS[id].name;
    if (!answered) { this.notice(`${name} did not pick up`); return this.failStep(step, `${name} did not pick up`); }
    this.notice(`Phone call with ${name}: ${gist}`, { story: true });
    for (const m of this.d.phone.messages) if (m.from === id) m.read = true;
    p.activity = { kind: "call", label: `on the phone with ${name}`, since: this.t, until: this.t + minutes * M, onDone: () => { p.lastTalkAt = this.t; this.finishStep(step); } };
  }
}

function fmtSod(s) { const h = Math.floor(s / H), m = Math.floor((s % H) / M); return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`; }
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
export function normRoom(s) {
  if (!s) return null;
  const k = String(s).toLowerCase().replace(/^the /, "").trim();
  const map = { bedroom: "bedroom", bed: "bedroom", bathroom: "bathroom", bath: "bathroom", toilet: "bathroom", kitchen: "kitchen", living: "living", "living room": "living", lounge: "living", "sitting room": "living", hall: "hall", hallway: "hall", "front door": "hall", entrance: "hall", dining: "dining", "dining room": "dining", study: "dining", desk: "dining" };
  return map[k] ?? (ROOMS[k] ? k : null);
}
export function normPlace(s) {
  if (!s) return null;
  const k = String(s).toLowerCase().replace(/^the /, "").trim();
  if (PLACES[k]) return k;
  const map = { work: "library", "city library": "library", "the library": "library", "grocery shop": "shop", supermarket: "shop", groceries: "shop", "grocery store": "shop", store: "shop", café: "cafe", coffee: "cafe", "coffee shop": "cafe", leyla: "leyla_home", "leyla's": "leyla_home", "leyla's flat": "leyla_home", "sister's": "leyla_home", doctor: "doctor", "doctor's": "doctor", surgery: "doctor", gp: "doctor" };
  if (map[k]) return map[k];
  for (const [id, p] of Object.entries(PLACES)) if (p.label.toLowerCase().includes(k) || k.includes(id)) return id;
  return null;
}
function contactId(s) {
  if (!s) return null;
  const k = String(s).toLowerCase();
  for (const [id, c] of Object.entries(CONTACTS)) if (k.includes(id) || k.includes(c.name.toLowerCase())) return id;
  if (k.includes("unknown") || k.includes("number")) return "unknown";
  if (k.includes("plumber")) return "plumber";
  if (k.includes("boss") || k.includes("manager") || k.includes("work")) return "dana";
  if (k.includes("sister")) return "leyla";
  return null;
}
function contactName(s) { const id = contactId(s); return id ? CONTACTS[id]?.name : null; }

export function describeStep(s) {
  const bits = [s.do.replace(/_/g, " ")];
  if (s.what) bits.push(s.what);
  if (s.who) bits.push(s.who);
  if (s.where) bits.push(`(${s.where})`);
  if (s.until) bits.push(`until ${s.until}`);
  if (s.minutes && !["cook", "shower"].includes(s.do)) bits.push(`${s.minutes} min`);
  return bits.join(" ");
}
