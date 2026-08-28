# Motion rules

What to keep to when changing `src/motion/`. What exists is in [catalog.md](catalog.md).

## The bind pose and actions

**A character has no posture.** With no motion, a character is in the bind pose (the T-pose) — visible only in the BIND view.
Motion's base is **idle** (an A-pose with the arms slightly open, plus breathing, jitter, gaze and blinking), and **actions** stack on top —
arms up, waving hello, arms crossed, flapping the arms in delight. An action starts from idle and returns to idle.
There is no per-individual rest pose like "this one rests with its hands behind its back" — that is mixing motion into character.

## The base state (mode) is the floor — idle · sleep · walk · sit, and run to come

An individual is always in some base state (`stepMode` in `states.js`; `modes` and `modeHold` in `table.js`), and that decides the rig's floor pose and what rests.
Right now it is idle · sleep (quads) · walk (a walk that moves it) · sit (quads, sitting). Anything of the form "what is this individual doing right now", like running, is attached here as a state — not as an action (something done briefly and returned from).
The **content** of a state that has a pose (sleep, sit) — the leg angles, the body tilt — is solved from the rig dimensions: not a table of constants but computed from the individual's leg length and body length, as in
`sitPose(rig.body)` in `actions.js`. That is what lets a dachshund and a long-legged build sit with the same meaning. A build that cannot sit (null) stands through that state — it is never forced.
State transitions are blended with easing (0~1 values like sleepK and walkK) so nothing snaps, and they only ever pass **through idle**.

## Actions are layers — arm, body and quad schedule separately and overlap

Actions split into three layers: the arm layer (`ACTIONS`, bipeds) · the body layer (`BODY_ACTIONS` — hopping in place, shared) · the leg and tail layer (`QUAD_ACTIONS`, quads).
Each layer schedules separately (`stepArmAction`, `stepBodyAction`, `stepQuadAction`) and the results are laid over idle together —
it has to be able to wave while jumping. When making a new action, first settle which layer it is on. Something the whole body does (a jump, a bow, a spin) goes on the
body layer; something only the arms do goes on the arm layer. Never put it on one layer and freeze another.

## An action stacks over idle — it changes only what it decides

An action (`ACTIONS` in `actions.js`) writes down only the pose and **which arms** (one/both). Whatever it does not decide (the other arm, the body, the face) keeps
idling. "Waving is the hand's movement alone" — a wave decides one arm and the other stays down at idle.
Never make an action that freezes other parts along with it. The one condition that makes a one-arm action work is that **the base is idle** —
with a T-pose as the base, the other arm freezes horizontal and you get a mannequin twitching one arm.

## A limb pose is written as a target — a hand's or a foot's

Never hand-tune a table of joint angles. `ARM_POSES` records only **where the hand goes** (coordinates as a multiple of reach, or the rig anchors
hip, chin, brow, chestFar) and the side the elbow sticks out, and `solveArm` solves it onto that individual's rig (`armRig(spec)`)
with two-bone IK. That is why the same action means the same thing at different arm lengths and body sizes.
**The legs follow the same law, with the torso as master**: a grounded crouch is written as ONE scalar — how
far the body sinks (`state.bodyDrop`) — and the **scene** solves each knee off the displayed torso height every
frame (`animate.js` + `solveLeg`, the same two-bone core, `motionRig().leg`): move the torso and the legs bend
by themselves, the feet held to the floor. The clock writes no knee targets at all — mid-air the legs simply
hang, holding the standing rest bend. **A quad's four legs are two-bone too** and take the crouch the same way —
one description serves all four (they are the same length) and the hips come from `quadHips`. Only a float leg
stays angles: there is no leg to bend, just a foot.
When adding a new pose, run the hand or foot position back through FK and check by number that it reaches the target and stays above the floor (catalog § adding a new motion).

## Split into three kinds

Motion is split by **the character of the movement**, not by part. Not face motion and arm motion but rhythm, events and states.

| Kind | File | Character | rng | Shape |
| --- | --- | --- | --- | --- |
| **Rhythm** | `rhythm.js` | Oscillation that never stops. Sine waves and easing | init only (phase, period) | A deterministic function |
| **Events** | `events.js` | Starts at a scheduled time, runs briefly, ends. Then the next slot | init + step | `{ next, start }`, a progress curve k |
| **States** | `states.js` | You enter, stay a few seconds and come back. on/off | init + step | `{ next, until }` |

For a new motion, first settle "is this a rhythm, an event or a state?". That settles both the file and the shape.

- Breathing, sway, the tail swish, joint jitter → rhythm
- Blinking, the startle → events (hopping in place is a body action, and the emoji is its own layer — below)
- Wink, ^^, brows, mouth, head tilt, look, action scheduling, the base state (idle/sleep/walk) → states (an action's content is `actions.js`; when it happens is `states.js`).
  A removed state (half-lidded) keeps only `initSquint`, to hold the rng order — its step was deleted

## Easing — every curve eases in and out

Velocity has to be 0 at the start and the end. There is no curve in this lab that starts with a pop (`ease.js`).

| Use | Use this | Not this |
| --- | --- | --- |
| An envelope swelling once and returning (the dip, the stretch, a blink, a squash) | `bump(k)` — a raised cosine | `sin(πk)` (a starting slope of π) |
| n times (a nod ×2, a paw flick ×3) | `bumps(k, n)` — sin² | `\|sin(nπk)\|` (a kink at the bottom) |
| Attack, hold, release (the startle eye, the shiver, a tail flick) | `envelope(k, attack, release)` — smoothstepped at both ends | `sin(πk)^0.6`, a `(1 - k)` decay |
| A fade (the 0.35 s oscillation envelope, an emoji entering and leaving) | `ramp(x)` | a linear `min(1, x)` |
| A mode blend (sleeping 0.03 · sitting 0.05 · walking 0.06 · the facing 0.18 · the head tilt 0.07) | `approach(x, target, k)` — an exponential approach by k per 60-Hz frame, re-expressed per tick so the seconds hold at 24 | `x += (t - x) * k` per call (2.5× slower at 24 ticks than at 60 frames) |
| Following a target (the gaze w 0.2 · the face turn w 0.1 · joints w 0.18) | `damp({x, v}, target, w)` — critically damped second order, no overshoot; w per 60-Hz frame (0.1 ≈ 0.8 s), stepped one tick per call by the exact solution | an exponential lerp `x += (t - x) * 0.06` (the first frame is the fastest) |

The only exceptions are where the physics really is like that — a jump's airborne trajectory (the moment the feet kick off the ground is meant to pop) and oscillation itself (a sine wave). The startle shrinks the pupil in 0.1 s
(as an S-curve even so), holds 3.8 s and releases in 0.1 s.

## Whatever is tied to an expression rides that expression's clock

What is tied to a ^^ (happiness) — a dog's wag (`wagOnHappy`) and a cat's tail raise (`raise`) — is not scheduled separately but switched on for the duration of `isHappy`.
That way the tail responds whichever route the smile came by (the ♥ emoji, a ♥ startle, a ^^ blink), and since the expression lasts 3 s or more, so does the tail.
What is tied to anger (a cat's tail bristling) follows the anger envelope (`angry`) as it is, and what is tied to the startle (the pupil shrinking, the ☆♥ variants) follows the startle envelope (`startle`) as it is — keep two clocks and they drift apart.

## The emoji is not a motion — it is a triggered layer

♥ ! ? … are run by the channel in `motion/emoji.js`. A motion (an action, an event) neither draws nor holds the emoji; it only **triggers** it —
write `emoji: "heart"` on an action and it fires once at the start. An emoji's shape, length and curve are decided in the `EMOJI` table and nowhere else.
To add a new emoji, put the kind, length and curve in `EMOJI` and the shape in `scene/emoji.js`, and write which motion fires it on that motion.

## An interaction between individuals is the scene's, never a clock's

A clock is one individual and knows nothing of the others — anything that needs two positions (the high five)
is decided in `scene/` (`hifive.js`) and **commanded** to the clocks involved. A command must consume no rng
from the clock's stream and leave every schedule stepping underneath (the pattern `force` set: fixed rng
consumption whatever is overridden), so that a clock that never receives one — the snapshot, the frequency
counts — is byte-identical, and one that does returns to its own schedule on release. An interaction that needs
randomness of its own (when a pair fives) draws it from **its own `makeRng` stream seeded from the specs**,
never from `Math.random` and never from a clock. Never give a clock a reference to another clock, and never put
pair logic in `motion/` ([catalog.md](catalog.md) § the high five).

## Species differences live only in table.js

The only thing that differs per species is the **parameters**. Put the intervals, amplitudes and periods in `MOTION[species]`, with `null` for species without it.
Never put a branch like `if (species === "cat")` in `rhythm/events/states`.

## The rng order is the seed

The 29 init steps and the update order in `index.js` are fixed. A new motion goes **at the end of its block**.
Insert it in the middle and every schedule after it changes, so every existing seed's motion becomes different.

A rhythm's step uses no rng. Only events' and states' steps use it (for the next slot).

## Birth-relative time

Every schedule is relative to `birth`. Set them in absolute time and an individual born from a regen finds every schedule
already in the past, and it runs away, regenerating every frame.

## Sizes come from measurement

From comparing against the reference (reference/video-notes.md 33~36): limbs are joint jitter + following the body by default and
big joint events are rare and small. Settle a new motion's amplitude and interval by comparing frames, not by eye.

## Count the firing frequency

If you changed it, count how many ticks it fires over a 60 s simulation — at the board's tick, 24 a second ([../determinism.md](../determinism.md) § the tick). Never judge by eye alone.

```bash
node --input-type=module -e "
Promise.all([import('./src/motion/index.js'), import('./src/character/index.js')]).then(([{makeClock}, {makeCreature, armRig}]) => {
  const c = makeClock(42, 0, 'human', armRig(makeCreature(42, 'human')));
  let n = 0;
  for (let f = 0; f < 1440; f++) { const s = c.update(f / 24); if (s.YOUR_STATE) n++; }
  console.log(n, 'ticks / 1440');
});"
```

## Refactor with the snapshot

`node scripts/snapshot.mjs before` → change it → `node scripts/snapshot.mjs after`. It has to be diff 0.
The snapshot's motion trajectories are 4 species × 60 s, so rare branches (startle variants, the tail raise, a walk out and back) may go unvisited — for a refactor that
moves the order in `motion/index.js update()`, check by eye as well that no rng call has moved inside a condition. (On the drawing side, `scripts/drawdiff.mjs` compares every slot value.)
