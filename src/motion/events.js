// Intermittent events — they begin at a scheduled moment, run briefly and end. The next slot is drawn with rng.
//   blink · gaze dart · startle · nod · sniff dip · stretch · shiver (hopping in place is not an event but a body action — actions.js)
//   paw flick · step in place · tail flick · emoji schedule · regen
// (Raising one arm and waving are actions, not events — actions.js hi and wave. The other arm is decided along with them)
// Docs: guidelines/motion/catalog.md
//
// Shape: { next: the next start time, start: the start time while running (otherwise -1) }
// The progress curve is k = (t - start) / duration. k>=1 means it is over.

import { BLINK_TIME } from "./table.js";
import { bump, bumps, envelope } from "./ease.js";

const schedule = (rng, range) => (range ? rng.float(range[0], range[1]) : Infinity);

// -- init (consumes rng) --
export function initBlink(rng) { return { next: rng.float(0, 4), start: -1, happy: false }; }
// gaze and faceTurn are critically damped follows (a pair of {x, v} each) — the gaze goes first and the face comes after (rhythm.stepGaze, stepFaceTurn)
export function initGlance(rng) {
  return { next: rng.float(0, 3), gaze: [{ x: 0, v: 0 }, { x: 0, v: 0 }], gazeTarget: [0, 0], faceTurn: [{ x: 0, v: 0 }, { x: 0, v: 0 }] };
}
export function initSurprise(rng, M) { return { next: schedule(rng, M.surprise), start: -1 }; }
export function initRegen(rng) { return { at: rng.float(6, 14) }; }
export function initEmojiSchedule(rng) { return { next: rng.float(5, 30) }; }
export function initDip(rng, M) { return { next: schedule(rng, M.dip), start: -1 }; }
export function initNod(rng) { return { next: rng.float(9, 24), start: -1 }; }
export function initStretch(rng, M) { return { next: schedule(rng, M.stretch), start: -1 }; }
export function initShiver(rng, M) { return { next: schedule(rng, M.shiver), start: -1 }; }
export function initLegTap(rng, M) { return { next: schedule(rng, M.legTap), start: -1, index: 0 }; }
export function initLegStep(rng, M) { return { next: schedule(rng, M.legStep), start: -1 }; }
export function initTailFlick(rng, M) { return { next: schedule(rng, M.tailFlick), start: -1 }; }

// ── step ──
export function stepBlink(e, t, rng) {
  if (t >= e.next) {
    e.start = t;
    e.happy = rng.chance(0.22);
    e.next = t + rng.float(1.8, 6.5);
    if (rng.chance(0.22)) e.next = t + BLINK_TIME * 2.4;
  }
  let lid = 0;
  let happy = false;
  if (e.start >= 0) {
    const k = (t - e.start) / BLINK_TIME;
    if (k >= 1) e.start = -1;
    else {
      lid = bump(k);
      if (e.happy && lid > 0.7) happy = true;   // a ^^ blink — index.js stretches this into a ^^ held for 3 s or more
    }
  }
  return { lid, happy };
}
// Updates the gaze target only. The easing is rhythm.stepGaze.
export function stepGlanceTarget(g, t, rng) {
  if (t >= g.next) {
    g.gazeTarget = [rng.around(0, 1), rng.around(0, 0.7)];
    g.next = t + rng.float(1.4, 5.0);
  }
}
// Startle length (seconds): 0.1 shrink + 3.8 hold + 0.1 recover
export const SURPRISE_DUR = 4.0;
// Startle variants — plain (pupil shrinks) 60% · star (eyes turn into ☆_☆, awe) 25% · heart (♥_♥ eyes, smitten) 15%. Drawn at the start and kept in e.variant
export function stepSurprise(e, t, rng, M) {
  if (t >= e.next && e.start < 0) {
    e.start = t;
    e.next = t + rng.float(M.surprise[0], M.surprise[1]);
    e.variant = rng.weighted([["plain", 60], ["star", 25], ["heart", 15]]);
  }
  if (e.start >= 0) {
    const k = (t - e.start) / SURPRISE_DUR;
    if (k >= 1) e.start = -1;
    // Startle amount 0~1: shoots up in 0.1 s (the easing holds), holds 3.8 s, releases in 0.1 s — velocity 0 at both ends.
    // The scene shrinks **the pupil only** with this value (1 → 0.5×). The eye itself does not grow
    else return envelope(k, 0.1 / SURPRISE_DUR, 0.1 / SURPRISE_DUR);
  }
  return 0;
}
export function stepNod(e, t, rng) {
  if (t >= e.next && e.start < 0) { e.start = t; e.next = t + rng.float(9, 24); }
  if (e.start >= 0) {
    const k = (t - e.start) / 0.7;
    if (k >= 1) e.start = -1;
    else return -bumps(k, 2) * 0.014;
  }
  return 0;
}
export function stepDip(e, t, rng, M) {
  if (t >= e.next && e.start < 0) { e.start = t; e.next = t + rng.float(M.dip[0], M.dip[1]); }
  if (e.start >= 0) {
    const k = (t - e.start) / 1.2;
    if (k >= 1) e.start = -1;
    else return -bump(k) * 0.035;
  }
  return 0;
}
export function stepStretch(e, t, rng, M) {
  if (t >= e.next && e.start < 0) { e.start = t; e.next = t + rng.float(M.stretch[0], M.stretch[1]); }
  if (e.start >= 0) {
    const k = (t - e.start) / 1.6;
    if (k >= 1) e.start = -1;
    else return bump(k) * 0.06;
  }
  return 0;
}
export function stepShiver(e, t, rng, M) {
  if (t >= e.next && e.start < 0) { e.start = t; e.next = t + rng.float(M.shiver[0], M.shiver[1]); }
  if (e.start >= 0) {
    const k = (t - e.start) / 0.35;
    if (k >= 1) e.start = -1;
    else return Math.sin(k * Math.PI * 9) * 0.008 * envelope(k, 0.15, 0.7);
  }
  return 0;
}
export function stepLegTap(e, t, rng, M, legOffset) {
  if (t >= e.next && e.start < 0) {
    e.start = t;
    e.index = rng.int(0, M.legStep ? 3 : 1);
    e.next = t + rng.float(M.legTap[0], M.legTap[1]);
  }
  if (e.start >= 0) {
    const k = (t - e.start) / 0.9;
    if (k >= 1) e.start = -1;
    else legOffset[e.index] += bumps(k, 3) * 0.09 * (e.index % 2 ? -1 : 1);
  }
}
export function stepLegStep(e, t, rng, M, legOffset) {
  if (t >= e.next && e.start < 0) { e.start = t; e.next = t + rng.float(M.legStep[0], M.legStep[1]); }
  if (e.start >= 0) {
    const k = (t - e.start) / 2.4;
    if (k >= 1) e.start = -1;
    else {
      const env = bump(k);
      const ph = k * Math.PI * 2 * 3;
      legOffset[0] += Math.sin(ph) * 0.07 * env;
      legOffset[3] += Math.sin(ph) * 0.07 * env;
      legOffset[1] += Math.sin(ph + Math.PI) * 0.07 * env;
      legOffset[2] += Math.sin(ph + Math.PI) * 0.07 * env;
    }
  }
}
export function stepTailFlick(e, t, rng, M) {
  if (t >= e.next && e.start < 0) { e.start = t; e.next = t + rng.float(M.tailFlick[0], M.tailFlick[1]); }
  if (e.start >= 0) {
    const k = (t - e.start) / 0.5;
    if (k >= 1) e.start = -1;
    else return Math.sin(k * Math.PI * 3) * 0.35 * envelope(k, 0.15, 0.6);
  }
  return 0;
}
export function stepRegen(r, t, rng) {
  if (t >= r.at) { r.at = t + rng.float(6, 14); return true; }
  return false;
}
// Emoji while idle — draws one from the per-species list and returns just the kind to trigger (the animation is the emoji.js channel's job)
export function stepEmojiSchedule(e, t, rng, M) {
  if (!M.emojis || !M.emojis.length) return null;   // null = this one has no emoji at all (a ghost) — the table's own means
  if (t >= e.next) {
    e.next = t + rng.float(14, 40);
    return rng.pick(M.emojis);
  }
  return null;
}
