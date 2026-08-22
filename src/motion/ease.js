// Easing — every motion curve eases in and eases out. Velocity is 0 at the start and the end.
// Docs: guidelines/motion/rules.md § easing
//
// The envelope (0→1→0) is a raised cosine, not sin(πk) — sin starts with slope π so it pops, and |sin| has a kink.
// Target following (gaze, face turn, joints) is a critically damped second-order filter, not an exponential lerp — with lerp the first frame is the fastest, so the start feels stiff.

import { TICK } from "../tick.js";

// 0~1 S-curve. Slope 0 at both ends.
export function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// 0→1 ramp (0~1 input). Used instead of a linear fade.
export function ramp(x) { return smoothstep(0, 1, x); }

// 0→1→0 once (k 0~1). Smooth at both ends and at the peak.
export function bump(k) { return 0.5 - 0.5 * Math.cos(2 * Math.PI * Math.min(1, Math.max(0, k))); }

// 0→1→0 n times (k 0~1). Instead of |sin(nπk)| — no kink at the bottom.
export function bumps(k, n) { const s = Math.sin(n * Math.PI * Math.min(1, Math.max(0, k))); return s * s; }

// Attack, hold and release envelope (k 0~1). attack and release are fractions of the whole length.
export function envelope(k, attack, release) {
  return smoothstep(0, attack, k) * (1 - smoothstep(1 - release, 1, k));
}

// Critically damped second-order follow — s = { x, v } toward target. w is the angular frequency **per 60-Hz frame** (0.1 ≈ 95% in 0.8 s,
// 0.2 ≈ 0.4 s — the numbers the tables were tuned with); each call advances one tick (tick.js TICK) by the exact solution of the
// continuous system, so the settling time is in seconds whatever the tick rate. Settles as an S-curve with no overshoot. One step per
// call, so it is deterministic. (v is the velocity per second)
export function damp(s, target, w) {
  const om = w * 60, dt = TICK, e = Math.exp(-om * dt);
  const y = s.x - target, c2 = s.v + om * y;
  const yNext = (y + c2 * dt) * e;
  s.v = (c2 - om * (y + c2 * dt)) * e;
  s.x = target + yNext;
  return s.x;
}
