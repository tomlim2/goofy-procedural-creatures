// The goofy fur — how hair and fur are grown along a path: the table and the procedure. A Sketch delegates fur() here.
// Docs: guidelines/drawing.md § the goofy fur; how.html § the goofy fur

// The goofy fur — how hair and fur are grown along a path: the same path drawn over and over, each pass pushed outward from the
// root, every point waving. A part names a fur and hands over the path and the color; passes, width and spread ride as overrides
// (a style's volume), everything else is the fur's own. The medium page grows one fur ball per entry. Docs: guidelines/drawing.md § the goofy fur
// **The strand sizes** — a fur names its own ladder of three, the way a pen does (medium/outlines.js PEN_SIZES). A style asks for
// S · M · L and never for a width. M is what a fur is on the board; S is a finer hair, L a coarser one
export const FUR_SIZES = { S: 0.008, M: 0.009, L: 0.01 };
export const SIZE_NAMES = Object.keys(FUR_SIZES);

export const GOOFY_FUR = {
  // The scribble — today's hair. root/reach: where the passes start and how far they fan, in spreads (−0.25 → 0.6, outward);
  // scatter: a pass's own push; wave: a point's own push; lean/waveLean: how much of each goes sideways
  SCRIBBLE: { sizes: FUR_SIZES, passes: 14, spread: 0.05, root: -0.25, reach: 0.85, scatter: 0.4, wave: 0.4, lean: 0.4, waveLean: 0.3 }
};


// Grows a named fur (GOOFY_FUR) along the path. passes, width and spread may be overridden — a style's volume; the rest is the fur's
export function furWith(sketch, points, name, { color, passes, size = "M", spread } = {}) {
  const f = GOOFY_FUR[name];
  if (!f) throw new Error(`unknown fur: ${name}`);
  const width = f.sizes[size];
  if (width === undefined) throw new Error(`fur ${name}: unknown size ${size}`);
  const over = { color, width };
  if (passes !== undefined) over.passes = passes;
  if (spread !== undefined) over.spread = spread;
  sketch.scribble(points, { ...f, ...over });
}

