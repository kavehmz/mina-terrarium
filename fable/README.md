# Terrarium

One person, Mina, lives in a small home. Nothing about her day is scripted.

She has a brain in two parts, like the one in the driving demo, but pointed inward:

- **System One is TypeSafe's Jev.** Every second or so it reads the person's body (hunger, tiredness, hygiene, boredom, missing the other) and senses (the room, what can be heard, the phone, the other person if in sight) and answers a few typed questions: does something call for attention, is something wrong, does the other person need me, is my plan out of date, is it time for a duty, what is most pressing, how urgent, is there a reflex to do right here. Code charges a leaky integrator per feeling. Nothing here plans.
- **System Two is Claude.** When a feeling fires, when a plan ends, or when a message arrives, Claude is asked, as Mina with her life facts, what she wants to do. It returns an inner thought, a plan of one to five concrete steps, and a note for the fast layer. **While she thinks, the house clock runs at real time**, so a five-second thought costs five seconds of her life, not ten minutes of accelerated time.
- **The body is code.** It walks, cooks, showers, sleeps, talks, texts, goes out, and turns things off only when a brain decided to. Needs rise with time. The stove stays on if someone was interrupted. Consequences follow: smoke, water on the floor, an unlocked door.

The world adds only physics and outside events: the clock, daylight, a doorbell, a power cut, and whatever you poke.

## Run

```bash
cp ../.env.example ../.env      # TYPESAFE_API_KEY and ANTHROPIC_API_KEY live in the parent folder
docker compose up --build -d    # run from this folder; podman + docker-compose works too
open http://localhost:8080
docker compose logs -f          # every thought, plan and decision
```

Every run also writes a plain-text log to `logs/terrarium-<start time>.log` on the host: every event, thought, plan, reflex and error, plus a state line per person and for the house every 30 seconds. Paste or point at that file when something looks wrong.

Keys come from `../.env` only. Without a key the matching layer runs in mock mode (rules instead of Jev, a canned planner instead of Claude), clearly labelled. The brain runs only while a page is open. Pausing the house pauses it. Cost at 60x is roughly $1 an hour, most of it Claude. `PEOPLE=mina,otto` in `.env` brings back the two-person household.

## What you see

- **The house, 3D.** Labels say what Mina is doing. A pulse ring is a Jev tick, a violet halo is Claude thinking, a spotlight is where her attention is. The clock turns violet and says "real time while thinking" when time slows.
- **Left: what she feels and senses.** Body bars in words, the room, what can be heard, her phone. Nothing else reaches the brain.
- **Right: her System One and System Two.** The most pressing need, the feeling bars charging to the line, urgency, the latest thought, the plan with the current step, the note to the fast layer.
- **Bottom: the story so far** in plain sentences, the day bar, the last ten minutes of her brain.
- **Poke the world:** doorbell, stove, tap, door, smoke, power cut, a fall, or a phone message from an unknown number.
- **Inspect** (press I) shows the exact state Jev received, its answers, the questions, memory, and the log.

## Files

| File | What |
|---|---|
| `src/world.ts` | Physics and senses: rooms, devices, bodies and needs, the step executor, perception, outside events, consequences. |
| `src/agent.ts` | One person's brain: integrators, reflexes, escalation to System Two, memory compaction in sleep. |
| `src/questions.ts` | The standing questions for System One. |
| `src/system2.ts` | System Two: the Claude call, the plan schema, the persona prompt, a mock planner. |
| `src/jev.ts` | TypeSafe HTTP client with a mock fallback. |
| `src/server.ts` | HTTP and SSE, pokes, inspect, Three.js vendor routes. |
| `public/` | The page: Three.js scene, panels, app glue. |
| `docs/` | The brief and the verdicts that led here. |

## Env

`TYPESAFE_API_KEY`, `ANTHROPIC_API_KEY`, `SIM_SPEED` (default 60), `TYPESAFE_MODEL` (default `jev-latest`), `SYSTEM_TWO_MODEL` (default `claude-opus-5`; `claude-fable-5-1` works too), `PEOPLE` (default `mina`; `mina,otto` for two), `MINA_NAME`, `OTTO_NAME`, `ALWAYS_TICK=1` to keep the brain running with no viewer, `LOG_DIR`, `PORT`.
