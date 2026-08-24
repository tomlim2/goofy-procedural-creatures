// The goofy fur — how hair and fur are grown along a path: the table and the procedure. A Sketch delegates fur() here.
// Docs: guidelines/drawing.md § the goofy fur; how.html § the goofy fur

// The goofy fur — how hair and fur are grown along a path: the same path drawn over and over, each pass pushed outward from the
// root, every point waving. A part names a fur and hands over the path and the color; passes, width and spread ride as overrides
// (a style's volume), everything else is the fur's own. The medium page grows one fur ball per entry. Docs: guidelines/drawing.md § the goofy fur
export const GOOFY_FUR = {
  // The scribble — today's hair. root/reach: where the passes start and how far they fan, in spreads (−0.25 → 0.6, outward);
  // scatter: a pass's own push; wave: a point's own push; lean/waveLean: how much of each goes sideways
  SCRIBBLE: { passes: 14, width: 0.009, spread: 0.05, root: -0.25, reach: 0.85, scatter: 0.4, wave: 0.4, lean: 0.4, waveLean: 0.3 }
};


// Grows a named fur (GOOFY_FUR) along the path. passes, width and spread may be overridden — a style's volume; the rest is the fur's
export function furWith(sketch, points, name, { color, passes, width, spread } = {}) {
  const f = GOOFY_FUR[name];
  if (!f) throw new Error(`unknown fur: ${name}`);
  const over = { color };
  if (passes !== undefined) over.passes = passes;
  if (width !== undefined) over.width = width;
  if (spread !== undefined) over.spread = spread;
  sketch.scribble(points, { ...f, ...over });
}

