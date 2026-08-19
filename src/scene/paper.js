// Paper texture. Docs: guidelines/drawing.md

import * as THREE from "three";
import { makeRng } from "../rng.js";
import { PAPER } from "../character/index.js";

// Paper. A flat single color makes the lines look like they float. Grain and blotches are baked procedurally.
export function makePaperTexture(seed) {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, size, size);

  const rng = makeRng(seed);
  const image = ctx.getImageData(0, 0, size, size);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    const grain = (rng.next() - 0.5) * 26;
    data[i] = Math.max(0, Math.min(255, data[i] + grain));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + grain));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + grain));
  }
  ctx.putImageData(image, 0, 0);

  // Blotches (round marks). The texture repeats as a tile, so there must be no seam — each blotch is drawn
  // at its 3×3 neighbour positions too, so a blotch clipped at the canvas edge continues on the opposite side.
  // Without that, circles clipped at the edge line up into a straight ridge on every repeat.
  for (let i = 0; i < 18; i += 1) {
    const x = rng.float(0, size);
    const y = rng.float(0, size);
    const r = rng.float(40, 160);
    for (const ox of [-size, 0, size]) {
      for (const oy of [-size, 0, size]) {
        const cx = x + ox;
        const cy = y + oy;
        if (cx + r < 0 || cx - r > size || cy + r < 0 || cy - r > size) continue;
        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        gradient.addColorStop(0, "rgba(150,132,104,0.05)");
        gradient.addColorStop(1, "rgba(150,132,104,0)");
        ctx.fillStyle = gradient;
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  // The canvas was drawn in sRGB. Without saying so, the paper color lifts.
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}
