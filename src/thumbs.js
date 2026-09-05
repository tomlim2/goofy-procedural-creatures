// Part thumbnails — the editor's part tabs and form previews, the way the material panel shows shader balls: a
// small canvas painted by the board's own drawing. Each thumbnail is the **real creature** built with that spec,
// stood in the bind pose, **with everything but the part hidden**, and framed by an orthographic camera on the
// region the part lives in — the head for the head and what sits on it, the face for the features, the torso for
// the body, the legs, the tail. The rig already knows where every part goes and what it is made of; hiding the
// rest by node (the layer groups, the eye rigs, the brow and mouth meshes, the limb pivots, the tail group) leaves
// the part where it would sit, alone. One hidden WebGL renderer paints every canvas — one context, many views
// (balls.js does the same).
//
// `paintParts(views, spec)` builds the creature **once** and paints every view off it — the tabs are 24 crops of
// one build. A form preview is a different spec each, so it is one build per value; the editor queues those a
// frame at a time so a slot with 26 values does not stall the deck. What the editor hands in is a **reference
// individual** of the species, not the creature being edited: the pictures are a legend, painted when the species
// changes or a part is opened, never on an edit.

import * as THREE from "three";
import { buildCreature } from "./scene/rig.js";
import { applyState } from "./scene/animate.js";
import { BIND_STATE } from "./motion/index.js";
import { layout } from "./character/index.js";
import { makeRng, makeNoise } from "./rng.js";

// A fixed hand: the thumbnails hold still between repaints, and the creature they crop is the one on the stage
const noise = makeNoise(makeRng(11));
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);

let renderer = null;
function gl() {
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  }
  return renderer;
}

// Which region a part is framed on. A slot not listed (a future one) gets the whole creature
export const FRAME_OF = {
  head: "head", hairFront: "head", hairBack: "head", headgear: "head", horns: "head", ears: "head",
  eyes: "face", brow: "face", browLength: "face", eyewear: "face", nose: "face", face2: "face", mouth: "face", mouthPos: "face", mouthSize: "face",
  body: "body", pattern: "body", build: "body",
  arms: "arms", armLength: "arms",
  legs: "legs", legLength: "legs",
  tail: "tail", tailSkin: "tail", tailLength: "tail", tailDeco: "tail"
};

// The square frame (centre, half-size) for a part on this spec, off the layout's boxes — the same numbers the
// drawing places the parts by, so a frame follows the individual's proportions
export function frameOf(spec, part) {
  const b = layout(spec);
  switch (FRAME_OF[part]) {
    case "head": return { cx: 0, cy: b.headCy + b.headRy * 0.12, half: Math.max(b.headRx, b.headRy) * 1.5 };
    case "face": return { cx: 0, cy: b.headCy + b.headRy * 0.02, half: b.headRy * 0.85 };
    case "body": return { cx: b.bodyCx, cy: b.legTop + b.bodyH * 0.5, half: Math.max(b.bodyW * 1.5, b.bodyH * 0.9, 0.16) };
    case "arms": return { cx: 0, cy: b.legTop + b.bodyH * 0.6, half: Math.max(b.bodyW + 0.3, b.bodyH * 0.9) };
    case "legs": return { cx: b.bodyCx, cy: b.legTop * 0.5 + 0.02, half: Math.max(b.legTop * 0.7 + 0.08, b.bodyW * 1.3, 0.16) };
    case "tail": return { cx: b.quad ? b.bodyCx + b.bodyW * 1.2 : 0.3, cy: b.legTop + b.bodyH * 0.5, half: Math.max(0.26, b.bodyH) };
    default: return { cx: 0, cy: 0.58, half: 0.64 };
  }
}

// What a part is made of, by node. Layer keys are the rig's frames (scene/rig.js LAYERS); the rest are the rig's
// own groups. The nose and eyewear share the faceFront layer, so the editor's reference keeps its nose at none
// when eyewear is drawn and sets each nose when the nose is
const NODES_OF = {
  head: { layers: ["head"] },
  ears: { layers: ["crownBack", "front"] },
  horns: { layers: ["horns"] },
  hair: { layers: ["hairBack", "hairCrown", "hairFront"] },
  headgear: { layers: ["hat"] },
  eyes: { layers: ["staticEyeBack", "staticEyeFront"], eyes: true },
  brow: { face: "brow" },
  eyewear: { layers: ["faceFront"] },
  nose: { layers: ["faceFront"] },
  face2: { layers: ["face"] },
  mouth: { face: "mouth" }, mouthPos: { face: "mouth" }, mouthSize: { face: "mouth" },
  body: { layers: ["body"] }, pattern: { layers: ["body"] }, build: { layers: ["body"] },
  arms: { limbs: "arm" }, armLength: { limbs: "arm" },
  legs: { limbs: "leg" }, legLength: { limbs: "leg" },
  tail: { tail: true }, tailSkin: { tail: true }, tailLength: { tail: true }, tailDeco: { tail: true }
};

// The world bounds of what is visible — the part alone, once isolated. null when nothing is drawn (a value of none)
const box = new THREE.Box3();
function visibleBounds(root) {
  root.updateMatrixWorld(true);
  box.makeEmpty();
  root.traverseVisible((o) => { if (o.isMesh && o.geometry) box.expandByObject(o); });
  return box.isEmpty() ? null : box;
}

// Shows the part's nodes and nothing else. A part not listed shows the whole creature
function isolate(item, part) {
  const want = NODES_OF[part];
  if (!want) return;
  for (const key of Object.keys(item.frames)) for (const frame of item.frames[key]) frame.visible = false;
  for (const key of want.layers || []) if (item.frames[key] && item.frames[key][0]) item.frames[key][0].visible = true;
  for (const limb of item.limbs) limb.pivot.visible = want.limbs === limb.kind;
  if (item.tailGroup) item.tailGroup.visible = !!want.tail;
  for (const e of item.eyeRigs) e.rig.visible = !!want.eyes;
  for (const face of ["brow", "mouth"]) for (const mesh of item.faceStates[face] || []) mesh.visible = want.face === face && mesh === item.faceStates[face][0];
  for (const fx of item.eyeFx) { fx.star.visible = false; fx.heart.visible = false; }
  for (const lid of item.staticLids) { lid.shut.visible = false; lid.smile.visible = false; lid.angry.visible = false; }
}

// Builds `spec` once and paints every view off it. views: [{ canvas, part, size }] — size in CSS pixels, square
export function paintParts(views, spec) {
  const r = gl();
  const dpr = r.getPixelRatio();
  const item = buildCreature(spec, noise, 0);
  // The scene's place() gives these before the first applyState; here the creature stands at the origin
  item.baseX = 0;
  item.baseY = 0;
  item.orderBase = 0;
  applyState(item, BIND_STATE, 0, noise, { snap: true, boil: false });
  scene.add(item.group);
  for (const v of views) {
    isolate(item, v.part);
    // Framed on the part's own bounds, square, with a margin — a brow fills its thumbnail instead of lying as a thin
    // line in a face-sized frame, and its line comes out heavier with it. The region frame is the fallback for a value
    // that draws nothing
    const b = visibleBounds(item.group);
    const { cx, cy, half } = b
      ? { cx: (b.min.x + b.max.x) / 2, cy: (b.min.y + b.max.y) / 2, half: Math.max(b.max.x - b.min.x, b.max.y - b.min.y, 0.05) * 0.58 }
      : frameOf(spec, v.part);
    camera.left = cx - half;
    camera.right = cx + half;
    camera.top = cy + half;
    camera.bottom = cy - half;
    camera.updateProjectionMatrix();
    v.canvas.style.width = `${v.size}px`;
    v.canvas.style.height = `${v.size}px`;
    v.canvas.width = Math.round(v.size * dpr);
    v.canvas.height = Math.round(v.size * dpr);
    r.setSize(v.size, v.size, false);
    r.render(scene, camera);
    const ctx = v.canvas.getContext("2d");
    ctx.clearRect(0, 0, v.canvas.width, v.canvas.height);
    ctx.drawImage(r.domElement, 0, 0, v.canvas.width, v.canvas.height);
  }
  scene.remove(item.group);
  item.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });   // the materials are shared per opacity (scene/mesh.js) and not ours to free
  if (item.emojiRoot) item.emojiRoot.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
}

export function paintPart(canvas, spec, part, size) {
  paintParts([{ canvas, part, size }], spec);
}
