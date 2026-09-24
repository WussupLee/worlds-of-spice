export type ModeId = "harvest" | "storm" | "siege" | "oracle";
export type ShotId = "caravan" | "harvest" | "citadel" | "dune" | "storm";
export type GamePhase = "ready" | "playing" | "paused" | "gameover";
export interface GameSettings {
  effectsVolume: number;
  musicVolume: number;
  ambienceVolume: number;
  muted: boolean;
  haptics: boolean;
  reducedMotion: boolean;
  ballTrail: boolean;
}
export const DEFAULT_SETTINGS: GameSettings = {
  effectsVolume: 0.48,
  musicVolume: 0.22,
  ambienceVolume: 0.3,
  muted: false,
  haptics: true,
  reducedMotion: false,
  ballTrail: true,
};
export interface GameSnapshot {
  phase: GamePhase;
  score: number;
  balls: number;
  currentMode: ModeId | "multiball" | "wizard" | null;
  modeProgress: number;
  modeSeconds: number;
  modesComplete: ModeId[];
  multiplier: number;
  prescienceShot: ShotId;
  combo: number;
  message: string;
  instruction: string;
  tilt: number;
  tilted: boolean;
  ballSave: number;
  waiting: boolean;
  locks: number;
  charge: number;
  activeBalls: number;
  multiballComplete: boolean;
  peakMultiplier: number;
}
export interface HighScoreEntry {
  score: number;
  date: string;
}
export const SHOT_ORDER: ShotId[] = [
  "caravan",
  "harvest",
  "citadel",
  "dune",
  "storm",
];
export const MODE_ORDER: ModeId[] = ["harvest", "storm", "siege", "oracle"];
export const MODE_LABELS: Record<ModeId, string> = {
  harvest: "Harvest Rush",
  storm: "Stormfront",
  siege: "Citadel Siege",
  oracle: "Oracle’s Trial",
};
export const SHOT_LABELS: Record<ShotId, string> = {
  caravan: "Caravan orbit",
  harvest: "Harvest ramp",
  citadel: "Citadel scoop",
  dune: "High Dune ramp",
  storm: "Storm orbit",
};
