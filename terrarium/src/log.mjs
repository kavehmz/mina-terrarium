// A plain-text log of everything Mina senses, feels, thinks and does, on the host (./logs).
// Plus two JSONL files with the full detail: every Jev tick, and every System Two call.
import fs from "node:fs";
import path from "node:path";

export function createLog(dir = process.env.LOG_DIR || "logs") {
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:]/g, "-").replace(/\..+/, "");
  const files = {
    text: path.join(dir, `terrarium-${stamp}.log`),
    ticks: path.join(dir, `ticks-${stamp}.jsonl`),
    mind: path.join(dir, `mind-${stamp}.jsonl`),
  };
  const text = fs.createWriteStream(files.text, { flags: "a" });
  const ticks = fs.createWriteStream(files.ticks, { flags: "a" });
  const mind = fs.createWriteStream(files.mind, { flags: "a" });
  text.write(`# Terrarium log, started ${new Date().toISOString()}\n# wall time | house clock | kind | text\n`);
  const wall = () => new Date().toTimeString().slice(0, 8);
  return {
    files,
    line(clock, kind, msg) {
      const l = `${wall()} | ${clock} | ${kind.padEnd(8)} | ${msg}\n`;
      text.write(l);
      if (process.env.LOG_STDOUT !== "0") process.stdout.write(l);
    },
    tick(obj) { ticks.write(JSON.stringify(obj) + "\n"); },
    mind(obj) { mind.write(JSON.stringify(obj) + "\n"); },
  };
}
