import { expect, it } from "vitest";
import { parseScores, parseSettings } from "./storage";
it("preserves score arrays and rejects malformed entries", () => {
  expect(
    parseScores(
      '[{"score":40,"date":"2026-09-23"},{"score":90,"date":"2026-09-24"}]',
    ).map((s) => s.score),
  ).toEqual([90, 40]);
  expect(parseScores('{"0":{"score":100}}')).toEqual([]);
  expect(parseScores("invalid")).toEqual([]);
});
it("clamps mixer settings and falls back safely for corrupt preferences", () => {
  expect(parseSettings('{"musicVolume":5,"effectsVolume":-1}')).toMatchObject({
    musicVolume: 1,
    effectsVolume: 0,
  });
  expect(parseSettings("oops").musicVolume).toBe(0.22);
});
