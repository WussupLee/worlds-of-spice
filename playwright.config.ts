import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  timeout: 40_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  workers: 2,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    launchOptions:
      process.platform === "win32"
        ? { args: ["--enable-gpu", "--use-angle=d3d11"] }
        : {},
    baseURL: "http://127.0.0.1:4173/worlds-of-spice/",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "node scripts/serve-pages.mjs",
    url: "http://127.0.0.1:4173/worlds-of-spice/",
    reuseExistingServer: !process.env.CI,
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
