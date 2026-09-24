"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MODE_LABELS, STRATEGY_LABELS, type GameBridge, type GameSettings, type GameSnapshot, type HighScoreEntry, type StrategyId } from "./game/types";

const DEFAULT_SETTINGS: GameSettings = { audio: true, music: true, ambience: true, haptics: true, reducedMotion: false, ballTrail: true };
const INITIAL: GameSnapshot = {
  phase: "ready", score: 0, balls: 3, strategy: "harvester", currentMode: null, modeProgress: 0,
  modesComplete: [], multiplier: 1, prescienceShot: "citadel", combo: 0, message: "Choose your path", tilt: 0, ballSave: 0,
};
const SETTINGS_KEY = "worlds-of-spice:settings:v1";
const SCORES_KEY = "worlds-of-spice:scores:v1";

function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } as T : fallback;
  } catch {
    return fallback;
  }
}

function formatScore(score: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(score).padStart(7, "0");
}

export default function PinballClient() {
  const gameHost = useRef<HTMLDivElement>(null);
  const bridge = useRef<GameBridge | null>(null);
  const swipe = useRef<{ x: number; y: number; id: number } | null>(null);
  const scoreRecorded = useRef(false);
  const gameSettings = useRef(DEFAULT_SETTINGS);
  const [snapshot, setSnapshot] = useState(INITIAL);
  const [strategy, setStrategy] = useState<StrategyId>("harvester");
  const [started, setStarted] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [scores, setScores] = useState<HighScoreEntry[]>([]);
  const [launchHeld, setLaunchHeld] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setSettings(readStored(SETTINGS_KEY, DEFAULT_SETTINGS));
      setScores(readStored(SCORES_KEY, []));
      setLoaded(true);
    });
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!started || !gameHost.current) return;
    let cancelled = false;
    scoreRecorded.current = false;
    import("./game/createGame").then(({ createWorldsOfSpiceGame }) => {
      if (cancelled || !gameHost.current) return;
      bridge.current = createWorldsOfSpiceGame(gameHost.current, strategy, gameSettings.current, setSnapshot);
    });
    return () => {
      cancelled = true;
      bridge.current?.destroy();
      bridge.current = null;
    };
  }, [started, strategy]); // Settings are locked per game to avoid recreating physics mid-ball.

  useEffect(() => {
    if (snapshot.phase !== "gameover" || scoreRecorded.current) return;
    scoreRecorded.current = true;
    setScores((previous) => {
      const next = [...previous, { score: snapshot.score, date: new Date().toISOString(), strategy }]
        .sort((a, b) => b.score - a.score).slice(0, 5);
      localStorage.setItem(SCORES_KEY, JSON.stringify(next));
      return next;
    });
  }, [snapshot.phase, snapshot.score, strategy]);

  useEffect(() => {
    if (!started || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    const request = async () => {
      try { lock = await navigator.wakeLock.request("screen"); } catch { /* optional enhancement */ }
    };
    request();
    return () => { lock?.release().catch(() => undefined); };
  }, [started]);

  const updateSetting = (key: keyof GameSettings) => {
    setSettings((previous) => {
      const next = { ...previous, [key]: !previous[key] };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      return next;
    });
  };

  const start = () => {
    gameSettings.current = settings;
    setSnapshot({ ...INITIAL, phase: "playing", strategy, message: "Hold LAUNCH, then release" });
    setStarted(true);
  };

  const restart = () => {
    bridge.current?.destroy();
    bridge.current = null;
    setStarted(false);
    setSnapshot(INITIAL);
  };

  const pressFlipper = useCallback((side: "left" | "right", active: boolean) => {
    bridge.current?.setFlipper(side, active);
    if (active && settings.haptics && "vibrate" in navigator) navigator.vibrate(8);
  }, [settings.haptics]);

  const launchDown = () => {
    setLaunchHeld(true);
    if (settings.haptics && "vibrate" in navigator) navigator.vibrate(10);
  };
  const launchUp = () => {
    if (launchHeld) bridge.current?.launch();
    setLaunchHeld(false);
  };

  const onTablePointerDown = (event: React.PointerEvent) => {
    if (event.clientY < window.innerHeight * 0.72) swipe.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
  };
  const onTablePointerUp = (event: React.PointerEvent) => {
    const start = swipe.current;
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.hypot(dx, dy) > 42) bridge.current?.nudge(Math.sign(dx) * Math.min(1, Math.abs(dx) / 90), Math.sign(dy) * Math.min(1, Math.abs(dy) / 90));
    swipe.current = null;
  };

  const activeMode = useMemo(() => {
    if (!snapshot.currentMode) return "Open play";
    if (snapshot.currentMode === "multiball") return "Wyrm Awakening";
    if (snapshot.currentMode === "wizard") return "Dominion Ascendant";
    return MODE_LABELS[snapshot.currentMode];
  }, [snapshot.currentMode]);

  if (!loaded) return <main className="loading-screen" aria-label="Loading Worlds of Spice" />;

  return (
    <main className="game-page" style={{ "--playfield-art": "url(./assets/playfield.png)" } as React.CSSProperties}>
      <header className="topbar">
        <button className="brand" onClick={() => setShowHelp(true)} aria-label="About Worlds of Spice">
          <span className="brand-mark">W/S</span>
          <span><b>WORLDS OF SPICE</b><small>DESERT PINBALL ODYSSEY</small></span>
        </button>
        <div className="scoreboard" aria-live="polite">
          <span>SCORE</span><strong>{formatScore(snapshot.score)}</strong>
        </div>
        <div className="top-actions">
          {started && <button className="icon-button" onClick={() => bridge.current?.pause()} aria-label="Pause game">Ⅱ</button>}
          <button className="icon-button" onClick={() => setShowSettings(true)} aria-label="Game settings">⚙</button>
        </div>
      </header>

      <section className="cabinet-shell">
        <aside className="side-panel left-panel" aria-label="Mission progress">
          <p className="eyebrow">DOMINION MAP</p>
          <h2>{activeMode}</h2>
          <div className="mode-grid">
            {Object.entries(MODE_LABELS).map(([id, label]) => (
              <div className={snapshot.modesComplete.includes(id as never) ? "mode-chip complete" : "mode-chip"} key={id}>
                <span>{snapshot.modesComplete.includes(id as never) ? "◆" : "◇"}</span>{label}
              </div>
            ))}
          </div>
          <div className="meter"><span style={{ width: `${snapshot.currentMode ? snapshot.modeProgress * 25 : 0}%` }} /></div>
          <p className="panel-note">Complete four territories and awaken the Wyrm to light the final battle.</p>
        </aside>

        <div className="table-column">
          <div
            className="table-viewport"
            onPointerDown={onTablePointerDown}
            onPointerUp={onTablePointerUp}
            onPointerCancel={() => { swipe.current = null; }}
          >
            <div className="playfield-art" />
            <div ref={gameHost} className="game-canvas" aria-label="Worlds of Spice pinball table" />
            {!started && (
              <div className="start-overlay">
                <p className="eyebrow">THE DESERT CHOOSES</p>
                <h1>WORLDS<br /><i>OF</i> SPICE</h1>
                <p className="intro">Claim the territories. Read the shifting sands. Awaken what sleeps below.</p>
                <div className="strategy-picker" role="radiogroup" aria-label="Choose a strategy">
                  {(["harvester", "oracle", "warden"] as StrategyId[]).map((id) => (
                    <button key={id} role="radio" aria-checked={strategy === id} className={strategy === id ? "strategy active" : "strategy"} onClick={() => setStrategy(id)}>
                      <span>{id === "harvester" ? "⌁" : id === "oracle" ? "◉" : "⬡"}</span>
                      <b>{STRATEGY_LABELS[id]}</b>
                      <small>{id === "harvester" ? "Ramp & combo bonus" : id === "oracle" ? "Prescience rises faster" : "Extended ball save"}</small>
                    </button>
                  ))}
                </div>
                <button className="primary-button" onClick={start}>ENTER THE SANDS</button>
                <button className="text-button" onClick={() => setShowHelp(true)}>HOW TO PLAY</button>
              </div>
            )}

            {started && (
              <>
                <div className="status-ribbon">
                  <span>{snapshot.message}</span>
                  <b>{snapshot.multiplier}×</b>
                </div>
                <div className="mobile-stats">
                  <span>BALL <b>{snapshot.balls}</b></span>
                  <span>FLOW <b>{snapshot.combo || "—"}</b></span>
                  <span>SAVE <b>{snapshot.ballSave || "—"}</b></span>
                </div>
                <div className="touch-controls" aria-label="Pinball controls">
                  <button
                    className="flipper-zone left-zone"
                    aria-label="Left flipper"
                    onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); pressFlipper("left", true); }}
                    onPointerUp={() => pressFlipper("left", false)}
                    onPointerCancel={() => pressFlipper("left", false)}
                  ><span>LEFT</span></button>
                  <button
                    className="launch-control"
                    aria-label="Hold and release to launch ball"
                    onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); launchDown(); }}
                    onPointerUp={launchUp}
                    onPointerCancel={() => setLaunchHeld(false)}
                  ><span className={launchHeld ? "launch-fill held" : "launch-fill"} /><b>LAUNCH</b></button>
                  <button
                    className="flipper-zone right-zone"
                    aria-label="Right flipper"
                    onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); pressFlipper("right", true); }}
                    onPointerUp={() => pressFlipper("right", false)}
                    onPointerCancel={() => pressFlipper("right", false)}
                  ><span>RIGHT</span></button>
                </div>
              </>
            )}

            {snapshot.phase === "paused" && (
              <div className="modal-overlay compact">
                <p className="eyebrow">THE SANDS ARE STILL</p><h2>PAUSED</h2>
                <button className="primary-button" onClick={() => bridge.current?.pause()}>RESUME</button>
              </div>
            )}

            {snapshot.phase === "gameover" && (
              <div className="modal-overlay compact gameover">
                <p className="eyebrow">THE SANDS REMEMBER</p><h2>{formatScore(snapshot.score)}</h2>
                <p>{snapshot.modesComplete.length} territories claimed · {snapshot.multiplier}× peak prescience</p>
                <button className="primary-button" onClick={restart}>PLAY AGAIN</button>
              </div>
            )}
          </div>
        </div>

        <aside className="side-panel right-panel" aria-label="Live table status">
          <p className="eyebrow">HOUSE TELEMETRY</p>
          <div className="stat"><span>BALL</span><b>{snapshot.balls}</b></div>
          <div className="stat"><span>PRESCIENCE</span><b>{snapshot.multiplier}×</b></div>
          <div className="stat"><span>FLOW</span><b>{snapshot.combo || "—"}</b></div>
          <div className="stat"><span>NEXT SHOT</span><b>{snapshot.prescienceShot}</b></div>
          <div className="tilt-meter"><span style={{ width: `${snapshot.tilt}%` }} /></div>
          <p className="panel-note">Swipe the upper table to nudge. Repeated nudges trigger a tilt.</p>
          {scores[0] && <div className="best-score"><span>DEVICE BEST</span><b>{formatScore(scores[0].score)}</b></div>}
        </aside>
      </section>

      <footer className="footer-note">Original fan-made desert science-fiction experience · No affiliation with any film, publisher, or pinball manufacturer</footer>

      {showHelp && (
        <div className="dialog-backdrop" role="presentation">
          <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="how-title">
            <button className="close-button" onClick={() => setShowHelp(false)} aria-label="Close">×</button>
            <p className="eyebrow">FIELD MANUAL</p><h2 id="how-title">Master the table</h2>
            <ol>
              <li><b>Launch.</b> Hold and release the center control. Before launch, tap either flipper to move the illuminated Prescience shot.</li>
              <li><b>Build flow.</b> Chain major shots within three seconds to raise the combo to 5×.</li>
              <li><b>Claim territory.</b> Every four major shots starts a timed mission. Complete all four.</li>
              <li><b>Awaken the Wyrm.</b> Strike the center Citadel three times to unlock three-ball multiball.</li>
              <li><b>Ascend.</b> Complete every mission and multiball, then strike the Citadel for the final mode.</li>
            </ol>
            <p className="key-help">Desktop: A / D or ← / → flippers · Space launch · Z / X nudge · P pause</p>
            <button className="primary-button" onClick={() => setShowHelp(false)}>UNDERSTOOD</button>
          </section>
        </div>
      )}

      {showSettings && (
        <div className="dialog-backdrop" role="presentation">
          <section className="dialog settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title">
            <button className="close-button" onClick={() => setShowSettings(false)} aria-label="Close">×</button>
            <p className="eyebrow">CABINET OPTIONS</p><h2 id="settings-title">Settings</h2>
            {Object.entries({ audio: "Mechanical sound effects", music: "Desert score", ambience: "Wind & shifting sand", haptics: "Touch haptics", reducedMotion: "Reduced motion", ballTrail: "High-visibility ball" }).map(([key, label]) => (
              <button className="setting-row" key={key} onClick={() => updateSetting(key as keyof GameSettings)}>
                <span>{label}</span><b className={settings[key as keyof GameSettings] ? "toggle on" : "toggle"}>{settings[key as keyof GameSettings] ? "ON" : "OFF"}</b>
              </button>
            ))}
            <p className="panel-note">Changes apply when the next game begins.</p>
          </section>
        </div>
      )}
    </main>
  );
}
