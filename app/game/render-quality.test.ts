import { expect, it } from "vitest";
import { RenderResolution } from "./render-quality";
it("renders phone art at native 3x while bounding oversized viewports", () => {
  const quality = new RenderResolution(false);
  expect(quality.ratio(390, 650, 3, "auto")).toBe(3);
  expect(quality.ratio(600, 1000, 3, "sharp")).toBeCloseTo(Math.sqrt(5));
  expect(quality.ratio(390, 650, 3, "battery")).toBe(1);
});
it("never permanently strands a hardware renderer at sub-native density", () => {
  const quality = new RenderResolution(false);
  for (let now = 0; now < 40; now += 0.05) quality.observe(0.05, now, "auto");
  expect(quality.ratio(390, 650, 3, "auto")).toBe(1);
  for (let now = 40; now < 80; now += 1 / 60)
    quality.observe(1 / 60, now, "auto");
  expect(quality.ratio(390, 650, 3, "auto")).toBe(3);
});
it("ignores pause gaps and respects maximum-clarity mode", () => {
  const quality = new RenderResolution(false);
  for (let i = 0; i < 20; i++) quality.observe(2, i * 2, "auto");
  for (let i = 0; i < 200; i++) quality.observe(0.1, 40 + i / 10, "sharp");
  expect(quality.ratio(390, 650, 3, "auto")).toBe(3);
});
it("retains a documented software-renderer fallback without overriding a clarity choice", () => {
  const quality = new RenderResolution(true);
  for (let i = 0; i < 20; i++) quality.observe(0.2, i * 0.2, "auto");
  expect(quality.ratio(390, 650, 3, "auto")).toBe(0.4);
  expect(quality.ratio(390, 650, 3, "sharp")).toBe(3);
});
