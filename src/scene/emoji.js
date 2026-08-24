// Emoji glyphs (♥ ! ? …). motion/emoji.js supplies the animation curves; this only bakes the shapes.
// Docs: guidelines/motion/catalog.md § emoji animation

import { Sketch } from "../stroke.js";
import { arcPath, blobPath } from "../shape.js";
import { sketchMesh } from "./mesh.js";

// Emoji sit above every individual — a value larger than any individual's block (index × 10 + layer)
export const EMOJI_ORDER = 100000;

// Emoji glyphs. Rare enough to bake on demand.
export function buildEmoji(kind, noise) {
  const sketch = new Sketch(noise, 0.6);
  if (kind === "heart") {
    const pts = [];
    for (let i = 0; i <= 28; i += 1) {
      const a = (i / 28) * Math.PI * 2;
      const x = 0.045 * Math.pow(Math.sin(a), 3);
      const y = 0.038 * (Math.cos(a) - 0.35 * Math.cos(2 * a) - 0.18 * Math.cos(3 * a) - 0.06 * Math.cos(4 * a)) + 0.01;
      pts.push([x, y]);
    }
    sketch.fill(pts, "#b0432e");
    sketch.pencil(pts, { color: "#7d2f20", width: 0.007, closed: true, paper: "#b0432e" });
  } else if (kind === "bang") {
    // "!" — a short stroke turns into a diamond or a thread because of the end taper. Drawn as filled shapes instead: a bar thick at the top plus a round dot
    const bar = [[-0.011, 0.085], [0.011, 0.085], [0.006, 0.02], [-0.006, 0.02]];
    sketch.fill(bar, "#2b2724");
    sketch.fill(blobPath(0, -0.012, 0.011, 0.011, { lumps: 3, amount: 0.15, noise: null }), "#2b2724");
  } else if (kind === "zzz") {
    // "z z" — sleep. One big z with a small z up and to the right. Short strokes are sampled densely to get past the end taper
    sketch.line([[-0.026, 0.028], [0.014, 0.028], [-0.026, -0.006], [0.014, -0.006]], { color: "#2b2724" });
    sketch.line([[0.02, 0.06], [0.044, 0.06], [0.02, 0.04], [0.044, 0.04]], { color: "#2b2724", size: "S" });
  } else if (kind === "sweat") {
    // Sweat drop — a teardrop with a point at the top. Pale blue fill plus an outline
    const pts = [];
    for (let i = 0; i <= 24; i += 1) {
      const a = (i / 24) * Math.PI * 2;
      const r = 0.017 * (1 - 0.35 * Math.max(0, Math.sin(a)));   // narrows toward the top (sin>0)
      pts.push([Math.cos(a) * r * 0.85, Math.sin(a) * r * 1.25 + (Math.sin(a) > 0 ? Math.sin(a) * 0.012 : 0)]);
    }
    sketch.fill(pts, "#b9cbd6");
    sketch.pencil(pts, { color: "#2b2724", width: 0.007, closed: true, paper: "#b9cbd6" });
  } else if (kind === "dots") {
    // "..." — muttering. Three dots as filled circles
    for (let i = 0; i < 3; i += 1) {
      const x = -0.03 + i * 0.03;
      sketch.fill(blobPath(x, 0.012 + (i % 2) * 0.006, 0.009, 0.009, { lumps: 3, amount: 0.15, noise: null }), "#2b2724");
    }
  } else {
    // "?" — the arc is long enough to stroke (sampled densely); the stem and dot are filled shapes (short strokes vanish into the end taper)
    sketch.line(arcPath(0, 0.045, 0.03, 0.03, Math.PI, -Math.PI * 0.35, 16), { color: "#2b2724" });
    sketch.fill([[0.004, 0.016], [0.018, 0.014], [0.013, -0.01], [0.001, -0.008]], "#2b2724");
    sketch.fill(blobPath(0.007, -0.03, 0.011, 0.011, { lumps: 3, amount: 0.15, noise: null }), "#2b2724");
  }
  // It owns its material — animate changes opacity every frame for the fade. With a shared material, pupils using the same value would fade along with it
  return sketchMesh(sketch, 0.95, EMOJI_ORDER, 0, { own: true });
}
