# Sound coverage and the silent-recording repair

## What was wrong

Eight of the nine shipped WAVs contained entirely zero-valued PCM. Only `flipper-a` contained sound. The engine did emit bumper, sling, launch, drain and other events, but playing their files produced silence. The previous checks validated WAV headers/file sizes and measured one flipper; they did **not** establish that every recording was audible. The earlier verification language should be read with that limitation.

The export script applied fades to the source timeline before output-side seeking. Later selections were already faded to zero. Normalization then divided by a zero peak. The repair trims first, resets timestamps, applies fades to that selection, and refuses to export empty, silent or nonfinite input. All nine files were regenerated from the same licensed recordings. Tests now inspect every sample's peak, RMS energy and non-silent proportion. Runtime decoding also rejects silent media, allowing the audible fallback to work.

## Space Cadet comparison

The reference is the maintained [Space Cadet reverse-engineering project](https://github.com/k4zmu2a/SpaceCadetPinball), specifically its mechanism code—not an assertion that we have its original asset license, nor a reuse of its sound files.

- [Collision component](https://github.com/k4zmu2a/SpaceCadetPinball/blob/master/SpaceCadetPinball/TCollisionComponent.cpp): collision strength and active/passive behavior determine the response. Here, impact intensity scales contact sounds, and tilted mechanisms make passive contacts rather than powered hits.
- [Bumper](https://github.com/k4zmu2a/SpaceCadetPinball/blob/master/SpaceCadetPinball/TBumper.cpp): a bumper collision triggers sound, animation and scoring together. All three pops and both active slings are tested through actual ball motion here.
- [Flag spinner](https://github.com/k4zmu2a/SpaceCadetPinball/blob/master/SpaceCadetPinball/TFlagSpinner.cpp): rotation produces repeated, decelerating ticks. Our orbit spinner produces five increasingly separated relay ticks with falling gain, rather than one generic shot tone. It is an authored decay, not a simulated spinner angular-velocity model.
- [Rollover](https://github.com/k4zmu2a/SpaceCadetPinball/blob/master/SpaceCadetPinball/TRollover.cpp): crossing an entry triggers a latched response rather than firing continuously while occupied. Our existing inlanes and outlanes signal downward crossings once, with different rising/falling intervals.
- [Kickout](https://github.com/k4zmu2a/SpaceCadetPinball/blob/master/SpaceCadetPinball/TKickout.cpp): capture and timed ejection have separate sounds. Citadel now sounds at capture and its actual 0.72-second path exit, not both at entry.
- [Ramp](https://github.com/k4zmu2a/SpaceCadetPinball/blob/master/SpaceCadetPinball/TRamp.cpp): entry sensing is separate from movement through the ramp. Our raised ramps have entry, closing-gate and actual landing cues; a ground ball underneath does not trigger a ramp cue.

The useful principle is readable event timing and distinct feedback, not Space Cadet's bright arcade mix. This cabinet keeps its music-led, reverberant desert atmosphere.

## Complete event ledger

`app/game/sound-catalog.ts` is the typed source of truth for these 42 events. A new engine cue without a sound profile fails TypeScript. The same labels and trigger explanations appear in **Sound & Feel → Sound check**, and previews use the gameplay mixer while the ball is paused.

| Event | Trigger / sound |
| --- | --- |
| Flipper coil | First press only; alternating real coil recordings |
| Flipper release | Release a held bat; soft mechanical release |
| Ball on flipper | Meaningful contact velocity, independently of pressing; rubber impact |
| Pop bumpers | Each active pop collision; alternating impact recordings, position-dependent soft chime |
| Slingshots | Either active triangular rubber fires; firm rubber/coil impact |
| Rail / rubber | Meaningful passive wall, rubber or tilted-bumper rebound; strength-scaled click |
| Ball-to-ball | Two free balls collide; sharper, lighter contact |
| Drop targets | Standing target hit; relay plus short register tone; no repeated hit after dropping |
| Orbit spinners | Orbit capture; slowing mechanical tick train |
| Ball served | New waiting ball reaches shooter lane; trough mechanism |
| Plunger pull | Begin holding Launch; one cocking click, not every held frame |
| Plunger launch | Release Launch with waiting ball; real launch recording |
| Ramp entry | Actual capture onto either raised track; rolling plus short rising accent |
| Ramp gate | 0.23 seconds after ramp capture, matching gate closure; light release click |
| Ramp landing | Actual raised-path exit; rubber/ball impact |
| Orbit / launch return | Actual constrained-path exit; return contact |
| Scoop capture | Citadel pocket captures ball; hollow mechanism |
| Scoop kickout | Actual Citadel release; stronger eject mechanism |
| Ball drain | Every trough entry, including saved balls; real under-flipper recording |
| Cabinet nudge | Accepted nudge; subdued cabinet movement |
| Ball search | Stuck-ball recovery actually fires; relay release |
| Inlane rollover | Downward inner-lane crossing; soft rising pair |
| Outlane warning | Downward outer-lane crossing; soft descending pair |
| Orbit / launch score | Registered general shot or ordinary launch entry; brief scoring pair |
| Skill shot | Caravan selected and launch power 60–80%; three-note qualification |
| Flow combo | Second and subsequent major shots in the four-second window; rising pair |
| Prescience multiplier | Lit shot actually raises multiplier, not when already capped; distinct rising pair |
| Drop bank complete | Third target awards spice cache and shield; reward phrase |
| Citadel lock | First and second open-play locks; relay and low-to-mid register |
| Ball saved | Shield actually returns a drained ball; rising save phrase |
| Territory starts | Four open-play shots qualify territory; longer start phrase |
| Territory progress | Qualifying shot advances an unfinished territory; short progress pair |
| Territory expired | Unfinished timer expires; falling phrase |
| Territory / Dominion complete | Fourth qualifying territory shot, or surviving finale; resolving phrase |
| Wyrm multiball | Third open-play lock releases multiball; relay and ascending phrase |
| Multiball ends | One ball remains; descending resolution |
| Jackpot | Major shot during multiball or Dominion; bright but quiet short reward |
| Super jackpot | Citadel during multiball; longer reward |
| Dominion finale | Qualified Citadel shot starts finale; distinct five-note phrase |
| Tilt lockout | Third rapid nudge latches tilt; low warning sequence |
| Game over | Final unsaved ball drains; final descending phrase, allowed to decay before suspension |
| Game start | Start a new game; small confirmation accent |

Continuous rolling is additional to these discrete cues: speed controls gain/filtering, horizontal position controls stereo placement, and elevated metal travel has a brighter response than grounded rolling. Waiting or scooped balls do not contribute. Wind and shifting sand remain independent, extremely quiet continuous layers. UI settings are deliberately quiet; there is no generic click pasted over every button.

## Mix and provenance

Nine [CC0 Bronco recordings and their exact derivations](../public/audio/mechanics/LICENSE.txt) supply the physical layers. Several mechanisms reuse an appropriate edited source with different gain/pitch; this is not a claim to have 42 unique field recordings. Original synthesized accents distinguish electronic awards. No Space Cadet sound files, commercial pinball ROM audio or film score samples were imported.

The saved defaults remain **24% mechanisms / 72% music / 3% wind**. Music, wind level, the original 3.4-second stereo reverb and user settings are preserved. Feature sounds receive a restrained 180–6500 Hz presence branch in addition to the shared distance/reverb path. Flipper coils receive none of this extra branch. Important contacts are admitted before low-priority coil/rail chatter; a 24-voice cap and component-local cooldowns limit masking and overload. Missing or undecodable samples get a short non-silent synthesized fallback.

The final drain/phrase gets a 4.8-second decay window, interrupted immediately by hiding the page, opening a dialog, restarting, or leaving. Preview cancellation stops scheduled notes as well as recordings; a revision guard prevents an earlier slow-loading preview from playing over a newer selection.

## Verification

- All nine WAVs: actual PCM energy/peak/non-silent-sample assertions, not just file presence.
- 22 new engine tests: physical contacts and path timing, once-only sensors, powered/passive tilt behavior, reward qualification, saves, re-serve and final drain.
- `node scripts/measure-sound-catalog.mjs` with `pnpm dev`: 49 native OfflineAudioContext renders of the real mixer—42 events, second coil variant, missing-file fallback, mute, zero effects, crowded-contact stress and both rolling surfaces. Tests require finite/non-clipping output and nonzero small-speaker-band content. Music is deliberately excluded from this quantitative measurement; it is not a subjective listening assessment.
- Production-browser sound checks audition all nine recordings through the public selector; decode/start instrumentation requires actual nonzero signal. Existing real-time post-mixer peak and reverb-tail tests remain, as do full gameplay, mobile-input and offline tests.
- The new measurements show the key bumper, sling, launch, drain and kickout sounds have more mono 250–5000 Hz energy than the coil, without raising the coil or wind. This approximates small-speaker content; it does not model a particular phone or establish audibility in every room.

Physical phone speakers, Safari's hardware output and the subjective blend still need hands-on listening. Use the sound check with music left on to assess the normal balance, or temporarily turn Desert score to zero to isolate a mechanism. Existing custom mixer values are not reset by this repair.
