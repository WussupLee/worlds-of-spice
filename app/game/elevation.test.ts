import { describe, expect, it } from "vitest";
import {
  PinballEngine,
  STEP,
  BALL_RADIUS,
  ballHeight,
  rampHeight,
  TARGETS,
} from "./engine";

const advance = (e: PinballEngine, seconds: number) => {
  for (let i = 0; i < seconds / STEP; i++) e.advance(STEP);
};
function ballAt(x: number, y: number, vy = -400) {
  const e = new PinballEngine();
  e.start();
  const b = e.balls[0];
  Object.assign(b, { x, y, vx: 0, vy, waiting: false });
  return { e, b };
}
describe("physical elevation and mechanism contracts", () => {
  it("low rendering frame rates do not slow the simulation clock", () => {
    const slow = ballAt(300, 560, 0).e,
      fast = ballAt(300, 560, 0).e;
    for (let i = 0; i < 10; i++) slow.advance(0.1);
    for (let i = 0; i < 60; i++) fast.advance(1 / 60);
    expect(slow.clock).toBeCloseTo(1, 2);
    expect(slow.clock).toBeCloseTo(fast.clock, 2);
    expect(slow.score).toBe(fast.score);
    expect(slow.balls[0].x).toBeCloseTo(fast.balls[0].x, 1);
    expect(slow.balls[0].y).toBeCloseTo(fast.balls[0].y, 1);
  });
  it("both wireforms start and end at the playfield, with a continuous raised bridge", () => {
    expect(rampHeight(0)).toBe(0);
    expect(rampHeight(1)).toBe(0);
    expect(rampHeight(0.5)).toBe(92);
    for (let i = 1; i <= 1000; i++)
      expect(
        Math.abs(rampHeight(i / 1000) - rampHeight((i - 1) / 1000)),
      ).toBeLessThan(0.5);
  });
  it("an ascending entrance captures a ball onto the raised track; its return is grounded", () => {
    for (const x of [153, 443]) {
      const { e, b } = ballAt(x, 437);
      advance(e, 0.05);
      expect(b.path?.kind).toBe("ramp");
      advance(e, 0.67);
      expect(ballHeight(b)).toBeGreaterThan(95);
      expect(e.snapshot().ramp).toBe(x === 153 ? "harvest" : "dune");
      advance(e, 0.85);
      expect(b.path).toBeUndefined();
      expect(ballHeight(b)).toBe(BALL_RADIUS);
    }
  });
  it("a ground ball under a return does not teleport onto it or earn a ramp shot", () => {
    const { e, b } = ballAt(102, 555, -200);
    advance(e, 0.1);
    expect(b.path).toBeUndefined();
    expect(e.majorShots).toBe(0);
    expect(ballHeight(b)).toBe(BALL_RADIUS);
  });
  it("a ball moving down through a ramp entrance is not captured", () => {
    const { e, b } = ballAt(153, 423, 250);
    advance(e, 0.1);
    expect(b.path).toBeUndefined();
    expect(e.majorShots).toBe(0);
  });
  it("a raised ball cannot hit ground-level bumpers or drop targets", () => {
    const { e, b } = ballAt(153, 437);
    e.hitShot("harvest", b);
    const score = e.score;
    advance(e, 1.3);
    expect(e.score).toBe(score);
    expect(e.targetBank).toEqual([false, false, false]);
  });
  it("dropped targets no longer collide with the ball", () => {
    const p = TARGETS[1];
    const { e, b } = ballAt(p.x, p.y + 22, -450);
    e.targetBank[1] = true;
    advance(e, 0.085);
    expect(b.y).toBeLessThan(p.y);
    expect(b.vy).toBeLessThan(0);
    expect(e.score).toBe(0);
  });
  it("the scoop eject clears the pop nest instead of farming an endless recapture", () => {
    const { e, b } = ballAt(298, 177);
    e.hitShot("citadel", b);
    advance(e, 4);
    expect(e.majorShots).toBe(1);
    expect(b.y).toBeGreaterThan(350);
  });
});
