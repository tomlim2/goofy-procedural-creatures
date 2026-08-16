// 머리 — 윤곽·귀·머리카락·모자·뿔. 문서: guidelines/character/parts.md § 머리

import { blobPath, arcPath } from "../../stroke.js";
import { TAU, headShape, darken, isDark } from "./layout.js";

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

export function drawEars(ink, fills, spec, box) {
  const kind = spec.parts.ears;
  if (kind === "none") return;
  // 개 귀는 머리 뒤가 아니라 **머리 위에** 그린다 (drawPupEars, 머리 다음) — 안쪽으로 기운 귀가 얼굴에 가려지지 않게
  if (spec.species === "pup") return;

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

// 개 귀 — 머리(채색·윤곽) **위에** 그린다. 안쪽으로 기운 귀라 머리 뒤에 그리면 얼굴에 묻힌다.
export function drawPupEars(ink, fills, spec, box) {
  const kind = spec.parts.ears;
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
    const tx = -ny * side, ty = nx * side;
    const local = (u, v) => [bx + ax * u + tx * v, by + ay * u + ty * v];   // u 귀 축, v 접선
    let path;
    if (kind === "pointy") {
      // 밑변은 윤곽까지 끌어와 박고, 끝은 귀 축을 따라 밖으로
      const len = ry * 0.6;
      path = [local(-OUT - 0.005, 0.045), local(len, 0.005), local(-OUT - 0.005, -0.04)];
    } else if (kind === "round") {
      // 귀 축 방향으로 길쭉한 동그란 귀 — 안쪽이 윤곽에 살짝 걸친다
      const [cx, cy] = local(-OUT + 0.055, 0);
      path = rotate(blobPath(cx, cy, 0.036, 0.046, { lumps: 3, amount: 0.15, noise: null }), cx, cy, side * lean);
    } else if (kind === "fold") {
      // 접힌 귀 — 윤곽에서 귀 축을 따라 삐죽 나갔다가 끝이 턱 쪽(−접선)으로 접혀 처진다
      const b0 = -OUT - 0.005;
      path = [local(b0, 0.03), local(0.07, 0.035), local(0.085, -0.01), local(0.06, -0.08), local(0.02, -0.065), local(b0, -0.03)];
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

