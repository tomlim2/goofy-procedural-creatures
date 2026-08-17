// 모자·뿔 — 머리 위에 얹히는 것. 문서: guidelines/character/parts.md § headgear · horns
// 모자는 눈썹 선(head.js browLine) 위에 앉고 머리 윤곽 모양(layout.js headShape)을 따라 덮는다.

import { blobPath, arcPath } from "../../stroke.js";
import { headShape } from "./layout.js";
import { browLine } from "./head.js";

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
