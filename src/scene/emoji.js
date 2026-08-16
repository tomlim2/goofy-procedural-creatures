// 이모지 글리프 (♥ ! ? …). 애니메이션 곡선은 motion/emoji.js가 주고 여기는 모양만 굽는다.
// 문서: guidelines/motion/catalog.md § 이모지 애니메이션

import { Sketch, arcPath } from "../stroke.js";
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
    sketch.stroke([[0, 0.075], [0.004, 0.02]], { color: "#2b2724", width: 0.018 });
    sketch.stroke([[-0.002, -0.012], [0.006, -0.014]], { color: "#2b2724", width: 0.018 });
  } else if (kind === "dots") {
    // "..." — 중얼거림
    for (let i = 0; i < 3; i += 1) {
      const x = -0.03 + i * 0.03;
      sketch.stroke([[x - 0.006, 0.01 + (i % 2) * 0.008], [x + 0.006, 0.01 + (i % 2) * 0.008]], {
        color: "#2b2724", width: 0.014
      });
    }
  } else {
    sketch.stroke(arcPath(0, 0.045, 0.03, 0.03, Math.PI, -Math.PI * 0.35, 12), { color: "#2b2724", width: 0.012 });
    sketch.stroke([[0.012, 0.012], [0.008, -0.004]], { color: "#2b2724", width: 0.012 });
    sketch.stroke([[0.004, -0.026], [0.012, -0.028]], { color: "#2b2724", width: 0.015 });
  }
  return sketchMesh(sketch, 0.95, 7);
}
