# Research → table design

Reviewed September 23, 2026. “Best” is not an objective ranking here: manufacturer materials establish the mechanisms, and the design judgments below explain which qualities are useful in a phone-first digital table.

## What the reference tables do well

| Primary reference | Distinctive mechanism | Design lesson | Worlds of Spice adaptation |
| --- | --- | --- | --- |
| [Stern Star Wars feature matrix](https://sternpinball.com/wp-content/uploads/2018/10/Star-Wars-Feature-Matrix.pdf) | Player-directed shot multipliers and layered mission/multiball play | Decisions should affect the value of an aimed shot, not just add passive points | A visible Prescience arrow raises the multiplier when hit. Flippers select its starting position before launch. |
| [Indiana Jones: The Pinball Adventure / Zen Studios](https://zenstudios.com/games/indiana-jones-the-pinball-adventure-2/) | The idol and Path of Adventure mechanisms, themed adventures, digital Pro Physics and enhanced presentation | Recognizable mechanisms plus routes make a table memorable; a digital recreation must also feel convincing | A ribbed Wyrm scoop anchors two recognizable ramp paths. The mechanical foreground is distinct from the illustrated desert. |
| [Stern Godzilla](https://sternpinball.com/game/godzilla/) | A changing building, bridge and ball-diversion mechanisms | The large centerpiece should participate in play rather than remain background scenery | Citadel shots build visible locks; the Wyrm opens and releases three-ball play. This is an adaptation of that principle, not a recreation of the collapsing building. |
| [Stern Jurassic Park](https://sternpinball.com/game/jurassic-park/) | Rescue progression, a navigable mission structure, creature and ball-lock interactions | Make the long journey legible while keeping the next shot explicit | Four territories, individual progress inserts, blue mission arrows and one persistent next-action instruction. |
| [Stern Jaws](https://sternpinball.com/game/jaws/) | Shark and fin mechanisms, anticipation around a central threat, and an upper playfield on premium configurations | Anticipation and a delayed mechanical payoff can create drama without constant spectacle | Lock lamps, scoop capture, restrained Wyrm jaw animation, a distinct multiball cue and a final timed storm. |

These primary sources describe features, not independent evidence that any table is universally the best. The choice to prioritize flow, a readable objective hierarchy, ball control and meaningful risk/reward is a design inference across them.

## Layout and scoring strategy

The lower third is a control zone, not an obstacle field. Paired slingshots punish weak returns; heel-pivoted flippers allow cradles and varied contact timing. Two raised blue ramps feed the flipper returns. Wide outer orbit entries provide faster cross-table routes. The central scoop is a harder, high-value shot behind the bumper cluster. Three stand-up targets make near misses useful: completing the bank once per ball awards a spice cache and a short safety window.

The four-second combo window includes the travel time through a ramp, so a successful return can become another intentional shot. Flow caps at 5× rather than growing without limit. A separate, clearly lit shot raises Prescience to 5×. Skill shots require both the selected orbit and a 60–80% plunger release. These are one ruleset, not selectable characters or game modes at the start screen.

The long-term arc is exploration → four territory completions and Wyrm multiball → Dominion. Ordinary scoring continues during modes; blue inserts identify valid mission shots. Multiball jackpots use all five major shots while the central scoop has a larger payoff. Completing the bank is optional; it is not an opaque prerequisite for basic progression.

## Visual direction

The supplied references informed the palette and composition: saturated orange sand, deep cobalt architecture, ivory stone, huge negative-space vistas, etched contours, and tiny human-scale details against monumental desert structures. The retained original generated landscape is the printed playfield, not a flat image pretending to be an interactive board.

Above that print are independently rendered metal rails, ramp troughs, support bolts, enamel bumpers, target faces, flipper rubbers, a recessed drain and plunger. Cast shadows and layered highlights provide depth. Moving parts react to game events: flippers pivot at their heels, bumper caps recoil, Wyrm jaws articulate, inserts change with objectives, hits ripple, and the reflective ball casts an elevated shadow on captured tracks. The desktop surround is an editorial cabinet presentation; phones retain the table and essential controls.

## Digital interaction

Pointer IDs are tracked independently, so two thumbs can hold two flippers. Keyboard and touch reach the same engine methods. Pointer cancellation, lost capture, window blur, visibility changes and pause release inputs. Menus pause the same simulation clock used by physics, missions and saves. A paused screen cannot quietly consume a mission timer.

The 600×1000 field preserves its 3:5 ratio on every layout. Portrait keeps the control deck below the field; short landscape moves controls beside the centered field. Rendering resolution is capped at 2× device pixel ratio. Static artwork and hardware are cached; only active parts and effects are redrawn as separate layers.

## Audio and rights

[Desert Theme by Tarush Singhal](https://opengameart.org/content/desert-theme-0) is identified by its creator as CC0. The [CC0 dedication](https://creativecommons.org/publicdomain/zero/1.0/) permits reuse without an attribution requirement; credits are included anyway. The bundled file is `public/audio/desert-theme.mp3`. This is an independent desert score, not a Hans Zimmer recording or a claim to reproduce the Dune soundtrack.

Mechanism sounds, rolling steel, wind and granular sand hiss are synthesized locally. Effects, score and ambience have independent live mixer controls and a master mute. Impact cues are rate-limited and compressed, not mixed at constant maximum loudness. Audio begins with a gesture and suspends when play is paused or the app loses focus.

No official film artwork, logos, dialogue or sound recordings are included. User reference images were used as visual direction, not redistributed as game assets. The resulting title and world are an independent desert-science-fiction homage.
