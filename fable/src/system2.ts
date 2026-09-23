// System Two: Claude, called when a person's fast layer fires. It returns what the person wants to do:
// an inner thought, a short plan of concrete steps the body can execute, and a directive for the fast layer.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { MindInput, MindReply } from "./types.ts";
import { STEP_KINDS } from "./world.ts";
import type { Step } from "./world.ts";

const ReplySchema = z.object({
  thought: z.string().describe("First person, at most 160 characters. Your inner voice: what you feel and why you choose this. Shown to viewers."),
  plan_label: z.string().describe("At most 50 characters, plain words, e.g. 'cook pasta and eat' or 'text Mina, then shower'."),
  plan: z.array(z.object({
    step: z.enum(STEP_KINDS),
    arg: z.string().describe("The step's argument: room for go_to (bedroom, bathroom, kitchen, living, hall, outside); meal for cook; what for eat/read/watch_tv; topic for talk; text for message; purpose for go_out; device for turn_off (stove, tap, tv, lights); room for turn_on_light/turn_off_light; HH:MM wake time for sleep or empty; reason for rest/wait. Empty string when not needed."),
    minutes: z.number().describe("Duration in minutes where it applies (cook, eat, shower, nap, watch_tv, read, rest, talk, go_out, wait). 0 otherwise."),
  })).describe("1 to 5 steps, in order. The body carries them out one after another and walks where needed."),
  directive: z.string().describe("At most 200 characters. A note for your fast layer about what to watch for while this plan runs, e.g. 'Cooking; keep an ear on the stove. If Mina texts, answer.' Empty to keep the current one."),
  memory_summary: z.string().describe("Only when compact is true: at most 600 characters summarizing compact_items plus the old summary. Otherwise empty."),
});

const SYSTEM = `You are System Two: the slow, deliberate mind of one person living in a small simulated home.
A fast calibrated model (System One, TypeSafe's Jev) watches this person's body and senses every second. It only feels and notices; it cannot plan. When something crosses a line it wakes you, and you decide what the person wants to do.

Be this person, with their life facts. Choose what a real person would do now, given the time of day, the body (hunger, tiredness, hygiene, boredom, loneliness), obligations, and what is happening. Answer with a short plan of concrete steps the body can execute:
go_to(room) · cook(meal, minutes; turns the stove on, off when finished) · eat(what) · shower · sleep(wake time HH:MM or empty) · nap(minutes) · watch_tv(what, minutes) · read(what, minutes) · rest(why, minutes; also 'work at the desk', 'sit in the park') · talk(topic, minutes; only if someone else is in the house) · message(who: text; a phone text to someone in your life, e.g. 'Leyla: fancy a call tonight?') · check_on (go and look at someone else in the house, if anyone) · go_out(where and why, minutes of travel; you leave the house and STAY out) · come_home(minutes of travel) · turn_off(stove | tap | tv | lights) · turn_on_light(room) · turn_off_light(room) · lock_door · unlock_door · answer_door · call_emergency · wait(why, minutes).

Being out: after go_out you are away until you plan come_home. While out you can rest (work, walk), eat (canteen, café), read, message, call_emergency. A workday looks like: lock_door, go_out(the library, 30), rest(work at the desk, 240), eat(lunch), rest(work, 240); later, when you decide, come_home(30). Steps that need a room at home while you are out make you travel home first.

Rules:
- Realistic durations and order. Do not plan a whole day; plan the next thing, one to five steps.
- If you stop cooking or showering to do something else, it is up to you whether to turn things off. Nobody will do it for you.
- Danger comes first: smoke, fire, water, someone on the floor. call_emergency is for real emergencies; a false alarm has a cost.
- Do not narrate the world. The thought is your inner voice, one or two sentences.
- If you cannot move (on the floor), you can still message or call_emergency.
- Nobody answers your texts unless a message shows up in your messages; do not wait around for replies.
- When compact is true, write memory_summary: keep incidents, decisions, conversations, messages, and what you learned about the people in your life; drop routine detail.`;

export class Mind {
  client: Anthropic | null = null;
  model = process.env.SYSTEM_TWO_MODEL ?? "claude-opus-5";
  mock = !(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
  lastError = "";

  constructor() { if (!this.mock) this.client = new Anthropic(); }

  async think(input: MindInput): Promise<MindReply> {
    const t0 = performance.now();
    if (this.mock || !this.client) return this.mockReply(input, t0);
    try {
      const response = await this.client.messages.parse({
        model: this.model,
        max_tokens: 2500,
        system: SYSTEM,
        messages: [{ role: "user", content: `You are ${input.person}. Life facts: ${input.life}\n\nWoken because: ${input.reason}\n\n${JSON.stringify({ senses: input.senses, current_plan: input.current_plan, directive: input.directive, recent: input.recent, memory_summary: input.memory_summary, compact: input.compact, compact_items: input.compact_items }, null, 1)}` }],
        output_config: { format: zodOutputFormat(ReplySchema), effort: "low" },
      });
      if (response.stop_reason === "refusal" || !response.parsed_output) {
        this.lastError = response.stop_reason === "refusal" ? "refusal" : "no parsed output";
        return this.mockReply(input, t0, `System Two gave no usable answer (${this.lastError}).`);
      }
      this.lastError = "";
      const out = response.parsed_output;
      return { ...out, plan: out.plan as Step[], model: response.model, mock: false, latencyMs: performance.now() - t0 };
    } catch (err) {
      const e = err as Error;
      const m = /"message":"([^"]+)"/.exec(e.message);
      const status = /^(\d{3})/.exec(e.message)?.[1];
      this.lastError = `${status ? status + " " : ""}${m ? m[1] : e.message.slice(0, 120)}`;
      return this.mockReply(input, t0, `System Two unavailable (${this.lastError}).`);
    }
  }

  // A rule-based stand-in so the terrarium still lives without a key. Clearly labelled in the UI.
  private mockReply(input: MindInput, t0: number, note?: string): MindReply {
    const r = input.reason.toLowerCase();
    const s = input.senses as { me: { where: string; state: string; body: Record<string, string> }; heard: string[]; others: string; messages: string[]; time: { house_clock: string; weekday: string } };
    const heard = s.heard.join(" ").toLowerCase();
    const isMina = /mina/i.test(input.person);
    const [hh, mm] = s.time.house_clock.split(":").map(Number); const minute = hh * 60 + mm; const weekday = !/saturday|sunday/i.test(s.time.weekday);
    let thought = note ? note + " " : "(mock mind) "; let plan: Step[] = []; let label = ""; let directive = "";
    const P = (step: Step["step"], arg = "", minutes = 0): Step => ({ step, arg, minutes });
    if (/fell|floor/.test(s.me.state)) { label = "call for help"; plan = [P("message", "I fell and I can't get up. Please come."), P("call_emergency")]; thought += "I cannot get up. I need help."; }
    else if (/fire/.test(heard)) { label = "fire: put it out or get out"; plan = s.me.where === "kitchen" ? [P("turn_off", "stove"), P("call_emergency")] : [P("go_to", "kitchen"), P("turn_off", "stove"), P("call_emergency")]; thought += "Fire. Stove off, then call."; }
    else if (/smoke/.test(heard)) { label = "check the smoke"; plan = [P("go_to", "kitchen"), P("turn_off", "stove"), P("wait", "airing the kitchen", 5)]; thought += "Smoke alarm. Check the stove."; }
    else if (/on the floor/i.test(s.others)) { label = "help them"; plan = [P("call_emergency"), P("check_on")]; thought += "Someone is on the floor. Call for help now."; }
    else if (/doorbell/.test(heard)) { label = "answer the door"; plan = [P("answer_door")]; thought += "Someone at the door."; }
    else if (/water running|wet/.test(heard)) { label = "stop the water"; plan = [P("go_to", "bathroom"), P("turn_off", "tap")]; thought += "Water running. Turn it off."; }
    else if (isMina && weekday && minute >= 480 && minute <= 540 && s.me.where !== "outside") { label = "go to work"; plan = [P("lock_door"), P("go_out", "the library, for work", 30), P("rest", "work at the desk", 230), P("eat", "lunch at the canteen"), P("rest", "afternoon at the desk", 230)]; thought += "Time to leave for the library."; directive = "At work until about 17:00, then home."; }
    else if (s.me.where === "outside" && (!weekday || minute >= 1020 || minute < 420)) { label = "head home"; plan = [P("come_home", "", 30)]; thought += "Done here. Home."; }
    else if (/hunger/.test(r) || /very hungry|hungry/.test(s.me.body.hunger) && minute > 420 && minute < 1380) { label = "cook and eat"; plan = [P("go_to", "kitchen"), P("cook", isMina ? "an omelette" : "pasta", 20), P("eat", "")]; thought += "I am hungry. Let me cook something."; directive = "Cooking. Keep an ear on the stove."; }
    else if (/sleep/.test(r) || /exhausted|tired/.test(s.me.body.energy) && (minute >= 1320 || minute < 360)) { label = "go to bed"; plan = [P("turn_off", "lights"), P("go_to", "bedroom"), P("sleep", "07:00")]; thought += "Tired. Bed."; directive = "Asleep until morning. Wake only for alarms or if the partner needs me."; }
    else if (/hygiene/.test(r) || /grubby/.test(s.me.body.hygiene)) { label = "take a shower"; plan = [P("shower", "", 10)]; thought += "I need a shower."; }
    else if (/message/.test(r) && s.messages.length) { label = "reply"; plan = [P("message", "Got your message. All fine here, talk soon.")]; thought += "Better reply."; }
    else if (/connection|other/.test(r)) { label = /is here/.test(s.others) ? "talk" : "text Leyla"; plan = /is here/.test(s.others) ? [P("talk", "how the day is going", 10)] : [P("message", "Leyla: Hey, how are you? Fancy a call tonight?")]; thought += "I feel like talking to someone."; }
    else if (/boredom/.test(r) || /bored|restless/.test(s.me.body.boredom)) { label = minute > 1080 ? "watch the news" : "read a while"; plan = minute > 1080 ? [P("go_to", "living"), P("watch_tv", "the news", 45)] : [P("read", "a novel", 30)]; thought += "Restless. Something to do."; }
    else { label = "carry on"; plan = [P("rest", "sitting for a bit", 15)]; thought += "Nothing pressing. Sit a while."; }
    const memory_summary = input.compact ? [input.memory_summary, ...(input.compact_items ?? []).slice(-12)].filter(Boolean).join(" ").slice(0, 600) : "";
    return { thought: thought.slice(0, 160), plan_label: label, plan, directive, memory_summary, model: "mock (set ANTHROPIC_API_KEY)", mock: true, latencyMs: performance.now() - t0 };
  }
}
