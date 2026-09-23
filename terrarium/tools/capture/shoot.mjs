// Stage a moment in Mina's life and photograph it, in a headless browser next to the Terrarium.
// Usage (from terrarium/): see README "Screenshots". Steps come from a JSON scenario file:
//   { "wait": 3000 }                        pause (ms)
//   { "until": "<js on snap>", "max": 90000 } wait until the expression is true for the live snapshot `s`
//   { "poke": "doorbell" | "leak" | ... }   change the world, as a viewer would
//   { "shot": "name" }                      save <out>/<name>.png
//   { "burst": "name", "n": 6, "every": 1500 } save name-1.png ... name-n.png
import { chromium } from "playwright";
import fs from "node:fs";

const [, , scenarioFile, outDir = "/out", base = "http://app:3000"] = process.argv;
const steps = JSON.parse(fs.readFileSync(scenarioFile, "utf8"));
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
page.on("pageerror", e => console.log("page error:", e.message));
await page.goto(base, { waitUntil: "load" });
await page.waitForFunction(() => window.terrarium?.snap, null, { timeout: 30000 });

const snapTrue = (expr) => page.evaluate((expr) => { const s = window.terrarium.snap; try { return Boolean(eval(expr)); } catch { return false; } }, expr);
const status = () => page.evaluate(() => { const s = window.terrarium.snap; return `${s.clock.hm} · ${s.person.where} · ${s.person.activity} · ${s.brain.thinking ? "thinking" : s.brain.intention?.decision ?? "-"}`; });

for (const st of steps) {
  if (st.wait) await page.waitForTimeout(st.wait);
  if (st.until) {
    const t0 = Date.now();
    while (!(await snapTrue(st.until))) {
      if (Date.now() - t0 > (st.max ?? 120000)) { console.log(`gave up waiting for: ${st.until}`); break; }
      await page.waitForTimeout(250);
    }
  }
  if (st.poke) {
    const r = await page.evaluate(async (b) => (await fetch("/api/poke", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) })).json(), { kind: st.poke, text: st.text });
    console.log("poke", st.poke, JSON.stringify(r));
  }
  if (st.shot) { await page.screenshot({ path: `${outDir}/${st.shot}.png` }); console.log("shot", st.shot, "·", await status()); }
  if (st.burst) {
    for (let i = 1; i <= (st.n ?? 5); i++) {
      await page.screenshot({ path: `${outDir}/${st.burst}-${i}.png` });
      console.log("shot", `${st.burst}-${i}`, "·", await status());
      await page.waitForTimeout(st.every ?? 1500);
    }
  }
}
await browser.close();
