# Drawing rules

## Colors go in as linear

three.js reads vertex colors as **linear** space and converts to sRGB on output.
Feed it an sRGB hex as-is and dark colors brighten. Give it the ink `#2b2724` (0.169) directly and it becomes
**0.449, a mid grey**, on screen. However thick you make the stroke, it stays grey.

`hexToRgb` in `color.js` is wired to go through `srgbToLinear`, and `stroke.js` uses nothing else.
**Never bypass this path.** The utilities that handle hex colors (`hexToRgb`, `luminance`, `isDark`, `shade`)
all live in the single file `src/color.js` — character (the palette, face-ink decisions) and drawing (vertex
colors, tones) use the same functions.

The same goes for textures baked onto a canvas. State `colorSpace = THREE.SRGBColorSpace` on a
`CanvasTexture`.

## Nothing raw

No perfect circle and no straight edge is drawn on the board. `blobPath` always lumps — with the creature's
noise where the shape boils (heads, bodies), and from two sines of the angle where it must not (the details:
eyes, noses, hands, tail ends — `noise: null`); `amount` works either way, and amount 0 appears nowhere. A
hand-written polygon (a boot, a sleeve, the pot, the brim, a fang) goes through `crumple` — its edges
re-sampled and pushed by two sines, the corners kept — before it is filled. The contour strokes wobble on
their own; this is for the fills under them and the shapes that are only a fill.

## A line is a ribbon, not a Line

The board is three.js, and nothing is drawn on a 2D canvas (the only 2D contexts are the PNG
export and the medium page copying its renders into its cards). WebGL's `linewidth` is fixed at 1 in most
environments and `THREE.Line` gives you no control over thickness, so every stroke goes through `Sketch.pencil()`
and becomes a triangle ribbon; every fill is a fan of triangles; a layer's ink and fills go
into one `BufferGeometry` with vertex colors.

Four things have to be present together to look hand-drawn. Leave out any one and it becomes vector clip art.

1. **Re-sampling** — the points are re-placed at an even spacing. Without it the noise only bites on long
   segments
2. **Noise along the normal** — low frequency (the whole thing bending) overlaid with high frequency (fine
   tremor)
3. **End taper** — the start and end are pinched. A short stroke with only two samples (dots and dashes
   shorter than the 0.03 re-sample spacing) gets one sample in the middle so its width never reaches 0 —
   otherwise a dot mouth or dot nose disappears
4. **Pressure modulation** — the thickness in the middle is not constant

When the thickness needs changing globally, adjust `Sketch`'s `inkScale` rather than the individual `width`
values.

## The pencil — the one line

`Sketch.pencil()` is the reference's line ([reference/README.md](../reference/README.md) § 3), and since the
ribbon pen was taken out it is the only pen: every line, every hair stroke, every texture mark and every band on
the board goes through it. It has four habits: the spine wanders on two sines **per world length**
(a slow drift and a waver — a tiny stroke gets a gentle bend, a head contour one or two cycles), the width
**breathes** on two more sines plus a per-stroke jitter, the ends **run past** where they should stop
instead of pinching to a point, and a thick line **sheds** — ink crumbs outside the edge, paper-coloured
bites inside. Two parts of the reference are left out on purpose: its 62% ink (our ink stays opaque) and
its tremor (the sizzle).

Every number lives in the `PENCIL` table at the top of `stroke.js` and nowhere else — tune there. A
`closed` pencil line is seamless (no overshoot; the sines snapped to whole cycles), and its quads share one
normal per point, so it never cracks at a corner. `paper` is the color the bites take — pass the fill's
color when the line runs over a fill. Not for dots: the overshoot lengthens them.

The medium page shows it habit by habit (`/how.html` § the pencil). Changing what a part draws with is a drawing
change like any other — `drawdiff` will show it, and the audit has to stay at 0.

## The outline — what a line is drawn with

Every line on a creature is drawn with a **goofy outline** — a **kind** from `GOOFY_OUTLINES` in `medium/outlines.js`.
A part never names a kind, a line function or a width. It names its line's **role** and hands over the path and the
color, with at most a **size** on it — S · M · L from the kind's own ladder, and nothing else. There is no multiplier:
a width that is not on a ladder cannot be drawn, which is what keeps the board's line weights countable.

| Role | Call | What it is | Weights in use |
| --- | --- | --- | --- |
| contour | `ink.contour(path, { color, size })` | the closed line of a shape — the head, the body, ears, hats, hands, eyes, the nose, the mouth's parts | **S** the eyes and the mouth's small parts · **M** everything else |
| line | `ink.line(path, { color, size, joint })` | an open line, **down to a dot or a dash** — a brow, a lid, a whisker, a limb, a strand, a horn, the floor, a tooth's edge, a claw, the dot mouth. `joint = [start, end]` marks an end that meets another line or a fill's edge (the tail's root, the tip's arc): no overshoot, no thinning there | **S** the finest (hair strands, whiskers, a tail's hairs, the dots and dashes) · **M** the rest · **L** two lines only, an imp's horn and a stub tail |

Which kind each role is drawn with is **one switch**, `BOARD_LINES` — today `{ contour: "PENCIL_STROKE", line: "PENCIL_STROKE" }`.
Change a name there and every line of that role on the board changes; a new kind of line is a new entry in
`GOOFY_OUTLINES` and a name in the switch. An unknown role or kind throws. `pencil()` is the kinds' primitive and
almost no part calls it directly — the exceptions are the two **bands** (a hat's color laid as a thick stroke along a
brim or a crown: a fill in disguise, `draw/headgear.js`), the emoji glyphs, and the marks a goofy material and the
goofy fur lay down, which are the medium's own and not a creature's lines. The outline is its own concept —
not part of a goofy material: a line is not a way of filling.

A kind is named **the pen, then the hold**: **STROKE** (once, at full width — mass) · **SLINE** (thin, and the pen lifts —
detail) · **BROKEN** (laid three times over itself — contour). One pen is on the table, the pencil; `pen` names the hand that
draws a kind, for when a second one arrives. A kind also names its own ladder of three **sizes** — S · M · L — and the
board draws almost every line at **M** — S for fine detail, L for two lines in the whole board. The ladder is the kind's
own and not a multiple of one width: a hairline scaled to STROKE's L stops being a hairline.

A dot or a dash needs no hold of its own. **The pencil keeps the ends of anything shorter than `PENCIL.stub` (0.05) and sheds
nothing there**: an overshoot would run a mark half again to twice as long, and a crumb or a bite is the size of the mark. The
rule is the pencil's, not a kind's or a role's, because it is about the line's length and nothing else — the 70 shortest lines on
a 240-creature sample are stubs.

| Kind | Line |
| --- | --- |
| `PENCIL_STROKE` | `pencil()` **0.007 · 0.012 · 0.022** (the default ladder, `PEN_SIZES`), once — the reference's line at full width: it wanders, breathes, runs past its ends and sheds; closed, one seamless loop. **Mass** |
| `PENCIL_SLINE` | `pencil()` **0.003 · 0.005 · 0.008** once — a hairline at every size, its ladder deliberately tight — and **the pen lifts** (`PENCIL.lift`): a skip every 0.45 **world units**, 0.006~0.015 long, never within 0.015 of an end and none at all on a line under 0.04, so a dot or a dash keeps its whole extent. The lift is in world units and measured along the path **as handed over**, not along the overshot spine — a hold does not change with the size, so the same kind at S, M and L skips in the same places for the same length; in widths the gaps grew with the line and the three sizes read as three different holds. It also holds its width: `breathe: 0.5` halves the width's sines and the per-stroke jitter, because the breath is a share of the width and a hairline has little to spend on it — the swing reads as lumps instead of a hand. **Detail** |
| `PENCIL_BROKEN` | `pencil()` **0.006 · 0.011 · 0.020** with the **ghost** habit stacked — three passes, the two **under** the line at `PENCIL.ghost` — 0.62 of the width, and **one ink each, bottom-up**: 0.2 for the deepest, 0.5 for the one just under the line, the way a hand going round again leans a little harder. Faintness is a colour (mixed that far toward the paper), not an alpha: the board's ink is opaque and slipped 0.5~1.6 widths off it, to one side or the other. The line is laid last, so it stays the one you read, each pass wandering and breathing on its own — the doubled, offset line a hand going round twice leaves. **Contour** |

On the board today: every contour and every open line is PENCIL_STROKE — 45 and 119 call sites. **PENCIL_SLINE and
PENCIL_BROKEN are built and on nothing** — they exist in the table and on the medium page, and a role picks one up by a single name in the switch. The
medium page names the kinds outright (`{ outline: "PENCIL_SLINE" }`) to show each on its own — the one place a kind is named —
and draws the three roles off the switch, so it cannot drift from the board.

**The anatomy rows.** The pencil is also shown built up **one habit at a time** — a row per habit, each row the row above plus
one: the points · the ribbon · the wander · the breath · the flick · the shed · the ghost. They are drawn by the same
`pencil()` the board draws with, told which habits to leave out (`anatomy`,
`stroke.js` — **only the medium page ever passes it**; a habit left out is left out of the drawing, never faked). Every line
figure on the page is handed the **same sample line**, a sine (`sine()` in `how.js`), so the figures can be read against each
other, and every figure that takes it is given the height for it. The habits are read along the line's **own edge** — the
wander ripples it, the breath swells it, the shed frays it — not off how tall the row is.

## The goofy fur — how hair is grown

Hair and fur are neither a contour nor a filling — in 3D they are a groom; here they are the **goofy fur**,
named from `GOOFY_FUR` in `medium/fur.js`: `ink.fur(path, "SCRIBBLE", { color, passes, width, spread })`. A part
hands over the path (the crown arc, a tail, a bang) and the color; `passes`, `width` and `spread` may be
overridden — a style's volume — and everything else (root, reach, scatter, wave, lean) is the fur's own. An
unknown name throws. `Sketch.scribble()` is the engine underneath; `fur()` is the named way in.

| Fur | How it grows | On the board |
| --- | --- | --- |
| `SCRIBBLE` | the same path over and over, each pass pushed outward from the root (−0.25 → 0.6 spreads), every point waving | every hairstyle, the twintail and ponytail masses — **all hair today** |

Candidates not grown yet: TUFT (short and dense — an animal's tail end), WISP (thin and sparse), CLUMP (strands
that bunch). Adding one is an entry in the table plus the parts that name it; the medium page grows a fur ball
per entry by itself.

## The light — not built yet

Shading is not a goofy material's job: in 3D, `material × light = shading`. The tilted scribble ellipses that once
shaded every head and body (a zigzag fill that could not clip to a contour, so it poked past the outline on
tapered heads and short torsos) are gone — the method with them. What replaces them is a light: one direction per board or per
creature, and for every filled part a shade — the region facing away from the light, clipped to the contour
and filled in the goofy material's shadow technique and a deeper tone of the part's color. Two steps, like cel
shading. The cheek and forehead hatch are the same thing (an occlusion). Until it exists, surfaces are flat.

## What takes the goofy material

One tool per creature: **everything a creature fills takes its goofy material** (the `material` slot), through `paint` — the head and
the body directly, everything else through `paintPart` in `draw/body.js`. A skin, fur or cloth surface (the
ears, the muzzle, the hands, boots and sleeves, the tail and its ends) takes the creature's value step — one
mass on a dog, a cat or an imp (`surfaceHand`), its own color's on a human. A detail or an object — the hats,
the inner ear, the eyes (whites, pupils, irises, highlights, the static eyes, the star and heart eyes, the angry
eye), the nose, the mouth's inside, teeth and tongue, the blush, the eye patch, the cheek and
forehead shade patches, the horn tip — takes its **own color's** step (`own`): a black nose black, whatever the creature's hand. Two things stay FLAT
by rule: the **whites of the eyes** (the sclera, the static eyes' white, the star eye — `flat`: a white of the
eye is not a surface the pencil touches) and the emoji, which are not a creature's part.

Adding a filled part means painting it through `paintPart`, never `fill` — a `fill` on a creature is a bug
(it stands flat beside a hatched head).

## Decals — what sits on a surface

A **decal** is a color region that takes its edge from its host's own outline — the way a decal is projected onto
a surface and bounded by it. The calico's patches are decals (`decalAlong`, `bodyDecals`, `headDecals` in
`draw/body.js`). The contract:

1. The outer edge is **one stretch of the host outline's own points** (an angle and a span) — never a free curve,
   so nothing sticks out and the decal wears the host's lumps
2. The inner edge is **derived** from those points — pulled toward the centre by a depth that is 0 at both ends
   and deepest in the middle, bumpy with noise — and the two close into one polygon (a fan fill, so the span
   stays at or below 130°)
3. It is painted **in the host's base color**, after the fill-up and the pattern and before the texture
   (`paint(…, { decals })`) — so the goofy material's texture passes over it, as over the rest of the surface
4. Its only line is its inner edge, drawn after the contour in the host's ink (`decalEdges`)
5. It is placed by angle on the outline; on a head a dark decal stays out of the eye and brow zone
   ([character/parts.md](character/parts.md) § pattern — the calico)

The inner ear (the ear shape scaled about its root) and the roots of ears, horns and hair on the outline
(`headAnchor`) are the same idea's neighbours — an **anchor** is a point on the real outline plus its normal —
and are not under this contract yet.

## The goofy material — how a surface is filled

A goofy material is what a surface is made of, the way a 3D material is — **how its area is filled**, as channels.
(Goofy, like the outline and the fur, to keep it apart from the GPU material in `scene/mesh.js` — one flat
`MeshBasicMaterial` for the whole board.)
The `base` colour — the fill-up (`flat`, optionally a tone of the color) — always opaque (on the
board the one in front has to hide the one behind) and printed out of register by the creature's `fillOffset`;
— carrying the part's **pattern**, the creature's pattern (stripes, dots, spots, hatching: the `pattern` slot), drawn
inside it and clipped to the contour, the way a pattern is part of an albedo (`paint(…, { pattern })`; on a tail it runs
along the tube instead — stripes as rings, [character/parts.md](character/parts.md) § tail — and the tube's base is cut as a
**strip** between its rails, `paint(…, { strip, stripT })`, tagged per rung with its t along the spine so the bones can bend it — the **skin tag**, `Sketch.tags`,
which every drawing call can set (`skinT`) and a skinned mesh reads its bones from. A tag is **per vertex**: a point two quads share takes one t, or the part tears where
it bends. The `texture`'s marks take the tag too when the base is a fill at one t — a bead, a tuft, a pom turns with its hatching on it; over a strip they are left untagged
and the mesh reads them from where they sit, which inside a tube is the same t); and its
`texture` — `hatch`, `scratch`, `dab` or `speckle` — the medium's pattern laid over it, clipped to the
contour (`clipSegment`, `insidePath` in `medium/materials.js`). Both paint the same thing, the colour of the surface —
base color and its map, in 3D terms. A channel that would be a *different* thing — `opacity` (the reference's
62% graphite, vertex alpha) — is not built; it would be a new key, not a
second texture (two patterns on one surface are one texture's composition). `grain` — the paper showing through —
is not a channel at all: the sheet does it for the whole board in its own pass (§ the paper). That is the goofy material,
and nothing else. The color always comes from the part; a goofy material knows no colors of its own, and every tone the texture
adds is a shade of the part's color. On a light color a technique's own direction stands — graphite hatches deeper, ink scratches
lighter. On a **dark** color every mark goes lighter (`contrast` in `materials.js`), by as much as the technique asked for either
way: there is nothing below a dark ground to draw with. Only the amount is mirrored, never the direction — mirroring the direction
turned ink's light scratches into marks *darker* than the ground they were scratched into, and oil's darker half of the spread
vanished into a black body, so a dark creature with a textured material read as a solid blob. On a dark color the base is pulled
only **half** as far as on a light one: a mark's tone there is a light one, and pulling a dark part as far toward it as a light part
goes toward its shade washes the part out. A part names a
goofy material and hands over the path and the color: `fills.paint(path, "FLAT", { color, offset })`.

A third key, **`tooth`**, is not a channel but how the paper bites it — how much of the fill the sheet's grain takes
back (§ the paper). It belongs to the material because it is what the tool does to paper: graphite 0.45 rides the
tooth and skips it, charcoal 0.4 dusts it, flat 0.3, ink 0.12 soaks in, oil 0.06 buries it. The value step's `press`
scales it (black ×0.7 … light ×1.3).

The table is `GOOFY_MATERIALS` in `medium/materials.js`; an unknown name throws, so a misspelt goofy material cannot silently draw
nothing. The medium page draws one **shader ball** per entry — the same ball in the same color, filled each
way, its contour the board's PENCIL_STROKE — so the table cannot drift from what is seen. The last ball of every textured row is the same
material on a **dark ground**, which is where the rule above is visible.

| Goofy material | base | texture | tooth | On the board |
| --- | --- | --- | --- | --- |
| `FLAT` | `flat` — the fill-up, the fan from the centre, out of register | — | 0.3 | the default of the `material` slot (weight 5); the calico patches always |
| `GRAPHITE` | `flat` | `hatch` — thin grey pencil strokes, nearly upright, each rule drawn as a few `pencil()` strokes with gaps (the hand lifts), now and then doubled | 0.45 | the `material` slot (1.5) |
| (`WATERCOLOUR` was tried — blooms, edge darkening, granulation — and dropped: it did not look good on the board) | | | | |
| `INK` | `flat` | `scratch` — long light lines dragged across, taking the ink away: the darker the step the fewer and the tighter | 0.12 | the `material` slot (0.8) |
| `OIL` | `flat` | `dab` — thick paint: round-ended capsules of one width and many lengths, scattered along one diagonal, four tones close to the ground, cut flat by the contour | 0.06 | the `material` slot (1) |
| `CHARCOAL` | `flat` | `speckle` — coarse dark crumbs, each a short stroke at its own angle | 0.4 | the `material` slot (1) |

The head and the body take the creature's goofy material — the `material` slot, a late slot ([character/parts.md](character/parts.md)
§ surface), one tool per creature — at a **value step**. `VALUES` (`medium/materials.js`) is the reference's scale, five steps named for
the way graphite makes each: black 1 · hatch 0.72 · scribble 0.62 · stipple 0.5 · light 0.34 (each with a `press`,
how hard the hand leaned — it scales the material's tooth, § the paper). A goofy material renders a
step its own way — graphite changes technique (cross-hatch → hatch → a wavy scribble → coarse dabs → one thin set three gaps apart),
ink, oil and charcoal lay down more or less of their texture.

**A step is in the colour first and the marks second.** It pulls the base toward the technique's own tone — graphite and charcoal
darken it, ink lightens it (its scratches take the ink away), oil paints it — by the texture's `pull` × how far the step goes, and
*then* lays its marks on top. Value carried by marks alone cannot survive the board: a 7×5 cell puts 144 device pixels in a world
unit, the fine marks come out at half of one there, and the five steps measured **0.7~4.4 of luminance apart on three of the four
materials** — one flat colour to the eye, indistinguishable from FLAT. Coarsening the marks until they could carry a value on their
own was tried and dropped: it turns a small part into blotches and a face into camouflage. A flat fill never falls under a pixel,
so the colour carries the value and the marks stay **as fine as the hand would draw them** — the medium, not the tone. The steps
measure 18~40 apart on a light ground now. The step comes from the part's color's darkness
(`valueStep`: a dark cloth draws black, a pale skin light), moved one step by the creature's `density` — its hand,
another late slot (light: one step lighter · dense: one step darker; nothing on flat). **A hand that cannot move a step spends
it on the amount instead** (`valueHand` → `hardness`): a light hand on an already-pale surface lays 0.72 of the marks, a heavy
one on an already-black surface 1.35 of them. Without it a third of the density slot drew exactly like normal — the scale had
no step left to give. A dog, a cat or an imp is
**one mass** — its body is the head's color or a close tone of it — so head and body take the head color's step
(`surfaceHand` in `draw/body.js` — the one place a surface's step is worked out, and `materialOf` the one place its material
is named; a tone that crosses a step would otherwise hatch the body differently from the
head). A human is two surfaces, skin and clothes, each at its own step. The medium page draws each textured
goofy material as a row of the five steps. Every other fill is FLAT.

The medium page shows each ball's channels under it — the base colour alone, then the texture alone
(`paint(…, { only })`). A new goofy material is a new row: a base and a texture; a new pattern is a new texture kind
in `paint()`.

Every part names its goofy material through `paintPart` (`draw/body.js`); `Sketch.fill()` is FLAT itself, and no
part calls it directly any more. Putting a goofy material on another part is a drawing change like any other:
`drawdiff` shows it, the audit has to stay at 0, and a textured goofy material costs triangles (a hatched head is a couple of
thousand more per boil variant — measure, [performance.md](performance.md)).

## Layer order

Everything is drawn with `depthTest: false`, so order is decided entirely by `renderOrder`. The table lives in
[rig.md](rig.md) § the hierarchy, once only — update it there when adding a new mesh. Put the fills after the
ink and the lines are buried.

A layer's fills and ink are **one mesh** — `buildGeometry([fills, ink])` joins the fills sketch and then the
ink sketch into one geometry. Within one mesh, vertex order is front-to-back (there is no depthTest), so the
fills draw below and the ink above. The only reason to split a layer in two is when something from another
layer has to come between them (the face and the static eyes — [rig.md](rig.md)). One mesh is one draw call
([performance.md](performance.md)).

## Generate once; animation only transforms

Never rebuild strokes every frame. Regenerating 35 creatures × dozens of strokes per frame kills it.

- Static lines → 3 boil variants per creature (13 layers — body, back hair, side ears, head, horns, hair on
  the scalp, dog/cat ears, hat, face, static eyes ×2 (one per eye), the front of the face, bangs; one mesh of
  fills + ink per layer) are baked up front and cycled by toggling visible. The variants differ only in the
  jitter phase of `drawCreature(spec, variant)` in `character/draw/index.js`. Materials are shared per opacity
  level
- Moving things → only the separated rig transforms. The hierarchy:
  `group (feet) ─ bodyGroup (3 boil sets, the tail pivot, limb pivots) ─ headGroup (the neck axis, 3 boil sets) ─ faceGroup (the turn, 3 boil sets) ─ the eye rig, brows, mouth`
  The head turns about the neck (bodyTop), and the tail, arms and legs hang off their own pivots (root,
  shoulder, hip) and swing with `rotation.z`. A limb is baked once in its hanging reference state and only its
  angle changes. Brows and the mouth have their state sets baked up front and switch by toggling visible
- Joint target angles come from the clock and the scene follows them with easing (0.12/frame). A snapping
  joint breaks the drawing. Only the oscillation of a wave or a flap is laid on without easing
- Breathing → the `scale` of the whole group. The group's origin is at the soles, so it stretches with the
  feet still on the floor
- Regen → the whole individual is re-baked, per slot. Once per event, so it is allowed

If you want to add a new moving element, first ask "does this require rebuilding geometry?".
If the answer is yes, the design is usually wrong.

## The paper

The sheet under the board is one plane at renderOrder 0 and the board's **only shader** — a procedural GLSL fragment
(`scene/paper.js`, a `ShaderMaterial`; GLSL, not TSL: it drops into the WebGL renderer as it is). No texture and no
tile: the 2D-canvas tile it replaced (512 px for 3 grain units, bilinear, repeated) smeared on a big screen and showed
its repeat as a diagonal weave. The fragment has no resolution, so the grain is the same statistic at any size.

- **Grain space** — the view of the 9×6 board (`PAPER_GRID`), whatever the grid, set on every layout as the `grain`
  uniform; the grain is pinned to that board so 1×1 does not turn it into blotches.
- **Grain** — a cell of 3/512 grain units (the old tile's texel), a uniform ±13/255 per channel, nearest (it never smears).
- **Blotches** — three octaves of value noise (a third to a whole grain unit, the old discs' size), thinned to the
  darker patches and mixed 7% toward a warm tint (`#968468`), so most of the sheet is clean and nothing repeats.
- **Seed** — fixed at 7. The paper is the desk, not the creature: NEW SEED changes the board, not the sheet. The
  hash is an integer one (pcg2d), so every GPU draws the same grain.
- **Color** — the arithmetic is in sRGB on purpose, as the canvas's was, and the last line converts to linear for
  the renderer's output pass (§ colors go in as linear). It is the one place a color is handled in sRGB, and it
  never meets `hexToRgb`.

**The bite — the paper shows through the drawing.** The light cells of the grain are the peaks of the paper's
tooth: a pencil rides over them and skips them, a pen soaks into them, thick paint fills them in. So the bite is
**the mark's**, not the sheet's. Every triangle carries its own as a vertex tag (`teeth`, `stroke.js`), and the ink
material mixes it toward the sheet's color there (`biteThePaper`, `scene/mesh.js`, patched into three.js's basic
material so vertex colors, opacity, the tail's skinning and the color space all keep working):

    outgoing = mix(outgoing, sheetColor(world), tooth · smoothstep(0.55, 1, cell))

- It is a **color mix, not a hole in the alpha**. The board stays opaque within itself, so the creature in front
  still hides the one behind completely ([rig.md](rig.md)) — a hole would show that creature through the grain.
- `TOOTH` (`stroke.js`) is the default, 0.3: a contour, a fur stroke, the floor line, an emoji — everything that is
  not a goofy material. A goofy material names its own `tooth` (§ the goofy material) and `paint()` tags the whole
  surface it fills with it — base, pattern, decals and texture — putting the tag back when it returns.
- The value step scales it by its `press`: pressed black the mark fills the paper's valleys and little sheet is
  left showing (×0.7), a light touch only grazes the peaks (×1.3). A dark surface comes out richer, a pale one airier.
- The grain a mark is bitten by is cell for cell the grain the sheet shows: one chunk (`GRAIN_GLSL`) and one set of
  uniforms (`GRAIN`), both keyed on the **world** position, `grainScale` grain units per world unit. `(0, 0)` means
  no sheet and no bite — what the medium page's figures get, drawn on a card rather than on the board.

**Two passes.** The board is drawn on a transparent render target (4 samples — the lines get their anti-aliasing
there now), and then the sheet is drawn over the canvas with the board as a texture (`render()` in
`scene/index.js`; the plain sheet stays in the scene as its background, hidden for the board pass, and is what
the audit's direct renders see). The composite is a plain premultiplied `over` — nothing is taken off the drawing
there, because every mark already carries the paper in its own color. The one thing the target changes: it blends
in linear light where the canvas blended in sRGB, so the two steady translucencies keep their old grey by new
numbers — the floor line 0.72 → 0.88, the pupil 0.95 → 0.985 (the emoji fade is left alone). The PNG export reads
the canvas after `draw()`, the composite.

`drawdiff` hashes the bite along with the positions and colors, so a tooth that moves is a drawing difference like
any other. What it cannot see is the shader itself — that is judged by eye, and by the medium page's rows. `drawdiff` cannot see any of this — `/pixeldiff.html`
([determinism.md](determinism.md) § how to check) is the gate for the sheet and every other shader.

## The boil

The same drawing is baked in 3 sets differing only in jitter phase (`drawCreature(spec, variant)`) and visible
is cycled at roughly 0.53~0.67 fps per individual (once every 1.5~1.9 s).

**The boil belongs to the medium, not to motion.** The lines boil even while the character is frozen in the bind pose —
that is what a pencil line on paper does; it is not the character doing something. Which is why the on-screen
toggles are split into POSE (the rig) and INK (the lines). When judging motion, turn the boil noise off with
INK STILL and watch the joints alone.

## Every individual has a different hand

`proportions.wobble` is the per-individual hand-shake multiplier. Some have to come out neat and some a mess
for one board to look like a human hand made it. Ignore this value and draw with a constant and everything
ends up in the same handwriting.

## The module cache

`serve.mjs` appends `?v=` to relative import specifiers. `Cache-Control: no-store` alone does not clear the
browser's ES module map, so **an edited file still runs the previous code.**

If a change is not showing up, suspect this first. How to check:

```js
// in the console
document.querySelector('script[type=module]').getAttribute('src')  // ?v=... has to be there
```

Restart the server and `BUILD` is stamped anew, so every module URL changes.
