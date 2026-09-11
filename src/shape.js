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

// Whether the fan from the centre — how `Sketch.fill` (stroke.js) cuts a shape into triangles — covers exactly this shape. The
// fan's triangle for an edge is turned the wrong way when the shape's centre lies on that edge's outer side (the edge is not
// visible from the centre), and a turned triangle is painted **outside the outline** — across a bend's inner corner, into a
// spiral's eye, over a notch — or twice over inside a fold. Measures it for one polygon; scripts/fanspill.mjs walks every part
// through it. Docs: guidelines/character/rules.md § a fill has to be visible from its centre
//   area       the shape's own area
//   turned     how many edges are turned, and turnedArea their triangles' area — the most the fan can paint where it should not
//   spill      that area as a share of the shape's — 0 for a shape the fan is right for (a star-shaped one)
//   crossings  how many pairs of edges cross — a self-crossing outline, which ear clipping (fillPolygon) cannot mend either
export function fanSpill(points) {
  const n = points.length;
  const out = { area: 0, turned: 0, turnedArea: 0, spill: 0, crossings: 0 };
  if (n < 3) return out;
  // Self-crossings — every pair of edges that are not neighbours, tested for a proper crossing
  const side = (ox, oy, ax, ay, bx, by) => (ax - ox) * (by - oy) - (ay - oy) * (bx - ox);
  for (let i = 0; i < n; i += 1) {
    const [ax, ay] = points[i], [bx, by] = points[(i + 1) % n];
    for (let j = i + 2; j < n; j += 1) {
      if (i === 0 && j === n - 1) continue;
      const [px, py] = points[j], [qx, qy] = points[(j + 1) % n];
      if (side(ax, ay, bx, by, px, py) * side(ax, ay, bx, by, qx, qy) < 0 && side(px, py, qx, qy, ax, ay) * side(px, py, qx, qy, bx, by) < 0) out.crossings += 1;
    }
  }
  let cx = 0, cy = 0;
  for (const [x, y] of points) { cx += x / n; cy += y / n; }
  const twice = [];   // each fan triangle's signed area, doubled — their sum is the shape's, whichever way it turns
  let total = 0;
  for (let i = 0; i < n; i += 1) {
    const [ax, ay] = points[i], [bx, by] = points[(i + 1) % n];
    const t = (ax - cx) * (by - cy) - (bx - cx) * (ay - cy);
    twice.push(t);
    total += t;
  }
  out.area = Math.abs(total) / 2;
  if (out.area < 1e-18) return out;
  const sign = Math.sign(total);
  for (const t of twice) {
    if (Math.sign(t) !== -sign || Math.abs(t) <= Math.abs(total) * 1e-9) continue;   // a flat or a vanishing edge is not a turned one
    out.turned += 1;
    out.turnedArea += Math.abs(t) / 2;
  }
  out.spill = out.turnedArea / out.area;
  return out;
}

// How much of the fan lands **outside** the outline, past the ink — what a spill looks like on the board. A turned triangle
// (fanSpill) runs from its edge to the centre, and most of it can lie inside the shape (a crumple's notch flips a hair of the
// outline, and the fan's triangle to it doubles over the shape's own paint, which shows nothing); what shows is the part of it
// past the outline, less a sliver along the edge that the contour's own width hides. The turned triangles are sampled on a
// grid over their bounds: a sample counts when it is inside one, outside the polygon (even-odd) and further than `margin` from
// the outline. leak: that area · share: as a share of the shape's area — 0 for a star-shaped shape
export function fanLeak(points, { margin = 0.004, grid = 64 } = {}) {
  const n = points.length;
  const m = fanSpill(points);
  if (!m.turned) return { leak: 0, share: 0 };
  let cx = 0, cy = 0;
  for (const [x, y] of points) { cx += x / n; cy += y / n; }
  let total = 0;
  const t = points.map(([ax, ay], i) => { const [bx, by] = points[(i + 1) % n]; const v = (ax - cx) * (by - cy) - (bx - cx) * (ay - cy); total += v; return v; });
  const sign = Math.sign(total);
  const tri = [];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < n; i += 1) {
    if (Math.sign(t[i]) !== -sign || Math.abs(t[i]) <= Math.abs(total) * 1e-9) continue;
    const a = points[i], b = points[(i + 1) % n];
    tri.push([a, b]);
    for (const [x, y] of [a, b, [cx, cy]]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  }
  const side = (ax, ay, bx, by, px, py) => (bx - ax) * (py - ay) - (by - ay) * (px - ax);
  const inTurned = (px, py) => tri.some(([a, b]) => {
    const s1 = side(cx, cy, a[0], a[1], px, py), s2 = side(a[0], a[1], b[0], b[1], px, py), s3 = side(b[0], b[1], cx, cy, px, py);
    return (s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0);
  });
  const inPolygon = (px, py) => {
    let inside = false;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const [xi, yi] = points[i], [xj, yj] = points[j];
      if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
  const nearOutline = (px, py) => {
    for (let i = 0; i < n; i += 1) {
      const [ax, ay] = points[i], [bx, by] = points[(i + 1) % n];
      const dx = bx - ax, dy = by - ay;
      const u = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1e-18)));
      const ex = ax + dx * u - px, ey = ay + dy * u - py;
      if (ex * ex + ey * ey < margin * margin) return true;
    }
    return false;
  };
  const w = (x1 - x0) / grid, h = (y1 - y0) / grid;
  let count = 0;
  for (let i = 0; i < grid; i += 1) {
    for (let j = 0; j < grid; j += 1) {
      const px = x0 + (i + 0.5) * w, py = y0 + (j + 0.5) * h;
      if (inTurned(px, py) && !inPolygon(px, py) && !nearOutline(px, py)) count += 1;
    }
  }
  const leak = count * w * h;
  return { leak, share: m.area ? leak / m.area : 0 };
}
