# Terrarium

Mina, 34, lives alone in a small house. Nothing about her day is scripted.

Her brain has two parts:

- **System One is TypeSafe Jev.** About once a second it reads her body, her senses, the clock, her phone and her current plan, and answers 11 typed questions in one request. Six of them are feelings ("my body needs something", "something is wrong", "someone / missing someone", "something I must do", "my plan no longer fits", "at a loose end"). Each feeling charges a leaky integrator. When one crosses its line, System One fires.
- **System Two is an LLM you choose in the top bar:** Claude Opus 5.5 (default), Claude Opus 5, Claude Haiku 4.5 or GPT-6 Luna (needs `OPENAI_API_KEY`). You can switch while she lives. It is called only when System One fires, when a plan ends or a step fails, or when she wakes up. It answers as Mina: a first-person thought, a short decision, a plan of 1–5 steps, and a note for System One to keep an eye on.
- **The body and the world are code.** Code runs physics and senses only: the clock, rooms and doorways, devices, needs rising with time, outside events and consequences. It carries out the steps System Two chose. It never decides what she wants.

## Run it

```bash
docker compose up -d --build        # from this folder; podman + docker-compose works
open http://localhost:3006
docker compose logs -f              # the same lines as the log file
docker compose down
```

- Keys come from `../.env` (`TYPESAFE_API_KEY`, `ANTHROPIC_API_KEY`) at runtime. They are never in the image or the browser.
- Nothing is installed on the host. Node, Three.js and the Anthropic SDK live in the image.
- `src/` and `public/` are mounted read-only, so `docker compose restart` picks up code edits.

## What you see

- **The chain, top centre:** ① what she feels → ② what Jev fired → ③ what Claude decided → ④ what her body is doing. This is the one line to follow.
- **Left:** her body in words (with bars), what she sees, hears, smells and feels, and her phone. Nothing else reaches her brain.
- **Right:** System One (the most pressing thing, the feelings charging to their line, urgency, mood) and System Two (why it was called, her thought, her plan, the note she left for System One).
- **The house:** room names on the floors, walls with doorways she walks through, and labels for anything left running (stove, taps, bath, TV, open door, water, smoke). When she goes out she walks to the bus stop and a card says where she is.
- **When she is out:** a live window above the bus stop shows where she is (the bus, the library, the café, the shop, the park, Leyla's flat, the gym, the doctor's), with her pose matching what she is doing. People appear in it only when the world says they are there.
- **Work life:** at the library, ordinary things come up every 35–80 minutes: a reader who needs help, a student stuck at the printer, a trolley of returns, Priya stopping by to chat, Dana asking a favour, the desk phone. They wait a while; ignored, they have consequences. Her brain decides whether to `attend` to them. While something waits for her, the clock slows to 6×.
- **Earlier thoughts:** under her current thought, the five before it, newest first (hover for why and which model).
- **Bottom:** the clock and its speed, the story in plain sentences, the last two minutes of ticks (a violet mark = Claude was called), her memory filling up, and **Poke her world**: doorbell, power cut, burst pipe, storm, a fall, or a text from an unknown number. You change the world, never her.
- **Inspect (press I):** the exact state Jev read, its raw answers, the questions, her memory and her recent thoughts.

## Time

- Quiet stretches run at the chosen speed (60× by default; real time, 10×, 30× and 120× are in the menu).
- **While she thinks, the world runs at real time.** A 5-second thought costs her 5 seconds, not 5 minutes. The same holds during a phone call, while the other person's side is written.
- While she walks, the world slows to 3×, so you can watch her move. When something is happening (doorbell, alarm, smoke alarm), it slows to 6×.

## Cost and pause

- **Pause** stops the world and both brains: no ticks, no calls, no cost. With no page open, everything stops by itself too (unless `ALWAYS_TICK=1`).
- The top bar shows dollars spent and the rate per hour. Measured numbers are in the log's state lines.
- Jev: about 3K tokens per tick at $0.042 per million tokens, so about $0.45 an hour at one tick a second.
- System Two, per decision at low effort (measured): Opus 5.5 ≈ $0.017–0.029, Opus 5 ≈ $0.017–0.036, Haiku 4.5 ≈ $0.005, GPT-6 Luna ≈ $0.0004. With Opus, System Two is most of the cost (about $1.10 per running hour at 60×). With GPT-6 Luna, Jev is.
- The same model also writes the other people's replies and her memory summaries.

## Memory

Everything she notices, decides and does goes into her memory. After 48 items it overflows: Jev marks each item keep or drop (one Noul per item, all in one request), and Claude folds the kept ones into a short "story so far". The same happens when she goes to bed.

## Logs

Every run writes three files to `./logs` on the host:

- `terrarium-<start>.log`: plain text. Every event, fire, thought, plan, reflex, error, plus a state line and a house line every 30 seconds.
- `ticks-<start>.jsonl`: every Jev tick with its answers and charges (the full state every 20th tick and on every fire).
- `mind-<start>.jsonl`: every System Two call with the exact prompt and output, and every memory compaction.

## Files

| File | What |
|---|---|
| `src/layout.mjs` | Floor plan, doorways, furniture spots, places away. Shared with the page. |
| `src/world.mjs` | Physics, senses, devices, needs, outside events, consequences, and the body carrying out steps. |
| `src/questions.mjs` | System One's standing questions. |
| `src/brain.mjs` | Ticks, integrators, reflexes, escalation to System Two, memory and compaction, other people. |
| `src/mind.mjs` | System Two: Mina's life facts, the prompt, the plan schema. |
| `src/llm.mjs` | The model switch: one structured call to Anthropic or OpenAI, with prices. |
| `src/contacts.mjs` | Leyla, Sam and Dana: they reply to her texts, take her calls, sometimes text first. |
| `src/jev.mjs` | TypeSafe HTTP client. |
| `src/server.mjs` | Main loop, time speeds, pause, live stream, pokes, inspect. |
| `public/` | The page: Three.js scene and panels. `away.mjs` draws the places she goes. |

## Settings (`../.env` or compose environment)

`SIM_SPEED` (60), `TICK_MS` (1000), `TYPESAFE_MODEL` (`jev-latest`), `SYSTEM_TWO_MODEL` (starting model: `claude-opus-5-5`, `claude-opus-5`, `claude-haiku-4-5` or `gpt-6-luna`), `OPENAI_API_KEY` (only for GPT-6 Luna), `SYSTEM_TWO_EFFORT` (`low`), `ALWAYS_TICK` (off), `START_HOUR` (6.5), `TERRARIUM_PORT` (3006).
