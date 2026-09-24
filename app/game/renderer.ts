import {
  BUMPERS,
  HEIGHT,
  RAILS,
  RAMP_PATHS,
  SHOTS,
  SLINGS,
  TARGETS,
  WIDTH,
  pathPoint,
  type Flipper,
  type PinballEngine,
  type Point,
} from "./engine";
import {
  MODE_ORDER,
  SHOT_ORDER,
  type GameSettings,
  type ModeId,
} from "./types";
import { modeTarget } from "./rules";

const INK = "#152c3a",
  BONE = "#f4deb0",
  ORANGE = "#ef763f",
  BLUE = "#74c9d5";
type Ctx = CanvasRenderingContext2D;
function circle(
  c: Ctx,
  x: number,
  y: number,
  r: number,
  fill: string | CanvasGradient,
  stroke?: string,
  width = 1,
) {
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fillStyle = fill;
  c.fill();
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = width;
    c.stroke();
  }
}
function line(c: Ctx, points: Point[], color: string, width: number) {
  c.beginPath();
  points.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
  c.lineWidth = width;
  c.strokeStyle = color;
  c.lineCap = "round";
  c.lineJoin = "round";
  c.stroke();
}
function text(
  c: Ctx,
  s: string,
  x: number,
  y: number,
  size = 10,
  color = BONE,
  spacing = 1,
) {
  c.save();
  c.textAlign = "center";
  c.fillStyle = color;
  c.font = `${size < 14 ? 600 : 400} ${size}px ${size >= 20 ? "Georgia" : "Arial"}`;
  c.letterSpacing = `${spacing}px`;
  c.fillText(s, x, y);
  c.restore();
}
function bolt(c: Ctx, x: number, y: number) {
  circle(c, x + 1, y + 2, 4, "#092333");
  circle(c, x, y, 3, "#bdd4d1", INK);
  line(
    c,
    [
      { x: x - 2, y: y + 1 },
      { x: x + 2, y: y - 1 },
    ],
    INK,
    1,
  );
}
function rail(c: Ctx, points: Point[], width = 10, color = "#b9cdd0") {
  c.save();
  c.translate(3, 8);
  line(c, points, "rgba(2,12,23,.6)", width + 5);
  c.restore();
  line(c, points, INK, width + 3);
  line(c, points, color, width);
  c.save();
  c.translate(-1, -2);
  line(c, points, "#fff0cf", Math.max(1, width * 0.22));
  c.restore();
}
function smoothPath(points: Point[]) {
  return Array.from({ length: 100 }, (_, i) => pathPoint(points, i / 99));
}
function lamp(
  c: Ctx,
  x: number,
  y: number,
  lit: boolean,
  color = ORANGE,
  size = 7,
) {
  if (lit) {
    c.save();
    c.shadowColor = color;
    c.shadowBlur = 18;
    circle(c, x, y, size, color, INK, 2);
    c.restore();
    circle(c, x - 1, y - 2, size * 0.36, "#fff2b8");
  } else circle(c, x, y, size, "#173b49", "#b49a65", 1);
}
function arrow(c: Ctx, x: number, y: number, color: string, lit: boolean) {
  c.save();
  c.translate(x, y);
  c.shadowColor = color;
  c.shadowBlur = lit ? 18 : 0;
  c.beginPath();
  c.moveTo(0, -13);
  c.lineTo(10, 1);
  c.lineTo(4, 1);
  c.lineTo(4, 12);
  c.lineTo(-4, 12);
  c.lineTo(-4, 1);
  c.lineTo(-10, 1);
  c.closePath();
  c.fillStyle = lit ? color : "#253f49";
  c.fill();
  c.strokeStyle = lit ? "#fff1c3" : "#8a917b";
  c.lineWidth = 1;
  c.stroke();
  c.restore();
}

export class TableRenderer {
  private ctx: Ctx;
  private background: HTMLCanvasElement;
  private art: HTMLImageElement;
  private disposed = false;
  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Canvas is unavailable");
    this.ctx = ctx;
    this.background = document.createElement("canvas");
    this.background.width = 1200;
    this.background.height = 2000;
    this.art = new Image();
    this.art.src = "./assets/playfield.png";
    this.art.onload = () => {
      if (!this.disposed) this.paintBackground();
    };
    this.paintBackground();
  }
  resize() {
    const rect = this.canvas.getBoundingClientRect(),
      dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(rect.width * dpr),
      h = Math.round(rect.height * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }
  private paintBackground() {
    const c = this.background.getContext("2d")!;
    c.setTransform(2, 0, 0, 2, 0, 0);
    c.fillStyle = "#183341";
    c.fillRect(0, 0, WIDTH, HEIGHT);
    c.save();
    c.beginPath();
    c.roundRect(18, 20, 566, 955, [140, 140, 40, 40]);
    c.clip();
    if (this.art.complete && this.art.naturalWidth)
      c.drawImage(this.art, 20, 0, 560, 1000);
    const veil = c.createLinearGradient(0, 0, 0, 1000);
    veil.addColorStop(0, "rgba(5,28,49,.4)");
    veil.addColorStop(0.45, "rgba(216,127,69,.1)");
    veil.addColorStop(1, "rgba(230,166,91,.48)");
    c.fillStyle = veil;
    c.fillRect(0, 0, 600, 1000);
    // Printed crosshatching and fine contours make the playfield read as lacquered art.
    c.globalAlpha = 0.17;
    for (let y = 516; y < 850; y += 8) {
      c.beginPath();
      c.moveTo(90, y);
      c.bezierCurveTo(190, y - 32, 372, y + 54, 490, y - 3);
      c.strokeStyle = INK;
      c.lineWidth = 0.55;
      c.stroke();
    }
    c.globalAlpha = 1;
    c.fillStyle = "rgba(10,35,48,.17)";
    c.fillRect(42, 115, 490, 775);
    // Recessed orbit trough.
    const orbit = [
      { x: 84, y: 556 },
      { x: 81, y: 226 },
      { x: 87, y: 132 },
      { x: 153, y: 80 },
      { x: 435, y: 80 },
      { x: 509, y: 141 },
      { x: 507, y: 560 },
    ];
    line(c, orbit, "rgba(1,15,27,.68)", 43);
    line(c, orbit, "rgba(50,107,124,.48)", 30);
    rail(
      c,
      [
        { x: 64, y: 557 },
        { x: 59, y: 225 },
        { x: 65, y: 122 },
        { x: 144, y: 58 },
        { x: 442, y: 58 },
        { x: 530, y: 127 },
        { x: 529, y: 560 },
      ],
      5,
    );
    // Apron and drain. Side outlanes are deliberately visible.
    c.fillStyle = "#102c3a";
    c.beginPath();
    c.moveTo(22, 779);
    c.lineTo(152, 900);
    c.lineTo(448, 900);
    c.lineTo(580, 781);
    c.lineTo(582, 1000);
    c.lineTo(18, 1000);
    c.closePath();
    c.fill();
    line(
      c,
      [
        { x: 42, y: 928 },
        { x: 149, y: 955 },
        { x: 452, y: 955 },
        { x: 558, y: 928 },
      ],
      "#d09a63",
      2,
    );
    text(c, "W O R L D S   O F   S P I C E", 300, 942, 15, BONE, 1);
    text(c, "THE DESERT REMEMBERS", 300, 965, 7, "#93adb0", 2);
    for (const r of RAILS) {
      if (r.kind) continue;
      rail(c, [r.a, r.b], r.radius * 1.55);
      bolt(c, r.a.x, r.a.y);
    }
    // Slingshot plastics: illustrated shield, rubber edge, visible fasteners.
    for (const side of [0, 1]) {
      c.save();
      if (side) {
        c.translate(582, 0);
        c.scale(-1, 1);
      }
      c.shadowColor = "rgba(0,0,0,.7)";
      c.shadowBlur = 7;
      c.shadowOffsetY = 9;
      c.beginPath();
      SLINGS[0].forEach((p, i) =>
        i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y),
      );
      c.closePath();
      c.fillStyle = "#245268";
      c.fill();
      c.shadowBlur = 0;
      c.shadowOffsetY = 0;
      c.strokeStyle = BONE;
      c.lineWidth = 3;
      c.stroke();
      line(
        c,
        [
          { x: 122, y: 656 },
          { x: 194, y: 743 },
        ],
        "#f5b085",
        7,
      );
      for (let j = 0; j < 6; j++)
        line(
          c,
          [
            { x: 122, y: 669 + j * 7 },
            { x: 139 + j * 6, y: 701 + j * 7 },
          ],
          "#9bb8b4",
          0.7,
        );
      bolt(c, 122, 660);
      bolt(c, 180, 738);
      text(c, "S", 143, 712, 22, BONE);
      c.restore();
    }
    // Target faces and their articulated bases.
    TARGETS.forEach((p, i) => {
      c.fillStyle = "#102b3b";
      c.fillRect(p.x - 20, p.y - 5, 40, 17);
      c.fillStyle = "#f5ce8e";
      c.fillRect(p.x - 16, p.y - 11, 32, 11);
      c.strokeStyle = INK;
      c.lineWidth = 2;
      c.strokeRect(p.x - 16, p.y - 11, 32, 11);
      text(c, ["I", "II", "III"][i], p.x, p.y - 2, 8, INK, 0);
    });
    // Pop bumpers: feet, recessed rings, enamel caps and metal collars.
    BUMPERS.forEach((p, i) => {
      circle(c, p.x + 4, p.y + 11, 40, "rgba(4,23,35,.6)");
      circle(c, p.x, p.y, 38, "#193b4b", BONE, 1);
      circle(c, p.x, p.y, 32, "#7faaa9", INK, 2);
      circle(c, p.x, p.y - 4, 28, "#f2c987", INK, 3);
      circle(c, p.x, p.y - 7, 23, i === 2 ? "#2f6e84" : "#dc6838", BONE, 2);
      circle(c, p.x, p.y - 7, 16, "transparent", BONE, 1);
      text(c, ["✦", "✦", "✦"][i], p.x, p.y + 1, 25, BONE, 0);
      for (let j = 0; j < 3; j++) {
        const a = j * 2.1;
        bolt(c, p.x + Math.cos(a) * 34, p.y + Math.sin(a) * 34);
      }
    });
    text(c, "SPICE FIELDS", 298, 308, 8, BONE, 2);
    // Creature scoop, a sculpted ribbed throat above the central shot.
    circle(c, 303, 165, 56, "rgba(0,10,19,.55)");
    for (let i = 9; i >= 0; i--) {
      const radius = 21 + i * 3.15,
        y = 162 - i * 0.8;
      circle(c, 298, y, radius, i % 2 ? "#bd623a" : "#f0b479", INK, 1.3);
    }
    circle(c, 298, 162, 22, "#071b2b", BONE, 1);
    for (let j = 0; j < 26; j++) {
      const a = (j * Math.PI * 2) / 26;
      line(
        c,
        [
          { x: 298 + Math.cos(a) * 33, y: 162 + Math.sin(a) * 33 },
          {
            x: 298 + Math.cos(a + 0.04) * 22,
            y: 162 + Math.sin(a + 0.04) * 22,
          },
        ],
        "#fbdeb0",
        1.4,
      );
    }
    text(c, "THE GREAT WYRM", 298, 112, 10, BONE, 1.3);
    text(c, "CITADEL · LOCK", 298, 222, 8, BONE, 0.8);
    // Raised clear-blue ramps sit above the inked landscape.
    for (const name of ["harvest", "dune"] as const) {
      const path = smoothPath(RAMP_PATHS[name]);
      c.save();
      c.translate(7, 15);
      line(c, path, "rgba(4,16,27,.6)", 28);
      c.restore();
      line(c, path, INK, 30);
      line(c, path, "#528d9b", 26);
      line(c, path, "#2b6174", 18);
      line(c, path, "#79aeb6", 1.4);
      const offset = (amount: number) =>
        path.map((p, i) => {
          const prev = path[Math.max(0, i - 1)],
            next = path[Math.min(path.length - 1, i + 1)],
            dx = next.x - prev.x,
            dy = next.y - prev.y,
            d = Math.hypot(dx, dy) || 1;
          return { x: p.x - (dy / d) * amount, y: p.y + (dx / d) * amount };
        });
      rail(c, offset(13), 3);
      rail(c, offset(-13), 3);
      [0.1, 0.45, 0.7, 0.9].forEach((t) => {
        const p = pathPoint(RAMP_PATHS[name], t);
        line(
          c,
          [
            { x: p.x, y: p.y + 4 },
            { x: p.x + 6, y: p.y + 24 },
          ],
          "#243c43",
          4,
        );
        bolt(c, p.x + 6, p.y + 24);
      });
      const start = RAMP_PATHS[name][0];
      line(
        c,
        [
          { x: start.x - 16, y: start.y + 12 },
          { x: start.x + 16, y: start.y + 12 },
        ],
        "#f9d794",
        4,
      );
    }
    text(c, "HARVEST", 154, 458, 9, BONE, 0.8);
    text(c, "HIGH DUNE", 443, 458, 9, BONE, 0.8);
    text(c, "CARAVAN", 83, 423, 7, BONE, 0.5);
    text(c, "STORM", 506, 423, 7, BONE, 0.5);
    // Quiet open space below the mechanisms preserves ball tracking.
    c.save();
    c.translate(294, 601);
    c.rotate(-0.04);
    text(c, "WORLDS", 0, -15, 32, "#f6dfb6", 3);
    text(c, "OF SPICE", 0, 16, 30, "#f6dfb6", 3);
    text(c, "A DESERT ODYSSEY", 0, 37, 7, INK, 2);
    c.restore();
    for (let j = 0; j < 4; j++) {
      const x = 226 + j * 45;
      circle(c, x, 671, 13, "#1c3d4c", BONE, 1);
      text(c, ["H", "S", "C", "O"][j], x, 675, 9, "#809695", 0);
    }
    text(c, "TERRITORIES", 295, 705, 7, INK, 2);
    text(c, "BALL SAVE", 292, 781, 8, INK, 1.5);
    text(c, "RETURN", 114, 771, 7, BONE, 0.8);
    text(c, "RETURN", 465, 771, 7, BONE, 0.8);
    c.save();
    c.translate(558, 652);
    c.rotate(-Math.PI / 2);
    text(c, "LAUNCH   /   ORBITAL ASCENT", 0, 3, 7, "#e7be7d", 2);
    c.restore();
    // Mechanical plunger, visible coil and barrel.
    c.fillStyle = "#091f2e";
    c.fillRect(549, 908, 18, 61);
    for (let y = 914; y < 956; y += 5)
      line(
        c,
        [
          { x: 551, y },
          { x: 565, y: y + 2 },
        ],
        "#a5b5ac",
        2,
      );
    rail(
      c,
      [
        { x: 558, y: 902 },
        { x: 558, y: 918 },
      ],
      9,
    );
    c.restore();
    // Cabinet bezel and bevel. Warm upper edge, cold recessed inner edge.
    c.beginPath();
    c.roundRect(16, 16, 572, 968, [135, 135, 28, 28]);
    c.strokeStyle = "#091c28";
    c.lineWidth = 19;
    c.stroke();
    c.strokeStyle = "#527684";
    c.lineWidth = 7;
    c.stroke();
    c.strokeStyle = "#f0bd7e";
    c.lineWidth = 1.3;
    c.stroke();
    [32, 570].forEach((x) => [285, 550, 897].forEach((y) => bolt(c, x, y)));
  }
  private flipper(c: Ctx, f: Flipper) {
    c.save();
    c.translate(f.x, f.y);
    c.rotate(f.angle);
    c.shadowColor = "#071c2c";
    c.shadowBlur = 8;
    c.shadowOffsetY = 8;
    c.beginPath();
    c.moveTo(0, -12);
    c.lineTo(f.length, -7);
    c.arc(f.length, 0, 7, -Math.PI / 2, Math.PI / 2);
    c.lineTo(0, 12);
    c.arc(0, 0, 12, Math.PI / 2, Math.PI * 1.5);
    c.closePath();
    c.fillStyle = "#df6539";
    c.fill();
    c.shadowBlur = 0;
    c.shadowOffsetY = 0;
    c.strokeStyle = "#162f3e";
    c.lineWidth = 3;
    c.stroke();
    line(
      c,
      [
        { x: 3, y: -6 },
        { x: f.length - 1, y: -3 },
      ],
      "#ffe2a6",
      6,
    );
    circle(c, 0, 0, 8, "#e8d6aa", INK, 1);
    circle(c, 0, 0, 3, "#568799");
    c.restore();
  }
  draw(e: PinballEngine, settings: GameSettings, ambientTime: number) {
    const c = this.ctx;
    c.setTransform(
      this.canvas.width / WIDTH,
      0,
      0,
      this.canvas.height / HEIGHT,
      0,
      0,
    );
    c.drawImage(this.background, 0, 0, WIDTH, HEIGHT);
    const time = e.phase === "ready" ? ambientTime : e.clock;
    if (!settings.reducedMotion) {
      // Fine drifting grains, not a screen-wide particle storm.
      c.save();
      c.globalAlpha = 0.22;
      for (let i = 0; i < 27; i++) {
        const x = ((i * 97.33 + time * 13) % 460) + 64,
          y = 518 + ((i * 73.71 + Math.sin(time * 0.2 + i) * 12) % 259);
        line(
          c,
          [
            { x, y },
            { x: x + 2.5, y: y - 0.7 },
          ],
          "#ffe7be",
          0.6,
        );
      }
      c.restore();
    }
    for (const shot of SHOT_ORDER) {
      const p = SHOTS[shot];
      const mission =
        e.mode &&
        MODE_ORDER.includes(e.mode as ModeId) &&
        modeTarget(e.mode as ModeId, shot, SHOT_ORDER[e.prescienceIndex]);
      const lit =
        (SHOT_ORDER[e.prescienceIndex] === shot ||
          mission ||
          e.mode === "multiball" ||
          e.mode === "wizard") &&
        !e.tilted;
      const y = shot === "citadel" ? 418 : p.y + 61;
      arrow(c, p.x, y, mission ? BLUE : ORANGE, Boolean(lit));
      if (lit && !settings.reducedMotion) {
        c.save();
        c.globalAlpha = 0.17 + 0.14 * Math.sin(time * 4);
        circle(c, p.x, y, 24, mission ? BLUE : ORANGE);
        c.restore();
      }
    }
    for (let i = 0; i < 3; i++)
      lamp(c, 274 + i * 24, 236, i < e.locks, BLUE, 5);
    MODE_ORDER.forEach((m, i) =>
      lamp(c, 226 + i * 45, 671, e.completed.has(m), BLUE, 8),
    );
    lamp(c, 292, 751, e.saveUntil > e.clock && e.phase === "playing", BLUE, 8);
    TARGETS.forEach((p, i) => {
      if (e.targetBank[i]) {
        c.fillStyle = BLUE;
        c.fillRect(p.x - 15, p.y - 10, 30, 9);
        text(c, ["I", "II", "III"][i], p.x, p.y - 2, 8, INK, 0);
      }
    });
    // A pressed bumper cap moves with its skirt; each physical impact has a visual reply.
    BUMPERS.forEach((p, i) => {
      const impact = e.flashes.findLast((f) => f.x === p.x && f.y === p.y);
      if (!impact) return;
      const recoil = Math.max(0, 1 - (e.clock - impact.time) / 0.28);
      if (!recoil) return;
      circle(c, p.x, p.y - 7, 26, "#102c3a", BLUE, 1);
      const offset = settings.reducedMotion
        ? 0
        : Math.sin(recoil * Math.PI) * 4;
      circle(
        c,
        p.x,
        p.y - 7 + offset,
        23,
        i === 2 ? "#4194a2" : "#f4a465",
        BONE,
        2,
      );
      circle(c, p.x, p.y - 7 + offset, 16, "transparent", BONE, 1);
      text(c, "✦", p.x, p.y + 1 + offset, 25, BONE, 0);
    });
    if (e.combo > 1 && !e.tilted) {
      const remaining = Math.max(0, (e.comboUntil - e.clock) / 4);
      c.save();
      c.fillStyle = "#123543";
      c.beginPath();
      c.roundRect(243, 634, 103, 23, 11);
      c.fill();
      text(c, `${e.combo}× FLOW`, 295, 649, 11, BONE, 1.4);
      line(
        c,
        [
          { x: 255, y: 655 },
          { x: 255 + 79 * remaining, y: 655 },
        ],
        BLUE,
        2,
      );
      c.restore();
    }
    this.flipper(c, e.left);
    this.flipper(c, e.right);
    // Impact rings and a restrained sparkle around hits.
    for (const f of e.flashes) {
      const age = (e.clock - f.time) / 0.55;
      if (settings.reducedMotion) continue;
      c.save();
      c.globalAlpha = (1 - age) * 0.75;
      c.strokeStyle = f.color;
      c.lineWidth = 2;
      c.beginPath();
      c.arc(f.x, f.y, 10 + age * 45, 0, Math.PI * 2);
      c.stroke();
      c.restore();
    }
    for (const b of e.balls) {
      if (settings.ballTrail && !settings.reducedMotion && !b.waiting) {
        b.trail.forEach((p, i) => {
          c.globalAlpha = (1 - i / 12) * 0.16;
          circle(c, p.x, p.y, Math.max(1, 8 - i * 0.5), "#e3f5df");
        });
        c.globalAlpha = 1;
      }
      const lift = b.path ? 5 : 0;
      c.save();
      c.shadowColor = "#020a10";
      c.shadowBlur = 8;
      circle(c, b.x + 5 + lift, b.y + 7 + lift, 10, "rgba(0,7,15,.5)");
      c.restore();
      const metal = c.createRadialGradient(
        b.x - 3,
        b.y - 4,
        1,
        b.x + 1,
        b.y + 2,
        12,
      );
      metal.addColorStop(0, "#ffffff");
      metal.addColorStop(0.25, "#e0f0ee");
      metal.addColorStop(0.43, "#86b4c8");
      metal.addColorStop(0.5, "#244458");
      metal.addColorStop(0.68, "#ccbb9b");
      metal.addColorStop(1, "#203b4c");
      circle(c, b.x, b.y, 10, metal, "#eaf4d9", 0.8);
      circle(c, b.x - 3, b.y - 4, 2.7, "#fffef1");
    }
    if (e.charging) {
      c.save();
      c.strokeStyle = ORANGE;
      c.lineWidth = 4;
      c.beginPath();
      c.arc(558, 887, 16, -Math.PI / 2, -Math.PI / 2 + e.charge * Math.PI * 2);
      c.stroke();
      c.restore();
    }
    // Articulated three-part jaws open on a lock; multiball keeps the throat alive.
    const captive = e.balls.some(
      (b) => b.path && b.path.points[0].x === 298 && b.path.points[0].y === 177,
    );
    if (captive || e.mode === "multiball" || e.mode === "wizard") {
      c.save();
      const breath = settings.reducedMotion
        ? 0.5
        : 0.5 + Math.sin(time * (captive ? 12 : 3)) * 0.5;
      circle(c, 298, 162, 32, "#071b2b", ORANGE, 2);
      c.shadowColor = ORANGE;
      c.shadowBlur = 14;
      for (let jaw = 0; jaw < 3; jaw++) {
        const a = (jaw * Math.PI * 2) / 3 - Math.PI / 2;
        c.beginPath();
        c.arc(298, 162, 27 + breath * 3, a, a + 1.7);
        c.strokeStyle = "#f3c78f";
        c.lineWidth = 4;
        c.stroke();
        for (let tooth = 0; tooth < 5; tooth++) {
          const angle = a + tooth * 0.34;
          line(
            c,
            [
              {
                x: 298 + Math.cos(angle) * (27 + breath * 3),
                y: 162 + Math.sin(angle) * (27 + breath * 3),
              },
              {
                x: 298 + Math.cos(angle + 0.02) * (17 + breath * 5),
                y: 162 + Math.sin(angle + 0.02) * (17 + breath * 5),
              },
            ],
            BONE,
            1.5,
          );
        }
      }
      c.restore();
    }
    if (e.tilted) {
      c.fillStyle = "rgba(2,18,29,.45)";
      c.fillRect(0, 0, 600, 1000);
      text(c, "T I L T", 300, 560, 40, BONE, 2);
    }
    // Glass edge reflection stays away from the playable center.
    const glass = c.createLinearGradient(0, 0, 600, 400);
    glass.addColorStop(0, "rgba(232,247,245,.09)");
    glass.addColorStop(0.25, "rgba(255,255,255,0)");
    glass.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = glass;
    c.fillRect(24, 24, 552, 950);
  }
  destroy() {
    this.disposed = true;
    this.art.onload = null;
  }
}
