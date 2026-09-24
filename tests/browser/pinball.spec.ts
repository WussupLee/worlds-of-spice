import { test, expect, type Page } from "@playwright/test";

async function start(page: Page) {
  await page.goto("./");
  await page.getByRole("button", { name: "PLAY PINBALL" }).click();
  await expect(page.locator("canvas")).toHaveAttribute("data-phase", "playing");
}
async function launch(page: Page) {
  await page.keyboard.down("Space");
  await page.waitForTimeout(350);
  await page.keyboard.up("Space");
  await expect(page.getByTestId("score")).not.toHaveText("0000000");
}

test("complete cabinet fits the viewport and preserves the playfield aspect", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await start(page);
  const result = await page.evaluate(() => {
    const canvas = document.querySelector("canvas")!.getBoundingClientRect();
    const controls = document
      .querySelector(".control-deck")!
      .getBoundingClientRect();
    return {
      ratio: canvas.width / canvas.height,
      bottom: controls.bottom,
      height: innerHeight,
      overflowX: document.documentElement.scrollWidth > innerWidth,
      overflowY: document.documentElement.scrollHeight > innerHeight + 1,
    };
  });
  expect(result.ratio).toBeCloseTo(0.6, 2);
  expect(result.overflowX).toBe(false);
  expect(result.bottom).toBeLessThanOrEqual(result.height);
  expect(result.overflowY).toBe(false);
  await launch(page);
  await page.waitForTimeout(500);
  await page.screenshot({ path: info.outputPath("table.png") });
  expect(errors).toEqual([]);
});

test("both flippers work independently; pausing and dialogs release held inputs", async ({
  page,
}) => {
  await start(page);
  const canvas = page.locator("canvas");
  await page.keyboard.down("ArrowLeft");
  await page.keyboard.down("ArrowRight");
  await expect(canvas).toHaveAttribute("data-left", "true");
  await expect(canvas).toHaveAttribute("data-right", "true");
  await page.keyboard.up("ArrowLeft");
  await expect(canvas).toHaveAttribute("data-left", "false");
  await expect(canvas).toHaveAttribute("data-right", "true");
  await page.keyboard.press("p");
  await expect(canvas).toHaveAttribute("data-phase", "paused");
  await expect(canvas).toHaveAttribute("data-right", "false");
  await page.keyboard.up("ArrowRight");
  await page.getByRole("button", { name: "RETURN TO PLAY" }).click();
  await launch(page);
  await page.getByRole("button", { name: "How to play" }).click();
  await expect(canvas).toHaveAttribute("data-phase", "paused");
  const score = await page.getByTestId("score").textContent();
  await page.waitForTimeout(1100);
  await expect(page.getByTestId("score")).toHaveText(score!);
  await page.keyboard.press("Escape");
  await expect(canvas).toHaveAttribute("data-phase", "playing");
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(canvas).toHaveAttribute("data-phase", "paused");
});

test("native phone touch supports two held flippers and cancellation", async ({
  page,
  browserName,
  isMobile,
}) => {
  test.skip(
    browserName !== "chromium" || !isMobile,
    "CDP multi-touch runs on the Android profile.",
  );
  await start(page);
  const left = (await page
    .getByRole("button", { name: "Left flipper", exact: true })
    .boundingBox())!;
  const right = (await page
    .getByRole("button", { name: "Right flipper", exact: true })
    .boundingBox())!;
  const session = await page.context().newCDPSession(page);
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { id: 1, x: left.x + left.width / 2, y: left.y + left.height / 2 },
      { id: 2, x: right.x + right.width / 2, y: right.y + right.height / 2 },
    ],
  });
  await expect(page.locator("canvas")).toHaveAttribute("data-left", "true");
  await expect(page.locator("canvas")).toHaveAttribute("data-right", "true");
  await session.send("Input.dispatchTouchEvent", {
    type: "touchCancel",
    touchPoints: [],
  });
  await expect(page.locator("canvas")).toHaveAttribute("data-left", "false");
  await expect(page.locator("canvas")).toHaveAttribute("data-right", "false");
  const button = (await page
    .getByRole("button", { name: "Hold and release to launch" })
    .boundingBox())!;
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      {
        id: 3,
        x: button.x + button.width / 2,
        y: button.y + button.height / 2,
      },
    ],
  });
  await page.waitForTimeout(450);
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(page.getByTestId("score")).not.toHaveText("0000000");
  await session.detach();
});

test("sound graph plays, pauses and restores the three saved mixer controls", async ({
  page,
}) => {
  test.skip(
    !(await page.evaluate(() => typeof window.AudioContext === "function")),
    "This Windows WebKit build omits Web Audio; audio playback is verified in Chromium.",
  );
  await page.addInitScript(() => {
    const w = window as unknown as {
      AudioContext: typeof AudioContext;
      __audio: AudioContext[];
      __music: HTMLAudioElement[];
    };
    w.__audio = [];
    w.__music = [];
    const Original = w.AudioContext;
    w.AudioContext = class extends Original {
      constructor(options?: AudioContextOptions) {
        super(options);
        w.__audio.push(this);
      }
    };
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (this instanceof HTMLAudioElement && !w.__music.includes(this))
        w.__music.push(this);
      return play.call(this);
    };
  });
  await start(page);
  const getAudio = () =>
    page.evaluate(() => {
      const w = window as unknown as {
        __audio: AudioContext[];
        __music: HTMLAudioElement[];
      };
      return {
        state: w.__audio.at(-1)?.state,
        music: w.__music.at(-1)?.currentTime ?? 0,
        error: w.__music.at(-1)?.error?.message,
      };
    });
  await expect.poll(async () => (await getAudio()).state).toBe("running");
  await expect.poll(async () => (await getAudio()).music).toBeGreaterThan(0.1);
  expect((await getAudio()).error).toBeUndefined();
  await page
    .getByRole("button", { name: "Audio and display settings" })
    .click();
  await expect.poll(async () => (await getAudio()).state).toBe("suspended");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await expect.poll(async () => (await getAudio()).state).toBe("running");
});

test("all three mixer settings remain adjustable and persist after reload", async ({
  page,
}) => {
  await start(page);
  await page
    .getByRole("button", { name: "Audio and display settings" })
    .click();
  for (const [name, value] of [
    ["Pinball mechanisms", "31"],
    ["Desert score", "17"],
    ["Wind & shifting sand", "26"],
  ]) {
    const slider = page.getByRole("slider", { name: new RegExp(name) });
    await slider.focus();
    await slider.press("Home");
    for (let i = 0; i < Number(value); i++) await slider.press("ArrowRight");
  }
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.reload();
  await page
    .getByRole("button", { name: "Audio and display settings" })
    .click();
  await expect(
    page.getByRole("slider", { name: /Pinball mechanisms/ }),
  ).toHaveValue("31");
  await expect(page.getByRole("slider", { name: /Desert score/ })).toHaveValue(
    "17",
  );
  await expect(
    page.getByRole("slider", { name: /Wind & shifting sand/ }),
  ).toHaveValue("26");
});

test("small phones, landscape phones and laptops fit without stretching", async ({
  page,
  isMobile,
  browserName,
}, info) => {
  test.skip(
    isMobile || browserName !== "chromium",
    "Extra viewport sweep uses the desktop Chromium runner.",
  );
  await start(page);
  for (const [width, height] of [
    [320, 568],
    [360, 740],
    [844, 390],
    [1024, 768],
    [1366, 768],
  ]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(120);
    const bounds = await page.evaluate(() => {
      const c = document.querySelector("canvas")!.getBoundingClientRect();
      const controls = document
        .querySelector(".control-deck")!
        .getBoundingClientRect();
      return {
        ratio: c.width / c.height,
        center: c.x + c.width / 2,
        bottom: controls.bottom,
        documentHeight: document.documentElement.scrollHeight,
        documentWidth: document.documentElement.scrollWidth,
      };
    });
    expect(bounds.ratio, `${width}×${height} aspect`).toBeCloseTo(0.6, 2);
    expect(
      Math.abs(bounds.center - width / 2),
      `${width}×${height} centered`,
    ).toBeLessThan(15);
    expect(
      bounds.documentWidth,
      `${width}×${height} horizontal fit`,
    ).toBeLessThanOrEqual(width);
    expect(
      bounds.bottom,
      `${width}×${height} controls fit`,
    ).toBeLessThanOrEqual(height);
    expect(
      bounds.documentHeight,
      `${width}×${height} vertical fit`,
    ).toBeLessThanOrEqual(height + 1);
    await page.screenshot({
      path: info.outputPath(`viewport-${width}-${height}.png`),
    });
  }
});

test("a full three-ball game ends, records the score, and restarts cleanly", async ({
  page,
  isMobile,
  browserName,
}) => {
  test.skip(
    isMobile || browserName !== "chromium",
    "One full production lifecycle in Chromium; physics stress cases run separately.",
  );
  test.setTimeout(120_000);
  await start(page);
  await page.clock.install();
  let ended = false;
  for (let seconds = 0; seconds < 180; seconds++) {
    if (
      await page
        .getByRole("button", { name: "Hold and release to launch" })
        .isEnabled()
    )
      await page.keyboard.press("Space");
    await page.clock.runFor(1000);
    if (
      (await page.locator("canvas").getAttribute("data-phase")) === "gameover"
    ) {
      ended = true;
      break;
    }
  }
  expect(ended).toBe(true);
  const finalScore = Number(
    (await page.getByTestId("score").innerText()).replaceAll(",", ""),
  );
  expect(finalScore).toBeGreaterThan(0);
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("worlds-of-spice:scores:v1") || "[]"),
  );
  expect(stored[0].score).toBe(finalScore);
  await page.getByRole("button", { name: "ANOTHER ODYSSEY" }).click();
  await expect(page.getByTestId("score")).toHaveText("0000000");
  await expect(page.locator("canvas")).toHaveAttribute("data-phase", "playing");
});

test("the production game and ranged soundtrack work after an offline reload", async ({
  page,
  context,
  browserName,
}) => {
  test.skip(
    browserName !== "chromium",
    "Chromium verifies the offline service-worker artifact.",
  );
  await page.goto("./");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("button", { name: "PLAY PINBALL" }).click();
  await launch(page);
  const range = await page.evaluate(async () => {
    const response = await fetch("./audio/desert-theme.mp3", {
      headers: { Range: "bytes=0-1023" },
    });
    return {
      status: response.status,
      size: (await response.arrayBuffer()).byteLength,
      range: response.headers.get("Content-Range"),
    };
  });
  expect(range.status).toBe(206);
  expect(range.size).toBe(1024);
  expect(range.range).toMatch(/^bytes 0-1023\//);
  await context.setOffline(false);
});
