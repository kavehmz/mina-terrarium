// The model behind System Two (and behind the other people and memory summaries). One structured call,
// routed to Anthropic or OpenAI by the chosen model. Keys stay in this process; the browser only sees names.
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

// Prices in $ per million tokens: input, output, cached input read.
export const MODELS = {
  "claude-opus-5-5": { provider: "anthropic", label: "Claude Opus 5.5", brand: "Claude", price: [4, 20, 0.4], effort: true, fallbacks: true },
  "claude-opus-5": { provider: "anthropic", label: "Claude Opus 5", brand: "Claude", price: [5, 25, 0.5], effort: true, fallbacks: true },
  "claude-haiku-4-5": { provider: "anthropic", label: "Claude Haiku 4.5", brand: "Claude", price: [1, 5, 0.1], effort: false, fallbacks: false },
  "gpt-6-luna": { provider: "openai", label: "GPT-6 Luna", brand: "GPT", price: [0.1, 0.5, 0.01], effort: true },
};
const EFFORT = process.env.SYSTEM_TWO_EFFORT || "low";

let current = MODELS[process.env.SYSTEM_TWO_MODEL] ? process.env.SYSTEM_TWO_MODEL : "claude-opus-5-5";
export const mindModel = () => current;
export const mindInfo = (m = current) => ({ id: m, ...MODELS[m] });
export function setMindModel(m) {
  if (!MODELS[m]) return false;
  if (MODELS[m].provider === "openai" && !process.env.OPENAI_API_KEY) return false;
  current = m;
  return true;
}
export const availableModels = () => Object.entries(MODELS)
  .filter(([, s]) => s.provider !== "openai" || process.env.OPENAI_API_KEY)
  .map(([id, s]) => ({ id, label: s.label, brand: s.brand }));

// The model sometimes writes non-ASCII letters as \uXXXX escapes inside JSON strings; show them as letters.
const unescape = (v) => typeof v === "string" ? v.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16))) : Array.isArray(v) ? v.map(unescape) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, unescape(x)])) : v;

const anthropic = new Anthropic();

// Returns { out, usage: { input, cached, cacheWrite, output }, cost, ms, model }. Throws on refusal or unusable output.
export async function structured({ schema, system, user, maxTokens = 4000, effort = EFFORT, model = current }) {
  const spec = MODELS[model];
  const t0 = performance.now();
  const r = spec.provider === "openai"
    ? await callOpenAI({ spec, model, schema, system, user, maxTokens, effort })
    : await callAnthropic({ spec, model, schema, system, user, maxTokens, effort });
  const [pi, po, pc] = spec.price.map(x => x / 1e6);
  const u = r.usage;
  const cost = u.input * pi + u.cached * pc + u.cacheWrite * pi * 1.25 + u.output * po;
  return { out: unescape(r.out), usage: u, cost, ms: Math.round(performance.now() - t0), model: r.model || model };
}

async function callAnthropic({ spec, model, schema, system, user, maxTokens, effort }) {
  const res = await anthropic.beta.messages.parse({
    model,
    max_tokens: maxTokens,
    ...(spec.fallbacks ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" } : {}),
    ...(system ? { system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }] } : {}),
    output_config: { ...(spec.effort ? { effort } : {}), format: zodOutputFormat(schema) },
    messages: [{ role: "user", content: user }],
  });
  if (res.stop_reason === "refusal") throw new Error(`${spec.label} declined: ${res.stop_details?.category ?? "no category"}`);
  if (!res.parsed_output) throw new Error(`${spec.label} returned nothing usable (stop: ${res.stop_reason})`);
  const u = res.usage || {};
  return {
    out: res.parsed_output, model: res.model,
    usage: { input: u.input_tokens || 0, cached: u.cache_read_input_tokens || 0, cacheWrite: u.cache_creation_input_tokens || 0, output: u.output_tokens || 0 },
  };
}

// OpenAI Responses API with a strict JSON schema made from the same zod schema.
function strictSchema(schema) {
  const s = z.toJSONSchema(schema);
  delete s.$schema;
  const walk = (n) => { if (n && typeof n === "object") { if (n.type === "object") n.additionalProperties = false; for (const v of Object.values(n)) walk(v); } };
  walk(s);
  return s;
}
async function callOpenAI({ spec, model, schema, system, user, maxTokens, effort }) {
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model,
      input: [...(system ? [{ role: "system", content: system }] : []), { role: "user", content: user }],
      max_output_tokens: maxTokens,
      ...(spec.effort ? { reasoning: { effort } } : {}),
      text: { format: { type: "json_schema", name: "answer", schema: strictSchema(schema), strict: true } },
    }),
    signal: AbortSignal.timeout(60000),
  });
  const j = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${spec.label} ${res.status}: ${JSON.stringify(j?.error ?? j)?.slice(0, 300)}`);
  const content = (j.output ?? []).flatMap(o => o.content ?? []);
  const refusal = content.find(c => c.type === "refusal");
  if (refusal) throw new Error(`${spec.label} declined: ${refusal.refusal}`);
  const text = content.find(c => c.type === "output_text")?.text;
  if (!text) throw new Error(`${spec.label} returned nothing usable (status: ${j.status})`);
  const out = schema.parse(JSON.parse(text));
  const u = j.usage || {};
  const cached = u.input_tokens_details?.cached_tokens || 0;
  return { out, model: j.model, usage: { input: (u.input_tokens || 0) - cached, cached, cacheWrite: 0, output: u.output_tokens || 0 } };
}
