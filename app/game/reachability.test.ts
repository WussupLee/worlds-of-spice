import { expect, it } from "vitest";
import { PinballEngine, STEP } from "./engine";
import { SHOT_ORDER, type ShotId } from "./types";

it("every major shot is physically reachable from a timed flipper contact", () => {
  const reached = new Set<ShotId>();
  for (const side of ["left", "right"] as const) {
    for (let timing = 12; timing <= 98; timing += 2) {
      for (const drift of [-60, 0, 60]) {
        const e = new PinballEngine();
        e.start();
        const f = e[side],
          contact = timing / 100;
        Object.assign(e.balls[0], {
          x: f.x + Math.cos(f.rest) * f.length * contact,
          y: f.y + Math.sin(f.rest) * f.length * contact - 18,
          vx: drift,
          vy: 180,
          waiting: false,
        });
        const hit = e.hitShot.bind(e);
        let firstShot = true;
        e.hitShot = (shot, ball) => {
          if (firstShot) reached.add(shot);
          firstShot = false;
          hit(shot, ball);
        };
        e.setFlipper(side, true);
        for (let frame = 0; frame < 720; frame++) {
          e.advance(STEP);
          e.events = [];
        }
      }
    }
  }
  expect([...reached].sort()).toEqual([...SHOT_ORDER].sort());
});
