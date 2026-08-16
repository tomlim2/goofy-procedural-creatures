// 종이 텍스처. 문서: guidelines/drawing.md

import * as THREE from "three";
import { makeRng } from "../rng.js";
import { PAPER } from "../character/index.js";

// 종이. 균일한 단색이면 선이 떠 보인다. 그레인과 얼룩을 절차적으로 굽는다.
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

  // 얼룩(둥근 흔적). 텍스처는 타일로 반복되므로 이음매가 없어야 한다 — 얼룩 하나를 3×3 이웃 위치에도
  // 그려서 캔버스 가장자리에서 잘린 얼룩이 반대편으로 이어지게 한다. 안 그러면 가장자리에서
  // 잘린 원이 반복될 때마다 곧은 날이 선다.
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
  // 캔버스는 sRGB로 그렸다. 명시하지 않으면 종이색이 뜬다.
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}
