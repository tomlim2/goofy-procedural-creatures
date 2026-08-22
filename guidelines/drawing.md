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

## A line is a ribbon, not a Line

WebGL's `linewidth` is fixed at 1 in most environments. `THREE.Line` gives you no control over thickness.
Every stroke goes through `Sketch.stroke()` and becomes a triangle ribbon.

Four things have to be present together to look hand-drawn. Leave out any one and it becomes vector clip art.

1. **Re-sampling** — the points are re-placed at an even spacing. Without it the noise only bites on long
   segments
2. **Noise along the normal** — low frequency (the whole thing bending) overlaid with high frequency (fine
   tremor)
3. **End taper** — the start and end are pinched. A short stroke with only two samples (dots and freckles
   shorter than the 0.03 re-sample spacing) gets one sample in the middle so its width never reaches 0 —
   otherwise a dot mouth or dot nose disappears
4. **Pressure modulation** — the thickness in the middle is not constant

When the thickness needs changing globally, adjust `Sketch`'s `inkScale` rather than the individual `width`
values.

## The pencil — a second line

`Sketch.pencil()` is the reference's line ([reference/README.md](../reference/README.md) § 3) kept next to
`stroke()`, not in place of it. It differs in four ways: the spine wanders on two sines **per world length**
(a slow drift and a waver — a tiny stroke gets a gentle bend, a head contour one or two cycles), the width
**breathes** on two more sines plus a per-stroke jitter, the ends **run past** where they should stop
instead of pinching to a point, and a thick line **sheds** — ink crumbs outside the edge, paper-coloured
bites inside. Two parts of the reference are left out on purpose: its 62% ink (our ink stays opaque) and
its tremor (the sizzle).

Every number lives in the `PENCIL` table at the top of `stroke.js` and nowhere else — tune there. A
`closed` pencil line is seamless (no overshoot; the sines snapped to whole cycles), and its quads share one
normal per point, so it never cracks at a corner. `paper` is the color the bites take — pass the fill's
color when the line runs over a fill. Not for dots: the overshoot lengthens them.

The head and body contours draw with it, as the PENCIL goofy outline (below); the medium page (`/how.html`
§ the goofy outline) shows it next to `stroke()`. Switching another part onto it is a drawing change like any other —
`drawdiff` will show it, and the audit has to stay at 0.

## The outline — what a contour is drawn with

A creature's contour is drawn with one **goofy outline**, named from `GOOFY_OUTLINES` in `stroke.js`:
`ink.contour(path, "PENCIL", { color, closed, weight })`. `weight` is a multiplier on the outline's width (the head
contour runs at 1.15 of the body's); a part never picks a line function or a width itself. An unknown name
throws. The outline is its own concept — not part of a material: a contour is not a way of filling.

| Outline | Line | On the board |
| --- | --- | --- |
| `RIBBON` | `stroke()` 0.012 laid twice, jitter 0.007 — the board's original contour, the two passes never quite agreeing | — |
| `PENCIL` | `pencil()` 0.012 — one seamless loop: wander, breathing width, the shed | the head (weight 1.15), the body — **today** |

## The goofy fur — how hair is grown

Hair and fur are neither a contour nor a filling — in 3D they are a groom; here they are the **goofy fur**,
named from `GOOFY_FUR` in `stroke.js`: `ink.fur(path, "SCRIBBLE", { color, passes, width, spread })`. A part
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

Shading is not a material's job: in 3D, `material × light = shading`. The tilted scribble ellipses that shaded
every head and body (`scribbleFill`, a technique that cannot clip to a contour, so it poked past the outline
on tapered heads and short torsos) are **off**. What replaces them is a light: one direction per board or per
creature, and for every filled part a shade — the region facing away from the light, clipped to the contour
and filled in the material's shadow technique and a deeper tone of the part's color. Two steps, like cel
shading. The cheek and forehead hatch are the same thing (an occlusion). Until it exists, surfaces are flat.

## Materials — how a surface is filled

A material is what a surface is made of, the way a 3D material is — **how its area is filled**, as channels.
The `base` colour — the fill-up (`flat`, optionally a tone of the color) or a `wash` — always opaque (on the
board the one in front has to hide the one behind) and printed out of register by the creature's `fillOffset`;
— carrying the part's **pattern**, the creature's pattern (stripes, dots, spots, hatching: the `pattern` slot), drawn
inside it and clipped to the contour, the way a pattern is part of an albedo (`paint(…, { pattern })`); and its
`texture` — `hatch`, `scratch`, `bloom`, `dab` or `speckle` — the medium's pattern laid over it, clipped to the
contour (`clipSegment`, `insidePath` in `stroke.js`). Both paint the same thing, the colour of the surface —
base color and its map, in 3D terms. A channel that would be a *different* thing — `opacity` (the reference's
62% graphite, vertex alpha), `grain` (the paper showing through) — is not built; it would be a new key, not a
second texture (two patterns on one surface are one texture's composition). That is the material, and nothing
else. The color always comes from the part; a material knows no colors of its own, and every tone the texture
adds is a shade of the part's color (`shade` — deeper on a light color, lighter on a dark one). A part names a
material and hands over the path and the color: `fills.paint(path, "FLAT", { color, offset })`.

The table is `MATERIALS` in `stroke.js`; an unknown name throws, so a misspelt material cannot silently draw
nothing. The medium page draws one **shader ball** per entry — the same ball in the same color, filled each
way, its contour the board's PENCIL — so the table cannot drift from what is seen.

| Material | base | texture | On the board |
| --- | --- | --- | --- |
| `FLAT` | `flat` — the fill-up, the fan from the centre, out of register | — | the default of the `material` slot (weight 5); the calico patches always |
| `GRAPHITE` | `flat`, a pale tone | `hatch` — thin pencil strokes, nearly upright | the `material` slot (1.5) |
| `INK` | `flat` | `scratch` — a few long light lines dragged across | the `material` slot (0.8) |
| `WATERCOLOUR` | `wash` — a pale wash with a second out of register | `bloom` — how a wash dries: 2–4 blooms (paler lobed patches with a faint pigment rim, cut by the contour), the edge darkening (a deeper band inside the contour), granulation (fine dust) | the `material` slot (1.5) |
| `OIL` | `flat` | `dab` — thick short dabs in three tones along one diagonal | the `material` slot (1) |
| `CHARCOAL` | `flat` | `speckle` — dark specks | the `material` slot (1) |

The head and the body take the creature's `material` — a late slot ([character/parts.md](character/parts.md)
§ surface), one tool per creature. Every other fill is FLAT.

The medium page shows each ball's channels under it — the base colour alone, then the texture alone
(`paint(…, { only })`). A new material is a new row: a base and a texture; a new pattern is a new texture kind
in `paint()`.

`Sketch.fill()` is FLAT itself; the parts that still call it directly (ears, eyes, teeth…) are drawing FLAT
without naming it — naming the material is the direction, one part at a time, with `drawdiff` proving the
picture did not move. Putting a material on another part is a drawing change like any other: `drawdiff`
shows it, the audit has to stay at 0, and a textured material costs triangles (a hatched head is a couple of
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

## The boil

The same drawing is baked in 3 sets differing only in jitter phase (`drawCreature(spec, variant)`) and visible
is cycled at roughly 0.53~0.67 fps per individual (once every 1.5~1.9 s). Scribble fills are redrawn per
variant too and boil along with it.

**The boil is a material, not a motion.** The lines boil even while the character is frozen in the bind pose —
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
