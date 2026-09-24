# Worlds of Spice

An original, mobile-first desert science-fiction pinball game built for the web. The table combines tactile movie-era pinball ideas—clear central objectives, route-based progression, timed modes, selectable shot multipliers, and escalating multiball—with a retro 1980s European graphic-novel art direction.

The project uses original names, visuals, audio synthesis, and game rules. It is not affiliated with Dune, Legendary, Warner Bros., any publisher, or any pinball manufacturer.

## Play

- Mobile: press the lower-left and lower-right regions for the flippers. Hold and release the center launch control. Swipe the upper playfield to nudge.
- Desktop: `A` / `D` or left / right arrows control the flippers; Space launches; `Z` / `X` nudge; `P` or Escape pauses.
- Tap either flipper before launching to move the illuminated Prescience shot.
- Chain major shots to build Flow, complete all four territory modes, and strike the center three times to awaken multiball.

## Development

Requires Node.js 22.13 or newer and pnpm 11.

```bash
pnpm install
pnpm dev
pnpm test
pnpm lint
pnpm build
```

`pnpm build:pages` produces the static GitHub Pages export in `dist/client`.

## Technology

- Vinext, React, and TypeScript
- Phaser 3 with Matter physics
- Layered procedural cabinet, ball, target, flipper, wind, and shifting-sand audio
- CC0 desert score with independent music, ambience, and effects controls
- Local high scores and settings
- Installable offline web app

## Research influences

The rule structure draws on the readable objectives and tactile mechanisms of Indiana Jones: The Pinball Adventure, the user-directed shot multiplier of Stern Star Wars, the journey structure of Jurassic Park, and the cinematic centerpiece mechanisms of Godzilla and Jaws. No table assets or rules were copied.

## Audio credit

“Desert Theme” by Tarush Singhal is used as the low-volume ambient score. It is dedicated to the public domain under CC0 and was downloaded from [OpenGameArt](https://opengameart.org/content/desert-theme-0). Attribution is optional under CC0, but included here with thanks. All pinball mechanisms and shifting-sand ambience are synthesized in the browser.
