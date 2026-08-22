// Assembling an individual's rig. Hierarchy, origins and renderOrder are in guidelines/rig.md; mesh and material counts in guidelines/performance.md.

import * as THREE from "three";
import { paintPart } from "../character/draw/body.js";
import { drawCreature, facePartKinds, facePartSketch, limbSketches, motionRig, tailSketch, layout, eyeGeometry, eyeShape, patched, starPath, heartPath, angryEyeSketch, STATIC_EYE_KEYS } from "../character/index.js";
import { Sketch } from "../stroke.js";
import { blobPath, arcPath } from "../shape.js";
import { makeClock, bindArm } from "../motion/index.js";
import { sketchMesh } from "./mesh.js";

export const BOIL_FRAMES = 3;

// The fake 3D depth (z) — how many times the features' shift a layer moves on a face turn. 1 = the features (the front of the face), 0 = the head outline (the skull axis, no shift), negative = behind (the other way).
// Set as **one number** per layer — how far forward or back it is *is* the shift. Layers meaning the same thing sharing a value is just a tag (the two ears; front hair and the scalp),
// and they are never grouped together by meaning: bangs (in front of the face) and back hair (behind the head) are both hair, yet their depths differ and they shift differently.
// scene/animate.js sets position = depth × the features' shift per layer (the same multiplier on x and y). Size does not change. Docs: guidelines/rig.md § fake 3D depth
export const DEPTH = {
  face: 1,          // the features (faceGroup)
  hat: 0.45,        // hat — above the head, toward the front
  horns: 0.45,      // horns
  hairFront: 0.12,  // bangs — over the forehead (in front of the face) but attached to the head, so only a little
  hairCrown: 0.12,  // hair on the scalp — the cap and spikes continuous with the bangs
  hairBack: -0.12,  // back hair — **behind** the head, so the other way, by as much as the bangs
  ears: -0.4,       // ears (side ears, dog/cat ears) — beside and behind the head; as the head turns they swing out to the far side from the face
  head: 0           // the outline (headGroup directly)
};

// Two sets of closed eyes — the shut line (shut: an arc bulging downward) and the ^^ smile arch (smile: bulging upward). Live eyes (the rig) and static eyes (staticLids) use the same shapes —
// only the shut line differs slightly (a little higher and tidier on static eyes). In face ink (faceInk) — on an ink-black imp head, a black arch would be lost and invisible
const LID_STYLE = {
  rig: { shutY: 0.1, shutWobble: 0.5, shutWidth: 0.012 },
  static: { shutY: 0.15, shutWobble: 0.4, shutWidth: 0.011 }
};
function lidSketches(eye, ink, noise, style, spec) {
  const s = LID_STYLE[style];
  const shut = new Sketch(noise, s.shutWobble);
  shut.stroke(arcPath(0, eye.r * s.shutY, eye.r * 0.85, eye.r * 0.55, Math.PI * 1.1, Math.PI * 1.9, 10), { color: ink, width: s.shutWidth });
  const smile = new Sketch(noise, 0.5);
  smile.stroke(arcPath(0, -eye.r * 0.12, eye.r * 0.92, eye.r * 0.72, Math.PI * 0.12, Math.PI * 0.88, 10), { color: ink, width: 0.013 });
  // Anger — the fierce eye (an inward-down slanted lid plus a glaring dot). While angry, the open eye is switched off and this stands instead (character/draw/face.js angryEyeSketch)
  const angry = new Sketch(noise, 0.5);
  angryEyeSketch(angry, eye, ink, spec);
  return { shut, smile, angry };
}

export function buildCreature(spec, noise, birth = 0) {
  const group = new THREE.Group();
  const bodyGroup = new THREE.Group();
  const headGroup = new THREE.Group();
  const faceGroup = new THREE.Group();    // the features — the shift and squash of a face turn (depth 1)
  group.add(bodyGroup);
  group.add(headGroup);
  headGroup.add(faceGroup);
  // Layers attached to the head (ears, horns, hair, hat) each get their own group — they shift by their depth (DEPTH). A group moves by depth, not by meaning (animate: item.parallax)
  const parallax = [];
  const depthGroup = (depth) => {
    const g = new THREE.Group();
    headGroup.add(g);
    parallax.push({ group: g, depth });
    return g;
  };

  // Boil — 3 sets differing only in jitter phase. Each layer toggles its three frames (groups) at the same index (animate cycles frames).
  // One layer = one mesh: the fills sketch and the ink sketch are joined into one geometry (fills below, ink above — half the draw calls). Every fill is **opaque** —
  // when neighbours overlap, the individual in front has to hide the one behind completely, outline, color and shape.
  // The exceptions are the face and the static eyes (staticEyeBack/Front — one layer per eye): their fills (2.3) and ink (2.4) are kept apart — a static eye's fill (pupil, white) has to sit
  // **below** the face ink (whiskers) while its ink sits above, so the two layers' fills and ink interleave.
  // Static eyes being one layer per eye is because of the wink — turning one eye into an arch means switching off that eye's layer alone (animate).
  // Render order (guidelines/rig.md is the single source): body 1.5 → back hair 1.55 → side ears 1.7 → head 2 (the fill covers the body ink) → horns 2.06 → hair on the scalp 2.06 →
  // dog/cat ears 2.12 → face and static eyes 2.3/2.4 → frontmost face (nose, eyewear) 6.5 → bangs 6.55 → hat 6.58
  const firstDrawn = drawCreature(spec, 0);
  const mrig = motionRig(spec);
  const neckY = firstDrawn.neckY;
  const faceCy = firstDrawn.faceCy;
  // Head layers take depth instead of group — a depth group is made per layer below (the body is bodyGroup, the outline headGroup, the features faceGroup)
  const LAYERS = [
    { key: "body", group: bodyGroup, dy: 0, order: 1.5 },
    { key: "hairBack", depth: DEPTH.hairBack, dy: -neckY, order: 1.55 },     // back hair — behind the head and ears, above the body
    { key: "crownBack", depth: DEPTH.ears, dy: -neckY, order: 1.7 },         // side ears — behind the head fill
    { key: "head", group: headGroup, dy: -neckY, order: 2 },
    { key: "horns", depth: DEPTH.horns, dy: -neckY, order: 2.06 },           // horns — above the head ink
    { key: "hairCrown", depth: DEPTH.hairCrown, dy: -neckY, order: 2.06 },   // hair on the scalp — the same depth as the horns, above them
    { key: "front", depth: DEPTH.ears, dy: -neckY, order: 2.12 },            // in front of the head: dog and cat ears
    { key: "hat", depth: DEPTH.hat, dy: -neckY, order: 6.58 },               // hat — above the bangs (6.55): a hat sits on the hair, never under it; below the brows (6.6)
    { key: "face", group: faceGroup, dy: -faceCy, fillOrder: 2.3, order: 2.4 },        // fills and ink kept apart (see above)
    // Static eyes — one layer per eye (the smaller eye Back → the larger Front; overlapping, the larger is in front). For sleep, ^^, a wink (that side) and startle variants, that eye's layer is switched off
    ...STATIC_EYE_KEYS.map((key) => ({ key, group: faceGroup, dy: -faceCy, fillOrder: 2.3, order: 2.4 })),
    { key: "faceFront", group: faceGroup, dy: -faceCy, order: 6.5 },   // nose and eyewear — above the eye rig (3~). A startled white or a lid cannot cover them
    { key: "hairFront", depth: DEPTH.hairFront, dy: -neckY, order: 6.55 }    // bangs — above the nose and eyewear, below the brows and mouth (6.6)
  ];
  for (const layer of LAYERS) if (layer.group === undefined) layer.group = depthGroup(layer.depth);
  const frames = {};
  for (const layer of LAYERS) frames[layer.key] = [];
  for (let k = 0; k < BOIL_FRAMES; k += 1) {
    const drawn = k === 0 ? firstDrawn : drawCreature(spec, k);
    for (const layer of LAYERS) {
      const pair = drawn[layer.key];
      const frame = new THREE.Group();
      if (layer.fillOrder !== undefined) {
        if (!pair.fills.empty) frame.add(sketchMesh(pair.fills, 1, layer.fillOrder, layer.dy));
        if (!pair.ink.empty) frame.add(sketchMesh(pair.ink, 1, layer.order, layer.dy));
      } else if (!pair.fills.empty || !pair.ink.empty) {
        frame.add(sketchMesh([pair.fills, pair.ink], 1, layer.order, layer.dy));
      }
      frame.visible = k === 0;
      layer.group.add(frame);
      frames[layer.key].push(frame);
    }
  }
  headGroup.position.y = neckY;
  // The face group's origin = the centre of the head. A turn shifts and squashes about this point. Children are baked pre-lowered by -faceCy.
  faceGroup.position.y = faceCy - neckY;

  // Tail — a four-bone chain (limbs.js TAIL_BONES). Bone groups nest joint by joint inside tailGroup (the root pivot): bone[i] is a child of bone[i-1],
  // with its origin at the joint (on the rest-pose spine). **Behind** the torso and head (0.8) — the part lying over the body (a loop or curl) is hidden.
  // animate: tailAngle on bone[0] (swish, wag, walking, sleep), tailTip on the tip bone (tapping, tremble, follow-through), and raise (tailRaise) blends each joint's target angle from rest toward straight.
  // Bristle (tailPuff) is **thickness only** — each bone's mesh is wrapped in three groups, R(θ)·S(1,p)·R(−θ) (along, thick, back), scaling only perpendicular to the rest-pose spine direction (θ).
  // The joint's (g) rotation and its child bones sit outside that, so length and position are unchanged
  let tailGroup = null;
  const tailBones = [];
  const tail = tailSketch(spec);
  if (tail.sketches.some((s) => !s.empty)) {
    tailGroup = new THREE.Group();
    tailGroup.position.set(tail.pivot[0], tail.pivot[1], 0);
    let parent = tailGroup;
    let prev = [0, 0];
    tail.bones.forEach((bone, i) => {
      const g = new THREE.Group();
      g.position.set(bone.origin[0] - prev[0], bone.origin[1] - prev[1], 0);
      let thick = null;
      if (!tail.sketches[i].empty) {
        const along = new THREE.Group();
        along.rotation.z = bone.angle;
        thick = new THREE.Group();
        const back = new THREE.Group();
        back.rotation.z = -bone.angle;
        back.add(sketchMesh(tail.sketches[i], 1, 0.8));
        thick.add(back);
        along.add(thick);
        g.add(along);
      }
      parent.add(g);
      tailBones.push({ group: g, restAngle: bone.angle, thick });
      parent = g;
      prev = bone.origin;
    });
    bodyGroup.add(tailGroup);
  }

  // Limbs — joint pivot groups. Swung with rotation.z.
  // An arm has two meshes, front (above the body ink, 2.5) and back (behind the body, 0.5), and switches
  // between them by pose. The sleeve and hand have to cover the body outline for the joint to look embedded in the body.
  // An arm has two joints: pivot (shoulder) ─ front (upper arm) ─ elbow (the elbow pivot) ─ lower (forearm).
  // The shoulder angle and elbow angle have to be given separately for the arm to fold.
  const limbs = limbSketches(spec).map((limb) => {
    const pivot = new THREE.Group();
    pivot.position.set(limb.pivot[0], limb.pivot[1], 0);
    const front = new THREE.Group();
    front.add(sketchMesh(limb.sketch, 1, 2.5));
    pivot.add(front);

    let elbow = null;
    if (limb.lowerSketch) {
      elbow = new THREE.Group();
      elbow.position.set(limb.elbow[0], limb.elbow[1], 0);
      elbow.add(sketchMesh(limb.lowerSketch, 1, 2.5));
      front.add(elbow);
    }

    let back = null;
    if (limb.backSketch) {
      back = sketchMesh(limb.backSketch, 1, 0.5);
      back.visible = false;
      pivot.add(back);
    }
    bodyGroup.add(pivot);

    // Stood up in the bind pose (T). Actions come from the clock.
    const bind = limb.kind === "arm" ? bindArm(limb.side) : { shoulder: 0, elbow: 0 };
    pivot.rotation.z = bind.shoulder;
    if (elbow) elbow.rotation.z = bind.elbow;
    return {
      pivot, front, elbow, back,
      kind: limb.kind, side: limb.side, index: limb.index ?? 0,
      angle: bind.shoulder, elbowAngle: bind.elbow
    };
  });

  // The brow and mouth state sets (brow rest/alt/angry / mouth rest/alt/angry/^^ — faceStates.js) — inside faceGroup, so they follow the face turn.
  // One mesh per set; when the same kind appears in two sets they share a mesh (animate picks one mesh to turn on and turns the rest off)
  const kinds = facePartKinds(spec);
  const faceStates = {};
  for (const part of ["brow", "mouth"]) {
    const byKind = new Map();
    faceStates[part] = kinds[part].map((kind, index) => {
      if (!byKind.has(kind)) {
        // Brows and the mouth are above the eye rig (3~6), at 6.6 — so a closed lid does not erase the brows and a startle-widened cyclops white does not erase the mouth
        const mesh = sketchMesh(facePartSketch(spec, part, kind), 1, 6.6, -faceCy);
        mesh.visible = index === 0;
        faceGroup.add(mesh);
        byKind.set(kind, mesh);
      }
      return byKind.get(kind);
    });
  }

  const faceInk = spec.faceInk || spec.palette.ink;
  // The eye rig — the white plus rim (one mesh), the pupil, the smile and the shut line grouped together. Kinds: ring/wide/cyclops (a round white) · oval (a tall elliptical white)
  const eyeRigs = [];
  const shape = eyeShape(spec);
  // An order block per eye — the larger eye in front. When two eyes overlap, the front eye's white covers the back eye's rim and pupil (so no crossing line appears).
  // Back eye 3.0~3.35, front eye 3.5~3.85 (white and rim / pupil / ^^ and shut line). A static eye's shut line (3.6) only exists on static eyes, so there is no collision
  const eyeOrder = [...firstDrawn.eyes].sort((a, b) => a.r - b.r);
  for (const eye of firstDrawn.eyes) {
    const rig = new THREE.Group();
    rig.position.set(eye.x, eye.y - faceCy, 0);
    const rx = eye.r * shape.sx, ry = eye.r * shape.sy;
    const o = 3 + eyeOrder.indexOf(eye) * 0.5;   // where this eye's block starts

    // The open eye (white, rim, pupil) is the open group — closing **switches it off rather than covering it**. In its place either the shut line or the ^^ glyph stands
    const open = new THREE.Group();
    // Not a perfect circle but a slightly crumpled hand-drawn one — given noise (a different phase per eye). The white and rim are one mesh (fill below, rim above)
    const wob = { lumps: 3, amount: 0.06, noise, phase: eye.side * 3.7 + spec.seed * 0.001 };
    const white = new Sketch(noise, 0.4);
    paintPart(white, spec, blobPath(0, 0, rx, ry, wob), "#f6f2e9", { flat: true });
    const rim = new Sketch(noise, 0.6);
    rim.contour(blobPath(0, 0, rx, ry, { ...wob, lumps: 4, amount: 0.07 }), "RIBBON", { color: spec.palette.ink, closed: true });
    open.add(sketchMesh([white, rim], 1, o));

    const pupilSketch = new Sketch(noise, 0.4);
    paintPart(pupilSketch, spec, blobPath(0, 0, eye.r * 0.44, eye.r * 0.44, { lumps: 3, amount: 0.12, noise: null }), spec.palette.ink, { own: true });
    const pupil = sketchMesh(pupilSketch, 0.95, o + 0.2);
    open.add(pupil);
    rig.add(open);

    // ^^ (smile) — happily closed eyes · the shut line (shut) — when the lid is all the way down (the peak of a blink, sleep). The open eye is switched off and this arch stands instead — so a closed eye does not become a blank face
    const lids = lidSketches(eye, faceInk, noise, "rig", spec);
    const smile = sketchMesh(lids.smile, 1, o + 0.35);
    smile.visible = false;
    rig.add(smile);
    const shut = sketchMesh(lids.shut, 1, o + 0.35);
    shut.visible = false;
    rig.add(shut);
    const angry = sketchMesh(lids.angry, 1, o + 0.35);
    angry.visible = false;
    rig.add(angry);

    faceGroup.add(rig);
    // gazeScale: how far the pupil travels with the gaze (× the eye radius). On a bead eye the pupil *is* the eye, so only a little
    eyeRigs.push({ rig, open, pupil, smile, shut, angry, eye, gazeScale: 0.34 });
  }

  // Every eye not hidden by a patch (static eyes included) — bakes the static eyes' closed-eye and startle-variant glyphs where the eye is
  const allEyes = eyeGeometry(spec, layout(spec)).filter((eye) => !patched(spec, eye));

  // The closed eye of a static eye (dot, sleepy, cross, spiral, slit, half…) — sleep (the shut line), ^^ and a wink (the smile arch). There is no cover: **that eye's** static
  // layer (frames) is switched off (animate) and the arch stands instead — layers being per eye, only the winking side changes and the other eye stays. It pairs with a live eye's open/shut/smile
  const staticLids = [];
  for (const { key, eye } of firstDrawn.staticEyes) {
    const lids = lidSketches(eye, faceInk, noise, "static", spec);
    const shut = sketchMesh(lids.shut, 1, 3.6);
    const smile = sketchMesh(lids.smile, 1, 3.6);
    const angry = sketchMesh(lids.angry, 1, 3.6);
    for (const m of [shut, smile, angry]) {
      m.position.set(eye.x, eye.y - faceCy, 0);
      m.visible = false;
      faceGroup.add(m);
    }
    staticLids.push({ shut, smile, angry, eye, frames: frames[key] });
  }

  // Startle eye variants — ☆_☆ / ♥_♥. Not a cover: meanwhile the eyes (the static eye frame and the eye rig) are **switched off** and only the glyph is drawn in their place (6.32 — below the nose and eyewear).
  // Visible only when the startle is the star or heart variant (animate: state.eyeFx). Both are baked per eye and only the matching kind is turned on
  const eyeFx = [];
  for (const eye of allEyes) {
    const starSketch = new Sketch(noise, 0.5);
    const star = starPath(0, 0, eye.r * 1.1);
    paintPart(starSketch, spec, star, "#f6f2e9", { flat: true });
    starSketch.contour(star, "RIBBON", { color: spec.palette.ink, closed: true, step: 0.006 });
    const heartSketch = new Sketch(noise, 0.5);
    const heart = heartPath(0, 0, eye.r * 1.0, eye.r * 0.85);
    paintPart(heartSketch, spec, heart, "#c9666a", { own: true });
    heartSketch.contour(heart, "RIBBON", { color: spec.palette.ink, closed: true, step: 0.006 });
    const starMesh = sketchMesh(starSketch, 1, 6.32);
    const heartMesh = sketchMesh(heartSketch, 1, 6.32);
    for (const m of [starMesh, heartMesh]) {
      m.position.set(eye.x, eye.y - faceCy, 0);
      m.visible = false;
      faceGroup.add(m);
    }
    eyeFx.push({ star: starMesh, heart: heartMesh, eye });
  }

  return {
    group,
    eyeFx,
    bodyGroup,
    headGroup,
    faceGroup,
    parallax,   // [{ group, depth }] — the layers attached to the head. animate shifts them by depth × the features' shift
    tailGroup,
    tailBones,
    limbs,
    frames,
    eyeRigs,
    staticLids,
    faceStates,
    // The clock takes a rig description — it solves actions (hand targets) onto this individual's shoulders, arm lengths and body anchors by IK, and solves a quad sit against the torso and leg-root dimensions
    clock: makeClock(spec.seed, birth, spec.species, mrig),
    // The body group's rotation axis — in a quad sit (state.bodyTilt) the body tilts about the front legs' root (animate). null on a biped
    bodyPivot: mrig.body ? [mrig.body.frontHipX, mrig.body.hipY] : null,
    spec,
    neckY,
    faceCy,
    headRx: firstDrawn.box.headRx,
    headRy: firstDrawn.box.headRy,
    headTop: firstDrawn.headTop,
    // The boil period. Slightly different per individual (about 0.53~0.67 fps — once every 1.5~1.9 s). Faster and the drawing looks like it is trembling
    boilFps: (8 + (spec.seed % 5) * 0.5) / 15,
    boilOffset: spec.seed % BOIL_FRAMES,
    baseX: 0,
    baseY: 0,
    generation: 0,
    // The emoji is not attached to the head — it lives at the scene root's emojiRoot and eases toward the point above the head (the dragged feeling)
    emojiRoot: new THREE.Group(),
    emojiMesh: null,
    emojiKind: null,
    emojiPos: null
  };
}
