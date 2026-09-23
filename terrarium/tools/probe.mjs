// One real Jev call and one real Claude call, to check keys, latency and response shapes.
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

const state = {
  now: { clock: "Tue 07:42", part_of_day: "early morning" },
  body: { hunger: "quite hungry", energy: "rested" },
  senses: { hear: ["the bathroom tap running"], smell: [] },
};
const t0 = performance.now();
const r = await fetch("https://api.typesafe.ai/v1/systemone", {
  method: "POST",
  headers: { "content-type": "application/json", authorization: `Bearer ${process.env.TYPESAFE_API_KEY}` },
  body: JSON.stringify({
    model: process.env.TYPESAFE_MODEL || "jev-latest",
    state,
    questions: {
      hungry: { type: "noul", instructions: "Is `body.hunger` strong enough that I would stop what I am doing to eat?" },
      wrong: { type: "noul", instructions: "Does anything in `senses` suggest something left on or wrong in the house?" },
      pressing: { type: "choice", instructions: "What is most pressing?", criteria: { none: null, hunger: null, danger: null } },
    },
  }),
});
console.log("jev", r.status, Math.round(performance.now() - t0), "ms", JSON.stringify(await r.json()));

const client = new Anthropic();
const Out = z.object({ thought: z.string(), steps: z.array(z.object({ do: z.enum(["cook", "eat", "wait"]), minutes: z.number().int().nullable() })) });
const t1 = performance.now();
const model = process.env.SYSTEM_TWO_MODEL || "claude-opus-5";
const res = await client.beta.messages.parse({
  model,
  max_tokens: 4000,
  betas: ["server-side-fallback-2026-07-01"],
  fallbacks: "default",
  output_config: { effort: process.env.SYSTEM_TWO_EFFORT || "low", format: zodOutputFormat(Out) },
  messages: [{ role: "user", content: "You are Mina, 34, it is 07:42 and you are quite hungry. What do you do next? One short first-person thought and up to 3 steps." }],
});
console.log("claude", model, Math.round(performance.now() - t1), "ms", res.stop_reason, JSON.stringify(res.parsed_output), JSON.stringify(res.usage));
