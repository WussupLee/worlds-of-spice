# Sound and clarity refinement — September 24, 2026

## Listening direction

Music is the foreground layer. Collision events no longer duck the score. Default sliders are music 72%, mechanisms 24%, air 3%; their calibrated bus gains are respectively 0.504, 0.0768 and 0.0066. These are gain settings, not claims about equal-loudness perception on different speakers. All output buses start at zero to avoid a startup wind surge.

Actual recordings of a 1977 Gottlieb Bronco replace synthesized mechanical impacts: two flipper variations, release, two bumper variations, plunger, drain, scoring relay and rolling. Nine short mono PCM files total approximately 314 KB. Pitch varies gently to reduce repetition. Wind, moving sand and musical scoring accents remain synthesized.

The shared effects room has a 38 ms pre-delay, 3.4-second stereo impulse, 24% dry gain and 85% wet gain. A 3.4 kHz distance filter and 2.2 kHz reverb damping soften the high frequencies. The quiet effects master sits **after** the reverb so mute and volume changes also control the tail. The soundtrack does not pass through the room effect. Sixteen-voice limits and event throttles bound overlapping sounds.

Mixer settings move to storage v4. Older v2/v3 loudness settings are reset once to this requested sound direction, while mute, haptics, reduced motion, ball trail and high scores survive. Subsequent v4 user adjustments persist normally. The paused Test Sound control auditions flipper, bumper and plunger recordings with their room tail.

## Recording source and license

[1977 Bronco pinball, schafferdavid](https://freesound.org/people/schafferdavid/packs/25508/). Each of the five source pages explicitly licenses its recording CC0. Sources were captured with two Neumann KM 184 microphones in XY through a Scarlett 18i20. These are mechanical recordings, not ROM or film audio.

The publicly linked HQ MP3 previews were downloaded; original 96 kHz WAV downloads require an account. The bundled WAV files are **edited preview derivatives**, not original master recordings. Cuts, edge fades, filtering, mono conversion and 0.72 peak normalization are reproducible with `scripts/prepare-mechanics.mjs`; run with the original preview files in `work/pinball-recordings` and `FFMPEG_PATH` pointing to FFmpeg. [All source URLs and license details](../public/audio/mechanics/LICENSE.txt).

The independent licensed Scott Buckley score is unchanged. No Hans Zimmer composition, film recording or copied melody was introduced.

## Clarity and 3D materials

The earlier renderer capped hardware raster density at 1.65× and could reduce it below one pixel per CSS pixel without recovering. Hardware Automatic now starts at up to 3×, within a three-million-pixel budget; sustained slow rendering reduces density no lower than 1×, and sustained fast rendering restores detail. Maximum Clarity holds the chosen density; Battery Saver uses 1×. CPU/software renderers retain a separately bounded low-resolution fallback because native-density rendering there is prohibitively slow.

Lettering textures doubled to 1024×128; ground labels use dark ink for contrast. Texture filtering uses the GPU's available anisotropy. Rounded edges catch highlights, ivory parts use a plastic clearcoat, the printed deck uses a restrained clearcoat, and hardware shadows use a 2048-pixel filtered map. Lighting was reduced to avoid washed-out metal and print. The board remains real-time modeled 3D over an illustrated playfield, not a photograph or a claim of photorealistic reproduction.

## Playfield image provenance

Final asset: [playfield-crisp.png](../public/assets/playfield-crisp.png), **1024×1536**. Built-in image-generation tool, **edit mode**, one accepted generation. The original [playfield.png](../public/assets/playfield.png) is retained. The imagegen skill guided a composition-preserving detail refinement rather than a new table design. The returned image has the **same pixel dimensions** as the original despite requesting more; the improvement is cleaner ink, less noise and improved rendering density, not a claimed 4K texture.

Generated source: `C:\Users\lehij\.codex\generated_images\01a0d13f-7e21-7323-a5cd-c65048b5deed\exec-aa7b2df7-f7e5-4271-9098-dd3295eea4f9.png`.

Final prompt:

> Use case: style-transfer / detail restoration. Image 1 is the edit target: existing original playfield print for a real-time 3D pinball cabinet. Refine this exact illustration at 2048x3072 portrait resolution or the highest available 2:3 portrait resolution. Preserve its composition and positions: cobalt blue sky at top with moons, cream monumental towers and bridges along both sides, burnt orange desert, the same large swirling dark worm pit centered slightly below the middle, broad empty orange lower third. Preserve the retro 1980s European science-fiction ink-art aesthetic and exact warm orange / deep cobalt / ivory palette. Change only clarity and fine detail: precise clean ink contours, legible architectural masonry and rock facets, finer controlled hatching, much less grain and speckled noise, smooth flat color areas, sharp professional screen-printed surface quality. No blur, no depth of field, no distressed paper texture. This is a flat printed cabinet texture, NOT a pinball machine picture: do not add rails, flippers, balls, lighting glare, text, symbols, logos, frames, people, watermarks, or new subjects. Full bleed, preserve framing and layout.

The existing bespoke share cover `og-v3.png` is unchanged; this update concerns the actual in-game print.
