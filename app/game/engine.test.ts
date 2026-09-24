import { describe, expect, it } from "vitest";
import { PinballEngine, STEP, type Ball } from "./engine";
import { MODE_ORDER } from "./types";
const seconds = (e: PinballEngine, n: number) => {
  for (let i = 0; i < Math.ceil(n / STEP); i++) e.advance(STEP);
};
const playing = () => {
  const e = new PinballEngine();
  e.start();
  return e;
};
const place = (
  e: PinballEngine,
  x: number,
  y: number,
  vx = 0,
  vy = 0,
): Ball => {
  const b = e.balls[0];
  Object.assign(b, {
    x,
    y,
    vx,
    vy,
    waiting: false,
    path: undefined,
    trail: [],
    cooldown: 0,
  });
  return b;
};
describe("physical table", () => {
  it("launches from the shooter lane into the upper orbit at all charge levels", () => {
    for (const power of [0, 0.5, 1]) {
      const e = playing();
      e.launch(power);
      seconds(e, 2.3);
      expect(e.score).toBeGreaterThan(0);
      expect(e.balls[0].x).toBeLessThan(533);
      expect(e.balls[0].waiting).toBe(false);
    }
  });
  it("flippers pivot at their heels and generate upward impulse on both sides", () => {
    for (const side of ["left", "right"] as const) {
      const e = playing(),
        b = place(e, side === "left" ? 243 : 339, 830, 0, 150);
      e.setFlipper(side, true);
      seconds(e, 0.065);
      expect(b.vy).toBeLessThan(-700);
      expect(e[side].angle).toBeCloseTo(e[side].raised, 3);
    }
  });
  it("a held flipper does not repeatedly inject solenoid energy", () => {
    const e = playing();
    e.setFlipper("left", true);
    seconds(e, 0.1);
    const b = place(e, 242, 774, 0, 80);
    seconds(e, 0.03);
    expect(Math.hypot(b.vx, b.vy)).toBeLessThan(500);
  });
  it("a held cradle is not mistaken for a stuck ball by ball search", () => {
    for (const side of ["left", "right"] as const) {
      const e = playing();
      e.setFlipper(side, true);
      seconds(e, 0.1);
      const b = place(e, side === "left" ? 175 : 407, 801, 0, 0);
      seconds(e, 5);
      expect(e.balls).toContain(b);
      expect(Math.hypot(b.x - e[side].x, b.y - e[side].y)).toBeLessThan(36);
      expect(e.message).not.toContain("Ball search");
      e.setFlipper(side, false);
      seconds(e, 0.6);
      expect(Math.hypot(b.x - e[side].x, b.y - e[side].y)).toBeGreaterThan(36);
    }
  });
  it("skill shots require both the selected orbit and a controlled launch", () => {
    for (const power of [0.2, 0.7, 1]) {
      const e = playing();
      e.prescienceIndex = 0;
      e.launch(power);
      seconds(e, 1);
      expect(e.score).toBe(power === 0.7 ? 25_000 : 2_500);
    }
  });
  it("three distinct stand-up targets award one cache and a short save per ball", () => {
    const e = playing();
    for (const [x, y] of [
      [184, 478],
      [297, 461],
      [414, 478],
    ]) {
      place(e, x, y + 13, 0, -200);
      seconds(e, 0.04);
    }
    expect(e.targetBank).toEqual([true, true, true]);
    expect(e.score).toBe(11_500);
    const deadline = e.saveUntil;
    seconds(e, 0.35);
    place(e, 414, 491, 0, -200);
    seconds(e, 0.04);
    expect(e.saveUntil).toBe(deadline);
  });
  it("fast balls cannot tunnel through rails", () => {
    const e = playing(),
      b = place(e, 70, 550, -1500, 0);
    seconds(e, 0.03);
    expect(b.x).toBeGreaterThanOrEqual(47);
    expect(b.vx).toBeGreaterThan(0);
  });
  it("pause freezes physics, save windows, charge and mission time", () => {
    const e = playing();
    e.mode = "storm";
    e.modeUntil = 45;
    e.launch();
    seconds(e, 1);
    e.pause(true);
    const before = JSON.stringify([e.clock, e.balls, e.saveUntil, e.modeUntil]);
    seconds(e, 12);
    expect(JSON.stringify([e.clock, e.balls, e.saveUntil, e.modeUntil])).toBe(
      before,
    );
    e.pause(false);
    seconds(e, 0.2);
    expect(e.clock).toBeGreaterThan(1);
  });
  it("a ramp captures once and returns the same ball to the inlane", () => {
    const e = playing(),
      b = place(e, 153, 437, 0, -500);
    seconds(e, 0.08);
    expect(b.path).toBeDefined();
    const score = e.score;
    seconds(e, 1.2);
    expect(e.score).toBe(score);
    seconds(e, 0.25);
    expect(b.x).toBeLessThan(270);
    expect(b.y).toBeGreaterThan(700);
  });
  it("ball save returns the ball without extending its own deadline", () => {
    const e = playing();
    e.launch();
    const until = e.saveUntil;
    e.drain(e.balls[0]);
    expect(e.ballsRemaining).toBe(3);
    expect(e.balls.length).toBe(1);
    expect(e.saveUntil).toBe(until);
  });
  it("three unsaved drains end the game once", () => {
    const e = playing();
    for (let i = 0; i < 3; i++) {
      e.drain(e.balls[0]);
      seconds(e, 1.2);
    }
    expect(e.phase).toBe("gameover");
    expect(e.ballsRemaining).toBe(0);
    expect(e.balls.length).toBe(0);
  });
  it("tilt stays latched, disables scoring and ends on the next ball", () => {
    const e = playing();
    e.launch();
    for (let i = 0; i < 3; i++) {
      e.nudge(1);
      seconds(e, 0.41);
    }
    expect(e.tilted).toBe(true);
    const score = e.score;
    e.hitShot("citadel");
    expect(e.score).toBe(score);
    seconds(e, 1);
    expect(e.tilted).toBe(true);
    e.drain(e.balls[0]);
    expect(e.ballsRemaining).toBe(2);
    expect(e.tilted).toBe(false);
  });
});
describe("progression and shot strategy", () => {
  it("Oracle checks the arrow that was lit when the ball hit it", () => {
    const e = playing();
    e.mode = "oracle";
    e.modeUntil = 45;
    e.prescienceIndex = 0;
    e.hitShot("caravan");
    expect(e.progress).toBe(1);
    expect(e.prescienceIndex).toBe(1);
    expect(e.multiplier).toBe(2);
  });
  it("combos expire after four seconds and cap at five", () => {
    const e = playing();
    for (let i = 0; i < 8; i++) e.hitShot("harvest");
    expect(e.combo).toBe(5);
    seconds(e, 4.1);
    e.hitShot("dune");
    expect(e.combo).toBe(1);
  });
  it("starts three-ball multiball after three open-play Citadel locks", () => {
    const e = playing();
    for (let i = 0; i < 3; i++) e.hitShot("citadel");
    expect(e.mode).toBe("multiball");
    expect(e.balls.length).toBe(3);
    e.saveUntil = 0;
    e.drain(e.balls[1]);
    e.drain(e.balls[1]);
    expect(e.multiballComplete).toBe(true);
    expect(e.mode).toBe(null);
    expect(e.ballsRemaining).toBe(3);
  });
  it("finishes each territory and unlocks the final battle", () => {
    const e = playing();
    for (const mode of MODE_ORDER) {
      e.mode = mode;
      e.progress = 0;
      e.modeUntil = 1000;
      for (let j = 0; j < 4; j++)
        e.hitShot(
          mode === "harvest"
            ? "harvest"
            : mode === "storm"
              ? "storm"
              : mode === "siege"
                ? "citadel"
                : (["caravan", "harvest", "citadel", "dune", "storm"][
                    e.prescienceIndex
                  ] as "caravan"),
        );
      expect(e.completed.has(mode)).toBe(true);
    }
    e.mode = null;
    e.multiballComplete = true;
    e.hitShot("citadel");
    expect(e.mode).toBe("wizard");
    expect(e.balls.length).toBe(3);
  });
  it("simulates ten seeded games without NaN, escaped living balls or immortal games", () => {
    for (let seed = 1; seed <= 10; seed++) {
      const e = playing();
      e.launch(0.5);
      let s = seed;
      for (let frame = 0; frame < 60 * 180 && e.phase !== "gameover"; frame++) {
        s = (s * 1664525 + 1013904223) >>> 0;
        if (frame % 8 === 0) {
          e.setFlipper("left", (s >>> 16) % 4 === 0);
          e.setFlipper("right", (s >>> 16) % 3 === 0);
        }
        if (e.balls.some((b) => b.waiting)) e.launch();
        e.advance(1 / 60);
        e.events = [];
        for (const b of e.balls) {
          expect(
            Number.isFinite(b.x) &&
              Number.isFinite(b.y) &&
              Number.isFinite(b.vx) &&
              Number.isFinite(b.vy),
          ).toBe(true);
          expect(b.x).toBeGreaterThanOrEqual(0);
          expect(b.x).toBeLessThanOrEqual(600);
        }
      }
      expect(
        e.phase,
        JSON.stringify({
          seed,
          clock: e.clock,
          balls: e.balls,
          remaining: e.ballsRemaining,
        }),
      ).toBe("gameover");
      expect(e.ballsRemaining).toBe(0);
    }
  });
});
