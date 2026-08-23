# Character rules

What to keep to when changing `src/character/`. What exists is in [types.md](types.md) and [parts.md](parts.md).

Order: **principles** (separating form from motion, where species restrictions live) → **procedure** (adding a part, a slot, an archetype; drawing) → **verification** (weights, census).

## Never mix form and motion

A slot holds **form (what it looks like)** only. **Pose and action (what it does)** are states in `motion/`.
Mix the two into one slot and you get "an individual with its hands behind its back has them there forever".

| | Where | Example |
| --- | --- | --- |
| Form | `SLOTS.arms`, `SLOTS.legs`, `SLOTS.armLength` | stick / sleeve / stubby / mitten, boots / tiptoe, medium / long |
| The bind pose | A code constant (`BIND_ARM` = the T-pose in `draw/limbs.js`) | When there is no motion. A character has no "posture" |
| The rig description | `armRig(spec)` in `draw/limbs.js` | Shoulder position, arm lengths, body anchors (waist, chin, brow…). The static dimensions character gives motion — used to solve an action onto this individual by IK |
| idle · actions | `motion/actions.js` (the content), `motion/table.js` armActions (per-species frequency) | idle (the A-pose) is the base, with arms up, waving hello, arms crossed, hands on hips, a hand on the chin, a salute, hands behind the back, flapping… on top. Only the arms the action decides change |

The same principle applies to the eyes: the eye **kind** (ring/dot/slit) is a slot, while blinking, startle
(the pupil shrinking), winking and ^^ are clock states. When adding a new part, first ask "is this an
appearance or a behaviour?".

## A dimension slot is not a scale

`armLength`, `legLength` and `build` are **length and build** slots, independent of form. Change the value and
the feet, hands, line thickness and boot height stay as they are; **only the length and width** change — short
legs mean the body settles near the floor, not that the leg drawing was shrunk.
Derive what is derivable: the leg stance (how far they open) and the shoulder position are set by `build` — a
wide body carries a wide stance. Never make "open legs" a leg form.

## Species restrictions live in species.js

Species restrictions like "humans do not have X" go in **the single place, `species.js`**. There are two fields.

| Field | Meaning | Effect |
| --- | --- | --- |
| `forbid[slot] = { value: replacement }` | If this value comes up for this slot, swap it | `applyConstraints` reads it **first of all** and overwrites deterministically. The archetype's disposition (a scholar's dot eyes and so on) survives |
| `bias[slot]` | The weights for this slot | Takes precedence over the archetype bias — **the species dominates the whole slot**. Only for slots the species defines, like dog ears or a cat tail |
| `identity` | What the species has to hold to (skeleton, horns, eyes, arms, tail, head color) | `scripts/census.mjs` checks it. A violation is a bug |

Use forbid to block a single value; use bias only when the species takes the whole slot. Never hardcode a
species name in spec.js or draw/ (a species branch in draw/ is only for when the **way of drawing** differs — a
dog's muzzle, a cat's crown ears).

## Change three files, in order

Adding one part means touching three places. Keep to the order.

1. **`src/character/vocabulary/slots.js`** — put the name in `SLOTS`. The name has to match the branch key in `draw/` exactly
2. **`src/character/vocabulary/`** — if needed, put weights in `DEFAULT_BIAS` in `slots.js` and in `bias` in `archetypes.js` / `species.js`
3. **`src/character/draw/`** — add the branch in the file the part belongs to: outline and ears `head.js` · hair `hair.js` (one function in the `HAIR` table) ·
   hats and horns `headgear.js` · eyes, eyewear, nose and cheeks `face.js` · the mouth `mouth.js` (one function in the `MOUTH` table — position and width come from `mouthPlacement`) · the body `body.js` · limbs and tail `limbs.js`.
   A mouth also needs a place in the alt, angry and ^^ tables in `faceStates.js`

`spec.js` is usually left alone. Only put something in `applyConstraints` when a new combination clashes with another part.

## Making a new slot is a different matter

Adding an option to an existing slot and creating a slot itself carry different weight.
A new slot goes at **the end** of `SLOTS` in `slots.js` and is appended to `LATE_SLOTS` too — `makeCreature`
draws it at the very end, so existing boards (parts, colors, proportions) are preserved.
Insert it into the middle of `SLOTS` and **every existing seed breaks.**
Read [../determinism.md](../determinism.md) first.

## A new archetype

If six do not feel like enough, adding one is fine. But an archetype is a **disposition**, not a character.

- The only slots that go into `bias` are the ones that really define that disposition. Write them all down and it stops being an archetype and becomes a preset
- Start `weight` at 2~3. Let one archetype take more than a third of the grid and the board goes monotone

## What a drawing function has to keep to

- **Never leave the cell.** In local coordinates y runs from 0 (the floor) to about 1.05 (the crown) and x stays within ±0.45. `layout()` clips a biped's head top at
  `MAX_HEAD_TOP` (1.05) — so a huge head plus long legs plus a big body never invades the row above. Hair and a hat go above that, up to the cell ceiling of 1.19
- **Draw whatever touches the floor all the way to the floor.** Draw the legs short while leaving the feet at y=0 and only the feet float.
  Leg length comes from `hipY` — the same goes for a thick, short leg like `stub`
- **Hair has volume but cannot cover the eyes.** Whatever comes down the front (|x| < 0.8·rx — bangs, the hood type, a hat) stops at `browLine(spec, box)` — the top edge of the eyes
  (including eyewear and goggle rims) — while the sides may come down below the ear (cy − 0.45·ry) and cover it. A hair cap's arc goes to depth 0.62 (ear height) —
  the spread at the side ends does not reach the eyes (x ±0.4·rx). Never compute the brow line separately
- **Never make parts avoid each other on their own.** Overlaps are blocked at the combination stage, in `applyConstraints`

## A face part has to be visible in every state

The face moves — a startle halves the pupil, sleep covers it with a lid, the mouth and brows switch to their alt
sets, and it turns in 8 directions. "Drawn" and "visible" are different. There are three ways to disappear:
**width 0** (a short stroke eaten by the end taper), **on the same color** (light face ink over a white, a black
nose over a black pupil, black brows over a black hat), and **covered** (a widened white, the muzzle or an open
mouth laid on top). The rules:

- A dot mouth, a dot nose and a vertical pupil are **open lines that came out short**. The pencil keeps the ends of anything shorter than `PENCIL.stub` and sheds nothing there, so they stay their own length ([../drawing.md](../drawing.md) § the outline). `Sketch.stroke` draws nothing shorter than its re-sample step — its taper takes both ends to nothing — so anything short handed to it directly (an emoji's glyph, the medium page's dot eyes) has to name a finer `step`
- The nose, mouth and cheeks sit **below the eye's (white's) lower edge** (`eyeFloor` — only when the eye actually reaches that x, as with a big eye or a cyclops). A startle does not grow the eye, only shrinks the pupil, so the white's size is always unchanged
- A dog's mouth follows not the face proportion but **above the muzzle, below the nose** (`muzzleGeometry`) — overlapping the nose mass makes it invisible
- An open mouth's height is proportional to the head and **ends below the nose**. Brows go 1.9× the eye above it (1.35× on a cyclops) but **inside the head** (headCy + 0.84·ry)
- The ink inside the eye rig (the ^^ arch, the sleep lid arch) is `faceInk` — draw black on an imp's ink-black head and it may as well not be there
- **Two eyes overlap only slightly, and where they do the larger is in front.** `eyeGeometry` opens the centre distance to at least 70% of the sum of the radii (shrinking both eyes if there is no room), and where they overlap a per-eye render order block (back eye 3.0~3.35, front eye 3.5~3.85, `scene/rig.js`) has the larger eye cover the smaller one's rim and pupil —
  no crossing outlines are left. Static eyes have a layer per eye, but **the two layers share the same render order** (both fills 2.3, ink 2.4) — ink always comes after fills, so
  the back eye's outline rises above the front eye's white. Which is why static eyes with a white (hollow, the lidded set, half, side, slit) draw **their outline and lid line into the fills sketch (`fills`)** —
  that is what lets the front eye's white cover the back eye's outline. `census --check` catches an overlap beyond 70%
- **An eye that one stroke defines is left-right symmetric.** For sleepy, line, happy, squeeze, droop, cross, half and side, `eyeGeometry` sets the size and height skews (`eyeSizeSkew`, `eyeHeightSkew`) to 0 — one lid line or arch defines the eye, and if only one side is smaller or higher it reads as a mistake rather than "a smaller eye". Mismatched eyes are only for eyes an outline defines (ring, wide, oval, hollow, the lidded set, slit) (`layout.js LINE_EYES`)
- **Face ink is decided by the head color's luminance.** At head luminance < 120 (an imp's ink-black, a dog or cat with **black-ish fur**, or a blue, green or red-brown color accent landed on the skin) the features are drawn in light ink (`faceInk` #e9e3d5) instead of black — a black line on a deep color has no contrast and the eyes and mouth do not read. A dog's mouth is on a light muzzle, so it stays black.
  **Body markings follow the same rule** but are decided by the body color (`patternOf` in `draw/body.js` — so stripes and spots on a black-furred or imp body are not lost)
- **A mark takes face ink; an object keeps its own color.** An imp's light `faceInk` is only for lines and dots (marks like the eyes, mouth, brows and whiskers). Things that are objects — an eyepatch, a hat, a lens — keep their own color regardless of species (a patch is black), and on an ink-black head a light rim holds the outline only. Fill it with light ink and it becomes a white mass and reads as a mistake (which is what the eyepatch did)
- **A closed eye is still an eye — redraw it, do not cover it.** When an eye closes (blink, sleep, ^^, wink, anger) the open eye is **switched off** and the shut line (`shut`), smile arch (`smile`) or fierce eye (`angry`) is drawn in its place.
  Never hide it with a skin-colored cover (a cover reads as a patch or a wound). There is no half-closed intermediate stage — open or shut. Static eyes are the same
  (`staticLids`; the static eye layer is switched off). The audit counts it not as "the pupil may be invisible" but as "a shut line (or smile arch) has to be visible in its place"
- **Only that eye is redrawn — static eyes are one layer per eye.** A wink changes one side only. With two static eyes in one mesh, the moment you switch the frame off to turn the winking eye into an arch, the other eye leaves a blank face (the bug where a cat's other eye vanished on a wink). So `drawCreature` bakes static eyes into two separate layers, `staticEyeBack` (the smaller eye) and
  `staticEyeFront` (the larger), and `animate` switches off **only that eye's layer** for sleep, ^^ and a wink (that side). The audit counts per eye too — the other static eye has to be
  visible through a wink (`eyes0`, `eyes1`)
- **A quad's tail is counted too.** The audit toggles the tail over the whole cell at rest (BIND — the skeleton as drawn, behind the body) and raised (`tailRaise` 1 —
  above the body); under 0.7× the head width in pixels — scaled by the length slot (long 1 · medium 0.7 · short 0.45) and a stub's 0.3 — it is hidden. Raised, that is a violation (a raised tail is above the body and head and has to show); at rest it is
  written down as information — the tail is drawn behind the body by design ([parts.md](parts.md) § tail), and the count tells how many skeletons and skins the board
  actually shows
- If you changed it, count it with `/audit.html`. It has to be 0 on one board. What is left is only low contrast of the "black brows turning up over black hair" kind — that is an overlap, not a covering, so let it go

## Weights are settled by numbers, not by eye

There is a trap where the number of options becomes the probability. Add items to a slot and the probability of
`none` automatically drops — on an even draw, `eyewear` (1 none out of 5) ends up **80% wearing something**.

So slots the archetype does not touch get weights through `DEFAULT_BIAS` too.
If you changed a part, always count the distribution — `node scripts/census.mjs --slot <slot>` (below, § distribution is read with census).

The baseline:

- In a slot that has `none`, `none` is **25~45%**. Lower and the screen is messy; higher and it is bland
- No option should come up **fewer than 5 times in 200 creatures**. That may as well not exist
- If a pair of creatures in 200 share the same part combination, that is a sign there are not enough slots

## Distribution is read with census

```bash
node scripts/census.mjs              # the species × slot distribution table plus identity violations
node scripts/census.mjs --slot hair  # one slot only
node scripts/census.mjs --check      # violations only (exit 1)
```

A dead value (0% on every species) is a candidate for a bias adjustment. The common cause: if **every**
archetype has a bias on that slot, `DEFAULT_BIAS` is never used for it — and any value in no archetype's bias
comes out at 0%. Which is why hair shares mohawk, scribble and curly out across the archetypes.

The browser's SPECIES card lets you put one species alone on a 9×6. Seven creatures in one row cannot tell you a
color or part distribution.

## Form is read with the gallery

`gallery.html?slot=<slot>&species=<species>&seed=<seed>` — draws every value of one slot on **the same
individual**, side by side (species and seed fixed, only the slot value changing). When you have drawn a new
part, look at it here next to its neighbouring values.
It also draws values a species forbids, which never appear on a real board — this is a catalog, not a draw. BIND
is the default (judging form); B for motion.

## If you moved drawing code, read it with drawdiff

`node scripts/drawdiff.mjs [ref]` — hashes the working tree's drawing (11 layers × 2 boil sets, limbs, tail
bones, brow/mouth states) sketch by sketch against a git ref (HEAD by default), over
**every slot value × species × seed**. A refactor that splits files or turns branches into a table is not done
until this is 0 — the gallery is the eye and this is the number. In a commit that **changes** form, a difference
is correct (check the list to see which slot values changed).
