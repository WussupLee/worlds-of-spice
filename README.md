# Worlds of Spice

An original, mobile-first desert science-fiction pinball game built for the web. The table combines tactile movie-era pinball ideas—clear central objectives, route-based progression, timed modes, selectable shot multipliers, and escalating multiball—with a retro 1980s European graphic-novel art direction.

The project uses original names, visuals and game rules, with licensed music and CC0 pinball recordings. It is not affiliated with Dune, Legendary, Warner Bros., any publisher, or any pinball manufacturer.

## Play

- Mobile: hold the lower left and right sides of the table independently. Hold and release the center launch control. Swipe the upper playfield to nudge.
- Desktop: `A` / `D` or left / right arrows control the flippers; Space launches; `Z` / `X` nudge; `P` or Escape pauses.
- Tap either flipper before launching to move the illuminated Prescience shot. Select Caravan and release at 60–80% power for a skill shot.
- Chain major shots to build Flow, complete all four territory modes, and strike the center three times to awaken multiball.
- In Sound & Feel, Sound check previews each of the 42 effects and explains when it triggers. Music and wind have independent controls.

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
`pnpm preview:pages` serves that exact artifact at `http://127.0.0.1:4175/worlds-of-spice/`. Stop a manual preview before running browser tests; the test runner deliberately refuses to reuse an unrelated server.
The GitHub Actions workflow runs the checks before publishing to [the live game](https://wussuplee.github.io/worlds-of-spice/).

## Technology

- Vinext, React, and TypeScript
- A deterministic 240 Hz physics simulation, independent of React and rendering
- Heel-pivoted rotating flippers with contact-point velocity, rising-stroke impulses, held cradles, gravity, restitution, convex slingshots and ball-to-ball contacts
- Three.js WebGL 3D cabinet: original printed art, depth-buffered chrome wireforms, translucent ramp entries, moving gates, drop targets, spinners, a rising worm and reflective steel balls
- Real CC0 mechanical pinball recordings, warm distance filtering and a quiet 3.4-second stereo reverb; extremely subtle synthesized wind and shifting sand
- Foreground CC BY 4.0 cinematic score with independent music, ambience and effects controls, no collision ducking and a paused audio preview
- Up to 3× rendering with adaptive recovery, cleaner playfield print, physical clearcoat, rounded metalwork, sharper shadows and selectable display detail
- Local high scores and settings
- Installable offline web app

Rendering is true 3D; physics is a deterministic playfield simulation with elevated constrained paths, not a full rigid-body 3D solver. Free play uses collision physics; captured ramp, orbit and scoop travel follows constrained track splines. Those boundaries are intentional and documented rather than presented as a commercial simulator's physics engine.

## One table, one ruleset

Five major shots connect two ramps, two outside orbits and the central Citadel scoop. Ramps return to the flippers, enabling four-second Flow combinations (up to 5×). A lit Prescience arrow advances the table multiplier to 5×. Every four open-play major-shot counts starts the next unfinished 45-second territory; four indicated shots finish a territory. Three open-play Citadel locks start three-ball Wyrm multiball. Complete all four territories and multiball, then hit Citadel for the 40-second Dominion finale.

Three numbered drop targets award a 10,000-point spice cache and a short ball-save shield once per ball. Ordinary launches have a ten-second save; multiball starts with twelve seconds. Three rapid nudges latch tilt until the ball drains. Modes, save windows and physics share the same paused simulation clock.

## Research influences

The rule structure draws on the readable objectives and tactile mechanisms of Indiana Jones: The Pinball Adventure, the user-directed shot multiplier of Stern Star Wars, the journey structure of Jurassic Park, and the cinematic centerpiece mechanisms of Godzilla and Jaws. No table assets or rules were copied.

See [research and design decisions](docs/DESIGN-RESEARCH.md) and [verification coverage and limitations](docs/VERIFICATION.md).

## Audio credit

“Shadows and Dust” by Scott Buckley — released under CC-BY 4.0. www.scottbuckley.com.au.

[Track and creator](https://www.scottbuckley.com.au/library/shadows-and-dust/) · [License](https://creativecommons.org/licenses/by/4.0/). Bundled at 128 kbps for mobile delivery; no musical edits. This independent ambient composition is not the official Dune score.

Mechanical recordings: [1977 Bronco pinball by schafferdavid](https://freesound.org/people/schafferdavid/packs/25508/), CC0. Nine edited local samples cover flippers, bumpers, plunger, drains, relays and rolling. [Full attribution and processing](public/audio/mechanics/LICENSE.txt). Wind and musical game accents remain original synthesis.

See [sound and clarity changes, provenance and settings migration](docs/SOUND-AND-CLARITY.md).

The subsequent [complete sound ledger and silent-recording repair](docs/SOUND-COVERAGE.md) documents the corrected WAV exports, Space Cadet trigger comparison, per-mechanism mix and signal-level regression tests.

## September 24 overhaul

See the [reference comparison and gap analysis](docs/OVERHAUL-ANALYSIS.md), [verification boundaries](docs/VERIFICATION.md) and [share-artwork provenance](docs/SHARE-ARTWORK.md). The cabinet replaces the previous flat renderer and editorial sidebar layout. All five shots retain reachable flipper timing and a single ruleset.
