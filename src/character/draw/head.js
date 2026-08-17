// 머리 — 윤곽·귀·윤곽 위 앵커·눈썹 선. 머리카락은 hair.js, 모자·뿔은 headgear.js. 문서: guidelines/character/parts.md § 머리

import { blobPath, arcPath } from "../../stroke.js";
import { headShape, eyeGeometry } from "./layout.js";
import { shade, isDark } from "../../color.js";
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
      color: shade(spec.palette.skin, 1.5), angle: scribbleAngle, gap: 0.03, width: 0.006
    });
  } else {
    fills.scribbleFill(0.01, box.headCy, box.headRx * 0.8, box.headRy * 0.76, {
      color: shade(spec.palette.skin, 0.9), angle: scribbleAngle, gap: 0.034, width: 0.007
    });
  }

  // 윤곽선 지터도 사람은 절반 — 두상이 매끄럽게 (선의 떨림 자체는 남는다)
  ink.outline(path, { color: spec.palette.ink, width: 0.014, jitter: spec.species === "human" ? 0.006 : 0.008, passes: 2 });
  return path;
}

// 귀 크기 배율. Mid·Big는 모양은 같고 길이·폭만 크다. earKind()가 값을 기본 모양으로 돌린다
const EAR_SIZE = { round: 1, roundMid: 1.4, roundBig: 1.8, pointy: 1, pointyMid: 1.4, pointyBig: 1.85, fold: 1, foldMid: 1.4, foldBig: 1.8, perk: 1, perkMid: 1.4, perkBig: 1.8 };
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
// 머리 윤곽(초타원 + 위아래 폭 비 — drawHead가 그리는 그 모양) 위의 점과 바깥 단위 법선.
// theta: 정수리에서 잰 매개변수 각(0 = 정수리, π/2 = 옆구리), side: ±1. 귀·뿔처럼 "윤곽에 붙는" 것은 타원이 아니라 이걸 쓴다 —
// 네모 머리에서 타원 위 점은 윤곽 안쪽에 묻힌다. 네모 머리의 꼭짓점(모서리)은 θ = π/4다.
export function headAnchor(spec, box, theta, side) {
  const shape = headShape(spec);
  const n = 2 + shape.square;
  const pt = (th) => {
    const c = Math.sin(th), sn = Math.cos(th);   // blobPath의 각 = π/2 − θ
    const ux = Math.sign(c) * Math.pow(Math.abs(c), 2 / n);
    const uy = Math.sign(sn) * Math.pow(Math.abs(sn), 2 / n);
    return [side * ux * box.headRx * (1 - shape.taper * uy), box.headCy + uy * box.headRy];
  };
  const [x, y] = pt(theta);
  const [x0, y0] = pt(theta - 0.01), [x1, y1] = pt(theta + 0.01);
  let tx = x1 - x0, ty = y1 - y0;
  const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
  let nx = ty, ny = -tx;                                   // 접선을 90° 돌린 둘 중 머리 중심에서 멀어지는 쪽
  if (nx * x + ny * (y - box.headCy) < 0) { nx = -nx; ny = -ny; }
  return { x, y, nx, ny };
}

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
    // 윤곽(실제 머리 모양) 위 뿌리와 그 자리의 바깥 법선 n·접선 t (바깥 양수)
    const anchor = headAnchor(spec, box, theta, side);
    const bx = anchor.x, by = anchor.y, nx = anchor.nx, ny = anchor.ny;
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
    else if (inner === "dark") fills.fill([baseAt(-def.w * 0.5, -0.012), innerTip, baseAt(def.w * 0.5, -0.012)], shade(skin, isDark(skin) ? 1.5 : 0.62));
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
  const earFill = shade(spec.palette.skin, 0.8);
  const earInk = { color: spec.palette.ink, width: 0.011, passes: 2 };
  const upper = kind === "pointy" || kind === "round" || kind === "fold" || kind === "perk";
  // 위쪽 자리는 둥근 머리에서 θ≈50°, 네모 머리(square·block)에서는 **꼭짓점**(θ = 45°)에서 시작한다 — 세모귀가 모서리에서 뻗는다
  const boxy = Math.min(1, headShape(spec).square / 1.5);
  const theta = upper ? 0.88 - boxy * (0.88 - Math.PI / 4) : 1.53;
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
    const anchor = headAnchor(spec, box, theta, side);   // 실제 윤곽(네모 머리면 모서리) 위의 점과 법선
    const nx = anchor.nx, ny = anchor.ny;
    const OUT = upper ? 0.02 : 0.09;   // 위쪽 귀(pointy·round·fold)는 머리에 바짝, 긴 귀(flap·long)는 얼굴 옆에 확실히 떨어져 늘어진다
    const bx = anchor.x + nx * OUT;
    const by = anchor.y + ny * OUT;
    // 귀 축 = 법선의 반대 기울기 (수직 기준 거울상), 단 안쪽 기울기는 0.35rad까지만 — 더 기울면 끝이 정수리 안으로
    // 들어가 머리에 묻힌다. 접선은 뿌리 자리의 것 그대로.
    const normalTilt = Math.atan2(nx * side, ny);          // 수직에서 법선까지의 각 (바깥쪽 양수)
    const lean = Math.min(normalTilt, 0.35);                // 귀 축의 안쪽 기울기
    const ax = -side * Math.sin(lean), ay = Math.cos(lean);
    // 귀 국소 좌표: u는 귀 축(위·안쪽), v는 축에 수직(바깥쪽 양수). 축에 수직이어야 세모·접힌 귀가 납작해지지 않는다
    const px = side * ay, py = -side * ax;
    const local = (u, v) => [bx + ax * u + px * v, by + ay * u + py * v];
    let path;
    let flap = null;    // 접힌 귀의 덮개 — 밑동 위에 겹쳐 그린다
    let crease = null;  // 접힘선 — 검은 털에서는 두 조각의 색이 같아 선이 없으면 접힌 게 안 보인다
    // 밑동 윤곽을 **열린 선**으로 그릴 때 쓴다. 층 하나 안에서는 잉크가 채색보다 위라(guidelines/rig.md) 덮개 채색이 밑동 윤곽을 못 가린다 —
    // 가려질 구간(덮개 밑)은 아예 긋지 않는다
    let baseOutline = null;
    if (kind === "pointy") {
      // 세모귀 — **꼭짓점이 머리에 붙는다**(밑변이 아니다). 제일 위 꼭짓점을 윤곽(네모 머리면 모서리)에 박고,
      // 몸통은 거기서 바깥·아래로 처진다: 밑변이 바깥 끝. 크기 배율로 길고 넓게
      const len = ry * 0.55 * size;
      const w = 0.045 * (0.8 + 0.2 * size);                  // 밑변 반폭
      const drop = 0.6;                                       // 축이 수평에서 아래로 처진 각(rad)
      const ex = side * Math.cos(drop), ey = -Math.sin(drop); // 귀 축: 바깥·아래
      const qx = -ey * side, qy = ex * side;                  // 축에 수직 (위·바깥 양수)
      const tipX = anchor.x - nx * 0.012, tipY = anchor.y - ny * 0.012;   // 꼭짓점은 윤곽 살짝 안쪽 — 박힌다
      path = [
        [tipX, tipY],
        [tipX + ex * len + qx * w, tipY + ey * len + qy * w],
        [tipX + ex * len - qx * w * 0.9, tipY + ey * len - qy * w * 0.9]
      ];
    } else if (kind === "round") {
      // 귀 축 방향으로 길쭉한 동그란 귀 — 안쪽이 윤곽에 살짝 걸친다 (크기 배율)
      const [cx, cy] = local(-OUT + 0.055 * size, 0);
      path = rotate(blobPath(cx, cy, 0.036 * size, 0.046 * size, { lumps: 3, amount: 0.15, noise: null }), cx, cy, side * lean);
    } else if (kind === "fold" || kind === "perk") {
      // 접힌 귀(fold) — **선 밑동 + 그 위에서 꺾여 늘어진 덮개** 두 조각. **한쪽만 접히고 반대쪽은 선 귀**다.
      // 선 귀(perk) — 양쪽 다 곧게 선 세모. 끝이 위를 향해 굽으면 뿔로 읽힌다 — 덮개는 접힘선보다 **아래로** 내려와야 접힌 귀다. 크기 배율
      const k = size;
      // 선 귀·접힌 귀는 **머리 법선 좌표**로 그린다 — 밑변이 붙는 자리의 접선을 그대로 따르고 귀는 법선 방향으로 자란다.
      // (다른 귀처럼 안쪽으로 기운 축을 쓰면 밑동이 두피에서 떠 머리에 얹은 상자처럼 보인다)
      //   nu 법선 방향(머리 밖으로 자라는 높이) · nv 접선 방향(밑변 — + 쪽으로 접힌다)
      const tX = side * ny, tY = -side * nx;
      const nAt = (nu, nv) => [anchor.x + nx * nu + tX * nv, anchor.y + ny * nu + tY * nv];
      const halfW = 0.048 * k;         // 밑동 반폭 (접선 방향)
      // 접힌 귀는 **한쪽만 접힌다** — 반대쪽은 선 귀다 (좌우가 다른 게 개답다). 접히는 쪽은 개체별(wobbleSeed, rng 없음)
      const foldSide = spec.proportions.wobbleSeed % 2 ? 1 : -1;
      if (kind === "perk" || side !== foldSide) {
        // 선 귀 — 법선 방향으로 **곧게 선 세모**. 밑동은 좁고 위로 갈수록 빨리 좁아져 끝이 뾰족하다
        // (넓적하고 낮으면 동그란 귀round와 구분이 안 된다)
        const len = 0.16 * k, base = halfW * 0.86;
        path = [nAt(-0.014, base), nAt(len * 0.62, base * 0.42), nAt(len, base * 0.06), nAt(len, -base * 0.06), nAt(len * 0.62, -base * 0.42), nAt(-0.014, -base)];
      } else {
        const stand = 0.085 * k;         // 접힘선까지 선 높이 (법선 방향)
        const drop = 0.075 * k;          // 덮개가 접혀 내려가는 길이
        // 밑동 — 밑변은 윤곽 안(−0.014)에 박히고 위로 갈수록 좁아지는 사다리꼴 (세모귀와 같은 문법)
        path = [nAt(-0.014, halfW), nAt(stand, halfW * 0.66), nAt(stand, -halfW * 0.66), nAt(-0.014, -halfW)];
        // 덮개 — 접힘선에서 접선 방향(+nv)으로 꺾여 **밑동 옆·아래**로 늘어진다. 끝이 접힘선보다 낮아야 접힌 귀다
        flap = [
          nAt(stand + 0.006 * k, -halfW * 0.6),
          nAt(stand + 0.004 * k, halfW * 1.15),
          nAt(stand - drop, halfW * 1.05)
        ];
        crease = [nAt(stand, -halfW * 0.66), nAt(stand + 0.004 * k, halfW * 1.1)];
        // 밑동 윤곽 — 안쪽 위 → 안쪽 아래 → 바깥 아래 → 덮개 끝 높이까지만. 윗변과 그 위 바깥변은 덮개가 덮으므로 긋지 않는다
        baseOutline = [nAt(stand, -halfW * 0.66), nAt(-0.014, -halfW), nAt(-0.014, halfW), nAt(stand - drop - 0.004 * k, halfW * 0.72)];
      }
    } else {
      // flap / long — 머리 옆에서 늘어지되 반대 기울기(0.25rad 안쪽)로 끝이 얼굴 쪽으로 모이는 로브
      const len = ry * (kind === "long" ? 0.95 : 0.65);
      const tilt = -0.25;
      const cx = bx + side * Math.sin(tilt) * (len * 0.5 - 0.005);
      const cy = by - Math.cos(tilt) * (len * 0.5 - 0.005);
      path = rotate(blobPath(cx, cy, 0.045, len * 0.5 + 0.02, { lumps: 3, amount: 0.12, noise: null }), cx, cy, -side * tilt);
    }
    fills.fill(path, earFill);
    if (baseOutline) ink.stroke(baseOutline, earInk);
    else ink.outline(path, earInk);
    if (flap) {
      // 덮개는 귀 안쪽 면이라 조금 더 어둡다 — 밝은 털에서는 색으로, 검은 털에서는 접힘선으로 읽힌다
      fills.fill(flap, shade(earFill, 0.78));
      ink.outline(flap, earInk);
      ink.stroke(crease, { color: spec.palette.ink, width: 0.009 });
    }
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
