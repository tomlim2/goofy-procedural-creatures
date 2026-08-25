// Post — what is drawn **over** the finished board, after every creature and every emoji. One pass today: the paper
// laid on top. A pass here is a full-screen quad at a renderOrder above the board with no depth test, so it needs no
// render target: the frame stays a single render and the blending stays on the canvas.
//
// Docs: guidelines/drawing.md § the paper

import * as THREE from "three";
import { GRAIN, GRAIN_GLSL, PAPER_VERTEX } from "./paper.js";

const POST_ORDER = 200000;   // after the emoji (100000), so a pass here is the last thing drawn

// How hard the sheet is laid over the board. Weighted by the grain's own deviation (below), so this is not a fade:
// at 0 the board is bare, at 1 the speckle is at the sheet's full contrast. The ink keeps its black either way —
// what moves is the whole picture's contrast (the screen's standard deviation, 34 bare · 25 here · 21 at 1)
const GRAIN_OVER = 0.55;

// The grain laid **over** the board — the same sheet as the one behind it (paper.js), drawn again on top, so the
// creatures come out under the paper instead of on it.
//
// Why over the whole screen and not per mark: the tooth this replaces tagged every triangle with how deep the paper
// bit it, and the fills came out eaten (25ef748). A wash over the screen cannot eat a fill — it treats a filled head
// and a bare sheet alike, which is what a real sheet does
const GRAIN_OVER_FRAGMENT = /* glsl */ `
${GRAIN_GLSL}
uniform float amount;
varying vec2 vPaper;

void main() {
  float cell = grainCell(vPaper);
  vec3 sheet = sheetColor(vPaper, cell);
  // The alpha follows how far this cell is **off** the sheet's mean, not the sheet itself. At a flat alpha the whole
  // board fades toward the paper and the ink goes grey (43 → 70 of 255 at 0.15); weighted this way a cell darker than
  // the mean sinks what is under it and a lighter one lifts it, so the drawing keeps its black and takes the speckle
  gl_FragColor = vec4(sheet, amount * abs(cell - 0.5) * 2.0);
  #include <colorspace_fragment>
}`;

function grainOverMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { ...GRAIN, amount: { value: GRAIN_OVER } },
    vertexShader: PAPER_VERTEX,
    fragmentShader: GRAIN_OVER_FRAGMENT,
    transparent: true,
    depthTest: false,
    depthWrite: false
  });
}

// Puts every pass into the scene and hands back the one thing the scene has to keep telling them — the view's size.
// Called once, from the first build (scene/index.js)
export function attachPost(scene) {
  const passes = [grainOverMaterial()].map((material, i) => {
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
    quad.renderOrder = POST_ORDER + i;
    quad.position.z = 5;   // in front of the board; with no depth test it is the renderOrder that actually places it
    scene.add(quad);
    return quad;
  });
  return {
    // A pass covers the camera's view, so it is re-scaled with it on every layout
    layout(viewW, viewH) {
      for (const quad of passes) quad.scale.set(viewW, viewH, 1);
    }
  };
}
