// 몸 — 몸통·무늬. 문서: guidelines/character/parts.md § 몸

import { blobPath } from "../../stroke.js";
import { shade, isDark, luminance } from "../../color.js";
import { FURS, CALICO_MID } from "../vocabulary/palette.js";

export function drawBody(ink, fills, spec, box, noise) {
  if (box.quad) {
    // 가로로 누운 몸. 머리가 앞쪽을 덮으므로 몸은 뒤로 뻗는다.
    const cx = box.bodyCx;
    const cy = (box.legTop + box.bodyTop) / 2;
    const path = blobPath(cx, cy, box.bodyW, (box.bodyTop - box.legTop) / 2, {
      lumps: 4, amount: 0.1, noise, phase: spec.proportions.wobbleSeed * 0.02
    });
    fills.fill(path, spec.palette.cloth, spec.palette.fillOffset);
    fills.scribbleFill(cx, cy, box.bodyW * 0.8, (box.bodyTop - box.legTop) * 0.4, {
      color: shade(spec.palette.cloth, isDark(spec.palette.cloth) ? 1.5 : 0.9),
      angle: Math.PI * 0.22, gap: 0.026, width: 0.006
    });
    ink.outline(path, { color: spec.palette.ink, width: 0.012, passes: 2 });
    return { path, top: box.bodyTop, bottom: box.legTop, w: box.bodyW, cx };
  }

  const kind = spec.parts.body;
  const w = box.bodyW;
  const bottom = box.legTop;
  const top = box.bodyTop;
  const ink0 = spec.palette.ink;
  let path;

  if (kind === "box") {
    path = [[-w, bottom], [-w, top], [w, top], [w, bottom]];
  } else if (kind === "dress") {
    path = [[-w * 1.35, bottom], [-w * 0.6, top], [w * 0.6, top], [w * 1.35, bottom]];
  } else if (kind === "tube") {
    path = [[-w * 0.62, bottom], [-w * 0.62, top], [w * 0.62, top], [w * 0.62, bottom]];
  } else {
    path = blobPath(0, (bottom + top) / 2, w, (top - bottom) / 2, {
      lumps: 4, amount: 0.12, noise, phase: spec.proportions.wobbleSeed * 0.02
    });
  }

  fills.fill(path, spec.palette.cloth, spec.palette.fillOffset);
  fills.scribbleFill(0, (top + bottom) / 2, w * 0.72, (top - bottom) * 0.4, {
    color: shade(spec.palette.cloth, isDark(spec.palette.cloth) ? 1.5 : 0.9),
    angle: Math.PI * 0.28, gap: 0.03, width: 0.006
  });
  ink.outline(path, { color: ink0, width: 0.012, passes: 2 });
  return { path, top, bottom, w, cx: 0 };
}

// 삼색 얼룩(marks calico)의 색·자리 — 개체마다(wobbleSeed, rng 없음). 없으면 null.
//   dark  검정 털 하나(FURS) · mid 따뜻한 탄(CALICO_MID — 고양이만, 개는 얼룩이라 검정만) · side 머리 얼룩·검은 귀가 붙는 쪽(−1 왼 / +1 오른)
// 바탕은 그대로 스킨(spec.js가 삼색이면 검정 털을 안 입혀 밝은 바탕을 보장한다). 색은 전부 팔레트 안 — 채도 있는 포인트가 아니다
export function calicoColors(spec) {
  if (spec.parts.marks !== "calico" || (spec.species !== "cat" && spec.species !== "pup")) return null;
  const seed = spec.proportions.wobbleSeed;
  return { dark: FURS[seed % FURS.length], mid: spec.species === "cat" ? CALICO_MID : null, side: (seed >> 4) % 2 ? 1 : -1 };
}

// 윤곽을 따라 앉는 얼룩 — 닫힌 윤곽 점 목록(blobPath 48점, 각 0 = 오른쪽, 반시계) 중 from 각도부터 span 각도만큼의 바깥 점들에,
// 그 점들을 중심 쪽으로 depth만큼 당긴 안쪽 곡선(노이즈로 울퉁불퉁)을 이어 닫는다. 바깥 변이 윤곽과 **정확히 같아** 삐져나오지 않고,
// 얼룩이 몸·머리 가장자리를 감싸는 삼색 특유의 모양이 된다. 채우기는 중심 부채꼴이라(stroke.js fill) span은 130° 이하로 —
// 초승달이 너무 벌어지면 무게중심에서 안 보이는 구석이 생긴다. 반환 { path(닫힘), inner(안쪽 곡선만 — 여기만 선을 긋는다) }
export function outlinePatch(outline, fromDeg, spanDeg, depth, noise, phase) {
  const n = outline.length;
  let cx = 0, cy = 0;
  for (const [x, y] of outline) { cx += x; cy += y; }
  cx /= n; cy /= n;
  const i0 = Math.round((fromDeg / 360) * n), count = Math.max(3, Math.round((spanDeg / 360) * n));
  const outer = [];
  for (let k = 0; k <= count; k += 1) outer.push(outline[(i0 + k + n * 4) % n]);
  const inner = [];
  for (let k = outer.length - 1; k >= 0; k -= 1) {
    const [x, y] = outer[k];
    const t = k / (outer.length - 1);
    // 양 끝은 윤곽에 닿고(depth 0) 가운데가 깊다 — 얼룩 가장자리가 윤곽에서 매끄럽게 떨어진다. 노이즈로 울퉁불퉁
    const d = depth * Math.sin(Math.PI * t) * (1 + (noise ? noise(phase + k * 1.7) : 0) * 0.35);
    inner.push([x + (cx - x) * d, y + (cy - y) * d]);
  }
  return { path: [...outer, ...inner.slice(1, -1)], inner };
}

// 얼룩 하나 — 채움 + 안쪽 가장자리만 가는 선 (바깥 변은 윤곽선이 이미 있다)
function patch(ink, fills, outline, fromDeg, spanDeg, depth, color, inkColor, noise, phase) {
  const { path, inner } = outlinePatch(outline, fromDeg, spanDeg, depth, noise, phase);
  fills.fill(path, color);
  ink.stroke(inner, { color: inkColor, width: 0.007, jitter: 0.004 });
}

// 몸 얼룩(삼색) — 엉덩이(꼬리 쪽 끝)를 감싸는 검정, 배 앞쪽에 탄(고양이). 개는 검정 하나 크게. 각도는 blobPath 기준(0 오른쪽 = 네발은 꼬리 쪽,
// 90 위, 180 왼쪽 = 머리 쪽). 몸 앞쪽 위는 큰 머리에 가려지니 얼룩은 뒤끝과 배 앞에 — 등 한가운데에 두면 머리 뒤로 사라진다
function drawCalicoBody(ink, fills, spec, body, noise) {
  const c = calicoColors(spec);
  if (!c || !body.path) return;
  const inkColor = spec.palette.ink;
  const ph = spec.proportions.wobbleSeed * 0.013;
  const flip = c.side > 0;   // 개체별로 조금 어긋나게 — 판에서 같은 자리에 얼룩이 줄지어 서지 않게
  if (c.mid) {
    patch(ink, fills, body.path, flip ? -40 : -15, 95, 0.55, c.dark, inkColor, noise, ph);
    patch(ink, fills, body.path, flip ? 215 : 195, 75, 0.45, c.mid, inkColor, noise, ph + 7);
  } else {
    patch(ink, fills, body.path, flip ? -35 : -10, 120, 0.6, c.dark, inkColor, noise, ph);
  }
}

// 머리 얼룩(삼색) — side 쪽 **정수리에서 그쪽으로 기운 모자꼴** 검정(그쪽 귀도 검어 한 덩어리로 읽힌다 — head.js drawCatEars/drawPupEars),
// 반대쪽 아래(볼)에 작은 탄(고양이). 머리 윤곽 점 목록은 drawHead가 돌려준다.
// 검정 얼룩은 **눈·눈썹 위에 못 온다** — 선으로 그리는 눈(sleepy·half·dot…)과 눈썹은 검정 잉크라 검정 얼룩 위에서 사라진다. 옆으로 내려오는
// 자리(100°~185°)는 600마리 중 158마리에서 눈에 걸쳤고, 정수리 자리(왼 75°~150° / 오른 30°~105°, 깊이 0.4)는 0마리다. 탄 얼룩은 잉크와 대조가 남아 볼에 둬도 된다
export function drawHeadMarks(ink, fills, spec, headPath, noise) {
  const c = calicoColors(spec);
  if (!c) return;
  const inkColor = spec.palette.ink;
  const ph = spec.proportions.wobbleSeed * 0.017 + 3;
  patch(ink, fills, headPath, c.side < 0 ? 75 : 30, 75, 0.4, c.dark, inkColor, noise, ph);
  if (c.mid) patch(ink, fills, headPath, c.side < 0 ? 300 : 210, 50, 0.4, c.mid, inkColor, noise, ph + 5);
}

export function drawMarks(ink, fills, spec, body, noise) {
  const kind = spec.parts.marks;
  if (kind === "none") return;
  if (kind === "calico") { drawCalicoBody(ink, fills, spec, body, noise); return; }
  // 몸 무늬는 **몸 색 위에** 그린다 — 어두운 몸(검정 털 개·고양이, 도깨비)에는 검정 무늬가 묻힌다. 얼굴 잉크와 같은 규칙(휘도 < 120 → 밝은 잉크)
  const ink0 = luminance(spec.palette.cloth) < 120 ? "#e9e3d5" : spec.palette.ink;
  const { top, bottom, w, cx = 0 } = body;

  if (kind === "stripes") {
    for (let i = 1; i <= 3; i += 1) {
      const y = bottom + ((top - bottom) * i) / 4;
      ink.stroke([[cx - w * 0.85, y], [cx + w * 0.85, y + 0.004]], { color: ink0, width: 0.011 });
    }
  } else if (kind === "dots") {
    for (let i = 0; i < 4; i += 1) {
      const x = cx - w * 0.5 + (i % 2) * w;
      const y = bottom + (top - bottom) * (0.3 + Math.floor(i / 2) * 0.35);
      ink.stroke([[x - 0.008, y], [x + 0.008, y]], { color: ink0, width: 0.012 });
    }
  } else if (kind === "hatch") {
    ink.hatch(cx, (top + bottom) / 2, w * 0.8, (top - bottom) * 0.35, Math.PI * 0.25, {
      color: ink0, lines: 5, width: 0.007
    });
  } else if (kind === "spots") {
    // 달마시안 얼룩
    for (let i = 0; i < 3; i += 1) {
      const sx = cx + (i - 1) * w * 0.5;
      const sy = bottom + (top - bottom) * (0.35 + (i % 2) * 0.3);
      ink.outline(blobPath(sx, sy, 0.025 + (i % 2) * 0.01, 0.02, { lumps: 4, amount: 0.25, noise: null }), {
        color: ink0, width: 0.008
      });
    }
  } else {
    ink.hatch(cx - w * 0.35, (top + bottom) / 2, w * 0.4, (top - bottom) * 0.25, 0, {
      color: ink0, lines: 4, width: 0.008
    });
  }
}

