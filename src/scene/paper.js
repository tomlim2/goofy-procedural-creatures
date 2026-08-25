// The paper — one plane behind the board and the board's only shader: a procedural GLSL fragment with no texture and no
// the grain the sheet shows. Docs: guidelines/drawing.md § the paper

import * as THREE from "three";
import { PAPER } from "../character/index.js";

// The paper's seed. Fixed — the paper is the desk, not the creature: NEW SEED changes the board, not the sheet
const SEED = 7;

// "#rrggbb" → sRGB [r, g, b] 0..1 — not hexToRgb: the grain does its arithmetic in sRGB, as the 2D canvas it replaced did, and
// converts at the end. The only place in the lab a color is handled in sRGB (drawing.md § colors go in as linear)
function srgb(hex) {
  const value = parseInt(hex.slice(1), 16);
  return new THREE.Vector3(((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255);
}

// The sheet's uniforms. grainScale is grain units per world unit, set on every layout from the 9×6 board's view
export const GRAIN = {
  paperTone: { value: srgb(PAPER) },
  paperBlotch: { value: srgb("#968468") },   // the tint the 2D canvas's discs had — rgba(150,132,104, 0.05)
  grainScale: { value: new THREE.Vector2(0, 0) },
  paperSeed: { value: SEED }
};

// Set on every layout from the 9×6 board's view (scene/index.js): the grain is pinned to that board whatever the grid, so a 1×1
// board does not blow the grain up into blotches
export function setGrainScale(x, y) {
  GRAIN.grainScale.value.set(x, y);
}

// The grain, in one place. The 2D-canvas tile this replaced (512 px for 3 grain units, bilinear, repeated) smeared on a big screen
// and showed its repeat as a diagonal weave. A fragment has no tile and no resolution: the grain is the same statistic at any size —
// a cell of 3/512 grain units, a uniform ±13/255 on each channel, as the canvas laid it — and the blotches are a low noise instead
// of 18 discs, so nothing repeats. Everything is a function of the **world** position, so the sheet and the marks drawn over it agree
export const GRAIN_GLSL = /* glsl */ `
uniform vec3 paperTone;      // the paper color, sRGB 0..1
uniform vec3 paperBlotch;    // the blotches' tint, sRGB 0..1
uniform vec2 grainScale;     // grain units per world unit — set on every layout from the 9×6 board's view
uniform float paperSeed;

// An integer hash (pcg2d) — the same grain on every GPU; sin-based hashes fall apart far from the origin and differ by driver
vec2 pcg2d(uvec2 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * 1664525u;
  v.y += v.x * 1664525u;
  v ^= v >> 16u;
  v.x += v.y * 1664525u;
  v.y += v.x * 1664525u;
  v ^= v >> 16u;
  return vec2(v) / 4294967295.0;
}
// A uniform number in [0, 1) per lattice cell. The offset keeps the cast positive (a negative float to uint is undefined)
float grainHash(vec2 cell) {
  return pcg2d(uvec2(ivec2(cell) + ivec2(1048576) + ivec2(paperSeed * 7919.0, paperSeed * 104729.0))).x;
}
// 2D value noise, the 1D one of rng.js in two axes — a number per lattice point, joined with smoothstep
float grainNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(grainHash(i), grainHash(i + vec2(1.0, 0.0)), u.x), mix(grainHash(i + vec2(0.0, 1.0)), grainHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
// sRGB → linear, the exact curve of color.js srgbToLinear
vec3 paperToLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}
// The grain's cell at a point on the paper (world space), 0..1. Nearest, never interpolated, so it stays grain and never smears
float grainCell(vec2 world) {
  return grainHash(floor(world * grainScale * (512.0 / 3.0)));
}
// The sheet's color there (linear), given its cell: the grain on the paper, and the blotches over it — soft, a little darker and
// warmer, a third to a whole grain unit across (the old discs' size), thinned so most of the sheet is clean
vec3 sheetColor(vec2 world, float cell) {
  vec2 p = world * grainScale;
  vec3 c = paperTone + (cell - 0.5) * (26.0 / 255.0);
  float n = grainNoise(p * 1.1 + 17.0) * 0.6 + grainNoise(p * 2.3 + 41.0) * 0.3 + grainNoise(p * 4.7 + 83.0) * 0.1;
  return paperToLinear(mix(c, paperBlotch, 0.07 * smoothstep(0.5, 0.82, n)));
}
`;

// The sheet's vertex shader — hands the fragment the world position the grain is keyed on. post.js draws with it too
export const PAPER_VERTEX = /* glsl */ `
varying vec2 vUv;
varying vec2 vPaper;
void main() {
  vUv = uv;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vPaper = world.xy;
  gl_Position = projectionMatrix * viewMatrix * world;
}`;

const FRAGMENT = /* glsl */ `
${GRAIN_GLSL}
varying vec2 vUv;
varying vec2 vPaper;

void main() {
  vec3 sheet = sheetColor(vPaper, grainCell(vPaper));
  gl_FragColor = vec4(sheet, 1.0);
  #include <colorspace_fragment>
}`;

// The sheet's material — the plane the scene keeps behind the board
export function makePaperMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { ...GRAIN },
    vertexShader: PAPER_VERTEX,
    fragmentShader: FRAGMENT,
    depthTest: false,
    depthWrite: false
  });
}
