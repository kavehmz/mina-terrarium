# Consolidated verdict — the "heartbeat brain" on TypeSafe/Jev

*Claude's final position after the conversation of 22 September 2026. Not a transcript; a synthesis of what I concluded and recommended.*

*(Saved verbatim from a parallel session. The companion verdict from this session is docs/02-consolidated-reply.md. The two are reconciled in docs/03-reconciled-verdict.md.)*

---

## 1. What TypeSafe/Jev is (verified against the live docs)

- **Jev** is TypeSafe's flagship and first **System One** model. It takes a `state` (string, JSON object or array) plus a map of typed `questions`, and returns typed answers with calibrated probabilities. It never generates text or reasoning.
- **Three primitives:** **Choice** (one of N options, full distribution + confidence), **Noul** (probability that a yes/no condition holds; no separate confidence), **Score** (probability‑weighted position on ordered described levels + confidence).
- **One endpoint:** `POST https://api.typesafe.ai/v1/systemone`, bearer key. All questions in a request are evaluated in parallel over the same state and cannot see each other's answers.
- **Confidence** is derived purely from distribution sharpness; the docs recommend three bands (act / act with caution / route to a human) with thresholds set per action by the cost of being wrong.
- **Limits (jev‑1.13.0):** 64k tokens per request; 32k for state plus the single longest question; text only; 250,000 tokens/s and 1,200 requests/min, described as changing without notice.
- **Pricing correction:** $42 per **billion** input tokens = **$0.042 per million** (~4 cents/Mtok), output free. Your "0.04 cents" was off by 100× — it's 4 cents, not 0.04 cents. Still extremely cheap.
- **Latency:** the docs say "fast" and cite a 10× speed‑up from batching, but publish **no millisecond figure**. "Low 100s of ms" is plausible but unverified — measure it before designing around a 500 ms tick.
- Not fine‑tunable; you shape it via state, instructions and criteria. English is strongest. Customer data isn't used for training.

## 2. Verdict on the core idea

**Sound, and genuinely novel in one specific way.** Heartbeat‑driven agents exist already (cron‑triggered LLMs). What's new is that the tick itself becomes a cheap, calibrated *judgment*: every beat, something looks at the whole sensory picture and answers "does any of this matter, and how much?" That is a **salience layer** — the part of a mind that notices it has gotten dark, or that a sound was unusual, without deliberating. Deliberate thought (System Two: an LLM such as Claude) is summoned only when salience crosses a threshold, writes one short directive back into the state, and occasionally compacts memory.

Naming: Jev is **System One**; the LLM is **System Two**. TypeSafe took the name from Kahneman, so the framing is honest.

**The "sense of time" insight is the pitch.** I have no internal trigger; time does not pass for me between messages. Your design gives an agent the missing organ — not intelligence, but *continuity*. Publicly: not "we built a brain," but **"we gave an AI a sense of time passing and a nervous system."**

## 3. Three realities to design around

1. **Jev is stateless.** Every tick re‑sends the whole state, so cost = state size × tick rate. 20k tokens every 0.5 s ≈ 3.5 B tokens/day ≈ **$145/day**. Fine for a demo, painful in production. Fix: an **adaptive heartbeat** (fast when things change, slow when quiet) and a small "hot" state with aggressive compaction — not only at overflow.
2. **Latency is an assumption** until measured.
3. **Jev only judges.** Tick questions must be pure judgments: *Is anything requiring attention? Which domain? How urgent? Can a stored rule handle it, or does System Two need to wake? Is the current directive still valid given the new facts?*

Design rule from the skill: keep **observed facts** (events) separate from **inferred state** (System Two's directives and summaries); have Jev check freshness before a directive is applied; compact the event log, never the directives.

Also feed the agent its own **interoceptive** signals as senses: fatigue, time since last action, how long a directive has sat unfulfilled, how full memory is. "Enough, I don't want to see this" is a Score over accumulated time‑on‑task, not a rule.

## 4. Which world

- **Not self‑driving:** Jev is text‑only, there's no perception layer, and a symbolic simulation wouldn't convince anyone.
- **Recommended: a simulated small office** — emails, Slack, calendar changes, a visitor, a printer error, a drifting deadline. Everything is naturally text, it's relatable, and the escalations are varied.
- **Close second: a home** (the docs even ship a smart‑home demo). Decide later; the architecture is identical.

## 5. The format: a terrarium, not a zoo, theater, demo or game

A zoo implies a captive specimen; a theater implies a script; a game implies a goal for the viewer. A **terrarium** (vivarium) is a small sealed world with its own weather and clock, something alive inside, and you on the other side of the glass — no control, no ending. Related words: ant farm, fishbowl, observatory, "the tank."

Five properties that make it feel alive:

1. **Real time.** Night there when it's night here. It remembers yesterday. "This was happening while I wasn't looking" turns viewers into returners.
2. **Long calm, rare bursts.** Most ticks are nearly invisible; then salience crosses the line, the brain lights up, System Two wakes, a decision happens. The calm makes the wake moments feel earned.
3. **Legible interior.** Sensory channels as live gauges, attention rising over several beats before it acts, a thought as one line. Viewers should predict "it's about to do something" a second early.
4. **Perturb, not control.** Ring the doorbell, kill the lights, drop a message, speed up the clock. Never command it — change the world and watch what it makes of it.
5. **Consequences accumulate.** Ignored things pile up. It tires. Memory fills and visibly compacts. Neglect and attention both leave marks.

**Delivery:** one public web page, no login, ambient by default, with a small "poke" panel. Later: several terrariums side by side with different temperaments (thresholds), diverging from the same events — a very publishable image.

## 6. Recommended next step

Draft the architecture: the **state schema** (observed events, inferred state, directives, interoceptive signals) and the **standing question set for one tick** (Nouls, Choices and Scores with their criteria and thresholds). The visualization follows from that.
