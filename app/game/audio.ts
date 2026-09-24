import type { Cue, GameEvent } from "./engine";
import type { GameSettings } from "./types";

/** One audio graph, unlocked by a gesture; mixer changes never restart physics. */
export class CabinetAudio {
  private context?: AudioContext;
  private fx?: GainNode;
  private musicGain?: GainNode;
  private airGain?: GainNode;
  private rollGain?: GainNode;
  private rollFilter?: BiquadFilterNode;
  private rollPan?: StereoPannerNode;
  private music?: HTMLAudioElement;
  private noise?: AudioBuffer;
  private sources: Array<AudioScheduledSourceNode> = [];
  private voices = 0;
  private enabled = false;
  private disposed = false;
  private lastCue = new Map<Cue, number>();
  constructor(private settings: GameSettings) {}
  unlock() {
    if (this.disposed) return;
    try {
      if (!this.context) this.create();
      if (this.enabled) {
        void this.context?.resume().catch(() => undefined);
        if (this.music && this.settings.musicVolume > 0 && !this.settings.muted)
          void this.music.play().catch(() => undefined);
      } else void this.context?.suspend().catch(() => undefined);
    } catch {
      /* A silent game remains playable if audio hardware is unavailable. */
    }
  }
  private create() {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return;
    const c = (this.context = new Ctor());
    const compressor = c.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 14;
    compressor.ratio.value = 5;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.15;
    compressor.connect(c.destination);
    this.fx = c.createGain();
    this.fx.connect(compressor);
    this.musicGain = c.createGain();
    this.musicGain.connect(compressor);
    this.airGain = c.createGain();
    this.airGain.connect(compressor);
    this.noise = c.createBuffer(1, c.sampleRate * 3, c.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.music = new Audio("./audio/desert-theme.mp3");
    this.music.loop = true;
    this.music.preload = "auto";
    c.createMediaElementSource(this.music).connect(this.musicGain);
    // Two independent filtered layers: low wind and the dry hiss of moving grains.
    for (const [hz, level, rate] of [
      [230, 0.1, 0.065],
      [1800, 0.016, 0.11],
    ]) {
      const source = c.createBufferSource(),
        filter = c.createBiquadFilter(),
        gain = c.createGain(),
        lfo = c.createOscillator(),
        depth = c.createGain();
      source.buffer = this.noise;
      source.loop = true;
      source.playbackRate.value = rate === 0.065 ? 0.71 : 1;
      filter.type = "lowpass";
      filter.frequency.value = hz;
      filter.Q.value = 0.5;
      gain.gain.value = level;
      source.connect(filter).connect(gain).connect(this.airGain);
      lfo.frequency.value = rate;
      depth.gain.value = level * 0.4;
      lfo.connect(depth).connect(gain.gain);
      source.start();
      lfo.start();
      this.sources.push(source, lfo);
    }
    const roll = c.createBufferSource();
    roll.buffer = this.noise;
    roll.loop = true;
    this.rollFilter = c.createBiquadFilter();
    this.rollFilter.type = "lowpass";
    this.rollFilter.frequency.value = 300;
    this.rollGain = c.createGain();
    this.rollGain.gain.value = 0;
    this.rollPan = c.createStereoPanner();
    roll
      .connect(this.rollFilter)
      .connect(this.rollGain)
      .connect(this.rollPan)
      .connect(this.fx);
    roll.start();
    this.sources.push(roll);
    this.apply(this.settings);
  }
  apply(settings: GameSettings) {
    this.settings = settings;
    if (!this.context) return;
    const t = this.context.currentTime,
      mute = settings.muted ? 0 : 1;
    this.fx?.gain.setTargetAtTime(
      settings.effectsVolume * 0.48 * mute,
      t,
      0.035,
    );
    this.musicGain?.gain.setTargetAtTime(
      settings.musicVolume * 0.55 * mute,
      t,
      0.3,
    );
    this.airGain?.gain.setTargetAtTime(settings.ambienceVolume * mute, t, 0.4);
    if (this.music && (settings.musicVolume === 0 || settings.muted))
      this.music.pause();
    else if (this.enabled && this.music)
      void this.music.play().catch(() => undefined);
  }
  active(active: boolean) {
    this.enabled = active;
    if (active) this.unlock();
    else {
      this.music?.pause();
      void this.context?.suspend().catch(() => undefined);
    }
  }
  rolling(speed: number, x: number) {
    if (!this.context || !this.rollGain) return;
    const t = this.context.currentTime;
    this.rollGain.gain.setTargetAtTime(Math.min(0.095, speed / 10000), t, 0.09);
    this.rollFilter?.frequency.setTargetAtTime(
      140 + Math.min(1000, speed),
      t,
      0.1,
    );
    this.rollPan?.pan.setTargetAtTime((x - 300) / 450, t, 0.1);
  }
  play(event: GameEvent) {
    if (
      !this.context ||
      !this.fx ||
      !this.enabled ||
      this.settings.muted ||
      this.settings.effectsVolume === 0
    )
      return;
    const { cue, x, strength } = event,
      t = this.context.currentTime;
    const interval = cue === "rail" ? 0.04 : cue === "bumper" ? 0.035 : 0.025;
    if (t - (this.lastCue.get(cue) ?? -1) < interval || this.voices > 14)
      return;
    this.lastCue.set(cue, t);
    const pan = (x - 300) / 430,
      s = Math.min(1, Math.max(0.1, strength));
    const tone = (
      f: number,
      d: number,
      v: number,
      w: OscillatorType = "sine",
      end = f * 0.5,
      delay = 0,
    ) => this.tone(f, d, v * s, w, end, pan, delay);
    const tick = (f: number, d: number, v: number) =>
      this.tick(f, d, v * s, pan);
    switch (cue) {
      case "flipper":
        tone(135, 0.048, 0.21, "triangle", 58);
        tick(1100, 0.024, 0.13);
        break;
      case "release":
        tick(650, 0.028, 0.1);
        break;
      case "rail":
        tick(1700, 0.036, 0.2);
        tone(780, 0.024, 0.035, "sine", 390);
        break;
      case "launch":
        tone(150, 0.18, 0.24, "triangle", 42);
        tick(650, 0.13, 0.18);
        break;
      case "bumper":
        tone(300 + x * 0.3, 0.12, 0.17, "sine", 180);
        tick(1600, 0.045, 0.15);
        break;
      case "sling":
        tone(170, 0.055, 0.12, "triangle", 70);
        tick(1250, 0.055, 0.17);
        break;
      case "shot":
        tone(440, 0.23, 0.1, "sine", 420);
        tone(660, 0.28, 0.045, "sine", 640, 0.06);
        break;
      case "ramp":
        tick(2600, 0.33, 0.065);
        tone(293.66, 0.3, 0.08, "sine", 440);
        break;
      case "save":
        tone(330, 0.2, 0.08);
        tone(494, 0.3, 0.08, "sine", 440, 0.15);
        break;
      case "drain":
        tone(140, 0.32, 0.13, "triangle", 45);
        tick(420, 0.1, 0.08);
        break;
      case "mode":
        [146.83, 220, 293.66].forEach((f, i) =>
          tone(f, 0.6, 0.06, "sine", f, i * 0.13),
        );
        break;
      case "complete":
        [293.66, 440, 587.33].forEach((f, i) =>
          tone(f, 0.65, 0.085, "sine", f, i * 0.12),
        );
        break;
      case "multiball":
        tone(55, 1.4, 0.18, "triangle", 37);
        tick(160, 0.9, 0.3);
        tone(110, 1.6, 0.06, "sine", 82, 0.2);
        break;
      case "tilt":
        tone(72, 0.45, 0.15, "triangle", 55);
        tone(68, 0.45, 0.1, "triangle", 48, 0.4);
        break;
      case "nudge":
        tick(140, 0.17, 0.23);
        break;
      case "ui":
        tone(390, 0.06, 0.055, "sine", 310);
        break;
    }
    if (
      this.settings.haptics &&
      ["bumper", "sling", "multiball"].includes(cue) &&
      "vibrate" in navigator
    )
      navigator.vibrate(cue === "multiball" ? 30 : 7);
  }
  private tone(
    f: number,
    d: number,
    v: number,
    type: OscillatorType,
    end: number,
    pan: number,
    delay: number,
  ) {
    const c = this.context!,
      o = c.createOscillator(),
      g = c.createGain(),
      p = c.createStereoPanner(),
      t = c.currentTime + delay;
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, end), t + d);
    p.pan.value = pan;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(v, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(p).connect(this.fx!);
    o.start(t);
    o.stop(t + d + 0.01);
    this.voices++;
    o.onended = () => {
      o.disconnect();
      g.disconnect();
      p.disconnect();
      this.voices--;
    };
  }
  private tick(f: number, d: number, v: number, pan: number) {
    const c = this.context!,
      o = c.createBufferSource(),
      g = c.createGain(),
      filter = c.createBiquadFilter(),
      p = c.createStereoPanner(),
      t = c.currentTime;
    o.buffer = this.noise!;
    filter.type = "bandpass";
    filter.frequency.value = f;
    filter.Q.value = 0.65;
    p.pan.value = pan;
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(filter).connect(g).connect(p).connect(this.fx!);
    o.start(t, Math.random());
    o.stop(t + d);
    this.voices++;
    o.onended = () => {
      o.disconnect();
      filter.disconnect();
      g.disconnect();
      p.disconnect();
      this.voices--;
    };
  }
  destroy() {
    this.disposed = true;
    this.enabled = false;
    this.music?.pause();
    if (this.music) {
      this.music.removeAttribute("src");
      this.music.load();
    }
    this.sources.forEach((s) => {
      try {
        s.stop();
      } catch {
        /* Already stopped. */
      }
    });
    void this.context?.close().catch(() => undefined);
  }
}
