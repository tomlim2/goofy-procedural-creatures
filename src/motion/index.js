// The per-individual clock. Assembles rhythm (standing), events (intermittent), states (held) and actions.
//
// ⚠ The order of rng calls *is* the roll. The init order and update order below are fixed. A new motion goes
// **at the end** of its block. Reorder them and every existing roll's motion changes
// (guidelines/determinism.md).
//
// Every schedule is relative to the birth time (birth).
// Docs: guidelines/motion/catalog.md, guidelines/motion/rules.md

import { makeRng } from "../rng.js";
import { MOTION, ghostMotion } from "./table.js";
import * as R from "./rhythm.js";
import * as E from "./events.js";
import * as S from "./states.js";
import { ACTIONS, QUAD_ACTIONS, BODY_ACTIONS, jumpCurve, jumpSpan, sitPose, bindArm, solveArms, solveLeg } from "./actions.js";
import { initEmoji, triggerEmoji, stepEmoji } from "./emoji.js";
import { ramp, smoothstep, damp, approach, bump, envelope } from "./ease.js";
import { TICK_FPS } from "../tick.js";

export { MOTION } from "./table.js";
export { ACTIONS, QUAD_ACTIONS, BODY_ACTIONS, ARM_POSES, bindArm, solveArm, solveArms, solveLeg } from "./actions.js";
export { EMOJI } from "./emoji.js";

// The bind state — a character that has received no motion at all. Every value is still and at default: a biped's arms in a T-pose,
// a quad's legs vertical and its tail exactly as drawn. In the BIND view the scene feeds this to the rig instead of the clock.
// (Motion's base state is not this but idle — a biped A-pose, a quad's standing stance (legStance, tailIdle). Bind is when there is no motion.)
export const BIND_STATE = Object.freeze({
  breathe: 0, lid: 0, gaze: [0, 0], startle: 0, eyeFx: null, angry: 0, regen: false, emoji: null,
  browAlt: false, mouthAlt: false,
  sway: 0, rock: 0, headAngle: 0, headBob: 0,
  hopY: 0, squashX: 0, squashY: 0, stretchX: 0, shiverX: 0,
  jellyX: 0, jellyY: 0, faceTurn: [0, 0],
  happy: false, winkSide: 0, tailAngle: 0, tailTip: 0, tailPuff: 0, tailRaise: 0, tailRaisePose: null, tailArch: 0, tailPose: null,
  arms: { "-1": bindArm(-1), "1": bindArm(1) }, action: null, actionSide: 0, bodyAction: null,
  mode: "idle", sleep: 0, walk: 0, sit: 0, bodyTilt: 0, walkX: 0, facing: 1,
  legOffset: [0, 0, 0, 0], legOsc: [0, 0, 0, 0], bodyDrop: 0
});

// rig: character/draw/limbs.js motionRig(spec) — { arm (a biped's arm IK dimensions | null), legTop, quad, body (a quad's torso and leg-root dimensions | null) }.
// It solves actions by IK, knows how far the body settles when a quad lies down to sleep, and solves the body tilt and leg angles of a sit for this individual.
// ghost: this individual is a ghost (character parts.ghost) — it only floats, and has none of the expressions.
// It is a **table profile** (table.js ghostMotion), built off the species' own, so a ghost cat is still a cat
// key: the creature's roll (spec.roll) — the number its rng stream and its fixed phases come off. It is not
// called roll in here because roll is a motion: the body's roll (rhythm.js initRoll / stepRoll)
export function makeClock(key, birth = 0, species = "human", rig = null, ghost = false) {
  const rng = makeRng(key ^ 0x5bf03635);
  const M = ghost ? ghostMotion(MOTION[species] || MOTION.human) : (MOTION[species] || MOTION.human);

  // -- init: fixed order --
  const breathe = R.initBreathe(rng);            // 1
  const blink = E.initBlink(rng);                // 2
  const glance = E.initGlance(rng);              // 3
  const surprise = E.initSurprise(rng, M);       // 4
  S.initSquint(rng);                             // 5 (the half-lidded hold — gone. Only the rng consumption is kept, so the later order does not shift)
  const regen = E.initRegen(rng);                // 6
  const mood = S.initMood(rng);                  // 7
  const emojiSchedule = E.initEmojiSchedule(rng); // 8
  const sway = R.initSway(rng, M);               // 9  (sway·rock)
  const roll = R.initRoll(rng, M);               // 10
  const dip = E.initDip(rng, M);                 // 11
  const tilt = S.initTilt(rng, M);               // 12
  const nod = E.initNod(rng);                    // 13
  const bodyAction = S.initBodyAction(rng, M);   // 14
  const stretch = E.initStretch(rng, M);         // 15
  const shiver = E.initShiver(rng, M);           // 16
  const armSwing = R.initArmSwing(rng);          // 17
  const armAction = S.initArmAction(rng);        // 18
  const legTap = E.initLegTap(rng, M);           // 19
  const legStep = E.initLegStep(rng, M);         // 20
  const wink = S.initWink(rng, M);               // 21
  const happy = S.initHappy(rng, M);             // 22
  const tailSwish = R.initTailSwish(rng, M);     // 23
  const tailFlick = E.initTailFlick(rng, M);     // 24
  const jelly = R.initJelly(rng, M);             // 25
  const look = S.initLook(rng, M);               // 26
  const quadAction = S.initQuadAction(rng, M);   // 27
  const mode = S.initMode(rng, M);               // 28 (the base state idle/sleep/walk/sit — a species with only one state uses no rng)
  const zzzPhase = rng.float(0, 6);              // 29 (the phase of the z emoji during sleep — every 6 s, with no rng per frame)
  const angry = S.initAngry(rng, M);             // 30 (anger — a species with no angry in the table uses no rng)
  // The tail's tip bone (mostly cats) — follow-through state, lash and raise. It starts along with an event rather than on a schedule, so rng only at the start
  const TT = M.tailTip || null;
  const tailFollow = { x: 0, v: 0 };
  let tailPrevBase = null;
  // An expression does not flicker past — once a ^^ starts it runs for **3 s or more** (a ^^ blink 22% and the ♥ emoji switch it on). Times only, no rng
  let happyUntil = -1;
  const happyWag = { x: 0, v: 0 };   // the envelope for wagging while smiling (switched on and off with critical damping) — dogs
  // Raise (cats) — the tail shoots up while in a good mood (^^). k 0~1 rises and falls linearly (0.4 s up / 0.6 s down) and ramp makes it an S-curve. Two shapes: every joint
  // exactly vertical for a ^^, and the **question mark** (table raisePose) when the mood is a ♥ — h 0~1 blends between them at the same rates, so a ♥ arriving mid-raise bends
  // the tip over smoothly and never snaps. lastT is for dt (per tick, so deterministic)
  const raise = { k: 0, h: 0, lastT: -1 };
  // The happy wag's phase is integrated (not t × hz) so its rate can change — seated it slows — without the phase jumping
  const wag = { phase: 0, lastT: -1 };
  // The idle tail pose (the cat arch, table tailIdlePose) — the list of joint world angles. The top two bones curl more or less by the individual's tailLift. No rng; built once per clock
  const IP = M.tailIdlePose || null;
  const tailPose = IP ? IP.angles.map((a, i) => a + (i >= IP.angles.length - 2 ? (rig && rig.tailLift ? rig.tailLift : 0) * IP.liftBend : 0)) : null;

  // A forced action (the on-screen ACTION card). That layer keeps doing it while the others idle. null follows the schedule,
  // "idle" keeps every layer idle. Arm actions (ACTIONS) are bipeds, quad actions (QUAD_ACTIONS) quads, body actions (BODY_ACTIONS) shared.
  let forced = null;
  let forcedMode = null;   // "sleep" | "walk" | "sit" | "idle" | null — the ACTION card can set the base state too
  let forcedSide = 1;
  let forcedStart = -1;
  // A high five commanded by the scene (scene/hifive.js) — the pair logic needs both creatures' positions,
  // which no per-individual clock has, so the scene decides and the clock obeys. The command consumes **no
  // rng**: every schedule keeps stepping underneath, and an isolated clock (the snapshot, the frequency
  // counts) never receives one.
  //   side     the arm toward the partner (-1/1)
  //   wait     stand and watch — the partner is still walking over; the arm stays with its schedule
  //   at       [x, y] the meeting point — x in cells from this creature's home, y from the floor. The mover's
  //            hand tracks it while walking (the same world point shifts in shoulder terms every tick); with
  //            neither at nor wait, the static hifive pose (the ACTION card's force)
  //   walkTo   a commanded trip target in cells from home, or null (stand still). Cleared by the clock on arrival
  //   impactAt when the slap lands (the anchor is told by the scene; the mover works it out on arrival) —
  //            keys the receiver's recoil and both smiles
  let five = null;
  const arm = rig ? rig.arm : null;
  const quad = !!(rig && rig.quad);
  const armed = !!arm;   // an arm rig is needed for the arm action layer to live (an armless imp rests even though it is a biped)
  const canSleep = quad;   // the sleep pose is only defined for quads
  // How asleep it is, 0~1. When the state changes it eases here — so lying down and getting up do not snap. An individual born asleep starts at 1
  let sleepK = mode.mode === "sleep" && canSleep ? 1 : 0;
  // Sit — quads only. The pose is solved once from the rig dimensions (actions.js sitPose). sitK 0~1 blends it with idle (so sitting and rising do not snap)
  const sit = quad && rig && rig.body ? sitPose(rig.body) : null;
  let sitK = mode.mode === "sit" && sit ? 1 : 0;
  // How much it is walking, 0~1 (easing into the walk state). The step phase is offset per individual — from the roll, with no rng
  const W = M.walk || null;
  let walkK = mode.mode === "walk" && W ? 1 : 0;
  const walkPhase = ((key % 97) / 97) * Math.PI * 2;
  // The float (a ghost) — a steady lift off the floor with a slow drift over it. Its phase is per individual and
  // comes **from the roll with no rng**, like walkPhase just above: the clock keeps drawing from this stream all
  // through update(), so an init draw here would shift every schedule after it and re-roll every creature's motion
  const SLOW = M.slow || 1;   // a ghost runs at half speed — one factor on the clock's time (see update)
  const F = M.float || null;
  const floatPhase = ((key % 89) / 89) * Math.PI * 2;
  // **Every ghost hangs at the same height.** One distance for all of them, not a fraction of each build: a row
  // of ghosts should read as a row, and solving the lift off legTop (0.022~0.46 across the board) made the line
  // ragged — the raggedness is what you see, not the meaning behind it. What still varies per individual is the
  // knee fold, below. 0.09 clears the scene's floor release (hopY 0.02, animate.js) more than three times over
  // even at the bottom of the drift, and carries the tallest head (1.05) to 1.16, inside the 1.35 cell
  const floatLift = F ? F.lift : 0;
  // How far the knees tuck up, per individual — one ghost hangs with its legs nearly straight and the next has
  // them folded right up. **From the roll, no rng**, for the same reason the phase is. It goes out as bodyDrop,
  // the crouch scalar: with the feet off the ground the scene's floor hold is released (animate.js), so the very
  // solve that sinks a standing body into its knees instead pulls the feet up under a floating one
  const floatFold = F ? F.fold[0] + ((Math.imul((key ^ 0x6d2b79f5) >>> 0, 0x9e3779b1) >>> 9) / 8388608) * (F.fold[1] - F.fold[0]) : 0;
  // Walking moves it — from home (the middle of the cell, x 0) it walks a little to the left or right, idles there as usual (and may sleep),
  // and the next walk **always** brings it home the way it came. leg = one trip { from, to, start, dur }. The speed is the species' (W.speed, cells/second)
  const trip = { x: 0, from: 0, to: 0, start: -1, dur: 0, dir: 0 };
  let facing = 1;                 // tailed creatures flip (quads, the rex): -1 (mirrored) when walking right, so the tail trails. It thins to paper through 0 and flips
  let lastMode = mode.mode;
  const startLeg = (t) => {
    const home = Math.abs(trip.x) < 1e-4;
    if (home) {   // starting from home — the direction and distance come from rng
      trip.dir = rng.chance(0.5) ? 1 : -1;
      trip.to = trip.dir * rng.float(W.trip[0], W.trip[1]);
    } else {      // starting from outside — home only
      trip.dir = trip.x > 0 ? -1 : 1;
      trip.to = 0;
    }
    trip.from = trip.x;
    trip.start = t;
    trip.dur = Math.abs(trip.to - trip.from) / W.speed;
  };
  let zzzLast = -1;
  // The emoji channel — a layer separate from motion. The schedule (occasionally while idle) and motion's emoji triggers both fire into here
  const emoji = initEmoji();
  const lastAction = { arm: null, quad: null };   // for detecting an action's start (triggering once, at the start)

  // Settles one action layer: with no forcing, whatever is scheduled; if the forcing belongs to this layer, that (continuously); if it belongs to another layer or is "idle", null.
  // makeForced(def, start) builds the forced action's { action, …, start, until }.
  const resolveLayer = (t, scheduled, defs, applies, makeForced) => {
    if (!forced) return scheduled;
    if (!(applies && defs[forced])) return null;
    if (forcedStart < 0) forcedStart = t;
    return makeForced(defs[forced], forcedStart);
  };
  // If an action has just started and has an emoji trigger, fire it
  const fireEmoji = (key, act, defs, t) => {
    const name = act ? act.action : null;
    if (name && name !== lastAction[key] && defs[name].emoji) triggerEmoji(emoji, defs[name].emoji, t);
    lastAction[key] = name;
  };

  return {
    // Forcing. null → follow the schedule. "idle" → every layer idle and awake. "sleep" → asleep (quad). An action name → that layer does that action, awake
    force(action, side = 1) {
      if (!action) { forced = null; forcedMode = null; }
      else if (action === "sleep") { forced = "idle"; forcedMode = "sleep"; }
      else if (action === "walk") { forced = null; forcedMode = "walk"; }   // arm actions still follow the schedule while walking (waving as it walks)
      else if (action === "sit") { forced = null; forcedMode = "sit"; }     // quad actions (scratching, wagging) still follow the schedule while sitting
      else if (action === "idle") { forced = "idle"; forcedMode = "idle"; }
      else if (ACTIONS[action] || QUAD_ACTIONS[action] || BODY_ACTIONS[action]) { forced = action; forcedMode = "idle"; }
      else { forced = null; forcedMode = null; }
      forcedSide = side;
      forcedStart = -1;
    },
    // The scene's high five command (scene/hifive.js). cmd = { side, at, walkTo } or null to release.
    // A natural trip in flight is frozen where it stands — left ticking, its stale window would snap trip.x
    // to the old target the moment the base state comes back to walk
    hifive(cmd) {
      // swings — only the walking party carries short, winds up and slaps; the anchor just plants where it is
      // told. A re-command mid-five (the scene upgrades the anchor wait → plant → impact) keeps the action's
      // start, so the arm's fade-in never re-runs
      const start = cmd && five ? five.start : -1;
      five = cmd ? {
        side: cmd.side, wait: !!cmd.wait, at: cmd.at || null, walkTo: cmd.walkTo ?? null,
        swings: cmd.walkTo != null, impactAt: cmd.impactAt ?? -1, start, hitAt: -1
      } : null;
      if (five && trip.start >= 0) { trip.to = trip.x; trip.start = -1; }
    },
    update(globalT) {
      // **A ghost moves at half speed** (table.js `slow`). One factor on the clock's own time, so every
      // oscillation, every schedule, every jitter and the float's own drift halve **together** — scale them
      // one by one and they come apart. Birth-relative first, then scaled, so the whole timeline stretches
      // from the moment it was born rather than from the board's zero.
      // What this cannot reach is a per-tick easing: `damp` and `approach` step once per call whatever t says.
      // The two that matter for a ghost — the gaze and the face turn — take the factor themselves (rhythm.js);
      // the rest belong to sleeping, sitting, walking and smiling, none of which a ghost does
      const t = (globalT - birth) * SLOW;

      // -- update: fixed order --
      // The base state — idle (standing) / sleep (lying asleep). The schedule runs even while forced. sleepK blends the pose
      let modeName = forcedMode || S.stepMode(mode, t, rng, M);
      // A high five overrides the base state without touching the schedule (stepMode already ran, rng intact) —
      // the mover walks its commanded trip, the anchor stands. The schedule takes back over on release
      if (five) modeName = five.walkTo != null && W ? "walk" : "idle";
      // A commanded trip (the mover walking to the meeting point) — the target is the scene's, so no rng.
      // The mover hurries (approach × the walk speed). Arrival starts the swing clock (hitAt), and the impact
      // lands a full swing later (windup, the anticipation hold, the strike)
      if (five && five.walkTo != null && W) {
        if (trip.start < 0) {
          trip.from = trip.x; trip.to = five.walkTo; trip.dir = trip.to > trip.x ? 1 : -1;
          trip.start = t; trip.dur = Math.abs(trip.to - trip.from) / (W.speed * ACTIONS.hifive.approach);
        }
        if (t >= trip.start + trip.dur) {
          trip.x = trip.to; trip.start = -1; five.walkTo = null; five.hitAt = t;
          five.impactAt = t + ACTIONS.hifive.windup + ACTIONS.hifive.antHold + ACTIONS.hifive.strike;
          modeName = "idle";
        }
      }
      // Starting a walk — one trip is taken and the walk hold is matched to the arrival (distance/speed instead of the table's walk hold)
      if (W && !five && modeName === "walk" && (lastMode !== "walk" || trip.start < 0)) {
        startLeg(t);
        if (!forcedMode) mode.next = t + trip.dur + 0.2;
      }
      if (W && !five && modeName === "walk" && trip.start >= 0 && t >= trip.start + trip.dur) {
        // Arrival. On a forced walk, straight into the next trip (out and back home); otherwise the state machine hands over to idle
        trip.x = trip.to; trip.start = -1;
        if (forcedMode === "walk") startLeg(t);
        else { modeName = "idle"; mode.mode = "idle"; mode.next = t + rng.float(M.modeHold.idle[0], M.modeHold.idle[1]); }
      }
      if (trip.start >= 0 && modeName === "walk") {
        const p = smoothstep(0, 1, (t - trip.start) / Math.max(trip.dur, 1e-6));
        trip.x = trip.from + (trip.to - trip.from) * p;
      }
      lastMode = modeName;
      // A TAILED creature faces its walking direction — mirrored (-1) when going right, so the tail trails
      // behind the walk instead of leading it (quads always did; the rex, the tailed biped, joins them).
      // Standing back home it faces left again (+1); idling outside it keeps the last direction. A high five's
      // commanded trip never flips: the palm solve aims in world space, and a mirrored mover would land its
      // hand on the wrong side (quads never five, so only the rex could hit this)
      const tailed = !!(rig && rig.tailed);
      const facingTarget = !tailed || five ? 1 : (modeName === "walk" && trip.start >= 0) ? (trip.dir > 0 ? -1 : 1) : (Math.abs(trip.x) < 1e-4 ? 1 : facing < 0 ? -1 : 1);
      facing = approach(facing, facingTarget, 0.18);
      const asleep = modeName === "sleep" && canSleep;
      sleepK = approach(sleepK, asleep ? 1 : 0, 0.03);
      if (sleepK < 0.001) sleepK = 0;
      const awake = 1 - sleepK;
      // Sit — it sits and rises faster than it sleeps (0.05 per 60-Hz frame, about a second — ease.js approach keeps the seconds at any tick). It is an awake state, so the face, looking and quad actions all carry on
      const sitting = modeName === "sit" && !!sit;
      sitK = approach(sitK, sitting ? 1 : 0, 0.05);
      if (sitK < 0.001) sitK = 0;
      // Walk — walking in place. walkK eases in and out (about 0.5 s). The step phase ph is t-based, so it never breaks
      const walking = modeName === "walk" && !!W;
      walkK = approach(walkK, walking ? 1 : 0, 0.06);
      if (walkK < 0.001) walkK = 0;
      const ph = W ? t * Math.PI * 2 * W.hz + walkPhase : 0;
      const stepBump = 0.5 - 0.5 * Math.cos(2 * ph);   // 0→1→0 once per step (twice the period)

      // Face
      // A ghost's eyes are hollow — two holes, and a hole has no lid to close. It does not blink, and the ^^ a
      // blink can carry (a 22% chance, which then holds the smile for 3.2 s) goes with it. The blink and the
      // brow/mouth mood are the two expression channels the table has no switch for, so they are masked here
      // instead — at the source, so that everything downstream reads the masked value. The schedule keeps
      // stepping and keeps drawing either way, the way a forced action's does: only the result is dropped
      const bl0 = E.stepBlink(blink, t, rng);
      const bl = F ? { lid: 0, happy: false } : bl0;
      E.stepGlanceTarget(glance, t, rng);
      // Look — while held, the gaze target is set that way (the pupils first) and the face follows round
      let looking = S.stepLook(look, t, rng, M);
      if (!quad && modeName === "walk" && trip.start >= 0) looking = [trip.dir * 0.9, 0];   // a biped looks the way it walks
      if (five) looking = [five.side * 0.9, 0];   // through a high five both parties look at each other
      if (looking && !asleep) glance.gazeTarget = looking;
      const gaze0 = R.stepGaze(glance, 0.2 * SLOW);
      const faceTurn0 = R.stepFaceTurn(glance, M, asleep ? null : looking);
      // Sleep — eyes closed, gaze centred, the face tilted slightly down
      const gaze = [gaze0[0] * awake, gaze0[1] * awake];
      const faceTurn = [faceTurn0[0] * awake, faceTurn0[1] * awake - 0.35 * sleepK];
      let lid = bl.lid;
      let isHappy = bl.happy;
      if (S.stepHappy(happy, t, rng, M)) { lid = 1; isHappy = true; }
      // A ♥ emoji makes it smile (^^) — whatever fired the ♥ (the idle schedule, a flap, a wag, a ♥ startle). On a dog this leads into a wag.
      // A ^^ blink is stretched to a 3.2 s hold rather than a moment — there is no face that stops smiling halfway
      if ((emoji.kind === "heart" || bl.happy) && sleepK === 0) happyUntil = Math.max(happyUntil, t + 3.2);   // once it has started falling asleep it does not smile anew
      // A landed high five makes both parties smile ^^ (secondary action) — keyed to the impact moment. No rng
      if (five && five.impactAt >= 0 && t >= five.impactAt) happyUntil = Math.max(happyUntil, five.impactAt + ACTIONS.hifive.happy);
      if (t < happyUntil && !asleep) { lid = 1; isHappy = true; }
      const winkSide = sleepK > 0.5 ? 0 : S.stepWink(wink, t, rng, M);
      if (sleepK > 0.5) S.stepWink(wink, t, rng, M);   // (fixed rng consumption — only the result is thrown away)
      const startleBefore = surprise.start;
      const startle0 = E.stepSurprise(surprise, t, rng, M);
      // When a startle has just begun — the ♥ variant fires the ♥ emoji with it, the rest fire a ! 30% of the time (an emoji trigger). It does not get startled while asleep
      if (startleBefore < 0 && surprise.start >= 0 && !asleep) {
        if (surprise.variant === "heart") triggerEmoji(emoji, "heart", t);
        else if (rng.chance(0.3)) triggerEmoji(emoji, "bang", t);
      }
      lid = Math.max(lid, sleepK);
      const startle = startle0 * awake;   // startle 0~1 — how far the pupil shrinks
      // Anger 0~1 — **redrawn** (scene) as fierce eyes and a bared-tooth mouth (plus angry brows). It beats a smile. Not while asleep. The schedule runs even while forced
      const angryK = S.stepAngry(angry, t, rng, M) * awake;
      if (angryK > 0.5) isHappy = false;
      // Startle eye variants — the eyes turn into ☆_☆ / ♥_♥ (the scene switches the eyes off and substitutes the glyph). k is the startle envelope as it is. They do not change while angry (the fierce eye wins)
      const eyeFx = startle > 0 && surprise.variant && surprise.variant !== "plain" && angryK <= 0.5 ? { kind: surprise.variant, k: startle } : null;
      if (sleepK > 0.5) isHappy = false;

      // Torso
      const sw = R.stepSway(sway, t, M);
      const tiltAngle = S.stepTilt(tilt, t, rng, M);
      const rollAngle = R.stepRoll(roll, t);
      let headBob = E.stepNod(nod, t, rng);
      headBob += E.stepDip(dip, t, rng, M);
      // Body actions (hopping in place) — a different layer from the arm and quad actions. The schedule runs even while forced (fixed rng consumption).
      // A forced jump repeats with a rest between — the jump length plus a 1.2 s period
      let bact = resolveLayer(t, S.stepBodyAction(bodyAction, t, rng, M), BODY_ACTIONS, true, (def, start0) => {
        const period = jumpSpan(def) + 1.2;
        const start = start0 + Math.floor((t - start0) / period) * period;
        return { action: forced, start, until: start + jumpSpan(def) };
      });
      if (asleep || walkK > 0.5 || sitK > 0.5 || five) bact = null;   // no body actions while asleep, walking, sitting or mid-five (the schedule already ran above; a jump would tear the palms apart)
      const jc = bact ? jumpCurve(t - bact.start, BODY_ACTIONS[bact.action]) : { hopY: 0, dropK: 0, flight: 0 };
      // The jump carries no scale — squash here belongs to sleep alone (below). The crouch's descent is
      // solved through the legs, at the legs section
      const hp = { hopY: jc.hopY, squashX: 0, squashY: 0 };
      // Walk — the body lifts slightly with each step
      if (walkK > 0 && W) hp.hopY += W.bob * stepBump * walkK;
      // Sleep — the body settles to the hem and flattens
      if (sleepK > 0 && rig) { hp.hopY -= rig.legTop * sleepK; hp.squashY -= 0.06 * sleepK; hp.squashX += 0.06 * sleepK; }
      // **The float** — a ghost hangs off the floor and drifts, and that is the whole of its movement. A steady
      // lift with a slow sine over it (oscillation itself is the one thing the easing rule exempts), eased IN
      // over the first seconds so it rises into the air rather than being born already up there.
      // The scene needs nothing new for it: hopY lifts the group, and animate.js lets the floor go by itself
      // above hopY 0.02 — this clears that even at the bottom of the drift. The legs let go of their standing
      // bend the way a jump's flight does (floatK, at the legs section), so they hang extended
      let floatK = 0;
      let floatY = 0;   // kept apart from hp.hopY: the arms are dragged up by a JUMP's height, and a float is no jump
      if (F) {
        floatK = ramp(Math.min(1, t / 2.4));
        floatY = floatLift * (1 + Math.sin((t * Math.PI * 2) / F.period + floatPhase) * F.bob) * floatK;
        hp.hopY += floatY;
      }
      const stretchX = E.stepStretch(stretch, t, rng, M);
      const shiverX = E.stepShiver(shiver, t, rng, M);
      // The high five's body — the arm alone is not a slap. The mover CROUCHES — a leg-IK descent, never the
      // scale — and leans away through the wind-up and its hold (anticipation), then swings into the strike
      // with a little hop and a lean the other way; the receiver, at the impact, is pushed off its planted
      // palm with a knee dip (follow-through). All bump/ramp curves off the five's own timeline — no rng,
      // and nothing here runs on a clock that never fives
      let fiveLean = 0;
      let fiveDropK = 0;   // the five's crouch envelope (0~1) — × crouchDrop of the leg length at the legs section
      if (five && armed) {
        const H = ACTIONS.hifive;
        if (five.swings && five.hitAt >= 0) {
          const tau = t - five.hitAt;
          const S2 = H.windup + H.antHold;
          const relK = tau <= S2 ? 0 : ramp((tau - S2) / H.strike);           // the release across the strike
          const anticK = ramp(Math.min(1, tau / H.windup)) * (1 - relK);      // rises through the wind-up, holds, lets go
          const strikeB = tau > S2 ? bump(Math.min(1, (tau - S2) / (H.strike + 0.08))) : 0;   // one push through the slap
          hp.hopY += H.hop * strikeB;
          fiveLean = five.side * (-H.leanBack * anticK + H.leanHit * strikeB);
          fiveDropK = anticK;
        }
        // The receiver takes the hit — pushed away from the palm, with a knee dip's brace
        if (!five.swings && five.impactAt >= 0 && t >= five.impactAt) {
          const k = (t - five.impactAt) / H.recoilDur;
          if (k < 1) {
            fiveLean -= five.side * H.recoilLean * bump(k);
            fiveDropK = 0.4 * bump(k);
          }
        }
      }

      // Arms — idle (the A-pose) by default; with an action, only the arms that action decides are overwritten. Solved onto the rig by IK,
      // with the pendulum, jump and jitter laid on top.
      // The schedule keeps running even while forced (keeping rng consumption identical — releasing the forcing does not disturb the clock).
      const scheduledArm = S.stepArmAction(armAction, t, rng, M);   // the schedule runs even with no arms (fixed rng consumption)
      let act = armed ? resolveLayer(t, scheduledArm, ACTIONS, true,
        (def, start) => ({ action: forced, side: forcedSide, start, until: Infinity })) : null;
      // The high five takes the arm layer — but only once it is this party's moment: a waiting anchor and a
      // mover still far out (beyond carryFrom of its target) keep their scheduled arms. act.def carries the
      // computed pose past the ACTIONS table
      const fiveRemaining = five && five.walkTo != null ? Math.abs(five.walkTo - trip.x) : 0;
      const fiveEngaged = five && armed && !five.wait && !(five.swings && five.hitAt < 0 && fiveRemaining > ACTIONS.hifive.carryFrom);
      if (fiveEngaged) {
        if (five.start < 0) five.start = t;
        let def = ACTIONS.hifive;
        if (five.at) {
          const H = ACTIONS.hifive;
          const reach = arm.upper + arm.lower;
          let tx = five.side * (five.at[0] - trip.x) - arm.x;
          let ty = five.at[1] - arm.y;
          if (five.swings) {
            // The swing: carried short on the way in — reaching, not touching. Arrived (hitAt): the deep pull
            // toward the body (anticipation), the frozen hold, the slap through an upward ARC onto the palm
            // (the palms first meet at its end), and the drive past it that settles back (follow-through)
            const px = tx * H.pull;
            const py = ty + H.lift * reach;
            const cx = tx * H.carry;
            const cy = ty * H.carry;
            if (five.hitAt < 0) { tx = cx; ty = cy; }
            else {
              const tau = t - five.hitAt;
              const S1 = H.windup, S2 = S1 + H.antHold, S3 = S2 + H.strike, S4 = S3 + H.overshoot;
              if (tau < S1) {
                const k = ramp(tau / S1);
                tx = cx + (px - cx) * k; ty = cy + (py - cy) * k;
              } else if (tau < S2) { tx = px; ty = py; }
              else if (tau < S3) {
                const k = ramp((tau - S2) / H.strike);
                const ax = tx, ay = ty;
                tx = px + (ax - px) * k; ty = py + (ay - py) * k + H.arc * reach * bump(k);
              } else if (tau < S4) {
                const dx = tx - px, dy = ty - py;
                const n = Math.hypot(dx, dy) || 1;
                const push = H.punch * reach * bump((tau - S3) / H.overshoot);
                tx += (dx / n) * push; ty += (dy / n) * push;
              }
            }
          } else if (five.impactAt >= 0 && t >= five.impactAt) {
            // The receiver's palm takes the slap — it dips and gives a little sideways, and comes back
            const k = (t - five.impactAt) / H.recoilDur;
            if (k < 1) { ty -= H.recoilDip * reach * bump(k); tx -= H.recoilDip * 0.4 * reach * bump(k); }
          }
          def = { pose: { hand: [tx / reach, ty / reach], bend: "out" }, arms: "one" };
        }
        act = { action: "hifive", side: five.side, start: five.start, until: Infinity, def };
      }
      // A ghost's arms **hang** — every arm an action does not decide falls back to the limp pose instead of the
      // A-pose. (A ghost takes no arm actions at all, so for one it is every arm, always)
      const arms = solveArms(arm, act, t, F ? "limp" : "idle");
      const swing = R.stepArmSwing(armSwing, sway, t, M);
      for (const side of [-1, 1]) {
        const arm = arms[String(side)];
        // The pendulum (opposite phase to the sway) · arms up on a jump · joint jitter. The elbow gets half (the joint boils separately)
        // The arm reaching into a high five keeps only the jitter — the pendulum and the walk swing would pump
        // the palm off the meeting point it is aimed at (the other arm keeps swinging as usual)
        const reaching = five && act && act.action === "hifive" && side === act.side;
        let off = reaching ? 0 : -side * swing;
        // Arms up on a jump — off the hop's height MINUS the float. A jump drags the arms up because the body
        // left the ground under them; a ghost hangs there, and the same term would hold its arms out sideways
        // for good (an imp's reached 93° — straight out from the shoulder)
        const hopDrag = hp.hopY - floatY;
        if (!reaching && hopDrag > 0 && !(walkK > 0.5)) off += side * hopDrag * 4;
        if (!reaching && walkK > 0 && W) off += Math.sin(ph + (side > 0 ? Math.PI : 0)) * W.arm * walkK;   // walk — the arms swing counter to the legs
        off += R.armJitter(armSwing, t, side);
        arm.shoulder += off;
        arm.elbow += off * 0.5;
      }

      // Legs — the idle stance by default (a quad's standing stance from legStance, a biped vertical). Flicks, steps, jumps and jitter go on top.
      const legOffset = M.legStance ? [...M.legStance] : [0, 0, 0, 0];
      const legOsc = [0, 0, 0, 0];
      E.stepLegTap(legTap, t, rng, M, legOffset);
      E.stepLegStep(legStep, t, rng, M, legOffset);
      if (hp.squashY < 0) { legOffset[0] += hp.squashY * 1.5; legOffset[1] -= hp.squashY * 1.5; }   // (sleep's settling — quads)
      // The legs are IK and **the torso is the master**: a crouch is nothing but bodyDrop — how far the body
      // sinks (crouchDrop of the leg's own length; the jump's dropK and the five's crouch are its sources).
      // The clock never touches the knees: the scene eases that one scalar and solves each leg from the
      // DISPLAYED height every frame (animate.js — move the torso and the knees bend by themselves, the feet
      // held to the floor by construction). Mid-air the legs hang with their rest bend — a frog tuck was
      // drawn and removed (actions.js BODY_ACTIONS)
      let bodyDrop = 0;
      if (rig && rig.leg) {
        const leg = rig.leg;
        // Nothing stands dead straight, biped or quad: the torso is carried a touch low **on the ground** (REST_BEND of the leg)
        // and the knees hold the slight fold that comes with it. A stick-straight leg reads as a post, and dead straight
        // is the edge of the solver's reachable band besides. The crouches stack on top; walking swings the bent legs,
        // and the FK feedback in animate.js turns that into the small bob a walk on bent knees actually has.
        // A jump's spring takes the bend away (flight): the legs push through straight and hang extended in the air —
        // held onto, the knees dangled bent and the released foot plant teleported the body at liftoff
        // ...and it is a **standing** bend: sleeping and sitting place the legs themselves (sitPose lays the hind
        // leg forward and solves where the foot lands), so a rest bend folded into those knees moved the foot out
        // from under the pose that had just been solved for it. Faded out by both blends
        const REST_BEND = 0.03;
        const standing = Math.max(0, 1 - sleepK - sitK);
        // A float is airborne the whole time — the same release as a jump's flight, held on — and its knees are
        // folded by that individual's own amount, faded in with the rise so the tuck happens as it leaves the floor
        const dropFrac = REST_BEND * (1 - Math.max(jc.flight, floatK)) * standing + BODY_ACTIONS.jump.crouchDrop * jc.dropK + ACTIONS.hifive.crouchDrop * fiveDropK + floatFold * floatK;
        bodyDrop = leg.y * Math.min(dropFrac, 0.4);
      }
      // Walk — a quad alternates its diagonal pairs (0·3 / 1·2) front and back; a biped's two legs alternately open and close (a walk seen head-on)
      if (walkK > 0 && W) {
        const s = Math.sin(ph) * W.leg * walkK;
        if (quad) { legOffset[0] += s; legOffset[3] += s; legOffset[1] -= s; legOffset[2] -= s; }
        else { legOffset[0] += s; legOffset[1] -= s; }
      }
      for (let i = 0; i < 4; i += 1) legOffset[i] += R.legJitter(t, i);

      // Tail · jelly — the tail's default is the idle angle (tailIdle), with the swish and flick on top. The tip bone (tailTip) is a relative angle against the root
      const swish = R.stepTailSwish(tailSwish, t);
      let tailAngle = (M.tailIdle || 0) + swish;
      let tailTip = 0;
      const flick = E.stepTailFlick(tailFlick, t, rng, M);
      // A cat's flick is **the tip alone tapping** (twitch — the root stays put); a dog flicks the whole tail
      if (TT && TT.twitch) tailTip += flick * (TT.twitch.amp / 0.35);
      else tailAngle += flick;
      if (walkK > 0 && W && quad && W.tail) tailAngle += Math.sin(ph) * W.tail * walkK;   // walk — only a dog's tail sways with the step (table walk.tail)
      // Wagging whenever it smiles (^^) — dogs (table wagOnHappy). The envelope is critically damped, so it does not snap on or off.
      // Seated it slows and shrinks (table seated — a content wag, not the standing one); the phase is integrated so the change of rate never jumps
      if (M.wagOnHappy && quad) {
        const WH = M.wagOnHappy;
        damp(happyWag, isHappy && !asleep ? 1 : 0, 0.3);
        const seatedK = WH.seated ? sitK : 0;
        const wdt = wag.lastT < 0 ? 0 : Math.max(0, t - wag.lastT);
        wag.lastT = t;
        wag.phase += Math.PI * 2 * WH.hz * (1 - seatedK * (1 - (WH.seated ? WH.seated.hz : 1))) * wdt;
        if (happyWag.x > 0.01) tailAngle += Math.sin(wag.phase) * WH.amp * (1 - seatedK * (1 - (WH.seated ? WH.seated.amp : 1))) * happyWag.x;
      }
      // The tuck — a dog's tail tucks under on a plain or ☆ startle (not a ♥ — that one wags): fear, for the startle's first second and a bit
      if (TT && TT.tuck && quad && surprise.start >= 0 && surprise.variant !== "heart") {
        const k = (t - surprise.start) / TT.tuck.dur;
        if (k < 1) tailAngle -= TT.tuck.amp * envelope(k, 0.12, 0.35) * awake;
      }
      // Bristle — fur stands up when scared or **angry**: the anger envelope (angryK — hard up in 0.1 s, hold, released in 0.1 s, the law of a human eye being startled) as it is.
      // Only the thickness swells (the scene scales each bone perpendicular to the spine). It does not stand up on a startle. (The raise of a ♥ startle is handled by the raise below, via the ♥ emoji → ^^.
      // There is no tail lash — a cat lashing its tail is forbidden as a motion; a dog wags)
      // On a startle too — a short bristle (table startlePuff: a bump of dur seconds at the startle's start), whichever is bigger
      const startlePuff = TT && quad && TT.startlePuff && surprise.start >= 0 ? bump(Math.min(1, (t - surprise.start) / TT.startlePuff.dur)) * TT.startlePuff.amp * awake : 0;
      const tailPuff = Math.max(TT && quad && TT.puff ? angryK * TT.puff : 0, startlePuff);
      // Raise — a cat's tail shoots up **whenever it is in a good mood** (^^ — a ^^ blink, the ♥ emoji, a ♥ startle). Regardless of the skeleton shape, the scene blends each joint from its rest pose to
      // **exactly vertical** (tailRaise 0~1) — with no bent variant (bent reads as curved rather than raised). Up in 0.4 s, held for the whole smile (3 s or more), down in 0.6 s.
      // While raised it is **stiff** — the swish, tapping and follow-through are killed by (1 − tailRaise) (without that it wobbles while raised and does not read as standing up). No rng
      let tailRaise = 0;
      let tailRaisePose = null;
      if (TT && TT.raise && quad) {
        const dt = raise.lastT < 0 ? 0 : Math.max(0, t - raise.lastT);
        raise.lastT = t;
        const good = isHappy && !asleep;
        raise.k += Math.max(-dt / 0.6, Math.min(dt / 0.4, (good ? 1 : 0) - raise.k));
        // The shape — a ♥ (the emoji floating, a ♥ startle) makes it the question mark; h follows at the raise's own rates
        const heart = good && !!TT.raisePose && (emoji.kind === "heart" || (surprise.start >= 0 && surprise.variant === "heart"));
        raise.h += Math.max(-dt / 0.6, Math.min(dt / 0.4, (heart ? 1 : 0) - raise.h));
        tailRaise = ramp(raise.k);
        tailAngle *= 1 - tailRaise;
        tailTip *= 1 - tailRaise;
        if (tailRaise > 0) {
          const h = ramp(raise.h);
          tailRaisePose = h > 0 ? TT.raisePose.map((a) => Math.PI / 2 + (a - Math.PI / 2) * h) : null;
          // The tremble — while raised by a ♥ the tip quivers (a very glad greeting); t-based, so its phase never jumps
          if (TT.tremble && h > 0) tailTip += Math.sin(t * Math.PI * 2 * TT.tremble.hz) * TT.tremble.amp * tailRaise * h;
        }
      }
      // The idle pose — while awake, a cat's tail stands in an **arch** (tailPose). A raise takes it out by that much (the sum is 1), sleep folds it back to the skeleton,
      // and sitting takes most of it out (×0.2) so it tilts with the body as the skeleton drew it and lies on the floor
      const tailArch = tailPose && quad ? IP.weight * awake * (1 - tailRaise) * (1 - 0.3 * sitK) : 0;   // seated, a cat keeps 70% of its arch — the tail stays up
      const j = R.stepJelly(jelly, t);

      // Quad actions — one leg or the tail overwritten over idle. Oscillation goes on without easing (legOsc, the tail), faded by an envelope
      // A forced quad action only works if it is in that species' list — a cat does not wag (it is not in the table), so forcing it leaves it idle
      const quadApplies = quad && (!forced || (M.quadActions || []).some(([name]) => name === forced));
      let qact = resolveLayer(t, S.stepQuadAction(quadAction, t, rng, M), QUAD_ACTIONS, quadApplies, (def, start) => {
        const index = def.leg === "front" ? (forcedSide > 0 ? 1 : 0) : def.leg === "hind" ? (forcedSide > 0 ? 3 : 2) : -1;
        return { action: forced, index, start, until: Infinity };
      });
      if (asleep || walkK > 0.5) qact = null;   // no quad actions while asleep or walking
      if (qact) {
        const def = QUAD_ACTIONS[qact.action];
        const env = ramp(Math.max(0, Math.min(1, Math.min((t - qact.start) / 0.35, (qact.until - t) / 0.35))));
        const w = Math.sin((t - qact.start) * Math.PI * 2 * ((def.osc || def.tail?.osc || { hz: 1 }).hz)) * env;
        if (qact.index >= 0) {
          legOffset[qact.index] = def.angle;
          if (def.osc) legOsc[qact.index] = def.osc.amp * w;
        }
        if (def.tail) tailAngle += def.tail.osc.amp * w;
      }

      // The sitting pose — the body tilts about the front legs' root (bodyTilt — the scene rotates the body group) to put the hips on the floor, the front legs vertical, the hind legs folded forward
      // to put the feet on the floor (actions.js sitPose). sitK blends it so sitting and rising are smooth. A leg mid-action (scratching with a hind paw) wins — it scratches while sitting.
      // The tail tilts with the body and drops a little further, to lie on the floor
      if (sitK > 0 && sit) {
        for (let i = 0; i < 4; i += 1) if (!(qact && qact.index === i)) legOffset[i] = legOffset[i] * (1 - sitK) + sit.legs[i] * sitK;
        // Seated, a dog's tail lies on the floor and **stills** — the swish goes out by 90% (a tail sweeping the floor back and forth read as
        // a tail moving down); the tip's taps and flicks carry on, and so does the wag (added after the swish, not scaled here). A cat's tail
        // stays **up** in its arch (tailPose) and keeps swinging — a cat's tail moves up, back and forth, and nowhere else while awake
        if (!tailPose) tailAngle -= (0.3 + swish * 0.9) * sitK * (1 - tailRaise);   // a raised tail stays dead vertical even while seated
      }
      // The sleeping pose — the legs fold under the body (front legs back, hind legs forward), the tail lowers and the head rests on the front paws.
      // sleepK blends it so lying down and getting up are smooth
      if (sleepK > 0) {
        const fold = [1.35, 1.25, -1.3, -1.2];
        for (let i = 0; i < 4; i += 1) legOffset[i] = legOffset[i] * awake + fold[i] * sleepK;
        tailAngle = tailAngle * awake - 0.55 * sleepK;
        tailTip = tailTip * awake - 0.6 * sleepK;   // the tip folds further, against the body
      }
      // Follow-through — the tip bone lags slightly behind, counter to the root's angular velocity (critically damped). One step per tick, so deterministic
      if (TT && TT.follow) {
        const vel = tailPrevBase === null ? 0 : tailAngle - tailPrevBase;   // per tick
        tailPrevBase = tailAngle;
        damp(tailFollow, Math.max(-0.5, Math.min(0.5, -vel * TT.follow * TICK_FPS)), 0.25 * SLOW);   // × ticks per second — the velocity per second
        tailTip += tailFollow.x;
      }
      const sleepHead = sleepK * 0.32 * (key % 2 ? 1 : -1);      // the head tilts to one side as it rests
      const sleepBob = -0.05 * sleepK;

      // Expression states · events
      const md = S.stepMood(mood, t, rng);
      const regenNow = E.stepRegen(regen, t, rng);
      // Breathing — slow and deep when asleep
      const br = R.stepBreathe(breathe, t * (1 - 0.35 * sleepK)) * (1 + 0.6 * sleepK);
      // The z during sleep — every 6 s (the phase is per individual). No rng
      if (sleepK > 0.5) {
        const tick = Math.floor((t - zzzPhase) / 6);
        if (tick !== zzzLast) { zzzLast = tick; triggerEmoji(emoji, "zzz", t); }
      } else zzzLast = -1;

      // Emoji — the scheduled one (occasionally while idle) plus motion's triggers (once, the moment an action starts). The channel runs the animation
      const scheduledEmoji = E.stepEmojiSchedule(emojiSchedule, t, rng, M);
      if (scheduledEmoji) triggerEmoji(emoji, scheduledEmoji, t);
      // (There is no separate tail raise for the ♥ emoji — the ♥ emoji switches ^^ on (happyUntil), and a cat raises its tail during a ^^)
      fireEmoji("arm", act, ACTIONS, t);
      fireEmoji("quad", qact, QUAD_ACTIONS, t);
      const em = stepEmoji(emoji, t);

      return {
        breathe: br, lid, gaze, startle, eyeFx, angry: angryK, regen: regenNow, emoji: em,
        browAlt: F ? false : md.browAlt, mouthAlt: F ? false : md.mouthAlt,   // a ghost's face does not change (the mood, above)
        sway: sw.sway + (walkK > 0 && W ? Math.sin(ph) * W.sway * walkK : 0) + fiveLean, rock: sw.rock,
        headAngle: (tiltAngle + rollAngle) * awake + sleepHead,
        headBob: headBob * awake + sleepBob + (walkK > 0 && W ? W.bob * 0.5 * stepBump * walkK : 0),
        hopY: hp.hopY, squashX: hp.squashX, squashY: hp.squashY, stretchX, shiverX,
        jellyX: j.jellyX, jellyY: j.jellyY, faceTurn: [faceTurn[0], faceTurn[1]],
        happy: isHappy, winkSide, tailAngle, tailTip, tailPuff, tailRaise, tailRaisePose, tailArch, tailPose,
        arms, legOffset, legOsc, bodyDrop,
        mode: F ? "float" : modeName, sleep: sleepK, walk: walkK, sit: sitK, bodyTilt: sit ? sit.tilt * sitK : 0, walkX: trip.x, facing,
        // The action running right now — the arm layer (biped) or the leg and tail layers (quad) plus which side (the active arm's side / the leg index), and the body layer. For debugging and statistics
        action: act ? act.action : qact ? qact.action : null,
        actionSide: act ? act.side : qact ? qact.index : 0,
        bodyAction: bact ? bact.action : null
      };
    }
  };
}
