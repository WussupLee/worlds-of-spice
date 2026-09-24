"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PinballEngine } from "./game/engine";
import { TableRenderer } from "./game/renderer";
import { CabinetAudio } from "./game/audio";
import {
  DEFAULT_SETTINGS,
  MODE_LABELS,
  type GameSettings,
  type GameSnapshot,
  type HighScoreEntry,
} from "./game/types";
import { parseScores, parseSettings, saveLocal } from "./game/storage";

const SETTINGS_KEY = "worlds-of-spice:settings:v3",
  SCORES_KEY = "worlds-of-spice:scores:v1";
const INITIAL = new PinballEngine().snapshot();
const format = (n: number) => Math.round(n).toLocaleString("en-US");

export default function PinballClient() {
  const canvas = useRef<HTMLCanvasElement>(null),
    engine = useRef<PinballEngine | null>(null),
    audio = useRef<CabinetAudio | null>(null);
  const settingsRef = useRef(DEFAULT_SETTINGS),
    recorded = useRef(false),
    modal = useRef<HTMLDialogElement>(null),
    resumeOnClose = useRef(false);
  const [state, setState] = useState<GameSnapshot>(INITIAL),
    [settings, setSettings] = useState(DEFAULT_SETTINGS),
    [scores, setScores] = useState<HighScoreEntry[]>([]);
  const [dialog, setDialog] = useState<
      "help" | "settings" | "scores" | "credits" | null
    >(null),
    [error, setError] = useState(""),
    [tableReady, setTableReady] = useState(false);
  const pointerSides = useRef(new Map<number, "left" | "right">()),
    keys = useRef(new Set<string>()),
    pulling = useRef(false);
  const swipe = useRef<{ x: number; y: number } | null>(null);

  const publish = useCallback(() => {
    if (engine.current) setState(engine.current.snapshot());
  }, []);
  const syncFlippers = useCallback(() => {
    const values = [...pointerSides.current.values()];
    engine.current?.setFlipper(
      "left",
      values.includes("left") ||
        keys.current.has("ArrowLeft") ||
        keys.current.has("KeyA") ||
        keys.current.has("ButtonLeft"),
    );
    engine.current?.setFlipper(
      "right",
      values.includes("right") ||
        keys.current.has("ArrowRight") ||
        keys.current.has("KeyD") ||
        keys.current.has("ButtonRight"),
    );
  }, []);
  const clearInputs = useCallback(() => {
    pointerSides.current.clear();
    keys.current.clear();
    pulling.current = false;
    engine.current?.releaseControls();
  }, []);
  const pause = useCallback(
    (explicit?: boolean) => {
      engine.current?.pause(explicit);
      clearInputs();
      audio.current?.active(engine.current?.phase === "playing");
      publish();
    },
    [clearInputs, publish],
  );
  const change = useCallback((patch: Partial<GameSettings>) => {
    const next = { ...settingsRef.current, ...patch };
    settingsRef.current = next;
    setSettings(next);
    audio.current?.apply(next);
    audio.current?.unlock();
    saveLocal(SETTINGS_KEY, next);
  }, []);

  useEffect(() => {
    let restored = { ...DEFAULT_SETTINGS },
      history: HighScoreEntry[] = [];
    try {
      restored = parseSettings(localStorage.getItem(SETTINGS_KEY));
      if (!localStorage.getItem(SETTINGS_KEY)) {
        const previous = localStorage.getItem("worlds-of-spice:settings:v2");
        if (previous) {
          const prefs = parseSettings(previous);
          restored = {
            ...restored,
            muted: prefs.muted,
            haptics: prefs.haptics,
            reducedMotion: prefs.reducedMotion,
            ballTrail: prefs.ballTrail,
          };
        }
      }
      history = parseScores(localStorage.getItem(SCORES_KEY));
      if (!localStorage.getItem(SETTINGS_KEY))
        restored.reducedMotion = matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
    } catch {
      /* Defaults work when storage is unavailable. */
    }
    settingsRef.current = restored;
    queueMicrotask(() => {
      setSettings(restored);
      setScores(history);
    });
    engine.current = new PinballEngine();
    audio.current = new CabinetAudio(restored);
    let renderer: TableRenderer;
    try {
      renderer = new TableRenderer(canvas.current!);
    } catch {
      queueMicrotask(() =>
        setError(
          "This browser could not start the table. Please try a current Safari, Chrome, or Firefox.",
        ),
      );
      return;
    }
    const resize = new ResizeObserver(() => renderer.resize());
    const surface = canvas.current!;
    const lost = (event: Event) => {
      event.preventDefault();
      pause(true);
      setError(
        "Graphics interrupted. Reload to restore the cabinet; your best scores are saved.",
      );
    };
    surface.addEventListener("webglcontextlost", lost);
    resize.observe(surface);
    renderer.resize();
    queueMicrotask(() => setTableReady(true));
    let frame = 0,
      last = performance.now(),
      lastUI = 0,
      lastPhase = "ready";
    const loop = (now: number) => {
      const e = engine.current!;
      e.advance((now - last) / 1000);
      last = now;
      renderer.draw(e, settingsRef.current, now / 1000);
      for (const ev of e.events.splice(0)) audio.current?.play(ev);
      const rolling = e.balls.filter(
        (b) => !b.waiting && b.path?.kind !== "scoop",
      );
      audio.current?.rolling(
        Math.max(
          0,
          ...rolling.map((b) => (b.path ? 750 : Math.hypot(b.vx, b.vy))),
        ),
        rolling[0]?.x ?? 300,
        rolling.some((b) => b.path?.kind === "ramp"),
      );
      if (now - lastUI > 75 || e.phase !== lastPhase) {
        lastUI = now;
        lastPhase = e.phase;
        setState(e.snapshot());
        if (canvas.current) {
          canvas.current.dataset.phase = e.phase;
          canvas.current.dataset.left = String(e.left.pressed);
          canvas.current.dataset.right = String(e.right.pressed);
        }
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    const hidden = () => {
      if (document.hidden) {
        if (engine.current?.phase === "playing") pause(true);
        else audio.current?.active(false);
      }
    };
    const blur = () => {
      clearInputs();
      if (engine.current?.phase === "playing") pause(true);
      else audio.current?.active(false);
    };
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("blur", blur);
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production")
      void navigator.serviceWorker.register("./sw.js").catch(() => undefined);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      surface.removeEventListener("webglcontextlost", lost);
      renderer.destroy();
      audio.current?.destroy();
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("blur", blur);
    };
  }, [pause, clearInputs]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (
        modal.current?.open ||
        /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement)?.tagName)
      )
        return;
      if (
        [
          "ArrowLeft",
          "ArrowRight",
          "KeyA",
          "KeyD",
          "Space",
          "KeyZ",
          "KeyX",
          "KeyP",
          "Escape",
        ].includes(e.code)
      )
        e.preventDefault();
      if (e.repeat) return;
      if (e.code === "KeyP" || e.code === "Escape") {
        pause();
        return;
      }
      audio.current?.unlock();
      keys.current.add(e.code);
      syncFlippers();
      if (e.code === "Space") {
        engine.current?.pull();
        pulling.current = true;
      }
      if (e.code === "KeyZ") engine.current?.nudge(-1);
      if (e.code === "KeyX") engine.current?.nudge(1);
    };
    const up = (e: KeyboardEvent) => {
      keys.current.delete(e.code);
      syncFlippers();
      if (e.code === "Space" && pulling.current) {
        engine.current?.launch();
        pulling.current = false;
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [pause, syncFlippers]);

  useEffect(() => {
    if (state.phase !== "gameover" || recorded.current) return;
    recorded.current = true;
    audio.current?.active(false);
    queueMicrotask(() =>
      setScores((previous) => {
        const next = [
          ...previous,
          { score: state.score, date: new Date().toISOString() },
        ]
          .sort((a, b) => b.score - a.score)
          .slice(0, 5);
        saveLocal(SCORES_KEY, next);
        return next;
      }),
    );
  }, [state.phase, state.score]);

  useEffect(() => {
    if (state.phase !== "playing" || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | undefined,
      cancelled = false;
    void navigator.wakeLock
      .request("screen")
      .then((value) => {
        if (cancelled) void value.release();
        else lock = value;
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      void lock?.release().catch(() => undefined);
    };
  }, [state.phase]);

  const start = () => {
    clearInputs();
    engine.current = new PinballEngine();
    engine.current.start();
    recorded.current = false;
    audio.current?.active(true);
    audio.current?.unlock();
    publish();
  };
  const openDialog = (kind: NonNullable<typeof dialog>) => {
    resumeOnClose.current = engine.current?.phase === "playing";
    if (resumeOnClose.current) pause(true);
    setDialog(kind);
    modal.current?.showModal();
  };
  const closeDialog = () => {
    audio.current?.active(false);
    modal.current?.close();
    setDialog(null);
    if (resumeOnClose.current) {
      resumeOnClose.current = false;
      pause(false);
    }
  };
  const flipperDown = (
    e: React.PointerEvent<HTMLButtonElement>,
    side: "left" | "right",
  ) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    audio.current?.unlock();
    pointerSides.current.set(e.pointerId, side);
    syncFlippers();
  };
  const flipperUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    pointerSides.current.delete(e.pointerId);
    syncFlippers();
  };
  const pull = () => {
    audio.current?.unlock();
    engine.current?.pull();
    pulling.current = true;
  };
  const launch = () => {
    if (pulling.current) engine.current?.launch();
    pulling.current = false;
    publish();
  };
  const active = state.phase !== "ready",
    modeName =
      state.currentMode === "multiball"
        ? "Wyrm awakening"
        : state.currentMode === "wizard"
          ? "Dominion ascendant"
          : state.currentMode
            ? MODE_LABELS[state.currentMode]
            : "Explore the sands";

  return (
    <main className="game-page">
      <header className="masthead">
        <a className="wordmark" href="./" aria-label="Worlds of Spice home">
          <span className="brand-sigil" aria-hidden="true">
            ◌
          </span>
          <span>
            WORLDS OF SPICE<small>DESERT PINBALL</small>
          </span>
        </a>
        <div className="top-actions">
          <button
            className="quiet-button"
            onClick={() => openDialog("help")}
            aria-label="How to play"
          >
            ?
          </button>
          <button
            className="quiet-button sound-button"
            onClick={() => change({ muted: !settings.muted })}
            aria-label={settings.muted ? "Unmute audio" : "Mute audio"}
            aria-pressed={settings.muted}
          >
            {settings.muted ? "OFF" : "ON"}
          </button>
          <button
            className="quiet-button"
            onClick={() => openDialog("settings")}
            aria-label="Audio and display settings"
          >
            ☷
          </button>
          {active && (
            <button
              className="quiet-button"
              onClick={() => pause()}
              aria-label={
                state.phase === "paused" ? "Resume game" : "Pause game"
              }
            >
              {state.phase === "paused" ? "▷" : "Ⅱ"}
            </button>
          )}
        </div>
      </header>
      <section className="arcade">
        <div className="cabinet">
          <div className="score-display">
            <div className="score-main">
              <span>PLAYER 01</span>
              <strong data-testid="score">
                <DotScore value={state.score} />
              </strong>
            </div>
            <div className="ball-display">
              <span>BALL</span>
              <b>
                {active ? Math.min(3, 4 - state.balls) : 1}
                <em>/ 3</em>
              </b>
            </div>
            <div className="multiplier-display">
              <span>MULTI</span>
              <b>
                {state.multiplier}
                <em>×</em>
              </b>
            </div>
          </div>
          <div className="table-frame" data-playing={state.phase === "playing"}>
            <canvas
              ref={canvas}
              className="pinball-canvas"
              width="600"
              height="1000"
              aria-label="Desert pinball playfield. Use left and right flipper controls, hold and release Launch, and Z or X to nudge."
              role="img"
              onPointerDown={(e) => {
                swipe.current = { x: e.clientX, y: e.clientY };
              }}
              onPointerUp={(e) => {
                if (swipe.current) {
                  const dx = e.clientX - swipe.current.x,
                    dy = e.clientY - swipe.current.y;
                  if (Math.hypot(dx, dy) > 35) {
                    engine.current?.nudge(dx < 0 ? -1 : 1);
                    audio.current?.unlock();
                  }
                }
                swipe.current = null;
              }}
              onPointerCancel={() => {
                swipe.current = null;
              }}
            />
            {state.phase === "ready" && (
              <div className="welcome">
                <p className="eyebrow">ONE TABLE · THREE BALLS</p>
                <h2>
                  DESERT
                  <br />
                  POWER
                </h2>
                <button
                  className="start-button"
                  onClick={start}
                  disabled={!tableReady}
                >
                  {tableReady ? "PLAY PINBALL" : "PREPARING TABLE"}{" "}
                  <span>↗</span>
                </button>
                <p>Touch the flippers. Feel the flow.</p>
              </div>
            )}
            {state.phase === "paused" && (
              <div className="state-overlay">
                <p className="eyebrow">CABINET PAUSED</p>
                <h2>PAUSED</h2>
                <button className="start-button" onClick={() => pause(false)}>
                  RETURN TO PLAY <span>▷</span>
                </button>
                <button
                  className="text-button"
                  onClick={() => openDialog("settings")}
                >
                  AUDIO & DISPLAY
                </button>
              </div>
            )}
            {state.phase === "gameover" && (
              <div className="state-overlay">
                <p className="eyebrow">GAME OVER</p>
                <h2>{format(state.score)}</h2>
                <p>
                  {state.modesComplete.length} territories ·{" "}
                  {state.peakMultiplier}× peak prescience
                </p>
                <button className="start-button" onClick={start}>
                  ANOTHER ODYSSEY <span>↗</span>
                </button>
                <button
                  className="text-button"
                  onClick={() => openDialog("scores")}
                >
                  PERSONAL BESTS
                </button>
              </div>
            )}
            {error && (
              <div className="state-overlay" role="alert">
                <p>{error}</p>
                <button
                  className="start-button"
                  onClick={() => location.reload()}
                >
                  RELOAD TABLE
                </button>
              </div>
            )}
          </div>
          <div
            className="mission-strip"
            aria-live="polite"
            aria-atomic="true"
            title={modeName}
          >
            <span
              className={state.ballSave ? "status-dot saved" : "status-dot"}
            />
            <div>
              <strong>
                {state.ramp
                  ? `↑ ${state.ramp === "harvest" ? "HARVEST" : "HIGH DUNE"} · UPPER WIREFORM`
                  : state.ballSave
                    ? `BALL SAVE · ${state.ballSave}s`
                    : state.combo > 1
                      ? `${state.combo}× FLOW · ${state.message}`
                      : state.message}
              </strong>
              <span>{state.instruction}</span>
            </div>
            {state.modeSeconds > 0 && (
              <b>
                {state.modeSeconds}
                <small>s</small>
              </b>
            )}
          </div>
          <div
            className="flow-meter"
            aria-label={`${state.combo} times flow, ${Math.ceil(state.comboSeconds)} seconds remaining`}
          >
            <span style={{ transform: `scaleX(${state.comboSeconds / 4})` }} />
          </div>
          <div className="control-deck">
            <button
              className="flipper-control"
              aria-label="Left flipper"
              onPointerDown={(e) => flipperDown(e, "left")}
              onPointerUp={flipperUp}
              onPointerCancel={flipperUp}
              onLostPointerCapture={flipperUp}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  keys.current.add("ButtonLeft");
                  audio.current?.unlock();
                  syncFlippers();
                }
              }}
              onKeyUp={(e) => {
                if (e.key === "Enter") {
                  keys.current.delete("ButtonLeft");
                  syncFlippers();
                }
              }}
              onBlur={() => {
                keys.current.delete("ButtonLeft");
                syncFlippers();
              }}
            >
              <b>↖</b>
              <span>
                LEFT<small>A / ←</small>
              </span>
            </button>
            <button
              className={`launch-button ${state.waiting ? "ready" : ""}`}
              aria-label="Hold and release to launch"
              disabled={!state.waiting || state.phase !== "playing"}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                pull();
              }}
              onPointerUp={launch}
              onPointerCancel={() => {
                pulling.current = false;
                engine.current?.releaseControls();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  pull();
                }
              }}
              onKeyUp={(e) => {
                if (e.key === "Enter") launch();
              }}
            >
              <span style={{ transform: `scaleX(${state.charge})` }} />
              <b>
                {state.charge > 0
                  ? `${Math.round(state.charge * 100)}%`
                  : "LAUNCH"}
              </b>
              <small>HOLD · RELEASE</small>
            </button>
            <button
              className="flipper-control right"
              aria-label="Right flipper"
              onPointerDown={(e) => flipperDown(e, "right")}
              onPointerUp={flipperUp}
              onPointerCancel={flipperUp}
              onLostPointerCapture={flipperUp}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  keys.current.add("ButtonRight");
                  audio.current?.unlock();
                  syncFlippers();
                }
              }}
              onKeyUp={(e) => {
                if (e.key === "Enter") {
                  keys.current.delete("ButtonRight");
                  syncFlippers();
                }
              }}
              onBlur={() => {
                keys.current.delete("ButtonRight");
                syncFlippers();
              }}
            >
              <span>
                RIGHT<small>D / →</small>
              </span>
              <b>↗</b>
            </button>
          </div>
        </div>
      </section>
      <footer className="colophon">
        <button onClick={() => openDialog("scores")}>
          BEST {format(scores[0]?.score ?? 0)}
        </button>
        <span>FLIP A / D · LAUNCH SPACE · NUDGE Z / X</span>
        <button onClick={() => openDialog("credits")}>CREDITS</button>
      </footer>
      <dialog
        ref={modal}
        onCancel={(e) => {
          e.preventDefault();
          closeDialog();
        }}
        className="game-dialog"
      >
        <button
          className="dialog-close"
          onClick={closeDialog}
          aria-label="Close dialog"
        >
          ×
        </button>
        {dialog === "help" && (
          <>
            <p className="eyebrow">THE FIELD GUIDE</p>
            <h2>TABLE GUIDE</h2>
            <div className="manual-controls">
              <span>
                <kbd>A</kbd>
                <kbd>←</kbd> Left flipper
              </span>
              <span>
                <kbd>D</kbd>
                <kbd>→</kbd> Right flipper
              </span>
              <span>
                <kbd>SPACE</kbd> Hold to launch
              </span>
              <span>
                <kbd>Z</kbd>
                <kbd>X</kbd> Nudge
              </span>
            </div>
            <ol className="manual">
              <li>
                <b>Time the rising flipper.</b> Press as the ball reaches the
                bat. Early and late contact produce different shot angles. Hold
                to cradle; release to let it roll toward the tip.
              </li>
              <li>
                <b>Connect the ramps.</b> The raised Harvest and High Dune ramps
                feed the return lanes. Chain a second shot within four seconds
                to build up to 5× Flow.
              </li>
              <li>
                <b>Read the illuminated arrow.</b> That shot raises Prescience
                to 5×. Before launch, the flippers move the arrow. Select
                Caravan and release Launch between 60–80% power for the
                25,000-point skill shot.
              </li>
              <li>
                <b>Claim four territories.</b> Every four major shots starts a
                45-second mission. The blue inserts mark its targets; hit four
                to complete it.
              </li>
              <li>
                <b>Build a spice cache.</b> Hit all three numbered drop targets
                for 10,000 points and a five-second ball-save shield, available
                once per ball.
              </li>
              <li>
                <b>Awaken the Wyrm.</b> Three Citadel locks during open play
                release multiball. Complete the territories and multiball, then
                return to the Citadel for Dominion Ascendant.
              </li>
            </ol>
            <p className="dialog-note">
              On a phone, hold the two large flipper buttons independently.
              Swipe the table to nudge. Three quick nudges tilt the ball.
              Leaving the app pauses the game.
            </p>
            <button className="start-button" onClick={closeDialog}>
              BACK TO THE TABLE
            </button>
          </>
        )}
        {dialog === "settings" && (
          <>
            <p className="eyebrow">TUNE YOUR CABINET</p>
            <h2>SOUND & FEEL</h2>
            <p className="dialog-note">
              A restrained mix for headphones or your phone speaker. Changes
              apply immediately.
            </p>
            {(
              [
                ["effectsVolume", "Pinball mechanisms"],
                ["musicVolume", "Desert score"],
                ["ambienceVolume", "Wind & shifting sand"],
              ] as const
            ).map(([key, label]) => (
              <label className="volume-row" key={key}>
                <span>
                  {label}
                  <output>{Math.round(settings[key] * 100)}%</output>
                </span>
                <input
                  type="range"
                  aria-label={label}
                  min="0"
                  max="100"
                  value={Math.round(settings[key] * 100)}
                  onChange={(e) =>
                    change({ [key]: Number(e.target.value) / 100 })
                  }
                />
              </label>
            ))}
            <button
              className="preview-audio"
              onClick={() => audio.current?.preview()}
            >
              TEST SOUND · FLIP / IMPACT / SCORE
            </button>
            <p className="music-credit">
              “Shadows and Dust” by{" "}
              <a
                href="https://www.scottbuckley.com.au/library/shadows-and-dust/"
                target="_blank"
                rel="noreferrer"
              >
                Scott Buckley
              </a>{" "}
              · CC BY 4.0
            </p>
            {(
              [
                ["haptics", "Touch haptics"],
                ["ballTrail", "Ball trail"],
                ["reducedMotion", "Reduced motion"],
                ["muted", "Mute all sound"],
              ] as const
            ).map(([key, label]) => (
              <label className="toggle-row" key={key}>
                <span>{label}</span>
                <input
                  type="checkbox"
                  checked={settings[key]}
                  onChange={(e) => change({ [key]: e.target.checked })}
                />
              </label>
            ))}
            <p className="dialog-note">
              Haptics depend on device support. Audio starts with your first
              interaction and pauses when you leave the game.
            </p>
          </>
        )}
        {dialog === "scores" && (
          <>
            <p className="eyebrow">THE SANDS REMEMBER</p>
            <h2>PERSONAL BESTS</h2>
            <div className="score-list">
              {scores.length ? (
                scores.map((s, i) => (
                  <div key={`${s.date}-${i}`}>
                    <span>{String(i + 1).padStart(2, "0")}</span>
                    <b>{format(s.score)}</b>
                    <small>{new Date(s.date).toLocaleDateString()}</small>
                  </div>
                ))
              ) : (
                <p>Every odyssey begins with a first ball.</p>
              )}
            </div>
            <p className="dialog-note">
              Saved on this device. No account, no network leaderboard.
            </p>
          </>
        )}
        {dialog === "credits" && (
          <>
            <p className="eyebrow">BEHIND THE DUNES</p>
            <h2>CREDITS</h2>
            <p>
              Desert score:{" "}
              <a
                href="https://www.scottbuckley.com.au/library/shadows-and-dust/"
                target="_blank"
                rel="noreferrer"
              >
                “Shadows and Dust” by Scott Buckley
              </a>
              , released under{" "}
              <a
                href="https://creativecommons.org/licenses/by/4.0/"
                target="_blank"
                rel="noreferrer"
              >
                CC BY 4.0
              </a>
              . www.scottbuckley.com.au. Compressed to 128 kbps for mobile
              playback; no musical edits.
            </p>
            <p>
              Pinball mechanisms, rolling steel, wind and shifting sands are
              synthesized for this table. Original generated landscape art is
              inspired by retro science-fiction illustration.
            </p>
            <p className="dialog-note">
              An independent desert science-fiction homage. No affiliation with
              Dune, its creators, studios, publishers, or any pinball
              manufacturer.
            </p>
            <p>
              <a
                href="https://github.com/WussupLee/worlds-of-spice"
                target="_blank"
                rel="noreferrer"
              >
                Explore the project ↗
              </a>
            </p>
          </>
        )}
      </dialog>
    </main>
  );
}

const DIGITS = [
  "11111100011000110001100011000111111",
  "00100011000010000100001000010001110",
  "11111000010000111111100001000011111",
  "11111000010000101111000010000111111",
  "10001100011000111111000010000100001",
  "11111100001000011111000010000111111",
  "11111100001000011111100011000111111",
  "11111000010001000100010000100001000",
  "11111100011000111111100011000111111",
  "11111100011000111111000010000111111",
];
function DotScore({ value }: { value: number }) {
  const digits = String(Math.round(value)).padStart(7, "0");
  return (
    <>
      <span className="sr-only">{format(value).padStart(7, "0")}</span>
      <svg
        className="dot-score"
        viewBox={`0 0 ${digits.length * 6} 7`}
        aria-hidden="true"
      >
        {[...digits].flatMap((digit, i) =>
          [...DIGITS[Number(digit)]].map((lit, j) => (
            <circle
              key={`${i}-${j}`}
              cx={i * 6 + (j % 5) + 0.5}
              cy={Math.floor(j / 5) + 0.5}
              r=".34"
              fill={lit === "1" ? "#ffc16c" : "#392616"}
            />
          )),
        )}
      </svg>
    </>
  );
}
