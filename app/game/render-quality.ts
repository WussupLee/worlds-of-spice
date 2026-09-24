import type { GameSettings } from "./types";
export type RenderQuality = GameSettings["renderQuality"];
/** Adaptive resolution with a native-pixel floor on real GPUs and recovery. */
export class RenderResolution {
  private level = 0;
  private slow = 0;
  private fast = 0;
  private changedAt = -100;
  constructor(readonly software: boolean) {}
  reset() {
    this.level = 0;
    this.slow = this.fast = 0;
    this.changedAt = -100;
  }
  ratio(width: number, height: number, dpr: number, mode: RenderQuality) {
    const native = Math.max(
      1,
      Math.min(dpr || 1, 3, Math.sqrt(3_000_000 / Math.max(1, width * height))),
    );
    if (mode === "sharp") return native;
    if (mode === "battery") return this.software ? 0.4 : 1;
    if (this.software) return this.level ? 0.4 : 0.6;
    return Math.min(native, [3, 2, 1.5, 1][this.level]);
  }
  observe(seconds: number, now: number, mode: RenderQuality) {
    // Ignore resume/hidden-tab gaps; they aren't evidence of a slow GPU.
    if (mode !== "auto" || seconds <= 0 || seconds > 0.5) return false;
    const slowLimit = this.software ? 0.045 : 0.034;
    this.slow =
      seconds > slowLimit
        ? this.slow + seconds
        : Math.max(0, this.slow - seconds * 2);
    this.fast = seconds < 0.021 ? this.fast + seconds : 0;
    if (now - this.changedAt < 6) return false;
    if (
      this.slow > (this.software ? 1 : 3) &&
      this.level < (this.software ? 1 : 3)
    ) {
      this.level++;
      this.slow = this.fast = 0;
      this.changedAt = now;
      return true;
    }
    if (!this.software && this.fast > 8 && this.level > 0) {
      this.level--;
      this.fast = this.slow = 0;
      this.changedAt = now;
      return true;
    }
    return false;
  }
}
