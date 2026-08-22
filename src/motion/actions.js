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
  raise:  { hand: [0.45, 0.88], bend: "out" },
  hi:     { hand: [0.3, 0.95], bend: "out" },
  wave:   { hand: [0.5, 0.7], bend: "out", osc: { shoulder: 0, elbow: 0.5, hz: 3 } },
  flap:   { hand: [0.75, 0.5], bend: "out", osc: { shoulder: 0.28, elbow: 0.12, hz: 4 } },   // 4 Hz — 6 ticks a cycle at 24; 5 strobed
  point:  { hand: [0.95, 0.3], bend: "down" },
  hips:   { hand: "hip", bend: "out" },
  cross:  { hand: "chestFar", bend: "down" },
  think:  { hand: "chin", bend: "down" },
  salute: { hand: "brow", bend: "out" },
  behind: { behind: true, shoulder: -0.2 }
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
  flap:   { pose: "flap",   arms: "both", hold: [1.5, 3], label: "flapping (fond)", emoji: "heart" }
};

// Body actions — what the whole body does (hopping in place…). **A different layer** from arm and quad actions, so they overlap:
// it can wave while jumping, and a dog can wag while running. Shared by bipeds and quads.
//   jump: hops light (amp) quick (dur seconds) hops in place in a row. Squash and stretch, the arms dragged up and the legs folding
export const BODY_ACTIONS = {
  jump: { hops: 3, dur: 0.42, amp: 0.5, label: "hopping in place (three light hops)" }
};

// The jump curve. tau = time elapsed since the action started. One hop = crouch (20%) → airborne (60%) → landing (20%), running on without a rest.
export function jumpCurve(tau, def) {
  const hop = Math.floor(tau / def.dur);
  if (hop >= def.hops || tau < 0) return { hopY: 0, squashX: 0, squashY: 0 };
  const k = (tau - hop * def.dur) / def.dur;
  const a = def.amp;
  let hopY = 0, squashX = 0, squashY = 0;
  // The crouch and landing squash use bump (velocity 0 at both ends). The airborne trajectory is sin — the moment the feet kick off the ground is meant to pop
  if (k < 0.2) { squashY = -0.07 * a * bump(k / 0.2); squashX = -squashY * 0.8; }
  else if (k < 0.8) { const j = (k - 0.2) / 0.6; hopY = Math.sin(j * Math.PI) * 0.05 * a; squashY = 0.05 * a * Math.sin(j * Math.PI); squashX = -squashY * 0.7; }
  else { squashY = -0.05 * a * bump((k - 0.8) / 0.2); squashX = -squashY * 0.8; }
  return { hopY, squashX, squashY };
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
  // A hind foot must not pass a front foot — a leg is one bone (no knee), so with a short body and long legs the hind foot ends up ahead of the front one. In that case the tilt
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

// One arm's target joint angles. World rotation.z (an arm hanging down is 0, counter-clockwise positive). The left arm is side=−1.
// tau: time elapsed since the action started (the oscillation phase), env: the oscillation envelope 0~1 (a fade as the action comes in and goes out).
export function solveArm(rig, side, poseName, tau = 0, env = 0) {
  const pose = ARM_POSES[poseName];
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

  // Two-bone IK. d is clamped to the reachable range — out of reach it stretches straight, too close it folds to the maximum.
  const d = clamp(Math.hypot(tx, ty), Math.abs(a - b) + 1e-3, reach * 0.995);
  const dir = Math.atan2(tx, -ty);                                       // the target direction, measured counter-clockwise from down (0,−1)
  const alpha = Math.acos(clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1));   // the angle the upper arm opens from the target line
  const gamma = Math.acos(clamp((a * a + b * b - d * d) / (2 * a * b), -1, 1));   // the elbow's inner angle
  const sign = bendSign(tx, ty, pose.bend);
  const shoulder = wrapShoulder(dir + sign * alpha);
  const elbow = -sign * (Math.PI - gamma);

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
export function solveArms(arm, act, t) {
  const arms = {};
  const def = act && ACTIONS[act.action];
  // The oscillation envelope — a 0.35 s fade in and out. Without it the arm snaps the moment an action ends
  const env = def ? ramp(clamp(Math.min((t - act.start) / 0.35, (act.until - t) / 0.35), 0, 1)) : 0;
  for (const side of [-1, 1]) {
    if (!arm) { arms[String(side)] = bindArm(side); continue; }
    const covered = def && (def.arms === "both" || side === act.side);
    arms[String(side)] = covered
      ? solveArm(arm, side, def.pose, t - act.start, env)
      : solveArm(arm, side, "idle", 0, 0);
  }
  return arms;
}
