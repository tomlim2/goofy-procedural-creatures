// The goofy outline — what a creature's closed lines are drawn with: the table and the procedure. A Sketch delegates contour() here.
// Docs: guidelines/drawing.md § the outline; how.html § the goofy outline

// Outlines — the goofy outline: what a creature's contour is drawn with. A separate concept from the goofy materials (a contour
// is not a way of filling). A part names one and hands over the path and the color; at most a weight on the width.
// Docs: guidelines/drawing.md § the outline
export const GOOFY_OUTLINES = {
  // The ribbon — stroke() once: the line of every closed shape that is not a head or a body (ears, hats, hands, eyes, noses, mouths…),
  // at one width, scaled by a part's weight (0.7 fine · 1 · 1.2 heavy). It was the board's original contour, laid twice
  RIBBON: { kind: "stroke", width: 0.01, passes: 1, jitter: 0.006 },
  // The pencil — pencil(): one seamless loop that wanders, breathes, runs past and sheds. What the board draws with today
  PENCIL: { kind: "pencil", width: 0.012, passes: 1 }
};


// The goofy outline — draws the contour with a named outline (GOOFY_OUTLINES). weight scales its width (a head's contour runs a
// little heavier than a body's); closed draws a loop. An unknown name throws — a part that misspells it must not silently draw nothing
export function contourWith(sketch, points, name, { color = "#2b2724", closed = false, weight = 1, paper, step } = {}) {
  const o = GOOFY_OUTLINES[name];
  if (!o) throw new Error(`unknown outline: ${name}`);
  const options = { color, width: o.width * weight, passes: o.passes };
  if (o.jitter !== undefined) options.jitter = o.jitter;
  if (paper) options.paper = paper;
  if (step) options.step = step;   // a tiny shape with corners (the star eye) re-samples finer than the ribbon's 0.03
  if (o.kind === "pencil") sketch.pencil(points, { ...options, closed });
  else if (closed) sketch.outline(points, options);
  else sketch.stroke(points, options);
}

