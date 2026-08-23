// State → rig. Applies the state object the clock produced to the three.js groups every frame.
// This knows nothing about actions — the arms only ease toward the joint angles the clock gave (state.arms).
// Docs: guidelines/motion/catalog.md § the state object, guidelines/rig.md

import * as THREE from "three";
import { buildEmoji } from "./emoji.js";
import { disposeGroup } from "./mesh.js";
import { BOIL_FRAMES } from "./rig.js";
import { damp } from "../motion/ease.js";

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

  // Tail — a four-bone chain. Root angle (tailAngle) + the tip bone's relative angle (tailTip) + raise (tailRaise: each joint blends from its rest pose toward a target pose) + bristle (tailPuff)
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
    // A share is taken **the short way round** (wrapped to ±180°) and **capped per joint** (100° at the root, 90° along the tail), the rest cascading to the next joint: a hook's tip sat at −131°
    // and the arch asked it for −20° — a 171° twist at one joint, which folded the skin onto itself (the black knob at the tip). A curled skeleton stays
    // curled under the arch and the raise, which is what a real tail does: it cannot hinge through half a turn at one joint
    const UP = Math.PI * 0.5;
    // The cap per joint: the root may swing 100° (a tail lifts from flat to up at its base), the joints along it 90°. At 60° the pose was out of reach for
    // most skeletons — a curl, a longtail, a flag and a kink all ran out of joint before the arch and stood in a half-arch, hinged rather than curved
    const capOf = (i) => (i === 0 ? Math.PI * 0.556 : Math.PI / 2);
    const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
    // A joint's share: the short way round, capped — and **dropped to nothing** when even the capped turn would leave the joint still bent
    // *against* the pose. A hook's tip is drawn folded 113° toward the head and the arch asks it to fold 46° the other way; capped it lands at +23°,
    // which is neither the hook nor the arch — the S the tail used to draw. Dropped, the tail arches on the joints that can reach and keeps the hook it
    // was drawn with at the end: a question mark. It only ever fires on a joint the cap already stopped, so a skeleton that can reach the pose is untouched
    const share = (want, cum, i, bend = null) => {
      const capped = Math.max(-capOf(i), Math.min(capOf(i), wrap(want - cum)));
      if (!bend || capped === wrap(want - cum)) return capped;
      const [restBend, poseBend] = bend;   // how far this joint is bent as drawn, and how far the pose wants it bent
      return Math.abs(poseBend) > 0.1 && (restBend + capped) * poseBend < 0 ? 0 : capped;
    };
    // The bend at joint i — as drawn, and as the pose asks for it (the root has no joint before it, so it has no bend)
    const bendAt = (target, i) => (i === 0 ? null : [wrap(bones[i].restAngle - bones[i - 1].restAngle), wrap(target(i) - target(i - 1))]);
    const rp = state.tailRaisePose;   // the raise's target pose — joint world angles (a ♥'s question mark), or null: every joint vertical
    const arch = state.tailArch || 0;
    const pose = state.tailPose;
    const upAt = (i) => (rp ? rp[Math.min(i, rp.length - 1)] : UP);
    const archAt = (i) => pose[Math.min(i, pose.length - 1)];
    let cumUp = 0, cumArch = 0;   // the cumulative target rotation so far (relative to rest)
    // Forward kinematics — the bones are siblings under the pivot: a bone's position is the end of the bone before it (the rest offset turned by the
    // joint rotations so far), its rotation the rest angle plus those rotations — the same pose the nested chain would give, without a chain
    let cum = 0;
    let px = 0, py = 0;
    for (let i = 0; i < n; i += 1) {
      const b = bones[i];
      const wantUp = upAt(i) - b.restAngle;   // the rotation this bone needs to reach its raise target
      const sUp = share(wantUp, cumUp, i, bendAt(upAt, i));   // this joint's share, with the rotation up to its parent taken off — short way round, capped
      let rot = sUp * raise;
      cumUp += sUp;
      if (arch > 0 && pose) {
        const sArch = share(archAt(i) - b.restAngle, cumArch, i, bendAt(archAt, i));
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
    limb.pivot.rotation.z = limb.angle + osc;
    if (limb.elbow) limb.elbow.rotation.z = limb.elbowAngle + oscElbow;
  }

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
