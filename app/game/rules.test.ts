import { describe, expect, it } from "vitest";
import { ballSaveDuration, comboMultiplier, modeTarget, scoreMajorShot } from "./rules";

describe("Worlds of Spice rules", () => {
  it("caps combo scoring at five", () => {
    expect(comboMultiplier(9)).toBe(5);
  });

  it("gives harvesters a ramp bonus", () => {
    const base = scoreMajorShot({ combo: 2, tableMultiplier: 1, strategy: "warden", shot: "harvest" });
    const boosted = scoreMajorShot({ combo: 2, tableMultiplier: 1, strategy: "harvester", shot: "harvest" });
    expect(boosted).toBeGreaterThan(base);
  });

  it("routes each mode to its intended shots", () => {
    expect(modeTarget("siege", "citadel", "storm")).toBe(true);
    expect(modeTarget("oracle", "storm", "storm")).toBe(true);
    expect(modeTarget("harvest", "caravan", "storm")).toBe(false);
  });

  it("gives wardens a longer ball save", () => {
    expect(ballSaveDuration("warden")).toBe(12_000);
    expect(ballSaveDuration("oracle")).toBe(8_000);
  });
});
