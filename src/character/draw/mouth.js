// 입 — 19종. 문서: guidelines/character/parts.md § mouth
// 종류마다 그리기 함수 하나 — MOUTH 표. 새 입은 여기 함수를 하나 붙이고 slots.js SLOTS.mouth에 이름을 넣는다.
// 함수는 m(문맥)을 받는다: { ink, fills, spec, box, x·y(입 중심), w(반폭), openH(벌린 높이), ink0(입 잉크 — 얼굴 잉크), edge(흰 이빨 위의 테·줄 — 팔레트 잉크, 늘 어둡다) }
// 자리·폭·잉크는 mouthPlacement가 정한다 — 종족(개는 주둥이 위)·mouthPos·mouthSize·개체 지터를 여기서 한 번에 푼다.
// 상태 전환(쉼·대체·화남·^^)의 종류 표는 faceStates.js.

import { blobPath, arcPath } from "../../stroke.js";
import { TAU, eyeGeometry } from "./layout.js";
import { eyeFloor, noseBottomY, muzzleGeometry } from "./face.js";

// 입 폭 배율 — mouthSize 슬롯(늦은 슬롯). 레퍼런스는 아주 작은 입과 아주 넓은 입이 극단적으로 갈린다
export const MOUTH_SIZE = { small: 0.7, normal: 1, wide: 1.4 };
// 종족 폭 배율 — 도깨비 입은 얼굴 폭의 절반을 넘게 넓다 (레퍼런스)
const SPECIES_WIDTH = { imp: 1.3 };
const TOOTH = "#f6f2e9";   // 이빨·격자 채움 — 흰자와 같은 종이빛 흰색
const PINK = "#d9968a";    // 혀 — 볼터치와 같은 분홍

// 입 자리·폭·잉크. 종족·슬롯·비율에서 한 번에 푼다
export function mouthPlacement(spec, box) {
  const eyes = eyeGeometry(spec, box);
  // 입 자리 — 코 밑(noseBottomY)부터 턱 위(headCy − 0.86·ry)까지 사이에서 mouthPos로: high 0.22 · mid 0.5 · low 0.76.
  // 그리고 (놀라 커진) 눈 아래 — 외눈·왕눈의 흰자 위에 얹히면 사라진다
  const top = noseBottomY(spec, box, eyes) - 0.006;
  const chin = box.headCy - box.headRy * 0.86;
  const tPos = spec.parts.mouthPos === "high" ? 0.22 : spec.parts.mouthPos === "low" ? 0.76 : 0.5;
  let y = Math.min(top + (chin - top) * tPos, eyeFloor(spec, eyes, 0) - 0.03);
  // 개 입은 **주둥이 위**에 앉으니 잉크도 주둥이 휘도로 갈린다(밝은 주둥이면 검정, 검정 주둥이면 밝은 잉크) — 얼굴(머리색) 잉크와 별개다
  const ink0 = spec.species === "pup" ? muzzleGeometry(spec, box).ink : (spec.faceInk || spec.palette.ink);
  let w = box.headRx * 0.38 * (MOUTH_SIZE[spec.parts.mouthSize] || 1) * (SPECIES_WIDTH[spec.species] || 1);
  // 벌린 입의 높이 — 머리에 비례하고, 코 밑에서 끝난다 (코를 삼키면 코가 사라진다)
  const noseBottom = spec.species === "pup" || spec.parts.nose === "none" ? Infinity : top;
  const openH = Math.max(0.018, Math.min(0.05, box.headRy * 0.22, noseBottom - 0.008 - y));
  // 자리 지터 — 두발의 입은 살짝 옆으로 비껴 있기도 하다(레퍼런스). 개체 wobbleSeed로 ±0.1rx, rng 없음. 네발은 코 밑 가운데
  let x = box.quad ? 0 : ((spec.proportions.wobbleSeed % 11) / 10 - 0.5) * 0.2 * box.headRx;
  if (spec.species === "pup") {
    // 개는 입이 주둥이 위, 코 밑에 — 얼굴 비율(mouthDrop)이 아니라 주둥이 치수를 따른다. 코 덩어리에 겹치면 안 보인다
    const m = muzzleGeometry(spec, box);
    y = m.my - box.headRy * 0.12;
    w = Math.min(w, m.rx * 0.72);
  }
  // 흰 채움(이빨 격자·씨익·송곳니) 위의 테·줄은 **팔레트 잉크(어두움)** — 도깨비의 밝은 얼굴 잉크로 그으면 흰 바탕에 묻혀 빈 흰 막대만 남는다(실수처럼 보인다)
  return { x, y, w, openH, ink0, edge: spec.palette.ink };
}

// ── 벌린 입 공통 ──
// 입안은 늘 **어두운 잉크(팔레트 잉크)**, 테는 얼굴 잉크 — 밝은 얼굴에선 입안과 같은 색이라 묻히고, 어두운 얼굴에선 밝은 테가 입 모양을 잡는다.
// 밝은 얼굴 잉크로 입안을 채우면 도깨비 얼굴에 빈 밝은 덩어리만 남는다(실수처럼 보인다). 이빨은 흰 띠 + 어두운 줄(edge)
function cavity(m, pts) {
  m.fills.fill(pts, m.spec.palette.ink);
  m.ink.stroke([...pts, pts[0]], { color: m.ink0, width: 0.01 });
}
// 이빨 띠 — 위(dir −1: 윗입술에서 아래로) 또는 아래(dir +1)로 h만큼. 세로 줄로 이를 나눈다
function teethStrip(m, x0, x1, edgeY, h, dir, count) {
  const inner = edgeY + dir * h;
  m.fills.fill([[x0, edgeY], [x1, edgeY], [x1, inner], [x0, inner]], TOOTH);
  m.ink.stroke([[x0, inner], [x1, inner]], { color: m.edge, width: 0.006 });
  for (let i = 1; i < count; i += 1) {
    const x = x0 + ((x1 - x0) * i) / count;
    m.ink.stroke([[x, edgeY], [x + 0.001, inner]], { color: m.edge, width: 0.006 });
  }
}
// 벌린 입 — 동그란 구멍이 아니라 **윗입술은 곧고 아래만 둥근 그릇**(D를 눕힌 꼴). 입안 + 윗니 띠 + 윗입술 선
function bowl(m, hw, depth, teeth = true) {
  const top = m.y + m.openH * 0.35, bottom = m.y - m.openH * depth;
  const pts = [];
  for (let i = 0; i <= 14; i += 1) {
    const t = (i / 14) * Math.PI;
    pts.push([m.x - hw * Math.cos(t), top - (top - bottom) * Math.sin(t)]);
  }
  cavity(m, pts);
  if (teeth) teethStrip(m, m.x - hw * 0.72, m.x + hw * 0.72, top, Math.max(0.008, Math.min(0.016, (top - bottom) * 0.35)), -1, 4);
  m.ink.stroke([[m.x - hw * 1.05, top + 0.003], [m.x + hw * 1.05, top]], { color: m.ink0, width: 0.012 });   // 윗입술
  return { top, bottom };
}
// 이빨 격자 — 넓고 납작한 둥근 네모(흰 채움 + 윤곽) 안에 세로 줄. 레퍼런스의 대표 입(그르르·긴장·도깨비 벌린 입)
function grid(m, hw, hh, bars) {
  const box = blobPath(m.x, m.y, hw, hh, { lumps: 3, amount: 0.04, noise: null, square: 2 });
  m.fills.fill(box, TOOTH);
  m.ink.outline(box, { color: m.edge, width: 0.011 });
  for (let i = 1; i <= bars; i += 1) {
    const x = m.x - hw + (2 * hw * i) / (bars + 1);
    m.ink.stroke([[x, m.y + hh * 0.9], [x + 0.001, m.y - hh * 0.9]], { color: m.edge, width: 0.008 });
  }
}
// 혀 — 입 아래로 늘어진 분홍 덩어리 + 가운데 줄
function tongueBlob(m, cx, top, rx, ry) {
  const t = blobPath(cx, top - ry, rx, ry, { lumps: 3, amount: 0.1, noise: null });
  m.fills.fill(t, PINK);
  m.ink.outline(t, { color: m.ink0, width: 0.008 });
  m.ink.stroke([[cx, top - ry * 0.3], [cx + 0.001, top - ry * 1.6]], { color: m.ink0, width: 0.006 });
}
// 송곳니 둘 — 입선 아래로 **큰** 흰 세모(윤곽). 이빨은 크게 보여야 한다
function fangs(m, hw, drop) {
  const half = Math.max(0.011, Math.min(0.016, drop * 0.4));
  for (const s of [-1, 1]) {
    const fx = m.x + s * hw * 0.55;
    const tri = [[fx - half, m.y + 0.002], [fx + half, m.y + 0.002], [fx + s * 0.003, m.y - drop]];
    m.fills.fill(tri, TOOTH);
    m.ink.outline(tri, { color: m.edge, width: 0.008 });
  }
}

// 종류 → 그리기 함수. slots.js SLOTS.mouth의 이름과 1:1
export const MOUTH = {
  // 점 입 — 짧은 획은 끝 가늘어짐 때문에 얇아지니 살짝 길고 굵게 (콩알 하나로 읽혀야 한다)
  dot: (m) => m.ink.stroke([[m.x - 0.015, m.y], [m.x + 0.015, m.y]], { color: m.ink0, width: 0.017 }),
  line: (m) => m.ink.stroke([[m.x - m.w, m.y], [m.x + m.w, m.y + 0.004]], { color: m.ink0, width: 0.011 }),
  smile: (m) => m.ink.stroke(arcPath(m.x, m.y + 0.03, m.w, 0.045, Math.PI, TAU), { color: m.ink0, width: 0.011 }),
  // 처진 입 ⌢ — 웃음의 반대. 작게
  frown: (m) => m.ink.stroke(arcPath(m.x, m.y - 0.026, m.w * 0.75, 0.036, 0, Math.PI), { color: m.ink0, width: 0.011 }),
  wave: (m) => m.ink.stroke([[m.x - m.w, m.y], [m.x - m.w * 0.3, m.y + 0.03], [m.x + m.w * 0.3, m.y - 0.02], [m.x + m.w, m.y + 0.015]], { color: m.ink0, width: 0.011 }),
  open: (m) => { bowl(m, m.w * 0.85, 0.95); },
  // 오리입 — 놀란 작은 o
  pout: (m) => m.ink.outline(blobPath(m.x, m.y, 0.022, 0.017, { lumps: 3, amount: 0.15, noise: null }), { color: m.ink0, width: 0.011 }),
  // ω — 고양이 입 (두 호가 아래로 볼록)
  omega: (m) => {
    m.ink.stroke(arcPath(m.x - m.w * 0.35, m.y + 0.012, m.w * 0.38, 0.028, Math.PI, TAU), { color: m.ink0, width: 0.01 });
    m.ink.stroke(arcPath(m.x + m.w * 0.35, m.y + 0.012, m.w * 0.38, 0.028, Math.PI, TAU), { color: m.ink0, width: 0.01 });
  },
  // 3 — 오므린 작은 입(카오모지 3). ω를 반으로 줄이고 굵게 — 고양이·귀여운 사람
  three: (m) => {
    const hw = Math.max(0.012, m.w * 0.22);
    m.ink.stroke(arcPath(m.x - hw * 0.9, m.y + 0.006, hw, 0.014, Math.PI, TAU), { color: m.ink0, width: 0.012 });
    m.ink.stroke(arcPath(m.x + hw * 0.9, m.y + 0.006, hw, 0.014, Math.PI, TAU), { color: m.ink0, width: 0.012 });
  },
  zigzag: (m) => {
    const zig = [];
    for (let i = 0; i <= 6; i += 1) zig.push([m.x - m.w + (2 * m.w * i) / 6, m.y + (i % 2 ? -0.016 : 0.012)]);
    m.ink.stroke(zig, { color: m.ink0, width: 0.011 });
  },
  // 이빨 격자 — 넓은 그리메이스 (레퍼런스 사람 6번째·도깨비). 격자 수는 폭에 비례, 이는 크게
  grimace: (m) => grid(m, m.w * 1.15, Math.max(0.014, Math.min(0.026, m.openH * 0.55)), Math.max(3, Math.min(6, Math.round(m.w * 1.15 / 0.022)))),
  // 씨익 — 넓은 웃음 호 안에 이빨(흰 채움 + 세로 줄 둘) + 윗선
  grin: (m) => {
    const hw = m.w * 1.05, top = m.y + 0.004, depth = Math.max(0.016, Math.min(0.03, m.openH * 0.7));
    const seg = [];
    for (let i = 0; i <= 12; i += 1) { const t = (i / 12) * Math.PI; seg.push([m.x - hw * Math.cos(t), top - depth * Math.sin(t)]); }
    m.fills.fill(seg, TOOTH);
    m.ink.stroke(seg, { color: m.edge, width: 0.011 });
    m.ink.stroke([[m.x - hw, top], [m.x + hw, top + 0.002]], { color: m.edge, width: 0.01 });
    for (const k of [-0.33, 0.33]) m.ink.stroke([[m.x + hw * k, top], [m.x + hw * k + 0.001, top - depth * 0.7]], { color: m.edge, width: 0.007 });
  },
  // 해칭 입 — 입 자리를 가로 빗금 뭉치로 덮는다 (레퍼런스 사람 2줄 4번째·도깨비). 이를 악문 것 같기도, 수염 같기도
  scribble: (m) => m.ink.hatch(m.x, m.y, m.w * 0.9, Math.max(0.012, Math.min(0.02, m.openH * 0.45)), 0.08, { color: m.ink0, lines: 5, width: 0.007 }),
  // 혀 — 살짝 벌린 입(작은 그릇, 이빨 없이) 아래로 혀가 늘어진다. 개는 헥헥(^^ 대체 입), 도깨비는 메롱
  tongue: (m) => {
    const b = bowl(m, m.w * 0.7, 0.55, false);
    tongueBlob(m, m.x + m.w * 0.12, b.bottom + m.openH * 0.15, Math.max(0.012, m.w * 0.32), Math.max(0.014, m.openH * 0.6));
  },
  // 송곳니 — 입선 + 양끝 아래로 큰 흰 송곳니 둘 (도깨비 · 고양이 하악)
  fangs: (m) => {
    m.ink.stroke([[m.x - m.w, m.y + 0.002], [m.x + m.w, m.y - 0.002]], { color: m.ink0, width: 0.011 });
    fangs(m, m.w, Math.max(0.022, Math.min(0.04, m.openH * 0.9)));
  },
  // 네모 벌림 □ — 소리치는 입(레퍼런스 도깨비): 각진 큰 입안에 **위아래 이빨 띠**. 윗입술 곧게
  shout: (m) => {
    const hw = m.w * 0.8, top = m.y + m.openH * 0.4, bottom = m.y - m.openH * 1.1;
    const sq = blobPath(m.x, (top + bottom) / 2, hw, (top - bottom) / 2, { lumps: 3, amount: 0.05, noise: null, square: 2.2 });
    cavity(m, sq);
    const h = Math.max(0.01, Math.min(0.02, (top - bottom) * 0.3));
    teethStrip(m, m.x - hw * 0.85, m.x + hw * 0.85, top - 0.002, h, -1, 5);
    teethStrip(m, m.x - hw * 0.7, m.x + hw * 0.7, bottom + 0.002, h * 0.8, 1, 4);
    m.ink.stroke([[m.x - hw * 1.08, top + 0.003], [m.x + hw * 1.08, top]], { color: m.ink0, width: 0.012 });
  },
  // 야옹 — 작은 세로 타원 채움 (고양이 벌린 입)
  meow: (m) => m.fills.fill(blobPath(m.x, m.y - 0.004, 0.013, Math.max(0.016, Math.min(0.024, m.openH * 0.55)), { lumps: 3, amount: 0.12, noise: null }), m.ink0),
  // 괄호 입 )-( — 짧은 일자 입 양끝에 안으로 볼록한 볼 주름 괄호. 어드벤처 타임 식 "흠…"(입 다물고 볼이 눌린 얼굴)
  bracket: (m) => {
    const hw = m.w * 0.55, bh = Math.max(0.012, Math.min(0.02, m.openH * 0.45));
    m.ink.stroke([[m.x - hw, m.y], [m.x + hw, m.y + 0.002]], { color: m.ink0, width: 0.011 });
    for (const s of [-1, 1]) {
      // ) 와 ( — 볼록한 쪽이 입 쪽을 향한다
      const cx = m.x + s * (hw + 0.012);
      m.ink.stroke(arcPath(cx, m.y, 0.009, bh, s > 0 ? Math.PI * 0.5 : -Math.PI * 0.5, s > 0 ? Math.PI * 1.5 : Math.PI * 0.5, 8), { color: m.ink0, width: 0.01 });
    }
  },
  // 혀 빼꼼 blep — ω 밑으로 혀 끝만 (고양이)
  blep: (m) => {
    MOUTH.omega(m);
    const t = blobPath(m.x, m.y - 0.012, 0.011, 0.012, { lumps: 3, amount: 0.1, noise: null });
    m.fills.fill(t, PINK);
    m.ink.outline(t, { color: m.ink0, width: 0.006 });
  }
};

export function drawMouth(ink, fills, spec, box, kindOverride) {
  const kind = kindOverride || spec.parts.mouth;
  const draw = MOUTH[kind] || MOUTH.line;
  draw({ ink, fills, spec, box, ...mouthPlacement(spec, box) });
}
