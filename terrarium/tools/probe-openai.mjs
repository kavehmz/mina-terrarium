// One real OpenAI call with a strict JSON schema, to check the model, the shape and the latency.
import { z } from "zod";
const Out = z.object({ thought: z.string(), steps: z.array(z.object({ do: z.enum(["cook", "eat", "wait"]), minutes: z.number().int().nullable() })) });
const strict = (s) => { if (s && typeof s === "object") { if (s.type === "object") s.additionalProperties = false; for (const v of Object.values(s)) strict(v); } return s; };
const schema = strict(z.toJSONSchema(Out)); delete schema.$schema;
const model = process.argv[2] || "gpt-6-luna";
const t0 = performance.now();
const r = await fetch("https://api.openai.com/v1/responses", {
  method: "POST",
  headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
  body: JSON.stringify({ model, input: [{ role: "system", content: "You are Mina, 34." }, { role: "user", content: "It is 07:42 and you are quite hungry. What do you do next? One short first-person thought and up to 3 steps." }], text: { format: { type: "json_schema", name: "decision", schema, strict: true } } }),
});
const j = await r.json();
const text = j.output?.flatMap(o => o.content ?? []).find(c => c.type === "output_text")?.text;
console.log(model, r.status, Math.round(performance.now() - t0), "ms", text ?? JSON.stringify(j).slice(0, 400), JSON.stringify(j.usage));
