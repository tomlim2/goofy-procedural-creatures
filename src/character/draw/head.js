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

  if (spec.species === "pup") {
    // 개 귀 — 종류마다 다르다. 뿌리는 **머리 윤곽 위**(얼굴 양끝) — 안쪽에 두면 얼굴에서 돋는 것처럼 보인다.
    // 윤곽 위 점은 타원(headRx·headRy) 위 극각 θ(정수리에서 잰 각)로 잡고, 바깥 법선 n을 따라 세우거나 밑으로 늘어뜨린다.
    //   pointy 쫑긋 선 세모귀(셰퍼드, θ 38°) · round 작은 동그란 귀(퍼그, 55°) · 로브 셋은 **지름 끝**(가장 넓은 옆, 90°)에서
    //   늘어진다 — flap 레퍼런스 비글 · long 턱 아래까지(바셋) · fold 옆으로 접혀 끝만 처짐 · none 없음. 채운 로브 + 두 번 덧그은 윤곽.
    const earFill = darken(spec.palette.skin, 0.8);
    const earInk = { color: spec.palette.ink, width: 0.011, passes: 2 };
    const theta = { pointy: 0.66, round: 0.96, flap: 1.5, long: 1.5, fold: 1.5 }[kind] || 1.5;
    for (const side of [-1, 1]) {
      // 윤곽 위 뿌리와 바깥 법선
      const rx = box.headRx, ry = box.headRy;
      const bx = side * rx * Math.sin(theta);
      const by = box.headCy + ry * Math.cos(theta);
      let nx = side * Math.sin(theta) / rx, ny = Math.cos(theta) / ry;
      const nl = Math.hypot(nx, ny); nx /= nl; ny /= nl;
      const tx = -ny * side, ty = nx * side;   // 접선 (바깥쪽 기준 좌우)
      let path;
      if (kind === "pointy") {
        // 밑변은 윤곽 위, 끝은 법선 방향으로 위로
        const len = ry * 0.6;
        path = [
          [bx - tx * 0.04 - nx * 0.01, by - ty * 0.04 - ny * 0.01],
          [bx + nx * len + tx * 0.005, by + ny * len + ty * 0.005],
          [bx + tx * 0.045 - nx * 0.01, by + ty * 0.045 - ny * 0.01]
        ];
      } else if (kind === "round") {
        path = blobPath(bx + nx * 0.028, by + ny * 0.028, 0.042, 0.04, { lumps: 3, amount: 0.15, noise: null });
      } else if (kind === "fold") {
        // 옆으로 접힌 귀 — 뿌리에서 바깥으로 삐죽 나갔다가 끝이 아래로 처진다
        const out = 0.075;
        path = [
          [bx - nx * 0.01, by + 0.025], [bx + side * out * 0.8, by + 0.05], [bx + side * out, by - 0.015],
          [bx + side * out * 0.85, by - ry * 0.45], [bx + side * 0.03, by - ry * 0.4], [bx, by - 0.02]
        ];
      } else {
        // flap / long — 뿌리에서 바깥·아래로 늘어지는 로브
        const len = ry * (kind === "long" ? 0.95 : 0.65);
        path = blobPath(bx + side * 0.032, by - len * 0.5 + 0.01, 0.045, len * 0.5 + 0.02, { lumps: 3, amount: 0.12, noise: null });
      }
      fills.fill(path, earFill);
      ink.outline(path, earInk);
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

