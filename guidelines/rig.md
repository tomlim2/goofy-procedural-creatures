# Rig structure

> Basis: `src/scene/rig.js`, `src/scene/animate.js`. When the code changes, fix this document in the same commit.

`buildCreature` in `src/scene/rig.js` assembles it and `applyState` in `src/scene/animate.js` applies the state every frame. This is the three.js hierarchy one individual is assembled into.
Mesh and material counts, and the reason for them (draw calls), are in [performance.md](performance.md).

## The hierarchy

```
group                        ← origin = the soles. Sway, shiver, jump, breathing, jelly
├── bodyGroup                ← a quad sitting (state.bodyTilt): turns about **the front legs' root** (item.bodyPivot = frontHipX·hipY from motionRig().body) —
│   │                           rotation plus a position correction that leaves the axis in place (animate). Leg pivots and the tail are children and tilt with it; headGroup is a sibling and does not move (the axis is right below the head)
│   ├── bodyFrame ×3         ← boil variants. Body fills+ink, one mesh (1.5)
│   ├── tailGroup            ← a pivot at the tail root (quad). 0.8 — behind the torso and head
│   │   └── bone[0] ⊃ bone[1] ⊃ bone[2] ⊃ bone[3]  ← a four-bone chain (joints = the quarter points of the spine). tailAngle on bone[0], tailTip on bone[3], tailRaise a target angle per joint (the raise)
│   │       └── along(θ) ⊃ thick ⊃ back(−θ) ⊃ the bone's mesh  ← bristle (tailPuff): thick.scale.y — it thickens **only perpendicular** to the rest-pose spine direction θ (length and joint positions unchanged)
│   └── limb pivot ×N        ← shoulder and hip pivots
│       ├── front             ← the upper arm (or the leg). renderOrder 2.5
│       │   └── elbow         ← the elbow pivot plus the forearm (arms only). Shoulder and elbow angles separately
│       └── back              ← hands behind the back (arms only, 0.5)
└── headGroup                ← origin = the neck (neckY = bodyTop). Tilt, roll, nod, dip. Only the outline sits here directly
    ├── headFrame ×3         ← boil variants. Head outline fills+ink, one mesh (2, the fill opaque)
    ├── depth groups ×7 (item.parallax)  ← one group per layer attached to the head — on a face turn, position = **depth (DEPTH) × the features' shift** (the same multiplier on x·y, size unchanged). § fake 3D depth
    │   ├── hairBackFrame ×3     ← depth −0.12 · back hair (the outside of long hair, twintails, a ponytail, big masses). Behind the head and ears, above the body (1.55) — behind the head, so the other way
    │   ├── crownBackFrame ×3    ← depth −0.4 · side ears (humans, imps). Behind the head fill (1.7) — the root is hidden by the head
    │   ├── hornsFrame ×3        ← depth 0.45 · horns. Above the head ink (2.06)
    │   ├── hairCrownFrame ×3    ← depth 0.12 · hair on the scalp (the crown cap, spikes, a bun). The same depth as the horns, above them (2.06)
    │   ├── frontFrame ×3        ← depth 0.2 · dog and cat ears. Above the head ink (2.12) — it covers the outline and the hair's root but cannot cover the eyes
    │   └── hatFrame ×3          ← depth 0.45 · hat. Above the bangs, below the brows (6.58) — a hat sits on the hair, never under it
    │   └── hairFrontFrame ×3    ← depth 0.12 · the bangs band, side curtains, the front of the hood type. Over the face (6.55), below the brows and mouth (6.6)
    └── faceGroup            ← origin = the centre of the head (headCy). x/y shift plus squash from the face turn. Every feature
        ├── faceFrame ×3         ← boil variants. Cheeks, whiskers — fills (2.3) and ink (2.4) as **two meshes** (they have to interleave with the static eyes)
        ├── staticEyeBackFrame ×3 · staticEyeFrontFrame ×3  ← boil variants. Static eyes (dot, half, slit…), **one layer per eye** (the smaller eye Back, the larger Front). Fills (2.3) and ink (2.4), two meshes.
        │                            **The two layers have the same render order** — front-to-back is decided by the sketch, not the layer: on an eye with a white, the outline and lid line have to be drawn into the fills (2.3)
        │                            for the front eye's white to cover the back eye's outline. Put them in the ink (2.4) and the back eye's outline rises above the front eye's white, leaving a crossing line
        │                            For sleep, ^^, a wink (that side) and startle variants (☆·♥), **that eye's** layer is switched off — a wink changes one side only and the other eye stays
        ├── faceFrontFrame ×3    ← boil variants. Nose, muzzle and eyewear, one mesh (6.5) — above the eye rig
        ├── eyeFx ×(eye count)  ← startle variants: the ☆·♥ glyphs (6.32). There is no cover — meanwhile the static eye frame and the eye rig are **switched off** and this stands in. Only when state.eyeFx
        ├── faceStates.brow ×3   ← rest / alt / angry (the angry brow — none on species that have none)
        ├── faceStates.mouth ×4  ← rest / alt / angry (the tooth grid on humans and dogs, fangs on cats and imps) / ^^ (the tongue on dogs). The same kind shares a mesh
        ├── staticLid ×(static eye count) ← a static eye's (dot, cross, slit…) shut line, smile arch and fierce eye (3.6). Asleep (sleep > 0.5) the shut line, angry the fierce eye, ^^ or a wink (that side) the smile arch — that eye's static layer (lid.frames) is switched off then and this stands instead (no cover)
        └── eyeRig ×(0~2)        ← live eyes only
            ├── open{white+rim as one mesh · pupil} · smile · shut · angry — from the eye block o (back eye 3, front eye 3.5): +0 · +0.2 / +0.35 / +0.35 / +0.35. On closing, open is **switched off** and shut (the shut line, lid > 0.5), smile (^^, a wink) or angry (anger — the fierce eye) stands instead — there is no skin-colored cover
emojiRoot (the scene root, beside group)  ← the emoji. Not attached to the head; it eases (0.1) toward the point above the head (in world coordinates) —
                                  so it is dragged a beat behind on a tilt or a jump and leans into the drag. It only has a mesh while an emoji is up
```

The numbers in parentheses are renderOrder. With `depthTest: false` these numbers *are* front-to-back. **This table is the single source** — update it here when adding a new mesh.
These values are the layers **within** an individual. The scene gives each individual a block of `index × 10` on top (`scene/index.js stack`) — so when neighbours overlap (a huge head, walking),
the individual in front (a lower row; within a row, the one to the right) is drawn above as a whole and layers never interleave. Every fill is **opaque** (body, head, face, front ears, hat), so
the front individual hides the one behind completely, outline, color and shape. The emoji is 100000 (above every individual); paper 0 and the floor line 1 are unchanged.

One layer is one mesh — the fills sketch and the ink sketch are joined into one geometry (fills underneath). Within the same renderOrder, vertex order *is* front-to-back, so no separate
number is needed. Only the face and static eyes are two meshes, fills (2.3) and ink (2.4) — the two layers' fills and ink have to interleave (a static eye's fill below the whiskers, its ink
above). Materials are shared per opacity level ([performance.md](performance.md)).

| renderOrder | What |
| --- | --- |
| 0 | Paper |
| 0.5 | Arms behind the back (behind the body) |
| 0.8 | The tail (at rest) — behind the torso and head. The part lying over the body (a loop or curl over the back) is hidden. **While raised (tailRaise > 0.5) it is 2.08** — above the outline and the hair on the scalp, below the ears and face (animate changes the renderOrder). One cat in four has its tail root inside the big head silhouette, so left behind it is invisible even when raised |
| 1 | The floor line |
| 1.5 | Body (fills+ink) |
| 1.55 | Back hair — behind the head and ears, above the body (depth −0.12). Only what comes outside the silhouette shows |
| 1.7 | Side ears (humans, imps) — behind the head fill, so the root is hidden by the head (depth −0.4) |
| 2 | Head (fills + outline ink) — the fill sits **above the body ink and is opaque**. So the body outline does not show through where the head covers the torso |
| 2.06 | Horns (depth 0.45) · hair on the scalp (depth 0.12, above the horns) — above the outline |
| 2.12 | Dog and cat ears — the fill opaque (it covers the outline and the hair's root, so the ear attaches as a bump in the silhouette) (depth 0.2) |
| 2.3 | Face fills (cheeks) · static eye fills (pupil, white; one layer per eye — the smaller first) |
| 2.4 | Face ink (whiskers, freckles, tears) · static eye ink (one layer per eye) |
| 2.5 | Limbs, upper arm and forearm (above the body ink — the sleeve covers the outline) |
| 3.0~3.35 | The back (smaller) eye's rig — white+rim 3 · pupil 3.2 · ^^/shut line 3.35 (on closing, the white, rim and pupil are switched off and only the line remains) |
| 3.5~3.85 | The front (larger) eye's rig — the same order, +0.5. When two eyes overlap the front eye's white covers the back eye's rim and pupil (no crossing line) |
| 3.6 | A static eye's shut line and smile arch — the static eye frame is switched off then (no cover) |
| 6.32 | The startle variant ☆·♥ glyphs — meanwhile the eyes (the static frame, the rig) are switched off. Below the nose and eyewear |
| 6.5 | The frontmost face (muzzle fills plus nose and eyewear ink) — so a lid or an eye cover cannot cover the nose or a rim |
| 6.55 | Bangs — above the nose and eyewear, below the hat, the brows and the mouth (depth 0.12) |
| 6.58 | Hat — above the bangs (a hat sits on the hair, never under it), below the brows and mouth (depth 0.45) |
| 6.6 | Brows and mouth — above the eye rig (so a closed lid does not erase the brows and a widened cyclops white does not erase the mouth) |
| 100000 | The emoji (♥ ! ? … ;) — above every individual's block (`EMOJI_ORDER`) |

## Origin rules

- **group** — the soles. Breathe with scale and it stretches with the feet still on the floor
- **headGroup** — the neck. The head geometry is baked pre-lowered by `-neckY`. rotation.z turns about the chin area
- **faceGroup** — the centre of the head (headCy). The face geometry (face frames, brows, mouth, eye rig) is baked lowered by `-faceCy` and the group is placed at `faceCy - neckY`. The turn's shift and squash are about this point
- **depth groups** (`item.parallax`) — the same origin as headGroup (the neck). On a face turn, position only = depth × the features' shift (§ fake 3D depth). scale is never touched — an attachment moves position and does not change size
- **limb pivot** — the shoulder (22% below bodyTop, on the torso's left/right outline — half-width per form: box 0.98 · bean 0.85 · dress 0.76 · tube 0.63) / the hip (0.02 above the hem) / a quad's root (25% of bodyH up). A limb is baked hanging from the pivot's origin. Arms are stood up with `bindArm(side)` (the T-pose) and the clock's `state.arms` supplies the joint angles
- **elbow** — the end of the upper arm. The forearm is baked hanging from the elbow's origin. Upper:lower arm = 0.48:0.52. `armRig(spec)` passes the same dimensions to the clock so it can solve actions by IK
- **tailGroup** — the tail root (the back end of the body). Inside it, **a four-bone chain** (`tailSketch().bones` — joint origins and rest-pose directions). The skin is baked continuously across the bones — in every boil frame, all three in one mesh per bone, switched by drawRange ([performance.md](performance.md)) — with a **cap** (a disc of the tube's width) at every joint on the parent bone, so a bend opens no wedge ([character/parts.md](character/parts.md) § tail). A bone's mesh sits inside three groups, along(θ)·thick·back(−θ) — bristle is thick.scale.y only (perpendicular to the spine)
- **eyeRig** — the eye's centre. pupil.scale is the startle (1 → 0.5), pupil.position the gaze, lid.scale.y the lid. The rig itself never grows

## fake 3D depth — the parallax of a face turn

A face turn is the illusion of shifting the features while the head outline stays put. For the remaining layers attached to the head (ears, horns, hair, hat), the shift is decided by
**whether they are in front or behind** — one number per layer, `rig.js DEPTH`: the shift = depth × the features' shift (the same multiplier on x·y; size does not change).
Layers are never grouped by meaning (hair, ears) and shifted as one mass — bangs (in front of the face) and back hair (behind the head) are both hair, yet their depths differ and they shift differently.
Sharing a value is just a tag (bangs and the scalp) and the movement is decided by the number. There is one group per layer (`item.parallax`, `animate.js`).

| Depth | Layer | Meaning |
| --- | --- | --- |
| 1 | The features (faceGroup) | The front of the face — the reference |
| 0.45 | Hat · horns | Above the head, toward the front |
| 0.2 | Dog and cat ears | On the crown — they stand off the scalp, not as far forward as a hat, so they go with the face, a little |
| 0.12 | Bangs · hair on the scalp | The forehead and crown — attached to the head, so only a little |
| 0 | The head outline (headGroup directly) | The skull axis — no shift |
| −0.12 | Back hair | **Behind** the head — the other way, by as much as the bangs |
| −0.4 | Side ears (humans, imps) | Beside and behind the head — as the head turns they swing out to the far side from the face |

When attaching a new layer to the head, settle on one depth in this table and write it as `depth` in `LAYERS` — never slot it into an existing group.

## What is baked and what is transformed

| Baked once (per individual) | Changed every frame |
| --- | --- |
| 13 layers (body, back hair, side ears, head, horns, hair on the scalp, dog/cat ears, hat, face, static eyes ×2 (one per eye), the front of the face, bangs) × 3 boil sets — one mesh per layer; the tail's bones and the limbs boil too, all three frames in one mesh each (drawRange) (two for the face and static eyes: fills and ink) | Toggling visible (static eyes per eye — for sleep, ^^, a wink and startle variants only that eye is switched off) |
| Limb pieces (front, back) | pivot.rotation.z, elbow.rotation.z (the eased target angle plus un-eased oscillation), front/back visible |
| The tail | Joint rotation.z · a bone's thick.scale.y (bristle — thickness only) |
| Brow and mouth rest/alt | visible |
| The eye rig | pupil.scale (startle — the pupil 1 → 0.5×), pupil.position (gaze), visible (open the open eye / shut the shut line / smile ^^) |
| — | The position/rotation/scale of group, headGroup, the depth groups and faceGroup — group.position.x carries the distance walked (walkX) and group.scale.x carries a quad's walking direction (facing ±1) |

**Never rebuild geometry per frame.** The only exceptions are the emoji (once per trigger) and regen (replacing an individual).

## Jitter phase (variant)

`drawCreature(spec, variant)` seeds its rng from `wobbleSeed ^ (variant × 0x9e3779b9)`.
The 3 variants share the composition and differ only in wobble. Brows, mouth, limbs and the tail have no variants (static jitter is enough).

## Pose and ink — two axes

`applyState(item, state, t, noise, { snap, boil })`.

| Axis | Toggle | Value | Meaning |
| --- | --- | --- | --- |
| **Pose** (the rig) | POSE MOTION/BIND, `B` | `scene.setBind` | With BIND, `BIND_STATE` instead of the clock (a biped T-pose; a quad's legs vertical and tail exactly as drawn), joint easing immediate (snap). The clock keeps running |
| **Ink** (the lines) | INK BOIL/STILL, `I` | `scene.setBoil` | With STILL, boil frame 0 is pinned |
| Forcing an action (debug) | The ACTION card | `scene.setAction` | Every biped keeps doing that action. IDLE is no action. `clock.force`. AUTO follows the schedule |

The bind pose is a state of the rig and the boil is a hand-drawn material. Being different axes, they switch separately —
you can have "bind, but the lines boiling" and "mid-motion, but the lines pinned".

## At birth

`buildCreature` stands the arms up in bind (T). The scene's `settle` immediately applies the clock's current state with no easing (snap)
and seats it at idle — otherwise the first frame shows the arms swinging down from T to idle.

## On regen

`regenerate(index)` lifts the existing individual out (`discard` — geometry only is thrown away; materials are shared) and stands a new one up in the same slot (`place` —
the forced action, position, render order block, `settle` and adding to the scene; `build` uses the same function). The new clock receives `clockNow` as its birth time. The species is kept.

## Where it commonly breaks

- Raise headGroup.position.y without lowering the head geometry by `-neckY` and it **goes up twice**. Same for the face — the face mesh takes `-faceCy` and faceGroup takes `faceCy - neckY`. Lower it by `-neckY` instead and the turn's axis drops to the neck and the squash goes wrong
- Switch the arm's front/back mid-rotation and it snaps → only within 0.35 rad of the reference angle
- Attach the clock's phase jitter straight onto `t` and it snaps after a regen → use birth-relative time
- Leave back-face culling on and the fills of clockwise paths disappear → `DoubleSide` (plus `forceSinglePass` — otherwise it draws twice)
- Feed vertex colors as sRGB and they come out grey → `srgbToLinear` (`color.js hexToRgb`)
- Dispose a shared material (`inkMaterial`) or change its `opacity` per frame and every mesh using that opacity breaks with it → remove with `disposeGroup`, and give a mesh that needs a fade its own via `sketchMesh(…, { own: true })` ([performance.md](performance.md))
