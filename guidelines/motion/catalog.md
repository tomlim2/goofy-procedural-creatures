# Motion catalog

> Basis: `src/motion/`. When the code changes, fix this document in the same commit.

`src/motion/`. `table.js` holds the per-species parameters; `rhythm.js` (standing oscillation), `events.js` (intermittent) and `states.js` (held states, action scheduling) are
the body of the motion; `actions.js` holds the content of idle and the actions (three layers: arm, body, quad); `emoji.js` is the emoji layer; and `index.js` assembles it all
in a fixed rng order. The rules are in [rules.md](rules.md).
Each individual has one clock, and every schedule is **relative to the birth time**.
Every frame, `update(t)` returns a state object and `scene/animate.js` applies it to the rig.

**Principles** (measured off the reference, video-notes 26~36):
- Movement is **smooth**, with easing; only the lines (the boil) are redrawn, once every 1.5~2 s
- The torso has no skeleton rig. The liveliness is the face rig + the boil + fine movement subordinate to the body
- Limbs are joint jitter + following the body by default. Big joint events are **rare and small**
- Each species has a different dominant motion (the `MOTION` table)

## Where each kind lives

| Kind | File | Motions |
| --- | --- | --- |
| Rhythm | `rhythm.js` | Breathing · sway · rocking · head roll · jelly · tail swish · gaze following · face-turn following · arm pendulum · joint jitter |
| Easing | `ease.js` | The shape of every curve — `bump`, `bumps`, `envelope`, `ramp` (envelopes) · `damp` (critically damped follow). Velocity 0 at the start and end ([rules.md](rules.md) § easing) |
| Events | `events.js` | Blink · gaze dart · startle · nod · sniff dip · stretch · shiver · paw flick · step in place · tail flick · emoji schedule · regen |
| Emoji | `emoji.js` | ♥ ! ? … above the head — not a motion but **a separately triggered animation layer**. A curve per kind (float, pop, wobble, mumble), one channel. Motions' `emoji` triggers and the idle schedule fire into it |
| States | `states.js` | **The base state (mode)** idle, sleep, walk, sit · the ^^ happy eye · wink · head tilt · brow state · mouth state · look (a held face turn) · action scheduling (arm, body and quad layers each — when and which action) |
| Actions | `actions.js` | **idle** (the base — a biped A-pose, a quad's standing stance) and the **content** of the actions, in three layers: arm `ACTIONS` (hand target, elbow direction, oscillation, which arm, IK) · body `BODY_ACTIONS` (hopping in place — shared) · quad `QUAD_ACTIONS` (one leg or the tail — angle, oscillation). The layers overlap. The sitting pose `sitPose(rig.body)` (the content of the sit base state — solved from the rig dimensions) |

## The state object

What `clock.update(t)` returns, and where the scene applies it.

| State | Type | Applied to |
| --- | --- | --- |
| breathe | −1~1 | group.scale (x 0.006, y 0.011) |
| sway | rad | group.rotation.z — side-to-side lean about the feet |
| rock | multiplier | group.scale.y — the illusion of front-to-back rocking |
| hopY | units | group.position.y |
| squashX / squashY | multiplier | group.scale — the jump's squash and stretch |
| stretchX | multiplier | group.scale.x — the stretch |
| jellyX / jellyY | multiplier | group.scale in anti-phase — the jelly wobble |
| shiverX | units | group.position.x — the shiver |
| headAngle | rad | headGroup.rotation.z (the tilt plus the roll) |
| headBob | units | headGroup.position.y (the nod plus the dip) |
| faceTurn | [x, y] −1~1 | faceGroup.position x/y plus a scale squash — the features shift as one, faking a turned head (x 0.26·headRx, y 0.16·headRy) |
| gaze | [x, y] | pupil.position |
| lid | 0~1 | lid.scale.y |
| startle | 0~1 | eyeRig.pupil.scale = 1 − 0.5·startle — the startle. The eye is unchanged; **only the pupil** shrinks |
| eyeFx | { kind: "star"·"heart", k } or null | The startle variant — the eyes (the static eye frame, the eye rig) are switched off and a ☆/♥ glyph is drawn in their place (rig.eyeFx), popping in and out by k |
| happy | bool | The eyes close into a ^^ arch |
| winkSide | −1/0/1 | lid 1 on one side only |
| browAlt / mouthAlt | bool | Toggles the brow and mouth state sets |
| arms | {−1, 1} → {shoulder, elbow, behind, oscShoulder, oscElbow} | The arm joints' world angles (rotation.z). idle or an action solved by IK, plus the pendulum, jump and jitter. osc is oscillation laid on without easing (waving, flapping) |
| legOffset | [4] rad | Leg pivot rotation (eased). On a quad the idle standing stance (legStance) is the base, with flicks, steps and actions on top |
| legOsc | [4] rad | Oscillation laid on the legs without easing (a paw shake, scratching) |
| bodyDrop | units ≥ 0 | **The torso is the crouch's master** — how far the body sinks below standing (the jump's and the five's crouches). The scene eases this one scalar and **solves the knees off the displayed height every frame** (animate.js + solveLeg): move the torso and the legs bend by themselves, the feet held to the floor by construction |
| action / actionSide | The action name of the arm layer (biped) or the leg and tail layer (quad), or null / the active arm's side or the leg index | For debugging and statistics. The scene only looks at arms and legOffset |
| bodyAction | The body layer's action name, or null | "jump" while hopping in place. hopY and squash are its curve |
| mode / sleep / walk / sit | "idle" · "sleep" · "walk" · "sit" / 0~1 / 0~1 / 0~1 | The base state and how far asleep, walking or sitting it is (eased). All of it is already blended into legOffset, hopY, sway, arms and so on. The scene only uses sleep, to turn on the sleep lid (the static eye cover) |
| bodyTilt | rad | bodyGroup.rotation.z — the body tilt of a quad sit (negative = the back goes down), about **the front legs' root** (item.bodyPivot). sitPose(rig.body).tilt × sit |
| walkX / facing | cells / ±1 | group.position.x (the distance moved from home) / group.scale.x (a quad flipping to face its walking direction; a biped is always 1) |
| tailAngle / tailTip / tailPuff / tailRaise / tailRaisePose | rad / rad / 0~1 / 0~1 / [rad × bones] or null | The root bone's rotation / the tip bone's rotation (relative to the root) / the bone thickness scale (1 + 0.6·puff, perpendicular to the spine) / blending each joint from rest toward its raise target — vertical, or `tailRaisePose` (a ♥'s question mark: joint world angles) (scene/animate.js) |
| tailArch / tailPose | 0~1 / [rad × bones] or null | Blending the idle pose (the cat arch) — each joint from rest to the tailPose world angle. Together with the raise it never passes 1 (the remainder is the skeleton) |
| emoji | {kind, k, dy, scale, rot, opacity} or null | The glyph above the head — a frame from the emoji channel. The scene applies it as-is |
| regen | bool | Replaces the individual when LIVE |

## The face

| Motion | Period / duration | Species differences | Note |
| --- | --- | --- | --- |
| Blink | 1.8~6.5 s, 0.13 s | shared | 22% are two in a row. 22% close into a ^^, and that ^^ is **held for 3.2 s** (there is no face that stops smiling halfway). **Redrawn, not covered** — two cuts, the open eye ↔ the shut line (lid > 0.5), with no half-closed middle |
| Gaze movement | 1.4~5 s | shared | Critically damped follow to the target (w 0.2 ≈ 0.4 s) |
| **Face turn** (side to side, up and down) | Follows the gaze, critically damped w 0.1 (≈ 0.8 s). Layers attached to the head shift by their **depth** (fake 3D, [../rig.md](../rig.md) § fake 3D depth): hat and horns 45%, bangs and hair on the scalp 12%, dog and cat ears 20%, back hair −12% (opposite), side ears −40% (opposite) — the same multiplier on x·y, position only, size unchanged | yaw multiplier human 0.5 / pup 0.7 / cat 0.8 / imp 0.6 (up and down are ×0.6) | Every feature (eyes, nose, mouth, brows, eyewear, cheeks, whiskers, muzzle) shifts within the head and squashes slightly. The pupils go first and the face comes after |
| **Look** (a held face turn) | Interval human 6~16 / pup 4~12 / cat 8~20 / imp 5~14 s, held 1~5 s | Amplitude [x, y] human [1, 0.8] / pup [1, 1] / cat [0.9, 0.9] / imp [1, 0.7] | It turns all the way one of eight ways and stays. The gaze goes that way too |
| Startle (the pupil shrinking) | Interval per the table, 4.0 s | human 8~22 / pup 10~26 / cat 9~24 / **imp 6~14** (with a 4 s hold, the minimum start interval is 6 s — so they do not run together) | The eye size is unchanged and **only the pupil goes to 0.5×** (on a live eye). **It shrinks in 0.1 s, holds 3.8 s and releases in 0.1 s** (`envelope`). **Variants** — drawn at the start, plain 60% / star 25% / heart 15%: with star or heart the eyes **turn into** ☆_☆ or ♥_♥ (the eyes are switched off and the glyph substituted, `state.eyeFx`), and heart fires the ♥ emoji with it |
| ^^ happy hold | 6~16 s, **3~6 s** | **pup only** | A live eye gets the lid plus a smile arch and a static eye a cover plus a smile arch — either way it becomes a ^^. **A ♥ emoji makes it ^^ for 3.2 s** (every species, whatever fired the ♥) — and a dog follows it with a wag |
| Wink | 8~20 s, **3~5 s** | **cat only** | Only that eye becomes ^^ (static eyes too — only that eye's layer is switched off and turned into an arch, the other eye stays). An expression is always 3 s or more |
| **Anger** | 25~60 s, **3~5 s** | **cat only** (`angry` and `angryHold` in the table; null on other species) | The eyes are redrawn as **fierce eyes** (an inward-down slanted lid ＼ ／ plus a glaring dot, `angryEyeSketch`) — static and rig eyes alike — the mouth becomes the per-species angry mouth (the tooth grid grimace on humans and dogs, fangs on cats and imps — `faceStates.js ANGRY_MOUTH`), and a species with brows gets the angry brow — the third face state set. The envelope follows the same law as the startle eye: **0.1 s hard up / hold / 0.1 s release** (`state.angry` 0~1). It beats ^^, a wink and the ☆♥ variants, and sits below sleep. **This is when a cat's tail fur bristles** (§ the tail, bristle) |
| Brow switch | 6~16 s, 1.5~4 s | shared | The ALT_BROW table (flat↔worry, angry→flat). **If the brow is none, the alt is none too** — a part that does not exist is not drawn (`draw/faceStates.js`) |
| Mouth switch | 4~12 s, 0.8~2.2 s | shared | The ALT_MOUTH table — a slight shift to a neighbour in the same mood (line↔wave, dot↔3, smile→grin, grid→line…; [../character/parts.md](../character/parts.md) § mouth). There are four mouth sets: rest, alt, **angry** (the grid on humans and dogs, fangs on cats and imps) and **^^** (the panting tongue on dogs only). Priority angry > ^^ > alt > rest |

## The torso

| Motion | Parameter | human | pup | cat | imp |
| --- | --- | --- | --- | --- | --- |
| Breathing | period 2.6~5.4 s | ● | ● | ● | ● |
| Sway (side to side) | amplitude rad, period | 0.012~0.032, 2.6~4.6s | 0.004~0.01 | 0.002~0.007 | **0.015~0.04, 2~3.8s** |
| Rocking (front to back) | scale.y amplitude | 0.006 | 0.003 | 0.004 | 0.004 |
| Head tilt | interval, amplitude | 7~18s, 0.1 | 9~20s, 0.08 | **5~12s, 0.14** | 8~18s, 0.09 |
| Nod | 9~24 s, 0.7 s | ● | ● | ● | ● |
| **Head roll** | amplitude, period | — | **0.07~0.14, 2.4~4.8s, always on** | — | — |
| **Sniff dip** | interval | — | **4~10s** | — | — |
| **Hopping in place** (a body action — below) | interval | 10~25s | 12~30s | 25~60s | **8~20s** |
| **Stretch** | interval | — | — | **10~26s** | — |
| Shiver | interval | 26~60s | 40~80s | 40~90s | **12~30s** |
| **Jelly wobble** | amplitude, frequency | — | — | — | **0.008~0.018, 1.1~1.9Hz, always on** |

## Limbs

Measured off the reference (video-notes 33~36): the arms stay open and only shake finely, and the legs are nailed to the floor.
Big events appear nowhere across 4 individuals × 4 s. So the standing amplitude is at boil level and events are rare and small.

| Motion | human | imp | pup / cat |
| --- | --- | --- | --- |
| Arm pendulum (anti-phase to the sway) | 0.045 | 0.06 | — |
| Arm joint jitter | 7.3Hz 0.012 + 11.7Hz 0.008 | the same | — |
| **idle** (the A-pose, below) | always on — between actions | the same | — (no arms) |
| **Arm actions** (the table below) | 1.5~7 s every 12~36 s | every 10~30 s | — |
| Paw flick (0.09 rad, 0.9 s) | 12~30s | 14~34s | pup 14~32s / cat 16~36s |
| Step in place (0.07 rad, diagonals alternating, 2.4 s) | — | — | pup 30~70s / cat 40~90s |
| Leg joint jitter | 6.1Hz 0.006 | the same | the same |
| On a jump | arms up (hopY×4), the knees crouching (§ body actions) | the same | legs folding (splay) |

### The bind pose and arm actions

**The T-pose is not a posture but the bind pose** — the state when the character has received no motion at all. Shoulders horizontal (1.57 outward),
elbows 0. A character has no concept of "posture". `BIND_ARM` in `character/draw/limbs.js`, `bindArm(side)` in `motion/actions.js`.
`BIND_STATE` in `motion/index.js` is bind's state object (everything 0, default, T-pose), and the screen's POSE BIND feeds it to
the rig to make a still drawing.

**The base motion is idle.** An A-pose with the arms 30° open and the elbows slightly bent (`ARM_POSES.idle`) plus the standing rhythm (breathing, sway,
arm pendulum, joint jitter, gaze, blinking). This is the reference's "arms open and shaking finely". Bind (T) is not idle —
it is the rig's state when there is no motion and it is only visible in the BIND view. A newborn individual is seated in the clock's current state immediately
(`settle` in `scene`) — the arms must never be seen swinging down from T to idle.

**Actions stack on top of idle.** Only the parts the action decides change and the rest (the other arm, the body, the face) keeps idling.
Which is why a wave decides **one arm only** — "waving is the hand's movement alone". The other arm stays down at idle.
Arms-up and arms-crossed decide both. A one-arm action draws which arm is active at the start (`actionSide`).
When and which action happens is `stepArmAction` in `states.js` (the per-species list and weights are `armActions` in `table.js`, and the interval
`armActionGap`); the **content** of an action is `ACTIONS` and `ARM_POSES` in `actions.js`. When an action ends it returns to idle.

| Action | Arms | Pose | Hold (s) | Meaning | human | imp |
| --- | --- | --- | --- | --- | --- | --- |
| **idle** | — | 30° open, elbows slightly bent, clamped above the floor | always | the base | ● | ● |
| **wave** | one | The hand up, the elbow ±0.5 rad at 3Hz | 1.5~3 | **waving hello** | 2 | 1.5 |
| hi | one | One hand straight up | 2~4 | me! | 1 | 1 |
| point | one | Straight out to the side (horizontal +17°) | 2~4 | pointing | 1 | 1 |
| think | one | The hand at the chin (the chin anchor) | 3~6 | thinking | 1.5 | 0.5 |
| salute | one | The hand beside the brow (the brow anchor) | 2~4 | a salute | 0.7 | 0.5 |
| raise | both | Up (a V) | 2~4 | arms up | 1.5 | 2.5 |
| cross | both | The hands at the far side of the chest (the chestFar anchor) | 3~7 | arms crossed | 2 | — |
| hips | both | The hands at the waist (the hip anchor), elbows out | 3~7 | hands on hips | 2 | 1.5 |
| behind | both | Behind the body (the back sketch) | 3~7 | hands behind the back | 1.5 | 1 |
| flap | both | Shoulder ±0.28, elbow ±0.12 rad at 4Hz (6 ticks a cycle at 24 — 5Hz strobed) | 1.5~3 | flapping (fond) + ♥ | 1 | 2 |
| **hifive** | one | The palm up and forward ([0.72, 0.55] of reach) | — | the plant half of a high five | — (never scheduled — § the high five) | — |

Firing measures at 2.4/min on humans and 2.8/min on imps, split evenly left and right (measured over 60 s × 40 individuals). Quads (cat, pup) have no arms — see § quad idle and actions below.
There is no action for letting the arms hang — that is idle.

**An arm pose is written as a hand target (IK).** Not as a table of joint angles. `ARM_POSES[name]` holds a hand target (`hand`) — either a multiple of reach,
`[x outward, y up]`, or a rig anchor name — plus the side the elbow sticks out (`bend` out/down), and
`solveArm(rig, side, pose)` solves the [shoulder, elbow] world angles with two-bone IK (the law of cosines).
So whatever the arm length (medium/long) or body size, "hands on hips" lands on the hips and "a hand on the chin" lands on the chin.
When it cannot reach, it stretches straight that way (a short arm's salute), and a pose with `floor` on cannot put the hand below the floor
(a long arm's idle — the elbow folds outward). The shoulder angle is wound into (−135°, 225°] so the rig's easing does not take the long way round.

The rig description comes from character: `armRig(spec)` in `character/draw/limbs.js` → `{ x, y, upper, lower, anchors }`
(shoulder position, upper and lower arm lengths, and the anchors ground, hip, chestFar, chin and brow — in body coordinates, for the right arm). The scene passes it in with
`makeClock(seed, birth, species, armRig(spec))`. All of it is static dimensions coming from the spec.

Laid on top of an action: the arm pendulum (anti-phase to the sway), arms-up on a jump and joint jitter are added to the shoulder angle, and half of that to the elbow.
The oscillation of a wave or a flap (`osc`) is laid straight onto the rig rotation without easing — through easing, 3~4Hz gets smeared out.
Going into and out of an action, a 0.35 s envelope fades it so the arm does not snap the moment it ends.
The front/back (hands behind the back) switch only happens once the shoulder angle is back within 0.35 rad of the target.

**To look at one action**, pick it from the screen's ACTION card. Every species with that layer keeps doing it (arm actions on bipeds, body actions on
everyone, quad actions on quads) and the other layers go idle. The active arm of a one-arm action is split left and right on the parity of the seed. IDLE is every layer idle.
`clock.force(action, side)`, `scene.setAction(name)`. Set to AUTO and it follows the schedule (idle plus the occasional action, layers overlapping).

### Body actions — the layers overlap

Actions are **layers by body part**. The arm layer (`ACTIONS`, bipeds), the body layer (`BODY_ACTIONS`, shared) and the leg and tail layer (`QUAD_ACTIONS`, quads)
schedule separately and stack over idle — which is why it can **wave while jumping**, and a dog can wag while running.
Force one with the ACTION card and only that layer keeps going while the others go idle (for judging). A forced body action repeats with a rest between.

| Body action | What | human | pup | cat | imp |
| --- | --- | --- | --- | --- | --- |
| **jump** | **Crouch-and-spring, three times over** — every hop the same full cycle: a knee-bent crouch held a beat → the spring, the legs pushing through straight → the arc, legs extended → the landing folding straight into the next crouch, and one soft knee dip after the last (2.33 s all told). The arms are dragged up by the flight | 10~25s | 12~30s | 25~60s | 8~20s |

**The jump is built on the twelve principles, and the deformation is the skeleton's — never the scale's** (no
rubbery squash on the body; the earlier scale squash was taken out on purpose):

- **Anticipation** — before the first spring it sinks into the crouch over 0.35 s (slow in) and **holds the
  beat**; every later landing ramps straight back to the same full depth (equal crouches — crouch-and-spring,
  crouch-and-spring, crouch-and-spring)
- **The crouch is one number and the torso is its master** — `crouchDrop` (0.16 of the leg's own length) goes
  out as `state.bodyDrop`; the scene eases that scalar and **solves each knee off the displayed torso height
  every frame** (`animate.js` + `solveLeg` — move the torso and the knees bend by themselves, bowing outward:
  a plié seen head-on), then takes the body's final height back out of the drawn legs' FK so the feet hold the
  floor through every blend (displayed foot error measures ≤ 0.0005). Position, never scale. A quad's one-bone
  legs splay what they can instead
- **Arcs / timing** — the flight is a sine arc (position only, hopY to 0.044); the spring pops (the licensed
  exception) out of a slow crouch
- **The spring pushes through straight and the legs hang extended mid-air** (`flight` lets the standing rest
  bend go): held onto, the knees dangled bent all flight and the released foot plant teleported the body at
  liftoff. A frog tuck was drawn and removed too — folding the legs at the top of every hop read as a trick,
  not a hop. The landing folds them back, straight into the next crouch
- **Follow-through** — the landing knees absorb, and after the last one a soft dip-and-recover (0.3 s); the
  arms lag the flight through their damping (overlapping action)

`jumpCurve(tau, def)` in `actions.js` (the phase shape and every amplitude on `BODY_ACTIONS.jump`). The curve
goes out as `hopY` and the envelopes `dropK`, `flight` and `splay`; the clock solves the legs onto them
(`solveLeg`), subtracts the crouch descent from `hopY`, and adds `hopY×4` to the shoulders for the arms.

### The base state (mode) — idle · sleep · walk · sit

An individual is always in some **base state**. idle (standing) · sleep (lying asleep, quads) · walk (walking — it moves, every species) · sit (sitting, quads). A state like running would join here.
The action layers stack on top — while asleep, actions, looking, startle and winking all rest; while walking, body actions (jumping) and quad actions rest while arm actions carry on (waving as it walks);
and while sitting only body actions (jumping) rest, with quad actions (scratching with a hind paw, wagging), the face and looking carrying on (it scratches while sitting).
`initMode`/`stepMode` in `states.js`; `modes` (the ratios), `modeHold` (the hold) and `walk` (the step parameters) in `table.js`. **Transitions pass through idle** — from idle
into one other state (weighted), and from another state back to idle. It never goes straight from sleep to walking.

| Species | State ratio (crossing over from idle) | Hold | walk (hz step / leg leg rad / bob lift / sway lean / arm arms / trip distance (cells) / speed cells·s) |
| --- | --- | --- | --- |
| human | walk only (starting at idle 4 : walk 1) | idle 30~90 s, walk = distance/speed (2~4 s) | 1.8 / 0.30 / 0.010 / 0.05 / 0.14 / 0.10~0.18 / 0.045 |
| imp | walk only (idle 4 : walk 1) | idle 25~80 s | 2.3 / 0.36 / 0.012 / 0.06 / 0.16 / 0.10~0.18 / 0.06 — a bouncy walk |
| pup | sleep 1 : walk 1.5 : sit 1.5 (idle 3) | idle 40~120 s, sleep 25~60 s, sit 15~45 s | 2.6 / 0.32 / 0.008 / 0 / 0 / 0.10~0.16 / 0.07 — a trot |
| cat | sleep 1 : walk 1 : sit 1.5 (idle 2) | idle 40~120 s, sleep 30~90 s, sit 20~60 s | 2.2 / 0.28 / 0.006 / 0 / 0 / 0.10~0.16 / 0.05 |

**Walking moves it — out and back.** From home (the middle of the cell) it walks trip to the left or right (rng), stops and idles there as usual (a quad may even sleep).
The next walk **always** brings it home the way it came. One trip's length = distance/speed, and the start and end are smoothstepped so it does not skid to a halt.
The scene puts the state object's `walkX` (x from home, in cells) and `facing` (±1) into group.position.x and scale.x —
**a quad faces its walking direction** (mirrored −1 going right, thinning to paper through 0 and flipping; standing back home it faces left again), while a biped does not flip but
**looks** the way it walks (the look target goes that way). A forced WALK paces home↔out without a rest.

`walkK` (eased at 0.06 per 60-Hz frame — `approach`, the same seconds at any tick) blends the walking in. The step phase ph = t·2π·hz + a per-individual phase (from the seed) — on a quad the diagonal pairs (0·3 / 1·2)
alternate front and back by sin(ph)·leg, and on a biped the two legs alternately open and close (a walk seen head-on). Each step (twice the period) the body lifts by bob and the head by
half that; a biped leans side to side by sway and swings its arms counter to its legs by arm; and a quad's tail sways with the step (0.12).

**The sleeping pose** (defined for quads only): blended with idle by `sleepK` (eased at 0.03 per 60-Hz frame — `approach`) — the legs fold under the body (front legs +1.35/+1.25, hind legs
−1.3/−1.2 rad), the body settles to the hem (`rig.legTop`) and flattens (squash), the tail lowers (−0.55), the head tilts to one side (0.32,
on the parity of the seed) and dips slightly (−0.05), the eyes close (lid 1 — a static eye gets the scene's sleep lid cover plus an arch; a live eye gets the shut line over the lid), and the gaze and face turn go centre and down.
Breathing is slow (×0.65) and deep (×1.6). A z emoji every 6 s. Falling asleep and waking are eased, so nothing snaps. Force it with the ACTION card's SLEEP.

**The sitting pose** (quads only, `sitPose(rig.body)` in `actions.js` — solved per individual from the rig dimensions `motionRig().body`): blended with idle by `sitK` (eased at 0.05 per 60-Hz frame, about a second — `approach`) —
the body tilts about **the front legs' root** so the back goes down (`bodyTilt`; the scene rotates bodyGroup about that axis), bringing the hip reference point (low at the back of the body) to the floor;
the front legs stand at world angle 0 (vertical) and the hind legs fold forward to the angle that puts the feet on the floor. The head is directly above the axis and stays put (it is awake — the face and looking carry on).
A dog's tail tilts with the body and drops a little further (−0.3) to lie on the floor, its **swish stilled by 90%** — a seated tail lies and only its tip taps and flicks (a tail sweeping the floor read as a tail moving down); the wag carries on. A cat's tail **stays up**: the arch keeps 70% and the swish carries on, so a seated cat swings its tail up, back and forth — awake, a cat's tail points up and nowhere else. A leg is one bone (no knee), so with a short body and long legs the hind foot passes the front one; the tilt
is then reduced so the hind foot comes no further than between the front pair, and a build whose hips still sit more than 0.045 off the floor (long legs plus a short body, 9% of 600) **cannot sit** — it stands through the sit state.
Scratching with a hind paw and wagging carry on while seated (a leg mid-action wins), while jumping rests. Measured at cat 12.9% and pup 11.1% (180 s × 40 creatures, sit > 0.5). Force it with the ACTION card's SIT.

### Quad idle and actions

For quads too, **bind ≠ idle**. Bind is the legs vertical and the tail exactly as drawn (the BIND view). idle is **the standing stance** — the front legs plant slightly
forward and the hind legs back (`legStance` in `table.js`: pup [−0.05, −0.02, 0.09, 0.06] / cat [−0.03, 0, 0.06, 0.03] rad),
and the tail lifts on a dog (`tailIdle` 0.25 — the skeleton shape as drawn, only the root raised) while **a cat arches** — whatever the skeleton (curl, flag, longtail, kink…), in an awake idle
the joints blend 85% toward the arch world angles (`tailIdlePose` [103°, 74°, 26°, −20°], root→tip: rising with a lean toward the head, the tip curling forward and a little down — an open question mark standing behind its back; it was an ∩ with the tip straight down to −75°, which folded a thick tail onto itself) (`tailArch`). The top two bones vary by the individual's `tailLift` by ±0.12 (±7°) — only slightly. A raise (^^) takes it out by that much, and
sleep folds it back to the skeleton.
Rhythm (breathing, roll, the tail swish) and events (flicks, steps) are laid on top.

Actions stack over idle and any leg or tail not decided stays at idle. The rig is pivot rotation only, so these are angles with no IK (`QUAD_ACTIONS`).

| Action | What | Hold (s) | Meaning | pup | cat |
| --- | --- | --- | --- | --- | --- |
| scratch | One hind leg to −0.9 rad (forward and up) plus ±0.15 rad at 6Hz | 1~2.2 | scratching with a hind paw | 1 | 1 |
| wag | The tail ±0.35 rad at 3Hz (8 ticks a cycle at 24 — 4Hz strobed) | 1.5~3 | wagging the tail (dogs only — a cat does not wag like a dog. Forced from the ACTION card a cat still idles, and the walking tail sway is dogs-only too, `walk.tail`) | 2.5 | — |

Interval pup 8~22 s / cat 10~28 s. Which leg is drawn within the pair at the start (`actionSide` = the leg index).
The oscillation goes onto `legOsc` (legs) and `tailAngle` (the tail) without easing, faded by a 0.35 s envelope. There is no raise-a-front-paw-and-wave action — it looks human.
The ACTION card's SCRATCH/WAG only bite on quads. Hopping in place is on the body layer (above), so quads do it too.

## The tail (quads) — an eight-bone chain

The tail is **an eight-bone chain under one skin** splitting the spine into 8 (`TAIL_BONES` in `limbs.js`) — eight sibling bones placed by forward kinematics and one skinned mesh bent by them ([../rig.md](../rig.md)). The root bone takes
`tailAngle` (swish, wag, walking, sleep), the tip bone `tailTip` (tapping, tremble, follow-through), and **the raise `tailRaise` (0~1)** blends each joint from the rest pose (the spine direction)
toward vertical — whether the skeleton curls or reaches back, it **shoots straight up** (every joint at π/2, with no bent variant). A joint's share of either blend is taken
**the short way round** (wrapped to ±180°), the rest cascading to the next joint (`animate.js`), and that is the whole of it — over every skeleton × length × tailLift × pose,
the biggest turn a joint is ever asked for is 110° and the biggest bend the skin ends up with is 27°, which it bends through cleanly.

A pose is a **shape, not a list of bones**: the table writes it as a few angles root→tip and `animate.js` reads it off at however many bones the tail has, so the bone count
stays the rig's own business. **Eight** is what makes the plain solve enough. At four the arch asked 49° of every joint and a hook's tip had to swing 170° — a curl, a
longtail, a flag and a kink all ran out of joint and stood in a half-arch (the bones did not draw an arch at all), and the hook folded its skin onto itself: the black knob
at the tip. A joint cap of 90° and a rule letting a hopeless joint keep its own bend were built to hold that together; twice the bones took both of them away.
`tailTip` in `table.js` holds the tip bone and raise parameters. Dogs and cats read it **oppositely** — for a dog fast wagging is joy, while for a cat fast movement is irritation or excitement and
joy is **holding it up** (research: raised/a question mark = greeting, a trembling tip = a very glad greeting, a slow swish = focus or mild irritation, tip tapping = interest, lashing = anger,
puffed = a startle, wrapped round the body = at ease, and nearly fixed while walking).

| Motion | Kind | pup | cat |
| --- | --- | --- | --- |
| Swish (the root) | rhythm | — | **amplitude 0.16~0.3, period 2.4~5 s** — slow |
| Follow-through (the tip) | rhythm | the root's angular velocity × 0.05, critically damped — the tip lags behind on a wag | × 0.06 |
| Flick / **tip tapping** | event | The whole thing — 0.35 rad, 1.5 cycles in 0.5 s (3Hz) under an attack-release envelope, every 3~9 s | **the tip alone** — the same shape on the tip bone (0.35 rad, 1.5 cycles in 0.5 s), every 8~20 s (the root stays put) |
| Walking sway (the root) | state | ±0.12 with the step (`walk.tail`) | none (fixed) |
| wag | action | ±0.35 at 3Hz (`QUAD_ACTIONS`; 8 ticks a cycle at 24 — 4Hz strobed), every 6~16 s (wag 3.5 : scratch 1) · **it also wags whenever it smiles ^^** (`wagOnHappy`, a critically damped envelope) · **seated** it slows to 1.5Hz at half the swing — content, not the standing wag (`seated`; the phase is integrated, so the change of rate never jumps) | none (it idles even when forced) |
| **tuck** | event (a startle) | On a plain or ☆ startle (not a ♥ — that one wags) the whole tail tucks under, −1.0 rad, for 1.2 s (`tuck`: in 0.15 s, held, out in 0.4 s) — fear. Its one motion below the body while awake | — |
| Lashing | — | — | **there is none** — a cat lashing its tail is forbidden as a motion (there is no code for it. A dog's wag is wag) |
| Wrapped round the body | — | — | **not a motion** — awake, a cat's tail points up and swings; the tail folds against the body only in sleep |
| **idle pose** arch | state | The skeleton as-is (the root +0.25) | **the arch** — the shape [103°, 74°, 26°, −20°] read off at the tail's eight joints, × 85% (`tailIdlePose`, an open question mark: rising with a lean toward the head, the tip curling forward and a little down — it was an ∩ with the tip straight down, which folded a thick tail onto itself), the top two control angles ±0.12 by the individual's tailLift. While awake and not raised; seated it keeps 70%. **Every skeleton reaches it**, the hook included |
| **raise** | tied to a good mood (^^) | — | **while smiling ^^** (a ^^ blink 22%, the ♥ emoji, a ♥ startle — 3 s or more) `tailRaise` goes 0→1 (0.4 s), holds for the whole smile and drops in 0.6 s; the swish, taps and follow-through are killed by it (stiff). Two shapes: for a ^^ **every joint exactly vertical** (π/2); when the mood is a **♥** (the emoji floating, a ♥ startle) the **question mark** — `raisePose` [90°, 90°, 72°, 14°], the tip hooked toward the head — the greeting. `h` blends between the shapes at the raise's own rates, so a ♥ arriving mid-raise bends the tip over smoothly |
| **tremble** (the tip) | tied to a ♥ | — | While raised by a ♥ the tip quivers 0.08 rad at 4Hz (`tremble`; 6 ticks a cycle) — a very glad greeting |
| **bristle** puff | tied to **anger**, and a startle | — | Fur stands up when scared or angry — while angry, only the tail's **thickness** goes 1 → 1.6× (`tailPuff`, the length unchanged), the envelope following anger as it is: bristling in 0.1 s, held for the 3~5 s of anger, subsiding in 0.1 s. On a **startle** a short bristle — 1.4× over 0.6 s (`startlePuff`, a bump at the startle's start) — whichever is bigger |
| Sleep | state | The root −0.55 | The root −0.55 plus the tip −0.6 (wrapped round the body) |

## Emoji animation

The ♥ ! ? … ; glyphs above the head. **Not a motion but a separately triggered layer** (`motion/emoji.js`) — a motion does not hold the emoji;
once fired it plays out its own length on its own. There is one channel (a new trigger cuts the previous one off). The scene applies `state.emoji`'s frame
(dy, scale, rot, opacity) as-is and only bakes the shapes (`scene/emoji.js`). The emoji is not attached to the head — it eases toward
the point above the head from the scene root, so it is dragged a beat behind on a tilt or a jump ([../rig.md](../rig.md)).

| Emoji | Length | Curve |
| --- | --- | --- |
| heart ♥ | 2.2 s | float — floats up, growing and shrinking like a heartbeat |
| bang ! | 1.3 s | pop — pops out big, back in place, with a slight tremble |
| quest ? | 2.2 s | wobble — tilting side to side |
| dots … | 2.6 s | mumble — floats low and gently |
| zzz z | 2.8 s | float — floats up (sleep) |
| sweat ; | 1.8 s | drip — beads beside the temple (high on the side of the head, not on the crown) and runs slowly down. A pale blue drop |

**Triggers** — they arrive from two places.

| Trigger | What | When |
| --- | --- | --- |
| The idle schedule (`events.stepEmojiSchedule`) | One from the species list — human/pup heart, bang, quest, sweat; cat heart, quest, bang; imp **dots×2**, bang, quest, heart, sweat | Every 14~40 s |
| An action's `emoji` field (`ACTIONS`, `QUAD_ACTIONS`) | flap → ♥, think → ?, wag → ♥ | Once, **the moment the action starts** |
| Events | Startle (the pupil shrinking) → ! | 30% of the time a startle starts (it does not get startled while asleep) |
| The base state | sleep → z | Every 6 s while asleep (a per-individual phase, no rng) |

To attach an emoji to a new motion, write `emoji: "kind"` on that action — that is the emoji trigger. Firing measures at human 3.6 · imp 4.4 · pup 5.6 · cat 4.2 per minute.

**The rex** (the fifth lane) is a biped **with a tail** — the tail rides the same root/tip channels as a
quad's (a slow heavy sway, amp 0.06~0.14 over 2.8~5 s, tip follow-through 0.06; no raise, no arch, no wag) —
with tiny-arm actions (raise 2.5 · hi 2 · point 1.5 · wave 1, every 12~32 s; its stubby arms high five like any
armed biped), a cat-cadence **anger** (every 22~55 s for 3~5 s — the fierce eyes with the clenched tooth grid,
measured at 7.1% of ticks) and emojis bang · quest · heart · dots.

## The high five — a scene interaction

Every pair of same-row biped neighbours high fives **on its own schedule** — no distance is asked. When a
pair's time comes (every 300~720 s per pair, its own rng stream; a fresh board's first within 40~300 s), the
**short-armed one stops where it stands** (the anchor — a dead tie in reach falls to seed parity) and watches;
the **long-armed one hurries over** from wherever it is (the mover — a commanded trip at 2.2× its walk speed,
past the normal 0.10~0.18 trip cap). **Standing too close already** — less than `minApproach` (0.15 cells) of
walking left for the mover — **the pair skips that round outright** and draws its next: a five with no
approach has no show. Measured at 2~6 skips per board per 10 min (mid-walks into each other, mostly). The anchor's palm comes up once the mover is within 0.5 cells; the mover
arrives, **winds up, holds, and slaps** — the palms first touch at the slap, **at the anchor's own height**.
Three gold stars bounce out of the contact (`scene/spark.js` — the emoji's scale and layer, baked once per
burst), the palms hold 0.55 s, both smile, and both go back to their schedules; the mover walks home on its own
next walk.

**Watching one.** At 300~720 s a pair, a screen sits quiet for minutes. The debug screen's HIGH FIVE **RUSH**
(`/debug.html?five=rush`) divides that wait and the first-five wait by 60 and nothing else — the pair logic,
the hurry over, the wind-up and the slap are the board's own, so the swing you watch is the real one. The
schedule is settled when the scene is built (`makeHifives({ rush })`), so the button reloads with the value in
the address. Off everywhere else, and `scripts/hifive-sim.mjs` counts at the real intervals.

**The swing is built on the twelve principles, exaggeration on purpose** — the amplitudes sit 2~3× above the
board's ordinary motion. All of it is on `ACTIONS.hifive` in `actions.js` (action content stays in the action
table) and runs in the clock:

- **Anticipation** — the hand pulls deep toward the body (to 12% of its outward distance, cocked up by 0.18 of
  reach) over 0.3 s, **and freezes there 0.14 s** before the release (timing: long in, short out)
- **The crouch is the knees'** — through the wind-up the knees bend (0.7 rad, the same plié the jump uses;
  the body descends by what the folded legs lost — never a scale squash) and the body leans away (0.09 rad —
  3× the ordinary sway); the strike swings it the other way with a little hop
- **Arcs** — the slap travels an upward arc (0.12 of reach at its crest), not a straight line
- **Follow-through** — the palm drives past the contact and settles back (0.12 s); the receiver's planted hand
  dips under the hit and its body is pushed off it with a knee dip's brace (recoil, 0.24 s)
- **Secondary action** — both parties go ^^ for 3.2 s from the impact
- **Slow in slow out** — every leg of the curve is `ramp`/`bump` (the repo's easing law); **staging** — the
  anchor waits looking at the incoming mover, both look at each other, and the jump rests mid-five (it would
  tear the palms apart). The reaching arm drops the pendulum and walk swing, keeping only joint jitter

The pair logic lives in **`scene/hifive.js`**, not in `motion/` — no per-individual clock knows another's
position; the scene owns the board. A clock obeys one command (`clock.hifive` in `motion/index.js`): wait,
plant or reach (the mover's hand tracks the meeting point in shoulder terms while it walks), walk to x, and the
impact moment (the anchor is told when the slap lands; the mover works it out on arrival). Commands consume
**no rng from any clock's stream** — every schedule keeps stepping underneath — and the pair scheduler's
randomness is its own per-pair `makeRng` stream seeded from the two specs, so the fives are seed-deterministic
and an isolated clock (the snapshot, the frequency counts) is byte-identical with the feature in place.

The meeting height is the anchor's natural plant, pulled into the intersection of what **both** arms can span
when the builds force it (reach and body height are separate draws — a long-armed mover can still be the short
body): the mover's band (`reachK` 0.92 of its reach), the anchor's (its plant stretch rotated to ±0.9 of
reach), never below the floor. The pairing knobs — the intervals, the plant distance, hold, cooldowns — are the
`HIFIVE` table at the top of `scene/hifive.js` and nowhere else; the swing's shape lives on `ACTIONS.hifive`.

Only same-row neighbours with arms pair (the lanes make those the human and imp rows; an armless imp sits it
out). BIND and a forced ACTION release any running five (a forced arm would fight it); a regen mid-five lets
both go and restarts that pair's stream. Force the static pose from the ACTION card's HIFIVE to judge the plant.

**Measured** (`node scripts/hifive-sim.mjs` — it drives the real pair logic over real clocks and runs both
palms back through FK): 1.7~2.3 fives/min on the default 7×5 board (1.77/min steady over 30 min), palm gap at
the slap mean 0.006 · max 0.014 — inside the hand dot's radius (0.022), so the palms genuinely meet — 0
unreachable pairs. The swing trace (the sim prints the first two per board) shows the whole shape: carried
short (≈0.04~0.05), the pull opening to 0.13~0.23, **four ticks frozen at the top** (the anticipation hold),
and the slap shutting it to ≤0.01 at the burst.

## Regen

6~14 s per slot. **Off by default (STILL)** — form changes only through NEW SEED. Turn LIVE on and individuals are
replaced on their own clocks while the species stays with the slot. A new individual's clock takes that moment as its birth time
(otherwise every schedule is in the past and it runs away, regenerating every frame).

## The boil is not a motion

The lines boiling is a hand-drawn **material**, not something the character does. The lines boil even in the bind pose.
[../drawing.md](../drawing.md) § the boil. The screen's INK BOIL/STILL is this axis, separate from POSE MOTION/BIND.

## Adding a new motion

1. Put the per-species parameters in `motion/table.js`. `null` for species without it
2. Settle the kind — rhythm (`rhythm.js`) / event (`events.js`) / state (`states.js`) — add `initXxx` and `stepXxx` in that file → call it in `motion/index.js` **after the existing order** (insert it before and seeds break)
3. Apply it to the rig in `applyState` in `scene/animate.js`
4. Count the firing frequency with a 60 s simulation (the command below). Never judge by eye alone

**A new action** is shorter — first settle which **layer** it belongs to (arm `ACTIONS` / body `BODY_ACTIONS` / quad `QUAD_ACTIONS`, [rules.md](rules.md)).
- Arm: the pose (hand target, bend) in `ARM_POSES`, the action (pose, arms one/both, hold, label) in `ACTIONS`, and the per-species weights in `armActions` in `table.js`. Check the hand position by calculation — run `solveArm`'s result back through FK to see whether the hand reaches the anchor and stays above the floor, then force it from the ACTION card
- Body: the curve in `BODY_ACTIONS` (currently jump — add another curve function like `jumpCurve` if needed), and `bodyActions` in `table.js`
- Quad: which leg, the angle and oscillation, or a tail oscillation, in `QUAD_ACTIONS`, and `quadActions` in `table.js`
- If it comes with an emoji, one line of `emoji: "kind"` on that action (§ emoji animation)
The rng order does not change (the scheduling layer already exists).

```bash
node --input-type=module -e "
Promise.all([import('./src/motion/index.js'), import('./src/character/index.js')]).then(([{makeClock}, {makeCreature, armRig}]) => {
  const c = makeClock(42, 0, 'human', armRig(makeCreature(42, 'human')));
  let n = 0;
  for (let f = 0; f < 3600; f++) { const s = c.update(f/60); if (s.YOUR_STATE) n++; }
  console.log(n, 'frames / 3600');
});"
```
