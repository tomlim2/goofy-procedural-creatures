# Performance

> Basis: `src/scene/mesh.js`, `src/scene/rig.js`, `src/scene/index.js`, `src/stroke.js`. When the code changes, fix this document in the same commit.

This lab's frame cost is almost entirely **the number of draw calls**. There are only about 60k triangles on a
board, so the GPU idles; what JS does each frame is a few hundred lines of state application per individual
(`applyState`) plus three.js setting up a material and drawing for every mesh. So there are three rules:
**fewer meshes, shared materials, and never build geometry per frame.**

## The numbers (7×5 = 35 creatures, measured at pixel ratio 2 on a 1500×1428 canvas — the absolute values differ per machine; only the ratio matters)

| | Before shared materials and merged meshes | Now |
| --- | --- | --- |
| draw calls / frame | 1313 | **550** |
| render JS time / frame | 3.3 ms | **0.8 ms** |
| material objects | 1611 (one per mesh) | **4~6** (shared per opacity level, plus emoji) |
| triangles / frame | 119k | 59k (drawn once) |
| baking a board (`scene.build`) | 55 ms | 52 ms |

9×6 (54 creatures) is 848 draw calls and 1.3 ms per frame. Baking is 74 ms — NEW SEED is instant, so there is
no reason to shave the baking side further.

## How it is measured

From the console (`window.menagerie.scene`):

```js
const s = menagerie.scene, r = s.renderer;
const t0 = performance.now(); for (let f = 0; f < 120; f++) { s.resize(); s.update(10 + f / 60); }
console.log("ms/frame", ((performance.now() - t0) / 120).toFixed(2), "calls", r.info.render.calls, "tris", r.info.render.triangles);
```

`renderer.info.render` holds the draw call and triangle counts of the last `render()`. Count individuals,
meshes and materials with `s.scene.traverse`.
If you changed the scene structure (layers, rig, meshes), measure these numbers again and update the table above.

## Rules

### One material per opacity level — `inkMaterial(opacity)`

`scene/mesh.js` makes one material per opacity level and every mesh shares it (`userData.shared`). The
renderer skips uniform updates while the same material runs on, and does not bake new materials on a regen.

- **Nobody disposes a shared material** — `disposeGroup` skips them. Temporary meshes (the audit) are removed
  with `disposeGroup` too
- Never change a shared material's `opacity` per frame — every mesh using that value fades along with it. Such
  meshes (the emoji fade) get their own material via `sketchMesh(…, { own: true })`
- `forceSinglePass: true` — stops three.js drawing transparent + DoubleSide in two passes, back then front
  (draw calls ×2, material needsUpdate every time). That is for 3D translucent objects needing front-to-back
  ordering and means nothing for 2D ribbons with no depthTest

### One layer = one mesh — fills and ink in one geometry

`stroke.js buildGeometry(sketches)` joins several sketches into one (earlier ones end up underneath). `rig.js`
bakes each layer's fills sketch and then its ink sketch into one mesh — every fill is opaque, so at the same
renderOrder the fills being drawn first is all that is needed. The exceptions are the face and the static eye
layers (staticEyeBack/Front): a static eye's fill (pupil, white) has to sit below the face ink (whiskers) and
its ink above, so fills 2.3 and ink 2.4 are kept apart.
The eye rig's white and rim are one mesh too. The hierarchy and the numbers are in [rig.md](rig.md) § the hierarchy.

Split a layer only when **it has to be switched on and off separately** — static eyes get one layer per eye
(`staticEyeBack`, `staticEyeFront`) because turning one eye into an arch for a wink means switching off that
eye's layer alone (with both eyes in one layer, the other eye disappears). The hair on the scalp is a different
layer from the horns too — its face-turn depth differs ([rig.md](rig.md) § fake 3D depth).
One individual shows around 15 meshes (whichever of the 13 layers are non-empty, plus limbs, tail bones, brows,
mouth and eyes).
When making a new layer, first ask "could this be drawn on an existing layer?" — one layer is 35~54 draw calls
across the whole board.

### Geometry is baked, not built per frame

[drawing.md](drawing.md) § generate once; animation only transforms. What changes per frame is `visible`,
`position`, `rotation` and `scale`, and nothing else.
The exceptions are the emoji (once per trigger) and regen (replacing an individual).

### If the size did not change, do not re-take it

`scene.resize()` is called by main every frame. If the canvas CSS size and pixel ratio are the same as last
time it does nothing — `canvas.width` has the pixel ratio multiplied in, so comparing it to `clientWidth`
directly calls `setSize` every frame and re-allocates the drawing buffer each time.

### The baking side (for reference)

- `color.js hexToRgb` caches per string — thousands of strokes on one board, a few dozen colors
- The end-taper and pressure functions in `Sketch.stroke` are built once per stroke (not per segment)
- The drawing functions (`character/draw/`) call `layout` and `eyeGeometry` several times — pure arithmetic, so
  it is not measured. Most of the 55 ms of baking is ribbon vertex generation
