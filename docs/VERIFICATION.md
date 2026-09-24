# Verification and honest boundaries

## Automated checks

The latest sound repair supersedes the earlier audio-file verification claim: eight valid WAV containers held silent PCM. The old flipper-only signal check could not detect that. See [the root cause, full event ledger and stronger checks](SOUND-COVERAGE.md).

- `pnpm test`: deterministic engine/rules/storage tests. These cover launch strength, skill-shot qualification, both rising flippers, held energy limits, left/right cradle and release, rail tunneling, pause clocks, one-time ramp capture and return, drop-bank awards, save deadlines, three-ball termination, latched tilt, Oracle progression, combo expiry/cap, multiball completion and finale qualification.
- Ten seeded three-minute engine simulations use varied flipper input. Each must end normally with three balls consumed, finite coordinates/velocities and no escaped living balls. This caught trapping around sling vertices and return-lane caps in the original build. The 3D overhaul also exposed a repeating scoop eject, corrected by aiming the kickout through the pop-bumper gap.
- A contact-timing sweep from both flippers verifies that all five major shots are physically reachable as the first major shot. Rules tests alone would not prove that the layout actually lets players reach its objectives.
- `pnpm lint` and `pnpm exec tsc --noEmit` check source consistency.
- `pnpm build:pages` verifies a fresh static export and every linked build asset before creating a content-versioned offline cache.
- `pnpm test:browser` runs against the production artifact mounted at its real GitHub Pages path, not just the development server.

## Browser coverage

Chromium desktop, Pixel 7 emulation and WebKit iPhone 13 emulation cover launch and scoring, independent flippers, pause/resume, modal pause, blur handling, settings persistence, responsive sizing and runtime errors. An additional layout sweep covers 320×568, 360×740, 844×390, 1024×768 and 1366×768. Screenshots are produced as test artifacts for visual inspection.

Chromium-specific checks exercise native two-contact touch input and cancellation, actual Web Audio context state and soundtrack playback, offline reload with all application assets, and cached MP3 byte-range responses. Audio checks also verify a paused preview and measured non-clipping mechanism output with music and wind at zero. Graphics-context loss must pause play and offer an explicit reload recovery. A complete production-browser game uses an accelerated browser clock (quarter-second animation callbacks and the unmodified 240 Hz game engine) to reach game over, save the score, and restart cleanly.

The Windows WebKit binary used locally has no `AudioContext` or `webkitAudioContext`. Its audio-graph test is explicitly skipped, not reported as a successful iOS audio test. Duplicate viewport/lifecycle tests and the Chromium-only touch protocol are scoped to the relevant runner. CI also runs Chromium and WebKit on Linux.

## Implementation boundaries

This is a **WebGL-rendered 3D cabinet with deterministic playfield physics**, not an assertion of parity with a commercial 3D simulator. Free balls collide with rails, bumper circles, convex slings, target faces, moving flippers and each other at a fixed 240 Hz simulation rate. Captured ramps/orbits/scoop travel follows authored track splines with explicit exit velocities. Ramps and elevated balls share a continuous 0–92–0 height function. Ground balls render and travel beneath those wireforms. There is no full 3D rigid-body ramp simulation or modeled ball spin/friction tensor.

Automated and emulated tests do not establish subjective “world-class” quality or prove zero defects. Real-device Safari audio, touch latency, thermal throttling, haptics, battery usage, interrupted calls, and Add to Home Screen behavior still need hands-on phone testing. Browser autoplay policies can require another user gesture. Unsupported audio hardware degrades to a playable silent game.

The final balancing question is human: do the returns feel satisfying, is the ball easy to read, and can a practiced player choose shots reliably? Use the live phone build to assess those qualities; unit tests cannot substitute for that judgment.

## Deployment protections

Each browser profile runs on an independent CI runner with one browser worker. Deployment waits for all three profiles to pass; failures are collected without cancelling the other profiles.

GitHub Actions checks tests, lint, types, production build and browser behavior before publishing `dist/client`. The service worker precaches the complete artifact, uses a build-content hash for updates, only manages this game's cache namespace, and never replaces a missing script with an HTML page. Audio range requests receive valid cached `206` responses offline.

The current vinext beta can throw a libuv assertion during process shutdown on Windows **after** successful prerendering. The Pages wrapper tolerates only that exact error after explicit build-complete output, a freshly written index, and verified linked assets. Other errors, stale exports and missing assets fail the build. Linux CI is the final deployment gate.

## September 24 initial 3D verification (before sound/clarity refinement)

- 31 unit/rules/storage tests, including eight new elevation/mechanism contracts.
- Browser tests assert `data-renderer=webgl-3d`; a fallback or blank canvas is not accepted as a 3D pass.
- Dedicated development-only visual fixtures: ground underpass, elevated return, worm capture, multiball, finale and tilt. Their helpers are not exposed by the production application.
- Real Web Audio output is measured with a native 32,768-sample AnalyserNode after a flipper action, with music and wind set to zero, to catch an inaudible effects bus. The long sample window captures short transients between slow graphics frames. This validates signal, not subjective speaker quality.
- Hardware-accelerated Chromium at 390×844 on AMD Radeon RX 6600: sampled median frame interval 16.6 ms, p95 18.3 ms. These figures are **not** phone-hardware measurements. The initial Windows software-rasterizer profile exceeded 100 ms/frame; software GPUs now start at a reduced raster resolution and adapt further. Hardware acceleration remains important for full-detail, high-frame-rate play.
- Rendering merges static meshes and articulated toy parts by material, caches stationary shadows, caps pixel ratio at 1.65 and drops it under sustained slow frames. A world-height-aware ball shadow remains updated each frame.
- Pause and settings freeze WebGL draws until a resize or resume. Browser instrumentation verifies draw calls stop while paused and restart during play. This removes unnecessary GPU work behind the mixer without shortening its native-keyboard persistence test.

That local production suite verified 23 browser scenarios across the full and follow-up runs, with 10 explicitly scoped/unavailable checks skipped. Windows WebKit omits Web Audio, so its two audio checks were not counted as passes. Initial gameplay performance sampling used a 3× device-pixel-ratio emulation (raster then capped to 1.65×), 180 frames, a moving ball and alternating flipper input; reproduce with `node scripts/measure-renderer.mjs` while the development server runs.

CPU-only CI uses one browser worker and action/DOM traces without continuous WebGL screencast readbacks. Explicit screenshots remain enabled. The full-game lifecycle advances the browser clock in quarter-second frames; collisions still advance at 240 Hz. Ordinary touch, pause, audio and layout tests use real elapsed time. Native long-window audio measurement avoids test-only worklet initialization, which hung the Linux WebKit process despite ordinary playback tests passing. The game itself bounds catch-up at 250 ms and automatically reduces raster density under sustained rendering pressure; no test-only physics or scripted drains are shipped.

## September 24 sound and clarity verification

- 38 unit tests pass, including real WAV file contracts, event-to-recording mapping, music-led gain calibration, settings migration and adaptive-resolution recovery/budgets.
- The fresh production artifact passes all 23 applicable local browser scenarios; ten platform-specific or duplicate checks are explicitly skipped. Lint and TypeScript checks also pass.
- Actual browser output with music and air zero passes the quiet-signal bounds: peak greater than 0.001 and less than 0.15. Instrumentation verifies a real 220 ms recorded flipper starts, a 3.4-second convolver is connected, and a later output tail remains after the recording ends. These are measured signal checks, not a claim to have listened through physical phone speakers.
- Mixer values and Battery Saver detail persist through reload; migration preserves mute, haptics and reduced-motion preferences while applying the new default 24/72/3 effects/music/wind mix.
- A 390×844, DPR 3 Chromium run now renders the cabinet at **1170×1950**: 180 real-time frames, median **16.7 ms**, p95 **17.8 ms**, 117 draw calls and no runtime errors. This is AMD Radeon RX 6600 desktop hardware with a phone viewport, **not phone hardware**.
- Inspected the rendered phone table: cleaner print, legible contour detail, stronger ground-label contrast, smoother metal edges and depth-separated raised returns. The illustration itself remains 1024×1536; see [the refinement and image-generation provenance](SOUND-AND-CLARITY.md).
- The production preview uses port 4175 and refuses to reuse another server. An initial aborted run found an unrelated project occupying 4173; it was left untouched and does not count as game verification.

The first Linux release run passed every gameplay test and both mobile profiles, but exposed a timing error in the new desktop reverb assertion: multiple automation round trips on a slow software GPU postponed the tail sample until after the room decayed. The revised test triggers the normal flipper input and captures peak and tail in one browser task, anchored to the actual AudioContext source-start time. It holds the flipper to exclude a release sound and requires samples in the 1.2–2.4 second tail window, with unchanged output thresholds. The production audio was not made louder to satisfy the test.

## September 24 complete sound repair

- 70 unit tests pass, including nine actual PCM-signal checks, exhaustive cue coverage, and 22 new engine event-timing/award tests. Existing reachability, lifecycle and physics tests remain unchanged.
- 49 native Chromium OfflineAudioContext renders pass through the actual CabinetAudio mixer: all 42 cues, the second flipper variant, fallback, mute, effects-off, voice stress and two rolling surfaces. The observed maximum output peak was 0.05924; mute/effects-off were exactly silent. Every intended audible case had nonzero 250–5000 Hz mono content. The normal random pitch variation means exact peaks vary between runs.
- The production artifact passes 25 applicable local browser cases, with 11 explicitly scoped/unavailable skips. The new audition test covers all nine real recordings and the 42-item public selector on desktop and Android profiles; Windows WebKit lacks Web Audio, so it is skipped there rather than counted as an iPhone audio pass.
- Real-time flipper signal/tail tests still pass at the unchanged quiet-output bounds. Game over now lets the final drain/phrase decay instead of suspending immediately. User mixer settings, high scores, music and wind defaults are preserved.
- TypeScript, lint and the static build pass. The complete sound ledger documents Space Cadet's event-timing influences without importing its audio assets.

These are signal, behavior and browser-emulation checks—not a physical phone listening test or a claim of commercial simulator parity.
