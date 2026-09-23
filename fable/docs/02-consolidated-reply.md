# Consolidated reply: a ticking System One brain

Claude's verdict after reading Kaveh's brief (docs/01-brief-kaveh-verbatim.md), the TypeSafe skill, and the TypeSafe docs. Written 2026-09-22.

Words used with one meaning throughout:

- **Jev**: TypeSafe's model. **System One**: Jev plus the code around it. **System Two**: the LLM (Claude).
- **Tick**: one heartbeat. **State**: what we send Jev. **Question**: one Jev question.
- **Concern**: one thing the brain watches. **Fire**: a concern crosses its threshold.
- **Escalate**: hand the case to System Two. **Compact**: shrink the state.
- **Terrarium**: the watchable environment.

---

## 1. Verdict

- **Build it.** The idea is sound and the timing is right.
- **The new part is not "System 1 + System 2".** That split is old. The new part is a *calibrated decision model on a heartbeat*, cheap enough to look at the world every second. That lets software notice two things an LLM never sees: **nothing happening**, and **time passing**.
- **Two design changes.** Do not send 32K tokens every tick. Let System Two *program* System One, not just answer it.
- **World to demo:** a simulated home. Not an office, not a car.
- **Name for the watchable thing:** Terrarium.
- **Step one before anything else:** measure Jev latency against state size. The 100 ms figure is not in the docs.

One line for the public: *An LLM can react to an event. A ticking System One can react to nothing happening.*

---

## 2. What you got right

1. **Proactive is the gap.** An LLM runs when prompted. When nothing prompts it, it is frozen. Your "I feel time passing, you don't" is exactly the difference.
2. **Jev's price makes polling thinkable.** Not free, but 25x to 100x below LLM input prices. See the table in section 3.
3. **Confidence is the escalation trigger.** TypeSafe documents this as "confidence-gated routing". You are applying it across time instead of across one request.
4. **Compaction as a rhythm.** Memory fills, the brain compacts. That is sleep. It is also a strong visual beat.
5. **Time is a sense.** Put the clock and "seconds since X" into the state. Ask time questions.
6. **Your terms are right.** Jev is System One. Claude is System Two.

---

## 3. What to change

### 3.1 Do not send full state every tick

Jev bills input only, $0.042 per million tokens. The math at your literal design:

| Design | Ticks | State per tick | Tokens per day | Cost per day |
|---|---|---|---|---|
| Your literal design | 2 per second | 32K | 5.5 billion | $232 |
| Fast tick | 1 per second | 1.5K | 130 million | $5.40 |
| Deep tick | every 20 seconds | 20K | 86 million | $3.60 |
| **Recommended: fast + deep** | | | **216 million** | **$9** |
| Same recommended load on Claude Haiku 4.5 | | | 216 million | $216 plus output |
| Same on Claude Sonnet 5 | | | 216 million | $432 plus output |

Two more reasons beyond cost:

- **Rate limit.** Jev allows 250K tokens per second, and the docs say limits change without notice. The literal design eats a quarter of it for one house. The recommended design uses about 1 percent.
- **Latency grows with state.** Jev reads the state once per request. A 1.5K state will answer far faster than a 32K one. We must measure this.

So the brain has two rhythms:

- **Fast tick (about 1 per second).** A small "now" digest: clock, current sensor snapshot, active goals, last few events, time since key events. A few Noul questions: "Does anything here need attention now?", "Has the situation changed enough that the plan is stale?".
- **Deep tick (every 20 to 60 seconds, or when a fast tick fires).** The fuller memory, up to 32K. Many questions at once (speculative fan-out).

### 3.2 System Two's output is a program, not a paragraph

This is the biggest change. Jev can only answer questions someone wrote in advance. It cannot invent a new question. So a fixed question list can run a house, but it cannot "run your life", because life brings new concerns.

The fix: System Two writes the questions. When escalated, it returns three things, and code installs them:

1. A new **goal list**.
2. A new **question list**, each with a threshold and an action.
3. A **compacted memory**.

System Two is called rarely, at a few key moments a day. Each time it reprograms what System One watches for. System One then runs that program every second for cents. This is the honest division of labor: System Two thinks, System One stays awake.

### 3.3 Integrate over time, do not act on one tick

At 1 or 2 ticks per second, probabilities will flicker. Do not fire on one reading. Keep a **leaky integrator** per concern:

- Each tick adds the Noul probability minus a decay.
- The concern fires when the sum crosses a threshold.
- A 0.6 that holds for 30 seconds fires. A 0.9 blip for one tick does not.

This is how a neuron works: charge accumulates, leaks, and fires at threshold. It removes noise, it gives "feeling time" a formula, and it is the core visual of the Terrarium (bars charging up and firing).

### 3.4 Code owns the known rules

The TypeSafe skill is firm on this: rules, counts, and lookups stay in code.

- **Token count → compact** is a rule. Code decides when. Do not ask Jev "am I full?".
- Jev's job in compaction is better: one Noul per memory item, in parallel: "Is this still relevant to the current goals?". Jev becomes the **forgetting function**. System Two only writes the summary of what survives.
- Keep **observed facts** and **inferred state** in separate fields, with timestamps. The docs say this too.

---

## 4. Prior art, so the public pitch is honest

| Prior work | What it did | What is different here |
|---|---|---|
| Brooks, subsumption architecture (1986) | Robots run on layered reflexes; higher layers step in rarely | Your "self-driving on reflexes" is this. Reflex layers there were hand-coded rules, not language understanding |
| Game AI and robotics tick loops | Update every frame, 10 to 60 times a second | Standard. New here: a language-understanding judgment inside the tick |
| MemGPT / Letta (2023) | Heartbeat calls plus memory paging and summary | Your compaction. Theirs is LLM-driven, slow and costly per beat |
| Stanford Generative Agents "Smallville" (2023), AI Town, Project Sid (2024) | Watchable towns of LLM agents | Your Terrarium. Theirs ran slow and cost a lot because every step was an LLM call. Yours ticks every second for cents |
| Home Assistant automations | Rules that fire on state change | No semantic understanding. Cannot notice slow drift or "nothing happened" |

The claim to make: a **calibrated, typed, fast** judgment on every beat. Not "we built System 1 and System 2".

---

## 5. Is it a brain?

Closer to a **nervous system with a cortex on call**. The mapping holds well enough to use in public:

| Body | Terrarium |
|---|---|
| Senses | Sensor fields in the state |
| Brainstem, salience filter | The fast tick: "does anything here matter?" |
| Neurons charging to threshold | Leaky integrators per concern |
| Prefrontal cortex | System Two, called when something fires |
| Sleep | Compaction |
| Body clock | Clock and elapsed times in the state |

What the tick truly adds is **continuity**: a process that exists between prompts. Say that. Do not claim feeling.

---

## 6. Which world

| World | For | Against |
|---|---|---|
| Self-driving car | Reflex-level control fits System One in spirit | Jev is text only, unmeasured latency, no one will believe a text model drives. Keep it as a metaphor |
| Small office | Where your company would get business value | Sensors are calendars and chat. Dull to watch. Privacy problems in a public demo |
| **Home, simulated** | Everyone reads it at a glance. Rich, intuitive signals: light, heat, doors, motion, stove, time of day. Matches your list of senses. No hardware needed | Toy-like if we do not show the numbers. We will show the numbers |

Pick the home. Simulate it in code: rooms, sensors, a day clock, and a **resident** on a daily routine. The agent lives there as a **housemate**, a visible character with a visible brain. Later the same brain can point at your real calendar or office.

---

## 7. The Terrarium

Your word hunt: not zoo, not theater, not game.

- **Terrarium** (recommended). A sealed living world you watch. Honest: it is a closed simulation.
- **Aquarium.** Calm, ambient, people leave it on a screen. Good second choice.
- **Dollhouse.** Strong for the cutaway-house look. A bit childish.

What people watch:

1. **A cutaway house.** One full day passes in about 15 minutes. Light changes. Time is visible because time is the point.
2. **A heartbeat.** A pulse on every tick, with a soft sound. Viewers feel the rhythm.
3. **The brain panel.** Concerns as bars charging and leaking. A fire is a flash.
4. **The thinking moment.** When a concern fires, System Two's text streams into a thought bubble. Then the new question list visibly installs. Rare, so it feels like a person stopping to think.
5. **Sleep.** At night or when memory fills, the character sleeps and the memory panel shrinks from many lines to a few.
6. **The meter.** Live: milliseconds per tick, tokens per second, dollars per hour. This is the proof for a technical crowd.
7. **Poke the world.** Viewers type events in plain words: "water on the kitchen floor", "doorbell", "grandma stopped moving 20 minutes ago". The text goes straight into the state. Jev reads language, so no schema is needed. Viewers perturb the world, they do not chat with the agent.
8. **Side by side.** The same house with an LLM-only agent that wakes on events or every 30 seconds. It misses the stove left on and the resident who fell and stopped moving. One screen makes the argument.
9. **The ignored log.** Everything it saw and let pass. Calm is the feature.

---

## 8. Risks

- **Latency is unmeasured.** Measure first. If a 1.5K state answers in 300 ms, 1 tick per second still works.
- **Rate limits move.** Docs say so. Keep the fast state small regardless of cost.
- **English works best.** Docs say other languages are weaker. Keep the demo in English.
- **Calibration is per domain.** Docs say to validate in the target domain. Tune thresholds on our own simulated days.
- **Question bloat.** Cap the list. System Two prunes on every escalation.
- **Flicker.** Handled by the integrators.
- **Keys stay server-side.** Both TypeSafe and Anthropic keys live in the Node server, never in the page.

---

## 9. Plan

Stack: TypeScript end to end. Both TypeSafe and Anthropic ship JavaScript SDKs. Node server runs the brain, the browser renders over WebSocket.

| Step | What | Time |
|---|---|---|
| 1. Measure | Script that sends states of 0.5K, 2K, 8K, 32K tokens with 1, 5, 20 questions. Report p50 and p95 latency and cost. Decide the tick rate | Half a day |
| 2. Headless brain | Simulated house and resident, tick loop, state builder, question list, integrators, escalation to Claude Opus 5, compaction. Log every tick | 2 to 3 days |
| 3. Terrarium page | Cutaway house, brain panel, meter, poke box, side-by-side mode, sleep | 3 to 5 days |
| 4. Publish | Hosted page, a 60-second video, a write-up built on the one-line pitch | 1 day |

Step 1 needs a TypeSafe API key. Step 2 also needs an Anthropic key.

---

## 10. Open questions for Kaveh

1. Tick rate: 1 per second or 2? Decide after step 1.
2. Resident: a simulated person only, or your real data later?
3. Audience first: public page, or the company first?
