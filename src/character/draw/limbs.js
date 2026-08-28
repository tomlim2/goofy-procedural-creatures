// Limbs and tail — baked relative to the joint pivot's origin. Pose and action are not here (motion/actions.js).
// Docs: guidelines/character/parts.md § legs · tail · arms · armLength, guidelines/rig.md

import { Sketch, resample } from "../../stroke.js";
import { blobPath, arcPath, crumple } from "../../shape.js";
import { paintPart, patternOf } from "./body.js";
import { makeNoise, makeRng } from "../../rng.js";
import { layout, BUILD } from "./layout.js";
import { shade } from "../../color.js";
import { SPECIES } from "../vocabulary/species.js";

// Arm dimensions. Length = a slot independent of form × per-individual jitter. medium is the baseline 1, long is 1.64× that (enough to sweep the floor).
// The baseline arm length is 0.242 — shorter than that and the hand is near the torso and does not read as an arm.
// Upper:lower arm = 0.48:0.52. The forearm has to be slightly longer for the hand to reach far.
const ARM_BASE = 0.242;
const ARM_LENGTH_SCALE = { medium: 1, long: 1.64 };

// Shoulder x — on the torso's left/right outline. The half-width at shoulder height (22% from the top) differs per body form:
// box 1 · bean (an ellipse) ≈0.85 · dress (a trapezoid, 0.6 at the top → 1.35 at the bottom) ≈0.76 · tube 0.62.
// An arm has to come out of the torso's side — coming out further in, it looks like it sprouts from the middle of the chest.
const SHOULDER_X = { bean: 0.85, box: 0.98, dress: 0.76, tube: 0.63 };

// The knee — a biped leg splits into thigh and shin here (of the hip height). The drawing and the rig
// description (motionRig — the leg IK's bone lengths) read the same number
const KNEE_SPLIT = 0.52;

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
// variant is the boil frame — only the drawing noise differs; the pivots, joints and shapes are the same in every frame
export function limbSketches(spec, variant = 0) {
  const rng = makeRng(((spec.proportions.wobbleSeed + 303) ^ (variant * 0x9e3779b9)) >>> 0);
  const noise = makeNoise(rng);
  const box = layout(spec);
  const p = spec.proportions;
  const ink0 = spec.palette.ink;
  const skin = spec.palette.skin;
  const cloth = spec.palette.cloth;
  const limbs = [];

  const make = () => new Sketch(noise, p.wobble);
  const dot = (s, x, y, r, color) => {
    paintPart(s, spec, blobPath(x, y, r, r * 0.9, { lumps: 3, amount: 0.18, noise: null }), color, { body: true });   // a hand — the body's goofy material
    s.contour(blobPath(x, y, r, r * 0.9, { lumps: 3, amount: 0.18, noise: null }), { color: ink0 });
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
        // Floating feet — just the feet, with no leg line. Joint jitter makes them bob about. No knee to bend
        dot(s, lean + 0.006, -len + 0.014, 0.024, skin);
        limbs.push({ sketch: s, pivot: [x, hipY], kind: "leg", side: i < 2 ? -1 : 1, index: i, behind: false });
        return;
      }
      // **Two bones, like a biped's** — the thigh from the hip and the shin from the knee, split at KNEE_SPLIT,
      // so the scene can solve a quad's crouch off the torso height the same way (motion/rules.md § a limb pose
      // is written as a target). The knee and the ankle are joint ends (no overshoot, no thinning) or the leg
      // breaks apart at the fold. The foot hangs from its own ankle group and counter-rotates, so the sole stays
      // level however far the knee folds — exactly the biped arrangement
      const sh = make();
      const kneeH = len * KNEE_SPLIT;
      const shinLen = len - kneeH;
      const kneeX = lean * KNEE_SPLIT;
      const footX = lean - kneeX;
      const ft = make();
      if (kind === "stick") {
        s.line([[0, 0], [kneeX, -kneeH]], { color: ink0, joint: [false, true] });
        sh.line([[0, 0], [footX, -shinLen]], { color: ink0, joint: [true, true] });
        dot(ft, 0.006, 0.012, 0.02, skin);
      } else if (kind === "boots") {
        // Socks — a small boot filled to the ankle, hung from the ankle like a biped's
        s.line([[0, 0], [kneeX, -kneeH]], { color: ink0, joint: [false, true] });
        sh.line([[0, 0], [footX, -shinLen]], { color: ink0, joint: [true, true] });
        const boot = crumple([[-0.022, 0], [-0.018, 0.036], [0.012, 0.036], [0.03, 0.005], [0.03, 0]], 0.003, lean * 90);
        paintPart(ft, spec, boot, cloth === skin ? ink0 : shade(cloth, 0.75), { body: true });
        ft.contour(boot, { color: ink0 });
      } else {
        // A thick stub leg plus a round toe tip poking slightly forward plus two toe lines (the reference)
        s.line([[0, 0], [kneeX, -kneeH]], { color: ink0, joint: [false, true] });
        sh.line([[0, 0], [footX, -shinLen]], { color: ink0, joint: [true, true] });
        ft.line([[-0.02, 0], [0.03, 0.003]], { color: ink0 });
        ft.line([[0.006, 0.002], [0.01, 0.016]], { color: ink0, size: "S" });
        ft.line([[0.018, 0.002], [0.021, 0.014]], { color: ink0, size: "S" });
      }
      // knee: which way the fold bows. A beast is seen from the side, and the **hind** knee bends forward — the
      // stifle of a real dog or cat, against the front elbow that folds back. Indices 0·1 are the front pair
      // (quadHips front, at −x) and 2·3 the hind
      limbs.push({ sketch: s, lowerSketch: sh, footSketch: ft, pivot: [x, hipY], elbow: [kneeX, -kneeH], ankle: [footX, -shinLen], kind: "leg", side: i < 2 ? -1 : 1, knee: i < 2 ? 1 : -1, index: i, behind: false });
    });
    return limbs;
  }

  // -- biped legs --
  // The root is slightly above the body's hem (inside the outline). There is always a foot at the end.
  // A biped leg is **two bones** — the thigh (origin at the hip pivot) and the shin (origin at the knee
  // pivot, carrying the foot), split at 52%, exactly the arm's upper/forearm arrangement. The scene folds
  // them like an elbow: seen head-on a bend reads as a plié — thighs out, shins back in (the jump's crouch,
  // guidelines/motion/catalog.md § body actions). float keeps no knee — there is no leg to bend.
  const hipY = box.legTop + 0.02;
  // The stance (how far they open) is set by the torso build, not the leg form — a wide body carries a wide stance.
  const spread = (BUILD[spec.parts.build] || BUILD.medium).stance;
  for (const side of [-1, 1]) {
    const x = side * box.bodyW * spread;
    const s = make();
    const len = hipY;
    const kneeH = len * KNEE_SPLIT;   // where the knee sits
    const shinLen = len - kneeH;
    if (legKind === "float") {
      // Rayman style — no legs, just big feet floating. Joint jitter and a foot flick make them bob about
      dot(s, side * 0.008, -len + 0.016, 0.03, skin);
      limbs.push({ sketch: s, pivot: [x, hipY], kind: "leg", side, index: side < 0 ? 0 : 1, behind: false });
      continue;
    }
    const sh = make();
    // The knee is a **joint end** (stroke.js joint): the thigh's end and the shin's start land on the pivot with no
    // overshoot and no thinning. Left free, each end overshot up to 1.1 widths its own way and the leg broke apart at the
    // fold — a crouch bends the knee past 90°. The ankle end is a joint too (it meets the foot's fill); the hip end keeps
    // its overshoot, hidden behind the body (renderOrder 1.2). The arm keeps raw ends — its fold is gentler and a hand
    // or a sleeve covers the meeting
    let kneeX = 0;   // the knee's x in thigh space
    let footX = 0;   // the foot's x in shin space
    // A rex leg is MASS whatever the leg slot says — a filled tapered thigh and shin and a big flat
    // three-clawed foot (a species branch: the way of drawing differs, the dog-muzzle rule). The knee and
    // ankle arrangement is the standard one, so the crouch folds it and the sole stays level like any leg
    if (spec.species === "rex") {
      const thigh = crumple([[-0.034, 0.012], [0.034, 0.012], [0.023, -kneeH], [-0.023, -kneeH]], 0.003, side * 5);
      paintPart(s, spec, thigh, cloth, { body: true });
      s.contour(thigh, { color: ink0 });
      const shin = crumple([[-0.021, 0.006], [0.021, 0.006], [0.014, -shinLen + 0.004], [-0.014, -shinLen + 0.004]], 0.003, side * 9);
      paintPart(sh, spec, shin, cloth, { body: true });
      sh.contour(shin, { color: ink0 });
      const ft = make();
      const foot = crumple([[side * -0.022, 0], [side * -0.018, 0.022], [side * 0.042, 0.022], [side * 0.05, 0]], 0.003, side * 13);
      paintPart(ft, spec, foot, cloth, { body: true });
      ft.contour(foot, { color: ink0 });
      // Three claws off the foot's front edge
      for (let c = 0; c < 3; c += 1) {
        const cxp = side * (0.016 + c * 0.014);
        ft.line([[cxp, 0.003], [cxp + side * 0.007, 0.012]], { color: ink0, size: "S" });
      }
      limbs.push({ sketch: s, lowerSketch: sh, footSketch: ft, pivot: [x, hipY], elbow: [0, -kneeH], ankle: [0, -shinLen], kind: "leg", side, index: side < 0 ? 0 : 1, behind: false });
      continue;
    }
    if (legKind === "bent") {
      // The drawn bend is the knee itself
      kneeX = side * 0.04;
      s.line([[0, 0], [kneeX, -kneeH]], { color: ink0, joint: [false, true] });
      footX = side * 0.01 - kneeX;
      sh.line([[0, 0], [footX, -shinLen]], { color: ink0, joint: [true, true] });
    } else if (legKind === "stub") {
      s.line([[0, 0], [0, -kneeH]], { color: ink0, size: "L", joint: [false, true] });
      sh.line([[0, 0], [0, -shinLen]], { color: ink0, size: "L", joint: [true, true] });
    } else if (legKind === "tiptoe") {
      // A thin leg standing on its toes — the foot points downward
      kneeX = side * 0.004;
      s.line([[0, 0], [kneeX, -kneeH]], { color: ink0, size: "S", joint: [false, true] });
      sh.line([[0, 0], [side * 0.004, -shinLen]], { color: ink0, size: "S", joint: [true, true] });
      sh.line([[side * 0.004 - 0.012, -shinLen + 0.012], [side * 0.004, -shinLen], [side * 0.004 + 0.012, -shinLen + 0.012]], { color: ink0, size: "S" });
      limbs.push({ sketch: s, lowerSketch: sh, pivot: [x, hipY], elbow: [kneeX, -kneeH], kind: "leg", side, index: side < 0 ? 0 : 1, behind: false });
      continue;
    } else {
      const nx = noise(side * 3.3) * 0.02;
      kneeX = nx * KNEE_SPLIT;
      s.line([[0, 0], [kneeX, -kneeH]], { color: ink0, joint: [false, true] });
      footX = nx - kneeX;
      sh.line([[0, 0], [footX, -shinLen]], { color: ink0, joint: [true, true] });
    }
    // The foot — its own sketch, hung from an **ankle pivot** at the shin's end. Baked into the shin it turned with the knee:
    // the rest bend alone tilted every standing foot ~15°, one corner in the floor and the other in the air. The scene counter-
    // rotates the ankle by what the hip and knee turned (animate.js), so the sole stays level with the floor at any fold.
    // The tiptoe keeps its foot in the shin — a pointed foot is meant to swing with it
    const ft = make();
    if (legKind === "boots") {
      // Boots — a mass filled to the ankle
      const boot = crumple([[-0.028, 0], [-0.024, 0.045], [0.012, 0.045], [0.036, 0.006], [0.036, 0]], 0.003, footX * 90);
      paintPart(ft, spec, boot, cloth === skin ? ink0 : shade(cloth, 0.75), { body: true });
      ft.contour(boot, { color: ink0 });
    } else {
      // A round foot — the reference default
      dot(ft, side * 0.008, 0.012, 0.022, skin);
    }
    limbs.push({ sketch: s, lowerSketch: sh, footSketch: ft, pivot: [x, hipY], elbow: [kneeX, -kneeH], ankle: [footX, -shinLen], kind: "leg", side, index: side < 0 ? 0 : 1, behind: false });
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

    if (armKind === "sleeve") {
      // The upper arm is a cloth-colored sleeve. The forearm is a bare arm plus a hand.
      const sl = crumple([[side * -0.012, 0.012], [side * 0.012, 0.012], [side * 0.014, -upperLen], [side * -0.012, -upperLen]], 0.0025, side * 3);
      paintPart(upper, spec, sl, cloth, { body: true });   // a sleeve — the body's goofy material
      upper.contour(sl, { color: ink0 });
      // The elbow and the wrist are **joint ends**, like the knee (the leg above): a free end overshoots up to 1.1 widths
      // and thins to a dome, and the arm broke apart at the fold — every IK pose bends the elbow (a hanging arm included).
      // The shoulder end keeps its overshoot: that is the hand-drawn embedding into the body
      lower.line([[0, 0], [side * 0.004, -lowerLen]], { color: ink0, joint: [true, true] });
      dot(lower, side * 0.006, -lowerLen - 0.006, 0.022, skin);
    } else if (armKind === "stubby") {
      // Two short thick bones plus a fist
      upper.line([[0, 0], [side * 0.004, -upperLen]], { color: ink0, joint: [false, true] });
      lower.line([[0, 0], [side * 0.004, -lowerLen]], { color: ink0, joint: [true, true] });
      dot(lower, side * 0.006, -lowerLen - 0.004, 0.02, skin);
    } else {
      // stick / mitten — two thin bones, meeting at joint ends (the elbow and the wrist; see the sleeve above)
      upper.line([[0, 0], [side * 0.006, -upperLen]], { color: ink0, joint: [false, true] });
      lower.line([[0, 0], [side * 0.004, -lowerLen]], { color: ink0, joint: [true, true] });
      if (armKind === "mitten") dot(lower, side * 0.006, -lowerLen - 0.006, 0.024, skin);
      else lower.line([[side * 0.006 - 0.016, -lowerLen], [side * 0.006 + 0.016, -lowerLen + 0.004]], { color: ink0 });
    }

    // back — hands behind the back. Only the elbow pokes out at the side. Only the thickness differs by form
    const back = make();
    back.line([[0, 0], [side * 0.03, -0.045], [side * 0.05, -0.08]], { color: ink0 });

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
//   leg      a biped's leg (IK): hip position (the right leg — the left mirrors x) and the thigh and shin lengths (the knee at KNEE_SPLIT).
//            The clock solves a crouch's foot target onto it (motion/actions.js solveLeg). null on a quad and on float legs (feet only — nothing to bend)
//   legTop   the torso hem height — how far the body settles when a quad lies down to sleep
//   body     a quad's torso and leg-root dimensions { frontHipX, hindHipX, hipY, legTop, bodyH, bodyW, bodyCx } — the sitting pose (motion/actions.js sitPose)
//            is solved to fit this individual (tilting the body about the front legs' root to put the hips on the floor, folding the hind legs to put the feet on the floor). null on a biped
//   tailLift the tail's per-individual jitter (−1~1) — varies how far the cat idle arch curls per individual (motion/table.js tailIdlePose)
export function motionRig(spec) {
  const box = layout(spec);
  const hips = box.quad ? quadHips(box) : null;
  const hipY = box.legTop + 0.02;
  // arm is only for bipeds with arms. An armless biped (an imp with arms none) has arm null but quad false too — only the arm action layer rests
  return {
    arm: box.quad || spec.parts.arms === "none" ? null : armRigOf(spec, box),
    // The leg IK's bones. A quad's four legs are the same length, so one description serves them all; its hip
    // height is the quad's own (quadHips), not the biped hem. float has no leg to bend on either skeleton
    leg: spec.parts.legs === "float" ? null : box.quad ? {
      x: hips.front, y: hips.hipY, thigh: hips.hipY * KNEE_SPLIT, shin: hips.hipY * (1 - KNEE_SPLIT)
    } : {
      x: box.bodyW * (BUILD[spec.parts.build] || BUILD.medium).stance,
      y: hipY, thigh: hipY * KNEE_SPLIT, shin: hipY * (1 - KNEE_SPLIT)
    },
    legTop: box.legTop, quad: box.quad, tailLift: spec.proportions.tailLift,
    // Tailed — a quad, or the tailed biped (the rex). The clock flips a tailed creature to face its walking
    // direction, so the tail always TRAILS: pointing into the walk it read as leading with it
    tailed: box.quad || ((SPECIES.find((s) => s.name === spec.species) || {}).identity || {}).tail === true,
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
// the **skin** (line, thick, plume, tuft, block, ball, puff, plus the disabled wedge) is what goes on that spine — a thin line, a filled thick tail, a bushy plume,
// a tuft at the tip, a block, beads, a pom — and the **length** (tailLength) shrinks the whole skeleton.
// Any skin goes on any skeleton (a plume skin on a stub skeleton = a pom). The scene stands it up as an eight-bone chain and rotates each bone (tailSketch below).

// The skeleton — the spine point list. tailLift (a ratio) raises or lowers the tip a little
function tailSpine(kind, lift, rex = false) {
  const up = lift * 0.02;
  // The rex's tail is the dinosaur's COUNTERWEIGHT whatever the tail slot says (the rex-leg rule: the way of
  // drawing differs by species). The quad spines all climb — a cat's tail stands and curls over the back —
  // and at 1.6× that put an upright cat tail on the tyrannosaur's hip. A counterweight runs OUT low, droops a
  // little under its own weight, and only the tip rises. Each kind keeps its character sideways: kink zigzags,
  // hook and curl turn their tip up, ring curls its tip right over, stubtail stays blunt
  if (rex) {
    if (kind === "stubtail") return [[0, 0], [0.025, -0.004], [0.05, 0.008]];
    if (kind === "flag") return [[0, 0], [0.06, -0.008], [0.11, 0.025 + up]];
    if (kind === "kink") return [[0, 0], [0.05, -0.015], [0.09, 0.012], [0.13, -0.012], [0.18, 0.018 + up]];
    if (kind === "hook") return [[0, 0], [0.06, -0.01], [0.12, 0], [0.16, 0.03], [0.15, 0.07 + up]];
    if (kind === "ring") return [[0, 0], [0.07, -0.01], [0.13, 0.01], [0.16, 0.05], [0.13, 0.08 + up]];
    if (kind === "curl") return [[0, 0], [0.06, -0.012], [0.12, 0.005], [0.17, 0.04 + up]];
    return [[0, 0], [0.07, -0.012], [0.14, -0.002], [0.2, 0.02 + up]];   // longtail — the full counterweight
  }
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
// The two edges, swollen sideways along the spine by a thickness of widthAt(t, i). t is fitted to the whole tail (0~1) by tMap; i is the rung
function tubeSides(spine, widthAt, tMap = (t) => t) {
  const ts = spineT(spine);
  const left = [], right = [];
  for (let i = 0; i < spine.length; i += 1) {
    const [x, y] = spine[i];
    const [nx0, ny0] = spine[Math.max(0, i - 1)], [nx1, ny1] = spine[Math.min(spine.length - 1, i + 1)];
    let dx = nx1 - nx0, dy = ny1 - ny0;
    const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const w = widthAt(tMap(ts[i]), i);
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

// A tail is **an eight-bone chain under one skin** — the spine is split into 8, a joint (origin) sits at each bone, and the scene bends the bones
// separately: the root (0) takes the swish, wag, walking and sleep; the tip (the last) takes the tapping, tremble and follow-through; and **raise** blends each
// joint's angle from the rest pose toward standing straight. Eight rather than four: a pose is the same curve either way, so twice the joints
// each turn half as far — the arch comes out at 15~27° a joint instead of 24~51°, the range linear blend skinning bends cleanly in.
// The skin is drawn **once along the whole spine** — one tube, two side lines, the tip, the pattern — in the pivot's space, and every vertex is
// weighted to two or three bones (weightsAt) so the scene's SkinnedMesh bends it as one piece: no seams, no caps, a bend curves instead of
// breaking (the four rigid bone meshes it replaced opened wedges at every joint)
export const TAIL_BONES = 8;
// variant is the boil frame — only the drawing noise differs; the bones, the pivot and the weights are the same in every frame.
// Returns the skin (sketch — in the pivot's space; sketches is the same as a one-item list, for the check scripts), the bones and weightsOf
export function tailSketch(spec, variant = 0) {
  const rng = makeRng(((spec.proportions.wobbleSeed + 404) ^ (variant * 0x9e3779b9)) >>> 0);
  const noise = makeNoise(rng);
  const box = layout(spec);
  const sketch = new Sketch(noise, spec.proportions.wobble);
  const none = { sketches: [sketch], sketch, bones: [], pivot: [0, 0], weightsAt: () => [0, 1, 0, 0, 0, 0, 0, 0], weightsOf: () => [0, 1, 0, 0, 0, 0, 0, 0] };
  // Who has a tail is the species' identity (species.js), not the skeleton's — the rex is a biped WITH one.
  // A biped species without identity.tail (humans, imps) draws nothing here, as before
  const hasTail = ((SPECIES.find((s) => s.name === spec.species) || {}).identity || {}).tail === true;
  if (!box.quad && !hasTail) return none;

  const p = spec.proportions;
  const ink0 = spec.palette.ink;
  const cx = box.bodyCx;
  // The root: a quad's is the rump (the body's back end); a biped's (the rex) is beside the hip, and the
  // skeleton runs out low from there — the counterweight (the rex branch of tailSpine)
  const pivot = box.quad
    ? [cx + box.bodyW * 0.98, (box.bodyTop + box.legTop) / 2 + box.bodyH * 0.1]
    : [box.bodyW * 0.85, box.legTop + box.bodyH * 0.2];
  // Length — shrinks the whole skeleton (long 1 · medium 0.7 · short 0.45). The skin thickness is unchanged.
  // A rex tail is the dinosaur's counterweight — the whole skeleton three-quarters again as long, and near
  // double thick below. It has to read as the third limb of the silhouette, not an appendage
  const rexK = box.quad ? 1 : 1.75;
  const lenK = (spec.parts.tailLength === "short" ? 0.45 : spec.parts.tailLength === "medium" ? 0.7 : 1) * rexK;
  const spine = tailSpine(spec.parts.tail, p.tailLift, !box.quad).map(([x, y]) => [x * lenK, y * lenK]);
  const skin = spec.parts.tailSkin || "line";
  const stub = spec.parts.tail === "stubtail";
  // The tail grows from the body, so it is the body's color — a quad's cloth, the head color or a tone of it (its value step is the head's: one mass)
  const fur = spec.palette.cloth;
  // The creature's pattern (the pattern slot), rendered along the tube: stripes as rings, dots and spots along the spine, hatch across it.
  // Light ink on dark fur, as on the body (patternOf). Only a tube carries it — a thin line has no area
  const pattern = patternOf(spec);
  const parts = splitSpineN(spine, TAIL_BONES);   // the bones — joint origins and rest directions
  const total = spine.reduce((acc, q, i) => (i ? acc + Math.hypot(q[0] - spine[i - 1][0], q[1] - spine[i - 1][1]) : 0), 0);
  const ts = spineT(spine);

  // The thickness function (on the whole tail's t) — per skin. A rex tail is three times and a bit thick at the
  // root, tapering hard — the counterweight
  const thickK = box.quad ? 1 : 3.2;
  const widthOf = {
    thick: (t) => (stub ? 0.024 : 0.02 * thickK) * (1 - t * 0.7) + 0.004,
    plume: (t) => (stub ? 0.03 : 0.016 + 0.024 * Math.sin(Math.PI * Math.min(1, t * 1.15))),
    block: () => (stub ? 0.024 : 0.019 * thickK),
    wedge: (t) => (stub ? 0.03 : 0.028) * (1 - t) + 0.001
  };
  // The point at a whole-tail t — for placing fur strokes, beads, bands and tufts
  const at = (t) => alongSpine(spine, Math.max(0, Math.min(1, t)));
  // The pattern along a tube — every mark sits inside the tube's width at its t, so nothing needs clipping: a ring is a mark from one
  // side to the other (the ribbon tapers to nothing at its ends), a dot a short mark off the spine, a spot a small contour, a hatch a diagonal
  const tubePattern = (widthAt) => {
    if (!pattern) return;
    const color = pattern.color;
    if (pattern.kind === "stripes") {
      for (let d = 0.06; d < total - 0.025; d += 0.05) {
        const t = d / total, a = at(t), w = widthAt(t) * 0.98;
        sketch.line([[a.x - a.dy * w, a.y + a.dx * w], [a.x + a.dy * w, a.y - a.dx * w]], { color, skinT: [t, t] });   // a ring
      }
    } else if (pattern.kind === "dots") {
      let side = 1;
      for (let d = 0.05; d < total - 0.02; d += 0.045, side = -side) {
        const t = d / total, a = at(t), w = widthAt(t) * 0.45;
        const x = a.x - a.dy * w * side, y = a.y + a.dx * w * side;
        sketch.line([[x - a.dx * 0.006, y - a.dy * 0.006], [x + a.dx * 0.006, y + a.dy * 0.006]], { color, skinT: [t, t] });
      }
    } else if (pattern.kind === "spots") {
      for (let d = 0.07; d < total - 0.03; d += 0.075) {
        const t = d / total, a = at(t), r = Math.min(0.012, widthAt(t) * 0.55);
        if (r > 0.005) sketch.contour(blobPath(a.x, a.y, r, r * 0.8, { lumps: 4, amount: 0.25, noise: null }), { color, size: "S", skinT: [t, t] });
      }
    } else if (pattern.kind === "hatch") {
      for (let d = 0.05; d < total - 0.02; d += 0.035) {
        const t = d / total, a = at(t), w = widthAt(t) * 0.9;
        sketch.line([[a.x - a.dy * w - a.dx * w * 0.5, a.y + a.dx * w - a.dy * w * 0.5], [a.x + a.dy * w + a.dx * w * 0.5, a.y - a.dx * w + a.dy * w * 0.5]], { color, size: "S", skinT: [t, t] });
      }
    }
  };
  // The filled body along the whole spine — the fill, the pattern, then the two side lines. The lines run **fine** (0.7): a tube is a small part,
  // and at weight 1 the two lines ate a thin tail's width and its tip turned into a black knob. The root end of the lines is a joint (no overshoot
  // into the body). The tip **tapers to a point** under the lines — the rails close over 1.6 end-widths and the lines meet there, the pencil's flick
  // meeting there without a flick (two flicks doubled into a spike; a disc and an arc of line were ink on ink). block keeps its square tip; a tip thinner than 0.004 (wedge) is a point already.
  // The rails run on a fine spine (a rung every 0.012) and the base is a strip between them — the bones bend it rung by rung; a fan from the centre of a
  // coarse spine threw long triangles across the bones and folded like a paddle
  // The fine spine is **smoothed** (two passes of a three-point mean, the ends kept) so the skeleton's corners round off, and the width at every rung is
  // **clamped by the bend** — at most 0.85 × the radius of curvature there — so a tube can never be thicker than its curl and fold over itself (a hook
  // skeleton under a plume did, at the tip)
  const tube = (widthAt, { squareTip = false } = {}) => {
    let fine = resample(spine, 0.012);
    for (let pass = 0; pass < 2; pass += 1) fine = fine.map((q, i) => (i === 0 || i === fine.length - 1 ? q : [(fine[i - 1][0] + q[0] + fine[i + 1][0]) / 3, (fine[i - 1][1] + q[1] + fine[i + 1][1]) / 3]));
    const end = spine[spine.length - 1], prev = spine[spine.length - 2];
    const wEnd = widthAt(1);
    const taper = !squareTip && wEnd > 0.004;
    const taperLen = wEnd * 1.6;
    if (taper) {
      const len = Math.hypot(end[0] - prev[0], end[1] - prev[1]) || 1;
      const dx = (end[0] - prev[0]) / len, dy = (end[1] - prev[1]) / len;
      for (let k = 1; k <= 4; k += 1) fine.push([end[0] + dx * taperLen * k / 4, end[1] + dy * taperLen * k / 4]);
    }
    const whole = fine.reduce((acc, q, i) => (i ? acc + Math.hypot(q[0] - fine[i - 1][0], q[1] - fine[i - 1][1]) : 0), 0);
    const body = taper ? whole - taperLen : whole;   // the spine's own length — the taper lies past it
    const widthOnFine = (t) => {
      const d = t * whole;
      if (d <= body) return widthAt(Math.min(1, d / body));
      return wEnd * Math.pow(Math.max(0, 1 - (d - body) / taperLen), 0.7);   // 0 at the point
    };
    // The radius of the bend at each rung — the segment length over the turning angle; straight is infinite
    const radius = fine.map((q, i) => {
      if (i === 0 || i === fine.length - 1) return Infinity;
      const a = fine[i - 1], c = fine[i + 1];
      const ux = q[0] - a[0], uy = q[1] - a[1], vx = c[0] - q[0], vy = c[1] - q[1];
      const lu = Math.hypot(ux, uy) || 1e-9, lv = Math.hypot(vx, vy) || 1e-9;
      const turn = Math.abs(Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy));
      return turn < 1e-6 ? Infinity : ((lu + lv) / 2) / turn;
    });
    const { left, right } = tubeSides(fine, (t, i) => Math.min(widthOnFine(t), 0.85 * radius[i]));
    if (taper) { left[left.length - 1] = fine[fine.length - 1].slice(); right[right.length - 1] = fine[fine.length - 1].slice(); }   // the rails meet at the point
    // Every triangle carries its t along the spine as its skin tag — the strip per rung, the side lines by arc fraction — so the skin is bent by
    // construction, never guessed from a vertex's position (beside a tight curl a guess picks the curl's other arm, and the skin tears)
    const tsFine = spineT(fine);
    const tRung = (i) => Math.min(1, (tsFine[i] * whole) / body);
    paintPart(sketch, spec, [...left, ...right.slice().reverse()], fur, { body: true, strip: [left, right], stripT: tRung });   // the tail is fur — the body's goofy material
    tubePattern(widthAt);
    const railT = left.map((_, i) => tRung(i));   // the rails' tags follow the spine's t rung by rung — a rail's own length runs short on the inside of a curl
    sketch.line(left, { color: ink0, size: "S", joint: [true, true], skinT: railT });    // both ends joints — at the point two flicks would double into a spike
    sketch.line(right, { color: ink0, size: "S", joint: [true, true], skinT: railT });
    if (!taper) sketch.line([left[left.length - 1], right[right.length - 1]], { color: ink0, size: "S", joint: [true, true], skinT: [1, 1] });
  };
  // A thin spine line — its root a joint (no overshoot into the body), the tip free (the pencil's flick)
  const spineLine = (size) => sketch.line(spine, { color: ink0, size, joint: [true, false], skinT: [0, 1] });

  if (skin === "line") {
    // A thin line — one hand-drawn tail stroke (thick on a stub)
    spineLine(stub ? "L" : "M");
  } else if (skin === "thick" || skin === "block" || skin === "wedge") {
    tube(widthOf[skin], { squareTip: skin === "block" });
  } else if (skin === "plume") {
    // A bushy plume tail — a filled body swollen in the middle plus fur strands: hairs growing from the tube's **edge** (the local width), leaning
    // back toward the root, fine pencil lines (0.25) rooted at the edge and flicking at their ends — a mark from a fixed distance read as a thorn,
    // and the ones crowding the tip made a black knob with the lines. The tip fans out into three hairs past the point — the bushy end. A pom on a stub
    tube(widthOf.plume);
    const n = stub ? 3 : 8;
    for (let i = 0; i < n; i += 1) {
      const t = stub ? 0.3 + i * 0.25 : 0.15 + i * 0.09;
      const a = at(Math.min(0.98, t));
      const side = i % 2 ? 1 : -1;
      const nx = -a.dy * side, ny = a.dx * side;
      const w = (stub ? 0.03 : widthOf.plume(t)) * 0.85;
      const len = stub ? 0.024 : 0.032;
      const tt = Math.min(0.98, t);
      sketch.line([[a.x + nx * w, a.y + ny * w], [a.x + nx * (w + len) - a.dx * len * 0.35, a.y + ny * (w + len) - a.dy * len * 0.35]], { color: ink0, size: "S", joint: [true, false], skinT: [tt, tt] });   // a hair — rooted at the edge, flicking at its end; under the grit's width, so no crumbs
    }
    if (!stub) {
      const e = at(1);
      const reach = widthOf.plume(1) * 1.6;   // the taper's length — the point is this far past the spine's end
      for (const ang of [-0.45, 0, 0.45]) {
        const c = Math.cos(ang), sn = Math.sin(ang);
        const dx = e.dx * c - e.dy * sn, dy = e.dx * sn + e.dy * c;
        const x0 = e.x + e.dx * reach * 0.6, y0 = e.y + e.dy * reach * 0.6;
        sketch.line([[x0, y0], [x0 + dx * 0.03, y0 + dy * 0.03]], { color: ink0, size: "S", joint: [true, false], skinT: [1, 1] });   // the tip's tuft
      }
    }
  } else if (skin === "tuft") {
    // A tuft at the tip — a thin line plus a filled tuft at the end (a lion's tail)
    spineLine("M");
    const tip = spine[spine.length - 1];
    const ball = blobPath(tip[0], tip[1], stub ? 0.02 : 0.024, stub ? 0.018 : 0.02, { lumps: 4, amount: 0.25, noise: null });
    paintPart(sketch, spec, ball, shade(fur, 0.82), { body: true, skinT: 1 });
    sketch.contour(ball, { color: ink0, skinT: [1, 1] });
  } else if (skin === "puff") {
    // A pom — a rabbit tail. Regardless of the skeleton's length, one bushy tuft near the rump (at spine 0.3) plus fur strokes around it
    const a = at(0.3);
    const r = 0.04;
    const pom = blobPath(a.x, a.y + 0.004, r, r * 0.92, { lumps: 6, amount: 0.22, noise: null });
    paintPart(sketch, spec, pom, fur, { body: true, skinT: 0.3 });
    sketch.contour(pom, { color: ink0, skinT: [0.3, 0.3] });
    for (let i = 0; i < 6; i += 1) {
      const ang = -1.0 + i * 0.66;   // around the top and outside
      const x0 = a.x + Math.cos(ang) * r * 0.9, y0 = a.y + 0.004 + Math.sin(ang) * r * 0.85;
      sketch.line([[x0, y0], [x0 + Math.cos(ang) * 0.016, y0 + Math.sin(ang) * 0.016]], { color: ink0, size: "S", skinT: [0.3, 0.3] });
    }
  } else if (skin === "ball") {
    // Beads — a tail strung with beads along the spine, **on a thin spine line** (without it the beads float behind the rump). One pom on a stub (a rabbit)
    if (stub) {
      const a = at(0.6);
      const ball = blobPath(a.x, a.y + 0.005, 0.03, 0.028, { lumps: 4, amount: 0.15, noise: null });
      paintPart(sketch, spec, ball, fur, { body: true, skinT: 0.6 });
      sketch.contour(ball, { color: ink0, skinT: [0.6, 0.6] });
    } else {
      spineLine("S");
      const n = 4;
      for (let i = 0; i < n; i += 1) {
        const t = 0.18 + (i / (n - 1)) * 0.8;
        const a = at(t);
        const r = 0.024 - i * 0.004;
        const ball = blobPath(a.x, a.y, r, r, { lumps: 3, amount: 0.12, noise: null });
        paintPart(sketch, spec, ball, fur, { body: true, skinT: t });
        sketch.contour(ball, { color: ink0, skinT: [t, t] });
      }
    }
  } else throw new Error(`unknown tail skin: ${skin}`);   // a misspelt skin must not silently draw another

  // Skin weights by t along the rest spine. A bone's influence covers its own stretch and reaches BAND of the **tail** past each end, fading out by a
  // smoothstep, so a vertex is carried by two or three bones and a turn at one joint is spread along a stretch of tail rather than gathered at a seam.
  // BAND is held in tail units on purpose: tie it to the bone's own span and adding bones makes every bend *sharper* rather than smoother — twice as
  // many joints, each with half the reach. Held as it is, twice the joints each turn half as far over the same reach, which is the point of adding them.
  // weightsAt(t) serves the skin tags (every triangle the tail draws carries its t); weightsOf(x, y) is the fallback for an untagged vertex — its
  // nearest point on the spine — and is wrong beside a tight curl. Whatever the weights, the bind pose is exact: they always add up to 1
  const BAND = 0.125;
  const SLOTS = 4;   // the skinIndex / skinWeight attributes hold four bones a vertex; this band reaches three
  const smooth = (u) => u * u * (3 - 2 * u);
  const weightsAt = (t) => {
    const near = [];
    for (let k = 0; k < TAIL_BONES; k += 1) {
      const d = Math.max(0, k / TAIL_BONES - t, t - (k + 1) / TAIL_BONES);   // how far t lies outside this bone's own stretch
      if (d < BAND) near.push([k, smooth(1 - d / BAND)]);
    }
    near.sort((a, b) => b[1] - a[1]);
    near.length = Math.min(near.length, SLOTS);
    const sum = near.reduce((acc, q) => acc + q[1], 0) || 1;
    const flat = [];
    for (let s = 0; s < SLOTS; s += 1) flat.push(near[s] ? near[s][0] : 0, near[s] ? near[s][1] / sum : 0);
    return flat;   // [bone, weight] × 4, heaviest first, adding up to 1
  };
  const weightsOf = (x, y) => {
    let best = Infinity, t = 0;
    for (let i = 1; i < spine.length; i += 1) {
      const [ax, ay] = spine[i - 1], [bx, by] = spine[i];
      const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1e-9;
      const u = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2));
      const d = (x - ax - dx * u) ** 2 + (y - ay - dy * u) ** 2;
      if (d < best) { best = d; t = ts[i - 1] + (ts[i] - ts[i - 1]) * u; }
    }
    return weightsAt(t);
  };
  return { sketches: [sketch], sketch, bones: parts.map((q) => ({ origin: q.origin, angle: q.angle })), pivot, weightsAt, weightsOf };
}
