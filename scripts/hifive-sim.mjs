// The high five, measured — drives the real pair logic (scene/hifive.js) over real clocks on the default
// board and counts what the eye must not judge alone (guidelines/motion/rules.md § count the firing frequency):
//   - how often a five lands (contacts/minute, per board and per eligible pair)
//   - whether the palms actually meet — both hands run back through FK from the state's joint angles at the
//     contact tick, and the gap between them is reported (guidelines/motion/rules.md § an arm pose is written
//     as a hand target: check by number that it reaches)
//   - the stretch cases — a mover too tall to reach the anchor's height stands close and stretches; counted
//
// Usage: node scripts/hifive-sim.mjs [seconds] [seed...]     (default 600 s, seeds 1 7 42 1234)

import { makeGrid, motionRig } from "../src/character/index.js";
import { makeClock } from "../src/motion/index.js";
import { makeHifives, HIFIVE } from "../src/scene/hifive.js";
import { CELL_W, CELL_H } from "../src/scene/index.js";
import { TICK_FPS } from "../src/tick.js";

const args = process.argv.slice(2).map(Number);
const SECONDS = args[0] || 600;
const SEEDS = args.length > 1 ? args.slice(1) : [1, 7, 42, 1234];
const COLS = 7;
const ROWS = 5;

// A palm's world position from the state's joint angles — the same forward kinematics the rig applies
// (animate.js: pivot rotation shoulder, elbow child rotation elbow; a limb is baked hanging, so a world
// rotation θ carries (0,−L) to (L·sinθ, −L·cosθ))
function palm(item, side) {
  const a = item.motionRig.arm;
  const arm = item.lastState.arms[String(side)];
  let x = item.baseX + (item.lastState.walkX || 0) + side * a.x;
  let y = item.baseY + a.y;
  x += Math.sin(arm.shoulder) * a.upper;
  y -= Math.cos(arm.shoulder) * a.upper;
  x += Math.sin(arm.shoulder + arm.elbow) * a.lower;
  y -= Math.cos(arm.shoulder + arm.elbow) * a.lower;
  return [x, y];
}

let allGaps = [];
let allStretch = 0;
let allContacts = 0;
let allPairs = 0;

for (const seed of SEEDS) {
  const specs = makeGrid(seed, COLS * ROWS, COLS);
  const items = specs.map((spec, i) => {
    const rig = motionRig(spec);
    return {
      spec,
      motionRig: rig,
      clock: makeClock(spec.seed, 0, spec.species, rig),
      baseX: (i % COLS) * CELL_W,
      baseY: -Math.floor(i / COLS) * CELL_H,
      lastState: null
    };
  });
  let pairs = 0;
  for (let i = 0; i + 1 < items.length; i += 1) {
    if ((i + 1) % COLS === 0) continue;
    if (items[i].motionRig.arm && items[i + 1].motionRig.arm) pairs += 1;
  }

  const hifives = makeHifives();
  const contacts = [];
  const ticks = Math.floor(SECONDS * TICK_FPS);
  // The swing trace — the palm gap over the last stretch before a burst. It has to show the wind-up:
  // the gap opens (the hand pulls toward the body), freezes (the anticipation hold) and snaps shut (the
  // strike). Recorded whenever exactly one pair is mid-five; the first two bursts print theirs
  const swing = [];
  let tracesLeft = 2;
  for (let f = 0; f < ticks; f += 1) {
    const t = f / TICK_FPS;
    for (const item of items) item.lastState = item.clock.update(t);
    const fiving = items.filter((it) => it.motionRig.arm && it.lastState && it.lastState.action === "hifive");
    if (fiving.length === 2) {
      const p0 = palm(fiving[0], fiving[0].lastState.actionSide);
      const p1 = palm(fiving[1], fiving[1].lastState.actionSide);
      swing.push(+Math.hypot(p0[0] - p1[0], p0[1] - p1[1]).toFixed(3));
      if (swing.length > 16) swing.shift();
    } else swing.length = 0;
    // The gap is measured **at the burst tick** (the manager runs after the clocks, so the states are this
    // tick's — the strike has just landed and the follow-through has not yet pushed past). Two fives can run
    // at once, so the two palms are picked by distance to the contact point
    hifives.update(items, COLS, t, (x, y) => {
      const c = { x, y, tick: f };
      contacts.push(c);
      if (tracesLeft > 0 && swing.length) { tracesLeft -= 1; console.log(`  swing gap trace (last ${swing.length} ticks to the burst): ${swing.join(" ")}`); }
      const palms = [];
      for (const item of items) {
        if (!item.motionRig.arm || !item.lastState || item.lastState.action !== "hifive") continue;
        const p = palm(item, item.lastState.actionSide);
        palms.push({ p, d: Math.hypot(p[0] - c.x, p[1] - c.y) });
      }
      palms.sort((a, b) => a.d - b.d);
      if (palms.length >= 2) {
        c.gap = Math.hypot(palms[0].p[0] - palms[1].p[0], palms[0].p[1] - palms[1].p[1]);
        allGaps.push(c.gap);
      }
    });
  }

  const stretch = contacts.filter((c) => c.gap !== undefined && c.gap > 0.05).length;
  allStretch += stretch;
  allContacts += contacts.length;
  allPairs += pairs;
  const gaps = contacts.map((c) => c.gap).filter((g) => g !== undefined);
  const fmt = (v) => v.toFixed(3);
  const st = hifives.stats();
  console.log(
    `seed ${seed}: ${contacts.length} fives in ${SECONDS} s (${fmt((contacts.length * 60) / SECONDS)}/min board, ` +
    `${pairs} armed pairs, ${fmt((contacts.length * 60) / SECONDS / Math.max(pairs, 1))}/min/pair) — ` +
    `palm gap mean ${fmt(gaps.reduce((a, b) => a + b, 0) / Math.max(gaps.length, 1))} max ${fmt(gaps.length ? Math.max(...gaps) : 0)}, ` +
    `${stretch} over 0.05 (stretch), ${st.skipped} rounds skipped too-close`
  );
}

console.log(
  `total: ${allContacts} fives, gap mean ${(allGaps.reduce((a, b) => a + b, 0) / Math.max(allGaps.length, 1)).toFixed(3)} ` +
  `max ${(allGaps.length ? Math.max(...allGaps) : 0).toFixed(3)}, stretch ${allStretch} ` +
  `(interval ${HIFIVE.interval[0]}~${HIFIVE.interval[1]} s, first ${HIFIVE.firstWithin[0]}~${HIFIVE.firstWithin[1]} s, cooldown pair ${HIFIVE.pairCooldown} solo ${HIFIVE.soloCooldown})`
);

// The too-close gate, made to bite: fives every ~80 s per pair leave movers standing at contact distance
// when the next round comes, so skips **must** appear — a zero here means the gate is dead
{
  HIFIVE.interval = [70, 90];
  HIFIVE.firstWithin = [10, 30];
  HIFIVE.pairCooldown = 10;
  HIFIVE.soloCooldown = 5;
  const specs = makeGrid(42, COLS * ROWS, COLS);
  const items = specs.map((spec, i) => {
    const rig = motionRig(spec);
    return {
      spec, motionRig: rig, clock: makeClock(spec.seed, 0, spec.species, rig),
      baseX: (i % COLS) * CELL_W, baseY: -Math.floor(i / COLS) * CELL_H, lastState: null
    };
  });
  const hifives = makeHifives();
  let n = 0;
  for (let f = 0; f < 600 * TICK_FPS; f += 1) {
    const t = f / TICK_FPS;
    for (const item of items) item.lastState = item.clock.update(t);
    hifives.update(items, COLS, t, () => n++);
  }
  const st = hifives.stats();
  console.log(`stress (interval 70~90 s): ${st.started} started, ${st.skipped} skipped too-close — ${st.skipped > 0 ? "the gate bites" : "GATE DEAD"}`);
}
