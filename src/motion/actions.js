// The action catalog — the "things" a character does. Arms up, arms crossed, waving hello, a hand on the chin, a salute…
// Docs: guidelines/motion/catalog.md § the bind pose and arm actions
//
// The base motion is **idle** — arms slightly open (an A-pose), breathing and shaking finely. An action **stacks**
// on top of idle: only the parts the action decides change, and the rest (the other arm, the body, the face) keeps idling.
// Which is why a wave decides one arm only — the other stays down at idle. Arms-up and arms-crossed decide both.
// Bind (the T-pose) is not an action. It is the rig's state when there is no motion, and it is only visible in the BIND view.
//
// An arm pose is written as a **hand target**, not as joint angles. It takes the rig (shoulder position, upper and lower arm lengths, body anchors —
// character/draw/limbs.js motionRig().arm) and solves the angles with two-bone IK. So whatever the arm length,
// "hands on hips" lands on the hips and "a hand on the chin" lands on the chin. When the hand cannot reach, it stretches straight that way.

import { BIND_ARM } from "../character/index.js";
import { ramp, bump } from "./ease.js";

// One arm pose = what one arm does.
//   hand    the hand target. [x, y] is a multiple of reach (upper + lower arm) — origin at the shoulder, x positive outward, y positive up.
//           A string is a rig anchor name (body coordinates, for the right arm. The left arm mirrors x).
//   bend    the side the elbow sticks out. "out" outward / "down" downward
//   floor   the hand cannot go below the floor (for long arms hanging down)
//   osc     oscillation laid over the pose { shoulder, elbow: amplitude in rad, hz }. It does not go through easing
//   behind  hands behind the back — the arms disappear behind the body and only the back sketch shows. No IK
export const ARM_POSES = {
  idle:   { hand: [0.5, -0.86], bend: "out", floor: true },   // the default. A 30° open A-pose, elbow slightly bent
  // Hanging — a ghost's arms, and the rest pose of anything that floats. 9° off vertical instead of the A-pose's
  // 30°, at the same near-full reach: limp, not held open. **No floor clamp** — the whole point is that it is off
  // the ground, and clamping the hand at the standing floor would shorten the hang the higher it drifts
  limp:   { hand: [0.16, -0.98], bend: "out" },
  raise:  { hand: [0.45, 0.88], bend: "out" },
  hi:     { hand: [0.3, 0.95], bend: "out" },
  wave:   { hand: [0.5, 0.7], bend: "out", osc: { shoulder: 0, elbow: 0.5, hz: 3 } },
  flap:   { hand: [0.75, 0.5], bend: "out", osc: { shoulder: 0.28, elbow: 0.12, hz: 4 } },   // 4 Hz — 6 ticks a cycle at 24; 5 strobed
  point:  { hand: [0.95, 0.3], bend: "down" },
  hips:   { hand: "hip", bend: "out" },
  cross:  { hand: "chestFar", bend: "down" },
  think:  { hand: "chin", bend: "down" },
  salute: { hand: "brow", bend: "out" },
  behind: { behind: true, shoulder: -0.2 },
  hifive: { hand: [0.72, 0.55], bend: "out" }   // the palm up and forward — the plant half of a high five (scene/hifive.js aims the other half at it)
};

// An action = a pose + which arms (arms: "one" / "both") + a hold time. An arm not decided stays idle.
// A one-arm action draws which side is active at the start. emoji is an emoji trigger fired as the action starts (emoji.js).
export const ACTIONS = {
  wave:   { pose: "wave",   arms: "one",  hold: [1.5, 3], label: "waving hello" },
  hi:     { pose: "hi",     arms: "one",  hold: [2, 4],   label: "one hand up (me!)" },
  point:  { pose: "point",  arms: "one",  hold: [2, 4],   label: "pointing" },
  think:  { pose: "think",  arms: "one",  hold: [3, 6],   label: "hand on the chin (thinking)", emoji: "quest" },
  salute: { pose: "salute", arms: "one",  hold: [2, 4],   label: "a salute" },
  raise:  { pose: "raise",  arms: "both", hold: [2, 4],   label: "arms up" },
  cross:  { pose: "cross",  arms: "both", hold: [3, 7],   label: "arms crossed" },
  hips:   { pose: "hips",   arms: "both", hold: [3, 7],   label: "hands on hips" },
  behind: { pose: "behind", arms: "both", hold: [3, 7],   label: "hands behind the back" },
  flap:   { pose: "flap",   arms: "both", hold: [1.5, 3], label: "flapping (fond)", emoji: "heart" },
  // Not in any species' armActions pool — the scene schedules it per pair (scene/hifive.js), and the ACTION
  // card can force the static pose to judge it. The swing is built on the twelve principles, exaggeration
  // required (guidelines/motion/catalog.md § the high five names which number does what):
  //   approach   the mover hurries — the commanded trip runs at this multiple of the walk speed
  //   carryFrom  within this many cells of the target the hand comes up, carried carry short of the palm
  //   windup     ANTICIPATION — the hand pulls deep toward the body (to pull of its outward distance, lifted
  //              by lift of reach) while the body crouches — a leg-IK descent (crouchDrop of the leg length,
  //              the same solve the jump uses; never the scale) — and leans away (leanBack)
  //   antHold    ...and HOLDS there, frozen, before the release (timing: long in, short out)
  //   strike     the slap — through an upward ARC (arc of reach), the body swinging into it (leanHit) with a
  //              little hop. The palms first touch at its end
  //   punch      FOLLOW-THROUGH — the palm drives past the contact and settles back (over overshoot s)
  //   recoil*    the receiver takes the hit: the planted hand dips (recoilDip of reach), the body is pushed
  //              off it (recoilLean) with a knee dip, over recoilDur s
  //   happy      SECONDARY ACTION — both smile ^^ this long from the impact
  hifive: {
    pose: "hifive", arms: "one", hold: [1.2, 2], label: "high five!",
    approach: 2.2, carryFrom: 0.5, carry: 0.8,
    windup: 0.3, antHold: 0.14, strike: 0.12, overshoot: 0.12,
    pull: 0.12, lift: 0.18, arc: 0.12, punch: 0.07,
    crouchDrop: 0.12, leanBack: 0.09, leanHit: 0.1, hop: 0.015,
    recoilDip: 0.1, recoilLean: 0.05, recoilDur: 0.24,
    happy: 3.2
  }
};

// Body actions — what the whole body does (hopping in place…). **A different layer** from arm and quad actions, so they overlap:
// it can wave while jumping, and a dog can wag while running. Shared by bipeds and quads.
//
// The jump is built on the twelve principles (guidelines/motion/catalog.md § body actions names which does what)
// — and **the deformation is the skeleton's, never the scale's**: no rubbery squash-and-stretch on the body.
// The legs are IK, like the arms: a crouch is written as **how far the body sinks** (crouchDrop of the leg's
// length) with the feet held to their spot on the floor, and the clock solves each individual's thigh and knee
// onto that (solveLeg) — never a table of joint angles.
//   antic       ANTICIPATION — before the first spring it sinks into a deep knee-bent crouch (slow in)
//   crouchDrop  the crouch itself — the body's descent, as a fraction of the leg length. The knees bow out
//               (a plié seen head-on) because the solve bends them there
//   amp         the flight's height (the arc — position, not scale)
//   settle      FOLLOW-THROUGH — after the last landing, one soft knee dip and recover
//   Mid-air the legs simply hang — the standing rest bend and nothing else. A frog tuck (tuckFoot) was
//   drawn and removed: folding the legs at the top of every hop read as a trick, not a hop
//   The landings ramp straight into the next crouch (timing: slow in, pop out), and the arms are dragged up
//   by the flight (motion/index.js, hopY×4 — overlapping action through the joints' damping)
export const BODY_ACTIONS = {
  jump: {
    hops: 3, dur: 0.56, amp: 0.8, label: "hopping in place (crouch and spring)",
    antic: 0.35,
    crouchDrop: 0.16,
    settle: 0.3
  }
};

// The dance — the chorus of *Dumb Ways to Die*, as the video dances it. A **base state** (motion/index.js — like walk, a blend and a
// t-based phase), forced from the screen's DANCE and never scheduled; bipeds only (table.js `dance`, null on the quads, which stand
// through it the way a build that cannot sit does). What is here is the song's — one clock for the whole cast: the phase runs off the
// board's time, not the individual's birth, so every dancer is on the same beat. How far each species leans, steps and bobs is its own
// (table.js dance).
//
// The routine, from the video (the Dumb Ways to Die wiki's dancer pages) and the chorus's own timing (128 bpm, 4/4 — Wikipedia; the
// synced lyrics: "Dumb ways to die · so many dumb ways to die" 0~7.5 s, "dumb ways to di-i-i-ie" 7.5~11, "so many dumb ways to die"
// 11~ and a breath before the next verse — 16.4 s, 35 beats; the loop is 36). Three kinds of dancer, by roll:
//   standard   hula dancing and pacing to the beat (the hips swinging one side per beat, a side-step with them, the legs scissoring,
//              the arms out at the sides, one rising as the other dips) through the first two lines · a SPIN on "dumb ways to di-" (a
//              card turning through paper) · the JUMP on the held note (one big crouch-and-spring) · then the arms up over the head
//              swaying side to side with the body, two beats a side, to the end
//   secondary  stands and claps over its head on every beat, claps twice in a row right after the standard dancers' jump (the two
//              claps in the song), then swings its arms with the rest
//   tertiary   nothing but the arm sway, the whole way
// Every dancer sings — the mouth moves on the half beat while a line is sung
export const DANCE = {
  bpm: 128,                 // the song's tempo; the beat is the board's clock (index.js)
  beats: 36,                // the loop — one chorus, nine bars
  // the standard dance, in beats of the loop: hula [from, to] · spin [from, to] · the jump's start · the two claps · the arm sway [from, to]
  phases: { hula: [0, 16], spin: [16, 20], jump: 20, claps: [23.5, 24], sway: [24, 36] },
  edge: 0.75,               // beats a phase fades in and out over — the seams crossfade, the loop's included
  swayBeats: 2,             // beats per side in the arm sway (the hula sways one per side)
  head: { hula: -0.6, sway: 0.35 },   // the head against the lean: it stays up while the hips swing (the bean's), and goes over with the arm sway
  jump: { hops: 1, dur: 0.75, amp: 1.3, antic: 0.47, settle: 0.25 },   // one big crouch-and-spring (jumpCurve) — 1.47 s, three beats and a bit
  // hand targets as multiples of reach [x outward, y up]: out — the hula arms, wave how far one rises as the other dips (the hand
  // stays above the shoulder line: every dance target keeps y > 0, so the elbow's side never flips mid-move) · apart — the clap's
  // open hands, clapUp how much they lift as they meet at the centre line · up — the sway's hands over the head, x the tilt a side
  hands: { out: [0.85, 0.14], wave: 0.12, apart: [0.3, 0.9], clapUp: 0.08, up: [0.32, 0.92] },
  clapBeats: 2,             // a clap every this many beats — on two and four — until the double clap after the jump
  roles: [13, 17],          // by roll, of 20: below the first standard (65%), below the second secondary (20%), the rest tertiary (15%)
  sing: 31,                 // the mouth moves on the half beat while a line is sung — up to this beat of the loop
  label: "the Dumb Ways chorus (bipeds)"
};

// Which of the video's three dances this individual does, off its roll
export function danceRole(key) {
  const r = key % 20;
  return r < DANCE.roles[0] ? "standard" : r < DANCE.roles[1] ? "secondary" : "tertiary";
}

// One tick of the dance at beat b of the loop (0 ≤ b < DANCE.beats), for a role, with this species' amplitudes D (table.js dance) and
// the arm rig (a clap meets at the centre line, −arm.x in shoulder terms). Everything is a function of b — no rng, no state — so every
// dancer on a screen, born whenever, is on the same beat. What comes back is laid over idle by the clock:
//   lean rad (sway) · scoot units (the side-step, shiverX) · step rad (the legs' scissor) · bob units (on the beat, hopY) · head rad ·
//   bounce (a knee dip on the beat, a fraction of the leg) · spin (the facing multiplier: 1 → 0 → −1 → 0 → 1, a card turning) ·
//   jump {hopY, dropK, flight} (jumpCurve's) · hand(side) the hand target [x, y] in reach multiples · sing
export function danceFrame(b, role, D, arm) {
  const P = DANCE.phases, e = DANCE.edge, N = DANCE.beats, H = DANCE.hands;
  const frac = (x) => x - Math.floor(x);
  // a window from a to c, faded e beats over each end; the loop's seam is looked at one loop either way
  const win = (a, c) => {
    let w = 0;
    for (const o of [0, -N, N]) {
      const x = b + o;
      w = Math.max(w, ramp((x - a + e / 2) / e) * (1 - ramp((x - c + e / 2) / e)));
    }
    return w;
  };
  const onBeat = bump(frac(b + 0.5));                                 // 0→1→0 once a beat, peaking ON the beat
  const hulaLean = Math.sin(b * Math.PI);                             // one side per beat
  const swayLean = Math.sin((b / DANCE.swayBeats) * Math.PI);        // two beats a side (the sway starts on a multiple of four, so the seam holds)
  const standard = role === "standard", secondary = role === "secondary";
  const wHula = standard ? win(P.hula[0], P.hula[1]) : 0;
  const wOut = standard ? win(P.hula[0], P.sway[0]) : 0;             // the arms out — through the hula, the spin and the jump
  const wClap = secondary ? win(P.hula[0], P.sway[0]) : 0;
  const wSway = role === "tertiary" ? 1 : win(P.sway[0], P.sway[1]);
  // The claps — on two and four (clapBeats), and two in a row, a half beat apart, right after the jump
  let clapK = 0;
  if (secondary) {
    const from = P.claps[0] - 0.25;
    clapK = b < from ? bump(frac((b - 1) / DANCE.clapBeats + 0.5)) : b < P.claps[1] + 0.25 ? bump(frac((b - from) * 2 + 0.5)) : 0;
  }
  // The spin — one turn, eased in and out, the card thinning to paper and back mirrored
  const spin = standard && b >= P.spin[0] && b < P.spin[1] ? Math.cos(Math.PI * 2 * ramp((b - P.spin[0]) / (P.spin[1] - P.spin[0]))) : 1;
  // The jump — the standard dancers', from its beat; jumpCurve is zero once it has settled
  const jump = standard && b >= P.jump ? jumpCurve(((b - P.jump) * 60) / DANCE.bpm, DANCE.jump) : { hopY: 0, dropK: 0, flight: 0 };
  const centre = arm ? -arm.x / (arm.upper + arm.lower) : -0.2;
  const idle = ARM_POSES.idle.hand;
  const hand = (side) => {
    const rest = Math.max(0, 1 - wOut - wClap - wSway);
    const yOut = H.out[1] + H.wave * -side * hulaLean * (wOut > 0 ? wHula / wOut : 0);   // the hula's wave rides on the out pose
    const clapX = H.apart[0] * (1 - clapK) + centre * clapK;
    const clapY = H.apart[1] + H.clapUp * clapK;
    return [
      H.out[0] * wOut + clapX * wClap + -side * H.up[0] * swayLean * wSway + idle[0] * rest,   // both hands to the lean's side: one world direction
      yOut * wOut + clapY * wClap + H.up[1] * wSway + idle[1] * rest
    ];
  };
  return {
    lean: D.lean * (hulaLean * wHula + 0.8 * swayLean * wSway),
    scoot: D.scoot * hulaLean * wHula,
    step: D.step * hulaLean * wHula,
    bob: D.bob * onBeat * (wHula + 0.6 * wClap),
    head: D.lean * (DANCE.head.hula * hulaLean * wHula + DANCE.head.sway * swayLean * wSway),
    bounce: D.bounce * onBeat * wSway,
    spin, jump, hand,
    sing: b < DANCE.sing && Math.floor(b * 2) % 2 === 0
  };
}

// The whole timeline of one action, for scheduling — the anticipation, the hops, the settle
export function jumpSpan(def) {
  return (def.antic || 0) + def.hops * def.dur + (def.settle || 0);
}

// **How long a five's swing takes to land** — from the wind-up beginning to the palms meeting. A contract across
// modules, not a local sum: the scene tells the anchor when to recoil and smile (scene/hifive.js) and the mover's
// arm reaches the other palm at the same instant (motion/index.js). Written out at all three, they could drift and
// only scripts/hifive-sim.mjs would see it
export function swingSpan(H = ACTIONS.hifive) {
  return H.windup + H.antHold + H.strike;
}

// The jump curve. tau = time elapsed since the action started (the anticipation included).
// Returns { hopY, dropK, flight } — envelopes, not angles: dropK (0~1) is how far into the crouch's
// descent the body is (the clock turns it into a foot-planted leg solve). flight (0~1) is how far off the
// ground the jump is — 0 planted, ramping through the spring, 1 in the air, back down through the landing.
// The clock lets the standing rest bend go by it: a spring pushes through **straight**, and legs that kept
// their bend read as dangling while the body teleported up at liftoff. No scale channels.
// (a `splay` channel folded a quad's one-bone legs here; quads have two-bone legs and take the crouch through
// bodyDrop like a biped, so it went)
export function jumpCurve(tau, def) {
  const zero = { hopY: 0, dropK: 0, flight: 0 };
  if (tau < 0) return zero;
  const antic = def.antic || 0;
  // Anticipation — sink into the crouch (slow in). Held by the shape of ramp until the first spring takes it
  if (tau < antic) {
    const k = ramp(tau / antic);
    return { hopY: 0, dropK: k, flight: 0 };
  }
  const hopT = tau - antic;
  const hop = Math.floor(hopT / def.dur);
  // Follow-through — after the last landing, one soft knee dip and recover, then done
  if (hop >= def.hops) {
    const settle = def.settle || 0;
    const k = settle > 0 ? (hopT - def.hops * def.dur) / settle : 1;
    if (k >= 1) return zero;
    const b = bump(k) * 0.35;
    return { hopY: 0, dropK: b, flight: 0 };
  }
  const k = (hopT - hop * def.dur) / def.dur;
  // Every hop is the same full cycle — **crouch (a held beat) → spring → air → land into the next crouch** —
  // at the same depth each time: crouch-and-spring, crouch-and-spring, crouch-and-spring. The first crouch is
  // the anticipation above holding on; the last landing comes down clean and the settle does its soft dip
  const B = 0.24, SP = 0.14, LA = 0.12;   // the crouch beat · the spring · the landing (fractions of one hop; the air is the rest)
  let hopY = 0, dropK = 0, flight = 0;
  if (k < B) {
    // The crouch, held — the breath and the boil keep it alive; the stillness IS the anticipation
    dropK = 1;
  } else if (k < B + SP) {
    // The spring — the legs push through **straight** (flight rises, taking the rest bend with the crouch)
    // and the body rides up off them. The moment the feet leave is meant to pop
    dropK = 1 - (k - B) / SP;
    flight = (k - B) / SP;
  } else if (k < 1 - LA) {
    // Airborne — the arc (position, never scale). The legs hang extended, the rest bend let go with the spring
    const j = (k - B - SP) / (1 - B - SP - LA);
    hopY = Math.sin(j * Math.PI) * 0.055 * def.amp;
    flight = 1;
  } else {
    // Landing — the legs reach for the floor and absorb, ramping straight into the next crouch's depth; the last lands clean
    dropK = ramp((k - (1 - LA)) / LA) * (hop === def.hops - 1 ? 0 : 1);
    flight = 1 - (k - (1 - LA)) / LA;
  }
  return { hopY, dropK, flight };
}

// Quad actions — one leg or the tail doing something briefly. The quad rig is pivot rotation only, so these are angles, with no IK.
// They stack over idle (the standing stance — table.js legStance, tailIdle), and a leg or tail not decided stays at idle.
//   leg   which pair to draw one from ("front" the front legs 0/1, "hind" the hind legs 2/3). angle: the pivot angle (rad, negative = the foot toward the head)
//   osc   oscillation laid on without easing { amp, hz }. tail: oscillation laid on the tail
export const QUAD_ACTIONS = {
  scratch: { leg: "hind",  angle: -0.9, osc: { amp: 0.15, hz: 6 }, hold: [1, 2.2],  label: "scratching with a hind paw" },
  wag:     { tail: { osc: { amp: 0.35, hz: 3 } },                   hold: [1.5, 3],  label: "wagging the tail", emoji: "heart" }   // 3 Hz — 8 ticks a cycle at 24 (4 strobed)
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const FLOOR_MARGIN = 0.035;

// The sitting pose — the content of the quad base state sit (motion/index.js blends it with idle by sitK). Solved from the rig dimensions (motionRig().body) —
// whatever the leg length or body length, it sits the same way.
//   The body is tilted **about the front legs' root** so the back goes down (tilt, clockwise = negative), bringing the hip reference point to the floor,
//   the front legs stand at world angle 0 (vertical), and the hind legs fold forward to the angle (φ) that puts the feet on the floor. The head is directly above the axis, so it stays put.
//   tilt   the body tilt in rad. legs [4] the legs' pivot angles in **local** terms (a pivot is a child of the body group, so world angle − tilt)
export function sitPose(body) {
  const { hipY, bodyH, bodyW, bodyCx, frontHipX, hindHipX, legTop } = body;
  // The hip reference point — low at the back of the body (x = centre + 0.75 width, y = hem + 0.2 height). Relative to the front legs' root. Touching down 0.01 above the floor
  const dx = bodyCx + bodyW * 0.75 - frontHipX;
  const dy = legTop + bodyH * 0.2 - hipY;
  // Solving hipY − dx·sinθ + dy·cosθ = 0.01 for θ — a few iterations settle it
  let theta = Math.asin(clamp(hipY / dx, 0, 0.85));
  for (let i = 0; i < 4; i += 1) theta = Math.asin(clamp((hipY - 0.01 + dy * Math.cos(theta)) / dx, 0, 0.85));
  theta = clamp(theta, 0.1, 0.75);
  // Hind legs — from the root height after the tilt (hipH), the angle φ at which laying the leg (of length hipY) forward puts the foot on the floor. Foot x = root x − hipY·sinφ
  const dxh = hindHipX - frontHipX;
  const solve = (th) => {
    const phi = Math.acos(clamp((hipY - dxh * Math.sin(th)) / hipY, 0.12, 1));
    return { phi, footX: frontHipX + dxh * Math.cos(th) - hipY * Math.sin(phi) };
  };
  // A hind foot must not pass a front foot — the sit lays the whole leg forward from the hip (the knee's fold is the crouch solve's, and the rest bend fades out while sitting), so with a short body and long legs the hind foot ends up ahead of the front one. In that case the tilt
  // is reduced (the hips lift a little) so the hind foot comes no further than between the front pair (the front legs' root x). A smaller tilt puts the hind foot further back, hence the bisection
  const minFootX = frontHipX + 0.005;
  let r = solve(theta);
  if (r.footX < minFootX) {
    let lo = 0.08, hi = theta;
    for (let i = 0; i < 24; i += 1) { const mid = (lo + hi) / 2; if (solve(mid).footX < minFootX) hi = mid; else lo = mid; }
    theta = lo; r = solve(theta);
  }
  // If the hips still sit more than 0.045 off the floor (long legs plus a short body — 9% of 600 creatures), this build cannot sit → null. The clock just stands through the sit state
  const rumpY = hipY - dx * Math.sin(theta) + dy * Math.cos(theta);
  if (rumpY > 0.045) return null;
  return { tilt: -theta, legs: [theta, theta, theta - r.phi, theta - r.phi] };
}   // slightly larger than the hand dot's radius (0.022)

// Winds the shoulder angle into (−135°, 225°] — with bind (90°) in the middle. An angle crossing
// the −180°/180° boundary makes the rig's easing take the long way round and the arm swings a full circle (a salute, an up-and-inward target, is −226° unwound).
const wrapShoulder = (angle) => {
  const lo = -Math.PI * 0.75;
  let a = angle;
  while (a <= lo) a += Math.PI * 2;
  while (a > lo + Math.PI * 2) a -= Math.PI * 2;
  return a;
};

// Bind (T-pose) arms. Multiplied by side into a world rotation.z.
export function bindArm(side) {
  return { shoulder: side * BIND_ARM[0], elbow: side * BIND_ARM[1], behind: false, oscShoulder: 0, oscElbow: 0 };
}

// Which way the elbow bends. Relative to the shoulder→hand line (L), +1 if the want direction is counter-clockwise of it, −1 if clockwise.
// (Setting shoulder angle = target direction + sign·α puts the elbow counter-clockwise of L.)
function bendSign(lx, ly, want) {
  const [wx, wy] = want === "down" ? [0, -1] : [1, 0];
  const cross = lx * wy - ly * wx;
  return cross >= 0 ? 1 : -1;
}

// The two-bone solve every jointed limb shares — an arm's shoulder/elbow and a leg's thigh/knee run the same
// law of cosines. Target [tx, ty] from the root joint, x outward; a and b the bone lengths; sign which side
// the middle joint sticks out. d is clamped to the reachable band — out of reach it stretches straight toward
// the target, too close it folds to the maximum.
function twoBone(a, b, tx, ty, sign) {
  const d = clamp(Math.hypot(tx, ty), Math.abs(a - b) + 1e-3, (a + b) * 0.995);
  const dir = Math.atan2(tx, -ty);                                                // the target direction, measured counter-clockwise from down (0,−1)
  const alpha = Math.acos(clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1));   // the angle the upper bone opens from the target line
  const gamma = Math.acos(clamp((a * a + b * b - d * d) / (2 * a * b), -1, 1));   // the middle joint's inner angle
  return { upper: dir + sign * alpha, lower: -sign * (Math.PI - gamma) };
}

// A leg pose is a **foot target**, the same law as an arm's hand target (guidelines/motion/rules.md — never a
// table of joint angles): [x outward from the hip, y up from the hip], solved onto THIS individual's thigh and
// shin (character motionRig().leg — null on a float leg, which returns straight). Returns the world thigh angle
// and the relative knee fold. `bend` is which way the fold bows: on a biped seen head-on the knees bow outward,
// a plié, so it is the leg's own side; on a quad seen from the side the **hind** knee bends forward like a real
// stifle while the front folds back, which is the limb's own `knee` (character draw/limbs.js).
// The scene's crouch solve (animate.js) is its one caller.
export function solveLeg(leg, bend, tx, ty) {
  if (!leg) return { thigh: 0, knee: 0 };
  const ik = twoBone(leg.thigh, leg.shin, tx, ty, 1);
  return { thigh: bend * ik.upper, knee: bend * ik.lower };
}

// One arm's target joint angles. World rotation.z (an arm hanging down is 0, counter-clockwise positive). The left arm is side=−1.
// tau: time elapsed since the action started (the oscillation phase), env: the oscillation envelope 0~1 (a fade as the action comes in and goes out).
export function solveArm(rig, side, poseName, tau = 0, env = 0) {
  // A pose may come in as an object instead of a name — the high five's reaching hand is a target computed
  // per tick (the partner's hand in this creature's shoulder terms), not a table entry
  const pose = typeof poseName === "string" ? ARM_POSES[poseName] : poseName;
  if (!pose || !rig) return bindArm(side);
  const anchors = rig.anchors;
  if (pose.behind) return { shoulder: side * pose.shoulder, elbow: 0, behind: true, oscShoulder: 0, oscElbow: 0 };

  const a = rig.upper;
  const b = rig.lower;
  const reach = a + b;

  // The hand target — origin at the shoulder, in outward coordinates (for the right arm. Anchors are for the right arm too, so side does not matter)
  let tx;
  let ty;
  if (typeof pose.hand === "string") {
    const anchor = anchors[pose.hand];
    tx = anchor[0] - rig.x;
    ty = anchor[1] - rig.y;
  } else {
    tx = pose.hand[0] * reach;
    ty = pose.hand[1] * reach;
  }
  if (pose.floor) ty = Math.max(ty, anchors.ground - rig.y + FLOOR_MARGIN);

  // Two-bone IK (the shared solve above), the bend side from the pose
  const ik = twoBone(a, b, tx, ty, bendSign(tx, ty, pose.bend));
  const shoulder = wrapShoulder(ik.upper);
  const elbow = ik.lower;

  let oscShoulder = 0;
  let oscElbow = 0;
  if (pose.osc && env > 0) {
    const w = Math.sin(tau * Math.PI * 2 * pose.osc.hz) * env;
    oscShoulder = pose.osc.shoulder * w;
    oscElbow = pose.osc.elbow * w;
  }
  return {
    shoulder: side * shoulder,
    elbow: side * elbow,
    behind: false,
    oscShoulder: side * oscShoulder,
    oscElbow: side * oscElbow
  };
}

// Solves both arms. idle by default; with an action (act = { action, side (the active arm), start, until }) only the arms
// that action decides are overwritten. With no arm rig (a quad), bind.
// rest: the pose an arm this action does not decide falls back to — "idle" (the A-pose) for anything standing,
// "limp" for a ghost, whose arms hang. It is the base of every arm, so it belongs here and not in each action
export function solveArms(arm, act, t, rest = "idle") {
  const arms = {};
  const def = act && (act.def || ACTIONS[act.action]);   // act.def: a computed action (the high five's reach) instead of a table entry
  // The oscillation envelope — a 0.35 s fade in and out. Without it the arm snaps the moment an action ends
  const env = def ? ramp(clamp(Math.min((t - act.start) / 0.35, (act.until - t) / 0.35), 0, 1)) : 0;
  for (const side of [-1, 1]) {
    if (!arm) { arms[String(side)] = bindArm(side); continue; }
    const covered = def && (def.arms === "both" || side === act.side);
    arms[String(side)] = covered
      ? solveArm(arm, side, def.poseOf ? def.poseOf(side) : def.pose, t - act.start, env)   // poseOf: a target per side (the dance — both hands to one world side)
      : solveArm(arm, side, rest, 0, 0);
  }
  return arms;
}
