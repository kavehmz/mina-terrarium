# Terrarium — user brief (consolidated)

Build an artificial human whose life runs on a two-system brain: **System One is TypeSafe's Jev**, ticking like a heartbeat over the body and the senses; **System Two is a strong LLM (Claude Opus or Fable)**, called only when System One fires, to decide what the person wants to do. Show her living in a small home, in a way a stranger can follow at a glance. Nothing about her behaviour is scripted.

This brief consolidates everything I said across the first session, in my words, with later corrections taking precedence. It is meant to stand on its own: if the local folders it mentions are not available to you, the descriptions here are enough. Where Claude proposed something and I went along with it, it is listed separately near the end with lower weight.

## 0. Instructions to the implementer

1. Read this whole file before doing anything. My words carry the most weight. Section 9 (decisions from the first build) is optional; everything else is a requirement.
2. Read the TypeSafe skill and the docs listed in section 8 as part of the work. Use them for this session only. **Do not install the skill.** Say so plainly if you could not read something completely.
3. Design your own implementation from this brief. The first implementation exists in `~/tmp/kmz/typesafe-time/fable`; look at it only as a reference for what I have already seen and criticised, not as something to copy. Its appearance may differ from yours. Preserve my intent.
4. Everything you build runs in Docker or Docker Compose. Do not install packages or apps on my Mac. My machine has podman with `docker` aliased to it and docker-compose available.
5. Keys are in `.env` next to this file: `TYPESAFE_API_KEY` and `ANTHROPIC_API_KEY`. They never reach the browser or the image. Really call TypeSafe and the LLM; never fake a decision.
6. Keep a log file on my machine, as section 6 describes, from the first run onward.
7. Build one version and show it to me running in the browser. Then we decide next steps together. Before you call it done, judge it yourself against section 7 and tell me honestly what fails.
8. Tell me the running cost and make sure pausing costs nothing.

---

## 1. Why I am doing this

- LLMs are good at judgment and processing, but not good or efficient at being **proactive**. To run my life or my office, something would have to ask them every half second: is there something to do here? Is there something to do here? That is not possible with an LLM.
- With Jev it is. Response time is in the low hundreds of milliseconds (I measured about 200 ms myself) and the cost is near nothing ($0.042 per million input tokens; output is free). That makes a heartbeat possible.
- The thing I am after is **feeling the passing of time**. My brain ticks. If I did not feel time passing I would be frozen, and my intelligence would look like an LLM's: triggered from outside, otherwise nothing. I have an internal trigger that includes time and other senses: light, pressure, pain, sound, hunger, and so on. All those signals go to a part of my brain that is very much like Jev. That part is what makes me feel alive. The smarter, slower part is the other system.
- I think this is a new concept and a very useful one. I want something visually pleasing that I can publish and get attention with, the way my self-driving demo did (about 116K views on LinkedIn). People could follow the car and see how Jev was deciding, visually, pleasantly, with low brain effort. I want the same here.

## 2. The concept, exactly

- **System One = Jev.** State plus questions, near real time, many calls, like a heartbeat: tick, tick, tick. It feels and notices. It does not plan.
- **Those ticks must end, like my own brain, in System Two calls.** System Two is a Fable or Opus call that decides, for example: "I have been sitting here for n hours and I have not heard from her, I miss her, I am curious what she is doing", or "I feel hungry, what do I want to do about it?" System One fires; System Two handles it.
- **The state** is an accumulation of smartly selected signals for the system being watched, up to Jev's limit (32K tokens for the state plus the longest question; 64K per request). **The questions** are an accumulation of questions for that system, or a few simple ones Jev answers every tick.
- **Escalation to the other system.** When System One fires, System Two gets the same state and gives back an elaborate but short line: a direction. The system continues; the state changes.
- **The state accumulates.** From time to time it reaches overflow. That is itself a signal to call System Two to **summarize and compact** the state.
- **Not scripted. This is the whole point.** The self-driving demo was not scripted: Jev actually drove. Here we show the real actions of an artificial person for the first time. No routine table, no "slot machine" core in Python that decides what she does. If she goes to work, it is because her System Two decided to, given the facts of her life. If she leaves the stove on, it is because something interrupted her and nobody thought of it.
- Code owns only **physics and senses**: rooms, devices, the clock, needs that rise with time, outside events (a doorbell, a power cut), and consequences (smoke after a stove is left on, water on the floor after a tap is left running). Code also **executes** what the brain chose, the way the car's code steered when Jev said "overtake".
- Are we creating a brain? Maybe. I do not need the claim; I need the behaviour.

**Jev in two lines (from the docs).** Jev is TypeSafe's "System One" model: you POST a `state` (text or JSON) plus a map of typed questions, and it returns typed answers with calibrated probabilities, no generated text. Three question types: **Noul** (probability that a yes/no statement holds), **Choice** (one option out of a set, with a probability per option and a confidence), **Score** (a position on ordered levels you describe). All questions in one request are evaluated in parallel over the same state. Keys: `TYPESAFE_API_KEY` for Jev, `ANTHROPIC_API_KEY` for System Two, both in `.env`.

## 3. What to build now

- **One person in one home.** Two people in one house was too much for a start. Switch to a single person and focus on making her a perfect artificial human with System One and System Two abilities. (The first build calls her Mina. Any character in this world must have a proper name; "Housemate" is a role, not a name.)
- **She lives her life.** Hunger, tiredness, needing a shower, boredom, loneliness, obligations such as work, and whatever else a person feels. System One feels it; System Two decides what she does about it; the body does it.
- **Self-driving was the reflex case.** To me a car can run purely on System One. A home cannot: it needs thinking from time to time. That is why the home is the right demo for the two-system idea.
- **Setup constraints.**
  - Run in Docker or Docker Compose. I do not want random packages or lots of apps installed on my MacBook. (My machine has podman with `docker` aliased to it, plus docker-compose.)
  - API keys are in `.env`, never in the browser or the image.
  - Read the whole TypeSafe skill and the live docs. Use them for the session only; **do not install the skill**. Be honest if you cannot read them completely.
  - Really call TypeSafe and the LLM. Do not fake decisions and make it look AI-controlled.
- **Cost and pause.** I care about tokens. When I pause, the simulation must stop and no tokens should be spent. Tell me the running cost.

## 4. Time

- The world runs on an accelerated clock (60x is a comfortable pace; 1x real time must be available).
- **Thinking must not let the world race.** A good LLM today is slow, nowhere near Jev. When System Two thinks, the world went by a lot in the first build and many things happened in between. That plus accelerated time makes the whole experience ridiculous. I asked: shall we freeze the world during System Two thinking, or is there a better idea? Either is fine as long as a thought does not cost her ten minutes of life. (Claude's answer and what the first build does is in section 9.)
- System One's ticks are fast enough that they do not need special handling at 60x.

## 5. Presentation

- I did not want a "demo" or a "game". I wanted something presentable and alive that people can just watch, an environment, a zoo or a theater for her, though those are bad words. (Claude proposed **Terrarium**; I use it.)
- **The benchmark is demo03**, my self-driving page. What worked there: one scene to follow, "what the car senses" on the left as pictures, "Jev decides" on the right as a plain-English headline with bars, a dashboard strip at the bottom, immediate cause and effect. Learn from it before designing anything.
- **My criticism of the first Terrarium page** (an abstract 2D house with dense panels): even for me, who asked for it, it took a while to find the information, to figure out what I am looking at and why the house looks like this; I saw "bathroom" mentioned and could not even find the bathroom. The brain seemed to work, with interesting sentences and claims, but visually the design was bad. Rethink from the viewer's side: low cognitive effort, one thing to follow, plain words.
- Things I noticed and want right: people must not walk through walls; "at work" must not look like hiding around the corner of the house; a character needs a name.
- The output is for the public. I will publish it and want a video clip later.

## 6. Debugging and logging

- Keep a **log** so that you can see whether her actions make sense, and so I can point you at it instead of copying and pasting what I see on the screen. Every event, every thought, every plan, every reflex, every error, and a periodic state summary, written to a file on my Mac.
- Issues I noticed and want checked once the basic setup is right: ringing the doorbell while she is asleep had no effect; some oddities with smoke and with the running tap.

## 7. How I will judge it

- Build one, show me, and then we decide the next steps. I want to see it running, not read about it.
- Her actions must make sense. I read the log and the screen and ask: would a person do this now? Walking through a wall, hiding round the corner "at work", bouncing home a minute after leaving, standing in the hall for a workday: these are failures.
- A stranger must be able to follow what she feels, what Jev fires, what System Two decided, and what the body does, with low brain effort, the way people followed the car.
- Nothing scripted. If I find a routine table or a rule that decides what she wants, the point is missed.
- Time must not race while she thinks. Pause must cost nothing.
- Run it in a container; touch nothing else on my Mac; real API calls only.

## 8. Reading material

Read these first, in this order. The skill says the live docs are the source of truth.

- TypeSafe skill (read, do not install): <https://github.com/typesafe-ai/skills/blob/main/skills/typesafe-ai/SKILL.md> — raw file: <https://raw.githubusercontent.com/typesafe-ai/skills/refs/heads/main/skills/typesafe-ai/SKILL.md>
- Docs index: <https://docs.typesafe.ai/llms.txt> (append `.md` to any page for Markdown)
- Models, price, limits: <https://docs.typesafe.ai/models>
- Concept pages: <https://docs.typesafe.ai/concepts/system-one>, <https://docs.typesafe.ai/concepts/how-to-build-with-system-one>, <https://docs.typesafe.ai/concepts/state>
- Primitives (Choice, Noul, Score): <https://docs.typesafe.ai/primitives>
- Confidence and routing: <https://docs.typesafe.ai/confidence>, <https://docs.typesafe.ai/patterns/confidence-routing>
- Speculative fan-out (many questions in one call): <https://docs.typesafe.ai/patterns/fan-out>
- HTTP API: <https://docs.typesafe.ai/api>
- My self-driving reference: `~/tmp/derivatives/typesafe/` — read `driving-simulation.md` (the brief in the same style as this one), `README.md`, `demo03/README.md`, the screenshot `docs/images/demo03-fable.png`, and the page code in `demo03/public/` for the grammar and styling.
- The first Terrarium: `~/tmp/kmz/typesafe-time/fable/` — `README.md`, `docs/01-brief-kaveh-verbatim.md` (my first messages verbatim), `docs/02-consolidated-reply.md`, `docs/02b-consolidated-reply-other-session.md`, `docs/03-reconciled-verdict.md`, and `logs/` for real runs.

Facts learned in the first session, worth knowing before you start:

- Jev 1.13 answered in about 300 ms at roughly 2K tokens per tick; the docs give no latency number. Price $0.042 per million input tokens, output free. 250K tokens/s and 1,200 requests/min, said to change without notice.
- Ask all of a tick's questions in one request; Jev evaluates them in parallel and it is about ten times cheaper and faster than separate calls.
- Anthropic's TypeScript SDK structured-output helper needs zod v4.
- Chrome pauses animation frames in hidden tabs; the page must not depend on a visible tab for correctness.

## 9. Decisions taken together in the first build (lower weight)

These were Claude's proposals that I accepted or did not object to. Keep them unless something better serves sections 1 to 6.

- Name **Terrarium** for the watchable environment.
- The world is a **home**, shown as a **3D dollhouse in a glass box** (Three.js), with the demo03 three-panel grammar: what she senses on the left, her System One and System Two on the right, story and controls at the bottom, plain-sentence story lines, a strip of the last ten minutes of the brain.
- The person is **Mina**, 34, works at the city library on weekdays; her sister Leyla and friend Sam exist as phone contacts. Life facts, not behaviour.
- Body needs in code: hunger, energy, hygiene, boredom, connection. Words for Jev, numbers for the viewer.
- System One standing questions per tick: something calls for attention; something is wrong; people I care about; time for something I must do; my plan is out of date (Nouls with **leaky integrators** that charge while Jev keeps saying yes and fire at a threshold); most pressing need (Choice); urgency (Score); a small reflex (Choice: turn off the stove or tap right here, wake someone).
- System Two returns a first-person **thought**, a **plan of one to five steps** from a fixed vocabulary (go_to, cook, eat, shower, sleep, nap, watch_tv, read, rest, talk, message, check_on, go_out, come_home, turn_off, lights, lock/unlock door, answer_door, call_emergency, wait), and a **note for System One**. System Two is also called when a plan ends and when a message arrives. `go_out` means leave and stay out until `come_home`.
- **Time:** instead of freezing, the house runs at **real time while System Two thinks**, then resumes the accelerated speed. A five-second thought costs five seconds of her life.
- **Memory:** her perceptions fill a memory; when it is full or in the night she "sleeps": Jev marks what is still relevant, System Two writes the summary.
- The brain **runs only while a page is open** (or `ALWAYS_TICK=1`), and pausing the house pauses the brain. Cost at 60x about $1 an hour, most of it Claude.
- Viewers can **poke the world** (doorbell, stove, tap, door, smoke, power cut, a fall) and **text her** from an unknown number. They do not command her.
- A second person (Otto) exists behind `PEOPLE=mina,otto`, parked for now.

## 10. Key sentences of mine, lightly cleaned for typos

- "We are not able to ping these guys every half a second and ask them: is there something to do here? That's not possible, but amazingly, with Jev, I think we can."
- "Every half a second, tap, tap, tap, like the beating of a heart. When it taps, we have the state. And a series of questions. A few simple questions Jev answers, and escalation to System Two."
- "From time to time the state reaches overflow. That will be another indication that it should call the other system to summarize and compact the state."
- "I'm feeling the passing of time. If I don't feel the passing of time, I'm frozen. Even my intelligence becomes very similar to you. Something in my brain is ticking."
- "Not just passing of time: light, pressure, pain, sound. All of them go to the part of my brain that is very similar to Jev. This is the part that is making me feel alive."
- "Something presentable and kind of alive, in an environment that people can just watch."
- "Whatever you build must run inside docker/compose. I do not want to install random or lots of packages and apps on my macOS."
- "People were able to follow the car and how Jev was deciding, visually and pleasantly and with low brain effort. Here, even for me who asked you to do this, it is taking a while to find the information and figure out what I am looking at."
- "We use Jev as System One, state and decision almost real time, many calls, but that must end up, like my own brain, into System Two calls. 'I was sitting here for n hours and I did not hear from Mina', 'I feel hungry', System One fires, and System Two decides what I want to do about it."
- "No scripted stuff. The self-driving was not scripted, correct? Here we are showing the real actions for the first time to others."
- "Keep a log so you see if actions make sense; easier to debug later rather than me copy-pasting what I see on the screen."
- "Two persons in one home is too much for our start. Switch to a one-person home and focus on making her a perfect artificial human with System One and System Two abilities."
- "When she is thinking the clock is still running. A good LLM these days is very slow, not even close to Jev. That plus our accelerated time must not make the whole experience ridiculous."
