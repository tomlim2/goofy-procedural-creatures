// 치수와 윤곽. 스펙에서 실제 좌표를 뽑는다. 그리기 함수들이 전부 이 값을 공유한다.
// 문서: guidelines/character/parts.md § head, guidelines/rig.md § 원점 규칙

export const TAU = Math.PI * 2;

// 머리 윤곽 사전. 뽑히기만 하고 안 쓰이던 head 슬롯을 여기서 소비한다.
// square는 각짐, taper는 위아래 폭 비(+면 아래가 넓다), rx/ry는 크기 배율.
const HEAD_SHAPES = {
  round: { square: 0, taper: 0, rx: 1, ry: 1 },
  square: { square: 1.5, taper: 0, rx: 1, ry: 0.96 },
  tall: { square: 0.9, taper: -0.05, rx: 0.86, ry: 1.22 },
  pear: { square: 0.25, taper: 0.3, rx: 1, ry: 1.06 },
  wide: { square: 0.7, taper: 0.1, rx: 1.28, ry: 0.9 },
  egg: { square: 0.2, taper: 0.28, rx: 0.94, ry: 1.14 },
  block: { square: 2.2, taper: 0, rx: 1.06, ry: 0.98 }
};

// 두발 체격(build 슬롯). w는 bodyW 배율, h는 bodyH 배율, dressW는 dress 몸통용 배율, stance는 다리 스탠스
// (몸 반폭 대비 다리 x). 넓은 몸이 넓은 스탠스를 받치고, 좁은 몸은 다리를 모은다.
export const BUILD = {
  skinny: { w: 0.5, h: 1.15, dressW: 0.6, stance: 0.33 },    // 홀쭉이 — 막대 몸통
  narrow: { w: 0.7, h: 1.08, dressW: 0.75, stance: 0.4 },
  medium: { w: 1, h: 1, dressW: 1, stance: 0.5 },
  wide: { w: 1.4, h: 0.92, dressW: 1.15, stance: 0.68 },
  small: { w: 0.75, h: 0.7, dressW: 0.8, stance: 0.45 }      // 작은 몸통 — 머리가 커 보인다
};

// 두발 머리 꼭대기 상한. 셀 높이 1.35에서 바닥선(0.16)을 뺀 1.19 안에 머리카락·모자까지 들어가야 한다
export const MAX_HEAD_TOP = 1.05;

// 다리 기장 배율 (legLength 슬롯). 네발도 같은 표를 쓴다 — short 네발이 닥스훈트다.
export const LEG_LENGTH = { long: 1, medium: 0.65, short: 0.3 };
// 네발 체격 (build 슬롯). w는 몸 길이 배율, h는 몸통 두께 배율, cx는 몸통 중심이 앞(머리) 기준점에서 얼마나 뒤에 있나.
export const QUAD_BUILD = {
  skinny: { w: 1, h: 0.62, cx: 0.35 },       // 얇은 몸통
  narrow: { w: 0.7, h: 1, cx: 0.35 },        // 짧은 몸
  medium: { w: 1, h: 1, cx: 0.35 },
  wide: { w: 1.45, h: 1, cx: 0.22 },         // 긴 몸 (닥스훈트·먼치킨)
  small: { w: 0.75, h: 0.75, cx: 0.35 }      // 작은 몸
};

export function headShape(spec) {
  return HEAD_SHAPES[spec.parts.head] || HEAD_SHAPES.round;
}

// 채색보다 살짝 어두운 톤. 연필 음영에 쓴다.
// 색이 어두운가. 도깨비 머리·몸처럼 어두운 면 위에는 스크리블을 밝게 긁는다.
export function isDark(hex) {
  const v = parseInt(hex.slice(1), 16);
  const lum = 0.299 * ((v >> 16) & 255) + 0.587 * ((v >> 8) & 255) + 0.114 * (v & 255);
  return lum < 90;
}

export function darken(hex, factor) {
  const v = parseInt(hex.slice(1), 16);
  const ch = (x) => Math.round(Math.max(0, Math.min(255, x * factor))).toString(16).padStart(2, "0");
  return "#" + ch((v >> 16) & 255) + ch((v >> 8) & 255) + ch(v & 255);
}

// 스펙에서 실제 치수를 뽑는다. 그리기 함수들이 전부 이 값을 공유한다.
export function layout(spec) {
  const p = spec.proportions;
  const quad = spec.species === "pup" || spec.species === "cat";

  if (quad) {
    // 네발 골격. 몸이 가로로 눕고 머리가 몸 앞(왼쪽)에 얹힌다.
    // 키가 작아서 사람 줄과 나란히 서면 레퍼런스처럼 층이 낮아진다.
    // 다리 기장 — 네발도 슬롯을 따른다. long이 기준, medium은 65%, short(닥스훈트)는 30%
    const legTop = p.legLength * 0.4 * (LEG_LENGTH[spec.parts.legLength] || 1);
    // 체격 — 네발에서 build 슬롯은 몸통 길이·두께다: narrow 짧은 몸, wide 긴 몸(닥스훈트·먼치킨),
    // skinny 얇은 몸, small 작은 몸. 긴 몸은 중심을 머리 쪽으로 당겨(0.35→0.22) 꼬리 끝이 셀을 덜 넘게 한다.
    const build = QUAD_BUILD[spec.parts.build] || QUAD_BUILD.medium;
    const bodyH = 0.15 * (p.bodyScale / 0.52) * build.h;
    const bodyW = 0.18 * p.bodyLen * build.w;
    const bodyCx = 0.08 + bodyW * build.cx;   // 몸통 중심 x. 머리(x=0)는 앞(왼쪽)에 얹힌다
    const bodyTop = legTop + bodyH;
    const shape = headShape(spec);
    const headRy = 0.23 * p.headScale * shape.ry;
    const headRx = 0.23 * p.headScale * p.headWide * shape.rx;
    // 머리는 몸 위에 얹는다 (머리 채색이 몸 잉크를 덮으므로 겹쳐도 몸통 선은 안 비친다).
    const headCy = bodyTop + headRy * 0.82;
    return { quad, legTop, bodyH, bodyW, bodyCx, bodyTop, headRx, headRy, headCy };
  }

  // 다리 기장. 스케일이 아니라 길이만 — long 기준, medium 65%, short 30%(몸이 바닥에 거의 내려앉는다). 발·굵기는 그대로.
  const legTop = p.legLength * 0.55 * (LEG_LENGTH[spec.parts.legLength] || 1);
  // 체격(build 슬롯) × 개체 지터. 넓으면 조금 땅딸막하게, 좁으면 조금 홀쭉하게, small은 둘 다 작게.
  // dress는 밑단이 1.35배 퍼지므로 wide를 덜 준다 — 셀(±0.45)을 넘지 않게.
  const build = BUILD[spec.parts.build] || BUILD.medium;
  const bodyH = 0.28 * (p.bodyScale / 0.52) * build.h;
  const bodyW = 0.23 * p.bodyWide * (spec.parts.body === "dress" ? build.dressW : build.w);
  const bodyTop = legTop + bodyH;
  const shape = headShape(spec);
  let headRy = 0.3 * p.headScale * shape.ry;
  let headRx = 0.3 * p.headScale * p.headWide * shape.rx;
  let headCy = bodyTop + headRy * 0.72;
  // 셀 안에 들어가게 — 머리 꼭대기가 MAX_HEAD_TOP을 넘으면 머리를 그만큼 줄인다 (그 위에 머리카락·모자가 더 얹힌다).
  // 왕머리 + 긴 다리 + 큰 몸이 겹치면 셀(1.19)을 넘어 윗줄을 침범한다
  const top = headCy + headRy;
  if (top > MAX_HEAD_TOP) {
    const k = (MAX_HEAD_TOP - bodyTop) / (top - bodyTop);
    headRy *= k;
    headRx *= k;
    headCy = bodyTop + headRy * 0.72;
  }

  return { quad: false, legTop, bodyH, bodyW, bodyCx: 0, bodyTop, headRx, headRy, headCy };
}

export function eyeGeometry(spec, box) {
  const p = spec.proportions;
  const gap = box.headRx * p.eyeGap;
  // wide(왕눈)는 ring보다 1.3배 — 이름만 다르고 같은 눈이면 안 된다
  const base = box.headRy * p.eyeSize * 1.35 * (spec.parts.eyes === "wide" ? 1.3 : 1);
  const y = box.headCy + box.headRy * p.eyeHeight;

  // 외눈은 중앙에 하나만
  if (spec.parts.eyes === "cyclops") {
    return [{ side: 0, x: 0, y, r: base * 1.75 }];
  }

  // 좌우를 일부러 어긋나게 둔다. 대칭이면 즉시 도형처럼 보인다.
  // 단 **선으로만 그리는 눈**(sleepy·line·happy·squeeze·droop·cross·half·side)은 대칭이다 — 획 하나짜리 눈은 크기·높이가
  // 다르면 "작은 눈"이 아니라 실수로 읽힌다 (흰자·동공이 있는 눈은 짝눈이어도 눈으로 읽힌다)
  const lineEye = LINE_EYES.includes(spec.parts.eyes);
  const sizeSkew = lineEye ? 0 : p.eyeSizeSkew;
  const heightSkew = lineEye ? 0 : p.eyeHeightSkew;
  return [
    { side: -1, x: -gap, y: y + box.headRy * heightSkew, r: base * (1 - sizeSkew) },
    { side: 1, x: gap, y: y - box.headRy * heightSkew, r: base * (1 + sizeSkew) }
  ];
}
// 선으로만 그리는 눈 — 좌우 대칭으로 둔다 (eyeGeometry)
export const LINE_EYES = ["sleepy", "line", "happy", "squeeze", "droop", "cross", "half", "side"];

