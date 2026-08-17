// 얼굴 — 눈·눈썹·안경·코·주둥이·볼·수염. 입은 mouth.js, 눈썹·입의 상태 벌은 faceStates.js.
// 문서: guidelines/character/parts.md § 머리 (eyes~nose), guidelines/motion/catalog.md § 얼굴

import { blobPath, arcPath } from "../../stroke.js";
import { TAU } from "./layout.js";
import { shade, luminance } from "../../color.js";

// 이 눈이 안대에 가려졌나 — 안대가 있을 때만 patchSide를 본다 (갤러리 fix나 뒤늦은 제약으로 안대가 빠져도 눈이 같이 사라지지 않게)
export function patched(spec, eye) { return spec.parts.eyewear === "patch" && spec.parts.patchSide === eye.side; }

// 살아 있는 눈의 흰자 모양 — 반지름 r에 곱하는 가로·세로 배율. oval만 세로로 길다 (scene/rig.js가 같은 값으로 리그를 굽는다)
export const EYE_SHAPE = { oval: { sx: 0.82, sy: 1.22 } };
export function eyeShape(spec) { return EYE_SHAPE[spec.parts.eyes] || { sx: 1, sy: 1 }; }
// 살아 있는 눈(리그로 세우는 눈) — 나머지는 얼굴 잉크에 정적으로 굽는다
export const RIG_EYES = ["ring", "wide", "cyclops", "oval"];

// 별(☆) 꼭짓점 목록 — 바깥 r, 안쪽 r·inner, 위가 뾰족. 놀람의 ☆_☆ 눈 덮개(scene/rig.js)가 쓴다
export function starPath(cx, cy, r, inner = 0.45) {
  const pts = [];
  for (let i = 0; i < 10; i += 1) {
    const a = Math.PI / 2 + (i / 10) * Math.PI * 2;
    const rr = i % 2 === 0 ? r : r * inner;
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return pts;
}
// 하트(♥) 폐곡선 — 폭 w, 높이 h. 놀람의 ♥_♥ 눈 덮개(scene/rig.js)가 쓴다
export function heartPath(cx, cy, w, h) {
  const pts = [];
  for (let i = 0; i <= 28; i += 1) {
    const a = (i / 28) * Math.PI * 2;
    pts.push([cx + w * Math.pow(Math.sin(a), 3), cy + h * (Math.cos(a) - 0.35 * Math.cos(2 * a) - 0.18 * Math.cos(3 * a) - 0.06 * Math.cos(4 * a)) + h * 0.2]);
  }
  return pts;
}

// 코·입·볼 자리를 잡을 때 보는 눈 밑선 — 흰자 위에 얹히면 같은 색(도깨비 밝은 잉크)이거나 덮여서 사라진다.
// (놀람은 눈을 키우지 않고 동공만 줄이므로 흰자 크기는 그대로다)
// x 자리에서 눈(흰자)이 닿으면 그 밑선(y)을, 아니면 Infinity를 준다. 파츠는 min(원래 y, 밑선 - 여유)에 앉는다
export function eyeFloor(spec, eyes, x) {
  const { sx, sy } = eyeShape(spec);
  const hit = eyes.filter((e) => e.r * sx * 1.05 > Math.abs(x - e.x));
  return hit.length ? Math.min(...hit.map((e) => e.y - e.r * sy * 1.05)) : Infinity;
}

export function drawEyes(ink, fills, spec, box, eyes) {
  const kind = spec.parts.eyes;
  const ink0 = spec.faceInk || spec.palette.ink;

  // 작은 눈부터 그린다 — 겹치면 큰 눈이 앞(hollow처럼 채움+윤곽을 한 스케치에 그리는 눈에서 교차선이 안 생긴다)
  for (const eye of [...eyes].sort((a, b) => a.r - b.r)) {
    if (patched(spec, eye)) continue;

    if (kind === "dot") {
      fills.fill(blobPath(eye.x, eye.y, eye.r * 0.4, eye.r * 0.4, { lumps: 3, amount: 0.2, noise: null }), ink0);
    } else if (kind === "sleepy") {
      ink.stroke(arcPath(eye.x, eye.y, eye.r, eye.r * 0.7, Math.PI, TAU), { color: ink0, width: 0.011 });
    } else if (kind === "cross") {
      ink.stroke([[eye.x - eye.r, eye.y - eye.r], [eye.x + eye.r, eye.y + eye.r]], { color: ink0, width: 0.011 });
      ink.stroke([[eye.x + eye.r, eye.y - eye.r], [eye.x - eye.r, eye.y + eye.r]], { color: ink0, width: 0.011 });
    } else if (kind === "scrawl") {
      // 크레파스로 마구 그린 동그라미 — 한 획으로 세 바퀴 반, 바퀴마다 반지름과 중심이 흔들려 선이 겹치고 삐져나온다.
      // 정갈한 나선(spiral)과 다르다: 시작·끝이 안 맞물리고 획이 서로를 지나친다 (아이가 크레파스로 그린 눈)
      // 한 바퀴를 조금 넘겨 그린 고리 넷을 겹친다 — 고리마다 중심·크기·기울기가 달라 획이 서로를 지나치고 끝이 안 맞물린다.
      // (한 획으로 여러 바퀴 돌면 동심원이 되어 나선처럼 보인다 — 그건 spiral이다)
      const wob = ink.noise;
      const phase = eye.side * 5.5 + spec.proportions.wobbleSeed * 0.017;
      for (let k = 0; k < 6; k += 1) {
        const w1 = wob(phase + k * 3.7), w2 = wob(phase + 17 + k * 3.7), w3 = wob(phase + 41 + k * 3.7);
        const cx = eye.x + eye.r * 0.17 * w1;
        const cy = eye.y + eye.r * 0.15 * w2;
        // 고리마다 크기가 층진다 — 큰 고리와 작은 고리가 섞여 덧그은 자국이 된다 (0.45~1.05배)
        const grade = 0.45 + 0.6 * ((k * 0.37) % 1);
        const rx = eye.r * Math.min(1.05, grade + 0.12 * w3);
        const ry = eye.r * Math.min(1.05, grade + 0.12 * w1) * 0.92;
        const tilt = w2 * 0.9;
        const from = w3 * Math.PI;
        const to = from + TAU + 0.8 + w1 * 0.6;   // 한 바퀴 + 여분 — 끝이 시작을 지나친다
        const pts = [];
        for (let i = 0; i <= 24; i += 1) {
          const a = from + (to - from) * (i / 24);
          const x = Math.cos(a) * rx, y = Math.sin(a) * ry;
          pts.push([cx + x * Math.cos(tilt) - y * Math.sin(tilt), cy + x * Math.sin(tilt) + y * Math.cos(tilt)]);
        }
        ink.stroke(pts, { color: ink0, width: 0.012, jitter: 0.008, step: 0.014 });
      }
    } else if (kind === "spiral") {
      const spiral = [];
      for (let i = 0; i <= 40; i += 1) {
        const t = i / 40;
        const angle = t * TAU * 2.2;
        const r = eye.r * (1 - t * 0.85);
        spiral.push([eye.x + Math.cos(angle) * r, eye.y + Math.sin(angle) * r]);
      }
      ink.stroke(spiral, { color: ink0, width: 0.009, jitter: 0.004 });
    } else if (kind === "slit") {
      // 아몬드 윤곽 + **채운** 세로 동공(방추). 얇은 획이면 눈이 작을 때 윤곽 두 선이 붙어 뭉개지고 동공은 안 읽힌다 —
      // 아몬드를 조금 높이고(0.7r) 동공을 면으로 채워 멀리서도 고양이 눈으로 보이게
      ink.outline(blobPath(eye.x, eye.y, eye.r * 1.05, eye.r * 0.7, { lumps: 3, amount: 0.1, noise: null }), {
        color: ink0, width: 0.01
      });
      fills.fill(blobPath(eye.x, eye.y, eye.r * 0.2, eye.r * 0.6, { lumps: 2, amount: 0.05, noise: null }), ink0);
    } else if (kind === "line") {
      // 일자눈 ㅡ ㅡ — 무표정 대시. 살짝 바깥이 처진다
      ink.stroke([[eye.x - eye.r * 0.95, eye.y + 0.003], [eye.x + eye.r * 0.95, eye.y - 0.003]], { color: ink0, width: 0.013 });
    } else if (kind === "happy") {
      // 늘 웃는 눈 ^^ — 위로 볼록한 아치 (행복 상태의 미소 아치와 같은 모양, 여기선 항상)
      ink.stroke(arcPath(eye.x, eye.y - eye.r * 0.12, eye.r * 0.92, eye.r * 0.72, Math.PI * 0.12, Math.PI * 0.88, 10), { color: ink0, width: 0.013 });
    } else if (kind === "squeeze") {
      // >_< — 꼭 감은 눈. 코 쪽으로 향한 꺾쇠 (왼눈 >, 오른눈 <)
      const inward = -eye.side;
      ink.stroke([[eye.x - inward * eye.r * 0.7, eye.y + eye.r * 0.7], [eye.x + inward * eye.r * 0.45, eye.y], [eye.x - inward * eye.r * 0.7, eye.y - eye.r * 0.7]],
        { color: ink0, width: 0.013, jitter: 0.004 });
    } else if (kind === "side") {
      // ¬_¬ — 곁눈질. 반감김(아래쪽 호 + 눈꺼풀 선)인데 동공이 한쪽으로 몰린다 (어느 쪽인지는 개체별)
      const dir = spec.proportions.wobbleSeed % 2 ? 1 : -1;
      const lidY = eye.r * 0.3;
      const a0 = Math.asin(lidY / eye.r);
      ink.stroke(arcPath(eye.x, eye.y, eye.r, eye.r, Math.PI - a0, Math.PI * 2 + a0, 18), { color: ink0, width: 0.011 });
      ink.stroke([[eye.x - eye.r * 1.15, eye.y + lidY - eye.r * 0.05], [eye.x + eye.r * 1.15, eye.y + lidY + 0.004]], { color: ink0, width: 0.013 });
      fills.fill(blobPath(eye.x + dir * eye.r * 0.48, eye.y - eye.r * 0.12, eye.r * 0.3, eye.r * 0.3, { lumps: 3, amount: 0.12, noise: null }), ink0);
    } else if (kind === "droop") {
      // ´･ω･` — 처진 눈꼬리. 점 눈 위에 바깥으로 내려가는 눈꺼풀 획 (시무룩)
      fills.fill(blobPath(eye.x, eye.y, eye.r * 0.4, eye.r * 0.4, { lumps: 3, amount: 0.2, noise: null }), ink0);
      ink.stroke([[eye.x - eye.side * eye.r * 0.55, eye.y + eye.r * 1.05], [eye.x + eye.side * eye.r * 0.95, eye.y + eye.r * 0.5]], { color: ink0, width: 0.011 });
    } else if (kind === "hollow") {
      // 빈 눈 — 보통 눈(ring)에서 동공만 뺀 것. 어느 종족이든 흰자 + 윤곽, 동공 없음 (도깨비도 검은 눈구멍이 아니라 흰 눈).
      // 채움과 윤곽을 **같은 스케치(fills)** 에 눈마다 이어 그린다 — 두 눈이 겹치면 나중 눈(큰 눈)이 앞 눈의 윤곽을 덮는다 (교차선 없음).
      // 그러려면 작은 눈부터: 큰 눈이 뒤에 그려져 앞이 된다
      const path = blobPath(eye.x, eye.y, eye.r, eye.r, { lumps: 3, amount: 0.07, noise: fills.noise, phase: eye.side * 3.7 });   // 살짝 찌그러진 원
      fills.fill(path, "#f6f2e9");
      fills.outline(path, { color: spec.palette.ink, width: 0.011, passes: 2 });   // 흰자 테는 검정 — 흰자 위라 늘 보인다
    } else if (kind === "sharp") {
      // 날카로운 눈 — 코 쪽 끝이 뾰족하게 내려간 나뭇잎 꼴(위 선은 곧고 굵게, 아래는 불룩) + 바깥으로 치우친 동공. 늘 심술난 인상(시크).
      // 흰자 위에 그리는 것이라 잉크는 늘 어두운 팔레트 잉크
      const dark = spec.palette.ink;
      const out = eye.side === 0 ? 1 : eye.side;              // 외눈은 오른쪽 기준
      const tipIn = [eye.x - out * eye.r * 1.12, eye.y - eye.r * 0.46];   // 코 쪽 뾰족한 끝 — 아래로 처진다
      const tipOut = [eye.x + out * eye.r * 1.05, eye.y + eye.r * 0.2];   // 바깥 끝 — 위로
      // a→b를 bow만큼 왼쪽(진행 방향 기준)으로 불린 호
      const bowed = (a, b, bow, n) => {
        const pts = [];
        let dx = b[0] - a[0], dy = b[1] - a[1];
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len, ny = dx / len;
        for (let i = 0; i <= n; i += 1) {
          const t = i / n;
          const k = Math.sin(Math.PI * t) * bow;
          pts.push([a[0] + dx * t + nx * k, a[1] + dy * t + ny * k]);
        }
        return pts;
      };
      const upper = bowed(tipIn, tipOut, out * eye.r * 0.16, 12);    // 위 눈꺼풀 — 거의 곧다(각진 인상)
      const lower = bowed(tipOut, tipIn, out * eye.r * 0.78, 12);    // 아래 — 크게 불룩(흰자가 남을 만큼)
      const almond = [...upper, ...lower.slice(1, -1)];
      fills.fill(almond, "#f6f2e9");
      fills.outline(almond, { color: dark, width: 0.011, passes: 2 });
      ink.stroke(upper, { color: dark, width: 0.016 });              // 위 눈꺼풀을 굵게 — 사나운 인상
      // 동공 — 작은 점이 아니라 **위 눈꺼풀에 붙은 큰 덩어리**(눈 모양을 그대로 줄인 것). 바깥·위에 앉아 아래·안쪽에 흰 초승달만 남긴다
      const anchor = upper[Math.round(upper.length * 0.58)];
      fills.fill(almond.map(([x, y]) => [anchor[0] + (x - anchor[0]) * 0.5, anchor[1] + (y - anchor[1]) * 0.5]), dark);
    } else if (kind === "lidded") {
      // 무거운 눈꺼풀 — 큰 흰자 위쪽을 **채운 눈꺼풀**(눈두덩)이 덮고 그 밑으로 동공이 내다본다. 반감김(half)이 선 하나라면 이건 덩어리다.
      // 흰자 위에 그리는 것이라 잉크는 늘 어두운 팔레트 잉크 (밝은 얼굴 잉크로 그리면 흰자에 묻힌다)
      const dark = spec.palette.ink;
      const path = blobPath(eye.x, eye.y, eye.r, eye.r * 1.05, { lumps: 3, amount: 0.07, noise: fills.noise, phase: eye.side * 3.7 });
      fills.fill(path, "#f6f2e9");
      fills.outline(path, { color: dark, width: 0.011, passes: 2 });
      // 눈꺼풀 — 위쪽 호 + 가운데가 처진 아래 경계 (눈두덩이 눈을 짓누른다)
      const rel = 0.16, a0 = Math.asin(rel);
      const lid = [];
      const steps = 18;
      for (let i = 0; i <= steps; i += 1) {
        const a = a0 + (Math.PI - 2 * a0) * (i / steps);
        lid.push([eye.x + Math.cos(a) * eye.r, eye.y + Math.sin(a) * eye.r * 1.05]);
      }
      for (let i = 0; i <= 10; i += 1) {
        const t = i / 10;
        const x = eye.x + eye.r * (Math.cos(Math.PI - a0) * (1 - t) + Math.cos(a0) * t);
        lid.push([x, eye.y + eye.r * (rel * 1.05) - Math.sin(Math.PI * t) * eye.r * 0.16]);
      }
      fills.fill(lid, dark);
      // 동공 — 눈꺼풀 밑에서 반쯤 가린 채 내다본다 (개체별로 살짝 좌우)
      const gaze = (spec.proportions.wobbleSeed % 5 - 2) * 0.06;
      fills.fill(blobPath(eye.x + eye.r * gaze, eye.y - eye.r * 0.16, eye.r * 0.3, eye.r * 0.34, { lumps: 3, amount: 0.12, noise: null }), dark);
    } else if (kind === "half") {
      // 반쯤 감은 눈 — 원 전체에 선을 긋지 않는다(원+선은 "선 그어진 동그라미"로 뭉개져 읽힌다).
      // 눈꺼풀 선 **아래쪽 호**만 그리고, 그 선 밑에 동공을 둔다 → 무거운 눈꺼풀이 눈을 덮은 모양
      const lidY = eye.r * 0.3;
      const a0 = Math.asin(lidY / eye.r);   // 눈꺼풀 선이 원과 만나는 각
      ink.stroke(arcPath(eye.x, eye.y, eye.r, eye.r, Math.PI - a0, Math.PI * 2 + a0, 18), { color: ink0, width: 0.011, jitter: 0.006 });
      ink.stroke([[eye.x - eye.r * 1.15, eye.y + lidY - eye.r * 0.05], [eye.x + eye.r * 1.15, eye.y + lidY + 0.004]], {
        color: ink0, width: 0.013
      });
      fills.fill(blobPath(eye.x, eye.y - eye.r * 0.12, eye.r * 0.3, eye.r * 0.3, { lumps: 3, amount: 0.12, noise: null }), ink0);
    }
    // ring / wide / cyclops / oval(RIG_EYES)은 여기서 그리지 않는다. scene이 흰자·동공·감은 선을
    // 별도 메시로 세워 놀람(동공 수축)·시선·눈꺼풀을 움직인다.
  }
}

export function drawFace2(ink, fills, spec, box, eyes) {
  const kind = spec.parts.face2;
  if (kind === "none") return;
  const ink0 = spec.faceInk || spec.palette.ink;

  if (kind === "tears") {
    // 눈 아래로 흘러내리는 두 줄. 레퍼런스에서 자주 보이는 디테일.
    for (const eye of eyes) {
      if (patched(spec, eye)) continue;
      for (const off of [-0.35, 0.35]) {
        const x = eye.x + eye.r * off;
        ink.stroke([
          [x, eye.y - eye.r * 0.9],
          [x + 0.008, eye.y - eye.r * 0.9 - box.headRy * 0.3],
          [x - 0.004, eye.y - eye.r * 0.9 - box.headRy * 0.52]
        ], { color: ink0, width: 0.007, jitter: 0.006 });
      }
    }
    return;
  }

  for (const side of [-1, 1]) {
    const cx = side * box.headRx * 0.58;
    // 볼은 눈 밑 — 왕눈이면 (놀라 커진) 눈 아래로 내려간다. 흰자에 통째로 덮이지 않게
    const cheekY = Math.min(box.headCy - box.headRy * 0.28, eyeFloor(spec, eyes, cx) - 0.02);
    if (kind === "blush") {
      fills.fill(blobPath(cx, cheekY, 0.042, 0.026, { lumps: 3, amount: 0.15, noise: null }), "#d9968a");
    } else {
      // freckles — 볼마다 점 세 개
      for (let i = 0; i < 3; i += 1) {
        const fx = cx + (i - 1) * 0.022;
        const fy = cheekY + (i % 2 ? 0.012 : -0.008);
        ink.stroke([[fx - 0.005, fy], [fx + 0.005, fy]], { color: ink0, width: 0.008 });
      }
    }
  }
}

// 고양이 수염 — 양쪽 세 가닥. 길이는 개체별(머리 반폭의 0.42~0.92배): 반 넘는 개체는 수염이 **머리 윤곽을 뚫고 밖으로** 나온다.
// 얼굴 층(2.4)에 그리므로 윤곽·귀·모자 위에 얹히고 종이 위까지 뻗는다. 얼굴 돌림을 따라 같이 밀린다
export function drawWhiskers(ink, spec, box) {
  if (spec.species !== "cat") return;
  const roll = (spec.proportions.wobbleSeed % 97) / 97;
  const len = box.headRx * (0.42 + roll * 0.5);
  const wy = box.headCy - box.headRy * 0.3;
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i += 1) {
      const y0 = wy + (i - 1) * 0.028;
      const x0 = side * box.headRx * 0.3;
      // 살짝 처지는 부채꼴 — 긴 수염일수록 끝이 더 벌어진다
      ink.stroke([[x0, y0], [x0 + side * len * 0.55, y0 + (i - 1) * 0.008 * (len / 0.09)], [x0 + side * len, y0 + (i - 1) * 0.02 * (len / 0.09) - 0.004]],
        { color: spec.faceInk || spec.palette.ink, width: 0.006, jitter: 0.004 });
    }
  }
}

export function drawBrow(ink, spec, box, eyes, kindOverride) {
  const kind = kindOverride || spec.parts.brow;
  if (kind === "none") return;
  const ink0 = spec.faceInk || spec.palette.ink;

  for (const eye of eyes) {
    if (patched(spec, eye)) continue;
    // 눈썹은 눈 위, 그러나 머리 안 — 외눈처럼 큰 눈은 1.9배 위가 머리 밖(종이 위)이라 사라진다
    const y = Math.min(eye.y + eye.r * (eye.side === 0 ? 1.35 : 1.9), box.headCy + box.headRy * 0.84);
    const half = Math.max(eye.r * 1.15, 0.022);   // 눈이 작아도 눈썹은 눈썹만큼은 길다
    let left = y;
    let right = y;
    if (kind === "angry") {
      left = y - eye.r * 0.4 * (eye.side > 0 ? 1 : 0);
      right = y - eye.r * 0.4 * (eye.side > 0 ? 0 : 1);
    } else if (kind === "worry") {
      left = y + eye.r * 0.3 * (eye.side > 0 ? 1 : 0);
      right = y + eye.r * 0.3 * (eye.side > 0 ? 0 : 1);
    }
    ink.stroke([[eye.x - half, left], [eye.x + half, right]], {
      color: ink0, width: 0.012, jitter: 0.008
    });
  }
}

// 안경알 반지름 = 눈 반지름 × 배율. spec.js가 두 알이 겹치는지 판정할 때도 같은 값을 쓴다.
export const LENS_SCALE = { glasses: 1.45, goggles: 1.75 };

export function drawEyewear(ink, fills, spec, box, eyes) {
  const kind = spec.parts.eyewear;
  if (kind === "none") return;
  const ink0 = spec.faceInk || spec.palette.ink;

  if (kind === "patch") {
    // 안대는 **물건**이라 늘 검다 — 도깨비의 밝은 얼굴 잉크로 채우면 흰 덩어리가 돼 실수처럼 보인다.
    // 먹빛 머리에서는 밝은 테로 윤곽을 잡아 검은 안대가 읽히게 한다. 끈은 얼굴 잉크(밝은 머리 검정, 먹빛 머리 밝음)
    const eye = eyes.find((e) => e.side === spec.parts.patchSide) || eyes[0];
    const patch = blobPath(eye.x, eye.y, eye.r * 1.5, eye.r * 1.35, { lumps: 3, amount: 0.025, noise: fills.noise, phase: 1.3 });   // 거의 원 — 보일 때도 안 들썩이게 아주 조금만
    fills.fill(patch, spec.palette.ink);
    if (spec.faceInk) ink.outline(patch, { color: spec.faceInk, width: 0.01, passes: 2, jitter: 0.003 });
    // 끈은 머리를 가로지른다
    ink.stroke([[eye.x, eye.y + eye.r * 1.3], [-eye.side * box.headRx, box.headCy + box.headRy * 0.45]], {
      color: ink0, width: 0.009
    });
    return;
  }

  if (kind === "monocle") {
    const eye = eyes[eyes.length - 1];
    ink.outline(blobPath(eye.x, eye.y, eye.r * 1.5, eye.r * 1.5, { lumps: 4, amount: 0.06, noise: null }), {
      color: ink0, width: 0.01
    });
    ink.stroke([[eye.x + eye.r * 1.4, eye.y - eye.r], [eye.x + eye.r * 1.9, eye.y - eye.r * 2.6]], {
      color: ink0, width: 0.008
    });
    return;
  }

  const scale = LENS_SCALE[kind] || 1.45;
  for (const eye of eyes) {
    ink.outline(blobPath(eye.x, eye.y, eye.r * scale, eye.r * scale * 0.92, { lumps: 4, amount: 0.06, noise: null }), {
      color: ink0, width: 0.011
    });
  }
  ink.stroke([[eyes[0].x + eyes[0].r * scale, eyes[0].y], [eyes[1].x - eyes[1].r * scale, eyes[1].y]], {
    color: ink0, width: 0.009
  });
  if (kind === "goggles") {
    for (const eye of eyes) {
      ink.stroke([[eye.x + eye.side * eye.r * scale, eye.y], [eye.side * box.headRx * 1.02, eye.y + 0.02]], {
        color: ink0, width: 0.012
      });
    }
  }
}

// 개 주둥이 치수·색. 코 슬롯이 주둥이의 형태를 정한다 — 같은 슬롯으로 종족별 변형을 얻는다.
// 코(drawNose)와 입(drawMouth·mouth.js)이 같은 치수를 본다 — 입은 주둥이 위, 코 밑에 앉는다.
//   fill 주둥이 색 — 개체마다(wobbleSeed, rng 없음): 밝은 크림 45% · 털색보다 살짝 밝은 톤 30% · **검정 계열**(털색의 0.55배) 25%. 주둥이는 **색만**이고 윤곽선은 없다(색 얼룩)
//   ink  주둥이 **위에 그리는 선**(입)의 색 — 주둥이 휘도로 갈린다(밝으면 검정, 어두우면 밝은 잉크). 코는 물건이라 늘 검정이되 어두운 주둥이에선 밝은 테를 두른다
export function muzzleGeometry(spec, box) {
  const kind = spec.parts.nose;
  const mw = kind === "hook" ? 0.62 : kind === "long" ? 0.68 : kind === "wedge" ? 0.4 : 0.5;
  const mh = kind === "long" ? 0.28 : kind === "wedge" ? 0.3 : 0.36;
  const my = box.headCy - box.headRy * (kind === "long" ? 0.48 : 0.42);
  const nr = kind === "hook" ? 0.05 : kind === "dot" ? 0.032 : 0.04;
  const roll = spec.proportions.wobbleSeed % 100;
  const fill = roll < 45 ? "#f0ebdf" : roll < 75 ? shade(spec.palette.skin, 1.12) : shade(spec.palette.skin, 0.55);
  const dark = luminance(fill) < 120;
  return { my, rx: box.headRx * mw, ry: box.headRy * mh, noseY: my + box.headRy * 0.16, noseR: nr, fill, dark, ink: dark ? "#e9e3d5" : spec.palette.ink };
}

// 코 기준점(사람·고양이·도깨비). 눈이 가운데까지 닿을 만큼 크면(왕눈·외눈) 코가 눈 속에 묻힌다 — (놀라 커진) 눈 아래로 내린다
export function noseY(spec, box, eyes) {
  return Math.min(box.headCy - box.headRy * spec.proportions.noseDrop, eyeFloor(spec, eyes, 0) - 0.008);
}

export function drawNose(ink, fills, spec, box, eyes) {
  if (spec.species === "pup") {
    const m = muzzleGeometry(spec, box);
    // 주둥이(코·입이 묶인 영역)는 **색만** — 윤곽선을 두르지 않는다. 선을 두르면 얼굴에 덧댄 판때기처럼 보인다 (색 얼룩으로 남아야 한다)
    const muzzle = blobPath(0, m.my, m.rx, m.ry, { lumps: 3, amount: 0.1, noise: null });
    fills.fill(muzzle, m.fill);
    const nose = blobPath(0, m.noseY, m.noseR, m.noseR * 0.75, { lumps: 3, amount: 0.15, noise: null });
    fills.fill(nose, spec.palette.ink);   // 코는 물건 — 늘 검정
    if (m.dark) ink.outline(nose, { color: m.ink, width: 0.008 });   // 어두운 주둥이 위에서는 밝은 테로 코를 잡는다 (안대와 같은 규칙)
    return;
  }

  const kind = spec.parts.nose;
  if (kind === "none") return;
  const y = noseY(spec, box, eyes);
  const ink0 = spec.faceInk || spec.palette.ink;

  if (kind === "dot") {
    // 점 코 — **머리에 비례**한다. 고정 크기로 두면 왕머리·넓은 머리에서 콩알보다 작아져 얼굴 돌림 때 사라진다 (전수조사가 잡는다)
    const half = Math.max(0.014, box.headRx * 0.055);
    ink.stroke([[-half, y], [half, y]], { color: ink0, width: Math.max(0.016, box.headRy * 0.06) });
  } else if (kind === "hook") {
    ink.stroke([[0.004, y + 0.07], [0.01, y], [-0.035, y - 0.012]], { color: ink0, width: 0.01 });
  } else if (kind === "wedge") {
    ink.stroke([[-0.03, y - 0.02], [0.006, y + 0.055], [0.032, y - 0.02]], { color: ink0, width: 0.01 });
  } else {
    // long — 이마에서 내려오는 긴 코
    ink.stroke([[0.006, y + 0.14], [0.014, y - 0.03], [-0.03, y - 0.045]], { color: ink0, width: 0.01 });
  }
}

// 코의 아래 끝 — 입 자리의 위 한계. 코가 없으면 (놀라 커진) 눈 밑선이나 머리 중심 조금 아래
export function noseBottomY(spec, box, eyes) {
  const kind = spec.parts.nose;
  if (spec.species === "pup") return muzzleGeometry(spec, box).noseY - muzzleGeometry(spec, box).noseR;
  if (kind === "none") return Math.min(eyeFloor(spec, eyes, 0) - 0.01, box.headCy - box.headRy * 0.04);
  return noseY(spec, box, eyes) - (kind === "long" ? 0.045 : kind === "wedge" ? 0.02 : kind === "hook" ? 0.012 : 0.008);
}

// 사나운 눈(화남) — 눈을 **바꿔 그린다**: 안쪽(코 쪽)이 내려간 굵은 빗금 눈꺼풀 + 그 밑에서 노려보는 점 (＼ ／ 위에 점). 외눈은 수평 눈꺼풀.
// 살아 있는 눈(리그)·정지 눈 둘 다 같은 모양 (scene/rig.js). 좌표는 눈 중심 원점
export function angryEyeSketch(sketch, eye, ink) {
  const r = eye.r;
  const inward = -eye.side;   // 코 쪽 (외눈 0)
  const lid = inward === 0 ? [[-r * 0.95, r * 0.45], [r * 0.95, r * 0.45]] : [[-inward * r * 0.95, r * 0.55], [inward * r * 0.95, r * 0.05]];
  sketch.stroke(lid, { color: ink, width: 0.015, jitter: 0.004 });
  sketch.fill(blobPath(0, -r * 0.3, r * 0.3, r * 0.3, { lumps: 3, amount: 0.12, noise: null }), ink);
}
