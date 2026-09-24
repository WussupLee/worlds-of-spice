import * as Phaser from "phaser";
import { ballSaveDuration, modeTarget, SCORE, scoreMajorShot } from "./rules";
import { MODE_LABELS, MODE_ORDER, SHOT_ORDER, type GameSettings, type GameSnapshot, type ModeId, type ShotId, type StrategyId } from "./types";

type MatterBody = MatterJS.BodyType;

const W = 900;
const H = 1600;

export class WorldsOfSpiceScene extends Phaser.Scene {
  private strategy: StrategyId;
  private settings: GameSettings;
  private onSnapshot: (state: GameSnapshot) => void;
  private phase: GameSnapshot["phase"] = "playing";
  private score = 0;
  private balls = 3;
  private tableMultiplier = 1;
  private combo = 0;
  private comboExpires = 0;
  private prescienceIndex = 0;
  private currentMode: ModeId | "multiball" | "wizard" | null = null;
  private modeProgress = 0;
  private modesComplete = new Set<ModeId>();
  private majorShotCount = 0;
  private wyrmLocks = 0;
  private multiballPlayed = false;
  private message = "Hold LAUNCH, then release";
  private tilt = 0;
  private lastNudge = 0;
  private ballStartedAt = 0;
  private activeBalls = new Set<Phaser.Physics.Matter.Image>();
  private ball?: Phaser.Physics.Matter.Image;
  private leftPressed = false;
  private rightPressed = false;
  private leftAngle = -0.28;
  private rightAngle = Math.PI + 0.28;
  private leftBody?: MatterBody;
  private rightBody?: MatterBody;
  private flipperGraphics?: Phaser.GameObjects.Graphics;
  private glowGraphics?: Phaser.GameObjects.Graphics;
  private keys?: Record<string, Phaser.Input.Keyboard.Key>;
  private audio?: AudioContext;
  private lastPublished = "";
  private modeTimer?: Phaser.Time.TimerEvent;
  private modeHits = 0;
  private pausedByUser = false;

  constructor(strategy: StrategyId, settings: GameSettings, onSnapshot: (state: GameSnapshot) => void) {
    super("worlds-of-spice");
    this.strategy = strategy;
    this.settings = settings;
    this.onSnapshot = onSnapshot;
  }

  create() {
    this.matter.world.setBounds(34, 24, W - 68, H + 100, 64, true, true, true, false);
    this.drawPlayfield();
    this.createGeometry();
    this.createFlippers();
    this.createKeyboard();
    this.matter.world.on("collisionstart", this.onCollision, this);
    this.spawnBall();
    this.publish(true);
  }

  private drawPlayfield() {
    const frame = this.add.graphics();
    frame.fillStyle(0x080705, 0.25).fillRoundedRect(24, 18, W - 48, H - 36, 42);
    frame.lineStyle(10, 0x2c2116, 0.95).strokeRoundedRect(25, 18, W - 50, H - 36, 42);
    frame.lineStyle(3, 0xb98135, 0.7).strokeRoundedRect(39, 32, W - 78, H - 64, 34);
    frame.fillStyle(0x080808, 0.86).fillRoundedRect(125, 74, 650, 82, 22);
    frame.lineStyle(2, 0xda9a43, 0.65).strokeRoundedRect(125, 74, 650, 82, 22);
    frame.fillStyle(0x100a06, 0.82).fillCircle(450, 465, 114);
    frame.lineStyle(8, 0x8a5725, 0.92).strokeCircle(450, 465, 108);
    frame.lineStyle(2, 0xffc86d, 0.8).strokeCircle(450, 465, 92);

    [
      [210, 315], [450, 260], [690, 315],
    ].forEach(([x, y]) => {
      frame.fillStyle(0x1b0f09, 0.9).fillCircle(x, y, 48);
      frame.lineStyle(5, 0xa86427, 0.8).strokeCircle(x, y, 46);
      frame.fillStyle(0xe7a343, 0.16).fillCircle(x, y, 35);
    });

    const labels: Array<[number, number, string]> = [
      [120, 740, "CARAVAN"], [285, 650, "HARVEST"], [450, 610, "CITADEL"], [615, 650, "HIGH DUNE"], [780, 740, "STORM"],
    ];
    labels.forEach(([x, y, label]) => this.add.text(x, y, label, {
      fontFamily: "Arial Narrow, sans-serif", fontSize: "18px", color: "#f4c979", stroke: "#1a0b04", strokeThickness: 4,
    }).setOrigin(0.5).setAngle(x < 450 ? -14 : x > 450 ? 14 : 0));

    this.add.text(450, 112, "WORLDS OF SPICE", {
      fontFamily: "Georgia, serif", fontSize: "42px", fontStyle: "bold", letterSpacing: 6, color: "#ffd991", stroke: "#3b1706", strokeThickness: 6,
    }).setOrigin(0.5);
    this.add.text(450, 468, "THE GREAT\nWYRM", {
      align: "center", fontFamily: "Georgia, serif", fontSize: "24px", color: "#ffd28a", stroke: "#270e05", strokeThickness: 5,
    }).setOrigin(0.5);
    this.add.text(818, 1270, "LAUNCH\nCHANNEL", { align: "center", fontFamily: "Arial", fontSize: "16px", color: "#e8bb73" }).setOrigin(0.5);
    this.glowGraphics = this.add.graphics();
    this.flipperGraphics = this.add.graphics();
  }

  private wall(x: number, y: number, width: number, height: number, angle = 0) {
    this.matter.add.rectangle(x, y, width, height, { isStatic: true, angle, restitution: 0.75, friction: 0.02, label: "rail" });
    const rail = this.add.rectangle(x, y, width, Math.max(8, height), 0x24190f, 0.94).setRotation(angle);
    rail.setStrokeStyle(3, 0xc18b47, 0.85);
  }

  private sensor(x: number, y: number, width: number, height: number, label: string, angle = 0) {
    return this.matter.add.rectangle(x, y, width, height, { isStatic: true, isSensor: true, angle, label });
  }

  private createGeometry() {
    this.wall(93, 1010, 18, 1040, -0.03);
    this.wall(807, 960, 18, 920, 0.03);
    this.wall(855, 1280, 16, 520);
    this.wall(782, 1300, 12, 410);
    this.wall(188, 1210, 300, 16, 0.57);
    this.wall(712, 1210, 300, 16, -0.57);
    this.wall(166, 885, 250, 14, -0.44);
    this.wall(734, 885, 250, 14, 0.44);
    this.wall(296, 620, 230, 12, -0.62);
    this.wall(604, 620, 230, 12, 0.62);
    this.wall(332, 420, 170, 12, 0.48);
    this.wall(568, 420, 170, 12, -0.48);
    this.wall(450, 760, 150, 12);

    [[210, 315], [450, 260], [690, 315]].forEach(([x, y], index) => {
      this.matter.add.circle(x, y, 48, { isStatic: true, restitution: 1.55, label: `bumper:${index}` });
    });

    [[202, 1050, -0.48], [698, 1050, 0.48]].forEach(([x, y, angle], index) => {
      this.matter.add.rectangle(x, y, 150, 34, { isStatic: true, angle, restitution: 1.15, label: `sling:${index}` });
      this.add.triangle(x, y, -70, 20, 70, 20, index === 0 ? 40 : -40, -45, 0x5b2412, 0.92).setRotation(angle).setStrokeStyle(4, 0xe5a048, 0.9);
    });

    this.sensor(112, 675, 72, 34, "shot:caravan", -0.1);
    this.sensor(282, 555, 86, 28, "shot:harvest", -0.15);
    this.sensor(450, 465, 140, 140, "shot:citadel");
    this.sensor(618, 555, 86, 28, "shot:dune", 0.15);
    this.sensor(788, 675, 72, 34, "shot:storm", 0.1);
    this.sensor(450, 1555, 520, 45, "drain");
  }

  private createFlippers() {
    const opts = { isStatic: true, restitution: 0.9, friction: 0, label: "flipper:left" };
    this.leftBody = this.matter.add.rectangle(330, 1375, 205, 36, { ...opts, angle: this.leftAngle });
    this.rightBody = this.matter.add.rectangle(570, 1375, 205, 36, { ...opts, label: "flipper:right", angle: this.rightAngle });
    this.drawFlippers();
  }

  private drawFlippers() {
    if (!this.flipperGraphics) return;
    this.flipperGraphics.clear();
    const draw = (x: number, y: number, angle: number) => {
      this.flipperGraphics!.save();
      this.flipperGraphics!.translateCanvas(x, y).rotateCanvas(angle);
      this.flipperGraphics!.fillStyle(0x120c08, 1).fillRoundedRect(-102, -18, 204, 36, 18);
      this.flipperGraphics!.lineStyle(5, 0xd99a43, 1).strokeRoundedRect(-102, -18, 204, 36, 18);
      this.flipperGraphics!.fillStyle(0xffd782, 0.7).fillCircle(-75, 0, 8);
      this.flipperGraphics!.restore();
    };
    draw(330, 1375, this.leftAngle);
    draw(570, 1375, this.rightAngle);
  }

  private createKeyboard() {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    this.keys = {
      left: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      right: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      a: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      d: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      space: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      p: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P),
      esc: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC),
      z: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z),
      x: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X),
    };
  }

  private makeBallTexture() {
    if (this.textures.exists("spice-ball")) return;
    const g = this.add.graphics();
    g.fillStyle(0x24160d).fillCircle(22, 22, 20);
    g.fillStyle(0xbfbab1).fillCircle(20, 20, 18);
    g.fillStyle(0xf8f2df).fillCircle(14, 12, 7);
    g.lineStyle(2, 0x5b3f28).strokeCircle(22, 22, 19);
    g.generateTexture("spice-ball", 44, 44);
    g.destroy();
  }

  private spawnBall(x = 820, y = 1460, active = false) {
    this.makeBallTexture();
    const ball = this.matter.add.image(x, y, "spice-ball", undefined, { label: "ball", restitution: 0.84, friction: 0.002, frictionAir: 0.0018, density: 0.008 });
    ball.setCircle(20).setDepth(20);
    ball.setData("launched", active);
    if (!active) ball.setStatic(true);
    this.activeBalls.add(ball);
    this.ball = ball;
    if (active) {
      ball.setVelocity(Phaser.Math.Between(-7, 7), -23);
      this.ballStartedAt = this.time.now;
    }
    return ball;
  }

  launch() {
    if (this.phase === "gameover") return;
    this.ensureAudio();
    const waiting = [...this.activeBalls].find((candidate) => !candidate.getData("launched"));
    if (!waiting) return;
    waiting.setStatic(false);
    waiting.setData("launched", true);
    waiting.setVelocity(-2.4, -31);
    this.ballStartedAt = this.time.now;
    this.message = "Follow the illuminated shot";
    this.sfx(180, 0.12, "square");
    this.publish(true);
  }

  setFlipper(side: "left" | "right", active: boolean) {
    if (side === "left") this.leftPressed = active;
    else this.rightPressed = active;
    if (active && [...this.activeBalls].some((candidate) => !candidate.getData("launched"))) {
      this.prescienceIndex = side === "right"
        ? (this.prescienceIndex + 1) % SHOT_ORDER.length
        : (this.prescienceIndex - 1 + SHOT_ORDER.length) % SHOT_ORDER.length;
      this.message = `Prescience: ${SHOT_ORDER[this.prescienceIndex].toUpperCase()}`;
      this.publish(true);
    }
  }

  nudge(x: number, y: number) {
    if (this.time.now - this.lastNudge < 280 || this.phase !== "playing") return;
    this.lastNudge = this.time.now;
    this.tilt = Math.min(100, this.tilt + 34);
    for (const ball of this.activeBalls) {
      if (ball.active && ball.getData("launched")) ball.applyForce(new Phaser.Math.Vector2(x * 0.018, y * 0.012));
    }
    this.message = this.tilt >= 100 ? "TILT — machinery locked" : "DANGER";
    this.sfx(72, 0.09, "sawtooth");
    if (this.tilt >= 100) {
      this.leftPressed = false;
      this.rightPressed = false;
    }
    this.publish(true);
  }

  togglePause() {
    if (this.phase === "gameover") return;
    this.pausedByUser = !this.pausedByUser;
    this.phase = this.pausedByUser ? "paused" : "playing";
    this.matter.world.enabled = !this.pausedByUser;
    this.message = this.pausedByUser ? "PAUSED" : "The sands are moving";
    this.publish(true);
  }

  private onCollision(event: Phaser.Physics.Matter.Events.CollisionStartEvent) {
    for (const pair of event.pairs) {
      const labels = [pair.bodyA.label, pair.bodyB.label];
      const ballBody = pair.bodyA.label === "ball" ? pair.bodyA : pair.bodyB.label === "ball" ? pair.bodyB : null;
      if (!ballBody) continue;
      const ball = [...this.activeBalls].find((candidate) => candidate.body === ballBody);
      if (!ball) continue;
      const other = labels.find((label) => label !== "ball") ?? "";
      if (other.startsWith("bumper:")) {
        this.addScore(SCORE.bumper);
        const away = new Phaser.Math.Vector2(ball.x - 450, ball.y - 290).normalize().scale(0.025);
        ball.applyForce(away);
        this.flash(ball.x, ball.y, 0xffbe57);
        this.sfx(330 + Number(other.at(-1)) * 90, 0.055, "square");
      } else if (other.startsWith("sling:")) {
        this.addScore(SCORE.sling);
        const velocity = (ball.body as MatterBody).velocity;
        ball.setVelocity(velocity.x + (ball.x < W / 2 ? 8 : -8), Math.min(-14, velocity.y - 7));
        this.flash(ball.x, ball.y, 0xff7340);
      } else if (other.startsWith("shot:")) {
        this.hitShot(other.slice(5) as ShotId, ball);
      } else if (other.startsWith("flipper:") && this.tilt < 100) {
        const firing = other.endsWith("left") ? this.leftPressed : this.rightPressed;
        if (firing) {
          const horizontal = other.endsWith("left") ? 9 : -9;
          const velocity = (ball.body as MatterBody).velocity;
          ball.setVelocity(velocity.x + horizontal, Math.min(-22, velocity.y - 15));
          this.sfx(115, 0.035, "square");
        }
      } else if (other === "drain") {
        this.handleDrain(ball);
      }
    }
  }

  private hitShot(shot: ShotId, ball: Phaser.Physics.Matter.Image) {
    const now = this.time.now;
    this.combo = now <= this.comboExpires ? Math.min(5, this.combo + 1) : 1;
    this.comboExpires = now + 3_000;
    const prescient = SHOT_ORDER[this.prescienceIndex] === shot;
    this.addScore(scoreMajorShot({ combo: this.combo, tableMultiplier: this.tableMultiplier, strategy: this.strategy, shot }));
    if (prescient) {
      this.tableMultiplier = Math.min(5, this.tableMultiplier + (this.strategy === "oracle" ? 2 : 1));
      this.prescienceIndex = (this.prescienceIndex + 1) % SHOT_ORDER.length;
      this.message = `PRESCIENCE ${this.tableMultiplier}×`;
    } else {
      this.message = `${shot.toUpperCase()} · ${this.combo}× FLOW`;
    }
    this.majorShotCount += 1;

    if (shot === "citadel") {
      this.wyrmLocks += 1;
      ball.setVelocity(Phaser.Math.Between(-12, 12), -20);
      this.flash(450, 465, 0xff762f, 1.8);
      if (this.wyrmLocks >= 3 && !this.multiballPlayed) this.startMultiball();
      else if (this.modesComplete.size === 4 && this.multiballPlayed && this.currentMode === null) this.startWizard();
    }

    if (this.currentMode && MODE_ORDER.includes(this.currentMode as ModeId)) {
      const mode = this.currentMode as ModeId;
      if (modeTarget(mode, shot, SHOT_ORDER[this.prescienceIndex])) {
        this.modeProgress = Math.min(4, this.modeProgress + 1);
        this.modeHits += 1;
        this.addScore(SCORE.modeShot * this.tableMultiplier);
        if (this.modeProgress >= 4) this.completeMode(mode);
      }
    } else if (this.currentMode === "multiball") {
      this.addScore(shot === "citadel" ? SCORE.superJackpot : SCORE.jackpot);
      this.message = shot === "citadel" ? "SUPER JACKPOT" : "JACKPOT";
    } else if (this.currentMode === "wizard") {
      this.addScore(SCORE.wizardShot);
      this.modeProgress += 1;
      this.message = "DOMINION ASCENDANT";
    } else if (this.majorShotCount > 0 && this.majorShotCount % 4 === 0) {
      this.startNextMode();
    }
    this.flash(ball.x, ball.y, prescient ? 0xe9f5ff : 0xffc46c);
    this.sfx(prescient ? 660 : 440, 0.065, "triangle");
    this.publish(true);
  }

  private startNextMode() {
    const next = MODE_ORDER.find((mode) => !this.modesComplete.has(mode));
    if (!next) return;
    this.currentMode = next;
    this.modeProgress = 0;
    this.modeHits = 0;
    this.message = MODE_LABELS[next].toUpperCase();
    this.modeTimer?.remove(false);
    this.modeTimer = this.time.delayedCall(30_000, () => {
      if (this.currentMode === next) {
        this.currentMode = null;
        this.modeProgress = 0;
        this.message = "Mission lost to the sands";
        this.publish(true);
      }
    });
  }

  private completeMode(mode: ModeId) {
    this.modesComplete.add(mode);
    this.addScore(SCORE.modeComplete);
    this.currentMode = null;
    this.modeProgress = 0;
    this.message = `${MODE_LABELS[mode].toUpperCase()} COMPLETE`;
    this.modeTimer?.remove(false);
    this.flash(450, 780, 0xffd36b, 2.4);
  }

  private startMultiball() {
    this.multiballPlayed = true;
    this.currentMode = "multiball";
    this.message = "WYRM AWAKENING · MULTIBALL";
    this.addScore(SCORE.superJackpot);
    this.spawnBall(420, 520, true);
    this.spawnBall(480, 520, true);
    this.time.delayedCall(28_000, () => {
      if (this.currentMode === "multiball") {
        this.currentMode = null;
        this.message = "The Wyrm returns below";
        this.publish(true);
      }
    });
  }

  private startWizard() {
    this.currentMode = "wizard";
    this.modeProgress = 0;
    this.message = "DOMINION ASCENDANT";
    this.spawnBall(420, 540, true);
    this.spawnBall(480, 540, true);
    this.time.delayedCall(35_000, () => {
      if (this.currentMode === "wizard") {
        this.currentMode = null;
        this.message = "A new age begins";
        this.addScore(1_000_000);
        this.publish(true);
      }
    });
  }

  private handleDrain(ball: Phaser.Physics.Matter.Image) {
    if (!ball.active) return;
    this.activeBalls.delete(ball);
    ball.destroy();
    if (this.activeBalls.size > 0) {
      if (this.activeBalls.size === 1 && this.currentMode === "multiball") {
        this.currentMode = null;
        this.message = "Multiball complete";
      }
      return;
    }
    const saveWindow = ballSaveDuration(this.strategy);
    if (this.time.now - this.ballStartedAt <= saveWindow) {
      this.message = "BALL SAVED";
      this.time.delayedCall(650, () => this.spawnBall());
      this.publish(true);
      return;
    }
    this.balls -= 1;
    this.combo = 0;
    this.tableMultiplier = 1;
    this.tilt = 0;
    if (this.balls > 0) {
      this.message = `BALL ${4 - this.balls} READY`;
      this.time.delayedCall(900, () => this.spawnBall());
    } else {
      this.phase = "gameover";
      this.message = "THE SANDS REMEMBER";
    }
    this.publish(true);
  }

  private addScore(value: number) {
    this.score += Math.round(value);
  }

  private flash(x: number, y: number, color: number, scale = 1) {
    if (this.settings.reducedMotion) return;
    const ring = this.add.circle(x, y, 24, color, 0.35).setDepth(15);
    this.tweens.add({ targets: ring, radius: 80 * scale, alpha: 0, duration: 360, onComplete: () => ring.destroy() });
    if (this.settings.haptics && typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(12);
  }

  private ensureAudio() {
    if (!this.settings.audio || this.audio) return;
    const AudioCtor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioCtor) this.audio = new AudioCtor();
  }

  private sfx(frequency: number, duration: number, type: OscillatorType) {
    if (!this.settings.audio) return;
    this.ensureAudio();
    if (!this.audio) return;
    const osc = this.audio.createOscillator();
    const gain = this.audio.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, this.audio.currentTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(45, frequency * 0.55), this.audio.currentTime + duration);
    gain.gain.setValueAtTime(0.035, this.audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.audio.currentTime + duration);
    osc.connect(gain).connect(this.audio.destination);
    osc.start();
    osc.stop(this.audio.currentTime + duration);
  }

  private publish(force = false) {
    const saveWindow = ballSaveDuration(this.strategy);
    const elapsed = this.ballStartedAt ? this.time.now - this.ballStartedAt : saveWindow;
    const state: GameSnapshot = {
      phase: this.phase,
      score: this.score,
      balls: this.balls,
      strategy: this.strategy,
      currentMode: this.currentMode,
      modeProgress: this.modeProgress,
      modesComplete: [...this.modesComplete],
      multiplier: this.tableMultiplier,
      prescienceShot: SHOT_ORDER[this.prescienceIndex],
      combo: this.combo,
      message: this.message,
      tilt: this.tilt,
      ballSave: Math.max(0, Math.ceil((saveWindow - elapsed) / 1000)),
    };
    const serialized = JSON.stringify(state);
    if (force || serialized !== this.lastPublished) {
      this.lastPublished = serialized;
      this.onSnapshot(state);
    }
  }

  update(_time: number, delta: number) {
    if (this.phase !== "playing") return;
    const keyboardLeft = Boolean(this.keys?.left.isDown || this.keys?.a.isDown);
    const keyboardRight = Boolean(this.keys?.right.isDown || this.keys?.d.isDown);
    const left = this.leftPressed || keyboardLeft;
    const right = this.rightPressed || keyboardRight;
    const step = Math.min(1, delta / 65);
    const leftTarget = left && this.tilt < 100 ? -0.95 : -0.28;
    const rightTarget = right && this.tilt < 100 ? Math.PI + 0.95 : Math.PI + 0.28;
    this.leftAngle = Phaser.Math.Linear(this.leftAngle, leftTarget, step);
    this.rightAngle = Phaser.Math.Linear(this.rightAngle, rightTarget, step);
    const matterRuntime = Phaser.Physics.Matter as unknown as { Matter: { Body: { setAngle: (body: MatterBody, angle: number) => void } } };
    if (this.leftBody) matterRuntime.Matter.Body.setAngle(this.leftBody, this.leftAngle);
    if (this.rightBody) matterRuntime.Matter.Body.setAngle(this.rightBody, this.rightAngle);
    this.drawFlippers();

    if (this.keys && Phaser.Input.Keyboard.JustDown(this.keys.space)) this.launch();
    if (this.keys && (Phaser.Input.Keyboard.JustDown(this.keys.p) || Phaser.Input.Keyboard.JustDown(this.keys.esc))) this.togglePause();
    if (this.keys && Phaser.Input.Keyboard.JustDown(this.keys.z)) this.nudge(-1, -0.2);
    if (this.keys && Phaser.Input.Keyboard.JustDown(this.keys.x)) this.nudge(1, -0.2);

    for (const ball of this.activeBalls) {
      if (!ball.active || !ball.getData("launched")) continue;
      const velocity = (ball.body as MatterBody).velocity;
      const speed = Math.hypot(velocity.x, velocity.y);
      if (speed > 38) ball.setVelocity((velocity.x / speed) * 38, (velocity.y / speed) * 38);
      if (ball.y > H + 80 || ball.x < -60 || ball.x > W + 60) this.handleDrain(ball);
    }
    if (this.combo && this.time.now > this.comboExpires) this.combo = 0;
    this.tilt = Math.max(0, this.tilt - delta * 0.006);
    this.drawShotGlow();
    this.publish();
  }

  private drawShotGlow() {
    if (!this.glowGraphics) return;
    const positions: Record<ShotId, [number, number]> = {
      caravan: [116, 704], harvest: [282, 583], citadel: [450, 465], dune: [618, 583], storm: [784, 704],
    };
    this.glowGraphics.clear();
    const [x, y] = positions[SHOT_ORDER[this.prescienceIndex]];
    const pulse = this.settings.reducedMotion ? 0.65 : 0.45 + Math.sin(this.time.now / 160) * 0.22;
    this.glowGraphics.lineStyle(8, 0xf8d79a, pulse).strokeCircle(x, y, 38);
  }

  shutdown() {
    this.matter.world.off("collisionstart", this.onCollision, this);
    this.audio?.close();
  }
}
