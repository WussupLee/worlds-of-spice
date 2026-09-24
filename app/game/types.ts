export type StrategyId = "harvester" | "oracle" | "warden";
export type ModeId = "harvest" | "storm" | "siege" | "oracle";
export type ShotId = "caravan" | "harvest" | "citadel" | "dune" | "storm";
export type GamePhase = "ready" | "playing" | "paused" | "gameover";

export interface GameSnapshot {
  phase: GamePhase;
  score: number;
  balls: number;
  strategy: StrategyId;
  currentMode: ModeId | "multiball" | "wizard" | null;
  modeProgress: number;
  modesComplete: ModeId[];
  multiplier: number;
  prescienceShot: ShotId;
  combo: number;
  message: string;
  tilt: number;
  ballSave: number;
}

export interface GameSettings {
  audio: boolean;
  music: boolean;
  ambience: boolean;
  haptics: boolean;
  reducedMotion: boolean;
  ballTrail: boolean;
}

export interface HighScoreEntry {
  score: number;
  date: string;
  strategy: StrategyId;
}

export interface GameBridge {
  launch: () => void;
  pause: () => void;
  setFlipper: (side: "left" | "right", active: boolean) => void;
  nudge: (x: number, y: number) => void;
  destroy: () => void;
}

export const SHOT_ORDER: ShotId[] = ["caravan", "harvest", "citadel", "dune", "storm"];
export const MODE_ORDER: ModeId[] = ["harvest", "storm", "siege", "oracle"];

export const MODE_LABELS: Record<ModeId, string> = {
  harvest: "Harvest Rush",
  storm: "Stormfront",
  siege: "Siege of the Citadel",
  oracle: "Oracle's Trial",
};

export const STRATEGY_LABELS: Record<StrategyId, string> = {
  harvester: "Harvester",
  oracle: "Oracle",
  warden: "Warden",
};
