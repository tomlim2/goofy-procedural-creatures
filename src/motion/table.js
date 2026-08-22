// Per-species motion parameters. What moves, on what period and by how much, is all here.
// A new motion starts by putting per-species values in here (null for species without it).
// Docs: guidelines/motion/catalog.md

export const BLINK_TIME = 0.13;

// Per-species motion character. [min, max] is the event interval (seconds); null means that motion does not exist.
export const MOTION = {
  human: {
    // Arm actions — what it crosses over to from idle (an A-pose) now and then and comes back from. [action, weight]. The content is actions.js
    armActions: [
      ["wave", 2], ["cross", 2], ["hips", 2], ["think", 1.5], ["raise", 1.5], ["behind", 1.5],
      ["hi", 1], ["point", 1], ["flap", 1], ["salute", 0.7]
    ],
    armActionGap: [12, 36],
    // Arms: in the reference the arms stay open and only shake finely. Big movements are rare (actions).
    armSwing: 0.045,
    // Legs: a rare foot flick. The legs stay planted and nearly still.
    legTap: [12, 30], legStep: null,
    // Base states — alternates between standing (idle) and walking in place (walk). walk: hz step frequency · leg leg amplitude (rad) · bob body lift (units) · sway side lean (rad)
    modes: [["idle", 4], ["walk", 1]], modeHold: { idle: [30, 90], walk: [6, 14] },
    walk: { hz: 1.8, leg: 0.3, bob: 0.01, sway: 0.05, arm: 0.14, trip: [0.1, 0.18], speed: 0.045 },   // trip the distance out and back (cells), speed cells/second
    sway: [0.012, 0.032], swayPeriod: [2.6, 4.6],
    rock: 0.006,
    roll: null, dip: null,
    // Body actions — idling, then now and then hopping in place (three light hops). Overlaps arm actions (waving mid-jump)
    bodyActions: [["jump", 1]], bodyActionGap: [10, 25],
    stretch: null,
    tilt: [7, 18], tiltAmp: 0.1,
    jelly: null, shiver: [26, 60],
    wink: null, happyHold: null, angry: null,
    tailSwish: null, tailFlick: null,
    surprise: [8, 22], yaw: 0.5,
    // Look — turns the face one way and stays. [interval], [hold], amplitude [x, y]
    look: [6, 16], lookHold: [1.5, 4], lookAmp: [1, 0.8],
    emojis: ["heart", "bang", "quest", "sweat"]
  },
  pup: {
    armActions: null, armActionGap: null,
    armSwing: 0,
    // The quad idle stance — different from bind (legs vertical, tail exactly as drawn). The front legs plant slightly forward, the hind legs back,
    // and the tail lifts. Rhythm (breathing, roll, tail) and actions stack on top of that.
    legStance: [-0.05, -0.02, 0.09, 0.06], tailIdle: 0.25,
    // Base states — alternates between standing (idle), lying asleep (sleep), walking (walk) and sitting (sit). [state, weight] is the ratio drawn at a start or transition; the hold is modeHold
    modes: [["idle", 3], ["sleep", 1], ["walk", 1.5], ["sit", 1.5]], modeHold: { idle: [40, 120], sleep: [25, 60], walk: [6, 16], sit: [15, 45] },
    walk: { hz: 2.6, leg: 0.32, bob: 0.008, sway: 0, arm: 0, trip: [0.1, 0.16], speed: 0.07, tail: 0.12 },   // a trot — diagonal leg pairs alternate, and the tail sways with the step
    quadActions: [["wag", 3.5], ["scratch", 1]], quadActionGap: [6, 16],   // dogs wag often
    wagOnHappy: { amp: 0.35, hz: 3 },   // the tail wags whenever it smiles ^^ (a happy hold or a ^^ blink). 3 Hz — 8 ticks a cycle at 24; at 4 Hz the wag strobed (6 ticks: up·up·mid·down·down·mid)
    // The reference dog's legs are planted for the full 4 seconds. The body sways and the legs only look like they follow.
    legTap: [14, 32], legStep: [30, 70],
    sway: [0.004, 0.01], swayPeriod: [3, 6],
    rock: 0.003,
    roll: { amp: [0.07, 0.14], period: [2.4, 4.8] },
    dip: [4, 10],
    bodyActions: [["jump", 1]], bodyActionGap: [12, 30],
    stretch: null,
    tilt: [9, 20], tiltAmp: 0.08,
    jelly: null, shiver: [40, 80],
    wink: null, happyHold: [6, 16], angry: null,
    tailSwish: null, tailFlick: [3, 9],
    // The tail's tip bone — dogs get follow-through only (the tip lags behind on a wag). The rest, cat-only, is null
    tailTip: { follow: 0.05, twitch: null, raise: null, puff: 0 },
    surprise: [10, 26], yaw: 0.7,
    // Dogs look often, and look up (toward their owner) readily too
    look: [4, 12], lookHold: [1, 3], lookAmp: [1, 1],
    emojis: ["heart", "bang", "quest", "sweat"]
  },
  cat: {
    armActions: null, armActionGap: null,
    armSwing: 0,
    legStance: [-0.03, 0, 0.06, 0.03], tailIdle: 0,
    // The idle tail pose — **an arch**. Whatever the skeleton (curl, flag, longtail, kink…), an awake idle blends the joints toward these world angles (root→tip, 0 = back (away from the head), π/2 = up)
    // (weight — at 1 the skeleton is invisible; at 0.85, 15% of its character remains so each individual differs a little). The root leans slightly toward the head as it rises, and the tip goes over
    // **to the far side from the head (back)**, coming **down to −75°** (almost a vertical drop) — an ∩ arch hanging in the air behind its back. The top two bones vary by the individual's tailLift (−1~1)
    // by ±liftBend (±7°) — only slightly. Asleep or raised, this pose drops out (motion/index.js tailArch)
    tailIdlePose: { angles: [1.85, 1.3, 0.05, -75 * Math.PI / 180], weight: 0.85, liftBend: 0.12 },
    // Cats sleep and sit more often, and for longer
    modes: [["idle", 2], ["sleep", 1], ["walk", 1], ["sit", 1.5]], modeHold: { idle: [40, 120], sleep: [30, 90], walk: [6, 14], sit: [20, 60] },
    walk: { hz: 2.2, leg: 0.28, bob: 0.006, sway: 0, arm: 0, trip: [0.1, 0.16], speed: 0.05, tail: 0 },   // an unhurried walk — the tail does not sway with it (a cat does not wag like a dog)
    // A cat does not wag its tail like a dog — the tail only ever swishes and flicks. Its one action is scratching with a hind paw
    quadActions: [["scratch", 1]], quadActionGap: [10, 28],
    // A rare front-paw knead, an even rarer step
    legTap: [16, 36], legStep: [40, 90],
    sway: [0.002, 0.007], swayPeriod: [3.5, 7],
    rock: 0.004,
    roll: null, dip: null,
    bodyActions: [["jump", 1]], bodyActionGap: [25, 60],   // cats rarely
    stretch: [10, 26],
    tilt: [5, 12], tiltAmp: 0.14,
    jelly: null, shiver: [40, 90],
    wink: [8, 20], happyHold: null,
    // Anger — 3~5 s every 25~60 s. Fierce eyes and a bared-tooth mouth, and the tail fur stands up meanwhile (tailTip.puff). Dogs do not have it yet (null)
    angry: [25, 60], angryHold: [3, 5],
    // The cat tail — the opposite of a dog's: fast movement is irritation or excitement, and joy is **holding it up**. Tip-bone motion stacks on the slow swish (rhythm).
    //   follow follow-through (the tip lags behind the root's velocity) · twitch the tip alone tapping (the tailFlick interval and shape — events.js, 3 cycles in 0.5 s — applied to the tip bone; amp scales it) ·
    //   raise held up when in a good mood (during a ^^) — every joint exactly vertical, no bent variant (true/null) · puff the bristle multiplier (**while angry**, thickness only — the anger envelope 0.1/hold/0.1 as it is)
    tailSwish: { amp: [0.16, 0.3], period: [2.4, 5] }, tailFlick: [8, 20],
    tailTip: { follow: 0.06, twitch: { amp: 0.35 }, raise: true, puff: 1 },   // there is no lash — a cat lashing its tail is forbidden as a motion
    surprise: [9, 24], yaw: 0.8,
    // Cats rarely, and they stare for a long time
    look: [8, 20], lookHold: [2, 5], lookAmp: [0.9, 0.9],
    emojis: ["heart", "quest", "bang"]
  },
  imp: {
    // Imps raise their arms and flap more often. Crossing them and thinking, rarely
    armActions: [
      ["raise", 2.5], ["flap", 2], ["wave", 1.5], ["hips", 1.5], ["hi", 1], ["point", 1],
      ["behind", 1], ["salute", 0.5], ["think", 0.5]
    ],
    armActionGap: [10, 30],
    // Trembles finely as part of the jelly wobble.
    armSwing: 0.06,
    legTap: [14, 34], legStep: null,
    modes: [["idle", 4], ["walk", 1]], modeHold: { idle: [25, 80], walk: [5, 12] },
    walk: { hz: 2.3, leg: 0.36, bob: 0.012, sway: 0.06, arm: 0.16, trip: [0.1, 0.18], speed: 0.06 },   // a bouncy walk
    sway: [0.015, 0.04], swayPeriod: [2, 3.8],
    rock: 0.004,
    roll: null, dip: null,
    bodyActions: [["jump", 1]], bodyActionGap: [8, 20],   // imps often — bouncing along with the jelly wobble
    stretch: null,
    tilt: [8, 18], tiltAmp: 0.09,
    jelly: { amp: [0.008, 0.018], freq: [1.1, 1.9] }, shiver: [12, 30],
    wink: null, happyHold: null, angry: null,
    tailSwish: null, tailFlick: null,
    surprise: [6, 14], yaw: 0.6,
    look: [5, 14], lookHold: [1, 3], lookAmp: [1, 0.7],
    emojis: ["dots", "dots", "bang", "quest", "heart", "sweat"]
  }
};
