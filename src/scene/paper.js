// The paper — one plane behind the board and the board's only shader: a procedural GLSL fragment, no texture, no tile. Made twice:
// the plain sheet (the main scene's background, what the audit and any direct render see) and the sheet with the board on it —
// the board drawn on a transparent target is composited over the sheet here, thinned on the grain's peaks, so the paper shows
// through the drawing. Docs: guidelines/drawing.md § the paper

import * as THREE from "three";
import { PAPER } from "../character/index.js";

// The 2D-canvas tile it replaces (512 px for 3 grain units, bilinear, repeated) smeared on a big screen and showed its repeat as a
// diagonal weave. A fragment has no tile and no resolution: the grain is the same statistic at any size — a cell of 3/512 grain units,
// a uniform ±13/255 on each channel, as the canvas laid it — and the blotches are a low noise instead of 18 discs, so they never repeat.
// The arithmetic is in sRGB on purpose, as the canvas's was, and the last line converts to linear for the renderer's output pass
// (drawing.md § colors go in as linear) — the only place a color is handled in sRGB, and it never meets hexToRgb
const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAGMENT = /* glsl */ `
uniform vec3 paper;     // the paper color, sRGB 0..1
uniform vec3 blotch;    // the blotches' tint, sRGB 0..1
uniform vec2 grain;     // the plane's size in grain units — the view of the 9×6 board, so the grain is pinned to that board whatever the grid
uniform float seed;
#ifdef BOARD
uniform sampler2D board;   // the board on a transparent target — premultiplied: its rgb is already × its alpha
uniform float tooth;       // the share of ink the sheet's peaks take off — how much the paper shows through the drawing
#endif
varying vec2 vUv;

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
float hash(vec2 cell) {
  return pcg2d(uvec2(ivec2(cell) + ivec2(1048576) + ivec2(seed * 7919.0, seed * 104729.0))).x;
}
// 2D value noise, the 1D one of rng.js in two axes — a number per lattice point, joined with smoothstep
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
// sRGB → linear, the exact curve of color.js srgbToLinear
vec3 toLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}

void main() {
  vec2 p = (vUv - 0.5) * grain;
  vec3 color = paper;
  // The grain — a cell of 3/512 grain units (the tile's texel), a uniform ±13/255, as the canvas had it; nearest, so it never smears
  float h = hash(floor(p * (512.0 / 3.0)));
  color += (h - 0.5) * (26.0 / 255.0);
  // The blotches — soft, a little darker and warmer, the size of the old discs (a third to a whole grain unit), thinned so most of the sheet is clean
  float n = vnoise(p * 1.1 + 17.0) * 0.6 + vnoise(p * 2.3 + 41.0) * 0.3 + vnoise(p * 4.7 + 83.0) * 0.1;
  color = mix(color, blotch, 0.07 * smoothstep(0.5, 0.82, n));
  vec3 sheet = toLinear(color);
#ifdef BOARD
  // The board over the sheet. The light cells are the peaks of the tooth — graphite skips them, so the ink thins there and the sheet
  // shows through, fills included. Premultiplied over: rgb + sheet × (1 − a), both scaled by what the peak took off
  vec4 b = texture2D(board, vUv);
  float t = 1.0 - tooth * smoothstep(0.55, 1.0, h);
  gl_FragColor = vec4(b.rgb * t + sheet * (1.0 - b.a * t), 1.0);
#else
  gl_FragColor = vec4(sheet, 1.0);
#endif
  #include <colorspace_fragment>
}`;

// "#rrggbb" → sRGB [r, g, b] 0..1 — not hexToRgb: this shader does its own arithmetic in sRGB and converts at its last line
function srgb(hex) {
  const value = parseInt(hex.slice(1), 16);
  return new THREE.Vector3(((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255);
}

// How much ink the grain's peaks take off the drawing, at most — the paper showing through. 0 is the drawing laid on top untouched
export const TOOTH = 0.3;

// The paper's material. seed is fixed by the caller — the paper is the desk, not the creature: NEW SEED changes the board, not the sheet.
// The scene sets `grain` (uniforms.grain) to the 9×6 board's view size on every layout, the way the tile's repeat was set.
// With board (a render target's texture) the sheet composites the board over itself — the second pass of scene/index.js render()
export function makePaperMaterial(seed, { board = null } = {}) {
  const uniforms = {
    paper: { value: srgb(PAPER) },
    blotch: { value: srgb("#968468") },   // the tint the canvas's discs had — rgba(150,132,104, 0.05)
    grain: { value: new THREE.Vector2(1, 1) },
    seed: { value: seed }
  };
  if (board) {
    uniforms.board = { value: board };
    uniforms.tooth = { value: TOOTH };
  }
  return new THREE.ShaderMaterial({
    uniforms,
    defines: board ? { BOARD: "" } : {},
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    depthTest: false,
    depthWrite: false
  });
}
