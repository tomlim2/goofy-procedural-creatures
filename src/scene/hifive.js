// The high five — a scene interaction. Every pair of same-row biped neighbours high fives **on its own
// schedule** (no distance gate): when a pair's time comes, the short-armed one stops where it stands (the
// anchor — a dead tie in reach falls to seed parity) and the long-armed one hurries over from wherever it is
// (the mover — a commanded trip at approach × walk speed). The anchor plants its palm once the mover is near;
// the mover arrives, winds up, holds, and slaps — the swing itself (anticipation, the arc, the follow-through,
// the smiles) lives on ACTIONS.hifive and runs in the clock (motion/index.js). Three stars bounce out of the
// contact (scene/spark.js).
//
// The pair logic lives here and not in motion/ because no per-individual clock knows another's position — the
// scene owns the board. A clock obeys one command (motion/index.js hifive) and the command consumes **no rng**
// from the clock's stream; the scheduler's randomness is its own per-pair makeRng stream, seeded from the two
// specs, so the fives are seed-deterministic and an isolated clock (the snapshot, the frequency counts) never
// fives at all.
// Docs: guidelines/motion/catalog.md § the high five
//
// This module knows no three.js — scene/index.js feeds it the creature items (worldX comes off each item's
// last state) and node can drive it as-is to count firings (guidelines/motion/rules.md § count the firing
// frequency).

import { ACTIONS, ARM_POSES } from "../motion/index.js";
import { makeRng } from "../rng.js";

// The knobs. Distances in cells (a cell is one world unit), times in seconds.
export const HIFIVE = {
  interval: [300, 720],    // a pair fives every this often (its own rng stream) — ≈1.7/min on a 7×5 board's ~15 pairs
  firstWithin: [40, 300],  // the first five of a fresh board lands sooner, so the board does not sit dead
  minApproach: 0.15,       // the mover must have at least this far to walk. Already closer (a leftover stand
                           // from an earlier five, mid-walk into each other) the pair skips this round and
                           // draws its next — a five with no approach has no show
  plantAt: 0.5,            // the anchor raises its palm once the mover is within this of its stand
  reachK: 0.92,            // how much of the mover's reach is spent at contact — the rest keeps the elbow soft
  hold: 0.55,              // palms together this long after the slap, then both let go
  pairCooldown: 60,        // safety spacing under the schedule
  soloCooldown: 25,        // one five per individual per this — no chain-fiving both neighbours at once
  timeout: 18              // the whole five gives up after this long (longest hurry ≈ 12 s + the swing)
};

const armOf = (item) => (item.motionRig ? item.motionRig.arm : null);
const worldX = (item) => item.baseX + ((item.lastState && item.lastState.walkX) || 0);

// The anchor's planted hand in world coordinates — the same arithmetic solveArm runs for the static pose
// (hand as a multiple of reach, origin at the shoulder), so the mover is aimed at where the hand really is.
// scripts/hifive-sim.mjs verifies the aim end to end: both palms, run back through FK from the state's joint
// angles at contact, land within a hand dot of each other.
function plantPoint(item, side) {
  const arm = armOf(item);
  const reach = arm.upper + arm.lower;
  const hand = ARM_POSES[ACTIONS.hifive.pose].hand;
  return [worldX(item) + side * (arm.x + hand[0] * reach), item.baseY + arm.y + hand[1] * reach];
}

// rush divides the two waits — the wait for a board's first five and the wait between a pair's fives —
// and nothing else. The pair logic, the approach, the swing and the seed-determinism are the board's own,
// so what a rushed screen shows is the real thing, only sooner (main.js: the debug screen's ?five=rush)
export function makeHifives({ rush = 1 } = {}) {
  const wait = ([lo, hi], rng) => rng.float(lo, hi) / rush;
  let active = [];             // running fives
  const schedule = new Map();  // "i:j" → { rng, next, sa, sb } — the pair's own stream and its next five
  const pairUntil = new Map(); // "i:j" → when this pair may five again
  const soloUntil = new Map(); // index → when this individual may five again
  let started = 0;             // counters for the sim (scripts/hifive-sim.mjs) — fives begun, and rounds
  let skipped = 0;             // skipped because the pair stood too close for an approach (minApproach)

  // A pair's schedule stream — seeded from the two specs, so it survives nothing and depends on nothing but
  // the board. A regen changes a seed and the pair starts a fresh stream
  const scheduleOf = (i, j, A, B, t) => {
    const key = i + ":" + j;
    let s = schedule.get(key);
    if (!s || s.sa !== A.spec.seed || s.sb !== B.spec.seed) {
      const rng = makeRng(((A.spec.seed ^ (B.spec.seed * 2654435761)) >>> 0) ^ 0x51f7);
      s = { rng, sa: A.spec.seed, sb: B.spec.seed, next: t + wait(HIFIVE.firstWithin, rng) };
      schedule.set(key, s);
    }
    return s;
  };

  const stop = (f) => {
    f.a.clock.hifive(null);
    f.m.clock.hifive(null);
  };
  const cool = (f, t) => {
    pairUntil.set(Math.min(f.ai, f.mi) + ":" + Math.max(f.ai, f.mi), t + HIFIVE.pairCooldown);
    soloUntil.set(f.ai, t + HIFIVE.soloCooldown);
    soloUntil.set(f.mi, t + HIFIVE.soloCooldown);
  };

  // Works the five's geometry out **without committing** — roles, the meeting point, where the mover must
  // stand, and how far it has to walk to get there. The scheduler reads the approach off this to decide
  // whether the five is worth doing at all (too close → no show), and go() issues the commands from it
  function plan(A, ai, B, bi) {
    const reachOf = (item) => armOf(item).upper + armOf(item).lower;
    // The short-armed one plants and the long-armed one walks over; a dead tie falls to seed parity
    let anchor = A, mover = B, anchorI = ai, moverI = bi;
    if (reachOf(B) < reachOf(A) || (reachOf(B) === reachOf(A) && (A.spec.seed + B.spec.seed) % 2)) {
      anchor = B; mover = A; anchorI = bi; moverI = ai;
    }
    const side = worldX(mover) > worldX(anchor) ? 1 : -1;   // the anchor's arm toward the mover
    const point = plantPoint(anchor, side);
    // The meeting height. The anchor's natural plant sets it — pulled, when the two builds force it, into
    // what both arms can span: the mover's band (reachK of its reach, with room left for dx), the anchor's
    // (the plant stretch rotated up or down to ±0.9 of reach), never below the floor. Reach and body height
    // are separate draws here, so "short one plants, long one reaches" needs the intersection, not one side.
    // Disjoint bands meet in the middle and both stretch a little
    const ra = armOf(anchor);
    const rm = armOf(mover);
    const reachA = ra.upper + ra.lower;
    const reachM = rm.upper + rm.lower;
    const hand = ARM_POSES[ACTIONS.hifive.pose].hand;
    const shA = anchor.baseY + ra.y;
    const shM = mover.baseY + rm.y;
    const wish = shA + hand[1] * reachA;
    const maxDy = HIFIVE.reachK * reachM * 0.96;
    const lo = Math.max(shM - maxDy, shA - 0.9 * reachA, anchor.baseY + 0.08);
    const hi = Math.min(shM + maxDy, shA + 0.9 * reachA);
    const py = lo > hi ? (lo + hi) / 2 : Math.min(Math.max(wish, lo), hi);
    if (py !== wish) {
      // Re-aim the plant: its stretch (|hand| ≈ 0.9 of reach) rotated to the settled height
      const len = Math.hypot(hand[0], hand[1]);
      const handY = Math.min(Math.max((py - shA) / reachA, -0.9), 0.9);
      const handX = Math.sqrt(Math.max(len * len - handY * handY, 0.2 * 0.2));
      point[0] = worldX(anchor) + side * (ra.x + handX * reachA);
      point[1] = shA + handY * reachA;
    }
    // Where the mover stands: its palm lands on the meeting point with reachK of its reach spent — the height
    // is settled above, the rest goes to dx
    const dy = point[1] - shM;
    const span = (HIFIVE.reachK * reachM) ** 2 - dy * dy;
    const dx = Math.sqrt(Math.max(span, (0.25 * reachM) ** 2));
    const walkTo = point[0] + side * (rm.x + dx) - mover.baseX;
    const approach = Math.abs(walkTo - ((mover.lastState && mover.lastState.walkX) || 0));
    return { a: anchor, m: mover, ai: anchorI, mi: moverI, side, point, walkTo, approach };
  }

  function go(p, t) {
    // The anchor stops where it stands and watches the mover come — the palm goes up later (plantAt)
    p.a.clock.hifive({ side: p.side, wait: true });
    p.m.clock.hifive({ side: -p.side, at: [p.point[0] - p.m.baseX, p.point[1] - p.m.baseY], walkTo: p.walkTo });
    active.push({
      a: p.a, m: p.m, ai: p.ai, mi: p.mi, side: p.side, walkTo: p.walkTo, point: p.point,
      phase: "approach", planted: false, deadline: t + HIFIVE.timeout, contactAt: 0, holdUntil: 0
    });
  }

  return {
    // One pass per tick, after every clock has updated (each item's lastState is this tick's).
    // onContact(x, y) fires once per five, the moment the slap lands.
    update(creatures, columns, t, onContact) {
      active = active.filter((f) => {
        // A regen or rebuild swapped an item out — let go (the discarded clock takes the release harmlessly)
        if (creatures[f.ai] !== f.a || creatures[f.mi] !== f.m) { stop(f); return false; }
        if (t > f.deadline) { stop(f); cool(f, t); return false; }
        const st = f.m.lastState;
        if (f.phase === "approach" && st) {
          // The mover is near — the anchor's palm comes up (staging: the wait, then the plant)
          if (!f.planted && Math.abs((st.walkX || 0) - f.walkTo) < HIFIVE.plantAt) {
            f.a.clock.hifive({ side: f.side, at: [f.point[0] - f.a.baseX, f.point[1] - f.a.baseY] });
            f.planted = true;
          }
          // Arrival is exact — the clock snaps walkX to the commanded target (the same number this manager
          // sent) and starts the wind-up on the same tick. The slap lands a full swing later, and the anchor
          // is told when, so its recoil and smile key to the same moment
          if (st.walkX === f.walkTo) {
            f.phase = "swing";
            f.contactAt = t + ACTIONS.hifive.windup + ACTIONS.hifive.antHold + ACTIONS.hifive.strike;
            f.a.clock.hifive({ side: f.side, at: [f.point[0] - f.a.baseX, f.point[1] - f.a.baseY], impactAt: f.contactAt });
          }
        }
        if (f.phase === "swing" && t >= f.contactAt) {
          f.phase = "hold";
          f.holdUntil = t + HIFIVE.hold;
          onContact(f.point[0], f.point[1]);
        }
        if (f.phase === "hold" && t >= f.holdUntil) { stop(f); cool(f, t); return false; }
        return true;
      });

      // The schedule — same-row neighbours, both bipeds with arms. A pair whose time has come waits (its next
      // stands) until both parties are free — then, **if there is room for an approach**, goes; standing too
      // close already (minApproach), it skips this round outright and draws its next. Either way no distance
      // brings a five on — only the schedule does
      for (let i = 0; i + 1 < creatures.length; i += 1) {
        const j = i + 1;
        if (j % columns === 0) continue;   // the row's edge
        const A = creatures[i], B = creatures[j];
        if (!armOf(A) || !armOf(B) || !A.lastState || !B.lastState) continue;
        const s = scheduleOf(i, j, A, B, t);
        if (t < s.next) continue;
        if (active.some((f) => f.ai === i || f.mi === i || f.ai === j || f.mi === j)) continue;
        if ((pairUntil.get(i + ":" + j) || 0) > t || (soloUntil.get(i) || 0) > t || (soloUntil.get(j) || 0) > t) continue;
        const p = plan(A, i, B, j);
        if (p.approach < HIFIVE.minApproach) skipped += 1;
        else { go(p, t); started += 1; }
        s.next = t + wait(HIFIVE.interval, s.rng);
      }
    },
    // Counters for the sim — how many fives began, and how many rounds were skipped for standing too close
    stats() { return { started, skipped }; },
    // BIND or a forced action takes the board over — let every running five go (a forced arm would fight it)
    releaseAll() {
      for (const f of active) stop(f);
      active = [];
    },
    // A rebuild renumbers the slots — schedules and cooldowns keyed by index mean other pairs now
    reset() {
      this.releaseAll();
      schedule.clear();
      pairUntil.clear();
      soloUntil.clear();
    }
  };
}
