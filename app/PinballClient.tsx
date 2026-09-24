"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PinballEngine } from "./game/engine";
import { TableRenderer } from "./game/renderer";
import { CabinetAudio } from "./game/audio";
import {
  DEFAULT_SETTINGS,
  MODE_LABELS,
  MODE_ORDER,
  SHOT_LABELS,
  type GameSettings,
  type GameSnapshot,
  type HighScoreEntry,
} from "./game/types";
import { parseScores, parseSettings, saveLocal } from "./game/storage";

const SETTINGS_KEY = "worlds-of-spice:settings:v2",
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
    resize.observe(canvas.current!);
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
      const rolling = e.balls.filter((b) => !b.waiting && !b.path);
      audio.current?.rolling(
        Math.max(0, ...rolling.map((b) => Math.hypot(b.vx, b.vy))),
        rolling[0]?.x ?? 300,
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
      if (document.hidden && engine.current?.phase === "playing") pause(true);
    };
    const blur = () => {
      clearInputs();
      if (engine.current?.phase === "playing") pause(true);
    };
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("blur", blur);
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production")
      void navigator.serviceWorker.register("./sw.js").catch(() => undefined);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
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
          <span className="brand-sigil">◈</span>
          <span>
            WORLDS OF SPICE<small>PINBALL ODYSSEY / 01</small>
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
            {settings.muted ? "SOUND OFF" : "SOUND ON"}
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
        <aside className="story-panel">
          <p className="eyebrow">AN ODYSSEY IN STEEL & SAND</p>
          <h1>
            The sands
            <br />
            remember<span>.</span>
          </h1>
          <p className="story-copy">
            One silver sphere.
            <br />
            An empire beneath the dunes.
          </p>
          <div className="orbital-seal" aria-hidden="true">
            <span />
            <i />
          </div>
          <div className="story-caption">
            <span>23° 42′ N / THE DEEP DESERT</span>
            <p>
              Read the paths. Ride the storm.
              <br />
              Awaken what sleeps below.
            </p>
          </div>
          <button className="text-button" onClick={() => openDialog("help")}>
            EXPLORE THE TABLE <span>↗</span>
          </button>
        </aside>
        <div className="cabinet">
          <div className="score-display">
            <div className="score-main">
              <span>SCORE</span>
              <strong data-testid="score">
                {format(state.score).padStart(7, "0")}
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
              <span>PRESCIENCE</span>
              <b>
                {state.multiplier}
                <em>×</em>
              </b>
            </div>
          </div>
          <div className="table-frame">
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
                <p className="eyebrow">THREE BALLS. ONE ODYSSEY.</p>
                <h2>Enter the sands.</h2>
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
                <p className="eyebrow">THE DESERT CAN WAIT</p>
                <h2>Paused.</h2>
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
                <p className="eyebrow">THE SANDS REMEMBER</p>
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
              </div>
            )}
          </div>
          <div className="mission-strip" aria-live="polite" aria-atomic="true">
            <span
              className={state.ballSave ? "status-dot saved" : "status-dot"}
            />
            <div>
              <strong>
                {state.ballSave
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
        <aside className="journey-panel">
          <div className="journey-heading">
            <span className="eyebrow">YOUR ODYSSEY</span>
            <span>01—04</span>
          </div>
          <h2>{modeName}</h2>
          <div className="territories">
            {MODE_ORDER.map((m, i) => (
              <div
                key={m}
                className={`${state.modesComplete.includes(m) ? "complete" : ""} ${state.currentMode === m ? "current" : ""}`}
              >
                <span>
                  {state.modesComplete.includes(m)
                    ? "◆"
                    : String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <b>{MODE_LABELS[m]}</b>
                  <small>
                    {
                      [
                        "Left & right ramps",
                        "Outer orbit loops",
                        "The central scoop",
                        "Follow the lit arrow",
                      ][i]
                    }
                  </small>
                </div>
                <i>
                  {state.currentMode === m ? `${state.modeProgress}/4` : ""}
                </i>
              </div>
            ))}
          </div>
          <div className="next-shot">
            <span className="eyebrow">FOLLOW THE LIGHT</span>
            <p>{SHOT_LABELS[state.prescienceShot]}</p>
            <span>Selected shots raise your multiplier.</span>
          </div>
          <div className="wyrm-locks">
            <span>WYRM LOCKS</span>
            <div>
              {[0, 1, 2].map((i) => (
                <i className={i < state.locks ? "lit" : ""} key={i} />
              ))}
            </div>
          </div>
          <div className="tilt-indicator" title="Tilt danger">
            <span style={{ width: `${state.tilt}%` }} />
          </div>
          <button className="best-button" onClick={() => openDialog("scores")}>
            <span>PERSONAL BEST</span>
            <b>{format(scores[0]?.score ?? 0)}</b>
            <i>↗</i>
          </button>
          <p className="keyboard-hint">
            SPACE to launch · Z / X to nudge
            <br />P to pause · Or use the touch controls
          </p>
        </aside>
      </section>
      <footer className="colophon">
        <span>AN ORIGINAL DESERT SCIENCE-FI PINBALL EXPERIENCE</span>
        <button onClick={() => openDialog("credits")}>
          SOUND & ART CREDITS ↗
        </button>
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
            <h2>Find your flow.</h2>
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
                <b>Build a spice cache.</b> Hit all three numbered stand-up
                targets for 10,000 points and a five-second ball-save shield,
                available once per ball.
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
            <h2>Sound & feel.</h2>
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
            <h2>Your best journeys.</h2>
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
            <h2>Made for the journey.</h2>
            <p>
              Desert score:{" "}
              <a
                href="https://opengameart.org/content/desert-theme-0"
                target="_blank"
                rel="noreferrer"
              >
                “Desert Theme” by Tarush Singhal
              </a>
              , released under{" "}
              <a
                href="https://creativecommons.org/publicdomain/zero/1.0/"
                target="_blank"
                rel="noreferrer"
              >
                CC0
              </a>
              .
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
