// 머리 — 윤곽·귀·머리카락·모자·뿔. 문서: guidelines/character/parts.md § 머리

import { blobPath, arcPath } from "../../stroke.js";
import { TAU, headShape, darken, isDark, eyeGeometry } from "./layout.js";
import { LENS_SCALE } from "./face.js";

export function drawHead(ink, fills, spec, box, noise) {
  const p = spec.proportions;
  const shape = headShape(spec);
  const path = blobPath(0, box.headCy, box.headRx, box.headRy, {
    lumps: p.headLumps,
    amount: p.headLump,
    noise,
    phase: p.wobbleSeed * 0.01,
    square: shape.square,
    taper: shape.taper
  });

  fills.fill(path, spec.palette.skin, spec.palette.fillOffset);

  // 연필 스크리블. 플랫 채색 위를 같은 계열 어두운 톤의 지그재그 한 획으로
  // 덮어 획 방향을 남긴다. 도깨비는 먹빛 위에 살짝 밝은 톤으로 긁는다.
  const scribbleAngle = Math.PI * (0.14 + noise(p.wobbleSeed * 0.03) * 0.22);
  if (isDark(spec.palette.skin)) {
    fills.scribbleFill(0.01, box.headCy, box.headRx * 0.82, box.headRy * 0.8, {
      color: darken(spec.palette.skin, 1.5), angle: scribbleAngle, gap: 0.03, width: 0.006
    });
  } else {
    fills.scribbleFill(0.01, box.headCy, box.headRx * 0.8, box.headRy * 0.76, {
      color: darken(spec.palette.skin, 0.9), angle: scribbleAngle, gap: 0.034, width: 0.007
    });
  }

  ink.outline(path, { color: spec.palette.ink, width: 0.014, jitter: 0.008, passes: 2 });
  return path;
}

// 귀 크기 배율. Mid·Big는 모양은 같고 길이·폭만 크다. earKind()가 값을 기본 모양으로 돌린다
const EAR_SIZE = { round: 1, roundMid: 1.4, roundBig: 1.8, pointy: 1, pointyMid: 1.4, pointyBig: 1.85, fold: 1, foldMid: 1.4, foldBig: 1.8 };
const earKind = (value) => value.replace(/(Mid|Big)$/, "");

export function drawEars(ink, fills, spec, box) {
  const kind = earKind(spec.parts.ears);
  const size = EAR_SIZE[spec.parts.ears] || 1;
  if (kind === "none") return;
  // 개 귀는 머리 뒤가 아니라 **머리 위에** 그린다 (drawPupEars, 머리 다음) — 안쪽으로 기운 귀가 얼굴에 가려지지 않게
  if (spec.species === "pup") return;
  if (spec.species === "cat") return;   // 고양이 귀는 머리 앞 층 (drawCatEars) — 채운 세모 혹이라 머리 위에 얹혀야 한다

  const y = box.headCy - box.headRy * 0.05;

  for (const side of [-1, 1]) {
    const x = side * box.headRx * 0.98;
    if (kind === "round") {
      ink.outline(blobPath(x, y, 0.035 * size, 0.045 * size, { lumps: 3, amount: 0.15, noise: null }), {
        color: spec.palette.ink, width: 0.011
      });
    } else if (kind === "pointy") {
      // 옆으로 뾰족한 귀 — 크기 배율(pointyMid·pointyBig)로 길고 넓어진다
      ink.stroke([[x - 0.01, y + 0.05 * size], [x + side * 0.075 * size, y + 0.02], [x - 0.01, y - 0.05 * size]], {
        color: spec.palette.ink, width: 0.011
      });
    } else if (kind === "long") {
      // 늘어진 긴 귀 — 개가 아니어도 달 수 있다
      const lobe = blobPath(x + side * 0.012, y - box.headRy * 0.32, 0.035, box.headRy * 0.45, {
        lumps: 3, amount: 0.12, noise: null
      });
      ink.outline(lobe, { color: spec.palette.ink, width: 0.01, passes: 2 });
    } else if (kind === "fold") {
      // 접힌 귀 — 끝이 꺾인다 (크기 배율)
      ink.stroke([
        [x - side * 0.01, y + 0.04 * size],
        [x + side * 0.055 * size, y + 0.055 * size],
        [x + side * 0.05 * size, y - 0.01 * size],
        [x + side * 0.015 * size, y - 0.03 * size]
      ], { color: spec.palette.ink, width: 0.011 });
    } else {
      // flap — 아래로 늘어진 귀
      ink.stroke(arcPath(x, y, 0.05, 0.09, -Math.PI * 0.6, Math.PI * 0.6), {
        color: spec.palette.ink, width: 0.011
      });
    }
  }
}

// 고양이 귀 — 머리 실루엣의 **혹**. 정수리 양쪽 모서리(정수리에서 ~35°)에 채운 세모를 세우고 밑변은 윤곽 안으로 넣어
// 머리와 한 덩어리로 붙인다(레퍼런스: 윤곽선이 귀 안으로 이어지고 채색된 머리는 귀도 같은 색). 윤곽은 머리와 같은 굵기·2회.
// 머리 앞 층(front)에 그려 채움이 머리 윤곽선을 덮는다. 세 비율 — pointy 기본 · pointyMid 좁고 긴 · pointyBig 넓고 큰.
// 안쪽 귀는 개체마다: 60%는 안쪽 작은 세모(이중선), 15%는 어둡게 채움, 나머지 없음(술은 부엉이처럼 보여 뺐다).
// 붙는 자리의 **법선**을 따른다: 밑변은 그 자리의 윤곽 접선을 따라 앉히고(안쪽으로 0.02), 귀 축은 법선과 수직의 중간
// (법선 기울기의 절반 + 좌우 살짝 다르게) — 둥근 머리에선 자연히 벌어지고 납작한 머리에선 곧게 선다. 끝은 살짝 뭉툭.
// 네모 머리(square·block)는 모서리에 앉으면 상자에 뿔이 되니 조금 안쪽(θ 0.52)에 세운다.
// round·fold·flap·long은 고양이에게 없다(species forbid → pointy).
//   pointy    기본 세모 — 옆선 살짝 오목(손그림 귀), 끝 뭉툭
//   pointyMid 좁고 긴 세모 — 더 벌어진다(+0.15rad, 레퍼런스의 긴 귀는 30°쯤 벌어짐)
//   pointyBig 넓고 낮은 귀 — 끝이 둥글고 옆선이 볼록(채색된 갈색·회색 고양이 귀)
// 안쪽 귀는 개체마다: 이중선 50% · 먹 채움 15% · 홈 한 획 15% · 없음 20%.
const CAT_EAR = {
  pointy: { w: 0.05, h: 0.1, theta: 0.6, lean: 0, tip: 0.006, bow: -0.12 },
  pointyMid: { w: 0.04, h: 0.14, theta: 0.55, lean: 0.15, tip: 0.005, bow: -0.1 },
  pointyBig: { w: 0.062, h: 0.11, theta: 0.6, lean: -0.02, tip: 0.016, bow: 0.12 }
};
export function drawCatEars(ink, fills, spec, box) {
  if (spec.species !== "cat") return;
  const value = spec.parts.ears;
  if (value === "none") return;
  const def = CAT_EAR[value] || CAT_EAR.pointy;
  const rx = box.headRx, ry = box.headRy, cy = box.headCy;
  const ink0 = spec.palette.ink;
  const skin = spec.palette.skin;
  const seed = spec.proportions.wobbleSeed;
  const roll = seed % 100;
  const inner = roll < 50 ? "line" : roll < 65 ? "dark" : roll < 80 ? "notch" : "none";
  const boxy = headShape(spec).square >= 1.4;   // square·block — 모서리보다 조금 안쪽에
  const theta = boxy ? Math.min(def.theta, 0.52) : def.theta;
  for (const side of [-1, 1]) {
    // 윤곽 위 뿌리와 그 자리의 바깥 법선 n·접선 t (바깥 양수)
    const bx = side * rx * Math.sin(theta);
    const by = cy + ry * Math.cos(theta);
    let nx = side * Math.sin(theta) / rx, ny = Math.cos(theta) / ry;
    const nl = Math.hypot(nx, ny); nx /= nl; ny /= nl;
    const tx = side * ny, ty = -side * nx;
    // 귀 축 — 법선 기울기의 절반 + 유형별 벌어짐 + 개체별 좌우 차이. 둥근 머리는 벌어지고 납작한 머리는 곧게 선다
    const normalTilt = Math.atan2(nx * side, ny);
    const lean = normalTilt * 0.5 + 0.02 + def.lean + ((seed >> (side > 0 ? 3 : 5)) % 3) * 0.02;
    const ax = side * Math.sin(lean), ay = Math.cos(lean);
    // 밑변은 접선을 따라(윤곽에 붙게) 안쪽으로 inset. 끝은 축을 따라 h, 폭 tip. 옆선은 중간을 bow만큼 안(−)/밖(+)으로 휜다
    const baseAt = (v, inset) => [bx + tx * v - nx * inset, by + ty * v - ny * inset];
    const tipAt = (v) => [bx + ax * def.h + tx * v, by + ay * def.h + ty * v];
    const sideAt = (v0, v1, k) => {   // 밑변 v0 → 끝 v1 사이 k(0~1) 지점, 옆선 휨 포함
      const [x0, y0] = baseAt(v0, 0);
      const [x1, y1] = tipAt(v1);
      const bow = def.bow * def.w * Math.sin(Math.PI * k) * Math.sign(v0);
      return [x0 + (x1 - x0) * k + tx * bow, y0 + (y1 - y0) * k + ty * bow];
    };
    const path = [
      baseAt(-def.w, 0.02), sideAt(-def.w, -def.tip, 0.5), tipAt(-def.tip), tipAt(def.tip), sideAt(def.w, def.tip, 0.5), baseAt(def.w, 0.02)
    ];
    fills.fill(path, skin);
    ink.stroke([
      baseAt(-def.w * 1.02, 0.024), sideAt(-def.w, -def.tip, 0.5), tipAt(-def.tip), tipAt(def.tip), sideAt(def.w, def.tip, 0.5), baseAt(def.w * 1.02, 0.024)
    ], { color: ink0, width: 0.014, passes: 2, step: 0.008 });
    // 안쪽 귀
    const innerTip = [bx + ax * def.h * 0.62, by + ay * def.h * 0.62];
    if (inner === "line") ink.stroke([baseAt(-def.w * 0.5, -0.012), innerTip, baseAt(def.w * 0.5, -0.012)], { color: ink0, width: 0.008 });
    else if (inner === "dark") fills.fill([baseAt(-def.w * 0.5, -0.012), innerTip, baseAt(def.w * 0.5, -0.012)], darken(skin, isDark(skin) ? 1.5 : 0.62));
    else if (inner === "notch") ink.stroke([[bx + ax * 0.012 + tx * def.w * 0.1, by + ay * 0.012 + ty * def.w * 0.1], [bx + ax * def.h * 0.5, by + ay * def.h * 0.5]], { color: ink0, width: 0.008 });
  }
}

// 개 귀 — 머리(채색·윤곽) **위에** 그린다. 안쪽으로 기운 귀라 머리 뒤에 그리면 얼굴에 묻힌다.
export function drawPupEars(ink, fills, spec, box) {
  if (spec.species !== "pup") return;   // 개만. (빠지면 모든 종족 머리에 개 귀가 얹혀 뿔처럼 보인다)
  const kind = earKind(spec.parts.ears);
  const size = EAR_SIZE[spec.parts.ears] || 1;
  if (kind === "none") return;
  // 개 귀 — 종류마다 다르다. 뿌리는 **머리 윤곽 위** 두 자리 중 하나고, 귀는 그 자리의 법선을 **반대 기울기로** 탄다
  // (법선을 수직에 대해 거울상으로 뒤집은 축 — 바깥으로 벌어지지 않고 안쪽으로 모인다):
  //   위쪽 모서리(정수리보다 좀 밑, θ≈50°) — pointy 쫑긋 세모귀 · round 동그란 귀 · fold 접힌 귀. 위·안쪽으로 기울어 선다
  //   옆구리(눈 양옆보다 조금 옆, θ≈88°) — flap 로브(레퍼런스 비글) · long 바셋. 늘어지되 끝이 얼굴 쪽으로 모인다
  // θ는 타원(headRx·headRy) 위 극각(정수리에서 잰 각). 채운 로브 + 두 번 덧그은 윤곽. none은 없음.
  const earFill = darken(spec.palette.skin, 0.8);
  const earInk = { color: spec.palette.ink, width: 0.011, passes: 2 };
  const upper = kind === "pointy" || kind === "round" || kind === "fold";
  const theta = upper ? 0.88 : 1.53;
  const rx = box.headRx, ry = box.headRy;
  // 점 목록을 (cx, cy) 기준으로 angle만큼 돌린다 (반시계 양수)
  const rotate = (pts, cx, cy, angle) => {
    const c = Math.cos(angle), s = Math.sin(angle);
    return pts.map(([x, y]) => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c]);
  };
  for (const side of [-1, 1]) {
    // 윤곽 위 자리와 바깥 법선 n, 접선 t(정수리 쪽 +). 뿌리는 거기서 법선으로 OUT만큼 **밖에** 둔다 —
    // 귀 몸통이 머리 밖 종이 위에 놓여야 보인다 (머리 위에 겹치면 채색이 비슷해 묻힌다).
    // 세모귀·접힌 귀는 밑변을 윤곽까지(u = −OUT) 끌어와 머리에 박힌 채 밖으로 뻗고, 로브는 안쪽 가장자리가 윤곽에 닿는다.
    let nx = side * Math.sin(theta) / rx, ny = Math.cos(theta) / ry;
    const nl = Math.hypot(nx, ny); nx /= nl; ny /= nl;
    const OUT = upper ? 0.02 : 0.09;   // 위쪽 귀(pointy·round·fold)는 머리에 바짝, 긴 귀(flap·long)는 얼굴 옆에 확실히 떨어져 늘어진다
    const bx = side * rx * Math.sin(theta) + nx * OUT;
    const by = box.headCy + ry * Math.cos(theta) + ny * OUT;
    // 귀 축 = 법선의 반대 기울기 (수직 기준 거울상), 단 안쪽 기울기는 0.35rad까지만 — 더 기울면 끝이 정수리 안으로
    // 들어가 머리에 묻힌다. 접선은 뿌리 자리의 것 그대로.
    const normalTilt = Math.atan2(nx * side, ny);          // 수직에서 법선까지의 각 (바깥쪽 양수)
    const lean = Math.min(normalTilt, 0.35);                // 귀 축의 안쪽 기울기
    const ax = -side * Math.sin(lean), ay = Math.cos(lean);
    // 귀 국소 좌표: u는 귀 축(위·안쪽), v는 축에 수직(바깥쪽 양수). 축에 수직이어야 세모·접힌 귀가 납작해지지 않는다
    const px = side * ay, py = -side * ax;
    const local = (u, v) => [bx + ax * u + px * v, by + ay * u + py * v];
    let path;
    if (kind === "pointy") {
      // 밑변은 윤곽까지 끌어와 박고(u = −OUT), 끝은 귀 축을 따라 위로. 폭 0.09의 세모 (크기 배율로 길고 넓게)
      const len = ry * 0.6 * size;
      const b0 = -OUT - 0.01;
      path = [local(b0, 0.05 * (0.8 + 0.2 * size)), local(len, 0.004), local(b0, -0.04 * (0.8 + 0.2 * size))];
    } else if (kind === "round") {
      // 귀 축 방향으로 길쭉한 동그란 귀 — 안쪽이 윤곽에 살짝 걸친다 (크기 배율)
      const [cx, cy] = local(-OUT + 0.055 * size, 0);
      path = rotate(blobPath(cx, cy, 0.036 * size, 0.046 * size, { lumps: 3, amount: 0.15, noise: null }), cx, cy, side * lean);
    } else if (kind === "fold") {
      // 접힌 귀 — 윤곽에서 귀 축을 따라 올라갔다가 끝이 바깥·아래로 접혀 처진다 (중력 방향). 크기 배율
      const b0 = -OUT - 0.01;
      const k = size;
      const [ux, uy] = local(0.06 * k, 0.02);       // 접히는 지점
      path = [
        local(b0, 0.045 * k), local(0.05 * k, 0.05 * k), [ux + side * 0.02 * k, uy], [ux + side * 0.055 * k, uy - 0.05 * k],
        [ux + side * 0.02 * k, uy - 0.07 * k], [ux - side * 0.005, uy - 0.03 * k], local(0.02, -0.03 * k), local(b0, -0.03 * k)
      ];
    } else {
      // flap / long — 머리 옆에서 늘어지되 반대 기울기(0.25rad 안쪽)로 끝이 얼굴 쪽으로 모이는 로브
      const len = ry * (kind === "long" ? 0.95 : 0.65);
      const tilt = -0.25;
      const cx = bx + side * Math.sin(tilt) * (len * 0.5 - 0.005);
      const cy = by - Math.cos(tilt) * (len * 0.5 - 0.005);
      path = rotate(blobPath(cx, cy, 0.045, len * 0.5 + 0.02, { lumps: 3, amount: 0.12, noise: null }), cx, cy, -side * tilt);
    }
    fills.fill(path, earFill);
    ink.outline(path, earInk);
  }
}

// 눈썹 선 — 눈(안경·고글·모노클·안대 테 포함) 바로 위. 모자 챙과 앞머리 끝단이 여기서 멈춘다.
export function browLine(spec, box) {
  const { headCy: cy, headRy: ry } = box;
  const eyes = eyeGeometry(spec, box);
  const rim = LENS_SCALE[spec.parts.eyewear] || (spec.parts.eyewear === "monocle" ? 1.5 : spec.parts.eyewear === "patch" ? 1.35 : 1);
  const eyeTop = eyes.reduce((m, e) => Math.max(m, e.y + e.r * rim), cy);
  return Math.max(cy + ry * 0.42, eyeTop + ry * 0.1);
}

export function drawHair(ink, spec, box, noise) {
  const kind = spec.parts.hair;
  if (kind === "none") return;
  const pop = spec.palette.pop;
  const ink0 = pop && pop.target === "hair" ? pop.color : spec.palette.ink;
  const rx = box.headRx;
  const ry = box.headRy;
  const cy = box.headCy;

  if (kind === "spikes" || kind === "mohawk") {
    const count = kind === "mohawk" ? 7 : 11;
    const span = kind === "mohawk" ? 0.35 : 0.95;
    for (let i = 0; i < count; i += 1) {
      const t = count === 1 ? 0 : i / (count - 1);
      const angle = Math.PI * (0.5 + span * (t - 0.5));
      const bx = Math.cos(angle) * rx * 0.95;
      const by = cy + Math.sin(angle) * ry * 0.95;
      const len = 0.06 + Math.abs(noise(i * 3.1 + spec.seed * 0.001)) * 0.09;
      ink.stroke([[bx, by], [bx + Math.cos(angle) * len, by + Math.sin(angle) * len]], {
        color: ink0, width: 0.012
      });
    }
    return;
  }

  if (kind === "pigtails") {
    // 양갈래 — 머리 옆에 묶인 뭉치 두 개
    for (const side of [-1, 1]) {
      const bx = side * rx * 1.02;
      const by = cy + ry * 0.3;
      ink.scribble(arcPath(bx, by, 0.045, 0.06, Math.PI * 0.5, Math.PI * 2.5, 12), {
        color: ink0, passes: 7, width: 0.008, spread: 0.03
      });
      ink.stroke([[bx - side * 0.02, by + 0.05], [bx + side * 0.01, by + 0.075]], { color: ink0, width: 0.012 });
    }
    // 정수리 살짝
    ink.scribble(arcPath(0, cy, rx * 0.9, ry * 0.9, Math.PI * 0.72, Math.PI * 0.28, 10), {
      color: ink0, passes: 5, width: 0.008, spread: ry * 0.12
    });
    return;
  }

  if (kind === "curly") {
    // 곱슬 — 정수리를 따라 작은 원 뭉치
    for (let i = 0; i < 7; i += 1) {
      const k = i / 6;
      const angle = Math.PI * (0.8 - 0.6 * k);
      const bx = Math.cos(angle) * rx * 0.88;
      const by = cy + Math.sin(angle) * ry * 0.92;
      const r = 0.03 + noise(i * 4.4) * 0.012;
      ink.outline(blobPath(bx, by, r, r, { lumps: 4, amount: 0.25, noise: null }), {
        color: ink0, width: 0.009, jitter: 0.008
      });
    }
    return;
  }

  if (kind === "wisp" || kind === "tuft") {
    const count = kind === "tuft" ? 4 : 7;
    for (let i = 0; i < count; i += 1) {
      const t = i / count;
      const angle = Math.PI * (0.25 + 0.5 * t);
      const bx = Math.cos(angle) * rx * 0.8;
      const by = cy + Math.sin(angle) * ry * 0.9;
      ink.stroke([[bx, by], [bx + noise(i * 5.5) * 0.07, by + 0.09 + t * 0.03]], {
        color: ink0, width: 0.008
      });
    }
    return;
  }

  if (kind === "bangs" || kind === "longbob") {
    // 앞머리 — 정수리 스크리블 + 이마를 덮는 촘촘한 세로 획(끝이 들쭉날쭉한 바가지 앞머리). 눈썹 선까지만
    // 끝단은 눈썹 선 — 안경·고글 테 위까지만 (모자 챙과 같은 계산)
    const fringeBottom = browLine(spec, box);
    const cap = arcPath(0, cy, rx * 0.98, ry * 0.98, Math.PI * 0.92, Math.PI * 0.08, 20);
    ink.scribble(cap, { color: ink0, passes: 11, width: 0.01, spread: ry * 0.2 });
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
    ink.scribble(zig, { color: ink0, passes: 6, width: 0.01, spread: 0.014 });
    if (kind === "longbob") {
      // 옆으로 턱 선까지 내려오는 단발 — 머리 가장자리 안쪽에서 굵은 세로 스크리블이 얼굴을 감싼다
      for (const side of [-1, 1]) {
        const x = side * rx * 0.9;
        const col = [[x - side * 0.03, cy + ry * 0.62], [x + side * 0.02, cy + ry * 0.1], [x + side * 0.03, cy - ry * 0.7]];
        ink.scribble(col, { color: ink0, passes: 14, width: 0.01, spread: 0.045 });
      }
    }
    return;
  }

  if (kind === "bun") {
    // 똥머리 — 정수리를 얇게 덮고 위에 뭉치 하나 + 비녀 획
    const cap = arcPath(0, cy, rx * 0.98, ry * 0.98, Math.PI * 0.82, Math.PI * 0.18, 16);
    ink.scribble(cap, { color: ink0, passes: 7, width: 0.009, spread: ry * 0.14 });
    const bx = 0.01, by = cy + ry * 1.05;
    ink.scribble(arcPath(bx, by, 0.045, 0.04, 0, Math.PI * 2, 14), { color: ink0, passes: 8, width: 0.009, spread: 0.028 });
    ink.outline(blobPath(bx, by, 0.048, 0.042, { lumps: 4, amount: 0.15, noise: null }), { color: ink0, width: 0.01 });
    ink.stroke([[bx - 0.07, by + 0.02], [bx + 0.06, by - 0.01]], { color: ink0, width: 0.008 });
    return;
  }

  // bob / mop / scribble / sweep — 두피를 덮는 스크리블
  //
  // depth를 0.5까지 올리면 호가 머리 옆면 한가운데까지 내려온다. 거기서
  // 스크리블이 퍼지면 눈을 덮어버린다. 정수리 근처로 제한한다.
  const depth = kind === "bob" ? 0.42 : kind === "sweep" ? 0.32 : 0.45;
  const cap = arcPath(0, cy, rx * 0.98, ry * 0.98, Math.PI * (0.5 + depth), Math.PI * (0.5 - depth), 20);
  const passes = kind === "scribble" ? 20 : kind === "mop" ? 16 : 11;
  ink.scribble(cap, {
    color: ink0,
    passes,
    width: kind === "scribble" ? 0.008 : 0.01,
    spread: ry * (kind === "sweep" ? 0.16 : 0.24)
  });
}

export function drawHeadgear(ink, fills, spec, box) {
  const kind = spec.parts.headgear;
  if (kind === "none") return;
  const ink0 = spec.palette.ink;
  const pop = spec.palette.pop;
  const accent = pop && pop.target === "headgear" ? pop.color : spec.palette.accent;
  const rx = box.headRx;
  const ry = box.headRy;
  const cy = box.headCy;

  // 모자는 **눈썹 선 위**에 앉는다. 눈이 높이 달린 개체도 가리지 않게 눈(안경·고글·안대·모노클 테 포함) 위쪽 끝에서
  // 재고, 폭은 그 높이에서의 머리 윤곽 반폭(타원)을 따른다 — 머리 크기·모양이 달라도 늘 머리에 맞는다.
  const brow = browLine(spec, box);
  const halfW = (y) => rx * Math.sqrt(Math.max(0.05, 1 - ((y - cy) / ry) ** 2));
  const crown = cy + ry;
  const tiltSide = spec.seed % 2 ? 1 : -1;
  // 머리를 덮는 모자(투구·캡)는 타원이 아니라 **머리 윤곽 모양**(각짐·위아래 폭 비)을 따라 살짝 크게 그린 뒤 눈썹 선에서
  // 자른다 — 네모 머리의 모서리, 정수리의 머리카락까지 덮여야 한다. 윤곽 위쪽(y ≥ line)만 남기고 밑을 잇는다.
  const shape = headShape(spec);
  const cover = (grow, line) => {
    const outline = blobPath(0, cy, rx * grow, ry * grow, { lumps: 3, amount: 0.05, noise: null, square: shape.square, taper: shape.taper });
    const upper = outline.filter(([, y]) => y >= line);
    // 자른 자리를 y = line 위 좌우 끝점으로 닫는다 (좌→우 순서 유지)
    upper.sort((a, b) => Math.atan2(a[1] - line, a[0]) - Math.atan2(b[1] - line, b[0]));
    const w = Math.max(...upper.map(([x]) => Math.abs(x)));
    return { path: [[w, line], ...upper, [-w, line]], w };
  };

  if (kind === "band") {
    // 이마 띠 — 눈썹 바로 위, 윤곽 밖으로 살짝 나가게
    const y = brow + ry * 0.08;
    const w = halfW(y) * 1.05;
    ink.stroke([[-w, y], [w, y + 0.006]], { color: accent, width: 0.03 });
    ink.stroke([[-w, y + 0.014], [w, y + 0.02]], { color: ink0, width: 0.006, jitter: 0.003 });
    return;
  }

  if (kind === "helmet") {
    // 투구 — 눈썹 위에서 정수리까지 머리 모양대로 덮는다(1.1배). 아래 테두리 + 가운데 능선
    const bottom = brow;
    const { path, w } = cover(1.1, bottom);
    fills.fill(path, accent);
    ink.outline(path, { color: ink0, width: 0.013, passes: 2 });
    ink.stroke([[-w * 1.02, bottom + 0.004], [w * 1.02, bottom - 0.004]], { color: ink0, width: 0.013 });
    ink.stroke([[0, bottom + (crown - bottom) * 0.2], [0.004, crown * 0.99 + ry * 0.08]], { color: ink0, width: 0.008 });
    return;
  }

  if (kind === "cap") {
    // 야구 모자 — 머리 모양대로 덮는 돔(1.04배) + 한쪽으로 나간 챙(눈썹 선). 챙은 살짝 처진다
    const bottom = brow + ry * 0.05;
    const { path, w } = cover(1.04, bottom);
    fills.fill(path, accent);
    ink.outline(path, { color: ink0, width: 0.012 });
    const brim = [[tiltSide * w * 0.1, bottom + 0.012], [tiltSide * w * 1.5, bottom - 0.01], [tiltSide * w * 1.5, bottom - 0.03], [tiltSide * w * 0.1, bottom - 0.01]];
    fills.fill(brim, accent);
    ink.outline(brim, { color: ink0, width: 0.012 });
    return;
  }

  if (kind === "beret") {
    // 베레 — 정수리에 한쪽으로 기울여 얹은 납작한 원반 + 꼭지
    const tilt = tiltSide * 0.16;
    const bx = -tilt * rx * 0.8;
    const by = Math.max(cy + ry * 0.82, brow + ry * 0.35);
    const cos = Math.cos(tilt);
    const sin = Math.sin(tilt);
    const disc = blobPath(0, 0, rx * 0.95, ry * 0.3, { lumps: 4, amount: 0.12, noise: null })
      .map(([x, y]) => [bx + x * cos - y * sin, by + x * sin + y * cos]);
    fills.fill(disc, accent);
    ink.outline(disc, { color: ink0, width: 0.012, passes: 2 });
    ink.stroke([[bx, by + ry * 0.3], [bx + 0.012, by + ry * 0.42]], { color: ink0, width: 0.012 });
    return;
  }

  if (kind === "bonnet") {
    // 보닛 — 머리를 감싸는 두툼한 테. 양옆 눈높이에서 정수리 위로 넘어간다
    const rim = arcPath(0, cy, rx * 1.2, ry * 1.14, Math.PI * 1.02, -Math.PI * 0.02, 26);
    ink.stroke(rim, { color: accent, width: 0.055, jitter: 0.012 });
    ink.stroke(rim, { color: ink0, width: 0.01, jitter: 0.01, passes: 2 });
    // 턱 밑 리본 자리 대신 양끝 매듭 점
    for (const side of [-1, 1]) {
      ink.stroke([[side * rx * 1.2, cy - 0.01], [side * rx * 1.15, cy - 0.05]], { color: ink0, width: 0.01 });
    }
    return;
  }

  // pot — 머리에 뒤집어쓴 통. 눈썹 위에서 시작해 정수리보다 높이 솟는다
  const bottom = brow + ry * 0.12;
  const w = halfW(bottom) * 0.9;
  const top = crown + ry * 0.28;
  const pot = [[-w, bottom], [-w * 0.85, top], [w * 0.85, top], [w, bottom]];
  fills.fill(pot, accent);
  ink.outline(pot, { color: ink0, width: 0.012 });
  ink.stroke([[-w * 0.9, bottom + (top - bottom) * 0.25], [w * 0.9, bottom + (top - bottom) * 0.27]], { color: ink0, width: 0.008 });
}

export function drawHorns(ink, fills, spec, box, noise) {
  const kind = spec.parts.horns;
  if (kind === "none") return;
  const ink0 = spec.palette.ink;
  const rx = box.headRx;
  const ry = box.headRy;
  const cy = box.headCy;
  // 도깨비 뿔은 레퍼런스처럼 길다. 실루엣을 위로 크게 확장한다.
  const scale = spec.species === "imp" ? 1.8 : 1;

  for (const side of [-1, 1]) {
    const bx = side * rx * 0.6;
    const by = cy + ry * 0.82;
    const lean = noise(side * 9.1 + spec.seed * 0.0007) * 0.06;

    if (kind === "curved") {
      ink.stroke([
        [bx, by],
        [bx + side * 0.07 * scale, by + 0.09 * scale],
        [bx + side * 0.01 + lean, by + 0.17 * scale]
      ], { color: ink0, width: 0.015 * scale });
    } else if (kind === "straight") {
      ink.stroke([[bx, by], [bx + side * 0.05 + lean, by + 0.2 * scale]], { color: ink0, width: 0.014 * scale });
    } else if (kind === "antenna") {
      const tipX = bx + side * 0.05 + lean;
      const tipY = by + 0.24 * scale;
      ink.stroke([[bx, by], [tipX, tipY]], { color: ink0, width: 0.008 });
      fills.fill(blobPath(tipX, tipY, 0.022 * scale, 0.022 * scale, { lumps: 3, amount: 0.2, noise: null }), ink0);
    } else if (kind === "ram") {
      // 나선으로 말린 숫양 뿔
      const spiral = [];
      for (let i = 0; i <= 26; i += 1) {
        const k = i / 26;
        const angle = Math.PI * 0.5 + side * k * Math.PI * 1.7;
        const r = (0.055 + 0.02 * scale) * (1 - k * 0.72);
        spiral.push([bx + side * 0.02 + Math.cos(angle) * r * side, by + 0.02 + Math.sin(angle) * r]);
      }
      ink.stroke(spiral, { color: ink0, width: 0.014, jitter: 0.004 });
    } else if (kind === "crown") {
      // 정수리를 가로지르는 스파이크 열 — 좌우 한 번씩만 돌면 중복이므로 side<0에서만
      if (side < 0) {
        for (let i = 0; i < 5; i += 1) {
          const k = i / 4;
          const angle = Math.PI * (0.72 - 0.44 * k);
          const sx = Math.cos(angle) * rx * 0.9;
          const sy = cy + Math.sin(angle) * ry * 0.92;
          const len = 0.05 + 0.03 * Math.sin(k * Math.PI);
          ink.stroke([[sx, sy], [sx + Math.cos(angle) * len * 1.6, sy + Math.sin(angle) * len * 1.6]], {
            color: ink0, width: 0.016
          });
        }
      }
    } else {
      ink.outline(blobPath(bx, by + 0.035, 0.033 * scale, 0.045 * scale, { lumps: 3, amount: 0.15, noise: null }), {
        color: ink0, width: 0.011
      });
    }
  }
}

