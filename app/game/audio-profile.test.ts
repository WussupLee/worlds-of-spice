import { expect, it } from "vitest";
import { CINEMATIC_MIX, RECORDED_CLIPS, recordedCue } from "./audio-profile";
import { DEFAULT_SETTINGS } from "./types";
import { CUES } from "./engine";
import { SOUND_CATALOG, soundProfile } from "./sound-catalog";
import { readFileSync } from "node:fs";
it("routes every physical contact to an included real recording", () => {
  for (const cue of CUES.filter(
    (cue) => SOUND_CATALOG[cue].group === "Mechanisms",
  )) {
    for (const variant of [0, 1])
      expect(RECORDED_CLIPS).toContain(recordedCue(cue, variant)?.clip);
  }
});
it.each(RECORDED_CLIPS)(
  "%s contains audible PCM, not just a valid WAV header",
  (clip) => {
    const file = readFileSync(`public/audio/mechanics/${clip}.wav`);
    expect(file.toString("ascii", 0, 4)).toBe("RIFF");
    expect(file.readUInt32LE(24)).toBe(44100);
    expect(file.length).toBeGreaterThan(9000);
    expect(file.readUInt16LE(20)).toBe(1); // PCM
    expect(file.readUInt16LE(22)).toBe(1); // mono
    expect(file.readUInt16LE(34)).toBe(16);
    let offset = 12,
      start = -1,
      size = 0;
    while (offset + 8 <= file.length) {
      const length = file.readUInt32LE(offset + 4);
      if (file.toString("ascii", offset, offset + 4) === "data") {
        start = offset + 8;
        size = length;
        break;
      }
      offset += 8 + length + (length % 2);
    }
    expect(start).toBeGreaterThan(0);
    expect(start + size).toBeLessThanOrEqual(file.length);
    let peak = 0,
      energy = 0,
      audible = 0;
    for (let i = start; i < start + size; i += 2) {
      const sample = file.readInt16LE(i) / 32768;
      peak = Math.max(peak, Math.abs(sample));
      energy += sample * sample;
      if (Math.abs(sample) > 0.005) audible++;
    }
    expect(peak).toBeGreaterThan(0.5);
    expect(peak).toBeLessThan(0.8);
    expect(Math.sqrt(energy / (size / 2))).toBeGreaterThan(0.02);
    expect(audible / (size / 2)).toBeGreaterThan(0.08);
  },
);
it("has a documented, non-silent voice for every game event", () => {
  expect(Object.keys(SOUND_CATALOG).sort()).toEqual([...CUES].sort());
  for (const cue of CUES) {
    const p = soundProfile(cue);
    expect(p.trigger.length).toBeGreaterThan(12);
    expect(Boolean(p.clip) || Boolean(p.notes?.length)).toBe(true);
    expect(p.gain).toBeGreaterThan(0);
    expect(p.presence).toBeGreaterThanOrEqual(0);
    expect(p.presence).toBeLessThanOrEqual(1);
    for (const note of p.notes ?? []) expect(note).toBeGreaterThan(150);
  }
  expect(soundProfile("flipper", 1).clip).toBe("flipper-b");
  expect(soundProfile("bumper", 1).clip).toBe("bumper-b");
  expect(soundProfile("spinner").repeats).toEqual([0, 0.07, 0.16, 0.28, 0.44]);
  expect(soundProfile("bumper").presence).toBeGreaterThan(
    soundProfile("flipper").presence,
  );
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
