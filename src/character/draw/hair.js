// 머리카락 — 21종. 문서: guidelines/character/parts.md § hair
//
// 머리카락은 **세 층**에 나눠 그린다 — layers = { back, crown, front } (전부 잉크 스케치):
//   back  뒷머리 — 머리·얼굴 **뒤**(1.55, 귀 그룹). 머리 실루엣 밖·어깨 위로 보이는 부분만 남는다 (긴 머리·트윈테일·포니테일·큰 덩어리)
//   crown 두피 위 — 머리 잉크 위·얼굴 아래(2.06). 정수리 캡·가시·똥머리·사과머리
//   front 앞머리 — 얼굴 **위**(6.55, 앞머리 그룹 — 얼굴 돌림에 아주 조금만 따라간다). 앞머리·옆머리 커튼. 눈썹(6.6)은 앞머리 위에 그려진다
// 종류마다 그리기 함수 하나 — HAIR 표. 새 머리는 여기 함수를 하나 붙이고 slots.js SLOTS.hair에 이름을 넣는다.
// 함수는 h(문맥)를 받는다: { back, crown, front, spec, box, noise, ink0(머리색), rx, ry, cy(머리 반폭·반높이·중심), shoulder(뒷머리 하한) }

import { blobPath, arcPath } from "../../stroke.js";
import { headShape } from "./layout.js";
import { browLine } from "./head.js";

// 정수리를 덮는 스크리블 캡 — 여러 종류가 같은 모양을 쓴다. depth는 옆으로 내려오는 정도(0.5 = 귀 높이)
const cap = (h, depth, steps, passes, spread, width = 0.01) => {
  const arc = arcPath(0, h.cy, h.rx * 0.98, h.ry * 0.98, Math.PI * (0.5 + depth), Math.PI * (0.5 - depth), steps);
  h.crown.scribble(arc, { color: h.ink0, passes, width, spread });
};

// 뒷머리가 있는 머리(긴 머리·트윈테일·포니테일) — 정수리 캡(crown) + 뒤로 떨어지는 머리(back)
function longHair(h) {
  const { back, ink0, rx, ry, cy, noise, spec, shoulder } = h;
  cap(h, 0.52, 22, 12, ry * 0.24);
  // 긴 생머리 — 머리 뒤에서 어깨까지 세로 획 커튼. 폭은 머리보다 조금 넓다
  const step = 0.013;
  for (let x = -rx * 1.15; x <= rx * 1.15; x += step) {
    const top = cy + ry * 0.7;
    const bottom = shoulder + Math.abs(noise(x * 33 + spec.seed * 0.002)) * 0.05;
    const flare = x * 0.1;
    back.stroke([[x, top], [x + flare * 0.5, (top + bottom) / 2], [x + flare, bottom]], { color: ink0, width: 0.009, jitter: 0.004 });
  }
  // 바깥 윤곽 두 줄
  for (const side of [-1, 1]) back.stroke([[side * rx * 1.15, cy + ry * 0.7], [side * rx * 1.25, cy], [side * rx * 1.28, shoulder]], { color: ink0, width: 0.011, jitter: 0.006 });
}
function twintails(h) {
  const { back, ink0, rx, ry, cy } = h;
  cap(h, 0.52, 22, 12, ry * 0.24);
  // 트윈테일 — 머리 양옆 위쪽에 묶고 뒤로 늘어지는 두 갈래
  for (const side of [-1, 1]) {
    const tx = side * rx * 0.95, ty = cy + ry * 0.35;
    const tail = [[tx, ty], [tx + side * 0.05, ty - 0.06], [tx + side * 0.06, ty - 0.18], [tx + side * 0.04, ty - 0.3]];
    back.scribble(tail, { color: ink0, passes: 12, width: 0.009, spread: 0.028 });
    back.stroke([[tx - side * 0.012, ty + 0.03], [tx + side * 0.03, ty - 0.02]], { color: ink0, width: 0.012 });   // 끈
  }
}
function ponytail(h) {
  const { back, ink0, rx, ry, cy, spec } = h;
  cap(h, 0.52, 22, 12, ry * 0.24);
  // 포니테일 — 정수리 뒤에 하나로 묶어 위로 솟았다 뒤로 늘어진다 (묶은 쪽은 개체별)
  const s = spec.seed % 2 ? 1 : -1;
  const px0 = s * rx * 0.25, py0 = cy + ry * 0.92;
  const tail = [[px0, py0], [px0 + s * 0.06, py0 + 0.06], [px0 + s * 0.13, py0 + 0.02], [px0 + s * 0.15, py0 - 0.14], [px0 + s * 0.11, py0 - 0.3]];
  back.scribble(tail, { color: ink0, passes: 12, width: 0.009, spread: 0.026 });
  back.stroke([[px0 - s * 0.01, py0 - 0.02], [px0 + s * 0.035, py0 + 0.03]], { color: ink0, width: 0.012 });   // 끈
}

// 사과머리 — 정수리 한가운데 작은 뭉치가 사과 꼭지처럼 솟는다. 머리는 매끈, 끈 하나
function apple(h) {
  const { crown, ink0, ry, cy } = h;
  const bx = 0.005, by = cy + ry * 1.0;
  for (let i = 0; i < 4; i += 1) {
    const a = Math.PI * (0.35 + 0.1 * i);
    crown.stroke([[bx, by], [bx + Math.cos(a) * 0.05, by + Math.sin(a) * 0.055 + 0.01]], { color: ink0, width: 0.01 });
  }
  crown.stroke([[bx - 0.018, by - 0.006], [bx + 0.018, by - 0.002]], { color: ink0, width: 0.012 });   // 끈
}

// 가시머리. hedgehog는 정수리 **전면**(윤곽 줄 + 안쪽 줄)에 짧은 가시가 방사형으로 — 고슴도치 등처럼 덩어리로 읽힌다.
// rings: [반지름 배율, 개수, 펼침(π 배), 기본 길이, 길이 변동]
const spiky = (rings, width) => (h) => {
  const { crown, ink0, rx, ry, cy, noise, spec } = h;
  for (const [rad, count, span, len0, lenVar] of rings) {
    for (let i = 0; i < count; i += 1) {
      const t = count === 1 ? 0 : i / (count - 1);
      const angle = Math.PI * (0.5 + span * (t - 0.5));
      const bx = Math.cos(angle) * rx * rad;
      const by = cy + Math.sin(angle) * ry * rad;
      const len = len0 + Math.abs(noise(i * 3.1 + rad * 7 + spec.seed * 0.001)) * lenVar;
      crown.stroke([[bx, by], [bx + Math.cos(angle) * len, by + Math.sin(angle) * len]], { color: ink0, width });
    }
  }
};

// 부피형 — 머리보다 살짝 큰 덩어리가 정수리부터 앞은 **눈썹 선**, 옆은 귀 아래까지 감싼다 (레퍼런스의 두건형·구름형).
// 면을 칠하지 않는다: helmet은 세로 획을 촘촘히(직모), cloud는 스캘럽 윤곽 + 고리 스크리블(곱슬). 눈은 못 덮는다 — 아래 경계가 눈썹 선
const voluminous = (kind) => (h) => {
  const { back, crown, front, ink0, rx, ry, cy, noise, spec, box } = h;
  const brow = browLine(spec, box);
  const shape = headShape(spec);
  const grow = kind === "cloud" ? 1.2 : 1.06;
  const sideBottom = cy - ry * 0.45;   // 옆머리 하한 (귀 아래)
  // 바깥 경계 — 머리 윤곽 모양을 따라 키운 폐곡선의 윗부분(양옆은 sideBottom, 앞쪽 x 안은 brow까지)
  const outer = blobPath(0, cy, rx * grow, ry * grow, { lumps: kind === "cloud" ? 9 : 3, amount: kind === "cloud" ? 0.13 : 0.04, noise: null, square: shape.square, taper: shape.taper });
  // 아래 경계 — 가운데는 눈썹 선, 옆으로 갈수록 **부드럽게** 귀 아래로 (계단이 지면 네모 상자처럼 읽힌다)
  const bottomAt = (x) => {
    const u = Math.abs(x) / rx;
    const k = u <= 0.5 ? 0 : u >= 0.98 ? 1 : (() => { const q = (u - 0.5) / 0.48; return q * q * (3 - 2 * q); })();
    return brow * (1 - k) + sideBottom * k;
  };
  const upper = outer.filter(([x, y]) => y >= bottomAt(x));
  upper.sort((a, b) => Math.atan2(a[1] - cy, a[0]) - Math.atan2(b[1] - cy, b[0]));
  // 바깥 윤곽 — 머리보다 큰 덩어리의 위쪽 호. **뒷머리 층**(머리 뒤) — 머리 실루엣 밖으로 나온 부분만 보인다
  if (kind === "cloud") back.stroke(upper, { color: ink0, width: 0.011, jitter: 0.008 });
  else back.stroke(upper, { color: ink0, width: 0.01, jitter: 0.007 });
  if (kind === "helmet") {
    // 머릿결 — 정수리에서 아래로 떨어지는 획을 촘촘히. 위 경계에서 아래 경계(가운데 눈썹 선 → 옆 귀 아래)까지,
    // 끝은 저마다 들쭉날쭉(끝단에 직선을 긋지 않는다 — 그러면 챙 달린 투구가 된다), 옆으로 갈수록 살짝 바깥으로 벌어진다
    const step = 0.012;
    const topAt = (x) => {
      const u = Math.min(0.999, Math.abs(x) / (rx * grow));
      return cy + ry * grow * Math.pow(1 - Math.pow(u, 2 + shape.square), 1 / (2 + shape.square));
    };
    for (let x = -rx * grow + step * 0.5; x < rx * grow; x += step) {
      const top = topAt(x) - 0.004;
      const jag = (noise(x * 40 + spec.seed * 0.003) * 0.9 + 0.3) * ry * 0.09;   // −0.05ry ~ +0.11ry
      const bottom = bottomAt(x) + jag;
      if (top - bottom < 0.02) continue;
      const fan = x * 0.08;   // 아래로 갈수록 바깥으로
      // 앞(|x| < 0.8rx)은 이마를 덮는 앞머리 → 얼굴 위 층, 옆은 두피 위 층
      const target = Math.abs(x) < rx * 0.8 ? front : crown;
      target.stroke([[x, top], [x + fan * 0.5, (top + bottom) / 2], [x + fan + noise(x * 17) * 0.004, bottom]], { color: ink0, width: 0.009, jitter: 0.003 });
    }
  } else {
    // 구름형 — 안을 고리 스크리블로 채우고(곱슬), 스캘럽 가장자리에 작은 고리들
    const arc = arcPath(0, cy, rx * 1.02, ry * 1.0, Math.PI * 1.04, -Math.PI * 0.04, 24);
    crown.scribble(arc, { color: ink0, passes: 20, width: 0.009, spread: ry * 0.36 });
    for (let i = 0; i < 11; i += 1) {
      const k = i / 10;
      const angle = Math.PI * (1.0 - 1.0 * k);
      const bx = Math.cos(angle) * rx * grow * 0.96;
      const by = cy + Math.sin(angle) * ry * grow * 0.96;
      if (by < bottomAt(bx)) continue;
      const r = 0.03 + noise(i * 4.4 + spec.seed * 0.002) * 0.012;
      back.outline(blobPath(bx, by, r, r, { lumps: 4, amount: 0.25, noise: null }), { color: ink0, width: 0.01, jitter: 0.008 });
    }
  }
};

// 양갈래 — 머리 옆에 묶인 뭉치 두 개 (머리 뒤·귀 뒤) + 정수리 살짝
function pigtails(h) {
  const { back, ink0, rx, ry, cy } = h;
  for (const side of [-1, 1]) {
    const bx = side * rx * 1.02;
    const by = cy + ry * 0.3;
    back.scribble(arcPath(bx, by, 0.045, 0.06, Math.PI * 0.5, Math.PI * 2.5, 12), { color: ink0, passes: 7, width: 0.008, spread: 0.03 });
    back.stroke([[bx - side * 0.02, by + 0.05], [bx + side * 0.01, by + 0.075]], { color: ink0, width: 0.012 });
  }
  // 정수리 살짝 — 캡보다 작은 호(0.9)
  h.crown.scribble(arcPath(0, cy, rx * 0.9, ry * 0.9, Math.PI * 0.72, Math.PI * 0.28, 10), { color: ink0, passes: 5, width: 0.008, spread: ry * 0.12 });
}

// 곱슬 — 정수리를 따라 작은 원 뭉치
function curly(h) {
  const { crown, ink0, rx, ry, cy, noise } = h;
  for (let i = 0; i < 7; i += 1) {
    const k = i / 6;
    const angle = Math.PI * (0.8 - 0.6 * k);
    const bx = Math.cos(angle) * rx * 0.88;
    const by = cy + Math.sin(angle) * ry * 0.92;
    const r = 0.03 + noise(i * 4.4) * 0.012;
    crown.outline(blobPath(bx, by, r, r, { lumps: 4, amount: 0.25, noise: null }), { color: ink0, width: 0.009, jitter: 0.008 });
  }
}

// 몇 가닥 — wisp 일곱, tuft 넷
const strands = (count) => (h) => {
  const { crown, ink0, rx, ry, cy, noise } = h;
  for (let i = 0; i < count; i += 1) {
    const t = i / count;
    const angle = Math.PI * (0.25 + 0.5 * t);
    const bx = Math.cos(angle) * rx * 0.8;
    const by = cy + Math.sin(angle) * ry * 0.9;
    crown.stroke([[bx, by], [bx + noise(i * 5.5) * 0.07, by + 0.09 + t * 0.03]], { color: ink0, width: 0.008 });
  }
};

// 앞머리 — 정수리 스크리블 + 이마를 덮는 촘촘한 세로 획(끝이 들쭉날쭉한 바가지 앞머리). 눈썹 선까지만 —
// 끝단은 눈썹 선(안경·고글 테 위까지만, 모자 챙과 같은 계산). longbob은 옆으로 턱 선까지 내려오는 단발
const fringe = (kind) => (h) => {
  const { front, ink0, rx, ry, cy, noise, spec, box } = h;
  const fringeBottom = browLine(spec, box);
  cap(h, 0.42, 20, 11, ry * 0.2);
  // 이마 띠 — 위아래로 오가는 지그재그를 스크리블로 겹쳐 빽빽한 앞머리 덩어리. 아래 꼭짓점이 들쭉날쭉한 끝단
  const teeth = 8;
  const zig = [];
  for (let i = 0; i <= teeth * 2; i += 1) {
    const t = (i / (teeth * 2)) * 2 - 1;
    const x = t * rx * 0.74;
    const top = cy + ry * (0.78 - t * t * 0.14);
    const bottom = fringeBottom + Math.abs(noise(i * 2.7 + spec.seed * 0.002)) * ry * 0.09;
    zig.push([x, i % 2 === 0 ? top : bottom]);
  }
  front.scribble(zig, { color: ink0, passes: 6, width: 0.01, spread: 0.014 });   // 앞머리 — 얼굴 위
  if (kind === "longbob") {
    // 옆으로 턱 선까지 내려오는 단발 — 얼굴 양옆을 감싸는 굵은 세로 스크리블 (앞머리 층 — 볼·귀 위)
    for (const side of [-1, 1]) {
      const x = side * rx * 0.9;
      const col = [[x - side * 0.03, cy + ry * 0.62], [x + side * 0.02, cy + ry * 0.1], [x + side * 0.03, cy - ry * 0.7]];
      front.scribble(col, { color: ink0, passes: 14, width: 0.01, spread: 0.045 });
    }
  }
};

// 똥머리 — 정수리를 얇게 덮고 위에 뭉치 하나 + 비녀 획
function bun(h) {
  const { crown, ink0, ry, cy } = h;
  cap(h, 0.32, 16, 7, ry * 0.14, 0.009);
  const bx = 0.01, by = cy + ry * 1.05;
  crown.scribble(arcPath(bx, by, 0.045, 0.04, 0, Math.PI * 2, 14), { color: ink0, passes: 8, width: 0.009, spread: 0.028 });
  crown.outline(blobPath(bx, by, 0.048, 0.042, { lumps: 4, amount: 0.15, noise: null }), { color: ink0, width: 0.01 });
  crown.stroke([[bx - 0.07, by + 0.02], [bx + 0.06, by - 0.01]], { color: ink0, width: 0.008 });
}

// bob / mop / scribble / sweep — 두피를 덮는 스크리블. 레퍼런스처럼 **부피**가 있어야 한다: 호를 머리 옆면(귀 높이, depth 0.6)까지
// 내리고 스크리블을 넓게 편다. 옆으로 내려간 끝은 귀를 덮지 눈까지 오지 않고(눈은 x ±0.4rx 안), 정수리 쪽 퍼짐은 눈썹 선 위다.
// depth 옆으로 내려오는 정도 · passes 왕복 수 · spread 퍼짐(ry 배) · width 획 굵기 · backCap 머리 뒤에 한 겹 더(실루엣 밖 부피)
const mopCap = ({ depth, passes, spread, width = 0.01, backCap = true }) => (h) => {
  const { back, ink0, rx, ry, cy } = h;
  cap(h, depth, 22, passes, ry * spread, width);
  // 뒷머리 — 머리보다 조금 큰 호를 머리 **뒤**에 한 겹 더 (실루엣 밖으로 삐져나오는 부피). sweep은 없음
  if (backCap) {
    const arc = arcPath(0, cy, rx * 1.1, ry * 1.08, Math.PI * (0.5 + depth + 0.05), Math.PI * (0.5 - depth - 0.05), 22);
    back.scribble(arc, { color: ink0, passes: 8, width: 0.009, spread: ry * 0.16 });
  }
};

// 종류 → 그리기 함수. slots.js SLOTS.hair의 이름과 1:1 (none은 없음)
export const HAIR = {
  bob: mopCap({ depth: 0.56, passes: 14, spread: 0.26 }),
  mop: mopCap({ depth: 0.62, passes: 20, spread: 0.3 }),
  scribble: mopCap({ depth: 0.6, passes: 22, spread: 0.26, width: 0.008 }),
  sweep: mopCap({ depth: 0.4, passes: 14, spread: 0.18, backCap: false }),
  spikes: spiky([[0.95, 11, 0.95, 0.06, 0.09]], 0.012),
  mohawk: spiky([[0.95, 7, 0.35, 0.06, 0.09]], 0.012),
  hedgehog: spiky([[0.96, 15, 0.9, 0.05, 0.07], [0.74, 10, 0.72, 0.045, 0.05]], 0.011),
  tuft: strands(4),
  wisp: strands(7),
  pigtails,
  curly,
  bangs: fringe("bangs"),
  longbob: fringe("longbob"),
  bun,
  helmet: voluminous("helmet"),
  cloud: voluminous("cloud"),
  long: longHair,
  twintails,
  ponytail,
  apple
};

export function drawHair(layers, spec, box, noise) {
  const kind = spec.parts.hair;
  const draw = HAIR[kind];
  if (!draw) return;   // none (또는 모르는 값)
  const pop = spec.palette.pop;
  draw({
    ...layers,
    spec, box, noise,
    ink0: pop && pop.target === "hair" ? pop.color : spec.palette.ink,
    rx: box.headRx, ry: box.headRy, cy: box.headCy,
    shoulder: box.bodyTop - 0.02   // 뒷머리가 내려오는 하한 (어깨)
  });
}
