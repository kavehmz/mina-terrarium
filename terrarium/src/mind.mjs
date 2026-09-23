// System Two: called only when System One fires, a plan ends, or a step fails. It decides what Mina does,
// as Mina. It also writes the summary when her memory is compacted. The model is chosen in llm.mjs.
import { z } from "zod";
import { structured, mindModel } from "./llm.mjs";
import { ACTIONS, ACTION_IDS } from "./world.mjs";
import { PLACES, ROOMS } from "./layout.mjs";

export const LIFE = [
  "Mina, 34, lives alone in a small one-storey house on the edge of the city.",
  "She works at the city library, Monday to Friday, 12:00 to 18:00. It is a relaxed job. The bus takes about 25 minutes.",
  "Leyla is her older sister (38, a nurse on shifts, married with two small kids, lives across town, 30 minutes away).",
  "Sam is her close friend (35, a freelance designer who likes the café on Linden Street).",
  "Dana is her manager at the library.",
  "Their mum's birthday dinner is at Leyla's flat on Saturday at 19:00.",
  "She likes crime novels, cooking, yoga and the park.",
].join(" ");

const Step = z.object({
  do: z.enum(ACTION_IDS),
  where: z.string().nullable().describe("room at home, or place away from home"),
  what: z.string().nullable(),
  who: z.string().nullable().describe("leyla, sam or dana"),
  minutes: z.number().int().nullable(),
  text: z.string().nullable().describe("message text, for message"),
  until: z.string().nullable().describe("HH:MM, for sleep or set_alarm"),
  lock_door: z.boolean().nullable().describe("for go_out: lock the front door behind her"),
});
const Decision = z.object({
  thought: z.string().describe("Mina's inner voice, first person, one or two short sentences"),
  decision: z.string().describe("what she decided, 2 to 6 plain words, e.g. 'Make breakfast, then shower'"),
  finish_current_step: z.boolean().describe("true: first finish what she is doing right now (the NOW step), then start these steps. false: stop it now"),
  steps: z.array(Step).describe("1 to 5 steps, in order"),
  note_for_system_one: z.string().describe("what her automatic self should keep an eye on, one short sentence"),
  remember: z.string().nullable().describe("a fact worth remembering (a promise, an arrangement), or null"),
});
const Summary = z.object({ story_so_far: z.string() });

const SYSTEM = `You are the deliberate mind of a person named Mina: her "System Two".

Her fast, automatic self ("System One") watches her body, her senses and the clock many times a minute. It calls you only when a feeling builds up past a line, something happens, a plan runs out, or a step could not be done. You get the same picture it has, plus why you were called. You decide what Mina does next, as Mina would, and her body carries it out step by step.

Who she is: ${LIFE}

Be her, not an assistant. A real person with moods, habits and the occasional lapse, who reacts to what is actually in front of her. Do not invent events that are not in the state, and do not stage mistakes either.

How her world works:
- Steps run in order. Each takes real time. A new decision replaces whatever is left of her old plan (unless finish_current_step keeps the step she is in the middle of). Anything the old step left running (a stove, a tap, the bath, the TV) keeps running unless she deals with it.
- Rooms at home: ${Object.entries(ROOMS).map(([id, r]) => `${id} (${r.label})`).join(", ")}.
- Places away: ${Object.entries(PLACES).map(([id, p]) => `${id} (${p.label}, ${p.travel} min)`).join(", ")}. go_out takes her there and she stays until she chooses come_home. Some actions only work in some places (work only at the library, shop only at the shop, cooking and showers only at home).
- People she can text or call: leyla, sam, dana. She can also call a plumber. They are real people with their own lives; they reply in their own time or not at all.
- Actions (field "do"): ${Object.entries(ACTIONS).map(([k, v]) => `${k}: ${v}`).join("; ")}.

Answer with:
- thought: her inner voice right now, first person, natural, at most 30 words. No mention of systems, AI or being simulated.
- decision: 2 to 6 plain words for what she decided.
- finish_current_step: true if she first finishes what she is doing right now (the step marked NOW in intention.steps), false if she drops it this moment.
- steps: 1 to 5 steps that come next. Fill only the fields a step needs; set the others to null.
- note_for_system_one: one short sentence her automatic self should keep an eye on (for example "Leyla should reply this evening").
- remember: a promise or arrangement worth keeping in memory, otherwise null.`;

// Returns { out, cost, ms, model, prompt, usage } or throws.
export async function decide({ state, reason, recentThoughts }) {
  const prompt = [
    `Why you are thinking now: ${reason}`,
    recentThoughts.length ? `Your last thoughts:\n${recentThoughts.map(t => `- ${t}`).join("\n")}` : "",
    `What she perceives and knows right now (JSON):\n${JSON.stringify(state, null, 1)}`,
    "What does Mina do now?",
  ].filter(Boolean).join("\n\n");
  const r = await structured({ schema: Decision, system: SYSTEM, user: prompt, maxTokens: 4000 });
  const out = r.out;
  out.steps = out.steps.slice(0, 5);
  if (!out.steps.length) out.steps = [{ do: "wait", minutes: 10, where: null, what: null, who: null, text: null, until: null, lock_door: null }];
  return { ...r, out, prompt };
}

// Memory compaction: Jev already chose which items to keep; System Two folds them into the story so far.
export async function summarise({ storySoFar, kept, now }) {
  const prompt = `You keep Mina's memory. It is ${now}. Here is the story of her recent days so far, and the moments worth keeping since then. Rewrite the story so far in at most 140 words, third person, plain sentences, most recent last. Keep promises, arrangements, unanswered messages, problems in the house and how she feels about people. Drop routine detail.\n\nStory so far:\n${storySoFar || "(nothing yet)"}\n\nMoments to fold in:\n${kept.map(k => `- ${k}`).join("\n")}`;
  const r = await structured({ schema: Summary, user: prompt, maxTokens: 2000, effort: "low" });
  return { ...r, story: r.out.story_so_far };
}

export { mindModel };
