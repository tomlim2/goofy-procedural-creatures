# The seed contract

**The same seed always makes the same board.** This is the one absolute rule of this lab.
Recording a good result as a seed and calling it back later is the reason this tool exists.

## Forbidden

- Never call `Math.random()` anywhere on the generation path. All randomness comes from `makeRng(seed)`
- Never read `Date.now()` or `performance.now()` on the generation path. Time is used only in `motion/`
- Never write code that depends on object key iteration order. Slot iteration follows the declaration order
  of `SLOTS`

## The order of rng calls *is* the seed

`makeRng` is a state machine. Change the number or order of calls and **every value after it changes.**

```js
// Change it this way and every existing seed's result becomes different
const parts = {};
for (const slot of Object.keys(SLOTS)) parts[slot] = pickSlot(rng, archetype, slot);
```

So all of the following **break existing seeds**. You may do them, but do them knowingly.

- Reordering `SLOTS`, or inserting a slot **in the middle** (`character/vocabulary/slots.js`)
- Changing the order in which rng is called inside `makeCreature`
- Adding or removing an `rng.chance()` call in `applyConstraints`

Conversely, the following **do not break seeds.**

- Changing only the weight numbers (adjusting values in `DEFAULT_BIAS`) — the result differs but the call
  count is the same
- Appending a new slot to the end of `LATE_SLOTS` — it is drawn **after** `makeCreature` has drawn all the
  parts, constraints, colors and proportions, so existing boards stay as they are and only the new slot's
  value is added (`legLength`, `build`, `tailSkin`, `tailLength` and `mouthPos` sit here). The order of
  `LATE_SLOTS` is the order they were added
- Changing only `character/draw/`. Drawing consumes the spec; it does not consume rng
- Changing the width and wobble constants in `stroke.js`

If you made a seed-breaking change, say so in the commit message.

## Constraints overwrite; they never re-draw

When a combination does not work in `applyConstraints`, **do not re-draw the whole thing.** Overwrite
deterministically.

```js
// Good — the call count is predictable regardless of the condition
if (parts.headgear === "helmet") parts.hair = "none";

// Bad — rng consumption varies with the condition, so every later value shifts
while (!valid(parts)) parts = rollAgain(rng);
```

Calling `rng.chance()` conditionally creates the same problem — call it only when the condition is true and
every value after it diverges. There are a few such places in `applyConstraints` (antennae→ears,
eyewear→brows) and they are frozen as they are for now. When adding a new one, either draw it outside the
condition first (fixing the call count) or, if it is a species restriction, use `forbid` in `species.js`
(a deterministic overwrite with no rng).

## Drawing randomness is drawn separately

`character/draw/` builds its own rng from `spec.proportions.wobbleSeed`. The generation rng is never carried
on into drawing. That is what lets you change the drawing without changing the combinations.

## The tick — motion is sampled 24 times a second

The loop (`ui.js runLoop`) does not hand the motion the display's clock. It counts **ticks** — `TICK_FPS` 24 a
second (`src/tick.js`) — and calls `update(n / 24)` only when the tick changes; rAF frames in between do nothing.
So the pose at tick n is the same on every machine, 60 Hz or 120 Hz, and the seed's determinism reaches the
motion. The per-step filters (`motion/ease.js damp`) advance one tick per call by the exact solution of the
critically damped system, so their settling times are seconds, not frames; everything else in `motion/` is a
function of t. A stall skips ticks rather than catching up — time is the truth, not the step count. The snapshot's
motion trajectories and the frequency count ([motion/rules.md](motion/rules.md)) step at the same tick.

## How to check

`scripts/snapshot.mjs` verifies specs, geometry and motion trajectories in one pass
([../README.md](../README.md) § Scripts).
The geometry hashes are the per-layer sketches of one board (35 creatures), so they do not visit every slot
value — if you moved drawing code in a big way (splitting files, turning it into a table), use
`node scripts/drawdiff.mjs [ref]` to compare **every slot value × species × seed** against the previous tree
(git, HEAD by default), sketch by sketch. It has to come out at 0.

`drawdiff` compares sketches — the triangles a part hands to the GPU — and is blind to everything after them: the
scene (a mesh's opacity, the parallax depths, render order) and the shaders (the paper, the sheet pass). For those,
`/pixeldiff.html?seed=…&boards=4` renders the same boards with the working tree and with a base tree on the same
GPU and counts the pixels that differ per creature (`serve.mjs [port] [ref]` serves the ref under `/base/`, HEAD by
default). Bind pose, boil pinned, so the only variable is the code. A refactor has to come out at **0 — identical**;
a change shows exactly where the picture moved (the DIFF view paints every differing pixel red). It runs in the
browser — any session with a server started inside the checkout can run it; there is no headless form.

```bash
node scripts/snapshot.mjs before   # before the change
node scripts/snapshot.mjs after    # after — diff 0 means behaviour is unchanged
```

If you deliberately made a seed-breaking change (adding a slot, reordering rng calls), take `before` again to
refresh the baseline and write "seeds re-shuffled" in the commit message.
