// System One: TypeSafe's Jev, called over HTTP. Falls back to a mock when TYPESAFE_API_KEY is missing.
import type { Answer, JevResult, Question } from "./types.ts";

export const JEV_PRICE_PER_MTOK = 0.042; // USD per million input tokens (output is free)

export class Jev {
  key = process.env.TYPESAFE_API_KEY ?? "";
  model = process.env.TYPESAFE_MODEL ?? "jev-latest";
  url = process.env.TYPESAFE_URL ?? "https://api.typesafe.ai/v1/systemone";
  mock = !this.key;
  lastError = "";

  async ask(state: unknown, questions: Record<string, Question>, fallback: () => Record<string, Answer>): Promise<JevResult> {
    const t0 = performance.now();
    if (this.mock) {
      const answers = fallback();
      const tokens = Math.ceil(JSON.stringify({ state, questions }).length / 4);
      await new Promise(r => setTimeout(r, 120 + Math.random() * 80)); // pretend network
      return { model: "mock (set TYPESAFE_API_KEY)", answers, usage: { input_tokens: tokens, output_tokens: 0 }, latencyMs: performance.now() - t0, mock: true };
    }
    const body = JSON.stringify({ model: this.model, state, questions });
    let attempt = 0;
    while (true) {
      attempt++;
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 8000);
      try {
        const res = await fetch(this.url, {
          method: "POST",
          headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
          body,
          signal: ctl.signal,
        });
        if ((res.status === 429 || res.status === 529) && attempt < 3) {
          const ra = Number(res.headers.get("retry-after")) || 0;
          await new Promise(r => setTimeout(r, ra ? ra * 1000 : 400 * attempt));
          continue;
        }
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`TypeSafe ${res.status}: ${text.slice(0, 300)}`);
        }
        const json = (await res.json()) as { model: string; answers: Record<string, Answer>; usage: { input_tokens: number; output_tokens: number } };
        this.lastError = "";
        return { model: json.model, answers: json.answers, usage: json.usage, latencyMs: performance.now() - t0, mock: false };
      } catch (err) {
        if (attempt < 2 && (err as Error).name === "AbortError") continue;
        this.lastError = (err as Error).message;
        throw err;
      } finally {
        clearTimeout(timer);
      }
    }
  }
}
