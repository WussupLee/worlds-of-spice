import type { Cue } from "./engine";
import type { RecordedClip } from "./audio-profile";

export interface SoundProfile {
  label: string;
  trigger: string;
  group: "Mechanisms" | "Rules & rewards";
  clip?: RecordedClip;
  gain: number;
  rate: number;
  presence: number;
  priority: number;
  notes?: readonly number[];
  noteGain?: number;
  duration?: number;
  spacing?: number;
  repeats?: readonly number[];
}
const mechanical = (
  label: string,
  trigger: string,
  clip: RecordedClip,
  gain: number,
  rate = 1,
  presence = 0.32,
  priority = 2,
): SoundProfile => ({
  label,
  trigger,
  group: "Mechanisms",
  clip,
  gain,
  rate,
  presence,
  priority,
});
const signal = (
  label: string,
  trigger: string,
  notes: readonly number[],
  gain = 0.24,
  spacing = 0.1,
): SoundProfile => ({
  label,
  trigger,
  group: "Rules & rewards",
  notes,
  gain: 1,
  rate: 1,
  presence: 0.55,
  priority: 3,
  noteGain: gain,
  duration: 0.22,
  spacing,
});

/** Exhaustive, user-visible ledger: an unhandled game cue is a type error. */
export const SOUND_CATALOG = {
  flipper: mechanical(
    "Flipper coil",
    "Press a flipper; not the ball striking it",
    "flipper-a",
    0.55,
    1,
    0,
    0,
  ),
  release: mechanical(
    "Flipper release",
    "Release a held flipper",
    "release",
    0.2,
    0.94,
    0,
    0,
  ),
  "flipper-hit": mechanical(
    "Ball on flipper",
    "Ball contacts a moving or resting flipper",
    "bumper-b",
    0.65,
    0.78,
    0.28,
    1,
  ),
  bumper: {
    ...mechanical(
      "Pop bumpers",
      "Contact any of the three active bumpers",
      "bumper-a",
      1.25,
    ),
    notes: [740],
    noteGain: 0.11,
    duration: 0.085,
  },
  sling: mechanical(
    "Slingshots",
    "Trigger either active triangular rubber",
    "bumper-b",
    1.05,
    0.8,
    0.4,
  ),
  rail: mechanical(
    "Rail / rubber contact",
    "Ball rebounds with meaningful speed",
    "release",
    0.55,
    1.25,
    0.25,
    0,
  ),
  "ball-hit": mechanical(
    "Ball-to-ball contact",
    "Two free balls collide during multiball",
    "release",
    0.8,
    1.45,
    0.4,
    1,
  ),
  drop: {
    ...mechanical(
      "Drop targets",
      "Hit a standing target",
      "relay",
      0.95,
      0.9,
      0.4,
    ),
    notes: [1060],
    noteGain: 0.1,
    duration: 0.075,
  },
  spinner: {
    ...mechanical(
      "Orbit spinners",
      "Orbit entry starts a slowing tick train",
      "relay",
      0.6,
      1.35,
      0.4,
    ),
    repeats: [0, 0.07, 0.16, 0.28, 0.44],
  },
  serve: mechanical(
    "Ball served",
    "New ball enters the shooter lane",
    "drain",
    0.65,
    1.1,
  ),
  pull: mechanical(
    "Plunger pull",
    "Begin holding Launch",
    "relay",
    0.5,
    0.72,
    0.22,
    1,
  ),
  launch: mechanical(
    "Plunger launch",
    "Release Launch with a waiting ball",
    "plunger",
    1.15,
    0.96,
    0.38,
  ),
  ramp: {
    ...mechanical(
      "Ramp entry",
      "Ball is captured onto either elevated ramp",
      "rolling",
      0.8,
      1,
      0.32,
    ),
    notes: [540, 720],
    noteGain: 0.12,
    duration: 0.12,
    spacing: 0.12,
  },
  gate: mechanical(
    "Ramp gate",
    "Ramp entry gate closes behind the ball",
    "release",
    0.6,
    1.15,
    0.3,
    1,
  ),
  "ramp-exit": mechanical(
    "Ramp landing",
    "Ball actually leaves the elevated return",
    "bumper-b",
    0.85,
    0.82,
    0.4,
  ),
  "orbit-exit": mechanical(
    "Orbit / launch return",
    "Ball leaves a constrained orbit or launch path",
    "release",
    0.85,
    1.05,
  ),
  scoop: mechanical(
    "Scoop capture",
    "Ball enters the Citadel pocket",
    "drain",
    0.85,
    0.76,
    0.32,
  ),
  "scoop-eject": mechanical(
    "Scoop kickout",
    "Ball is released from the Citadel pocket",
    "bumper-a",
    1.2,
    0.84,
    0.4,
  ),
  drain: mechanical(
    "Ball drain",
    "Ball enters the trough, including a saved ball",
    "drain",
    1,
    0.9,
    0.38,
  ),
  nudge: mechanical(
    "Cabinet nudge",
    "Accepted nudge before tilt lockout",
    "drain",
    0.28,
    0.65,
    0.12,
    0,
  ),
  "ball-search": mechanical(
    "Ball search",
    "Automatic recovery releases a stuck ball",
    "relay",
    0.7,
    0.8,
  ),
  inlane: signal(
    "Inlane rollover",
    "Downward crossing of an existing inner return lane",
    [720, 960],
    0.15,
    0.075,
  ),
  outlane: signal(
    "Outlane warning",
    "Downward crossing of an outer drain lane",
    [540, 360],
    0.17,
    0.1,
  ),
  shot: signal(
    "Orbit / launch score",
    "Orbit made, or ordinary launch enters the table",
    [440, 660],
    0.16,
    0.075,
  ),
  "skill-shot": signal(
    "Skill shot",
    "Selected Caravan launch at 60–80% power",
    [440, 660, 880],
    0.24,
  ),
  combo: signal(
    "Flow combo",
    "Second and subsequent major shots within four seconds",
    [587, 880],
    0.2,
    0.08,
  ),
  multiplier: signal(
    "Prescience multiplier",
    "Lit shot raises the multiplier, until its 5× cap",
    [660, 990],
    0.16,
  ),
  "bank-complete": signal(
    "Drop bank complete",
    "Third target awards spice cache and shield",
    [440, 587, 880],
    0.25,
  ),
  lock: {
    ...signal(
      "Citadel lock",
      "First or second open-play Citadel lock",
      [220, 440],
      0.22,
    ),
    clip: "relay",
    gain: 0.7,
    rate: 0.8,
  },
  save: signal(
    "Ball saved",
    "Active shield returns a drained ball",
    [494, 660, 988],
    0.25,
  ),
  mode: signal(
    "Territory starts",
    "Four open-play shots qualify the next territory",
    [294, 440, 587],
    0.24,
    0.14,
  ),
  "mode-progress": signal(
    "Territory progress",
    "A qualifying shot advances the active territory",
    [660, 784],
    0.17,
  ),
  "mode-failed": signal(
    "Territory expired",
    "Timed territory ends unfinished",
    [440, 330, 220],
    0.2,
  ),
  complete: signal(
    "Territory / Dominion complete",
    "Fourth territory shot, or surviving the finale",
    [440, 660, 880, 1174],
    0.28,
  ),
  multiball: {
    ...signal(
      "Wyrm multiball",
      "Third Citadel lock starts three-ball play",
      [155, 311, 466, 622],
      0.3,
      0.16,
    ),
    clip: "relay",
    gain: 0.8,
    rate: 0.7,
  },
  "multiball-end": signal(
    "Multiball ends",
    "Only one ball remains",
    [622, 466, 311],
    0.2,
    0.14,
  ),
  jackpot: signal(
    "Jackpot",
    "Major shot during multiball or Dominion",
    [740, 988, 1480],
    0.24,
    0.065,
  ),
  "super-jackpot": signal(
    "Super jackpot",
    "Citadel during multiball",
    [494, 740, 988, 1480],
    0.3,
    0.09,
  ),
  wizard: signal(
    "Dominion finale",
    "Citadel after four territories and multiball",
    [196, 294, 392, 588, 784],
    0.3,
    0.15,
  ),
  tilt: signal(
    "Tilt lockout",
    "Third rapid nudge disables flippers until drain",
    [277, 262, 277, 196],
    0.24,
    0.16,
  ),
  gameover: signal(
    "Game over",
    "Final unsaved ball drains",
    [587, 440, 294, 220],
    0.24,
    0.18,
  ),
  ui: signal("Game start", "Starting a new game", [440], 0.1),
} satisfies Record<Cue, SoundProfile>;

export function soundProfile(cue: Cue, variant = 0): SoundProfile {
  const profile: SoundProfile = SOUND_CATALOG[cue];
  if (cue === "flipper")
    return { ...profile, clip: variant % 2 ? "flipper-b" : "flipper-a" };
  if (cue === "bumper")
    return { ...profile, clip: variant % 2 ? "bumper-b" : "bumper-a" };
  return profile;
}
