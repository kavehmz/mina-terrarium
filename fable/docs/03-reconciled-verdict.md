# Reconciled verdict

Two Claude sessions read the same brief and wrote two verdicts:

- **A**: docs/02-consolidated-reply.md (this session)
- **B**: docs/02b-consolidated-reply-other-session.md (parallel session)

This file is the single final position. Written 2026-09-22. Vocabulary as in A: tick, state, question, concern, fire, escalate, compact, Terrarium. Jev = System One. Claude = System Two. One new word from B: **directive**, a short instruction System Two writes into the state.

---

## 1. Where A and B agree

- Build it. The idea is sound.
- The new part is a **calibrated judgment on every beat**. A salience layer. Not "System 1 plus System 2".
- The pitch is **time passing** and **noticing absence**. What the tick adds is continuity, not intelligence. Do not claim feeling.
- Jev is System One. Claude is System Two. The names are honest.
- Never send the full state every tick. Both cost examples land in the same place: the literal design costs $145 to $232 a day; the fixed design costs about $9.
- **Latency: Kaveh measured about 200 ms per call.** The docs give no millisecond figure. They say batching 13 questions into one call is 9.6x faster and 11.5x cheaper than 13 calls. State size at measurement not recorded; re-check once at 20K before fixing the deep-tick size.
- Keep observed facts and inferred state in separate fields, with timestamps. Jev checks freshness before a directive is applied.
- Confidence bands from the docs: high = act, medium = caution, low = route to a human.
- Not a car.
- The word is **Terrarium**. Viewers perturb the world. They never command the agent.
- Long calm, rare bursts. A legible interior. Consequences accumulate.

---

## 2. Where they differ, and the final call

| Topic | A said | B said | Final |
|---|---|---|---|
| **World** | Simulated home | Simulated small office | **Home for the public Terrarium. Office for the internal pilot.** Same brain, swap the world module. Home wins in public because anyone reads it at a glance and it matches Kaveh's list of senses. Office agents look like every 2026 email-triage demo. Office wins inside the company because that is where the value is. |
| **Clock** | One day compressed into 15 minutes | Real time, remembers yesterday | **Real time.** The thesis is time passing. A thing that lived while you were not watching is the proof. Add a 60-second replay of the last 24 hours for first-time visitors and for the video. Clock speed-up only in a private fork, never in the shared world. |
| **Tick rate** | Fixed: fast tick every second, deep tick every 20 to 60 seconds | Adaptive: fast when things change, slow when quiet | **Both.** The fast tick adapts between once a second (activity) and once per 5 seconds (quiet). It never stops, because quiet is exactly when absence matters. Deep tick every 20 to 60 seconds. |
| **System Two output** | A program: goals, question list with thresholds, compacted memory | One short directive written into state; Jev checks it stays valid | **Both, layered.** A directive is the cheap answer for one situation and covers most escalations. A program change is rare, for when no existing question fits. Jev checks directive freshness on every deep tick. |
| **Noise** | Leaky integrator per concern | "Attention rising over several beats" | **Leaky integrator.** It is the formal version of the same idea, and it is the core visual. |
| **Compaction** | Code triggers by token count; Jev marks each item "still relevant?"; System Two summarizes survivors | Compact often, not only at overflow; compact events, never directives | **Merge.** Code triggers by token count and by schedule (sleep hours). Jev marks relevance per item. System Two summarizes survivors. Directives are never compacted, only retired when Jev says they are stale. |
| **Interoception** | Not covered | Feed fatigue, time since last action, directive age, memory fullness as senses | **Adopt.** Cheap and honest. "Enough, I do not want to see this" becomes a Score, not a rule. |
| **Side by side** | Same house with an LLM-only twin that wakes on events | Several Terrariums with different temperaments (thresholds) | **Both, in order.** LLM-only twin first. It makes the argument. Temperaments second. It is the shareable image. |
| **Next step** | Measure latency first | Draft the state schema and question set first | **Schema first.** Latency is known: about 200 ms, measured by Kaveh. A 1-second tick has room. Even 0.5 seconds works if calls overlap in flight. |

One caveat on the home: TypeSafe ships a smart-home demo. It evaluates commands like "turn off all the lights". Ours must look different on sight. Nobody commands our agent. It lives there, and it notices.

---

## 3. Final position on one page

- **What:** a brain that ticks. Jev judges the state every 1 to 5 seconds. Concerns charge in leaky integrators. A fire escalates to Claude, which writes a directive, or rarely rewrites the question list. Code owns every rule.
- **State:** four parts. Observed events with timestamps. Inferred state and directives with age. Interoceptive signals. The clock and elapsed times.
- **Compaction:** code decides when. Jev decides what is still relevant. Claude writes the summary. It looks like sleep.
- **World:** a simulated home with a resident and the agent as housemate, in real time. Office as the second world, for the company.
- **Terrarium:** one public page, no login, ambient. Heartbeat pulse. Brain panel. Live meter of milliseconds, tokens per second, dollars per hour. A poke box that takes plain words. An LLM-only twin next door. A replay of the last day.
- **Speed:** about 200 ms per call, measured. A 1-second tick is comfortable.
- **Cost:** about $9 a day at a fixed 1-second tick, less with the adaptive rate. Same load on Haiku 4.5 would be $216 a day plus output.
- **Public line:** *An LLM can react to an event. A ticking System One can react to nothing happening.*
- **Honest prior art:** Brooks' subsumption robots, MemGPT heartbeats, Stanford's Smallville. Ours differs by cadence and cost: every second, for cents.

---

## 4. Next steps

1. **Draft the state schema and the standing question set for one tick.** Nouls, Choices and Scores with criteria and thresholds. No key needed.
2. **Latency is done.** About 200 ms, measured by Kaveh. Optional: one check at 20K state for the deep tick.
3. **Headless brain** in TypeScript with the simulated home. Log every tick.
4. **Terrarium page.**
5. **Publish.**

Open for Kaveh: real resident data later or simulated only; public first or company first.
