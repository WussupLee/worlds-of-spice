import { modeTarget, SCORE, scoreMajorShot } from "./rules";
import {
  MODE_LABELS,
  MODE_ORDER,
  SHOT_LABELS,
  SHOT_ORDER,
  type GamePhase,
  type GameSnapshot,
  type ModeId,
  type ShotId,
} from "./types";

export const WIDTH = 600,
  HEIGHT = 1000,
  BALL_RADIUS = 10,
  STEP = 1 / 240;
export type Point = { x: number; y: number };
export type Rail = {
  a: Point;
  b: Point;
  radius: number;
  kind?: "sling";
  side?: number;
};
export type Ball = Point & {
  id: number;
  vx: number;
  vy: number;
  waiting: boolean;
  path?: { points: Point[]; elapsed: number; duration: number; exit: Point };
  trail: Point[];
  cooldown: number;
  stuck: number;
  launchedAt: number;
  launchPower: number;
};
export type Cue =
  | "flipper"
  | "release"
  | "launch"
  | "rail"
  | "bumper"
  | "sling"
  | "shot"
  | "ramp"
  | "save"
  | "drain"
  | "mode"
  | "complete"
  | "multiball"
  | "tilt"
  | "nudge"
  | "ui";
export type GameEvent = { cue: Cue; x: number; strength: number };
export type Flipper = {
  x: number;
  y: number;
  angle: number;
  rest: number;
  raised: number;
  pressed: boolean;
  omega: number;
  length: number;
};
export const BUMPERS = [
  { x: 226, y: 260, r: 28 },
  { x: 369, y: 260, r: 28 },
  { x: 298, y: 350, r: 28 },
];
export const TARGETS = [
  { x: 184, y: 478 },
  { x: 297, y: 461 },
  { x: 414, y: 478 },
];
export const SLINGS: Point[][] = [
  [
    { x: 118, y: 652 },
    { x: 204, y: 754 },
    { x: 118, y: 715 },
  ],
  [
    { x: 464, y: 652 },
    { x: 464, y: 715 },
    { x: 378, y: 754 },
  ],
];
export const SHOTS: Record<ShotId, Point> = {
  caravan: { x: 82, y: 393 },
  harvest: { x: 153, y: 426 },
  citadel: { x: 298, y: 177 },
  dune: { x: 443, y: 426 },
  storm: { x: 507, y: 393 },
};
export const RAMP_PATHS: Record<"harvest" | "dune", Point[]> = {
  harvest: [
    { x: 153, y: 426 },
    { x: 132, y: 352 },
    { x: 139, y: 187 },
    { x: 187, y: 129 },
    { x: 233, y: 161 },
    { x: 175, y: 253 },
    { x: 116, y: 378 },
    { x: 98, y: 564 },
    { x: 98, y: 716 },
    { x: 154, y: 771 },
    { x: 211, y: 807 },
  ],
  dune: [
    { x: 443, y: 426 },
    { x: 460, y: 352 },
    { x: 448, y: 187 },
    { x: 402, y: 129 },
    { x: 363, y: 163 },
    { x: 419, y: 253 },
    { x: 477, y: 378 },
    { x: 492, y: 564 },
    { x: 487, y: 716 },
    { x: 433, y: 771 },
    { x: 371, y: 807 },
  ],
};
const makeRails = (): Rail[] => {
  const lines: Array<[number, number, number, number]> = [
    [32, 190, 32, 752],
    [32, 190, 60, 103],
    [60, 103, 148, 53],
    [148, 53, 434, 53],
    [434, 53, 546, 104],
    [546, 104, 579, 184],
    [579, 184, 579, 954],
    [533, 210, 533, 950],
    [32, 752, 102, 933],
    [533, 752, 482, 933],
    [77, 583, 77, 748],
    [77, 748, 180, 823],
    [494, 583, 494, 748],
    [494, 748, 402, 823],
    [190, 535, 152, 614],
    [408, 535, 446, 614],
  ];
  const rails = lines.map(([ax, ay, bx, by]) => ({
    a: { x: ax, y: ay },
    b: { x: bx, y: by },
    radius: 6,
  }));
  return rails;
};
export const RAILS = makeRails();
export function closestPoint(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    t = Math.max(
      0,
      Math.min(
        1,
        ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1),
      ),
    );
  return { x: a.x + t * dx, y: a.y + t * dy, t };
}
export function pathPoint(points: Point[], progress: number): Point {
  const index = Math.min(
    points.length - 2,
    Math.floor(Math.min(0.99999, Math.max(0, progress)) * (points.length - 1)),
  );
  const t = Math.min(1, progress * (points.length - 1) - index),
    a = points[index],
    b = points[index + 1];
  const p0 = points[Math.max(0, index - 1)],
    p3 = points[Math.min(points.length - 1, index + 2)];
  const cubic = (k: "x" | "y") =>
    0.5 *
    (2 * a[k] +
      (-p0[k] + b[k]) * t +
      (2 * p0[k] - 5 * a[k] + 4 * b[k] - p3[k]) * t * t +
      (-p0[k] + 3 * a[k] - 3 * b[k] + p3[k]) * t * t * t);
  return { x: cubic("x"), y: cubic("y") };
}
export class PinballEngine {
  phase: GamePhase = "ready";
  score = 0;
  ballsRemaining = 3;
  balls: Ball[] = [];
  clock = 0;
  charge = 0;
  charging = false;
  multiplier = 1;
  peakMultiplier = 1;
  combo = 0;
  comboUntil = 0;
  prescienceIndex = 2;
  locks = 0;
  multiballComplete = false;
  completed = new Set<ModeId>();
  mode: ModeId | "multiball" | "wizard" | null = null;
  progress = 0;
  modeUntil = 0;
  tilted = false;
  tilt = 0;
  message = "A new odyssey awaits";
  messageUntil = 0;
  saveUntil = 0;
  majorShots = 0;
  openPlayShots = 0;
  targetBank = [false, false, false];
  lastNudge = -100;
  left: Flipper = {
    x: 182,
    y: 826,
    angle: 0.36,
    rest: 0.36,
    raised: -0.53,
    pressed: false,
    omega: 0,
    length: 92,
  };
  right: Flipper = {
    x: 400,
    y: 826,
    angle: Math.PI - 0.36,
    rest: Math.PI - 0.36,
    raised: Math.PI + 0.53,
    pressed: false,
    omega: 0,
    length: 92,
  };
  flashes: Array<Point & { time: number; color: string }> = [];
  events: GameEvent[] = [];
  private accumulator = 0;
  private nextId = 0;
  private nextBallAt = 0;
  private lastRail = -100;
  private targetCooldown = [0, 0, 0];
  private bumperCooldown = [0, 0, 0];
  private slingCooldown = [0, 0];
  start() {
    this.phase = "playing";
    this.message = "Hold LAUNCH. Release into the stars.";
    this.spawn();
  }
  private spawn(active = false, x = 558, y = 887) {
    const ball: Ball = {
      id: ++this.nextId,
      x,
      y,
      vx: active ? (x < 298 ? -150 : 150) : 0,
      vy: active ? -160 : 0,
      waiting: !active,
      trail: [],
      cooldown: 0,
      stuck: 0,
      launchedAt: this.clock,
      launchPower: 0,
    };
    this.balls.push(ball);
    return ball;
  }
  emit(cue: Cue, x = 300, strength = 1) {
    if (this.events.length < 40) this.events.push({ cue, x, strength });
  }
  flash(x: number, y: number, color = "#ffd782") {
    this.flashes.push({ x, y, color, time: this.clock });
  }
  setFlipper(side: "left" | "right", pressed: boolean) {
    const f = side === "left" ? this.left : this.right;
    if (this.phase !== "playing" || this.tilted) {
      f.pressed = false;
      return;
    }
    if (f.pressed === pressed) return;
    f.pressed = pressed;
    if (pressed) {
      this.emit("flipper", f.x);
      if (this.balls.some((b) => b.waiting))
        this.prescienceIndex =
          (this.prescienceIndex + (side === "left" ? 4 : 1)) % 5;
    } else this.emit("release", f.x, 0.55);
  }
  releaseControls() {
    this.left.pressed = false;
    this.right.pressed = false;
    this.charging = false;
    this.charge = 0;
  }
  pull() {
    if (this.phase === "playing" && this.balls.some((b) => b.waiting)) {
      this.charging = true;
      this.charge = 0;
    }
  }
  launch(power = this.charge) {
    this.charging = false;
    this.charge = 0;
    if (this.phase !== "playing") return;
    const b = this.balls.find((b) => b.waiting);
    if (!b) return;
    b.waiting = false;
    b.launchPower = Math.max(0, Math.min(1, power));
    b.vy = -(1250 + b.launchPower * 240);
    b.launchedAt = this.clock;
    this.saveUntil = this.clock + 10;
    this.say("Read the light. Follow the flow.");
    this.emit("launch", 558);
  }
  pause(paused = this.phase !== "paused") {
    if (this.phase !== "playing" && this.phase !== "paused") return;
    this.phase = paused ? "paused" : "playing";
    this.releaseControls();
    this.accumulator = 0;
  }
  nudge(direction: number) {
    if (
      this.phase !== "playing" ||
      this.tilted ||
      this.clock - this.lastNudge < 0.4 ||
      !this.balls.some((b) => !b.waiting)
    )
      return;
    this.lastNudge = this.clock;
    this.tilt = Math.min(100, this.tilt + 38);
    if (this.tilt >= 100) {
      this.tilted = true;
      this.releaseControls();
      this.saveUntil = 0;
      this.say("TILT · Let this ball drain", 10);
      this.emit("tilt");
      return;
    }
    this.balls.forEach((b) => {
      if (!b.waiting && !b.path) {
        b.vx += direction * 115;
        b.vy -= 95;
      }
    });
    this.say(
      this.tilt > 60
        ? "DANGER · One more nudge risks tilt"
        : "A breath of wind",
      1.4,
    );
    this.emit("nudge", direction > 0 ? 500 : 100);
  }
  private say(message: string, seconds = 2.6) {
    this.message = message;
    this.messageUntil = this.clock + seconds;
  }
  advance(delta: number) {
    if (this.phase !== "playing") return;
    this.accumulator += Math.min(0.06, Math.max(0, delta));
    while (this.accumulator >= STEP) {
      this.tick(STEP);
      this.accumulator -= STEP;
    }
  }
  private tick(dt: number) {
    this.clock += dt;
    if (this.charging) this.charge = Math.min(1, this.charge + dt / 0.9);
    if (!this.tilted) this.tilt = Math.max(0, this.tilt - dt * 5);
    if (this.combo && this.clock > this.comboUntil) this.combo = 0;
    this.flashes = this.flashes.filter((f) => this.clock - f.time < 0.55);
    if (
      this.mode &&
      this.clock >= this.modeUntil &&
      this.mode !== "multiball"
    ) {
      if (this.mode === "wizard" && !this.tilted) {
        this.score += 1_000_000;
        this.say("DOMINION CLAIMED · 1,000,000", 5);
        this.emit("complete");
      } else this.say("Territory unfinished · Try again");
      this.mode = null;
      this.progress = 0;
    }
    if (this.nextBallAt && this.clock >= this.nextBallAt) {
      this.nextBallAt = 0;
      this.spawn();
    }
    for (const f of [this.left, this.right]) {
      const target = f.pressed && !this.tilted ? f.raised : f.rest,
        previous = f.angle,
        max = dt * (f.pressed ? 21 : 12);
      f.angle += Math.max(-max, Math.min(max, target - f.angle));
      f.omega = (f.angle - previous) / dt;
    }
    for (const b of [...this.balls]) {
      if (b.waiting) continue;
      if (b.path) {
        b.path.elapsed += dt;
        const t = b.path.elapsed / b.path.duration;
        Object.assign(b, pathPoint(b.path.points, Math.min(1, t)));
        if (t >= 1) {
          b.vx = b.path.exit.x;
          b.vy = b.path.exit.y;
          b.path = undefined;
          b.cooldown = this.clock + 0.4;
        }
        this.trail(b);
        continue;
      }
      b.vy += 650 * dt;
      b.vx *= 1 - dt * 0.07;
      b.vy *= 1 - dt * 0.035;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x > 534 && b.y < 190 && b.vy < 0) {
        b.path = {
          points: [
            { x: b.x, y: b.y },
            { x: 550, y: 119 },
            { x: 456, y: 78 },
            { x: 295, y: 77 },
            { x: 143, y: 88 },
            { x: 83, y: 185 },
            { x: 85, y: 353 },
          ],
          elapsed: 0,
          duration: 1.5,
          exit: { x: 50, y: 400 },
        };
        if (this.clock - b.launchedAt < 2) {
          const skill =
            this.prescienceIndex === 0 &&
            b.launchPower >= 0.6 &&
            b.launchPower <= 0.8;
          this.score += skill ? 25_000 : 2_500;
          this.say(skill ? "SKILL SHOT · 25,000" : "Ball in play");
          this.emit("shot", 90, skill ? 1 : 0.5);
        }
        continue;
      }
      for (const rail of RAILS) this.collideRail(b, rail);
      this.collideSling(b, 0);
      this.collideSling(b, 1);
      BUMPERS.forEach((p, i) => {
        const dx = b.x - p.x,
          dy = b.y - p.y,
          d = Math.hypot(dx, dy);
        if (d < p.r + BALL_RADIUS) {
          const nx = dx / (d || 1),
            ny = dy / (d || 1);
          b.x = p.x + nx * (p.r + BALL_RADIUS + 0.1);
          b.y = p.y + ny * (p.r + BALL_RADIUS + 0.1);
          if (this.tilted) {
            const normal = b.vx * nx + b.vy * ny;
            if (normal < 0) {
              b.vx -= normal * 1.6 * nx;
              b.vy -= normal * 1.6 * ny;
            }
          } else if (this.clock > this.bumperCooldown[i]) {
            const v = Math.max(500, Math.hypot(b.vx, b.vy) * 0.9);
            b.vx = nx * v;
            b.vy = ny * v;
            this.bumperCooldown[i] = this.clock + 0.09;
            if (!this.tilted) this.score += SCORE.bumper;
            this.emit("bumper", p.x);
            this.flash(p.x, p.y);
          }
        }
      });
      TARGETS.forEach((p, i) => {
        if (
          this.collideRail(b, {
            a: { x: p.x - 15, y: p.y },
            b: { x: p.x + 15, y: p.y },
            radius: 5,
          }) &&
          this.clock > this.targetCooldown[i]
        ) {
          this.targetCooldown[i] = this.clock + 0.3;
          if (!this.tilted) {
            this.score += SCORE.target;
            if (!this.targetBank[i]) {
              this.targetBank[i] = true;
              if (this.targetBank.every(Boolean)) {
                this.score += 10_000;
                this.saveUntil = Math.max(this.saveUntil, this.clock + 5);
                this.say("SPICE CACHE · 10,000 + 5s shield");
                this.emit("save");
              }
            }
          }
          this.flash(p.x, p.y, "#8bd5e3");
          this.emit("shot", p.x, 0.6);
        }
      });
      this.collideFlipper(b, this.left);
      this.collideFlipper(b, this.right);
      if (b.cooldown < this.clock && !this.tilted && b.vy < 0)
        for (const shot of SHOT_ORDER) {
          const p = SHOTS[shot];
          if (
            Math.abs(b.x - p.x) < (shot === "citadel" ? 27 : 22) &&
            Math.abs(b.y - p.y) < 18
          ) {
            this.hitShot(shot, b);
            break;
          }
        }
      const speed = Math.hypot(b.vx, b.vy);
      if (speed > 1550) {
        b.vx *= 1550 / speed;
        b.vy *= 1550 / speed;
      }
      const cradled = [this.left, this.right].some(
        (f) => f.pressed && Math.hypot(b.x - f.x, b.y - f.y) < 34,
      );
      b.stuck = speed < 32 && !cradled ? b.stuck + dt : 0;
      if (b.stuck > 3) {
        b.vy = -240;
        b.vx += b.x < 298 ? 60 : -60;
        b.stuck = 0;
        this.say("Ball search · Released");
      }
      this.trail(b);
      if (b.y > 965 || b.x < 0 || b.x > 600) this.drain(b);
    }
    for (let i = 0; i < this.balls.length; i++)
      for (let j = i + 1; j < this.balls.length; j++) {
        const a = this.balls[i],
          b = this.balls[j];
        if (a.waiting || b.waiting || a.path || b.path) continue;
        const dx = b.x - a.x,
          dy = b.y - a.y,
          d = Math.hypot(dx, dy);
        if (d >= 20 || d === 0) continue;
        const nx = dx / d,
          ny = dy / d,
          over = (20 - d) / 2;
        a.x -= nx * over;
        a.y -= ny * over;
        b.x += nx * over;
        b.y += ny * over;
        const v = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
        if (v > 0) {
          a.vx -= v * nx;
          a.vy -= v * ny;
          b.vx += v * nx;
          b.vy += v * ny;
          this.emit("rail", a.x, 0.6);
        }
      }
  }
  private trail(b: Ball) {
    if (
      Math.hypot(b.x - (b.trail[0]?.x ?? 0), b.y - (b.trail[0]?.y ?? 0)) > 5
    ) {
      b.trail.unshift({ x: b.x, y: b.y });
      b.trail.length = Math.min(12, b.trail.length);
    }
  }
  private collideSling(b: Ball, side: number) {
    const vertices = SLINGS[side];
    let inside = true,
      nearest = Infinity,
      hit = { x: 0, y: 0, t: 0 },
      edge = 0;
    for (let i = 0; i < 3; i++) {
      const a = vertices[i],
        z = vertices[(i + 1) % 3];
      if ((z.x - a.x) * (b.y - a.y) - (z.y - a.y) * (b.x - a.x) < 0)
        inside = false;
      const p = closestPoint(b, a, z),
        d = Math.hypot(b.x - p.x, b.y - p.y);
      if (d < nearest) {
        nearest = d;
        hit = p;
        edge = i;
      }
    }
    if (!inside && nearest >= 13) return;
    const a = vertices[edge],
      z = vertices[(edge + 1) % 3],
      length = Math.hypot(z.x - a.x, z.y - a.y);
    const nx = inside ? (z.y - a.y) / length : (b.x - hit.x) / (nearest || 1);
    const ny = inside ? -(z.x - a.x) / length : (b.y - hit.y) / (nearest || 1);
    b.x = hit.x + nx * 13.1;
    b.y = hit.y + ny * 13.1;
    const v = b.vx * nx + b.vy * ny;
    if (v < 0) {
      b.vx -= v * 1.7 * nx;
      b.vy -= v * 1.7 * ny;
    }
    const activeEdge = side === 0 ? 0 : 2;
    if (
      edge === activeEdge &&
      v < -45 &&
      !this.tilted &&
      this.clock > this.slingCooldown[side]
    ) {
      this.slingCooldown[side] = this.clock + 0.18;
      b.vx += nx * 300;
      b.vy += ny * 300;
      this.score += SCORE.sling;
      this.flash(hit.x, hit.y);
      this.emit("sling", hit.x);
    }
  }
  private collideRail(b: Ball, r: Rail) {
    const p = closestPoint(b, r.a, r.b),
      dx = b.x - p.x,
      dy = b.y - p.y,
      d = Math.hypot(dx, dy),
      radius = BALL_RADIUS + r.radius;
    if (d >= radius) return false;
    const nx = dx / (d || 1),
      ny = dy / (d || 1);
    b.x = p.x + nx * (radius + 0.01);
    b.y = p.y + ny * (radius + 0.01);
    const v = b.vx * nx + b.vy * ny;
    if (v < 0) {
      b.vx -= v * 1.75 * nx;
      b.vy -= v * 1.75 * ny;
      if (r.kind === "sling" && !this.tilted) {
        b.vx += (r.side ?? 1) * 120;
        b.vy -= 230;
        this.score += SCORE.sling;
        this.flash(p.x, p.y);
        this.emit("sling", p.x);
      } else if (-v > 70 && this.clock - this.lastRail > 0.045) {
        this.lastRail = this.clock;
        this.emit("rail", p.x, Math.min(1, -v / 900));
      }
    }
    return true;
  }
  private collideFlipper(b: Ball, f: Flipper) {
    const end = {
        x: f.x + Math.cos(f.angle) * f.length,
        y: f.y + Math.sin(f.angle) * f.length,
      },
      p = closestPoint(b, f, end),
      dx = b.x - p.x,
      dy = b.y - p.y,
      d = Math.hypot(dx, dy),
      radius = BALL_RADIUS + 10 - p.t * 3;
    if (d >= radius) return;
    const nx = dx / (d || 1),
      ny = dy / (d || 1);
    b.x = p.x + nx * (radius + 0.2);
    b.y = p.y + ny * (radius + 0.2);
    const sx = -f.omega * (p.y - f.y),
      sy = f.omega * (p.x - f.x),
      relative = (b.vx - sx) * nx + (b.vy - sy) * ny;
    if (relative < 0) {
      b.vx -= relative * 1.6 * nx;
      b.vy -= relative * 1.6 * ny;
    }
    // Coil energy only on the rising stroke: holding a bat never auto-shoots.
    if (f.pressed && !this.tilted && Math.abs(f.omega) > 1 && ny < 0.35) {
      const side = f === this.left ? 1 : -1;
      b.vy = Math.min(b.vy, -920 - p.t * 230);
      b.vx = side * (580 - 930 * p.t);
      this.emit("flipper", f.x, 0.8);
      this.flash(p.x, p.y, "#e9f6ef");
    }
  }
  hitShot(shot: ShotId, b?: Ball) {
    if (this.phase !== "playing" || this.tilted) return;
    const selected = SHOT_ORDER[this.prescienceIndex],
      modeBefore = this.mode;
    this.combo =
      this.clock <= this.comboUntil ? Math.min(5, this.combo + 1) : 1;
    this.comboUntil = this.clock + 4;
    this.score += scoreMajorShot({
      shot,
      combo: this.combo,
      tableMultiplier: this.multiplier,
    });
    this.say(`${SHOT_LABELS[shot]} · ${this.combo}× flow`);
    this.emit(
      shot === "harvest" || shot === "dune" ? "ramp" : "shot",
      SHOTS[shot].x,
    );
    this.flash(SHOTS[shot].x, SHOTS[shot].y);
    if (b) {
      b.cooldown = this.clock + 1.2;
      if (shot === "harvest" || shot === "dune")
        b.path = {
          points: RAMP_PATHS[shot],
          elapsed: 0,
          duration: 1.45,
          exit: { x: shot === "harvest" ? 145 : -145, y: 320 },
        };
      else if (shot === "citadel")
        b.path = {
          points: [
            { x: 298, y: 177 },
            { x: 298, y: 169 },
            { x: 298, y: 169 },
            { x: 305, y: 202 },
          ],
          elapsed: 0,
          duration: 0.72,
          exit: { x: 160, y: 240 },
        };
      else
        b.path = {
          points:
            shot === "caravan"
              ? [
                  { x: 82, y: 393 },
                  { x: 76, y: 204 },
                  { x: 118, y: 99 },
                  { x: 296, y: 71 },
                  { x: 474, y: 105 },
                  { x: 510, y: 222 },
                  { x: 501, y: 524 },
                ]
              : [
                  { x: 507, y: 393 },
                  { x: 511, y: 204 },
                  { x: 473, y: 99 },
                  { x: 296, y: 71 },
                  { x: 118, y: 105 },
                  { x: 77, y: 222 },
                  { x: 85, y: 524 },
                ],
          elapsed: 0,
          duration: 1.25,
          exit: { x: shot === "caravan" ? -75 : 75, y: 490 },
        };
    }
    if (
      modeBefore &&
      MODE_ORDER.includes(modeBefore as ModeId) &&
      modeTarget(modeBefore as ModeId, shot, selected)
    ) {
      this.progress++;
      this.score += SCORE.modeShot * this.multiplier;
      if (this.progress >= 4) {
        this.completed.add(modeBefore as ModeId);
        this.score += SCORE.modeComplete;
        this.mode = null;
        this.progress = 0;
        this.say(`${MODE_LABELS[modeBefore as ModeId]} complete · 250,000`, 4);
        this.emit("complete");
      }
    } else if (modeBefore === "multiball" || modeBefore === "wizard") {
      this.score +=
        modeBefore === "wizard"
          ? SCORE.wizardShot
          : shot === "citadel"
            ? SCORE.superJackpot
            : SCORE.jackpot;
      this.progress++;
      this.say(
        modeBefore === "wizard"
          ? "DOMINION SHOT · 100,000"
          : shot === "citadel"
            ? "SUPER JACKPOT · 250,000"
            : "JACKPOT · 50,000",
      );
    }
    if (shot === selected) {
      this.multiplier = Math.min(5, this.multiplier + 1);
      this.peakMultiplier = Math.max(this.peakMultiplier, this.multiplier);
      this.prescienceIndex = (this.prescienceIndex + 1) % 5;
    }
    this.majorShots++;
    if (!modeBefore) this.openPlayShots++;
    if (shot === "citadel" && !modeBefore) {
      if (this.completed.size === 4 && this.multiballComplete) {
        this.mode = "wizard";
        this.modeUntil = this.clock + 40;
        this.progress = 0;
        this.spawn(true, 250, 550);
        this.spawn(true, 350, 550);
        this.saveUntil = this.clock + 12;
        this.say("DOMINION ASCENDANT", 5);
        this.emit("multiball");
        return;
      }
      if (!this.multiballComplete) {
        this.locks = Math.min(3, this.locks + 1);
        if (this.locks >= 3) {
          this.mode = "multiball";
          this.modeUntil = Infinity;
          this.progress = 0;
          this.spawn(true, 250, 550);
          this.spawn(true, 350, 550);
          this.saveUntil = this.clock + 12;
          this.say("WYRM AWAKENING · 3 BALLS", 4);
          this.emit("multiball");
          return;
        }
      }
    }
    if (
      !modeBefore &&
      !this.mode &&
      this.completed.size < 4 &&
      this.openPlayShots >= 4
    ) {
      this.mode = MODE_ORDER.find((m) => !this.completed.has(m)) ?? null;
      this.progress = 0;
      this.openPlayShots = 0;
      this.modeUntil = this.clock + 45;
      if (this.mode)
        this.say(`${MODE_LABELS[this.mode as ModeId]} · 45 seconds`, 4);
      this.emit("mode");
    }
  }
  drain(b: Ball) {
    if (!this.balls.includes(b)) return;
    this.balls = this.balls.filter((v) => v !== b);
    this.emit("drain", b.x);
    if (!this.tilted && this.clock < this.saveUntil) {
      this.spawn(true, 558, 885).path = {
        points: [
          { x: 558, y: 885 },
          { x: 558, y: 520 },
          { x: 558, y: 190 },
          { x: 530, y: 108 },
          { x: 295, y: 74 },
          { x: 85, y: 180 },
          { x: 85, y: 390 },
        ],
        elapsed: 0,
        duration: 1.65,
        exit: { x: 60, y: 380 },
      };
      this.say("BALL SAVED · Back into the sands");
      this.emit("save");
      return;
    }
    if (this.mode === "multiball" && this.balls.length <= 1) {
      this.multiballComplete = true;
      this.mode = null;
      this.say("The Wyrm retreats · Multiball complete");
    }
    if (this.balls.length) return;
    this.ballsRemaining--;
    this.releaseControls();
    this.tilted = false;
    this.tilt = 0;
    this.multiplier = 1;
    this.targetBank = [false, false, false];
    this.combo = 0;
    this.saveUntil = 0;
    this.mode = null;
    this.progress = 0;
    if (this.ballsRemaining <= 0) {
      this.phase = "gameover";
      this.say("The sands remember");
    } else {
      this.nextBallAt = this.clock + 1.15;
      this.say(`Ball ${4 - this.ballsRemaining} · A new chance`);
    }
  }
  snapshot(): GameSnapshot {
    const waiting = this.balls.some((b) => b.waiting);
    const instruction = this.tilted
      ? "Flippers locked until this ball drains"
      : waiting
        ? "Hold Launch to build power · Flippers select your skill shot"
        : this.mode === "multiball"
          ? "All shots score jackpots · Citadel scores super jackpot"
          : this.mode === "wizard"
            ? "Every shot scores 100,000 · Survive the final storm"
            : this.mode
              ? `${this.mode === "harvest" ? "Shoot either ramp" : this.mode === "storm" ? "Shoot the outside orbits" : this.mode === "siege" ? "Shoot the Citadel scoop" : `Follow ${SHOT_LABELS[SHOT_ORDER[this.prescienceIndex]]}`} · ${4 - this.progress} shots remaining`
              : this.completed.size === 4 && this.multiballComplete
                ? "Shoot the Citadel to begin Dominion Ascendant"
                : `Light a territory in ${Math.max(1, 4 - this.openPlayShots)} shots · Citadel locks ${this.locks}/3`;
    return {
      phase: this.phase,
      score: this.score,
      balls: this.ballsRemaining,
      currentMode: this.mode,
      modeProgress: this.progress,
      modeSeconds:
        this.mode && Number.isFinite(this.modeUntil)
          ? Math.max(0, Math.ceil(this.modeUntil - this.clock))
          : 0,
      modesComplete: [...this.completed],
      multiplier: this.multiplier,
      prescienceShot: SHOT_ORDER[this.prescienceIndex],
      combo: this.combo,
      message: this.message,
      instruction,
      tilt: Math.round(this.tilt),
      tilted: this.tilted,
      ballSave: Math.max(0, Math.ceil(this.saveUntil - this.clock)),
      waiting,
      locks: this.locks,
      charge: this.charge,
      activeBalls: this.balls.length,
      multiballComplete: this.multiballComplete,
      peakMultiplier: this.peakMultiplier,
    };
  }
}
