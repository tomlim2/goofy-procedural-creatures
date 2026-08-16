// 스펙 → 획. 여기서는 무엇을 고를지 정하지 않는다. 이미 정해진 것을 그릴 뿐이다.
//
// 좌표계는 셀 안의 로컬 공간이다. 바닥이 y=0, 머리 꼭대기가 대략 y=1.05.

import { Sketch, blobPath, arcPath } from "./stroke.js";
import { makeNoise, makeRng } from "./rng.js";

const TAU = Math.PI * 2;

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

function headShape(spec) {
  return HEAD_SHAPES[spec.parts.head] || HEAD_SHAPES.round;
}

// 채색보다 살짝 어두운 톤. 연필 음영에 쓴다.
function darken(hex, factor) {
  const v = parseInt(hex.slice(1), 16);
  const ch = (x) => Math.round(Math.max(0, Math.min(255, x * factor))).toString(16).padStart(2, "0");
  return "#" + ch((v >> 16) & 255) + ch((v >> 8) & 255) + ch(v & 255);
}

// 스펙에서 실제 치수를 뽑는다. 그리기 함수들이 전부 이 값을 공유한다.
function layout(spec) {
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

  const legTop = p.legLength * 0.55;
  const bodyH = 0.28 * (p.bodyScale / 0.52);
  const bodyW = 0.23 * p.bodyWide;
  const bodyTop = legTop + bodyH;
  const shape = headShape(spec);
  const headRy = 0.3 * p.headScale * shape.ry;
  const headRx = 0.3 * p.headScale * p.headWide * shape.rx;
  const headCy = bodyTop + headRy * 0.72;

  return { quad: false, legTop, bodyH, bodyW, bodyCx: 0, bodyTop, headRx, headRy, headCy };
}

function eyeGeometry(spec, box) {
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

function drawHead(ink, fills, spec, box, noise) {
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
  if (spec.species === "imp") {
    fills.scribbleFill(0.01, box.headCy, box.headRx * 0.82, box.headRy * 0.8, {
      color: darken(spec.palette.ink, 1.6), angle: scribbleAngle, gap: 0.03, width: 0.006
    });
  } else {
    fills.scribbleFill(0.01, box.headCy, box.headRx * 0.8, box.headRy * 0.76, {
      color: darken(spec.palette.skin, 0.9), angle: scribbleAngle, gap: 0.034, width: 0.007
    });
  }

  ink.outline(path, { color: spec.palette.ink, width: 0.014, jitter: 0.008, passes: 2 });
  return path;
}

function drawEars(ink, fills, spec, box) {
  const kind = spec.parts.ears;
  if (kind === "none") return;

  if (spec.species === "pup") {
    // 개 귀는 머리 위옆에서 길게 늘어진다. 레퍼런스의 비글 귀.
    for (const side of [-1, 1]) {
      const bx = side * box.headRx * 0.72;
      const by = box.headCy + box.headRy * 0.55;
      const lobe = blobPath(bx + side * 0.02, by - box.headRy * 0.55, 0.045, box.headRy * 0.62, {
        lumps: 3, amount: 0.12, noise: null
      });
      fills.fill(lobe, darken(spec.palette.skin, 0.8));
      ink.outline(lobe, { color: spec.palette.ink, width: 0.011, passes: 2 });
    }
    return;
  }

  if (spec.species === "cat" && kind === "pointy") {
    // 고양이 귀는 옆이 아니라 정수리에 선다
    for (const side of [-1, 1]) {
      const bx = side * box.headRx * 0.55;
      const by = box.headCy + box.headRy * 0.78;
      ink.stroke([
        [bx - side * 0.04, by],
        [bx + side * 0.015, by + 0.085],
        [bx + side * 0.055, by - 0.01]
      ], { color: spec.palette.ink, width: 0.011 });
    }
    return;
  }

  const y = box.headCy - box.headRy * 0.05;

  for (const side of [-1, 1]) {
    const x = side * box.headRx * 0.98;
    if (kind === "round") {
      ink.outline(blobPath(x, y, 0.035, 0.045, { lumps: 3, amount: 0.15, noise: null }), {
        color: spec.palette.ink, width: 0.011
      });
    } else if (kind === "pointy") {
      ink.stroke([[x - 0.01, y + 0.05], [x + side * 0.075, y + 0.02], [x - 0.01, y - 0.05]], {
        color: spec.palette.ink, width: 0.011
      });
    } else if (kind === "long") {
      // 늘어진 긴 귀 — 개가 아니어도 달 수 있다
      const lobe = blobPath(x + side * 0.012, y - box.headRy * 0.32, 0.035, box.headRy * 0.45, {
        lumps: 3, amount: 0.12, noise: null
      });
      ink.outline(lobe, { color: spec.palette.ink, width: 0.01, passes: 2 });
    } else if (kind === "fold") {
      // 접힌 귀 — 끝이 꺾인다
      ink.stroke([
        [x - side * 0.01, y + 0.04],
        [x + side * 0.055, y + 0.055],
        [x + side * 0.05, y - 0.01],
        [x + side * 0.015, y - 0.03]
      ], { color: spec.palette.ink, width: 0.011 });
    } else {
      // flap — 아래로 늘어진 귀
      ink.stroke(arcPath(x, y, 0.05, 0.09, -Math.PI * 0.6, Math.PI * 0.6), {
        color: spec.palette.ink, width: 0.011
      });
    }
  }
}

function drawEyes(ink, fills, spec, box, eyes) {
  const kind = spec.parts.eyes;
  const ink0 = spec.faceInk || spec.palette.ink;

  for (const eye of eyes) {
    if (spec.parts.patchSide === eye.side) continue;

    if (kind === "dot") {
      fills.fill(blobPath(eye.x, eye.y, eye.r * 0.4, eye.r * 0.4, { lumps: 3, amount: 0.2, noise: null }), ink0);
    } else if (kind === "sleepy") {
      ink.stroke(arcPath(eye.x, eye.y, eye.r, eye.r * 0.7, Math.PI, TAU), { color: ink0, width: 0.011 });
    } else if (kind === "cross") {
      ink.stroke([[eye.x - eye.r, eye.y - eye.r], [eye.x + eye.r, eye.y + eye.r]], { color: ink0, width: 0.011 });
      ink.stroke([[eye.x + eye.r, eye.y - eye.r], [eye.x - eye.r, eye.y + eye.r]], { color: ink0, width: 0.011 });
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
      // 아몬드 윤곽 + 세로 동공
      ink.outline(blobPath(eye.x, eye.y, eye.r * 1.05, eye.r * 0.62, { lumps: 3, amount: 0.1, noise: null }), {
        color: ink0, width: 0.01
      });
      ink.stroke([[eye.x, eye.y - eye.r * 0.5], [eye.x + 0.004, eye.y + eye.r * 0.5]], {
        color: ink0, width: 0.013
      });
    } else if (kind === "half") {
      ink.outline(blobPath(eye.x, eye.y, eye.r, eye.r, { lumps: 3, amount: 0.1, noise: null }), {
        color: ink0, width: 0.011
      });
      ink.stroke([[eye.x - eye.r * 1.1, eye.y + eye.r * 0.25], [eye.x + eye.r * 1.1, eye.y + eye.r * 0.35]], {
        color: ink0, width: 0.013
      });
    }
    // ring / wide는 여기서 그리지 않는다. scene이 흰자·동공·눈꺼풀을
    // 별도 메시로 세워 개방도(놀람)를 움직인다.
  }
}

function drawFace2(ink, fills, spec, box, eyes) {
  const kind = spec.parts.face2;
  if (kind === "none") return;
  const ink0 = spec.faceInk || spec.palette.ink;

  if (kind === "tears") {
    // 눈 아래로 흘러내리는 두 줄. 레퍼런스에서 자주 보이는 디테일.
    for (const eye of eyes) {
      if (spec.parts.patchSide === eye.side) continue;
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

  const cheekY = box.headCy - box.headRy * 0.28;
  for (const side of [-1, 1]) {
    const cx = side * box.headRx * 0.58;
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

function drawBrow(ink, spec, box, eyes, kindOverride) {
  const kind = kindOverride || spec.parts.brow;
  if (kind === "none") return;
  const ink0 = spec.faceInk || spec.palette.ink;

  for (const eye of eyes) {
    if (spec.parts.patchSide === eye.side) continue;
    const y = eye.y + eye.r * 1.9;
    const half = eye.r * 1.15;
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

function drawEyewear(ink, fills, spec, box, eyes) {
  const kind = spec.parts.eyewear;
  if (kind === "none") return;
  const ink0 = spec.faceInk || spec.palette.ink;

  if (kind === "patch") {
    const eye = eyes.find((e) => e.side === spec.parts.patchSide) || eyes[0];
    const patch = blobPath(eye.x, eye.y, eye.r * 1.5, eye.r * 1.35, { lumps: 4, amount: 0.12, noise: null });
    fills.fill(patch, ink0);
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

  const scale = kind === "goggles" ? 1.75 : 1.45;
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

function drawNose(ink, fills, spec, box, eyes) {
  if (spec.species === "pup") {
    // 주둥이. 코 슬롯이 주둥이의 형태를 정한다 — 같은 슬롯으로 종족별 변형을 얻는다.
    const kind = spec.parts.nose;
    const mw = kind === "hook" ? 0.62 : kind === "long" ? 0.68 : kind === "wedge" ? 0.4 : 0.5;
    const mh = kind === "long" ? 0.28 : kind === "wedge" ? 0.3 : 0.36;
    const my = box.headCy - box.headRy * (kind === "long" ? 0.48 : 0.42);
    const muzzle = blobPath(0, my, box.headRx * mw, box.headRy * mh, { lumps: 3, amount: 0.1, noise: null });
    fills.fill(muzzle, "#f0ebdf");
    ink.outline(muzzle, { color: spec.palette.ink, width: 0.01 });
    const nr = kind === "hook" ? 0.05 : kind === "dot" ? 0.032 : 0.04;
    const nose = blobPath(0, my + box.headRy * 0.16, nr, nr * 0.75, { lumps: 3, amount: 0.15, noise: null });
    fills.fill(nose, spec.palette.ink);
    return;
  }

  const kind = spec.parts.nose;
  if (kind === "none") return;
  const y = box.headCy - box.headRy * spec.proportions.noseDrop;
  const ink0 = spec.faceInk || spec.palette.ink;

  if (kind === "dot") {
    ink.stroke([[-0.012, y], [0.012, y]], { color: ink0, width: 0.013 });
  } else if (kind === "hook") {
    ink.stroke([[0.004, y + 0.07], [0.01, y], [-0.035, y - 0.012]], { color: ink0, width: 0.01 });
  } else if (kind === "wedge") {
    ink.stroke([[-0.03, y - 0.02], [0.006, y + 0.055], [0.032, y - 0.02]], { color: ink0, width: 0.01 });
  } else {
    // long — 이마에서 내려오는 긴 코
    ink.stroke([[0.006, y + 0.14], [0.014, y - 0.03], [-0.03, y - 0.045]], { color: ink0, width: 0.01 });
  }
}

function drawMouth(ink, fills, spec, box, kindOverride) {
  const kind = kindOverride || spec.parts.mouth;
  const y = box.headCy - box.headRy * spec.proportions.mouthDrop;
  const ink0 = spec.faceInk || spec.palette.ink;
  const w = box.headRx * 0.38;

  if (kind === "dot") {
    ink.stroke([[-0.012, y], [0.012, y]], { color: ink0, width: 0.014 });
  } else if (kind === "line") {
    ink.stroke([[-w, y], [w, y + 0.004]], { color: ink0, width: 0.011 });
  } else if (kind === "smile") {
    ink.stroke(arcPath(0, y + 0.03, w, 0.045, Math.PI, TAU), { color: ink0, width: 0.011 });
  } else if (kind === "wave") {
    ink.stroke([[-w, y], [-w * 0.3, y + 0.03], [w * 0.3, y - 0.02], [w, y + 0.015]], {
      color: ink0, width: 0.011
    });
  } else if (kind === "open") {
    const hole = blobPath(0, y, w * 0.8, 0.05, { lumps: 3, amount: 0.15, noise: null });
    fills.fill(hole, ink0);
  } else if (kind === "pout") {
    // 오리입 — 작은 동그라미
    ink.outline(blobPath(0, y, 0.022, 0.017, { lumps: 3, amount: 0.15, noise: null }), {
      color: ink0, width: 0.011
    });
  } else if (kind === "omega") {
    // ω — 고양이 입
    ink.stroke(arcPath(-w * 0.35, y + 0.012, w * 0.38, 0.028, Math.PI, TAU), { color: ink0, width: 0.01 });
    ink.stroke(arcPath(w * 0.35, y + 0.012, w * 0.38, 0.028, Math.PI, TAU), { color: ink0, width: 0.01 });
  } else if (kind === "zigzag") {
    const zig = [];
    for (let i = 0; i <= 6; i += 1) zig.push([-w + (2 * w * i) / 6, y + (i % 2 ? -0.016 : 0.012)]);
    ink.stroke(zig, { color: ink0, width: 0.011 });
  } else {
    // teeth — 입선 위아래로 이가 삐져나온다
    ink.stroke([[-w, y], [w, y]], { color: ink0, width: 0.012 });
    for (let i = 0; i < 3; i += 1) {
      const x = -w * 0.6 + i * w * 0.6;
      ink.stroke([[x, y], [x + 0.012, y - 0.045]], { color: ink0, width: 0.009 });
    }
  }
}

function drawHair(ink, spec, box, noise) {
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

function drawHeadgear(ink, fills, spec, box) {
  const kind = spec.parts.headgear;
  if (kind === "none") return;
  const ink0 = spec.palette.ink;
  const pop = spec.palette.pop;
  const accent = pop && pop.target === "headgear" ? pop.color : spec.palette.accent;
  const rx = box.headRx;
  const ry = box.headRy;
  const cy = box.headCy;

  if (kind === "band") {
    const y = cy + ry * 0.5;
    ink.stroke([[-rx * 0.95, y], [rx * 0.95, y + 0.01]], { color: accent, width: 0.028 });
    return;
  }

  if (kind === "helmet") {
    const shell = arcPath(0, cy + ry * 0.1, rx * 1.06, ry * 0.98, Math.PI, TAU, 22);
    fills.fill([...shell, [rx * 1.06, cy + ry * 0.1], [-rx * 1.06, cy + ry * 0.1]], accent);
    ink.stroke(shell, { color: ink0, width: 0.013, passes: 2 });
    ink.stroke([[-rx * 1.08, cy + ry * 0.12], [rx * 1.08, cy + ry * 0.12]], { color: ink0, width: 0.011 });
    return;
  }

  if (kind === "cap") {
    const shell = arcPath(0, cy + ry * 0.35, rx * 0.95, ry * 0.7, Math.PI, TAU, 18);
    fills.fill([...shell, [rx * 0.95, cy + ry * 0.35], [-rx * 0.95, cy + ry * 0.35]], accent);
    ink.stroke(shell, { color: ink0, width: 0.012 });
    ink.stroke([[-rx * 0.2, cy + ry * 0.36], [-rx * 1.35, cy + ry * 0.28]], { color: ink0, width: 0.014 });
    return;
  }

  if (kind === "beret") {
    // 베레. 한쪽으로 기운 납작한 원반 + 꼭지.
    const tilt = (spec.seed % 2 ? 1 : -1) * 0.16;
    const bx = -tilt * rx * 0.8;
    const by = cy + ry * 0.82;
    const cos = Math.cos(tilt);
    const sin = Math.sin(tilt);
    const disc = blobPath(0, 0, rx * 0.92, ry * 0.3, { lumps: 4, amount: 0.12, noise: null })
      .map(([x, y]) => [bx + x * cos - y * sin, by + x * sin + y * cos]);
    fills.fill(disc, accent);
    ink.outline(disc, { color: ink0, width: 0.012, passes: 2 });
    ink.stroke([[bx, by + ry * 0.3], [bx + 0.012, by + ry * 0.42]], { color: ink0, width: 0.012 });
    return;
  }

  if (kind === "bonnet") {
    // 보닛 — 머리를 감싸는 두툼한 구름 테
    const rim = arcPath(0, cy, rx * 1.18, ry * 1.16, Math.PI * 1.15, -Math.PI * 0.15, 26);
    ink.stroke(rim, { color: accent, width: 0.05, jitter: 0.012 });
    ink.stroke(rim, { color: ink0, width: 0.01, jitter: 0.01, passes: 2 });
    return;
  }

  // pot — 머리에 뒤집어쓴 통
  const top = cy + ry * 1.05;
  const box2 = [
    [-rx * 0.75, cy + ry * 0.3],
    [-rx * 0.62, top],
    [rx * 0.62, top],
    [rx * 0.75, cy + ry * 0.3]
  ];
  fills.fill(box2, accent);
  ink.outline(box2, { color: ink0, width: 0.012 });
}

function drawHorns(ink, fills, spec, box, noise) {
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

function drawBody(ink, fills, spec, box, noise) {
  if (box.quad) {
    // 가로로 누운 몸. 머리가 앞쪽을 덮으므로 몸은 뒤로 뻗는다.
    const cx = box.bodyCx + box.bodyW * 0.35;
    const cy = (box.legTop + box.bodyTop) / 2;
    const path = blobPath(cx, cy, box.bodyW, (box.bodyTop - box.legTop) / 2, {
      lumps: 4, amount: 0.1, noise, phase: spec.proportions.wobbleSeed * 0.02
    });
    fills.fill(path, spec.palette.cloth, spec.palette.fillOffset);
    fills.scribbleFill(cx, cy, box.bodyW * 0.8, (box.bodyTop - box.legTop) * 0.4, {
      color: darken(spec.palette.cloth, spec.palette.cloth === spec.palette.ink ? 1.5 : 0.9),
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
    color: darken(spec.palette.cloth, spec.palette.cloth === spec.palette.ink ? 1.5 : 0.9),
    angle: Math.PI * 0.28, gap: 0.03, width: 0.006
  });
  ink.outline(path, { color: ink0, width: 0.012, passes: 2 });
  return { path, top, bottom, w, cx: 0 };
}

function drawMarks(ink, spec, body) {
  const kind = spec.parts.marks;
  if (kind === "none") return;
  const ink0 = spec.palette.ink;
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

function drawLimbs() {
  // 팔·다리는 본체에 굽지 않는다. scene이 limbSketches로 관절 피벗 메시를 세운다.
}

// 눈썹·입의 대체 상태. 쉬는 상태에서 이따금 이 상태로 넘어갔다 돌아온다.
const ALT_BROW = { none: "flat", flat: "worry", angry: "flat", worry: "flat" };
const ALT_MOUTH = { dot: "line", line: "wave", teeth: "open", open: "line", wave: "line", smile: "open" };

export function facePartKinds(spec) {
  return {
    brow: [spec.parts.brow, ALT_BROW[spec.parts.brow] || "flat"],
    mouth: [spec.parts.mouth, ALT_MOUTH[spec.parts.mouth] || "line"]
  };
}

// 눈썹 또는 입 한 상태를 독립 Sketch로 굽는다. scene이 상태별 메시로 세운다.
export function facePartSketch(spec, part, kind) {
  const rng = makeRng((spec.proportions.wobbleSeed + (part === "brow" ? 101 : 202)) >>> 0);
  const noise = makeNoise(rng);
  const sketch = new Sketch(noise, spec.proportions.wobble);
  const box = layout(spec);
  const eyes = eyeGeometry(spec, box);
  if (part === "brow") drawBrow(sketch, spec, box, eyes, kind);
  else drawMouth(sketch, sketch, spec, box, kind);
  return sketch;
}

// 스펙 하나를 그려서 지오메트리 재료를 돌려준다.
// 머리와 몸을 분리해 굽는다 — scene이 머리만 굴리고 끄덕일 수 있게.
// variant는 보일 프레임 번호다. 지터 위상만 달라지고 구도는 같다.
export function drawCreature(spec, variant = 0) {
  const rng = makeRng((spec.proportions.wobbleSeed ^ (variant * 0x9e3779b9)) >>> 0);
  const noise = makeNoise(rng);
  const wobble = spec.proportions.wobble;

  const bodyInk = new Sketch(noise, wobble);
  const bodyFills = new Sketch(noise, wobble);
  const headInk = new Sketch(noise, wobble);
  const headFills = new Sketch(noise, wobble);
  const box = layout(spec);
  const eyes = eyeGeometry(spec, box);

  const body = drawBody(bodyInk, bodyFills, spec, box, noise);
  drawMarks(bodyInk, spec, body);
  drawLimbs(bodyInk, spec, box, body, noise);

  drawEars(headInk, headFills, spec, box);
  drawHead(headInk, headFills, spec, box, noise);
  drawHorns(headInk, headFills, spec, box, noise);
  drawEyes(headInk, headFills, spec, box, eyes);
  drawFace2(headInk, headFills, spec, box, eyes);
  drawNose(headInk, headFills, spec, box, eyes);
  // 눈썹과 입은 여기서 굽지 않는다. 상태 전환을 위해 scene이
  // facePartSketch로 별도 메시를 세운다.
  if (spec.species === "cat") {
    const wy = box.headCy - box.headRy * 0.3;
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i += 1) {
        const y0 = wy + (i - 1) * 0.028;
        headInk.stroke([
          [side * box.headRx * 0.3, y0],
          [side * (box.headRx * 0.3 + 0.09), y0 + (i - 1) * 0.012]
        ], { color: spec.palette.ink, width: 0.006, jitter: 0.004 });
      }
    }
  }
  drawEyewear(headInk, headFills, spec, box, eyes);
  drawHair(headInk, spec, box, noise);
  drawHeadgear(headInk, headFills, spec, box);

  // 동공이 움직이는 눈만 골라 넘긴다. 외눈도 살아 있다.
  const live = ["ring", "wide", "cyclops"].includes(spec.parts.eyes)
    ? eyes.filter((e) => e.side !== spec.parts.patchSide)
    : [];

  return {
    body: { ink: bodyInk, fills: bodyFills },
    head: { ink: headInk, fills: headFills },
    eyes: live,
    box,
    // 머리 회전 축. 몸 꼭대기(턱 언저리)다.
    neckY: box.bodyTop,
    headTop: box.headCy + box.headRy,
    quad: box.quad
  };
}

// 관절 팔다리. 각 지체는 피벗(어깨·엉덩이) 원점 기준으로 그린다.
// scene이 rotation.z로 흔든다.
//
// 레퍼런스(관절부 4배 확대): 지체는 몸 윤곽 안쪽에서 나오고, 팔은 유형이
// 여럿이며(뒷짐·소매+동그란 손·스텁+주먹·늘어짐), 다리 끝에는 항상 동그란
// 발이 있다. 뿌리를 윤곽 안으로 넣어야 관절이 "박혀" 보인다.
//
// 반환: [{ sketch, pivot: [x, y], kind: "arm"|"leg", side, index, behind }]
export function limbSketches(spec) {
  const rng = makeRng((spec.proportions.wobbleSeed + 303) >>> 0);
  const noise = makeNoise(rng);
  const box = layout(spec);
  const p = spec.proportions;
  const ink0 = spec.palette.ink;
  const skin = spec.palette.skin;
  const cloth = spec.palette.cloth;
  const limbs = [];

  const make = () => new Sketch(noise, p.wobble);
  const dot = (s, x, y, r, color) => {
    s.fill(blobPath(x, y, r, r * 0.9, { lumps: 3, amount: 0.18, noise: null }), color);
    s.outline(blobPath(x, y, r, r * 0.9, { lumps: 3, amount: 0.18, noise: null }), { color: ink0, width: 0.009 });
  };

  if (box.quad) {
    // 네 다리 — 몸통 밑에 붙은 짧은 스텁 + 발가락 표시.
    // 뿌리는 몸 윤곽 안쪽(bodyH의 25% 위)에서 시작한다.
    const cx = box.bodyCx + box.bodyW * 0.35;
    const hipY = box.legTop + box.bodyH * 0.25;
    [-0.62, -0.22, 0.28, 0.66].forEach((tt, i) => {
      const x = cx + box.bodyW * tt;
      const s = make();
      const len = hipY;
      const lean = noise(tt * 7.1) * 0.012;
      // 굵은 스텁 다리
      s.stroke([[0, 0], [lean, -len]], { color: ink0, width: 0.016 });
      // 발 — 살짝 앞으로 나온 둥근 발끝 + 발가락 두 줄
      s.stroke([[lean - 0.02, -len], [lean + 0.03, -len + 0.003]], { color: ink0, width: 0.012 });
      s.stroke([[lean + 0.006, -len + 0.002], [lean + 0.01, -len + 0.016]], { color: ink0, width: 0.006 });
      s.stroke([[lean + 0.018, -len + 0.002], [lean + 0.021, -len + 0.014]], { color: ink0, width: 0.006 });
      limbs.push({ sketch: s, pivot: [x, hipY], kind: "leg", side: i < 2 ? -1 : 1, index: i, behind: false });
    });
    return limbs;
  }

  // ── 두발 다리 ──
  // 뿌리는 몸 밑단보다 살짝 위(윤곽 안). 끝에는 항상 발.
  const hipY = box.legTop + 0.02;
  const legKind = spec.parts.legs;
  for (const side of [-1, 1]) {
    const spread = legKind === "wide" ? 0.72 : 0.5;
    const x = side * box.bodyW * spread;
    const s = make();
    const len = hipY;
    let footX = 0;
    if (legKind === "bent") {
      s.stroke([[0, 0], [side * 0.04, -len * 0.5], [side * 0.01, -len]], { color: ink0, width: 0.011 });
      footX = side * 0.01;
    } else if (legKind === "stub") {
      s.stroke([[0, 0], [0, -len]], { color: ink0, width: 0.019 });
    } else if (legKind === "tiptoe") {
      // 발끝으로 선 가는 다리 — 발이 아래로 뾰족
      s.stroke([[0, 0], [side * 0.008, -len]], { color: ink0, width: 0.009 });
      s.stroke([[side * 0.008 - 0.012, -len + 0.012], [side * 0.008, -len], [side * 0.008 + 0.012, -len + 0.012]], { color: ink0, width: 0.009 });
      limbs.push({ sketch: s, pivot: [x, hipY], kind: "leg", side, index: side < 0 ? 0 : 1, behind: false });
      continue;
    } else {
      s.stroke([[0, 0], [noise(side * 3.3) * 0.02, -len]], { color: ink0, width: legKind === "wide" ? 0.014 : 0.011 });
      footX = noise(side * 3.3) * 0.02;
    }
    // 발
    if (legKind === "boots") {
      // 부츠 — 발목까지 채워진 덩어리
      const boot = [[footX - 0.028, -len], [footX - 0.024, -len + 0.045], [footX + 0.012, -len + 0.045], [footX + 0.036, -len + 0.006], [footX + 0.036, -len]];
      s.fill(boot, cloth === skin ? ink0 : darken(cloth, 0.75));
      s.outline(boot, { color: ink0, width: 0.01 });
    } else {
      // 동그란 발 — 레퍼런스 기본
      dot(s, footX + side * 0.008, -len + 0.012, 0.022, skin);
    }
    limbs.push({ sketch: s, pivot: [x, hipY], kind: "leg", side, index: side < 0 ? 0 : 1, behind: false });
  }

  // ── 두발 팔 ──
  const armKind = spec.parts.arms;
  // 어깨는 몸 윤곽 안쪽. 몸 폭의 78%에서 시작해 소매가 윤곽을 덮는다.
  const shoulderY = box.bodyTop - (box.bodyTop - box.legTop) * 0.22;
  for (const side of [-1, 1]) {
    const x = side * box.bodyW * (spec.parts.body === "dress" ? 0.7 : 0.78);
    const reach = 0.11 * p.armSpread;
    const s = make();

    if (armKind === "behind") {
      // 뒷짐 — 팔이 몸 뒤로 사라지고 팔꿈치 끝만 옆구리로 삐죽 나온다
      s.stroke([[0, 0], [side * 0.03, -0.045], [side * 0.05, -0.08]], { color: ink0, width: 0.011 });
      limbs.push({ sketch: s, pivot: [x, shoulderY], kind: "arm", side, index: 0, behind: true });
      continue;
    }

    if (armKind === "stubby") {
      // 스텁 팔 + 주먹 — 짧고 굵게 옆으로
      s.stroke([[0, 0], [side * reach * 0.45, -reach * 0.35]], { color: ink0, width: 0.017 });
      dot(s, side * reach * 0.5, -reach * 0.4, 0.02, skin);
      limbs.push({ sketch: s, pivot: [x, shoulderY], kind: "arm", side, index: 0, behind: false });
      continue;
    }

    if (armKind === "sleeve") {
      // 소매 — 옷색 통 + 끝에 동그란 손
      const sl = [[side * -0.012, 0.012], [side * 0.012, 0.012], [side * reach * 0.42, -reach * 0.62], [side * reach * 0.22, -reach * 0.7]];
      s.fill(sl, cloth);
      s.outline(sl, { color: ink0, width: 0.01 });
      dot(s, side * reach * 0.34, -reach * 0.78, 0.022, skin);
      limbs.push({ sketch: s, pivot: [x, shoulderY], kind: "arm", side, index: 0, behind: false });
      continue;
    }

    // down / out / up / mitten — 막대 팔. 끝에 손.
    s.stroke([[0, 0], [side * reach * 0.25, -reach * 0.5], [side * reach * 0.35, -reach]], { color: ink0, width: 0.01 });
    if (armKind === "mitten") {
      dot(s, side * reach * 0.36, -reach * 1.02, 0.024, skin);
    } else {
      s.stroke([[side * reach * 0.35 - 0.016, -reach], [side * reach * 0.35 + 0.016, -reach + 0.004]], { color: ink0, width: 0.01 });
    }
    limbs.push({ sketch: s, pivot: [x, shoulderY], kind: "arm", side, index: 0, behind: false });
  }
  return limbs;
}

// 팔 쉼 포즈의 기준 각도. down은 늘어짐, out은 옆으로, up은 위로.
export function armRestAngle(spec, side) {
  const pose = spec.parts.arms;
  const outward = -side;
  if (pose === "up") return outward * 2.4;
  if (pose === "out") return outward * 1.35;
  if (pose === "stubby") return outward * 0.9;
  if (pose === "sleeve") return outward * 0.6;
  if (pose === "behind") return outward * -0.2;
  return outward * 0.35;
}

// 꼬리. 피벗(꼬리 뿌리) 원점 기준으로 그린다. scene이 회전시켜 살랑거린다.
export function tailSketch(spec) {
  const rng = makeRng((spec.proportions.wobbleSeed + 404) >>> 0);
  const noise = makeNoise(rng);
  const sketch = new Sketch(noise, spec.proportions.wobble);
  const box = layout(spec);
  if (!box.quad) return { sketch, pivot: [0, 0] };

  const p = spec.proportions;
  const ink0 = spec.palette.ink;
  const cx = box.bodyCx + box.bodyW * 0.35;
  const pivot = [cx + box.bodyW * 0.98, (box.bodyTop + box.legTop) / 2 + box.bodyH * 0.1];
  const kind = spec.parts.tail;

  if (kind === "curl") {
    sketch.stroke([
      [0, 0], [0.05, 0.08], [0.03 + p.tailLift * 0.02, 0.16], [-0.015, 0.2]
    ], { color: ink0, width: 0.011 });
  } else if (kind === "flag") {
    sketch.stroke([[0, 0], [0.025, 0.1], [0.01 + p.tailLift * 0.02, 0.2]], { color: ink0, width: 0.012 });
  } else if (kind === "longtail") {
    sketch.stroke([
      [0, 0], [0.07, 0.015], [0.14, 0.05], [0.18, 0.12 + p.tailLift * 0.02]
    ], { color: ink0, width: 0.011 });
  } else {
    // stubtail — 뭉툭한 꼬리
    sketch.stroke([[0, 0], [0.035, 0.05]], { color: ink0, width: 0.02 });
  }
  return { sketch, pivot };
}
