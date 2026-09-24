import {
  DEFAULT_SETTINGS,
  type GameSettings,
  type HighScoreEntry,
} from "./types";
export function parseSettings(raw: string | null): GameSettings {
  try {
    const p = raw ? JSON.parse(raw) : {};
    const result = { ...DEFAULT_SETTINGS };
    for (const key of [
      "musicVolume",
      "effectsVolume",
      "ambienceVolume",
    ] as const)
      if (typeof p[key] === "number" && Number.isFinite(p[key]))
        result[key] = Math.min(1, Math.max(0, p[key]));
    for (const key of [
      "muted",
      "haptics",
      "reducedMotion",
      "ballTrail",
    ] as const)
      if (typeof p[key] === "boolean") result[key] = p[key];
    if (["auto", "sharp", "battery"].includes(p.renderQuality))
      result.renderQuality = p.renderQuality;
    return result;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}
/** Apply the new sound mix once while preserving mute and accessibility choices. */
export function restoreSettings(
  current: string | null,
  previous: string | null,
  reduceMotion: boolean,
): GameSettings {
  if (current) return parseSettings(current);
  const result = { ...DEFAULT_SETTINGS };
  if (previous) {
    const old = parseSettings(previous);
    for (const key of [
      "muted",
      "haptics",
      "reducedMotion",
      "ballTrail",
    ] as const)
      result[key] = old[key];
  } else result.reducedMotion = reduceMotion;
  return result;
}
export function parseScores(raw: string | null): HighScoreEntry[] {
  try {
    const p = JSON.parse(raw ?? "[]");
    if (!Array.isArray(p)) return [];
    return p
      .filter(
        (v) =>
          Number.isFinite(v?.score) &&
          v.score >= 0 &&
          typeof v.date === "string",
      )
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  } catch {
    return [];
  }
}
export function saveLocal(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Private browsing/storage limits must not interrupt a ball. */
  }
}
