// Physics checks without any API call: doorbell while asleep, stove left on, bath left running.
import { World } from "../src/world.mjs";
const run = (w, minutes) => { for (let i = 0; i < minutes * 12; i++) w.step(5); };
const say = (...a) => console.log(...a);

// 1. Doorbell while she sleeps at night: does the ring wake her?
let woke = 0;
for (let k = 0; k < 20; k++) {
  const w = new World({ startHour: 3 }); w.d.alarmClock.at = null;
  w.poke("doorbell"); run(w, 10);
  if (w.person.awake) woke++;
}
say(`doorbell at 03:00 woke her in ${woke}/20 runs (visitor rings every 2.5 min, waits 6-9 min)`);

// 2. Stove left on with food, nobody there: burning, smoke, alarm.
{
  const w = new World({ startHour: 12 }); w.person.awake = true;
  Object.assign(w.d.stove, { on: true, dish: "pasta", cooked: 0, state: "heating" });
  const seen = [];
  w.on(e => seen.push(`${e.clock} ${e.kind}: ${e.text}`));
  run(w, 40);
  say("stove left on for 40 min:", seen.filter(s => /stove|burn|smoke/i.test(s)).join(" | "), `| smoke kitchen ${w.d.smoke.kitchen.toFixed(2)} hall ${w.d.smoke.hall.toFixed(2)}`);
}
// 3. Bath tap left running: overflow and water spreading to the hall.
{
  const w = new World({ startHour: 19 }); w.person.awake = true;
  w.d.bath.tap = true;
  const seen = []; w.on(e => seen.push(`${e.clock} ${e.text}`));
  run(w, 40);
  say("bath left running 40 min:", seen.join(" | "), `| water bathroom ${w.d.water.bathroom.toFixed(2)} hall ${w.d.water.hall.toFixed(2)}`);
}
// 4. Kitchen tap left running: heard from next room, not from far away.
{
  const w = new World({ startHour: 19 }); w.person.awake = true; w.d.kitchen_tap = true;
  for (const room of ["kitchen", "dining", "living"]) { w.person.room = room; say(`tap running, she is in ${room}: hears`, JSON.stringify(w.senses().hear)); }
}
