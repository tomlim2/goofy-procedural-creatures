// Material balls — the editor's material preview, the way a 3D program shows a shader ball: one blob filled
// the goofy material's way at a density step, in a colour, under the board's contour. Drawn by the board's own
// code (stroke.js, medium/materials.js), so a ball cannot drift from what a creature draws.
//
// One hidden WebGL renderer paints every ball's small 2D canvas — one context, many views (how.js does the
// same for its legend; a page of per-canvas contexts would hit the browser's context cap).

import * as THREE from "three";
import { Sketch } from "./stroke.js";
import { blobPath } from "./shape.js";
import { stepOf } from "./medium/materials.js";
import { sketchMesh } from "./scene/mesh.js";
import { makeRng, makeNoise } from "./rng.js";
import { INKS } from "./character/vocabulary/palette.js";

const INK = INKS[0];
const CARD = "#f2ecdf";   // the card's back (styles.css .card) — the pencil's bites take it
const HALF = 0.26;        // the world half-size a ball is framed in; the ball itself is radius 0.2
// A fixed hand: the balls are a legend, not a creature, and hold still between repaints
const noise = makeNoise(makeRng(7));
const camera = new THREE.OrthographicCamera(-HALF, HALF, HALF, -HALF, -1, 1);

let renderer = null;
function gl() {
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  }
  return renderer;
}

// Paints one ball onto `canvas` at `size` CSS pixels. `material` is a goofy material name in either case
// ("oil" or "OIL"), `density` a step name (black · hatch · scribble · stipple · light), `phase` scatters the
// blob's lumps and the strokes' shiver so two balls side by side are not the same shape.
export function paintBall(canvas, { color, material, density, phase = 0, size = 28 }) {
  const r = gl();
  const dpr = r.getPixelRatio();
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  canvas.width = Math.round(size * dpr);
  canvas.height = Math.round(size * dpr);

  const fills = new Sketch(noise, 1);
  fills.phase = 31 + phase * 17;
  const ink = new Sketch(noise, 1);
  ink.phase = 131 + phase * 17;
  const ball = blobPath(0, 0, 0.2, 0.2, { lumps: 5, amount: 0.05, noise, phase: 97 + phase * 3 });
  fills.paint(ball, String(material || "flat").toUpperCase(), { color, value: stepOf(density) });
  ink.contour(ball, { color: INK, paper: CARD });   // the board's contour — a goofy material is only the filling

  const scene = new THREE.Scene();
  const group = sketchMesh([fills, ink], 1, 0);
  scene.add(group);
  r.setSize(size, size, false);
  r.render(scene, camera);
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(r.domElement, 0, 0, canvas.width, canvas.height);
  group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });   // the materials are shared per opacity (scene/mesh.js) and not ours to free
}
