// The other people in Mina's life. They are part of her world, not of her mind: they reply to her texts,
// pick up her calls (or not) and sometimes text her first. Each reply is one short call to the System Two model.
import { z } from "zod";
import { structured } from "./llm.mjs";

export const PEOPLE = {
  leyla: "Leyla, 38, Mina's older sister. A nurse on rotating shifts, married to Arash, two kids (Nika 7, Dara 4). Warm, a little bossy, worries that Mina lives alone. Organising their mum's birthday dinner at her flat on Saturday at 19:00. Busy; replies when she can.",
  sam: "Sam, 35, Mina's close friend since university. Freelance graphic designer, works odd hours, funny, spontaneous, often suggests the café on Linden Street or a walk in the park.",
  dana: "Dana, 56, Mina's manager at the city library. Kind but busy, writes briefly, only about work.",
};

const Reply = z.object({
  reply: z.string().nullable().describe("the text message they send back, or null if they would not reply"),
  delay_minutes: z.number().int().describe("how many minutes until they reply, realistic for what they are doing"),
  visit_in_minutes: z.number().int().nullable().describe("if they are going to come round to Mina's house in person, in how many minutes they arrive; otherwise null"),
});
const Call = z.object({
  answered: z.boolean(),
  gist: z.string().describe("one or two sentences: what was said on the call, including any plan they made"),
  visit_in_minutes: z.number().int().nullable().describe("if they agreed to come round to Mina's house in person, in how many minutes they arrive; otherwise null"),
});
const Initiative = z.object({ text: z.string().nullable().describe("a text message to Mina, or null if they would not text now") });

async function ask(schema, prompt) {
  const r = await structured({ schema, user: prompt, maxTokens: 1500, effort: "low" });
  return { out: r.out, cost: r.cost };
}

const thread = (msgs) => msgs.slice(-8).map(m => `${m.clock} ${m.from}: ${m.text}`).join("\n") || "(no earlier messages today)";

export function replyTo(id, { now, history, text }) {
  return ask(Reply, `You are ${PEOPLE[id]}\nIt is ${now}. Recent texts between you and Mina:\n${thread(history)}\n\nMina just texted you: "${text}"\n\nWould you reply, and what? Write it the way you really text: short and natural. Take into account the time of day and what you are likely doing. If you say you will come over, give visit_in_minutes; only do that if you really would.`);
}

export function takeCall(id, { now, history, reason, minutes }) {
  // `reason` is what Mina has on her mind as she calls (her latest thought and decision); she tells them on the call.
  return ask(Call, `You are ${PEOPLE[id]}\nIt is ${now}. Recent texts between you and Mina:\n${thread(history)}\n\nMina is phoning you now${reason ? `. What she tells you: ${reason}` : ""}, for about ${minutes} minutes. Do you pick up, given what you are probably doing at this hour? If you do, give the gist of the conversation in the third person using both names (for example \"Sam said he'd come round; Mina said the door is locked\"). If you agree to come round to her house, give visit_in_minutes.`);
}

export function maybeText(id, { now, history, story }) {
  return ask(Initiative, `You are ${PEOPLE[id]}\nIt is ${now}. What you know of Mina lately: ${story || "nothing special"}\nRecent texts between you and Mina:\n${thread(history)}\n\nWould you text Mina right now, out of the blue? Only if it fits your day and your relationship. If yes, write the text.`);
}
