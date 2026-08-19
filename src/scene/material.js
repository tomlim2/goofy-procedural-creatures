// Material and mesh utilities. Docs: guidelines/drawing.md § colors go in as linear, guidelines/rig.md, guidelines/performance.md

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
      if (!node.material.userData.shared) node.material.dispose();
    }
  });
}
