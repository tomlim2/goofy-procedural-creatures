// Held states — you enter, stay a few seconds and come back. There is no progress curve, just on/off.
//   ^^ happy eyes · wink · brow state · mouth state · head tilt (a held target angle) · action layers (arm, body, quad) · look (a held face turn) · base state (idle/sleep/walk)
// Docs: guidelines/motion/catalog.md
//
// Shape: { next: the next entry time, until: when the hold ends (otherwise -1) }

import { ACTIONS, QUAD_ACTIONS, BODY_ACTIONS, jumpSpan } from "./actions.js";
import { ramp, approach } from "./ease.js";

const schedule = (rng, range) => (range ? rng.float(range[0], range[1]) : Infinity);

// (The half-lidded hold is gone — an eye is either open or shut. Only init remains, to keep rng order)
export function initSquint(rng) { return { next: rng.float(6, 18), until: -1 }; }
export function initMood(rng) { return { nextMood: rng.float(3, 10), moodUntil: -1, nextMouth: rng.float(2, 8), mouthUntil: -1 }; }
export function initTilt(rng, M) { return { next: rng.float(M.tilt[0], M.tilt[1]), until: -1, target: 0, angle: 0 }; }
// Arm actions. From idle it crosses over to an action (raise, wave, cross, behind the back, hands on hips, hand on chin…) now and then and comes back.
// The kinds and weights are armActions in table.js; what an action does is in actions.js.
export function initArmAction(rng) { return { action: null, side: 1, start: -1, next: rng.float(8, 24), until: -1 }; }
export function initWink(rng, M) { return { next: schedule(rng, M.wink), until: -1, side: 0 }; }
// Look — turns the face one way (left, right, up, down, diagonal) and stays a few seconds. The gaze goes that way too.
export function initLook(rng, M) { return { next: schedule(rng, M.look), until: -1, dir: [0, 0] }; }
export function initHappy(rng, M) { return { next: schedule(rng, M.happyHold), until: -1 }; }
// Anger — fierce eyes and a bared-tooth mouth (plus angry brows where there are brows); a cat's tail fur stands up. Table's angry [interval] · angryHold [hold] (3 s or more)
export function initAngry(rng, M) { return { next: schedule(rng, M.angry), start: -1, until: -1 }; }

// ^^ hold — eyes fully shut and happy
export function stepHappy(s, t, rng, M) {
  if (t >= s.next && s.until < 0) { s.until = t + rng.float(3, 6); s.next = t + rng.float(M.happyHold[0], M.happyHold[1]); }   // a ^^ hold is 3 s or more
  if (s.until >= 0) {
    if (t >= s.until) s.until = -1;
    else return true;
  }
  return false;
}
// Anger 0~1 — the expression follows the same law as a human eye being startled: up hard in 0.1 s, then after the hold released in 0.1 s (velocity 0 at both ends). rng only at the start
export function stepAngry(s, t, rng, M) {
  if (t >= s.next && s.until < 0) {
    s.start = t;
    s.until = t + rng.float(M.angryHold[0], M.angryHold[1]);
    s.next = t + rng.float(M.angry[0], M.angry[1]);
  }
  if (s.until >= 0) {
    if (t >= s.until + 0.1) { s.until = -1; return 0; }
    return ramp(Math.min(1, (t - s.start) / 0.1)) * (t < s.until ? 1 : 1 - ramp((t - s.until) / 0.1));
  }
  return 0;
}
export function stepWink(s, t, rng, M) {
  if (t >= s.next && s.until < 0) {
    s.side = rng.chance(0.5) ? -1 : 1;
    s.until = t + rng.float(3, 5);   // a wink is 3 s or more — there is no expression that flickers past
    s.next = t + rng.float(M.wink[0], M.wink[1]);
  }
  if (s.until >= 0 && t >= s.until) { s.until = -1; s.side = 0; }
  return s.side;
}
// Head tilt — the target angle held a few seconds, the angle eased
export function stepTilt(s, t, rng, M) {
  if (t >= s.next && s.until < 0) {
    s.target = rng.around(0, M.tiltAmp);
    s.until = t + rng.float(1.2, 3.2);
    s.next = t + rng.float(M.tilt[0], M.tilt[1]);
  }
  if (s.until >= 0 && t >= s.until) s.until = -1;
  s.angle = approach(s.angle, s.until >= 0 ? s.target : 0, 0.07);
  return s.angle;
}
// -- action layer scheduling (shared by arm, body and quad) --
// From idle into an action, and back to idle when hold ends. Each layer schedules separately, so they overlap (waving mid-jump).
// rng order: weighted(action) → [chance(side)] → [float(hold)] → float(gap). Layer options do not change this order.
//   pool  [action, weight] (table.js). Without one, the schedule just passes through
//   gap   [min, max] until the next start. defaultGap when the table has none
//   defs  the action table (actions.js). side: is an active side drawn. hold(def, rng): the hold time
function stepActionLayer(s, t, rng, pool, gap, defaultGap, defs, { side = false, hold }) {
  if (t >= s.next && s.until < 0) {
    if (pool.length) {
      s.action = rng.weighted(pool);
      s.side = side ? (rng.chance(0.5) ? -1 : 1) : 0;
      s.start = t;
      s.until = t + hold(defs[s.action], rng);
    }
    s.next = t + rng.float(gap ? gap[0] : defaultGap[0], gap ? gap[1] : defaultGap[1]);
  }
  if (s.until >= 0 && t >= s.until) { s.until = -1; s.action = null; s.start = -1; }
  return s.action ? { action: s.action, side: s.side, start: s.start, until: s.until } : null;
}
const holdFromDef = (def, rng) => rng.float(def.hold[0], def.hold[1]);

// Arm actions (biped). Unrelated to form (the arms slot). One-arm actions (wave, salute…) draw which arm is active.
// Returns { action, side, start, until } or null (idle).
export function stepArmAction(s, t, rng, M) {
  return stepActionLayer(s, t, rng, M.armActions || [], M.armActionGap, [12, 36], ACTIONS, { side: true, hold: holdFromDef });
}
// Look — the direction [x, y] (−1~1) while held, otherwise null. The direction is one of eight × the species amplitude.
const LOOK_DIRS = [[-1, 0], [1, 0], [0, 1], [0, -1], [-1, 0.6], [1, 0.6], [-1, -0.5], [1, -0.5]];
export function stepLook(s, t, rng, M) {
  if (t >= s.next && s.until < 0) {
    const d = rng.pick(LOOK_DIRS);
    s.dir = [d[0] * M.lookAmp[0], d[1] * M.lookAmp[1]];
    s.until = t + rng.float(M.lookHold[0], M.lookHold[1]);
    s.next = t + rng.float(M.look[0], M.look[1]);
  }
  if (s.until >= 0 && t >= s.until) s.until = -1;
  return s.until >= 0 ? s.dir : null;
}
// Body actions — idling, then now and then the whole body (hopping in place). The hold is hop count × one hop's length (no rng). table.js bodyActions.
// Returns { action, start, until } or null.
export function initBodyAction(rng, M) { return { action: null, side: 0, start: -1, next: schedule(rng, M.bodyActions ? M.bodyActionGap : null), until: -1 }; }
export function stepBodyAction(s, t, rng, M) {
  return stepActionLayer(s, t, rng, M.bodyActions || [], M.bodyActionGap, [10, 25], BODY_ACTIONS, { hold: (def) => jumpSpan(def) });   // the whole timeline — anticipation, hops, settle (no rng)
}
// Quad actions — scratching with a hind paw, wagging the tail. Which leg is drawn within the pair (index 0~3, -1 for the tail). table.js quadActions.
// Returns { action, index, start, until } or null (idle).
export function initQuadAction(rng, M) { return { action: null, side: 0, start: -1, next: schedule(rng, M.quadActions ? [6, 18] : null), until: -1 }; }
export function stepQuadAction(s, t, rng, M) {
  const r = stepActionLayer(s, t, rng, M.quadActions || [], M.quadActionGap, [10, 30], QUAD_ACTIONS, { side: true, hold: holdFromDef });
  if (!r) return null;
  const def = QUAD_ACTIONS[r.action];
  const pick = r.side < 0 ? 0 : 1;
  return { action: r.action, index: def.leg === "front" ? pick : def.leg === "hind" ? 2 + pick : -1, start: r.start, until: r.until };
}
// The base state (mode) — what state an individual is in right now: idle (standing) · sleep (lying down asleep). walk and run will join here.
// The action layers (arm, body, quad) stack on top of this, and while asleep actions, looking and startle all rest. table.js modes/modeHold.
// A species with only one state uses no rng (preserving human and imp seeds).
export function initMode(rng, M) {
  const pool = M.modes || [["idle", 1]];
  if (pool.length < 2) return { mode: pool[0][0], next: Infinity };
  const mode = rng.weighted(pool);
  return { mode, next: rng.float(M.modeHold[mode][0], M.modeHold[mode][1]) };
}
// Transitions pass through idle — from idle into one of the other states (weighted), from another state back to idle. Sleep never goes straight to walking.
export function stepMode(s, t, rng, M) {
  if (t >= s.next) {
    const pool = s.mode === "idle" ? (M.modes || []).filter(([m]) => m !== "idle") : [["idle", 1]];
    s.mode = pool.length ? rng.weighted(pool) : "idle";
    s.next = t + rng.float(M.modeHold[s.mode][0], M.modeHold[s.mode][1]);
  }
  return s.mode;
}
export function stepMood(m, t, rng) {
  if (t >= m.nextMood && m.moodUntil < 0) { m.moodUntil = t + rng.float(1.5, 4); m.nextMood = t + rng.float(6, 16); }
  if (m.moodUntil >= 0 && t >= m.moodUntil) m.moodUntil = -1;
  if (t >= m.nextMouth && m.mouthUntil < 0) { m.mouthUntil = t + rng.float(0.8, 2.2); m.nextMouth = t + rng.float(4, 12); }
  if (m.mouthUntil >= 0 && t >= m.mouthUntil) m.mouthUntil = -1;
  return { browAlt: m.moodUntil >= 0, mouthAlt: m.mouthUntil >= 0 };
}
