import { expect, it } from "vitest";
import { parseScores, parseSettings, restoreSettings } from "./storage";
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
  expect(parseSettings("oops").musicVolume).toBe(0.72);
});
it("applies the quiet score-led mix once without erasing mute or accessibility preferences", () => {
  const old = JSON.stringify({
    effectsVolume: 0.82,
    musicVolume: 0.34,
    ambienceVolume: 0.24,
    muted: true,
    reducedMotion: true,
    haptics: false,
    ballTrail: false,
  });
  const migrated = restoreSettings(null, old, false);
  expect(migrated).toMatchObject({
    effectsVolume: 0.24,
    musicVolume: 0.72,
    ambienceVolume: 0.03,
    muted: true,
    reducedMotion: true,
    haptics: false,
    ballTrail: false,
  });
  expect(
    restoreSettings(
      JSON.stringify({
        ...migrated,
        effectsVolume: 0.17,
        renderQuality: "sharp",
      }),
      old,
      false,
    ),
  ).toMatchObject({ effectsVolume: 0.17, renderQuality: "sharp" });
  expect(parseSettings('{"renderQuality":"invalid"}').renderQuality).toBe(
    "auto",
  );
});
