// Isolated visual fixtures: never imported by the shipped application.
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const browser = await chromium.launch({
  args:
    process.platform === "win32" ? ["--enable-gpu", "--use-angle=d3d11"] : [],
});
const page = await browser.newPage({
  viewport: { width: 600, height: 1000 },
  deviceScaleFactor: 1,
});
await mkdir("outputs", { recursive: true });
await page.goto("http://localhost:3000/");
await page.getByRole("button", { name: "PLAY PINBALL" }).waitFor();
await page.evaluate(async () => {
  const engineModule = await import("/app/game/engine.ts");
  const { TableRenderer } = await import("/app/game/renderer.ts");
  const { DEFAULT_SETTINGS } = await import("/app/game/types.ts");
  const canvas = document.createElement("canvas");
  canvas.style.cssText =
    "position:fixed;inset:0;width:600px;height:1000px;z-index:9999;background:#090d11";
  document.body.append(canvas);
  const renderer = new TableRenderer(canvas);
  renderer.resize();
  window.fixture = {
    ...engineModule,
    renderer,
    settings: DEFAULT_SETTINGS,
    canvas,
  };
  const render = () => {
    if (window.fixture.engine)
      renderer.draw(
        window.fixture.engine,
        DEFAULT_SETTINGS,
        performance.now() / 1000,
      );
    requestAnimationFrame(render);
  };
  requestAnimationFrame(render);
});
for (const mode of [
  "underpass",
  "raised-return",
  "worm-capture",
  "multiball",
  "wizard",
  "tilt",
]) {
  const data = await page.evaluate((mode) => {
    const f = window.fixture,
      e = new f.PinballEngine();
    e.start();
    const b = e.balls[0];
    b.waiting = false;
    b.vx = 0;
    b.vy = 0;
    if (mode === "underpass" || mode === "raised-return") {
      Object.assign(b, f.pathPoint(f.RAMP_PATHS.harvest, 0.6));
      if (mode === "raised-return") {
        e.hitShot("harvest", b);
        b.path.elapsed = b.path.duration * 0.6;
      }
    }
    if (mode === "worm-capture") {
      e.hitShot("citadel", b);
      b.path.elapsed = 0.34;
      Object.assign(
        b,
        f.pathPoint(b.path.points, b.path.elapsed / b.path.duration),
      );
    }
    if (mode === "multiball" || mode === "wizard") {
      if (mode === "wizard") {
        e.completed = new Set(["harvest", "storm", "siege", "oracle"]);
        e.multiballComplete = true;
      }
      for (let i = 0; i < (mode === "wizard" ? 1 : 3); i++)
        e.hitShot("citadel");
      e.balls.forEach((ball, i) =>
        Object.assign(ball, {
          waiting: false,
          x: [220, 298, 405][i],
          y: [675, 410, 580][i],
        }),
      );
      e.targetBank = [true, true, false];
    }
    if (mode === "tilt") {
      b.x = 298;
      b.y = 775;
      e.tilted = true;
      e.releaseControls();
    }
    f.engine = e;
    return {
      mode,
      score: e.score,
      balls: e.balls.length,
      ballHeight: f.ballHeight(b),
      route: e.snapshot().ramp,
    };
  }, mode);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `outputs/fixture-${mode}.png` });
  await writeFile(
    `outputs/fixture-${mode}.json`,
    JSON.stringify(data, null, 2),
  );
  console.log(JSON.stringify(data));
}
await browser.close();
