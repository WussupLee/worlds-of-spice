# Mobile pinball overhaul: comparison and decisions

Reviewed September 24, 2026. This is a feature and visual analysis, not a claim that automated tests establish commercial-quality parity.

## What the supplied screenshots reveal

The first two images show the Williams No Good Gofers and Monster Bash cabinets. The third appears to show Zen's Empire Strikes Back table: its six scene inserts, character art, themed mechanisms, and compact score display are visible. The fourth is the Barrels of Fun Dune machine flyer.

The most important difference from our previous build was not the number of buttons or missions. It was the physical hierarchy: printed art underneath visible mechanisms, raised returns above the shooting surface, and a silver ball whose position in that hierarchy stays understandable. Our old renderer could draw a ground-level ball over an elevated ramp. That visual contradiction made an otherwise playable shot feel arbitrary.

| Gap in the previous game                           | Reference principle                                      | Implemented change                                                                                                                   |
| -------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Ball and side ramps shared a flat rendering layer  | Open wireforms have visible clearance and real occlusion | Three.js depth-buffered geometry; a shared height function for ramp and ball; ground orbits remain underneath                        |
| Opaque blue ramp bands hid the route               | Separate the ascending ramp from its open return         | Translucent ascending acrylic, four chrome wires, cross ties, support columns and moving entry gates                                 |
| Decorative mechanisms lacked physical consequences | The table reacts locally to the ball                     | Target bank physically drops and stops colliding; bumper caps recoil; orbit spinners turn; scoop worm rises on capture               |
| Marketing panels competed with the game            | The cabinet occupies the screen                          | Removed both desktop side panels; compact dot-matrix score; touch zones on the lower cabinet; one ruleset                            |
| Quiet effects and an unsuitable music selection    | Mechanical action sits in front of a cohesive score      | Stronger midrange coil/impact transients, distinct drop/spinner/scoop cues, ramp rolling, brief score ducking and separate sand/wind |
| Ramp capture was hard to recognize                 | A successful shot gets a readable local response         | Gate movement, chasing wireform lamps, raised ball and ground shadow, and a brief upper-wireform status                              |
| Rich rules were visually remote from play          | Progress lives on the playfield                          | Mission inserts, selected-shot lamps and a draining four-second Flow indicator next to the status display                            |

These are design interpretations of the supplied images, not claims that we measured Zen's source code, latency or hidden physics parameters.

## Research that informed the decisions

### Zen Star Wars and Williams on mobile

Zen's [Williams Pinball page](https://zenstudios.com/games/williams-pinball/) describes its mobile recreations, original/remastered presentation, interactive 3D characters, sidewall art and Pro Physics. Its [mobile App Store listing](https://apps.apple.com/gb/app/zen-pinball/id465694275) identifies licensed Star Wars tables and table-specific experiences. Neither is independent proof of realism, but both establish the product's focus on a convincing cabinet, not an app dashboard.

The [official table-guide index](https://forum.zenstudios.com/forum/zen-studios-games/pinball-mobile/zen-pinball-hd-android/3077-official-pinball-table-guides) identifies ShoryukenToTheChin's guides for Empire Strikes Back and the other Star Wars tables. The [Empire guide, mirrored here](https://www.thegameisafootarcade.com/wp-content/uploads/2017/02/Empire-Strikes-Back-Instructions-Guide.pdf), describes scene progression and timed sequences that connect specific orbit/ramp shots. The useful principle is an explicit next shot with a meaningful return, followed by a larger payoff. Our four territories and finale serve that purpose without importing its licensed rules or art.

The screenshot's small score display, near-full-screen table, slim chrome returns and local lighting are the direct mobile visual reference. Features advertised specifically for Switch on Zen's current Star Wars page are not treated as evidence about the older phone version.

### Indiana Jones

Zen's [Indiana Jones: The Pinball Adventure](https://zenstudios.com/games/indiana-jones-the-pinball-adventure-2/) preserves the Williams game's idol, Path of Adventure and movie-scene objectives while adding optional enhanced visual effects. The takeaway is that a recognizable, functioning centerpiece is more memorable than a static illustration alone. Our worm belongs to the scoop capture/release sequence; the harvester model visibly reacts during Harvest travel. The latter is decorative feedback, not an additional physical ball-lock mechanism.

### The Dune machine

The [manufacturer's flyer](https://www.barrelsoffun.com/wp-content/uploads/2025/04/BoF-Dune-Flyer-Final.pdf) lists three flippers, ramps and chrome returns, scoops, magnets, drop targets, physical locks and a vertically moving ball-eating worm. Its visual language combines blue inserts, desert print, metallic routes and sculptural toys. We adapted the height hierarchy, animated worm, drop bank and warm/cool lighting. We did **not** claim to reproduce its six-ball hardware, third flipper, magnets, lift ramp, subway, licensed sculpts or full rule set.

## Strategy and physics

One table retains five deliberate major shots: two elevated ramps with flipper returns, two fast ground orbits, and the central scoop. A major shot opens four seconds of Flow (up to 5×); hitting the selected Prescience shot builds a separate multiplier. Four open-play major shots begin a territory. Four indicated hits complete it. Three open-play scoop locks start three-ball play. All territories plus multiball qualify the final timed battle.

The engine still advances at 240 Hz. Flippers use heel pivots, rotational contact velocity and rising-stroke impulse, with held cradles and different early/late shot angles. Free balls use collision physics; captured ramps, orbits and scoops follow constrained tracks. Rendering is genuinely 3D, but the physics is intentionally a playfield simulation with explicit elevated paths, not a general 3D rigid-body solver.

Making targets physically drop exposed a repeatable scoop-to-bumper-to-scoop loop. The eject now clears the gap between the right and center bumpers. The original ten seeded full-game tests and the five-shot contact-timing reachability sweep still pass. Additional tests cover elevation continuity, ground underpasses, downward entrance crossings, drop-target clearance and scoop escape.

## Music selection and sound

Scott Buckley's [Shadows and Dust](https://www.scottbuckley.com.au/library/shadows-and-dust/) combines ambient drones, winds, strings and synth textures. In the [composer's release note](https://www.patreon.com/musicbyscottbuckley/posts/new-library-and-93437074), he explicitly connects its atmosphere to quieter moments of Zimmer's Gladiator and Dune scores. This makes it a much more relevant candidate than a generically desert-themed tune. It is not a Dune soundtrack recording or an imitation of its melodies.

The [composer's usage policy](https://www.scottbuckley.com.au/library/using-this-music/) permits project use under CC BY 4.0 with attribution. The full 6:48 composition is bundled at 128 kbps (about 6.2 MiB); title, artist and license appear in Credits, mixer, README and the audio license file. Music, mechanisms and air have independent controls. A six-second user-triggered preview auditions the mix while gameplay stays paused.

## Verification limits

The new render path is explicitly asserted in browser tests; a silent fallback is not counted as a 3D pass. Local hardware-accelerated Chromium at a 390×844 viewport measured a median frame interval of 16.6 ms and a 95th percentile of 18.3 ms on an AMD RX 6600. That is desktop hardware at phone dimensions, **not** measured phone performance. Software-only rendering was much slower, so no universal 60 fps claim is made.

Real-device Safari latency, speaker balance, thermal behavior and subjective table feel remain hands-on checks. The aim is a substantially more convincing and readable mobile cabinet, not an untestable promise of perfection.
