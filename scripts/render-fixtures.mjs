// Isolated development visual fixtures; never imported by the shipped game.
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 600, height: 1000 },
  deviceScaleFactor: 1,
});
await mkdir("outputs", { recursive: true });
await page.goto("http://localhost:3000/");
await page.getByRole("button", { name: "PLAY PINBALL" }).waitFor();
await page.evaluate(async () => {
  const { PinballEngine } = await import("/app/game/engine.ts");
  const { TableRenderer } = await import("/app/game/renderer.ts");
  const { DEFAULT_SETTINGS } = await import("/app/game/types.ts");
  const canvas = document.createElement("canvas");
  canvas.style.cssText =
    "position:fixed;inset:0;width:600px;height:1000px;z-index:9999";
  document.body.append(canvas);
  const engine = new PinballEngine();
  engine.start();
  const renderer = new TableRenderer(canvas);
  renderer.resize();
  window.fixture = { engine, renderer, canvas, settings: DEFAULT_SETTINGS };
});
await page.waitForTimeout(500);
for (const mode of ["multiball", "wizard", "tilt"]) {
  const data = await page.evaluate((mode) => {
    const { engine: e, renderer: r, settings } = window.fixture;
    if (mode === "multiball") {
      e.launch(0.7);
      for (let i = 0; i < 3; i++) e.hitShot("citadel");
    }
    if (mode === "wizard") {
      e.completed = new Set(["harvest", "storm", "siege", "oracle"]);
      e.mode = null;
      e.multiballComplete = true;
      e.balls = e.balls.slice(0, 1);
      e.hitShot("citadel");
    }
    if (mode === "tilt") {
      e.tilted = true;
      e.releaseControls();
    }
    const samples = [];
    for (let i = 0; i < 120; i++) {
      const t = performance.now();
      e.advance(1 / 60);
      r.draw(e, settings, e.clock);
      samples.push(performance.now() - t);
    }
    // Deliberately capture the visual state without leaving a fixture API in production.
    return {
      mode,
      score: e.score,
      balls: e.balls.length,
      drawMedianMs: samples.sort((a, b) => a - b)[60],
      drawP95Ms: samples[114],
    };
  }, mode);
  console.log(JSON.stringify(data));
  await page.screenshot({ path: `outputs/fixture-${mode}.png` });
  await writeFile(
    `outputs/fixture-${mode}.json`,
    JSON.stringify(data, null, 2),
  );
}
await browser.close();
