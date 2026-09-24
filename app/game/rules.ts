import type { ModeId, ShotId } from "./types";

export const SCORE = {
  sling: 100,
  bumper: 250,
  target: 500,
  lane: 1_000,
  majorShot: 5_000,
  modeShot: 25_000,
  modeComplete: 250_000,
  jackpot: 50_000,
  superJackpot: 250_000,
  wizardShot: 100_000,
} as const;

export function comboMultiplier(combo: number) {
  return Math.min(5, Math.max(1, combo));
}

export function scoreMajorShot(input: {
  combo: number;
  tableMultiplier: number;
  shot: ShotId;
}) {
  const routeBonus =
    input.shot === "harvest" || input.shot === "dune" ? 1.25 : 1;
  return Math.round(
    SCORE.majorShot *
      comboMultiplier(input.combo) *
      input.tableMultiplier *
      routeBonus,
  );
}

export function modeTarget(mode: ModeId, shot: ShotId, oracleShot: ShotId) {
  if (mode === "harvest") return shot === "harvest" || shot === "dune";
  if (mode === "storm") return shot === "storm" || shot === "caravan";
  if (mode === "siege") return shot === "citadel";
  return shot === oracleShot;
}
