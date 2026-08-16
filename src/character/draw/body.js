// 몸 — 몸통·무늬. 문서: guidelines/character/parts.md § 몸

import { blobPath } from "../../stroke.js";
import { darken, isDark } from "./layout.js";

export function drawBody(ink, fills, spec, box, noise) {
  if (box.quad) {
    // 가로로 누운 몸. 머리가 앞쪽을 덮으므로 몸은 뒤로 뻗는다.
    const cx = box.bodyCx + box.bodyW * 0.35;
    const cy = (box.legTop + box.bodyTop) / 2;
    const path = blobPath(cx, cy, box.bodyW, (box.bodyTop - box.legTop) / 2, {
      lumps: 4, amount: 0.1, noise, phase: spec.proportions.wobbleSeed * 0.02
    });
    fills.fill(path, spec.palette.cloth, spec.palette.fillOffset);
    fills.scribbleFill(cx, cy, box.bodyW * 0.8, (box.bodyTop - box.legTop) * 0.4, {
      color: darken(spec.palette.cloth, isDark(spec.palette.cloth) ? 1.5 : 0.9),
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
    color: darken(spec.palette.cloth, isDark(spec.palette.cloth) ? 1.5 : 0.9),
    angle: Math.PI * 0.28, gap: 0.03, width: 0.006
  });
  ink.outline(path, { color: ink0, width: 0.012, passes: 2 });
  return { path, top, bottom, w, cx: 0 };
}

export function drawMarks(ink, spec, body) {
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

