// Desktop GPU measurements at mobile viewport sizes, NOT real-phone benchmarks.
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const browser = await chromium.launch({
  args:
    process.platform === "win32" ? ["--enable-gpu", "--use-angle=d3d11"] : [],
});
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  hasTouch: true,
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(process.env.TEST_URL || "http://localhost:3000/");
await page.getByRole("button", { name: "PLAY PINBALL" }).click();
await page.keyboard.down("Space");
await page.waitForTimeout(550);
await page.keyboard.up("Space");
await page.waitForTimeout(1500);
const result = await page.locator("canvas").evaluate(async (canvas) => {
  const gl = canvas.getContext("webgl2");
  const ext = gl.getExtension("WEBGL_debug_renderer_info");
  const samples = [];
  let last = performance.now();
  for (let i = 0; i < 180; i++) {
    await new Promise(requestAnimationFrame);
    const now = performance.now();
    samples.push(now - last);
    last = now;
    if (i % 20 === 0)
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          code: i % 40 === 0 ? "ArrowLeft" : "ArrowRight",
        }),
      );
    if (i % 20 === 10) {
      window.dispatchEvent(new KeyboardEvent("keyup", { code: "ArrowLeft" }));
      window.dispatchEvent(new KeyboardEvent("keyup", { code: "ArrowRight" }));
    }
  }
  samples.sort((a, b) => a - b);
  return {
    gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "unavailable",
    viewport: [innerWidth, innerHeight],
    devicePixelRatio,
    raster: [canvas.width, canvas.height],
    phase: canvas.dataset.phase,
    renderer: canvas.dataset.renderer,
    drawCalls: canvas.dataset.drawcalls,
    frameMedianMs: samples[90],
    frameP95Ms: samples[171],
    sampleCount: samples.length,
  };
});
await mkdir("outputs", { recursive: true });
await page.screenshot({ path: "outputs/phone-final.png" });
await writeFile(
  "outputs/render-performance.json",
  JSON.stringify({ ...result, errors }, null, 2),
);
console.log(JSON.stringify({ ...result, errors }, null, 2));
await browser.close();
