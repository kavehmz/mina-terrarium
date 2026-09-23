// One real System Two decision per model, on the same morning state Mina sees live.
import { World } from "../src/world.mjs";
import { Brain } from "../src/brain.mjs";
import { decide } from "../src/mind.mjs";
import { availableModels, setMindModel } from "../src/llm.mjs";
const world = new World({ startHour: 7 });
world.wake("woken by the alarm clock");
const brain = new Brain(world, { line() {}, tick() {}, mind() {} });
const state = brain.buildState();
for (const m of availableModels()) {
  setMindModel(m.id);
  try {
    const r = await decide({ state, reason: "she just woke up (woken by the alarm clock)", recentThoughts: [] });
    console.log(`${m.label.padEnd(17)} ${String(r.ms).padStart(5)} ms  $${r.cost.toFixed(4)}  “${r.out.thought}” → ${r.out.steps.map(s => s.do).join(", ")}`);
  } catch (e) { console.log(`${m.label.padEnd(17)} ERROR ${e.message}`); }
}
