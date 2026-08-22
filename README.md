# MENAGERIE

A grid of hand-drawn creatures grown from a single seed. A board where human, cat, dog and imp cycle down the rows
from the top, each breathing on its own clock, blinking, glancing around, getting startled, waving hello, folding and unfolding their arms, hopping in place, floating ♥ ! ? over their heads.
The lines never stop boiling on a low period. Shapes change only when you press NEW SEED.

**[tomlim2.github.io/goofy-procedural-creatures](https://tomlim2.github.io/goofy-procedural-creatures/)** — the board running right now.

## The goal

Every refresh brings out a board of thirty-odd creatures. The goal is not to draw one creature well but
**for a whole board to look like different creatures**. The hand-drawn texture comes from rules alone,
with no textures or brush images.

## Running

```bash
node serve.mjs
```

`http://127.0.0.1:7300`. It uses native ES modules, so opening it over `file://` is not supported.
three.js comes from unpkg via an importmap. The check scripts (§ Scripts) import `three` in node, so they need `npm install` once.

### Deploying

There is no build. Push a tag starting with `v` and `.github/workflows/pages.yml` puts the repo files on GitHub Pages as they are.

```bash
git tag v0.1.0 && git push origin v0.1.0
```

`serve.mjs` is local-only (it invalidates the module cache). On Pages the browser gets the static files directly.

`/debug.html` — **the debug screen**. The main page has only SEED, SPECIES and GRID; to touch the pose, ink, actions or regen, come here.
The drawing is the same and only the control cards differ (the same `src/main.js`). Nothing links here from the main page — you type the address.
To go back, press **MENAGERIE** in the header.

`/gallery.html?slot=legs&species=human` — **the parts gallery**. Draws every value of one slot side by side on the same individual
(species and seed fixed). The FIX dropdown (`&fix=legLength:short`) pins one other slot, and `&values=bangs,bun` puts just a few of that slot's
values up large. For judging the form of a single part. Where census is numbers, this is the picture.

`/how.html` — **the medium page**. The legend of how everything is drawn, on three axes: the goofy outlines (what a contour is drawn
with — the ribbon and the pencil, with their anatomy), the materials (how a surface is filled — seven of them as shader balls) and the goofy fur
(how hair is grown — fur balls), then the shapes, the colors and the boil. Every figure is drawn live by the same `src/stroke.js` that draws the creatures, at the board's own scale, and the
balls are generated from the tables themselves. The figures hold still; INK BOIL (`I`) sets their lines boiling at the board's own cadence.
The page cannot drift from the code, because it runs the code.

`/audit.html?seed=…` — **the face part audit**. Draws one board (35 creatures) in 22 face states (startle, sleep, blink, ^^, wink, anger, brow/mouth switches,
8-way turns, the ☆♥ variants, and combinations), toggling the eyes, nose, mouth, brows, eyewear, cheeks and sleep lids one at a time and counting the pixel difference. Under 4% of the head width is written down as
"not visible". Run it whenever you change the face — it has to be 0.

The main screen (`/`) has only **SEED · EXPORT · SPECIES · GRID**. The rest belongs to the debug screen (`/debug.html`).
On narrow screens (≤700px) the deck moves from the left edge to a bottom strip — cards run left to right and
scroll sideways (main and debug screens; gallery and audit assume a desktop width).

| Control | |
| --- | --- |
| NEW SEED / `R` | A new seed. The address bar's hash is the seed — keep something like `#0z0y9qe` and that board comes back |
| POSE MOTION / BIND / `B` | BIND pins the rig to the bind pose (T). For judging form and parts |
| INK BOIL / STILL / `I` | STILL stops the lines boiling. A separate axis from pose — it removes the noise when judging motion |
| ACTION AUTO / IDLE / SLEEP / SIT / WALK / an action | Forces one action (that layer only; the others idle) — arms (waving, arms up, arms crossed, a salute…, bipeds), body (hopping in place, everyone), quad (scratching, wagging). SLEEP lies quads down to sleep, SIT sits them (quad actions still follow their schedule — they scratch and wag while sitting), and WALK walks everyone — out from home and back (arm actions still follow their schedule). AUTO lets the layers overlap, with dogs and cats sleeping and sitting now and then and everyone walking now and then. IDLE is every layer idle and awake |
| REGEN STILL / LIVE / `S` | STILL by default. Turn LIVE on and individuals are replaced on their own clocks (6~14 s), as in the reference |
| SPECIES ALL / HUMAN / CAT / PUP / IMP | ALL is the fixed lanes. The rest are that species only — for judging color and part distribution |
| EXPORT PNG | Downloads the current screen as a PNG. The canvas pixels as they are (at screen resolution) with only a signature laid on top — the seed bottom-left, MENAGERIE bottom-right. The file is named `menagerie-<seed>.png` |
| GRID 1×1 / 5×4 / 7×5 / 9×6 | 1×1 stands a single creature (the view is doubled, so it is half the screen) — for looking at one part on screen. The paper grain is pinned to the 9×6 board regardless of the grid |

The state you make **rides in the address**. Build a screen, copy the address, and it stays; enter by that address and the same screen stands up.
Anything at its default is left off — the address of an untouched screen carries only the seed hash.

```
/?grid=1x1&species=cat&pose=bind&ink=still&action=wave#01dkuwa
```

`grid` `pose` `ink` `live` `species` `action` — exactly the controls in the table above, and the values are the buttons' `data-*` (for ACTION, the list's values).
A value not in the list, and **a value whose card is not on that screen**, is ignored — `pose=bind` falls off on the main page (it is used on the debug screen).
The seed being in the hash is unchanged. Press **MENAGERIE** in the header to go back to the main page (the same on the debug, gallery and audit screens).

## Structure

Two axes: **character** (what it is) and **motion** (how it moves). Character is everything static that the seed decides and
motion everything dynamic that the clock decides. It is not per-part animation. What joins the two is the scene's rig.

| Where | What it does | Docs |
| --- | --- | --- |
| `src/rng.js` | The seeded PRNG (mulberry32), weighted draws, 1D value noise | [determinism](guidelines/determinism.md) |
| `src/stroke.js` | Strokes → ribbon geometry. Wobble, pressure, scribbles, scribble fills, hatching. `pencil()` — the reference's line kept next to `stroke()`, its numbers in `PENCIL`. `MATERIALS` + `paint()` — what a surface is made of: how its area is filled, as channels — a base color (flat, wash) and its texture (hatch, scratch, bloom, dab, speckle, band). `GOOFY_OUTLINES` + `contour()` — the goofy outline (RIBBON, PENCIL). `GOOFY_FUR` + `fur()` — the goofy fur, how hair is grown (SCRIBBLE). A part names them (the board: FLAT, PENCIL, SCRIBBLE) instead of picking techniques and widths. `buildGeometry` (several sketches → one geometry) | [drawing](guidelines/drawing.md) |
| `src/color.js` | Hex color utilities — linear conversion (`hexToRgb`), luminance (`luminance`, `isDark`), tones (`shade`). Character and drawing share them | [drawing](guidelines/drawing.md) § colors |
| **`src/character/`** | What the seed decides. `vocabulary/` (slots, species, archetypes, palette) `spec.js` (seed→spec) `draw/` (spec→strokes: `layout` `head` `hair` `headgear` `face` `mouth` `faceStates` `body` `limbs`) | [character/](guidelines/character/) |
| **`src/motion/`** | What the clock decides. `table.js` (per-species parameters) `rhythm.js` (standing) `events.js` (intermittent) `states.js` (held — including the base states idle/sleep/walk) `actions.js` (idle and actions — arm, body and quad layers) `emoji.js` (emoji animation — the trigger layer) `ease.js` (curve shapes — envelopes and following, all eased in and out) `index.js` (assembly in a fixed rng order) | [motion/](guidelines/motion/) |
| `src/scene/` | three.js. `rig.js` (geometry → hierarchy) `animate.js` (state → rig) `paper.js` `mesh.js` (meshes and the shared GPU materials) `emoji.js` (glyph shapes) `index.js` (the scene, the loop, regen) | [rig](guidelines/rig.md) · [performance](guidelines/performance.md) |
| `src/export.js` | Screen → PNG. Puts the WebGL canvas onto a 2D canvas and lays a signature (seed, name) on top to download. It knows nothing about the scene — it takes a canvas already drawn | |
| `src/main.js` · `src/control.js` · `src/ui.js` | The entry point. `control.js` is the screen control table — the value, the address (query) and what that value does in one place (the buttons carry no behaviour). `ui.js` is the DOM utilities underneath (segmented buttons, list wiring, options, the rAF loop; shared with gallery and audit) | |
| `debug.html` | The debug screen — the same `src/main.js` as `index.html`, with every control card (the controller skips the missing ones) | |
| `src/gallery.js` · `gallery.html` | The parts gallery — the same individual side by side, per slot value | |
| `src/audit.js` · `audit.html` | The face part audit — counts by pixel whether a part is visible in each state | [character/rules](guidelines/character/rules.md) |
| `src/how.js` · `how.html` | The medium page — the goofy outlines, the materials and the goofy fur (balls generated from the tables), the shapes, the palette and the boil, drawn live by `stroke.js` itself | [drawing](guidelines/drawing.md) |
| `guidelines/` | The catalog and rules for the two axes, plus the performance, seed and drawing rules. **Read before changing anything** | [README](guidelines/README.md) |
| `reference/` | What it was made from, and what was and was not taken | [README](reference/README.md) |
| `scripts/` | § Scripts below | |

## Scripts

```bash
node scripts/census.mjs                # the species × slot distribution table plus identity violations. Look at it when you change parts or weights
node scripts/census.mjs --slot hair    # one slot only
node scripts/census.mjs --check        # violations only (exit 1)

node scripts/snapshot.mjs before       # before a refactor — records specs, geometry and 60 s motion trajectories
node scripts/snapshot.mjs after        # after — diff 0 means behaviour is unchanged

node scripts/drawdiff.mjs [ref]        # for drawing refactors — compares the working tree against a git ref (HEAD by default) over every slot value × species × seed. 0 means the drawing is unchanged
```

## The layers that make variety

Draw the slots by even random and around the thirtieth creature you get "the one I just saw". Four layers are stacked.

1. **Species** — fixed lanes, per row. It splits the skeleton (biped/quad), the color, the exclusive parts and the dominant motion
2. **Archetype** — one of six dispositions, `beast` `scholar` `trooper` `sprite` `blob` `wanderer`, is drawn per individual and
   the choice is made inside it. A collision with the left or upper neighbour is re-drawn
3. **Default weights** — slots the archetype does not touch get weights too. Without them the number of options becomes
   the probability, and 80% of `eyewear` ends up wearing something
4. **Proportion jitter** — head size, width and lumps; eye size, spacing and left-right asymmetry; body width; arm length; hand shake.
   Most of the silhouette variety comes from here

23 slots, 180 parts. A slot holds form only; pose and action are motion. Length and build (`armLength`, `legLength`, `build`) are dimension
slots independent of form — not a scale, only length and width change, and the leg stance is set by the torso's width.

## The hand-drawn texture

WebGL's `linewidth` is fixed at 1 nearly everywhere, so `Line` gives no control over thickness. Every stroke
becomes a ribbon mesh.

- The stroke is re-sampled at an even spacing and pushed along the normal. Low frequency (the whole thing bending) and
  high frequency (fine tremor) are overlaid
- It thins toward the ends and the pressure wavers in the middle
- Outlines are drawn twice, leaving the overlap visible
- The head is not a circle but a closed curve crumpled with noise
- Hair is not filled as an area but scribbled back and forth. Fills are covered with a scribble too, so the stroke direction shows
- Fills are offset off the lines
- The same drawing is baked in 3 sets differing only in jitter phase and swapped once every 1.5~2 s (the boil)

## Things to know

- **Color space** — three.js reads vertex colors as linear. Feed it an sRGB hex as-is and dark ink
  brightens into mid grey. `srgbToLinear` (`hexToRgb`) in `color.js` corrects that
- **Performance** — the frame cost is the number of draw calls. Materials are shared per opacity level (`scene/mesh.js`) and one layer is one mesh (fills + ink).
  550 draw calls and 0.8 ms/frame of render JS for 35 creatures. How to measure it and the rules are in [guidelines/performance.md](guidelines/performance.md)
- **The module cache** — `serve.mjs` appends `?v=` to relative imports. `Cache-Control: no-store` alone does not clear
  the browser's ES module map, so an edited file sometimes still runs the previous code
- **Seed reproduction** — the same seed is the same board. The order of rng calls *is* the seed, so reordering slots breaks existing seeds.
  A new slot is drawn at the very end via `LATE_SLOTS`, preserving existing boards. Write "seeds re-shuffled" in the commit for a breaking change
