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
export function recordedCue(
  cue: Cue,
  variant: number,
): { clip: RecordedClip; gain: number; rate: number } | undefined {
  const flip = variant % 2 ? "flipper-b" : "flipper-a";
  const bump = variant % 2 ? "bumper-b" : "bumper-a";
  switch (cue) {
    case "flipper":
      return { clip: flip, gain: 0.88, rate: 1 };
    case "release":
      return { clip: "release", gain: 0.3, rate: 0.94 };
    case "bumper":
      return { clip: bump, gain: 0.8, rate: 0.94 };
    case "sling":
      return { clip: bump, gain: 0.6, rate: 0.82 };
    case "rail":
      return { clip: "release", gain: 0.28, rate: 1.18 };
    case "drop":
      return { clip: "relay", gain: 0.56, rate: 0.86 };
    case "spinner":
      return { clip: "relay", gain: 0.32, rate: 1.2 };
    case "launch":
      return { clip: "plunger", gain: 0.67, rate: 0.96 };
    case "drain":
      return { clip: "drain", gain: 0.58, rate: 0.9 };
    case "scoop":
      return { clip: "drain", gain: 0.5, rate: 0.76 };
    case "ramp":
      return { clip: "rolling", gain: 0.4, rate: 1 };
    case "nudge":
      return { clip: "drain", gain: 0.18, rate: 0.65 };
    default:
      return undefined;
  }
}
