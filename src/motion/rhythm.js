// Standing rhythm — oscillation that never stops. Sine waves and easing only, no scheduled events.
//   breathing · sway (side to side) · rocking (front to back) · head roll (dog) · jelly wobble (imp) · tail swish (cat)
//   gaze easing · face turn · arm pendulum · joint jitter
// Docs: guidelines/motion/catalog.md
//
// init consumes rng (phase, period). step uses none — rhythm is deterministic.

import { damp } from "./ease.js";

export function initBreathe(rng) {
  return { period: rng.float(2.6, 5.4), phase: rng.float(0, Math.PI * 2) };
}
export function initSway(rng, M) {
  return {
    swayAmp: rng.float(M.sway[0], M.sway[1]),
    swayPeriod: rng.float(M.swayPeriod[0], M.swayPeriod[1]),
    swayPhase: rng.float(0, Math.PI * 2),
    rockPeriod: rng.float(2.1, 3.9),
    rockPhase: rng.float(0, Math.PI * 2)
  };
}
export function initRoll(rng, M) {
  return M.roll
    ? { amp: rng.float(M.roll.amp[0], M.roll.amp[1]), period: rng.float(M.roll.period[0], M.roll.period[1]), phase: rng.float(0, Math.PI * 2) }
    : null;
}
export function initArmSwing(rng) {
  return { phase: rng.float(0, Math.PI * 2) };
}
export function initTailSwish(rng, M) {
  return M.tailSwish
    ? { amp: rng.float(M.tailSwish.amp[0], M.tailSwish.amp[1]), period: rng.float(M.tailSwish.period[0], M.tailSwish.period[1]), phase: rng.float(0, Math.PI * 2) }
    : null;
}
export function initJelly(rng, M) {
  return M.jelly
    ? { amp: rng.float(M.jelly.amp[0], M.jelly.amp[1]), freq: rng.float(M.jelly.freq[0], M.jelly.freq[1]), phase: rng.float(0, Math.PI * 2) }
    : null;
}

export function stepBreathe(br, t) {
  return Math.sin((t / br.period) * Math.PI * 2 + br.phase);
}
export function stepSway(s, t, M) {
  return {
    sway: Math.sin((t / s.swayPeriod) * Math.PI * 2 + s.swayPhase) * s.swayAmp,
    rock: Math.sin((t / s.rockPeriod) * Math.PI * 2 + s.rockPhase) * (M.rock || 0)
  };
}
export function stepRoll(roll, t) {
  return roll ? Math.sin((t / roll.period) * Math.PI * 2 + roll.phase) * roll.amp : 0;
}
// Gaze eases toward a target. Updating that target (rng) is events' job.
// Gaze — critically damped follow (w 0.2 ≈ 95% in 0.4 s). A softer start than an exponential lerp
// w is the follow weight per 60-Hz frame. It is a parameter because a **ghost moves at half speed** and a
// critically damped follow is stepped per tick, not off t — scaling the clock's time alone would leave the
// pupils darting to a new target as briskly as ever while everything around them halved (index.js SLOW)
export function stepGaze(g, w = 0.2) {
  return [damp(g.gaze[0], g.gazeTarget[0], w), damp(g.gaze[1], g.gazeTarget[1], w)];
}
// Face turn [x, y] (−1~1). Follows the gaze slowly — the pupils go first and the face comes after.
// During a look it turns all the way that way. Up and down less than side to side (M.yaw × 0.6).
// Face turn — critically damped follow (w 0.1 ≈ 95% in 0.8 s). Slower than the gaze
export function stepFaceTurn(g, M, look) {
  const tx = look ? look[0] : g.gaze[0].x * M.yaw;
  const ty = look ? look[1] : g.gaze[1].x * M.yaw * 0.6;
  const w = 0.1 * (M.slow || 1);   // half on a ghost — a per-tick follow does not slow with the clock's time
  return [damp(g.faceTurn[0], tx, w), damp(g.faceTurn[1], ty, w)];
}
// Arm pendulum — opposite phase to the sway
export function stepArmSwing(a, sway, t, M) {
  return Math.sin((t / sway.swayPeriod) * Math.PI * 2 + sway.swayPhase + Math.PI + a.phase * 0.3) * (M.armSwing || 0);
}
// Joint jitter — arms boil finely, like the lines do. What the reference's arms actually are.
export function armJitter(a, t, side) {
  return Math.sin(t * 7.3 + side * 2.1 + a.phase) * 0.012 + Math.sin(t * 11.7 + side * 0.7) * 0.008;
}
export function legJitter(t, i) {
  return Math.sin(t * 6.1 + i * 1.9) * 0.006;
}
export function stepTailSwish(sw, t) {
  return sw ? Math.sin((t / sw.period) * Math.PI * 2 + sw.phase) * sw.amp : 0;
}
export function stepJelly(jelly, t) {
  if (!jelly) return { jellyX: 0, jellyY: 0 };
  const w = Math.sin(t * jelly.freq * Math.PI * 2 + jelly.phase);
  return { jellyX: w * jelly.amp, jellyY: -w * jelly.amp * 0.9 };
}
