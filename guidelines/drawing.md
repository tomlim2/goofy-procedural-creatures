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
