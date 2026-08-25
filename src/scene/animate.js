// State → rig. Applies the state object the clock produced to the three.js groups every frame.
// This knows nothing about actions — the arms only ease toward the joint angles the clock gave (state.arms).
// Docs: guidelines/motion/catalog.md § the state object, guidelines/rig.md

import * as THREE from "three";
import { buildEmoji } from "./emoji.js";
import { disposeGroup } from "./mesh.js";
import { BOIL_FRAMES } from "./rig.js";
import { damp } from "../motion/ease.js";
import { solveLeg } from "../motion/index.js";

const EMOJI_TARGET = new THREE.Vector3();

// snap: joints go straight to the target angle with no easing (the bind view). boil: whether the 3 boil frames cycle (line texture).
// The two are different axes — lines can boil in the bind pose, and lines can be pinned mid-motion.
export function applyState(item, state, t, noise, { snap = false, boil = true } = {}) {
  // Boil — cycles the ink variants on a low period. Off, it is pinned to frame 0.
  const frame = boil ? Math.floor(t * item.boilFps + item.boilOffset) % BOIL_FRAMES : 0;
  for (const key in item.frames) {
    const list = item.frames[key];
    for (let k = 0; k < BOIL_FRAMES; k += 1) list[k].visible = k === frame;
  }
  // The tail and the limbs — every frame in one mesh, the frame picked by drawRange (rig.js boilRanges)
  for (const b of item.boilRanges || []) b.geometry.setDrawRange(b.ranges[frame][0], b.ranges[frame][1]);

  // The whole body — sway (rotating about the feet), shiver, jump, breathing + rocking + jelly + stretch
  item.group.rotation.z = state.sway;
  // The distance walked (walkX) · a quad flipping to face its walking direction (facing ±1, thinning through 0 and flipping)
  item.group.position.x = item.baseX + state.shiverX + (state.walkX || 0);
  // The torso is the crouch's MASTER — the clock hands over one scalar (state.bodyDrop, how far the body
  // sinks) and it is eased here, on the item. The limb loop below solves the knees off it (IK: move the torso
  // and the knees bend by themselves), and the body's final height is then the FK of what the legs actually
  // draw — so the feet hold the floor exactly, through every blend
  // The follow is **fast on purpose**. The clock's crouch is already an eased envelope (jumpCurve's ramp and
  // bump), so this one exists only to swallow a discontinuous target when one action cuts into another — not to
  // shape the move. At 0.18 it took 167 ms to reach half the crouch and 375 ms to reach 90% of it, against a
  // landing ramp that is 67 ms long and a tick that is 42 ms: the body came down and the knees bent a fifth of
  // a second later. It arrives inside two ticks now
  if (!item.dropEase) item.dropEase = { x: 0, v: 0 };
  if (snap) { item.dropEase.x = state.bodyDrop || 0; item.dropEase.v = 0; }
  else damp(item.dropEase, state.bodyDrop || 0, 1);
  const bodyDrop = Math.max(0, item.dropEase.x);
  item.group.position.y = item.baseY + state.hopY;
  item.group.scale.set(
    (state.facing === undefined ? 1 : state.facing) * (1 + state.breathe * 0.006 + state.squashX + state.stretchX + state.jellyX),
    1 + state.breathe * 0.011 + state.rock + state.squashY + state.jellyY,
    1
  );

  // Torso tilt — a quad sitting (bodyTilt, negative = the back goes down). It turns about the front legs' root (item.bodyPivot): rotation alone would use the origin (the middle of the soles) as the axis
  // and lift the front paws, so the position moves along to leave the axis in place. The head group is not a child of the body group and stays as it is — the axis is right below the head, so the head does not move
  const tilt = state.bodyTilt || 0;
  if (item.bodyPivot && tilt !== 0) {
    const [px, py] = item.bodyPivot;
    const c = Math.cos(tilt), s = Math.sin(tilt);
    item.bodyGroup.rotation.z = tilt;
    item.bodyGroup.position.set(px - (px * c - py * s), py - (px * s + py * c), 0);
  } else {
    item.bodyGroup.rotation.z = 0;
    item.bodyGroup.position.set(0, 0, 0);
  }

  // Head — tilt, roll, dip, nod
  item.headGroup.rotation.z = state.headAngle;
  item.headGroup.position.y = item.neckY + state.headBob;

  // Face turn — shifts the feature group (eyes, nose, mouth, brows, eyewear, cheeks, whiskers, muzzle) as a whole and squashes it slightly
  // to fake a turned head. Side to side on x, up and down on y. The origin is the centre of the head, so the squash is about that point too.
  const [turnX, turnY] = state.faceTurn;
  const shiftX = turnX * item.headRx * 0.26;
  const shiftY = turnY * item.headRy * 0.16;
  item.faceGroup.position.x = shiftX;
  item.faceGroup.position.y = item.faceCy - item.neckY + shiftY;
  item.faceGroup.scale.set(1 - Math.abs(turnX) * 0.12, 1 - Math.abs(turnY) * 0.08, 1);
  // Layers attached to the head (ears, horns, hair, hat) shift in position only (size unchanged) — fake 3D: the shift = the layer's depth (rig.js DEPTH) × the features' shift.
  // Front (positive) goes toward the face, back (negative) the other way. Depth decides it, not meaning
  for (const p of item.parallax) {
    p.group.position.x = shiftX * p.depth;
    p.group.position.y = shiftY * p.depth;
  }

  // Tail — an eight-bone chain. Root angle (tailAngle) + the tip bone's relative angle (tailTip) + raise (tailRaise: each joint blends from its rest pose toward a target pose) + bristle (tailPuff)
  if (item.tailGroup) {
    // Bristle — **thickness only**, 1 → 1.6× (length unchanged): each bone scales perpendicular to its own axis (scale.y; the bones are siblings, so no child is sheared). The same envelope as the eyes (pupils)
    const puff = 1 + 0.6 * (state.tailPuff || 0);
    const bones = item.tailBones;
    const n = bones.length;
    const raise = state.tailRaise || 0;
    // A raised tail is drawn **above** the body and head (2.08 — above the outline and the hair on the scalp, below the ears and face). At rest (looped or curled over the back) it goes behind (0.8, guidelines/rig.md).
    // One cat in four has its tail root inside the big head silhouette, so left behind, a raised tail is hidden by the head and the raise is invisible (item.orderBase = the individual's block)
    const front = raise > 0.5;
    if (item.tailFront !== front) {
      item.tailFront = front;
      const order = (item.orderBase || 0) + (front ? 2.08 : 0.8);
      item.tailGroup.traverse((node) => { if (node.isMesh) node.renderOrder = order; });
    }
    // Two sets of joint target angles — bone directions (world angles). Raise (tailRaise): every joint up (π/2), or the raise pose (a ♥'s question mark).
    // The idle pose (tailArch, the cat arch): state.tailPose[i]. Both take the rotation from the skeleton's rest angle (restAngle) to that world angle, split it into joint
    // shares, and blend by the weight (the sum never passes 1, so the remainder is the skeleton as it is). Root tailAngle and tip tailTip go on top of that.
    // A share is taken **the short way round** (wrapped to ±180°), the rest cascading to the next joint. With eight bones that is all it takes:
    // the biggest turn any joint is ever asked for is 110° and the biggest bend the skin ends up with is 27°, which it bends through cleanly.
    // At four bones a joint had to swing up to 170° — a hook's tip sat at −131° while the arch asked for −20° — and the skin folded onto itself
    // (the black knob at the tip), so a cap and a rule for letting a hopeless joint keep its own bend stood here. Twice the bones did their work
    const UP = Math.PI * 0.5;
    const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
    const share = (want, cum) => wrap(want - cum);
    const rp = state.tailRaisePose;   // the raise's target pose — joint world angles (a ♥'s question mark), or null: every joint vertical
    const arch = state.tailArch || 0;
    const pose = state.tailPose;
    // A pose is a **shape**, not a list of bones: the table writes it as a few angles root→tip (motion/table.js tailIdlePose, raisePose) and it is
    // read off at however many bones this tail has, so the bone count is the rig's business alone. Straight down the list would leave the extra
    // bones all sitting on the tip's angle and flatten the last third of the tail
    const sample = (list, i) => {
      if (list.length < 2 || n < 2) return list[list.length - 1];
      const u = (i / (n - 1)) * (list.length - 1), k = Math.min(list.length - 2, Math.floor(u));
      return list[k] + (list[k + 1] - list[k]) * (u - k);
    };
    const upAt = (i) => (rp ? sample(rp, i) : UP);
    const archAt = (i) => sample(pose, i);
    let cumUp = 0, cumArch = 0;   // the cumulative target rotation so far (relative to rest)
    // Forward kinematics — the bones are siblings under the pivot: a bone's position is the end of the bone before it (the rest offset turned by the
    // joint rotations so far), its rotation the rest angle plus those rotations — the same pose the nested chain would give, without a chain
    let cum = 0;
    let px = 0, py = 0;
    for (let i = 0; i < n; i += 1) {
      const b = bones[i];
      const wantUp = upAt(i) - b.restAngle;   // the rotation this bone needs to reach its raise target
      const sUp = share(wantUp, cumUp);   // this joint's share, with the rotation up to its parent taken off — the short way round
      let rot = sUp * raise;
      cumUp += sUp;
      if (arch > 0 && pose) {
        const sArch = share(archAt(i) - b.restAngle, cumArch);
        rot += sArch * arch;
        cumArch += sArch;
      }
      if (i === 0) rot += state.tailAngle;
      if (i === n - 1) rot += state.tailTip || 0;
      if (i > 0) {
        const prev = bones[i - 1];
        const ox = b.origin[0] - prev.origin[0], oy = b.origin[1] - prev.origin[1];
        const c = Math.cos(cum), s = Math.sin(cum);
        px += ox * c - oy * s;
        py += ox * s + oy * c;
      }
      cum += rot;
      b.bone.position.set(px, py, 0);
      b.bone.rotation.z = b.restAngle + cum;
      b.bone.scale.y = puff;
    }
  }

  // Limbs — easing to the target angle. Joints follow without snapping.
  // The arms are [shoulder, elbow] world angles the clock solved from the action by IK. Oscillation (osc) is laid straight on without easing
  // (a wave's hand shake and a flap get smeared out if they go through easing).
  let plantDrop = 0;
  let plantLegs = 0;
  for (const limb of item.limbs) {
    let target;
    let elbowTarget = 0;
    let osc = 0;
    let oscElbow = 0;
    if (limb.kind === "arm") {
      const arm = state.arms[String(limb.side)];
      target = arm.shoulder;
      elbowTarget = arm.elbow;
      osc = arm.oscShoulder;
      oscElbow = arm.oscElbow;
      if (limb.back) {
        // The switch to hands-behind-the-back happens after the arms are back near the target angle. Switching mid-rotation snaps.
        const settled = Math.abs(target - limb.angle) < 0.35;
        if (settled) {
          limb.front.visible = !arm.behind;
          limb.back.visible = arm.behind;
        }
      }
    } else {
      target = state.legOffset[limb.index] || 0;
      elbowTarget = 0;   // the knee is the crouch solve's alone (crouchKnee below) — the clock writes no knee targets
      osc = state.legOsc ? state.legOsc[limb.index] || 0 : 0;
    }
    // Critically damped follow (ease in/out) — with an exponential lerp the first frame is the fastest and the arm jerks up
    if (snap) { limb.angle = target; limb.angleV = 0; limb.elbowAngle = elbowTarget; limb.elbowV = 0; }
    else {
      const s = { x: limb.angle, v: limb.angleV || 0 };
      damp(s, target, 0.18);
      limb.angle = s.x; limb.angleV = s.v;
      const e = { x: limb.elbowAngle, v: limb.elbowV || 0 };
      damp(e, elbowTarget, 0.18);
      limb.elbowAngle = e.x; limb.elbowV = e.v;
    }
    // The crouch — solved HERE, off the eased master height (bodyDrop above), never authored as angles:
    // wherever the torso is asked to sink, the knees bend to it by themselves. Laid on top of the damped
    // targets (the walk's swing) and the un-eased oscillation. The onset fades the solve in
    // over the first 2% of leg length — dead straight is outside the solver's reachable band
    let crouchThigh = 0, crouchKnee = 0;
    if (limb.kind === "leg" && limb.elbow && bodyDrop > 1e-4 && item.motionRig && item.motionRig.leg) {
      const dims = item.motionRig.leg;
      const o = Math.min(1, bodyDrop / (dims.y * 0.02));
      const onset = o * o * (3 - 2 * o);
      const solved = solveLeg(dims, limb.side, 0, -(dims.y - bodyDrop));
      crouchThigh = solved.thigh * onset;
      crouchKnee = solved.knee * onset;
    }
    limb.pivot.rotation.z = limb.angle + osc + crouchThigh;
    if (limb.elbow) limb.elbow.rotation.z = limb.elbowAngle + oscElbow + crouchKnee;
    // The sole stays level: the ankle counter-rotates what the hip and knee turned, so the foot aligns with
    // the floor at any fold (baked into the shin, a bent knee tilted the whole foot with it)
    if (limb.foot) limb.foot.rotation.z = -(limb.pivot.rotation.z + limb.elbow.rotation.z);
    // ...and the body's height comes back out of the legs as drawn (jitter aside): each knee-bent leg's FK
    // shortening, gated by the knee's fold so a straight-legged walk swing never bobs the body
    if (limb.kind === "leg" && limb.elbow && item.motionRig && item.motionRig.leg) {
      plantLegs += 1;
      const th = limb.angle + crouchThigh;
      const kn = limb.elbowAngle + crouchKnee;
      const gate = Math.min(1, Math.abs(kn) / 0.15);
      if (gate > 0) {
        const dims = item.motionRig.leg;
        plantDrop += gate * (dims.thigh * (1 - Math.cos(th)) + dims.shin * (1 - Math.cos(th + kn)));
      }
    }
  }
  // The floor holds the feet — grounded, the body descends by what the drawn legs lost. Released in the air —
  // there is no floor under the feet to hold — and released **gradually**, faded on the hop's height: the old
  // hard cutoff let the whole plant go in one tick and popped the body at liftoff
  const grounded = Math.max(0, 1 - (state.hopY || 0) / 0.02);
  if (plantLegs > 0 && plantDrop > 0 && grounded > 0) item.group.position.y -= (plantDrop / plantLegs) * grounded;

  // Brow and mouth state sets — brows: angry (2) > alt (1) > rest (0). Mouth: angry (2) > ^^ (3, the tongue on dogs) > alt (1) > rest (0). The same kind shares a mesh, so only the chosen mesh is turned on
  const angryOn = (state.angry || 0) > 0.5;
  const browOn = item.faceStates.brow[angryOn ? 2 : state.browAlt ? 1 : 0];
  const mouthOn = item.faceStates.mouth[angryOn ? 2 : state.happy ? 3 : state.mouthAlt ? 1 : 0];
  for (const m of item.faceStates.brow) m.visible = m === browOn;
  for (const m of item.faceStates.mouth) m.visible = m === mouthOn;

  // Static eyes — per eye: past halfway asleep the shut line stands **instead**, a smile arch for ^^ or a wink (that side), a fierce eye for anger (not covering it — **that eye's** static layer is switched off).
  // A wink changes one side only — the other eye's layer stays on (switching both eyes off as one layer would lose the other eye). Priority: sleep > anger > ^^/wink
  const asleep = (state.sleep || 0) > 0.5;
  for (const lid of item.staticLids) {
    const angryEye = angryOn && !asleep;
    const happyEye = !angryEye && (state.happy || (state.winkSide !== 0 && lid.eye.side === state.winkSide));
    lid.angry.visible = angryEye;
    lid.smile.visible = happyEye;
    lid.shut.visible = asleep && !happyEye;
    if (happyEye || asleep || angryEye) for (const g of lid.frames) g.visible = false;
  }

  // Eyes — startle, gaze, blink, ^^, wink. Startle does not grow the eye; it shrinks **the pupil only** (1 → 0.5×).
  // Closing is not covering but **redrawing**: an open eye ↔ a shut line (lid > 0.5) — there is no middle (half-lidded). For ^^ and a wink the smile arch stands in.
  // A blink (0.13 s) passes as two cuts: open eye → shut line → open eye
  for (const rig of item.eyeRigs) {
    rig.pupil.scale.setScalar(1 - 0.5 * (state.startle || 0));
    rig.pupil.position.x = state.gaze[0] * rig.eye.r * rig.gazeScale;
    rig.pupil.position.y = state.gaze[1] * rig.eye.r * rig.gazeScale * 0.82;
    const winked = state.winkSide !== 0 && rig.eye.side === state.winkSide;
    const angryEye = angryOn && !asleep;   // anger — redrawn as a fierce eye (below sleep, above ^^/wink)
    const smiling = !angryEye && (winked || state.happy);
    const lid = state.lid || 0;
    rig.angry.visible = angryEye;
    rig.smile.visible = smiling;
    rig.shut.visible = !angryEye && !smiling && lid > 0.5;
    rig.open.visible = !angryEye && !smiling && lid <= 0.5;
  }

  // Startle eye variants — ☆_☆ / ♥_♥. Meanwhile the eyes (the static eye frame and the eye rig) are **switched off** and replaced by the glyph (not covered). Pop in and out by the envelope (k) (0.7 → 1)
  const fx = state.eyeFx;
  const fxOn = !!fx && fx.k > 0.02;
  if (fxOn) for (const lid of item.staticLids) for (const g of lid.frames) g.visible = false;
  for (const rig of item.eyeRigs) rig.rig.visible = !fxOn;
  for (const e of item.eyeFx) {
    e.star.visible = fxOn && fx.kind === "star";
    e.heart.visible = fxOn && fx.kind === "heart";
    if (fxOn) {
      const s = 0.7 + 0.3 * fx.k;
      e.star.scale.setScalar(s);
      e.heart.scale.setScalar(s);
    }
  }

  // Emoji animation — a layer separate from motion. The clock's emoji channel supplies the kind, progress and curves (dy, scale, rot, opacity).
  // It is not attached to the head: it lives at the scene root (emojiRoot) and eases toward the point above the head (in world coordinates) —
  // so it feels dragged a beat behind when the head tilts and the body jumps. It leans slightly into the direction of the drag.
  const emoji = state.emoji;
  if (emoji) {
    if (!item.emojiMesh || item.emojiKind !== emoji.kind) {
      if (item.emojiMesh) {
        disposeGroup(item.emojiMesh);
        item.emojiRoot.remove(item.emojiMesh);
      }
      item.emojiMesh = buildEmoji(emoji.kind, noise);
      item.emojiKind = emoji.kind;
      item.emojiRoot.add(item.emojiMesh);
    }
    item.headGroup.updateWorldMatrix(true, false);
    // Position per kind: usually above the crown, sweat beside the temple
    if (emoji.kind === "sweat") EMOJI_TARGET.set(item.headRx * 0.95, item.headTop - item.neckY - item.headRy * 0.35, 0);
    else EMOJI_TARGET.set(0.02, item.headTop - item.neckY + 0.15, 0);
    item.headGroup.localToWorld(EMOJI_TARGET);
    if (!item.emojiPos) item.emojiPos = EMOJI_TARGET.clone();
    else item.emojiPos.lerp(EMOJI_TARGET, snap ? 1 : 0.1);
    const lagX = EMOJI_TARGET.x - item.emojiPos.x;
    item.emojiMesh.position.set(item.emojiPos.x, item.emojiPos.y + emoji.dy, 0);
    item.emojiMesh.scale.setScalar(emoji.scale);
    item.emojiMesh.rotation.z = emoji.rot - lagX * 6;
    item.emojiMesh.material.opacity = emoji.opacity;
  } else if (item.emojiMesh) {
    disposeGroup(item.emojiMesh);
    item.emojiRoot.remove(item.emojiMesh);
    item.emojiMesh = null;
    item.emojiKind = null;
    item.emojiPos = null;
  }
}
