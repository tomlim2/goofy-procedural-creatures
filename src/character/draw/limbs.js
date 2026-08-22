// Limbs and tail — baked relative to the joint pivot's origin. Pose and action are not here (motion/actions.js).
// Docs: guidelines/character/parts.md § legs · tail · arms · armLength, guidelines/rig.md

import { Sketch } from "../../stroke.js";
import { blobPath, arcPath, crumple } from "../../shape.js";
import { paintPart } from "./body.js";
import { makeNoise, makeRng } from "../../rng.js";
import { layout, BUILD } from "./layout.js";
import { shade } from "../../color.js";

// Arm dimensions. Length = a slot independent of form × per-individual jitter. medium is the baseline 1, long is 1.64× that (enough to sweep the floor).
// The baseline arm length is 0.242 — shorter than that and the hand is near the torso and does not read as an arm.
// Upper:lower arm = 0.48:0.52. The forearm has to be slightly longer for the hand to reach far.
const ARM_BASE = 0.242;
const ARM_LENGTH_SCALE = { medium: 1, long: 1.64 };

// Shoulder x — on the torso's left/right outline. The half-width at shoulder height (22% from the top) differs per body form:
// box 1 · bean (an ellipse) ≈0.85 · dress (a trapezoid, 0.6 at the top → 1.35 at the bottom) ≈0.76 · tube 0.62.
// An arm has to come out of the torso's side — coming out further in, it looks like it sprouts from the middle of the chest.
const SHOULDER_X = { bean: 0.85, box: 0.98, dress: 0.76, tube: 0.63 };

function armDims(spec, box) {
  const reach = ARM_BASE * spec.proportions.armSpread * (ARM_LENGTH_SCALE[spec.parts.armLength] || 1);
  return {
    x: box.bodyW * (SHOULDER_X[spec.parts.body] || 0.85),   // shoulder x (the right arm. The left is -x)
    y: box.bodyTop - (box.bodyTop - box.legTop) * 0.22,     // shoulder y
    upper: reach * 0.48,
    lower: reach * 0.52
  };
}

// Jointed limbs. Each limb is drawn relative to its pivot's origin (shoulder, hip).
// The scene swings them with rotation.z.
//
// The reference (joints at 4× zoom): arms come in several types (behind the back, a sleeve plus a round hand, a stub plus a fist, hanging),
// and a leg always ends in a round foot. A leg's root starts inside the body outline (above the hem) so the joint looks
// "embedded", and an arm's root is on the torso's left/right outline (the side) — further in and it looks like it sprouts from the chest.
//
// Returns: [{ sketch, pivot: [x, y], kind: "arm"|"leg", side, index, behind }]
export function limbSketches(spec) {
  const rng = makeRng((spec.proportions.wobbleSeed + 303) >>> 0);
  const noise = makeNoise(rng);
  const box = layout(spec);
  const p = spec.proportions;
  const ink0 = spec.palette.ink;
  const skin = spec.palette.skin;
  const cloth = spec.palette.cloth;
  const limbs = [];

  const make = () => new Sketch(noise, p.wobble);
  const dot = (s, x, y, r, color) => {
    paintPart(s, spec, blobPath(x, y, r, r * 0.9, { lumps: 3, amount: 0.18, noise: null }), color);   // a hand — the creature's material
    s.contour(blobPath(x, y, r, r * 0.9, { lumps: 3, amount: 0.18, noise: null }), "RIBBON", { color: ink0, closed: true });
  };

  const legKind = spec.parts.legs;

  if (box.quad) {
    // Four legs — two front and two hind, each pair together (a beast seen from the side). The roots are inside the body outline (25% of bodyH up, quadHips).
    // Forms: stub (the default — a thick stub plus a toe tip plus toes) · stick (a thin leg plus a round foot) · boots (socks) ·
    // float (Rayman style — no legs, just floating feet). bent and tiptoe are drawn as stick on a quad.
    // Length is set by layout from legLength (short = a dachshund). Body length is build (box.bodyW).
    const { hipY, front, back, gap } = quadHips(box);
    const kind = ["stub", "stick", "boots", "float"].includes(legKind) ? legKind : "stick";
    [front - gap / 2, front + gap / 2, back - gap / 2, back + gap / 2].forEach((x, i) => {
      const s = make();
      const len = hipY;
      const lean = noise(i * 7.1) * 0.012;
      if (kind === "float") {
        // Floating feet — just the feet, with no leg line. Joint jitter makes them bob about
        dot(s, lean + 0.006, -len + 0.014, 0.024, skin);
      } else if (kind === "stick") {
        s.stroke([[0, 0], [lean, -len]], { color: ink0, width: 0.01 });
        dot(s, lean + 0.006, -len + 0.012, 0.02, skin);
      } else if (kind === "boots") {
        // Socks — a small boot filled to the ankle
        s.stroke([[0, 0], [lean, -len]], { color: ink0, width: 0.012 });
        const boot = crumple([[lean - 0.022, -len], [lean - 0.018, -len + 0.036], [lean + 0.012, -len + 0.036], [lean + 0.03, -len + 0.005], [lean + 0.03, -len]], 0.003, lean * 90);
        paintPart(s, spec, boot, cloth === skin ? ink0 : shade(cloth, 0.75));
        s.contour(boot, "RIBBON", { color: ink0, closed: true });
      } else {
        // A thick stub leg plus a round toe tip poking slightly forward plus two toe lines (the reference)
        s.stroke([[0, 0], [lean, -len]], { color: ink0, width: 0.016 });
        s.stroke([[lean - 0.02, -len], [lean + 0.03, -len + 0.003]], { color: ink0, width: 0.012 });
        s.stroke([[lean + 0.006, -len + 0.002], [lean + 0.01, -len + 0.016]], { color: ink0, width: 0.006 });
        s.stroke([[lean + 0.018, -len + 0.002], [lean + 0.021, -len + 0.014]], { color: ink0, width: 0.006 });
      }
      limbs.push({ sketch: s, pivot: [x, hipY], kind: "leg", side: i < 2 ? -1 : 1, index: i, behind: false });
    });
    return limbs;
  }

  // -- biped legs --
  // The root is slightly above the body's hem (inside the outline). There is always a foot at the end.
  const hipY = box.legTop + 0.02;
  // The stance (how far they open) is set by the torso build, not the leg form — a wide body carries a wide stance.
  const spread = (BUILD[spec.parts.build] || BUILD.medium).stance;
  for (const side of [-1, 1]) {
    const x = side * box.bodyW * spread;
    const s = make();
    const len = hipY;
    let footX = 0;
    if (legKind === "float") {
      // Rayman style — no legs, just big feet floating. Joint jitter and a foot flick make them bob about
      dot(s, side * 0.008, -len + 0.016, 0.03, skin);
      limbs.push({ sketch: s, pivot: [x, hipY], kind: "leg", side, index: side < 0 ? 0 : 1, behind: false });
      continue;
    }
    if (legKind === "bent") {
      s.stroke([[0, 0], [side * 0.04, -len * 0.5], [side * 0.01, -len]], { color: ink0, width: 0.011 });
      footX = side * 0.01;
    } else if (legKind === "stub") {
      s.stroke([[0, 0], [0, -len]], { color: ink0, width: 0.019 });
    } else if (legKind === "tiptoe") {
      // A thin leg standing on its toes — the foot points downward
      s.stroke([[0, 0], [side * 0.008, -len]], { color: ink0, width: 0.009 });
      s.stroke([[side * 0.008 - 0.012, -len + 0.012], [side * 0.008, -len], [side * 0.008 + 0.012, -len + 0.012]], { color: ink0, width: 0.009 });
      limbs.push({ sketch: s, pivot: [x, hipY], kind: "leg", side, index: side < 0 ? 0 : 1, behind: false });
      continue;
    } else {
      s.stroke([[0, 0], [noise(side * 3.3) * 0.02, -len]], { color: ink0, width: 0.011 });
      footX = noise(side * 3.3) * 0.02;
    }
    // The foot
    if (legKind === "boots") {
      // Boots — a mass filled to the ankle
      const boot = crumple([[footX - 0.028, -len], [footX - 0.024, -len + 0.045], [footX + 0.012, -len + 0.045], [footX + 0.036, -len + 0.006], [footX + 0.036, -len]], 0.003, footX * 90);
      paintPart(s, spec, boot, cloth === skin ? ink0 : shade(cloth, 0.75));
      s.contour(boot, "RIBBON", { color: ink0, closed: true });
    } else {
      // A round foot — the reference default
      dot(s, footX + side * 0.008, -len + 0.012, 0.022, skin);
    }
    limbs.push({ sketch: s, pivot: [x, hipY], kind: "leg", side, index: side < 0 ? 0 : 1, behind: false });
  }

  // -- biped arms --
  // Only the form (the arms slot) is set here. The pose comes from the scene, as rotation and a front/back switch.
  //
  // An arm is two bones: the upper arm (origin at the shoulder pivot, pointing down) plus the forearm (origin at the elbow pivot, pointing down).
  // The scene attaches the forearm pivot to the end of the upper arm and gives the shoulder and elbow angles separately.
  // That is what lets the arm fold — drawn as one stroke it is a stick however far you rotate it.
  //
  // Hands behind the back has the arms disappear behind the body with only the elbow poking out at the side,
  // which rotation alone cannot express. A back sketch is baked separately.
  const armKind = spec.parts.arms;
  if (armKind === "none") return limbs;   // armless — no limb and no rig (some imps)
  const dims = armDims(spec, box);
  const shoulderY = dims.y;
  const upperLen = dims.upper;
  const lowerLen = dims.lower;
  for (const side of [-1, 1]) {
    const x = side * dims.x;

    const upper = make();
    const lower = make();
    const w = armKind === "stubby" ? 0.017 : 0.01;

    if (armKind === "sleeve") {
      // The upper arm is a cloth-colored sleeve. The forearm is a bare arm plus a hand.
      const sl = crumple([[side * -0.012, 0.012], [side * 0.012, 0.012], [side * 0.014, -upperLen], [side * -0.012, -upperLen]], 0.0025, side * 3);
      paintPart(upper, spec, sl, cloth);   // a sleeve — the creature's material
      upper.contour(sl, "RIBBON", { color: ink0, closed: true });
      lower.stroke([[0, 0], [side * 0.004, -lowerLen]], { color: ink0, width: 0.01 });
      dot(lower, side * 0.006, -lowerLen - 0.006, 0.022, skin);
    } else if (armKind === "stubby") {
      // Two short thick bones plus a fist
      upper.stroke([[0, 0], [side * 0.004, -upperLen]], { color: ink0, width: w });
      lower.stroke([[0, 0], [side * 0.004, -lowerLen]], { color: ink0, width: w });
      dot(lower, side * 0.006, -lowerLen - 0.004, 0.02, skin);
    } else {
      // stick / mitten — two thin bones. There is no joint marking at a bone's end (it is hand-drawn).
      upper.stroke([[0, 0], [side * 0.006, -upperLen]], { color: ink0, width: w });
      lower.stroke([[0, 0], [side * 0.004, -lowerLen]], { color: ink0, width: w });
      if (armKind === "mitten") dot(lower, side * 0.006, -lowerLen - 0.006, 0.024, skin);
      else lower.stroke([[side * 0.006 - 0.016, -lowerLen], [side * 0.006 + 0.016, -lowerLen + 0.004]], { color: ink0, width: w });
    }

    // back — hands behind the back. Only the elbow pokes out at the side. Only the thickness differs by form
    const back = make();
    const bw = armKind === "stubby" ? 0.017 : armKind === "sleeve" ? 0.014 : 0.011;
    back.stroke([[0, 0], [side * 0.03, -0.045], [side * 0.05, -0.08]], { color: ink0, width: bw });

    limbs.push({
      sketch: upper, lowerSketch: lower, backSketch: back,
      pivot: [x, shoulderY], elbow: [side * 0.006, -upperLen],
      kind: "arm", side, index: 0
    });
  }
  return limbs;
}

// The bind pose — the arms when the character has received no motion at all. The T-pose: shoulders horizontal (1.57 outward),
// elbows 0. A character has no "posture" — idle and the actions (arms up, waving, arms crossed…) are all motion/actions.js.
// On screen the T-pose is only visible in the BIND view.
//
// [shoulder angle, elbow angle]. outward (away from the body) positive. Multiply by side to turn it into a world rotation.z:
// the upper arm is baked hanging at (0, -len) and lifted by rotation.z (counter-clockwise positive). Lifting the left arm (side -1, x<0)
// outward (further left) means clockwise = negative, and the right arm counter-clockwise = positive. Hence outward = side.
export const BIND_ARM = [1.57, 0];

// Quad leg roots — the four legs attach at root height hipY (the body's hem + 25% of bodyH), the front pair opening by gap about front and the hind pair about back.
// The drawing (limbSketches) and the rig description (motionRig — used to solve the sitting pose) look at the same values
export function quadHips(box) {
  return {
    hipY: box.legTop + box.bodyH * 0.25,
    front: box.bodyCx - box.bodyW * 0.6,
    back: box.bodyCx + box.bodyW * 0.6,
    gap: Math.max(0.03, box.bodyW * 0.16)          // the spacing between the two legs within a pair
  };
}

// The rig description — the static dimensions motion needs to run on this individual. All of it comes from the spec.
//   arm      a biped's arm (IK): shoulder position, upper and lower arm lengths, body anchors. Anchors are in body coordinates (origin at the soles, y up), for the right arm — the left mirrors x. null on a quad
//   legTop   the torso hem height — how far the body settles when a quad lies down to sleep
//   body     a quad's torso and leg-root dimensions { frontHipX, hindHipX, hipY, legTop, bodyH, bodyW, bodyCx } — the sitting pose (motion/actions.js sitPose)
//            is solved to fit this individual (tilting the body about the front legs' root to put the hips on the floor, folding the hind legs to put the feet on the floor). null on a biped
//   tailLift the tail's per-individual jitter (−1~1) — varies how far the cat idle arch curls per individual (motion/table.js tailIdlePose)
export function motionRig(spec) {
  const box = layout(spec);
  const hips = box.quad ? quadHips(box) : null;
  // arm is only for bipeds with arms. An armless biped (an imp with arms none) has arm null but quad false too — only the arm action layer rests
  return {
    arm: box.quad || spec.parts.arms === "none" ? null : armRigOf(spec, box),
    legTop: box.legTop, quad: box.quad, tailLift: spec.proportions.tailLift,
    body: hips ? { frontHipX: hips.front, hindHipX: hips.back, hipY: hips.hipY, legTop: box.legTop, bodyH: box.bodyH, bodyW: box.bodyW, bodyCx: box.bodyCx } : null
  };
}

function armRigOf(spec, box) {
  const dims = armDims(spec, box);
  return {
    x: dims.x, y: dims.y, upper: dims.upper, lower: dims.lower,
    anchors: {
      ground: 0,                                                        // the floor. The hand cannot go below it
      hip: [box.bodyW * 0.6, box.legTop + 0.04],                        // the waist (beside the pelvis)
      chestFar: [-box.bodyW * 0.15, box.bodyTop - box.bodyH * 0.32],    // the far side of the chest (arms crossed)
      chin: [box.headRx * 0.18, box.bodyTop],                           // the chin
      brow: [box.headRx * 0.5, box.headCy + box.headRy * 0.25]          // beside the brow (a salute)
    }
  };
}

// -- tail — skeleton (tail) × skin (tailSkin) --
// A tail is three slots. The **skeleton** (curl, flag, longtail, stubtail, hook, kink, ring) is the spine's shape (a point list, origin at the pivot),
// the **skin** (line, thick, plume, tuft, block, ball, puff, plus the disabled ringed and wedge) is what goes on that spine — a thin line, a filled thick tail, a bushy plume,
// a tuft at the tip, a block, beads, a pom — and the **length** (tailLength) shrinks the whole skeleton.
// Any skin goes on any skeleton (a plume skin on a stub skeleton = a pom). The scene stands it up as a four-bone chain and rotates each bone (tailSketch below).

// The skeleton — the spine point list. tailLift (a ratio) raises or lowers the tip a little
function tailSpine(kind, lift) {
  const up = lift * 0.02;
  if (kind === "curl") return [[0, 0], [0.05, 0.08], [0.03 + up, 0.16], [-0.015, 0.2]];
  if (kind === "flag") return [[0, 0], [0.025, 0.1], [0.01 + up, 0.2]];
  if (kind === "longtail") return [[0, 0], [0.07, 0.015], [0.14, 0.05], [0.18, 0.12 + up]];
  if (kind === "hook") return [[0, 0], [0.02, 0.08], [0.02, 0.16 + up], [-0.01, 0.215], [-0.045, 0.205], [-0.055, 0.165]];   // standing up, then hooked
  if (kind === "kink") return [[0, 0], [0.035, 0.06], [0.005, 0.11], [0.045, 0.16], [0.02, 0.21 + up]];                     // a bend at every joint
  if (kind === "ring") return arcPath(-0.03, 0.075, 0.078, 0.078, -1.2, 4.3, 22);                                            // one full turn over the back (a spitz)
  return [[0, 0], [0.02, 0.03], [0.035, 0.05]];   // stubtail — blunt
}

// The list of cumulative length ratios t (0~1) along the spine
function spineT(spine) {
  const acc = [0];
  for (let i = 1; i < spine.length; i += 1) acc.push(acc[i - 1] + Math.hypot(spine[i][0] - spine[i - 1][0], spine[i][1] - spine[i - 1][1]));
  const total = acc[acc.length - 1] || 1;
  return acc.map((a) => a / total);
}
// The two edges, swollen sideways along the spine by a thickness of widthAt(t). t is fitted to the whole tail (0~1) by tMap
function tubeSides(spine, widthAt, tMap = (t) => t) {
  const ts = spineT(spine);
  const left = [], right = [];
  for (let i = 0; i < spine.length; i += 1) {
    const [x, y] = spine[i];
    const [nx0, ny0] = spine[Math.max(0, i - 1)], [nx1, ny1] = spine[Math.min(spine.length - 1, i + 1)];
    let dx = nx1 - nx0, dy = ny1 - ny0;
    const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const w = widthAt(tMap(ts[i]));
    left.push([x - dy * w, y + dx * w]);
    right.push([x + dy * w, y - dx * w]);
  }
  return { left, right };
}
// The point at length ratio t (0~1) along a polyline and the direction of travel there
function alongSpine(spine, t) {
  const ts = spineT(spine);
  let i = 0;
  while (i < ts.length - 2 && ts[i + 1] < t) i += 1;
  const k = (t - ts[i]) / Math.max(1e-6, ts[i + 1] - ts[i]);
  const [ax, ay] = spine[i], [bx, by] = spine[i + 1];
  let dx = bx - ax, dy = by - ay;
  const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
  return { x: ax + (bx - ax) * k, y: ay + (by - ay) * k, dx, dy };
}
// The spine divided into n equal lengths → [{ spine (point list relative to the bone's origin), t0, t1, origin (relative to the tail root), angle (the rest pose's direction) }]
function splitSpineN(spine, n) {
  const ts = spineT(spine);
  const parts = [];
  for (let k = 0; k < n; k += 1) {
    const t0 = k / n, t1 = (k + 1) / n;
    const a = alongSpine(spine, t0), b = alongSpine(spine, Math.min(1, t1));
    const inner = spine.filter((_, i) => ts[i] > t0 && ts[i] < t1);
    const pts = [[a.x, a.y], ...inner, [b.x, b.y]];
    parts.push({
      spine: pts.map(([x, y]) => [x - a.x, y - a.y]),
      t0, t1, origin: [a.x, a.y],
      angle: Math.atan2(b.y - a.y, b.x - a.x)
    });
  }
  return parts;
}

// A tail is **a four-bone chain** — the spine is split into 4, a joint (origin) sits at each bone, and the scene rotates the bones separately:
// the root (0) takes the swish, wag, walking and sleep; the tip (3) takes the tapping, tremble and follow-through; and **raise** blends each joint's angle from the rest pose toward standing straight (a target angle per bone).
// The skin is applied continuously across the bones — the thickness function is computed on the whole tail's t, so the thickness carries across the seams.
export const TAIL_BONES = 4;
export function tailSketch(spec) {
  const rng = makeRng((spec.proportions.wobbleSeed + 404) >>> 0);
  const noise = makeNoise(rng);
  const box = layout(spec);
  const sketches = Array.from({ length: TAIL_BONES }, () => new Sketch(noise, spec.proportions.wobble));
  if (!box.quad) return { sketches, bones: [], pivot: [0, 0] };

  const p = spec.proportions;
  const ink0 = spec.palette.ink;
  const cx = box.bodyCx;
  const pivot = [cx + box.bodyW * 0.98, (box.bodyTop + box.legTop) / 2 + box.bodyH * 0.1];
  // Length — shrinks the whole skeleton (long 1 · medium 0.7 · short 0.45). The skin thickness is unchanged
  const lenK = spec.parts.tailLength === "short" ? 0.45 : spec.parts.tailLength === "medium" ? 0.7 : 1;
  const spine = tailSpine(spec.parts.tail, p.tailLift).map(([x, y]) => [x * lenK, y * lenK]);
  const skin = spec.parts.tailSkin || "line";
  const stub = spec.parts.tail === "stubtail";
  const fur = spec.palette.skin;   // fur color = head color (on dogs and cats the body is in the same family too)
  const parts = splitSpineN(spine, TAIL_BONES);

  // The thickness function (on the whole tail's t) — per skin
  const widthOf = {
    thick: (t) => (stub ? 0.024 : 0.02) * (1 - t * 0.7) + 0.004,
    plume: (t) => (stub ? 0.03 : 0.016 + 0.024 * Math.sin(Math.PI * Math.min(1, t * 1.15))),
    block: () => (stub ? 0.024 : 0.019),
    wedge: (t) => (stub ? 0.03 : 0.028) * (1 - t) + 0.001,
    ringed: (t) => (stub ? 0.024 : 0.019) * (1 - t * 0.55) + 0.004
  };
  // Draws the filled body continuously across the bones — the fill per bone, the outline only the two side lines (so no crossbar appears at a seam), closed on the last bone
  const tube = (widthAt) => {
    parts.forEach((part, i) => {
      const tMap = (t) => part.t0 + t * (part.t1 - part.t0);
      const { left, right } = tubeSides(part.spine, widthAt, tMap);
      const sk = sketches[i];
      paintPart(sk, spec, [...left, ...right.slice().reverse()], fur);   // the tail is fur — the creature's material
      sk.stroke(left, { color: ink0, width: 0.011, passes: 2 });
      sk.stroke(right, { color: ink0, width: 0.011, passes: 2 });
      if (i === parts.length - 1) sk.stroke([left[left.length - 1], right[right.length - 1]], { color: ink0, width: 0.011 });   // closing off the tip
    });
  };
  // The point at a whole-tail t and the piece it falls in — for placing fur strokes, beads, bands and tufts
  const at = (t) => {
    const idx = Math.min(parts.length - 1, Math.floor(Math.max(0, Math.min(0.999, t)) * parts.length));
    const part = parts[idx];
    const local = (t - part.t0) / (part.t1 - part.t0);
    return { ...alongSpine(part.spine, Math.max(0, Math.min(1, local))), sk: sketches[idx] };
  };

  if (skin === "line") {
    // A thin line — one hand-drawn tail stroke (thick on a stub). Drawn continuously across the bones
    for (const [i, part] of parts.entries()) sketches[i].stroke(part.spine, { color: ink0, width: stub ? 0.02 : 0.011, jitter: 0.003 });
  } else if (skin === "thick" || skin === "block" || skin === "wedge") {
    tube(widthOf[skin]);
  } else if (skin === "plume") {
    // A bushy plume tail — a filled body swollen in the middle plus fur strokes (a pom on a stub)
    tube(widthOf.plume);
    const n = stub ? 3 : 6;
    for (let i = 0; i < n; i += 1) {
      const t = stub ? 0.3 + i * 0.25 : 0.25 + i * 0.13;
      const a = at(Math.min(0.98, t));
      const side = i % 2 ? 1 : -1;
      const nx = -a.dy * side, ny = a.dx * side;
      const w = stub ? 0.03 : 0.028;
      a.sk.stroke([[a.x + nx * w * 0.7, a.y + ny * w * 0.7], [a.x + nx * (w + 0.02) + a.dx * 0.01, a.y + ny * (w + 0.02) + a.dy * 0.01]], { color: ink0, width: 0.007, jitter: 0.004 });
    }
  } else if (skin === "tuft") {
    // A tuft at the tip — a thin line plus a filled tuft at the end (a lion's tail)
    for (const [i, part] of parts.entries()) sketches[i].stroke(part.spine, { color: ink0, width: 0.011, jitter: 0.003 });
    const tipPart = parts[parts.length - 1];
    const tip = tipPart.spine[tipPart.spine.length - 1];
    const ball = blobPath(tip[0], tip[1], stub ? 0.02 : 0.024, stub ? 0.018 : 0.02, { lumps: 4, amount: 0.25, noise: null });
    const tipSk = sketches[sketches.length - 1];
    paintPart(tipSk, spec, ball, shade(fur, 0.82));
    tipSk.contour(ball, "RIBBON", { color: ink0, closed: true });
  } else if (skin === "puff") {
    // A pom — a rabbit tail. Regardless of the skeleton's length, one bushy tuft near the rump (at spine 0.3) plus fur strokes around it (the root piece)
    const a = at(0.3);
    const r = 0.04;
    const pom = blobPath(a.x, a.y + 0.004, r, r * 0.92, { lumps: 6, amount: 0.22, noise: null });
    paintPart(a.sk, spec, pom, fur);
    a.sk.contour(pom, "RIBBON", { color: ink0, closed: true });
    for (let i = 0; i < 6; i += 1) {
      const ang = -1.0 + i * 0.66;   // around the top and outside
      const x0 = a.x + Math.cos(ang) * r * 0.9, y0 = a.y + 0.004 + Math.sin(ang) * r * 0.85;
      a.sk.stroke([[x0, y0], [x0 + Math.cos(ang) * 0.016, y0 + Math.sin(ang) * 0.016]], { color: ink0, width: 0.007, jitter: 0.004 });
    }
  } else if (skin === "ball") {
    // Beads — a tail strung with beads along the spine. One pom on a stub (a rabbit)
    if (stub) {
      const a = at(0.6);
      const ball = blobPath(a.x, a.y + 0.005, 0.03, 0.028, { lumps: 4, amount: 0.15, noise: null });
      paintPart(a.sk, spec, ball, fur);
      a.sk.contour(ball, "RIBBON", { color: ink0, closed: true });
    } else {
      const n = 4;
      for (let i = 0; i < n; i += 1) {
        const t = 0.18 + (i / (n - 1)) * 0.8;
        const a = at(t);
        const r = 0.024 - i * 0.004;
        const ball = blobPath(a.x, a.y, r, r, { lumps: 3, amount: 0.12, noise: null });
        paintPart(a.sk, spec, ball, fur);
        a.sk.contour(ball, "RIBBON", { color: ink0, closed: true });
      }
    }
  } else {
    // ringed — ring markings on a thick tail (a disabled asset). The body plus three dark bands
    tube(widthOf.ringed);
    for (const t of stub ? [0.5] : [0.3, 0.55, 0.8]) {
      const a = at(t);
      const w = widthOf.ringed(t) * 1.15;
      a.sk.stroke([[a.x + a.dy * w, a.y - a.dx * w], [a.x - a.dy * w, a.y + a.dx * w]], { color: shade(fur, 0.55), width: 0.014 });
    }
  }
  return { sketches, bones: parts.map((p) => ({ origin: p.origin, angle: p.angle })), pivot };
}
