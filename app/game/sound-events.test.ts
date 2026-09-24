import { describe, expect, it } from "vitest";
import { BUMPERS, PinballEngine, STEP, TARGETS, type Cue } from "./engine";
import { MODE_ORDER } from "./types";

function fixture(x = 300, y = 600, vx = 0, vy = -400) {
  const e = new PinballEngine();
  e.start();
  const b = e.balls[0];
  Object.assign(b, { x, y, vx, vy, waiting: false });
  e.events.length = 0;
  return { e, b };
}
function advance(e: PinballEngine, seconds: number) {
  for (let i = 0; i < Math.ceil(seconds / STEP); i++) e.advance(STEP);
}
const cues = (e: PinballEngine): Cue[] =>
  e.events.splice(0).map((event) => event.cue);

describe("sound follows physical actions, not just score changes", () => {
  it.each(BUMPERS)("pop at $x,$y emits a bumper impact", (p) => {
    const { e } = fixture(p.x, p.y + 39);
    advance(e, 0.025);
    expect(cues(e).filter((c) => c === "bumper")).toHaveLength(1);
    expect(e.score).toBeGreaterThan(0);
  });
  it.each([0, 1])(
    "active sling %i and passive edges have distinct sounds",
    (side) => {
      const { e } = fixture(side ? 414 : 168, 699, side ? 250 : -250, 100);
      advance(e, 0.02);
      expect(cues(e)).toContain("sling");
      const passive = fixture(side ? 480 : 102, 685, side ? -300 : 300, 0);
      advance(passive.e, 0.02);
      expect(cues(passive.e)).toContain("rail");
    },
  );
  it("rails, ball contacts, and ball-on-flipper impacts are not coil triggers", () => {
    const rail = fixture(49, 550, -400, 0);
    advance(rail.e, 0.02);
    expect(cues(rail.e)).toContain("rail");
    const { e, b } = fixture(287, 600, 300, 0);
    e.balls.push({ ...b, id: 2, x: 306, vx: -300, trail: [] });
    advance(e, 0.01);
    expect(cues(e)).toContain("ball-hit");
    const f = fixture(228, 826, 0, 400);
    advance(f.e, 0.035);
    expect(cues(f.e)).toContain("flipper-hit");
    f.e.setFlipper("left", true);
    f.e.setFlipper("left", true);
    f.e.setFlipper("left", false);
    expect(cues(f.e)).toEqual(["flipper", "release"]);
  });
  it("standing targets trigger once; the third has its own bank reward", () => {
    const { e, b } = fixture();
    for (let i = 0; i < 3; i++) {
      const p = TARGETS[i];
      Object.assign(b, { x: p.x, y: p.y + 22, vx: 0, vy: -450 });
      advance(e, 0.035);
      const events = cues(e);
      expect(events.filter((c) => c === "drop")).toHaveLength(1);
      expect(events.includes("bank-complete")).toBe(i === 2);
      Object.assign(b, { x: p.x, y: p.y + 22, vx: 0, vy: -450 });
      advance(e, 0.04);
      expect(cues(e)).not.toContain("drop");
    }
  });
  it.each([153, 443])(
    "ramp %i sounds at capture, gate close and actual landing",
    (x) => {
      const { e, b } = fixture(x, 437);
      advance(e, 0.025);
      expect(b.path?.kind).toBe("ramp");
      expect(cues(e)).toContain("ramp");
      advance(e, 0.25);
      expect(cues(e)).toEqual(["gate"]);
      advance(e, 0.9);
      expect(cues(e)).not.toContain("ramp-exit");
      advance(e, 0.35);
      expect(cues(e).filter((c) => c === "ramp-exit")).toHaveLength(1);
    },
  );
  it("scoop capture and kickout are separated by the pocket dwell", () => {
    const { e, b } = fixture(298, 189);
    advance(e, 0.025);
    expect(b.path?.kind).toBe("scoop");
    const capture = cues(e);
    expect(capture).toContain("scoop");
    expect(capture).not.toContain("scoop-eject");
    advance(e, 0.5);
    expect(cues(e)).not.toContain("scoop-eject");
    advance(e, 0.23);
    expect(cues(e)).toContain("scoop-eject");
  });
  it.each([82, 507])("orbit %i spins on entry, returns once", (x) => {
    const { e } = fixture(x, 405);
    advance(e, 0.025);
    expect(cues(e)).toContain("spinner");
    advance(e, 1.28);
    expect(cues(e).filter((c) => c === "orbit-exit")).toHaveLength(1);
  });
  it.each([
    [55, "outlane"],
    [101, "inlane"],
    [478, "inlane"],
    [514, "outlane"],
  ] as const)("lane at %i triggers %s only on downward crossing", (x, cue) => {
    const { e } = fixture(x, 708, 0, 150);
    advance(e, 0.025);
    expect(cues(e).filter((c) => c === cue)).toHaveLength(1);
    advance(e, 0.025);
    expect(cues(e)).not.toContain(cue);
    const up = fixture(x, 712, 0, -150);
    advance(up.e, 0.025);
    expect(cues(up.e)).not.toContain(cue);
  });
  it("launch, skill shot, serve, and ball-search have their own cues", () => {
    const e = new PinballEngine();
    e.start();
    e.prescienceIndex = 0;
    expect(cues(e)).toEqual(["serve", "ui"]);
    e.pull();
    e.pull();
    expect(cues(e)).toEqual(["pull"]);
    e.launch(0.7);
    expect(cues(e)).toEqual(["launch"]);
    advance(e, 1);
    expect(cues(e)).toContain("skill-shot");
    const stuck = fixture(300, 600, 0, 0);
    stuck.b.stuck = 3.1;
    advance(stuck.e, STEP);
    expect(cues(stuck.e)).toContain("ball-search");
  });
  it("tilt suppresses powered bumper and target sounds, preserving passive impacts", () => {
    const { e } = fixture(226, 299);
    e.tilted = true;
    advance(e, 0.025);
    const events = cues(e);
    expect(events).not.toContain("bumper");
    expect(events).toContain("rail");
    e.setFlipper("left", true);
    expect(cues(e)).toEqual([]);
  });
});

describe("rule cues are tied to actual awards and state transitions", () => {
  it("combos and multipliers signal awards, never the capped multiplier", () => {
    const { e } = fixture();
    e.prescienceIndex = 0;
    e.hitShot("caravan");
    expect(cues(e)).toContain("multiplier");
    e.multiplier = 5;
    e.prescienceIndex = 0;
    e.hitShot("caravan");
    const events = cues(e);
    expect(events).toContain("combo");
    expect(events).not.toContain("multiplier");
  });
  it("locks escalate into multiball, jackpots and an end cue", () => {
    const { e } = fixture();
    for (let i = 0; i < 2; i++) {
      e.hitShot("citadel");
      expect(cues(e)).toContain("lock");
    }
    e.hitShot("citadel");
    expect(cues(e)).toContain("multiball");
    e.hitShot("harvest");
    expect(cues(e)).toContain("jackpot");
    e.hitShot("citadel");
    expect(cues(e)).toContain("super-jackpot");
    e.saveUntil = 0;
    e.drain(e.balls[0]);
    expect(cues(e)).not.toContain("multiball-end");
    e.drain(e.balls[0]);
    expect(cues(e)).toContain("multiball-end");
  });
  it("territory qualification, progress, completion, expiry and finale are distinct", () => {
    const { e } = fixture();
    for (let i = 0; i < 4; i++) e.hitShot("harvest");
    expect(cues(e)).toContain("mode");
    e.hitShot("harvest");
    expect(cues(e)).toContain("mode-progress");
    for (let i = 0; i < 3; i++) e.hitShot("harvest");
    expect(cues(e)).toContain("complete");
    e.mode = "storm";
    e.modeUntil = e.clock;
    advance(e, STEP);
    expect(cues(e)).toContain("mode-failed");
    e.completed = new Set(MODE_ORDER);
    e.multiballComplete = true;
    e.hitShot("citadel");
    expect(cues(e)).toContain("wizard");
    e.modeUntil = e.clock;
    advance(e, STEP);
    expect(cues(e)).toContain("complete");
  });
  it("saved and unsaved drains, tilt, re-serve and game over are audible", () => {
    const { e, b } = fixture();
    e.saveUntil = 10;
    e.drain(b);
    expect(cues(e)).toEqual(["drain", "save"]);
    e.saveUntil = 0;
    e.drain(e.balls[0]);
    expect(cues(e)).toEqual(["drain"]);
    advance(e, 1.2);
    expect(cues(e)).toContain("serve");
    e.launch(0.5);
    cues(e);
    for (let i = 0; i < 3; i++) {
      e.nudge(1);
      e.clock += 0.45;
    }
    expect(cues(e)).toContain("tilt");
    e.ballsRemaining = 1;
    e.saveUntil = 0;
    e.drain(e.balls[0]);
    expect(cues(e)).toEqual(["drain", "gameover"]);
  });
});
