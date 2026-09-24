import { expect, it } from "vitest";
import { CINEMATIC_MIX, RECORDED_CLIPS, recordedCue } from "./audio-profile";
import { DEFAULT_SETTINGS } from "./types";
import type { Cue } from "./engine";
import { readFileSync } from "node:fs";
it("routes every physical contact to an included real recording", () => {
  for (const cue of [
    "flipper",
    "release",
    "bumper",
    "sling",
    "rail",
    "drop",
    "spinner",
    "launch",
    "drain",
    "scoop",
    "ramp",
    "nudge",
  ] as Cue[]) {
    for (const variant of [0, 1])
      expect(RECORDED_CLIPS).toContain(recordedCue(cue, variant)?.clip);
  }
  for (const clip of RECORDED_CLIPS) {
    const file = readFileSync(`public/audio/mechanics/${clip}.wav`);
    expect(file.toString("ascii", 0, 4)).toBe("RIFF");
    expect(file.readUInt32LE(24)).toBe(44100);
    expect(file.length).toBeGreaterThan(9000);
  }
});
it("makes the score primary, with a long wet effect and whisper-level air", () => {
  expect(DEFAULT_SETTINGS.musicVolume * CINEMATIC_MIX.music).toBeGreaterThan(
    DEFAULT_SETTINGS.effectsVolume * CINEMATIC_MIX.effects * 6,
  );
  expect(DEFAULT_SETTINGS.ambienceVolume * CINEMATIC_MIX.air).toBeLessThan(
    0.01,
  );
  expect(CINEMATIC_MIX.wet).toBeGreaterThan(CINEMATIC_MIX.dry * 3);
  expect(CINEMATIC_MIX.decay).toBeGreaterThan(3);
});
