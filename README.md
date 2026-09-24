# Worlds of Spice

An original, mobile-first desert science-fiction pinball game built for the web. The table combines tactile movie-era pinball ideas—clear central objectives, route-based progression, timed modes, selectable shot multipliers, and escalating multiball—with a retro 1980s European graphic-novel art direction.

The project uses original names, visuals, audio synthesis, and game rules. It is not affiliated with Dune, Legendary, Warner Bros., any publisher, or any pinball manufacturer.

## Play

- Mobile: hold the left and right flipper buttons independently. Hold and release the center launch control. Swipe the playfield to nudge.
- Desktop: `A` / `D` or left / right arrows control the flippers; Space launches; `Z` / `X` nudge; `P` or Escape pauses.
- Tap either flipper before launching to move the illuminated Prescience shot. Select Caravan and release at 60–80% power for a skill shot.
- Chain major shots to build Flow, complete all four territory modes, and strike the center three times to awaken multiball.

## Development

Requires Node.js 22.13 or newer and pnpm 11.

```bash
pnpm install
pnpm dev
pnpm test
pnpm lint
pnpm exec tsc --noEmit
pnpm build:pages
pnpm exec playwright install chromium webkit
pnpm test:browser
```

`pnpm build:pages` produces the static GitHub Pages export in `dist/client`.
`pnpm preview:pages` serves that exact artifact at `http://127.0.0.1:4173/worlds-of-spice/`.
The GitHub Actions workflow runs the checks before publishing to [the live game](https://wussuplee.github.io/worlds-of-spice/).

## Technology

- Vinext, React, and TypeScript
- A deterministic 240 Hz physics simulation, independent of React and rendering
- Heel-pivoted rotating flippers with contact-point velocity, rising-stroke impulses, held cradles, gravity, restitution, convex slingshots and ball-to-ball contacts
- A layered Canvas 2D renderer: illustrated lacquer, raised ramps, metal rails, animated bumper caps and Wyrm jaws, impact light, glass reflections and a steel ball
- Layered procedural cabinet, ball, target, flipper, wind, and shifting-sand audio
- CC0 desert score with independent music, ambience, and effects controls
- Local high scores and settings
- Installable offline web app

This is a 2.5D arcade simulation, not a full rigid-body 3D simulator. Free play uses collision physics; captured ramp, orbit and scoop travel follows constrained track splines. Those boundaries are intentional and documented rather than presented as a commercial simulator's physics engine.

## One table, one ruleset

Five major shots connect two ramps, two outside orbits and the central Citadel scoop. Ramps return to the flippers, enabling four-second Flow combinations (up to 5×). A lit Prescience arrow advances the table multiplier to 5×. Every four open-play major-shot counts starts the next unfinished 45-second territory; four indicated shots finish a territory. Three open-play Citadel locks start three-ball Wyrm multiball. Complete all four territories and multiball, then hit Citadel for the 40-second Dominion finale.

Three numbered stand-up targets award a 10,000-point spice cache and a short ball-save shield once per ball. Ordinary launches have a ten-second save; multiball starts with twelve seconds. Three rapid nudges latch tilt until the ball drains. Modes, save windows and physics share the same paused simulation clock.

## Research influences

The rule structure draws on the readable objectives and tactile mechanisms of Indiana Jones: The Pinball Adventure, the user-directed shot multiplier of Stern Star Wars, the journey structure of Jurassic Park, and the cinematic centerpiece mechanisms of Godzilla and Jaws. No table assets or rules were copied.

See [research and design decisions](docs/DESIGN-RESEARCH.md) and [verification coverage and limitations](docs/VERIFICATION.md).

## Audio credit

“Desert Theme” by Tarush Singhal is used as the low-volume ambient score. It is dedicated to the public domain under CC0 and was downloaded from [OpenGameArt](https://opengameart.org/content/desert-theme-0). Attribution is optional under CC0, but included here with thanks. All pinball mechanisms and shifting-sand ambience are synthesized in the browser.
