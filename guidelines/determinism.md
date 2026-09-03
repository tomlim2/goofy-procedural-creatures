# Rolls and files

**A creature is its JSON.** The spec — species, parts, palette, proportions — is the truth of a character. It
is what the board draws, what the editor edits, what SAVE writes and what OPEN reads back
(`src/character/file.js`). A roll is the generator's input: `makeCreature(roll, species)` rolls a spec from
it, and the spec remembers the roll it came from as provenance, nothing more. A saved creature never needs
its roll again.

A **board** is a cast of specs. `boardCells(baseRoll, …)` grows a default cast from one roll — a fresh one
on every load, and what every gate below stands a board up with — but that roll only **fills** the cells.
What a hand does to a cell afterwards (REDRAW, BACK, a file opened into it) lives in the cast, and the cast
is saved as a file. **No screen shows a roll or takes one.** The address carries a screen's controls and
never a board; a NEW button rolls another; a file remembers. Rolls live in the generator and in the node
gates, where a repeatable sample is the point.

## What a roll promises

- **Within one version of the code, the same roll gives the same spec.** Every roll on the generation path
  comes from `makeRng(roll)`. This is what lets a roll fill a board, and what lets a gate stand up the same
  sample twice.
- **Across versions it promises nothing.** Change the generator — add a slot, reorder a roll, add a
  constraint — and a roll rolls something else. That is allowed, and it needs no accounting, because nothing
  that mattered is stored as a roll. Anything worth keeping is a file.

This used to be the one absolute rule of this lab — *the same roll always makes the same character* — with a
page of rules on the order of rng calls, reshuffle percentages measured per change, and "rolls re-shuffled"
written into commits. All of it was paid to protect creatures that were only ever stored as rolls. They are
stored as JSON now, so the contract is lowered to the one thing the tools still need: repeatability within a
run.

## Forbidden on the generation path

- `Math.random()` — all randomness comes from `makeRng(roll)`. `randomRoll()` in `ui.js` is the one
  exception, and it only fires when a button is pressed
- `Date.now()` and `performance.now()` — time is used only in `motion/`
- Depending on object key iteration order — slot iteration follows the declaration order of `SLOTS`

## Keep a change where it was made

`makeRng` is a state machine: change the number or order of calls before a roll and that roll changes. That
breaks no promise any more, but it makes a change unreadable — adding a hair value that also moves faces,
bodies and palettes on some rolls is a change nobody can judge. So the generator is written so a change lands
where it was made, and `drawdiff` per slot (below) is the test: a change to one slot moves that slot and
nothing else.

- A new slot goes on the end of `LATE_SLOTS`, drawn after everything else, so only its own value is new
  (`legLength`, `build`, `tailSkin`, `tailLength` and `mouthPos` sit there)
- Changing only the weights in `DEFAULT_BIAS` moves what is picked and nothing after it — the call count is
  the same
- `applyConstraints` consumes **no rng at all**: every decision in it is a fixed overwrite or a
  `settled(roll, n)` hash with an `n` no other call site uses, and it does not take the rng as a parameter,
  so a conditional roll cannot creep back in. When it did roll — the hat-vs-hair rule replaced an unusable
  hairstyle with `rng.pick(short)` only when the drawn hair was not in the list — editing either pool flipped
  the call count for a handful of rolls, and those individuals came out with a different face, body and
  palette, not a different hairstyle (measured: 5 creatures in 600 for one added hair value, every one of
  them flipped at that line). Hashed off the roll instead, the same edit moved `parts.hair` alone.
  **When you add a constraint, use a fixed overwrite, `settled(roll, n)`, or `forbid` in `species.js`.
  Never a roll**

```js
// Good — the call count is the same whatever the condition
if (parts.headgear === "helmet") parts.hair = "none";

// Bad — rng consumption varies with the condition, so every later value shifts
while (!valid(parts)) parts = rollAgain(rng);
```

## Drawing randomness is drawn separately

`character/draw/` builds its own rng from `spec.proportions.`hand``. The generation rng is never carried
on into drawing. That is what lets you change the drawing without changing the combinations.

## The tick — motion is sampled 24 times a second

The loop (`ui.js runLoop`) does not hand the motion the display's clock. It counts **ticks** — `TICK_FPS` 24 a
second (`src/tick.js`) — and calls `update(n / 24)` only when the tick changes; rAF frames in between do nothing.
So the pose at tick n is the same on every machine, 60 Hz or 120 Hz, and the roll's determinism reaches the
motion. The per-step filters (`motion/ease.js damp`) advance one tick per call by the exact solution of the
critically damped system, so their settling times are seconds, not frames; everything else in `motion/` is a
function of t. A stall skips ticks rather than catching up — time is the truth, not the step count. The snapshot's
motion trajectories and the frequency count ([motion/rules.md](motion/rules.md)) step at the same tick.

## How to check

Every gate below stands a board up by roll, through `makeGrid(roll, …)` = `makeBoard(boardCells(roll, …))`:
a whole board from one number is the cheapest way to get a large, repeatable sample. Each gate compares the
working tree against a reference **of the same generator** — the tree before your change, or HEAD — so what
it measures is whether the change did what it says, not whether old rolls survived.

`scripts/snapshot.mjs` verifies specs, geometry and motion trajectories in one pass
([../README.md](../README.md) § Scripts). A refactor comes out at 0. A deliberate change to the generator
will not, and the commit says what moved and why.
The geometry hashes are the per-layer sketches of one board (35 creatures), so they do not visit every slot
value — if you moved drawing code in a big way (splitting files, turning it into a table), use
`node scripts/drawdiff.mjs [ref]` to compare **every slot value × species × roll** against the previous tree
(git, HEAD by default), sketch by sketch. It has to come out at 0.

A slot that changes the spec rather than drawing a shape of its own needs a line in `drawdiff` or it is not
really being compared. `drawdiff` swaps a value onto an **already-built spec** — that is enough for a part that
draws itself, but `ghost` collapses the palette, breaks every line and empties the eyes, and all three are
decided in `makeCreature`. Without re-deriving them both sides draw the plain creature and the slot comes out
identical however much moved inside it. `ghosted()` in the script re-applies the transform with each side's own
`ghostPalette` / `ghostOutline`, off the pre-ghost palette the spec carries as `palette0` — the same thing the
parts gallery does, and for the same reason. If you add another slot of that kind, extend it.

A **jointed limb is three sketches**, and `drawdiff` used to hash only the first. An arm or a leg hands over the
upper bone (`sketch`), the lower one (`lowerSketch` — a forearm, a shin) and the foot on its own ankle
(`footSketch`), plus `knee`, which is not geometry but is what the scene folds the leg by. Comparing the upper
bone alone left the gate blind to two thirds of every limb: a change that moved every toe on the board came out
at **0 differences**. All three are compared now. The lesson generalises — when a part returns more than one
sketch, check that the gate hashes all of them.

`drawdiff` compares sketches — the triangles a part hands to the GPU — and is blind to everything after them: the
scene (a mesh's opacity, the parallax depths, render order) and the shaders (the paper, the sheet pass). For those,
`/pixeldiff.html?roll=…&boards=4` renders the same boards with the working tree and with a base tree on the same
GPU and counts the pixels that differ per creature (`serve.mjs [port] [ref]` serves the ref under `/base/`, HEAD by
default). Bind pose, boil pinned, so the only variable is the code. A refactor has to come out at **0 — identical**;
a change shows exactly where the picture moved (the DIFF view paints every differing pixel red). It runs in the
browser — any session with a server started inside the checkout can run it; there is no headless form.

```bash
node scripts/snapshot.mjs before   # before the change
node scripts/snapshot.mjs after    # after — diff 0 means behaviour is unchanged
```

After a deliberate change to the generator, take `before` again so the next refactor has a baseline.
