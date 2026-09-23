// TypeSafe Jev over HTTP (POST /v1/systemone). Server-side only; the key never leaves this process.
const URL = "https://api.typesafe.ai/v1/systemone";
export const JEV_MODEL = process.env.TYPESAFE_MODEL || "jev-latest";
export const JEV_PRICE_PER_TOKEN = 0.042 / 1e6; // input only; output is free

export async function askJev(state, questions, { retries = 3 } = {}) {
  const key = process.env.TYPESAFE_API_KEY || process.env.TYPESAFE_API;
  if (!key) throw new Error("TYPESAFE_API_KEY is not set");
  const body = JSON.stringify({ model: JEV_MODEL, state, questions });
  for (let attempt = 0; ; attempt++) {
    const t0 = performance.now();
    const res = await fetch(URL, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body,
      signal: AbortSignal.timeout(15000),
    });
    const ms = Math.round(performance.now() - t0);
    if ((res.status === 429 || res.status === 529 || res.status >= 500) && attempt < retries) {
      const wait = Number(res.headers.get("retry-after")) * 1000 || 400 * 2 ** attempt;
      await new Promise(r => setTimeout(r, wait));
      continue;
    }
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new Error(`Jev ${res.status}: ${JSON.stringify(json)?.slice(0, 300)}`);
    return { answers: json.answers, model: json.model, usage: json.usage, ms, bytes: body.length };
  }
}
