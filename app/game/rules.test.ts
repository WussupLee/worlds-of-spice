import { describe, expect, it } from "vitest";
import { comboMultiplier, modeTarget, scoreMajorShot } from "./rules";

describe("Worlds of Spice rules", () => {
  it("caps combo scoring at five", () => {
    expect(comboMultiplier(9)).toBe(5);
  });

  it("gives flowing ramp routes a fixed bonus on the single table", () => {
    const base = scoreMajorShot({
      combo: 2,
      tableMultiplier: 1,
      shot: "caravan",
    });
    const boosted = scoreMajorShot({
      combo: 2,
      tableMultiplier: 1,
      shot: "harvest",
    });
    expect(boosted).toBeGreaterThan(base);
  });

  it("routes each mode to its intended shots", () => {
    expect(modeTarget("siege", "citadel", "storm")).toBe(true);
    expect(modeTarget("oracle", "storm", "storm")).toBe(true);
    expect(modeTarget("harvest", "caravan", "storm")).toBe(false);
  });
});
