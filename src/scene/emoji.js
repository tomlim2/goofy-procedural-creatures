// 이모지 글리프 (♥ ! ? …). 애니메이션 곡선은 motion/emoji.js가 주고 여기는 모양만 굽는다.
// 문서: guidelines/motion/catalog.md § 이모지 애니메이션

import { Sketch, arcPath, blobPath } from "../stroke.js";
import { sketchMesh } from "./material.js";

// 이모지는 모든 개체 위 — 개체 블록(index × 10 + 층)보다 큰 값
export const EMOJI_ORDER = 100000;

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
  } else if (kind === "zzz") {
    // "z z" — 잠. 큰 z 하나와 오른쪽 위에 작은 z. 짧은 획은 촘촘히 샘플해 끝 가늘어짐을 넘긴다
    sketch.stroke([[-0.026, 0.028], [0.014, 0.028], [-0.026, -0.006], [0.014, -0.006]], { color: "#2b2724", width: 0.011, step: 0.006 });
    sketch.stroke([[0.02, 0.06], [0.044, 0.06], [0.02, 0.04], [0.044, 0.04]], { color: "#2b2724", width: 0.008, step: 0.005 });
  } else if (kind === "sweat") {
    // 땀방울 — 위가 뾰족한 물방울. 옅은 파랑 채움 + 윤곽
    const pts = [];
    for (let i = 0; i <= 24; i += 1) {
      const a = (i / 24) * Math.PI * 2;
      const r = 0.017 * (1 - 0.35 * Math.max(0, Math.sin(a)));   // 위(sin>0)가 좁아진다
      pts.push([Math.cos(a) * r * 0.85, Math.sin(a) * r * 1.25 + (Math.sin(a) > 0 ? Math.sin(a) * 0.012 : 0)]);
    }
    sketch.fill(pts, "#b9cbd6");
    sketch.outline(pts, { color: "#2b2724", width: 0.007, step: 0.006 });
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
  // 재질을 혼자 쓴다(own) — animate가 페이드에 맞춰 opacity를 프레임마다 바꾼다. 공유 재질이면 같은 값을 쓰는 동공까지 같이 흐려진다
  return sketchMesh(sketch, 0.95, EMOJI_ORDER, 0, { own: true });
}
