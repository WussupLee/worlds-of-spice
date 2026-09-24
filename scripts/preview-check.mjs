import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
await mkdir("outputs", { recursive: true });
const browser = await chromium.launch();
for (const [name, width, height] of [
  ["desktop", 1440, 1000],
  ["phone", 390, 844],
]) {
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 1,
    hasTouch: name === "phone",
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(process.env.TEST_URL || "http://localhost:3000/");
  await page.getByRole("button", { name: "PLAY PINBALL" }).waitFor();
  await page.locator('canvas[data-phase="ready"]').waitFor();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `outputs/${name}-welcome.png` });
  await page.getByRole("button", { name: "PLAY PINBALL" }).click();
  await page.locator('canvas[data-phase="playing"]').waitFor();
  await page.keyboard.down("Space");
  await page.waitForTimeout(500);
  await page.keyboard.up("Space");
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `outputs/${name}-play.png` });
  console.log(
    JSON.stringify({
      name,
      errors,
      score: await page.getByTestId("score").innerText(),
      canvas: await page.locator("canvas").boundingBox(),
      overflow: await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    }),
  );
  await page.close();
}
await browser.close();
