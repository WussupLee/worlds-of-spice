import * as Phaser from "phaser";
import { WorldsOfSpiceScene } from "./WorldsOfSpiceScene";
import type { GameBridge, GameSettings, GameSnapshot, StrategyId } from "./types";

export function createWorldsOfSpiceGame(
  parent: HTMLElement,
  strategy: StrategyId,
  settings: GameSettings,
  onSnapshot: (snapshot: GameSnapshot) => void,
): GameBridge {
  const scene = new WorldsOfSpiceScene(strategy, settings, onSnapshot);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 900,
    height: 1600,
    transparent: true,
    backgroundColor: "rgba(0,0,0,0)",
    physics: {
      default: "matter",
      matter: { gravity: { x: 0, y: 1.05 }, enableSleeping: false, positionIterations: 12, velocityIterations: 10 },
    },
    render: { antialias: true, roundPixels: false, powerPreference: "high-performance" },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: 900, height: 1600 },
    input: { activePointers: 4 },
    scene,
  });

  return {
    launch: () => scene.launch(),
    pause: () => scene.togglePause(),
    setFlipper: (side, active) => scene.setFlipper(side, active),
    nudge: (x, y) => scene.nudge(x, y),
    destroy: () => game.destroy(true),
  };
}
