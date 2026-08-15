// 스펙 → 획. 여기서는 무엇을 고를지 정하지 않는다. 이미 정해진 것을 그릴 뿐이다.
//
// 좌표계는 셀 안의 로컬 공간이다. 바닥이 y=0, 머리 꼭대기가 대략 y=1.05.

import { Sketch, blobPath, arcPath } from "./stroke.js";
import { makeNoise, makeRng } from "./rng.js";

const TAU = Math.PI * 2;

// 스펙에서 실제 치수를 뽑는다. 그리기 함수들이 전부 이 값을 공유한다.
function layout(spec) {
  const p = spec.proportions;
  const legTop = p.legLength * 0.55;
  const bodyH = 0.28 * (p.bodyScale / 0.52);
  const bodyW = 0.23 * p.bodyWide;
  const bodyTop = legTop + bodyH;
  const headRy = 0.3 * p.headScale;
  const headRx = headRy * p.headWide;
  const headCy = bodyTop + headRy * 0.72;

  return { legTop, bodyH, bodyW, bodyTop, headRx, headRy, headCy };
}

function eyeGeometry(spec, box) {
  const p = spec.proportions;
  const gap = box.headRx * p.eyeGap;
  const base = box.headRy * p.eyeSize * 1.35;
  const y = box.headCy + box.headRy * p.eyeHeight;

  // 좌우를 일부러 어긋나게 둔다. 대칭이면 즉시 도형처럼 보인다.
  return [
    { side: -1, x: -gap, y: y + box.headRy * p.eyeHeightSkew, r: base * (1 - p.eyeSizeSkew) },
    { side: 1, x: gap, y: y - box.headRy * p.eyeHeightSkew, r: base * (1 + p.eyeSizeSkew) }
  ];
}

function drawHead(ink, fills, spec, box, noise) {
  const p = spec.proportions;
  const path = blobPath(0, box.headCy, box.headRx, box.headRy, {
    lumps: p.headLumps,
    amount: p.headLump,
    noise,
    phase: p.wobbleSeed * 0.01
  });

  fills.fill(path, spec.palette.skin, spec.palette.fillOffset);
  ink.outline(path, { color: spec.palette.ink, width: 0.014, jitter: 0.008, passes: 2 });
  return path;
}

function drawEars(ink, spec, box) {
  const kind = spec.parts.ears;
  if (kind === "none") return;
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
  const ink0 = spec.palette.ink;

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
    } else if (kind === "half") {
      ink.outline(blobPath(eye.x, eye.y, eye.r, eye.r, { lumps: 3, amount: 0.1, noise: null }), {
        color: ink0, width: 0.011
      });
      ink.stroke([[eye.x - eye.r * 1.1, eye.y + eye.r * 0.25], [eye.x + eye.r * 1.1, eye.y + eye.r * 0.35]], {
        color: ink0, width: 0.013
      });
    } else {
      // ring / wide — 흰자를 남기고 동공은 따로 움직인다
      fills.fill(blobPath(eye.x, eye.y, eye.r, eye.r, { lumps: 3, amount: 0.08, noise: null }), "#f6f2e9");
      ink.outline(blobPath(eye.x, eye.y, eye.r, eye.r, { lumps: 4, amount: 0.1, noise: null }), {
        color: ink0, width: 0.011, passes: 2
      });
    }
  }
}

function drawBrow(ink, spec, box, eyes) {
  const kind = spec.parts.brow;
  if (kind === "none") return;

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
      color: spec.palette.ink, width: 0.012, jitter: 0.008
    });
  }
}

function drawEyewear(ink, fills, spec, box, eyes) {
  const kind = spec.parts.eyewear;
  if (kind === "none") return;
  const ink0 = spec.palette.ink;

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

function drawNose(ink, spec, box, eyes) {
  const kind = spec.parts.nose;
  if (kind === "none") return;
  const y = box.headCy - box.headRy * spec.proportions.noseDrop;
  const ink0 = spec.palette.ink;

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

function drawMouth(ink, fills, spec, box) {
  const kind = spec.parts.mouth;
  const y = box.headCy - box.headRy * spec.proportions.mouthDrop;
  const ink0 = spec.palette.ink;
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
  const ink0 = spec.palette.ink;
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
  const accent = spec.palette.accent;
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

  for (const side of [-1, 1]) {
    const bx = side * rx * 0.6;
    const by = cy + ry * 0.82;
    const lean = noise(side * 9.1 + spec.seed * 0.0007) * 0.06;

    if (kind === "curved") {
      ink.stroke([
        [bx, by],
        [bx + side * 0.06, by + 0.09],
        [bx + side * 0.02 + lean, by + 0.17]
      ], { color: ink0, width: 0.015 });
    } else if (kind === "straight") {
      ink.stroke([[bx, by], [bx + side * 0.05 + lean, by + 0.2]], { color: ink0, width: 0.014 });
    } else if (kind === "antenna") {
      const tipX = bx + side * 0.05 + lean;
      const tipY = by + 0.24;
      ink.stroke([[bx, by], [tipX, tipY]], { color: ink0, width: 0.008 });
      fills.fill(blobPath(tipX, tipY, 0.022, 0.022, { lumps: 3, amount: 0.2, noise: null }), ink0);
    } else {
      ink.outline(blobPath(bx, by + 0.035, 0.033, 0.045, { lumps: 3, amount: 0.15, noise: null }), {
        color: ink0, width: 0.011
      });
    }
  }
}

function drawBody(ink, fills, spec, box, noise) {
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
  ink.outline(path, { color: ink0, width: 0.012, passes: 2 });
  return { path, top, bottom, w };
}

function drawMarks(ink, spec, body) {
  const kind = spec.parts.marks;
  if (kind === "none") return;
  const ink0 = spec.palette.ink;
  const { top, bottom, w } = body;

  if (kind === "stripes") {
    for (let i = 1; i <= 3; i += 1) {
      const y = bottom + ((top - bottom) * i) / 4;
      ink.stroke([[-w * 0.85, y], [w * 0.85, y + 0.004]], { color: ink0, width: 0.011 });
    }
  } else if (kind === "dots") {
    for (let i = 0; i < 4; i += 1) {
      const x = -w * 0.5 + (i % 2) * w;
      const y = bottom + (top - bottom) * (0.3 + Math.floor(i / 2) * 0.35);
      ink.stroke([[x - 0.008, y], [x + 0.008, y]], { color: ink0, width: 0.012 });
    }
  } else if (kind === "hatch") {
    ink.hatch(0, (top + bottom) / 2, w * 0.8, (top - bottom) * 0.35, Math.PI * 0.25, {
      color: ink0, lines: 5, width: 0.007
    });
  } else {
    ink.hatch(-w * 0.35, (top + bottom) / 2, w * 0.4, (top - bottom) * 0.25, 0, {
      color: ink0, lines: 4, width: 0.008
    });
  }
}

function drawLimbs(ink, spec, box, body, noise) {
  const ink0 = spec.palette.ink;
  const p = spec.proportions;

  // 다리
  for (const side of [-1, 1]) {
    const x = side * box.bodyW * 0.5;
    if (spec.parts.legs === "bent") {
      ink.stroke([[x, box.legTop], [x + side * 0.04, box.legTop * 0.5], [x + side * 0.01, 0]], {
        color: ink0, width: 0.011
      });
    } else if (spec.parts.legs === "stub") {
      // 짧고 굵은 다리. 짧다고 바닥에서 띄우면 발만 공중에 남는다.
      ink.stroke([[x, box.legTop], [x, 0]], { color: ink0, width: 0.019 });
    } else {
      ink.stroke([[x, box.legTop], [x + noise(side * 3.3) * 0.02, 0]], { color: ink0, width: 0.011 });
    }
    // 발
    ink.stroke([[x - 0.025, 0], [x + 0.03, 0.004]], { color: ink0, width: 0.011 });
  }

  // 팔
  const shoulder = box.bodyTop - (box.bodyTop - box.legTop) * 0.25;
  for (const side of [-1, 1]) {
    const x = side * box.bodyW * (spec.parts.body === "dress" ? 0.9 : 0.95);
    const reach = 0.11 * p.armSpread;
    let end;
    if (spec.parts.arms === "up") end = [x + side * reach, shoulder + 0.09];
    else if (spec.parts.arms === "out") end = [x + side * reach * 1.5, shoulder + 0.01];
    else end = [x + side * reach * 0.6, shoulder - 0.1];
    ink.stroke([[x, shoulder], end], { color: ink0, width: 0.01 });
    ink.stroke([[end[0] - 0.016, end[1]], [end[0] + 0.016, end[1] + 0.004]], { color: ink0, width: 0.01 });
  }
}

// 스펙 하나를 그려서 지오메트리 재료를 돌려준다.
// eyes 정보는 동공·눈꺼풀을 따로 움직이기 위해 scene.js로 넘긴다.
export function drawCreature(spec) {
  const rng = makeRng(spec.proportions.wobbleSeed);
  const noise = makeNoise(rng);
  const wobble = spec.proportions.wobble;

  const ink = new Sketch(noise, wobble);
  const fills = new Sketch(noise, wobble);
  const box = layout(spec);
  const eyes = eyeGeometry(spec, box);

  const body = drawBody(ink, fills, spec, box, noise);
  drawMarks(ink, spec, body);
  drawLimbs(ink, spec, box, body, noise);

  drawEars(ink, spec, box);
  drawHead(ink, fills, spec, box, noise);
  drawHorns(ink, fills, spec, box, noise);
  drawEyes(ink, fills, spec, box, eyes);
  drawBrow(ink, spec, box, eyes);
  drawNose(ink, spec, box, eyes);
  drawMouth(ink, fills, spec, box);
  drawEyewear(ink, fills, spec, box, eyes);
  drawHair(ink, spec, box, noise);
  drawHeadgear(ink, fills, spec, box);

  // 동공이 움직이는 눈만 골라 넘긴다. 감은 눈은 깜빡일 것도 없다.
  const live = ["ring", "wide", "half"].includes(spec.parts.eyes)
    ? eyes.filter((e) => e.side !== spec.parts.patchSide)
    : [];

  return { ink, fills, eyes: live, box, headTop: box.headCy + box.headRy };
}
