// Render SVG figures to PNG at twice their size, for platforms that do not take SVG.
import { chromium } from "playwright";
import fs from "node:fs";
const dir = process.argv[2] ?? "/images";
const browser = await chromium.launch();
for (const f of fs.readdirSync(dir).filter(f => f.endsWith(".svg"))) {
  const svg = fs.readFileSync(`${dir}/${f}`, "utf8");
  const [, w, h] = /viewBox="0 0 (\d+) (\d+)"/.exec(svg);
  const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2 });
  await page.setContent(`<html><body style="margin:0">${svg}</body></html>`);
  await page.screenshot({ path: `${dir}/${f.replace(/\.svg$/, ".png")}` });
  await page.close();
  console.log("png", f);
}
await browser.close();
