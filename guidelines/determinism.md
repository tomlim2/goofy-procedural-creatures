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

## How to check

`scripts/snapshot.mjs` verifies specs, geometry and motion trajectories in one pass
([../README.md](../README.md) § Scripts).
The geometry hashes are the per-layer sketches of one board (35 creatures), so they do not visit every slot
value — if you moved drawing code in a big way (splitting files, turning it into a table), use
`node scripts/drawdiff.mjs [ref]` to compare **every slot value × species × seed** against the previous tree
(git, HEAD by default), sketch by sketch. It has to come out at 0.

```bash
node scripts/snapshot.mjs before   # before the change
node scripts/snapshot.mjs after    # after — diff 0 means behaviour is unchanged
```

If you deliberately made a seed-breaking change (adding a slot, reordering rng calls), take `before` again to
refresh the baseline and write "seeds re-shuffled" in the commit message.
