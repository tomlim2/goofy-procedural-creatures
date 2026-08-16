// 치수와 윤곽. 스펙에서 실제 좌표를 뽑는다. 그리기 함수들이 전부 이 값을 공유한다.
// 문서: guidelines/parts-catalog.md § head, guidelines/rig.md § 원점 규칙

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

// 몸통 폭 클래스. w는 bodyW 배율, h는 bodyH 배율, dressW는 dress 몸통용 배율, stance는 다리 스탠스
// (몸 반폭 대비 다리 x). 넓은 몸이 넓은 스탠스를 받치고, 좁은 몸은 다리를 모은다.
export const BODY_WIDTH = {
  narrow: { w: 0.7, h: 1.08, dressW: 0.75, stance: 0.4 },
  medium: { w: 1, h: 1, dressW: 1, stance: 0.5 },
  wide: { w: 1.4, h: 0.92, dressW: 1.15, stance: 0.68 }
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
    const legTop = p.legLength * 0.4;
    const bodyH = 0.15 * (p.bodyScale / 0.52);
    const bodyW = 0.18 * p.bodyLen;
    const bodyCx = 0.08;
    const bodyTop = legTop + bodyH;
    const shape = headShape(spec);
    const headRy = 0.23 * p.headScale * shape.ry;
    const headRx = 0.23 * p.headScale * p.headWide * shape.rx;
    // 머리는 몸 위에 얹는다. 겹치면 몸의 잉크가 얼굴 위로 비친다
    // (잉크 메시는 채색 메시보다 항상 위에 있다).
    const headCy = bodyTop + headRy * 0.82;
    return { quad, legTop, bodyH, bodyW, bodyCx, bodyTop, headRx, headRy, headCy };
  }

  // 다리 기장. short는 스케일이 아니라 길이만 30% — 몸이 바닥에 거의 내려앉고 발·굵기는 그대로.
  const legTop = p.legLength * 0.55 * (spec.parts.legLength === "short" ? 0.3 : 1);
  // 몸통 폭(bodyWidth 슬롯) × 개체 지터. 넓으면 조금 땅딸막하게, 좁으면 조금 홀쭉하게.
  // dress는 밑단이 1.35배 퍼지므로 wide를 덜 준다 — 셀(±0.45)을 넘지 않게.
  const width = BODY_WIDTH[spec.parts.bodyWidth] || BODY_WIDTH.medium;
  const bodyH = 0.28 * (p.bodyScale / 0.52) * width.h;
  const bodyW = 0.23 * p.bodyWide * (spec.parts.body === "dress" ? width.dressW : width.w);
  const bodyTop = legTop + bodyH;
  const shape = headShape(spec);
  const headRy = 0.3 * p.headScale * shape.ry;
  const headRx = 0.3 * p.headScale * p.headWide * shape.rx;
  const headCy = bodyTop + headRy * 0.72;

  return { quad: false, legTop, bodyH, bodyW, bodyCx: 0, bodyTop, headRx, headRy, headCy };
}

export function eyeGeometry(spec, box) {
  const p = spec.proportions;
  const gap = box.headRx * p.eyeGap;
  const base = box.headRy * p.eyeSize * 1.35;
  const y = box.headCy + box.headRy * p.eyeHeight;

  // 외눈은 중앙에 하나만
  if (spec.parts.eyes === "cyclops") {
    return [{ side: 0, x: 0, y, r: base * 1.75 }];
  }

  // 좌우를 일부러 어긋나게 둔다. 대칭이면 즉시 도형처럼 보인다.
  return [
    { side: -1, x: -gap, y: y + box.headRy * p.eyeHeightSkew, r: base * (1 - p.eyeSizeSkew) },
    { side: 1, x: gap, y: y - box.headRy * p.eyeHeightSkew, r: base * (1 + p.eyeSizeSkew) }
  ];
}

