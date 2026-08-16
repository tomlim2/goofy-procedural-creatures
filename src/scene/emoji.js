// 이모지 글리프 (♥ ! ? …). 애니메이션 곡선은 motion/emoji.js가 주고 여기는 모양만 굽는다.
// 문서: guidelines/motion/catalog.md § 이모지 애니메이션

import { Sketch, arcPath, blobPath } from "../stroke.js";
import { sketchMesh } from "./material.js";

// 이모지 글리프. 드물어서 그때그때 굽는다.
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
    sketch.outline(pts, { color: "#7d2f20", width: 0.007 });
  } else if (kind === "bang") {
    // "!" — 짧은 획은 끝 가늘어짐 때문에 마름모·실오라기가 된다. 채운 도형으로 그린다: 위가 굵은 막대 + 둥근 점
    const bar = [[-0.011, 0.085], [0.011, 0.085], [0.006, 0.02], [-0.006, 0.02]];
    sketch.fill(bar, "#2b2724");
    sketch.fill(blobPath(0, -0.012, 0.011, 0.011, { lumps: 3, amount: 0.15, noise: null }), "#2b2724");
  } else if (kind === "dots") {
    // "..." — 중얼거림. 점 셋을 채운 원으로
    for (let i = 0; i < 3; i += 1) {
      const x = -0.03 + i * 0.03;
      sketch.fill(blobPath(x, 0.012 + (i % 2) * 0.006, 0.009, 0.009, { lumps: 3, amount: 0.15, noise: null }), "#2b2724");
    }
  } else {
    // "?" — 호는 길어서 획으로(촘촘히 샘플), 줄기와 점은 채운 도형으로 (짧은 획은 끝 가늘어짐에 사라진다)
    sketch.stroke(arcPath(0, 0.045, 0.03, 0.03, Math.PI, -Math.PI * 0.35, 16), { color: "#2b2724", width: 0.012, step: 0.008 });
    sketch.fill([[0.004, 0.016], [0.018, 0.014], [0.013, -0.01], [0.001, -0.008]], "#2b2724");
    sketch.fill(blobPath(0.007, -0.03, 0.011, 0.011, { lumps: 3, amount: 0.15, noise: null }), "#2b2724");
  }
  return sketchMesh(sketch, 0.95, 7);
}
