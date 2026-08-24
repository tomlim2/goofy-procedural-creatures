// Meshes and the shared GPU materials (MeshBasicMaterial — not the goofy materials — medium/materials.js GOOFY_MATERIALS). Docs: guidelines/drawing.md § colors go in as linear, guidelines/rig.md, guidelines/performance.md

import * as THREE from "three";
import { buildGeometry } from "../stroke.js";
// Ink materials are made **one per opacity level** and shared by every mesh. If 35 individuals × dozens of meshes each held their own material,
// the renderer would swap materials per mesh (updating uniforms) and bake new ones on every regen — sharing lets it skip while the same material runs on.
// Nobody disposes a shared material (disposeGroup skips them) and nobody changes their opacity per frame — those meshes use ownInkMaterial.
const shared = new Map();
export function inkMaterial(opacity) {
  let material = shared.get(opacity);
  if (!material) {
    material = makeInkMaterial(opacity);
    material.userData.shared = true;
    shared.set(opacity, material);
  }
  return material;
}

// A material used alone — for meshes that change opacity every frame (emoji). Touching a shared material's opacity changes every mesh using that value
export function ownInkMaterial(opacity) {
  return makeInkMaterial(opacity);
}

function makeInkMaterial(opacity) {
  return new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity,
    depthTest: false,
    depthWrite: false,
    // This is a 2D drawing, so back-face culling is unnecessary. Leave it on and the fan triangles of
    // clockwise-wound paths (box bodies and the like) get culled as back faces and the fill disappears.
    side: THREE.DoubleSide,
    // transparent + DoubleSide makes three.js draw back and front in two passes (draw calls ×2, material needsUpdate every time). That is for 3D translucent objects
    // needing front-to-back ordering, and means nothing for 2D ribbons with no depthTest — draw once.
    forceSinglePass: true
  });
}

// Boil variants → one mesh. variants is a list (one per boil frame) of sketch lists; every variant's triangles go into **one geometry**, one after
// another, and the frame is chosen by the geometry's drawRange (animate: item.boilRanges) — so a part boils without one mesh per frame
// (the tail's bones and the limbs: a draw call each, not three). Returns the mesh and the [start, count] vertex range of each frame
// skin: { weightsAt, weightsOf } makes it a SkinnedMesh — the tail: every vertex weighted to **up to four** bones by its skin tag (weightsAt(t)) or
// its position (weightsOf(x, y)) → [bone, weight] × 4, adding up to 1; the caller binds the skeleton
export function sketchMeshBoil(variants, opacity, renderOrder, dy = 0, { skin = null } = {}) {
  const ranges = [];
  let start = 0;
  const all = [];
  for (const sketches of variants) {
    const list = sketches.filter((s) => !s.empty);
    const count = list.reduce((n, s) => n + s.positions.length / 3, 0);
    ranges.push([start, count]);
    start += count;
    all.push(...list);
  }
  const mesh = skin ? skinnedMesh(all, opacity, renderOrder, skin) : sketchMesh(all, opacity, renderOrder, dy);
  mesh.geometry.setDrawRange(ranges[0][0], ranges[0][1]);
  return { mesh, ranges };
}

// A skinned mesh — the geometry is in the bones' parent space, every vertex weighted to up to four bones, and the bones bend it on the GPU. A vertex's
// bones come from its **skin tag** (stroke.js tags — the t along the spine the triangle was drawn at, skin.weightsAt(t)); an untagged vertex
// falls back to its position (skin.weightsOf(x, y) — a projection, wrong beside a tight curl, so the tail tags everything it draws).
// The shared ink material serves it as it is (three.js compiles a skinning variant of the same material — no new material object)
function skinnedMesh(sketches, opacity, renderOrder, skin) {
  const filled = sketches.filter((s) => !s.empty);
  const geometry = buildGeometry(filled);
  const tags = [];
  for (const s of filled) tags.push(...s.tags);
  const pos = geometry.attributes.position;
  const n = pos.count;
  const index = new Uint16Array(n * 4), weight = new Float32Array(n * 4);
  for (let v = 0; v < n; v += 1) {
    const t = tags[v];
    const w = Number.isNaN(t) || t === undefined ? skin.weightsOf(pos.getX(v), pos.getY(v)) : skin.weightsAt(t);   // [bone, weight] × 4
    for (let s = 0; s < 4; s += 1) { index[v * 4 + s] = w[s * 2] || 0; weight[v * 4 + s] = w[s * 2 + 1] || 0; }
  }
  geometry.setAttribute("skinIndex", new THREE.BufferAttribute(index, 4));
  geometry.setAttribute("skinWeight", new THREE.BufferAttribute(weight, 4));
  const mesh = new THREE.SkinnedMesh(geometry, inkMaterial(opacity));
  mesh.renderOrder = renderOrder;
  return mesh;
}

// Sketch(es) → mesh. Given several, they are joined into one geometry — earlier ones end up underneath (fills → ink). Used to bake a layer's fills and ink into one mesh.
// Lowers the geometry by dy up front. Used to line up the rotation axis (the group origin). own means the material is not shared.
export function sketchMesh(sketches, opacity, renderOrder, dy = 0, { own = false } = {}) {
  const geometry = buildGeometry(Array.isArray(sketches) ? sketches : [sketches]);
  if (dy) geometry.translate(0, dy, 0);
  const mesh = new THREE.Mesh(geometry, own ? ownInkMaterial(opacity) : inkMaterial(opacity));
  mesh.renderOrder = renderOrder;
  return mesh;
}

// Throws the geometry away. The material only if it is not shared (emoji) — disposing a shared material makes other meshes recompile on the next frame
export function disposeGroup(root) {
  root.traverse((node) => {
    if (node.isMesh) {
      node.geometry.dispose();
      if (node.isSkinnedMesh && node.skeleton) node.skeleton.dispose();   // the bone texture
      if (!node.material.userData.shared) node.material.dispose();
    }
  });
}
