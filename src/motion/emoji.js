// Emoji animation — the ♥ ! ? … glyphs that float above the head. Not motion (actions, events, rhythm) but **a separately triggered layer**.
// Docs: guidelines/motion/catalog.md § emoji animation
//
// Triggers arrive from two places:
//   1. Occasionally while idle (events.stepEmojiSchedule — the per-species emojis list, 14~40 s)
//   2. A motion's emoji trigger — write `emoji: "heart"` on an action or event and that motion fires one **as it starts**
//      (flap → ♥, think → ?, startle → !, dog tail wag → ♥). A motion does not "hold" the emoji —
//      once fired, the emoji plays out its own animation length on its own.
// There is one channel. A new trigger cuts the previous one off and starts over.

import { ramp, bump, smoothstep } from "./ease.js";

// Emoji kinds. dur is the animation length (seconds), anim is the curve.
export const EMOJI = {
  heart: { dur: 2.2, anim: "float",  label: "♥ fond" },
  bang:  { dur: 1.3, anim: "pop",    label: "! startled" },
  quest: { dur: 2.2, anim: "wobble", label: "? puzzled" },
  dots:  { dur: 2.6, anim: "mumble", label: "… muttering" },
  zzz:   { dur: 2.8, anim: "float",  label: "z asleep" },
  sweat: { dur: 1.8, anim: "drip",   label: "; sweat" }
};

// Emoji channel state
export function initEmoji() { return { kind: null, start: -1 }; }

// Trigger. Restarts even if the same kind is already up (for emphasis).
export function triggerEmoji(ch, kind, t) {
  if (!EMOJI[kind]) return;
  ch.kind = kind;
  ch.start = t;
}

// Frame. Gives position, size, opacity and tilt from progress k (0~1) and the per-kind curve. null when it is over.
export function stepEmoji(ch, t) {
  if (!ch.kind) return null;
  const def = EMOJI[ch.kind];
  const k = (t - ch.start) / def.dur;
  if (k >= 1 || k < 0) { ch.kind = null; ch.start = -1; return null; }
  const fadeIn = ramp(Math.min(1, k / 0.15));
  const fadeOut = ramp(Math.min(1, (1 - k) / 0.2));
  const fade = Math.min(fadeIn, fadeOut);
  let dy = 0, scale = 1, rot = 0, opacity = fade * 0.95;
  if (def.anim === "float") {
    // Floats up with a throb — slowly upward, size beating like a heart
    dy = k * 0.06 + Math.sin(k * Math.PI * 3) * 0.012;
    scale = 0.85 + 0.15 * fade + Math.max(0, Math.sin(k * Math.PI * 6)) * 0.12;
  } else if (def.anim === "pop") {
    // Pops out — a big pop first, then back in place with a slight tremble
    const pop = k < 0.2 ? 1 + 0.5 * bump(k / 0.2) : 1;
    scale = pop * (0.9 + 0.1 * fade);
    dy = 0.02 * (1 - Math.min(1, k / 0.2));
    rot = Math.sin(k * Math.PI * 14) * 0.06 * (1 - k);
  } else if (def.anim === "wobble") {
    // Tilts side to side with a small nod
    rot = Math.sin(k * Math.PI * 4) * 0.22;
    dy = Math.sin(k * Math.PI * 2) * 0.01;
    scale = 0.9 + 0.1 * fade;
  } else if (def.anim === "drip") {
    // Sweat — beads beside the temple and runs slowly down
    dy = -smoothstep(0, 1, k) * 0.05;
    scale = 0.8 + 0.2 * fade;
  } else {
    // Muttering — floats low with a gentle waver
    dy = Math.sin(k * Math.PI * 5) * 0.006;
    scale = 0.85 + 0.15 * fade;
    opacity = fade * 0.85;
  }
  return { kind: ch.kind, k, dy, scale, rot, opacity };
}
