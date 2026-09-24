import { soundProfile } from "./sound-catalog";
import type { Cue } from "./engine";

export const RECORDED_CLIPS = [
  "flipper-a",
  "flipper-b",
  "release",
  "bumper-a",
  "bumper-b",
  "plunger",
  "drain",
  "relay",
  "rolling",
] as const;
export type RecordedClip = (typeof RECORDED_CLIPS)[number];
export const CINEMATIC_MIX = {
  effects: 0.32,
  music: 0.7,
  air: 0.22,
  dry: 0.24,
  wet: 0.85,
  preDelay: 0.038,
  decay: 3.4,
} as const;
export function recordedCue(cue: Cue, variant: number) {
  const p = soundProfile(cue, variant);
  return p.clip ? { clip: p.clip, gain: p.gain, rate: p.rate } : undefined;
}
