// Native browser Web Audio renders the real CabinetAudio graph, all 42 cues.
// Run against `pnpm dev`; test-owned module imports are never shipped as APIs.
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on("console", (message) => {
    if (message.text().startsWith("Sound check:")) console.log(message.text());
  });
  await page.goto(process.env.PINBALL_DEV_URL || "http://localhost:3000/");
  const result = await page.evaluate(async () => {
    const { CabinetAudio } = await import("/app/game/audio.ts");
    const { CUES } = await import("/app/game/engine.ts");
    const { DEFAULT_SETTINGS } = await import("/app/game/types.ts");
    const Native = window.AudioContext;
    class MeasurementContext extends OfflineAudioContext {
      constructor() {
        super(2, 48000 * 4, 48000);
      }
      // Media is deliberately silent; everything downstream is the real graph.
      createMediaElementSource() {
        return this.createGain();
      }
      resume() {
        return Promise.resolve();
      }
      close() {
        return Promise.resolve();
      }
    }
    window.AudioContext = MeasurementContext;
    const results = [];
    try {
      for (const cue of [
        ...CUES,
        "flipper-b-variant",
        "fallback",
        "muted",
        "effects-off",
        "stress",
        "rolling-ground",
        "rolling-metal",
      ]) {
        console.log("Sound check:", cue);
        const audio = new CabinetAudio({
          ...DEFAULT_SETTINGS,
          musicVolume: 0,
          ambienceVolume: 0,
          muted: cue === "muted",
          effectsVolume:
            cue === "effects-off" ? 0 : DEFAULT_SETTINGS.effectsVolume,
        });
        audio.active(true);
        await audio.samplesReady;
        const context = audio.context;
        if (!context || audio.buffers.size !== 9)
          throw new Error(`${cue}: graph or samples failed to initialize`);
        if (cue === "fallback") audio.buffers.clear();
        if (cue === "flipper-b-variant") audio.variants.set("flipper", 1);
        if (cue === "stress") {
          const events = Array.from({ length: 18 }, (_, i) => ({
            cue: "rail",
            x: i * 30,
            strength: 1,
          }));
          events.push(
            { cue: "bumper", x: 226, strength: 1 },
            { cue: "sling", x: 450, strength: 1 },
            { cue: "super-jackpot", x: 300, strength: 1 },
          );
          audio.playEvents(events);
        } else if (cue.startsWith("rolling-"))
          audio.rolling(800, 300, cue === "rolling-metal");
        else
          audio.play({
            cue: CUES.includes(cue)
              ? cue
              : cue === "flipper-b-variant"
                ? "flipper"
                : "bumper",
            x: 300,
            strength: 1,
          });
        const voices = audio.voices,
          loaded = audio.buffers.size;
        const rendered = await context.startRendering();
        // Also measure a mono 250–5000 Hz approximation of small-speaker content.
        const band = new OfflineAudioContext(
          1,
          rendered.length,
          rendered.sampleRate,
        );
        const source = band.createBufferSource();
        source.buffer = rendered;
        const hp = band.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.value = 250;
        const lp = band.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 5000;
        source.connect(hp).connect(lp).connect(band.destination);
        source.start();
        const phone = (await band.startRendering()).getChannelData(0);
        let peak = 0,
          energy = 0,
          phoneEnergy = 0,
          tailEnergy = 0,
          finite = true;
        const pcm = rendered.getChannelData(0);
        for (let i = 0; i < pcm.length; i++) {
          finite &&= Number.isFinite(pcm[i]);
          peak = Math.max(peak, Math.abs(pcm[i]));
          energy += pcm[i] * pcm[i];
          phoneEnergy += phone[i] * phone[i];
          if (i > 48000) tailEnergy += pcm[i] * pcm[i];
        }
        results.push({
          cue,
          loaded,
          voices,
          finite,
          peak,
          rms: Math.sqrt(energy / pcm.length),
          phoneRms: Math.sqrt(phoneEnergy / pcm.length),
          tailRms: Math.sqrt(tailEnergy / (pcm.length - 48000)),
        });
        audio.destroy();
      }
    } finally {
      window.AudioContext = Native;
    }
    return results;
  });
  mkdirSync("outputs", { recursive: true });
  writeFileSync(
    "outputs/sound-catalog-measured.json",
    JSON.stringify(result, null, 2),
  );
  for (const r of result) {
    assert(r.finite, `${r.cue}: nonfinite signal`);
    assert(r.peak < 0.15, `${r.cue}: exceeds quiet-output ceiling`);
    assert(r.voices <= 24, `${r.cue}: unbounded polyphony`);
    if (["muted", "effects-off"].includes(r.cue)) assert.equal(r.peak, 0);
    else {
      assert(r.peak > 0.0001, `${r.cue}: silent effect`);
      assert(r.phoneRms > 0.00001, `${r.cue}: lacks small-speaker content`);
    }
    if (r.cue !== "fallback")
      assert.equal(r.loaded, 9, `${r.cue}: missing recording`);
  }
  const coil = result.find((r) => r.cue === "flipper");
  for (const cue of ["bumper", "sling", "drain", "scoop-eject", "launch"])
    assert(
      result.find((r) => r.cue === cue).phoneRms > coil.phoneRms,
      `${cue}: buried beneath coil`,
    );
  console.log(
    JSON.stringify(
      {
        cases: result.length,
        maxPeak: Math.max(...result.map((r) => r.peak)),
        quietest: result
          .filter((r) => r.peak > 0)
          .sort((a, b) => a.peak - b.peak)
          .slice(0, 3),
        coil,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
