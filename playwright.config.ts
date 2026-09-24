import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  timeout: process.env.CI ? 70_000 : 40_000,
  expect: { timeout: process.env.CI ? 15_000 : 8_000 },
  fullyParallel: true,
  workers: process.env.CI ? 1 : 2,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    launchOptions:
      process.platform === "win32" && !process.env.PINBALL_SOFTWARE_RENDERING
        ? { args: ["--enable-gpu", "--use-angle=d3d11"] }
        : {},
    baseURL: "http://127.0.0.1:4175/worlds-of-spice/",
    // Continuous screencasting forces WebGL readbacks on CPU-only CI runners.
    // Keep action/DOM traces; explicit verification/failure screenshots remain.
    trace: { mode: "retain-on-failure", screenshots: false, snapshots: true },
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "node scripts/serve-pages.mjs",
    url: "http://127.0.0.1:4175/worlds-of-spice/",
    reuseExistingServer: false,
  },
  projects: [
    {
      name: "desktop-chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
      },
    },
    { name: "android-chromium", use: { ...devices["Pixel 7"] } },
    {
      name: "iphone-webkit",
      use: { ...devices["iPhone 13"], launchOptions: {} },
    },
  ],
});
