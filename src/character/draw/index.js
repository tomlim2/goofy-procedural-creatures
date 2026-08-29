// Spec → strokes. Assembles the per-part drawing functions. What gets chosen is not decided here.
// Docs: guidelines/character/parts.md, guidelines/rig.md

import { Sketch } from "../../stroke.js";
import { makeNoise, makeRng } from "../../rng.js";
import { layout, eyeGeometry } from "./layout.js";
import { drawHead, drawEars, drawPupEars, drawCatEars } from "./head.js";
import { drawHair } from "./hair.js";
import { drawHeadgear, drawHorns } from "./headgear.js";
import { drawEyes, drawFace2, drawEyewear, drawNose, drawWhiskers, RIG_EYES, patched } from "./face.js";
import { drawBody } from "./body.js";

export { facePartKinds, facePartSketch } from "./faceStates.js";
export { limbSketches, motionRig, BIND_ARM, tailSketch } from "./limbs.js";

// Layer names — one sketch pair (ink, fills) each. scene/rig.js stands meshes up under the same names (render order is in guidelines/rig.md)
//   body · crownBack side ears · head the head outline · horns · hairBack back hair · hairCrown hair on the scalp · hairFront bangs · front dog/cat ears ·
//   hat · face cheeks and whiskers · staticEyeBack/staticEyeFront static eyes (one layer per eye) · faceFront nose, muzzle, eyewear
// Layers attached to the head (ears, horns, hair, hat) each get a **depth (DEPTH)** from scene/rig.js and shift by different amounts on a face turn — bangs go a little toward the face, back hair goes the other way because it is behind the head
// Static eyes are baked **per eye** — to turn one side into an arch for a wink, only that eye's layer can be switched off while the other stays (with both eyes in one mesh, the other eye vanishes too).
// The smaller eye is Back, the larger is Front — when they overlap the larger is in front (a hollow's white covers the smaller eye's rim, with no crossing line)
export const STATIC_EYE_KEYS = ["staticEyeBack", "staticEyeFront"];
export const HAIR_KEYS = ["hairBack", "hairCrown", "hairFront"];
export const LAYER_KEYS = ["body", "crownBack", "head", "horns", ...HAIR_KEYS, "front", "hat", "face", ...STATIC_EYE_KEYS, "faceFront"];

// Draws one spec and returns the geometry material.
// Body, head and face are baked separately — so the scene can roll and nod the head alone, and shift the face
// (the features) as a whole to fake turning the head. Head = outline, ears, horns, hair, hat; face = eyes, cheeks, nose,
// whiskers, muzzle, eyewear (brows and the mouth are separate meshes for state switching; live eyes are the eye rig).
// The things attached to the head shift slightly on a face turn while the outline stays put (parallax): side ears (crownBack) go **opposite** to the face,
// crown (horns, hair), hat and the dog's and cat's ears (front — they stand on the crown) go the same way as the face but less, and hairFront (bangs) barely at all. Static eyes are baked separately — for startle variants (☆_☆, ♥_♥)
// the eyes are **removed** and replaced by the glyph rather than covered, which needs the eyes alone to be switchable.
// variant is the boil frame number. Only the jitter phase differs; the composition is the same.
export function drawCreature(spec, variant = 0) {
  const rng = makeRng((spec.proportions.wobbleSeed ^ (variant * 0x9e3779b9)) >>> 0);
  const noise = makeNoise(rng);
  const wobble = spec.proportions.wobble;
  const L = {};
  // sketch.outline carries a ghost's broken stroke to every line this creature draws (character/spec.js)
  const mk = () => { const s = new Sketch(noise, wobble); s.outline = spec.outline; return s; };
  for (const key of LAYER_KEYS) L[key] = { ink: mk(), fills: mk() };
  const box = layout(spec);
  const eyes = eyeGeometry(spec, box);

  const body = drawBody(L.body.ink, L.body.fills, spec, box, noise);

  drawEars(L.crownBack.ink, L.crownBack.fills, spec, box);   // side ears — behind the head fill (their root is hidden by the head)
  const headPath = drawHead(L.head.ink, L.head.fills, spec, box, noise);
  // The layer in front of the head — dog ears and cat ears. The fill has to sit on top of the head ink or the outline shows through the ear
  drawPupEars(L.front.ink, L.front.fills, spec, box);
  drawCatEars(L.front.ink, L.front.fills, spec, box);
  drawHorns(L.horns.ink, L.horns.fills, spec, box, noise);
  // Hair on the scalp is drawn at the same depth as the horns (2.06) but in its own layer — only the stroke phase carries on from the horns (the same wobble as when horns and hair shared one sketch)
  L.hairCrown.ink.phase = L.horns.ink.phase;
  L.hairCrown.fills.phase = L.horns.fills.phase;
  // Static eyes — one layer each, smallest first (Back → Front), for eyes not hidden by a patch. Live eyes (RIG_EYES) are not drawn by drawEyes, so those layers come out empty
  const staticEyes = [...eyes].filter((e) => !patched(spec, e)).sort((a, b) => a.r - b.r)
    .map((eye, i) => ({ key: STATIC_EYE_KEYS[i], side: eye.side, eye }));
  staticEyes.forEach(({ key, eye }, i) => {
    if (i > 0) {   // The stroke phase carries on from the previous eye — the same wobble as when both eyes shared one sketch (the geometry is unchanged)
      const prev = L[staticEyes[i - 1].key];
      L[key].ink.phase = prev.ink.phase;
      L[key].fills.phase = prev.fills.phase;
    }
    drawEyes(L[key].ink, L[key].fills, spec, box, [eye]);
  });
  drawFace2(L.face.ink, L.face.fills, spec, box, eyes);
  // The nose and eyewear are **frontmost** on the face (above the eye rig) — so a startle-widened white or a closed lid cannot cover the nose or a rim into nothing
  drawNose(L.faceFront.ink, L.faceFront.fills, spec, box, eyes);
  // Brows and the mouth are not baked here. For state switching (rest, alt, angry, ^^) the scene stands separate meshes up with facePartSketch (faceStates.js).
  drawWhiskers(L.face.ink, spec, box);   // cat whiskers — being on the face layer, they draw over the outline and can poke outside
  drawEyewear(L.faceFront.ink, L.faceFront.fills, spec, box, eyes);
  // Three hair layers — back hair (behind the head) · on the scalp (same depth as the horns) · bangs (over the face). Each layer has its own depth and shifts separately on a face turn (rig.js DEPTH). See hair.js
  // The fills go along too — the filled family paints hair shapes with the goofy material; the fur kinds leave them empty (an empty sketch stands no mesh up)
  drawHair({
    back: L.hairBack.ink, crown: L.hairCrown.ink, front: L.hairFront.ink,
    backFills: L.hairBack.fills, crownFills: L.hairCrown.fills, frontFills: L.hairFront.fills
  }, spec, box, noise);
  drawHeadgear(L.hat.ink, L.hat.fills, spec, box);   // the hat layer is above the ears — it covers their roots

  // Only eyes whose pupil moves are passed along. A cyclops is alive too.
  const live = RIG_EYES.includes(spec.parts.eyes) ? eyes.filter((e) => !patched(spec, e)) : [];

  return {
    ...L,
    eyes: live,
    // Static eye layer ↔ eye — [{ key, side, eye }] smallest first. For a rig eye the layer is empty (rig.js uses this to stand shut eyes and startle variants up where the eye is)
    staticEyes: RIG_EYES.includes(spec.parts.eyes) ? [] : staticEyes,
    box,
    // The head's rotation axis. The top of the body (around the chin).
    neckY: box.bodyTop,
    // The face group's origin. The centre of the head — a turn squashes it about this point.
    faceCy: box.headCy,
    headTop: box.headCy + box.headRy,
    quad: box.quad
  };
}
