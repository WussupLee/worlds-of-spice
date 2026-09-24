# Verification and honest boundaries

## Automated checks

- `pnpm test`: deterministic engine/rules/storage tests. These cover launch strength, skill-shot qualification, both rising flippers, held energy limits, left/right cradle and release, rail tunneling, pause clocks, one-time ramp capture and return, drop-bank awards, save deadlines, three-ball termination, latched tilt, Oracle progression, combo expiry/cap, multiball completion and finale qualification.
- Ten seeded three-minute engine simulations use varied flipper input. Each must end normally with three balls consumed, finite coordinates/velocities and no escaped living balls. This caught trapping around sling vertices and return-lane caps in the original build. The 3D overhaul also exposed a repeating scoop eject, corrected by aiming the kickout through the pop-bumper gap.
- A contact-timing sweep from both flippers verifies that all five major shots are physically reachable as the first major shot. Rules tests alone would not prove that the layout actually lets players reach its objectives.
- `pnpm lint` and `pnpm exec tsc --noEmit` check source consistency.
- `pnpm build:pages` verifies a fresh static export and every linked build asset before creating a content-versioned offline cache.
- `pnpm test:browser` runs against the production artifact mounted at its real GitHub Pages path, not just the development server.

## Browser coverage

Chromium desktop, Pixel 7 emulation and WebKit iPhone 13 emulation cover launch and scoring, independent flippers, pause/resume, modal pause, blur handling, settings persistence, responsive sizing and runtime errors. An additional layout sweep covers 320×568, 360×740, 844×390, 1024×768 and 1366×768. Screenshots are produced as test artifacts for visual inspection.

Chromium-specific checks exercise native two-contact touch input and cancellation, actual Web Audio context state and soundtrack playback, offline reload with all application assets, and cached MP3 byte-range responses. Audio checks also verify a paused preview and measured non-clipping mechanism output with music and wind at zero. Graphics-context loss must pause play and offer an explicit reload recovery. A complete production-browser game uses an accelerated browser clock (normal animation frames and the unmodified game engine) to reach game over, save the score, and restart cleanly.

The Windows WebKit binary used locally has no `AudioContext` or `webkitAudioContext`. Its audio-graph test is explicitly skipped, not reported as a successful iOS audio test. Duplicate viewport/lifecycle tests and the Chromium-only touch protocol are scoped to the relevant runner. CI also runs Chromium and WebKit on Linux.

## Implementation boundaries

This is a **WebGL-rendered 3D cabinet with deterministic playfield physics**, not an assertion of parity with a commercial 3D simulator. Free balls collide with rails, bumper circles, convex slings, target faces, moving flippers and each other at a fixed 240 Hz simulation rate. Captured ramps/orbits/scoop travel follows authored track splines with explicit exit velocities. Ramps and elevated balls share a continuous 0–92–0 height function. Ground balls render and travel beneath those wireforms. There is no full 3D rigid-body ramp simulation or modeled ball spin/friction tensor.

Automated and emulated tests do not establish subjective “world-class” quality or prove zero defects. Real-device Safari audio, touch latency, thermal throttling, haptics, battery usage, interrupted calls, and Add to Home Screen behavior still need hands-on phone testing. Browser autoplay policies can require another user gesture. Unsupported audio hardware degrades to a playable silent game.

The final balancing question is human: do the returns feel satisfying, is the ball easy to read, and can a practiced player choose shots reliably? Use the live phone build to assess those qualities; unit tests cannot substitute for that judgment.

## Deployment protections

GitHub Actions checks tests, lint, types, production build and browser behavior before publishing `dist/client`. The service worker precaches the complete artifact, uses a build-content hash for updates, only manages this game's cache namespace, and never replaces a missing script with an HTML page. Audio range requests receive valid cached `206` responses offline.

The current vinext beta can throw a libuv assertion during process shutdown on Windows **after** successful prerendering. The Pages wrapper tolerates only that exact error after explicit build-complete output, a freshly written index, and verified linked assets. Other errors, stale exports and missing assets fail the build. Linux CI is the final deployment gate.

## September 24 3D verification

- 30 unit/rules/storage tests, including seven new elevation/mechanism contracts.
- Browser tests assert `data-renderer=webgl-3d`; a fallback or blank canvas is not accepted as a 3D pass.
- Dedicated development-only visual fixtures: ground underpass, elevated return, worm capture, multiball, finale and tilt. Their helpers are not exposed by the production application.
- Real Web Audio output is sampled after a flipper action, with music and wind set to zero, to catch an inaudible effects bus. This validates signal, not subjective speaker quality.
- Hardware-accelerated Chromium at 390×844 on AMD Radeon RX 6600: sampled median frame interval 16.6 ms, p95 18.3 ms. These figures are **not** phone-hardware measurements. Windows software rasterization was much slower (over 100 ms/frame), so hardware acceleration is important.
- Rendering merges static meshes and articulated toy parts by material, caches stationary shadows, caps pixel ratio at 1.65 and drops it under sustained slow frames. A world-height-aware ball shadow remains updated each frame.

Latest local production suite: 20 browser checks passed, 10 explicitly scoped/unavailable checks skipped. Windows WebKit omits Web Audio, so its two audio checks are not counted as passes. Final gameplay performance sampling uses a 3× device-pixel-ratio emulation (raster capped to 1.65×), 180 frames, a moving ball and alternating flipper input; reproduce with `node scripts/measure-renderer.mjs` while the development server runs.
