// The shapes — the closed curves and arcs everything on the board is built from. Docs: guidelines/drawing.md § nothing raw, how.html § the shapes

// An irregular closed curve. The reference's head is not a circle but a lumpy mass.
//
// square: how much the superellipse exponent rises. 0 is an ellipse, around 1.5 a rounded square.
// taper: the top/bottom width ratio. Positive is wider at the bottom (a pear), negative wider at the top.
// Without a noise (the details: eyes, noses, hands, tail ends — shapes that must not boil), the lumps come from two sines of the angle
// (the reference's recipe: 0.63·sin(2θ+p1) + 0.37·sin(5θ+p2), the phases from `phase`) — so amount works there too and **no blobPath is
// ever a perfect ellipse**. Noise or sines, `amount` is the word for how far the radius wanders
export function blobPath(cx, cy, rx, ry, { lumps = 5, amount = 0.08, noise, phase = 0, steps = 48, square = 0, taper = 0 } = {}) {
  const n = 2 + square;
  const points = [];
  const p1 = phase * 1.7, p2 = phase * 0.9 + 1.3;
  for (let i = 0; i < steps; i += 1) {
    const angle = (i / steps) * Math.PI * 2;
    const c = Math.cos(angle);
    const sSin = Math.sin(angle);
    const ux = Math.sign(c) * Math.pow(Math.abs(c), 2 / n);
    const uy = Math.sign(sSin) * Math.pow(Math.abs(sSin), 2 / n);
    const widen = 1 - taper * uy;
    const lumpiness = noise ? noise(phase + c * lumps + sSin * lumps) : 0.63 * Math.sin(2 * angle + p1) + 0.37 * Math.sin(5 * angle + p2);
    const r = 1 + lumpiness * amount;
    points.push([cx + ux * rx * widen * r, cy + uy * ry * r]);
  }
  return points;
}

// Takes the ruler out of a hand-written polygon (a boot, a sleeve, a pot, a brim, a fang): the edges are re-sampled every `step` and every
// point pushed along its normal by two sines of its position — a crumple that keeps the corners where they are (amount in world units).
// No drawn edge on the board is a straight line; the contour strokes wobble already, this is for the fills under them and the shapes
// that are only a fill
export function crumple(points, amount = 0.0035, phase = 0, step = 0.012) {
  const n = points.length;
  const out = [];
  let k = 0;
  for (let i = 0; i < n; i += 1) {
    const [ax, ay] = points[i];
    const [bx, by] = points[(i + 1) % n];
    const len = Math.hypot(bx - ax, by - ay);
    const segs = Math.max(1, Math.round(len / step));
    const nx = -(by - ay) / (len || 1), ny = (bx - ax) / (len || 1);
    for (let j = 0; j < segs; j += 1, k += 1) {
      const t = j / segs;
      const push = j === 0 ? 0 : amount * (0.63 * Math.sin(k * 0.9 + phase) + 0.37 * Math.sin(k * 2.3 + phase * 1.7));   // the corners stay
      out.push([ax + (bx - ax) * t + nx * push, ay + (by - ay) * t + ny * push]);
    }
  }
  return out;
}

export function arcPath(cx, cy, rx, ry, from, to, steps = 16) {
  const points = [];
  for (let i = 0; i <= steps; i += 1) {
    const angle = from + ((to - from) * i) / steps;
    points.push([cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry]);
  }
  return points;
}
