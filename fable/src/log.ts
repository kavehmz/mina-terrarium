// A plain-text log on disk so a run can be read back later: every event, thought, plan, reflex, error,
// and a state summary every 30 seconds. One file per container start under LOG_DIR (default ./logs).
import fs from "node:fs";
import path from "node:path";

export class Log {
  file: string | null = null;
  private lines = 0;
  constructor() {
    const dir = process.env.LOG_DIR ?? "logs";
    try {
      fs.mkdirSync(dir, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      this.file = path.join(dir, `terrarium-${stamp}.log`);
      fs.writeFileSync(this.file, `# Terrarium log, started ${new Date().toISOString()}\n# columns: wall time | house clock | who | kind | text\n`);
    } catch (err) { console.warn("log: cannot write to", dir, (err as Error).message); this.file = null; }
  }
  write(houseClock: string, who: string, kind: string, text: string) {
    const line = `${new Date().toISOString().slice(11, 19)} | ${houseClock} | ${who.padEnd(6)} | ${kind.padEnd(8)} | ${text}`;
    if (!this.file) return;
    try { fs.appendFileSync(this.file, line + "\n"); this.lines++; } catch { /* disk trouble: keep running */ }
  }
}
