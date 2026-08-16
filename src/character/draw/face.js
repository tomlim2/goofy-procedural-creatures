// 얼굴 — 눈·눈썹·안경·코·볼·입. 눈썹과 입은 상태 전환 대상이라 별도 스케치로도 굽는다.
// 문서: guidelines/character/parts.md § 머리 (eyes~mouth), guidelines/motion/catalog.md § 얼굴

import { Sketch, blobPath, arcPath } from "../../stroke.js";
import { makeNoise, makeRng } from "../../rng.js";
import { TAU, layout, eyeGeometry } from "./layout.js";
import { SPECIES } from "../vocabulary/species.js";

export function drawEyes(ink, fills, spec, box, eyes) {
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

export function drawFace2(ink, fills, spec, box, eyes) {
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

export function drawBrow(ink, spec, box, eyes, kindOverride) {
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

// 안경알 반지름 = 눈 반지름 × 배율. spec.js가 두 알이 겹치는지 판정할 때도 같은 값을 쓴다.
export const LENS_SCALE = { glasses: 1.45, goggles: 1.75 };

export function drawEyewear(ink, fills, spec, box, eyes) {
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

export function drawNose(ink, fills, spec, box, eyes) {
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

export function drawMouth(ink, fills, spec, box, kindOverride) {
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

// 눈썹·입의 대체 상태. 쉬는 상태에서 이따금 이 상태로 넘어갔다 돌아온다.
const ALT_BROW = { none: "flat", flat: "worry", angry: "flat", worry: "flat" };

const ALT_MOUTH = { dot: "line", line: "wave", teeth: "open", open: "line", wave: "line", smile: "open" };

// 쉼/대체 두 벌. 대체 값에도 종족 forbid를 적용한다 — 눈썹이 없는 종족(개·고양이)이 기분 전환 때 눈썹을 달면 안 된다
export function facePartKinds(spec) {
  const forbid = (SPECIES.find((s) => s.name === spec.species) || {}).forbid || {};
  const allow = (slot, value) => (forbid[slot] && forbid[slot][value] !== undefined ? forbid[slot][value] : value);
  return {
    brow: [spec.parts.brow, allow("brow", ALT_BROW[spec.parts.brow] || "flat")],
    mouth: [spec.parts.mouth, allow("mouth", ALT_MOUTH[spec.parts.mouth] || "line")]
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

