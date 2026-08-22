// The goofy outline — what a creature's lines are drawn with: the kinds, the switch and the procedures. A Sketch delegates
// contour(), line() and mark() here. Docs: guidelines/drawing.md § the outline; how.html § the goofy outline

// The kinds — what a line is made of. A separate concept from the goofy materials (a line is not a way of filling)
export const GOOFY_OUTLINES = {
  // The pencil — pencil(): the reference's line. It wanders, breathes, runs past its ends and sheds; closed, one seamless loop
  PENCIL: { kind: "pencil", width: 0.012, passes: 1 },
  // The ribbon — stroke() once: the board's original line, a tapered ribbon pushed by noise. A short one is a bean — what a mark wants
  RIBBON: { kind: "stroke", width: 0.01, passes: 1, jitter: 0.006 }
};

// The switch — what the board draws each **role** with. A role is what a line is on the board, not what it is made of:
//   contour — the closed line of a shape (the head, the body, ears, hats, hands, eyes, the nose, the mouth's parts…)
//   line — an open line (a brow, a lid, a whisker, a limb, a strand, a horn, the floor)
//   mark — a dot or a dash a few widths long (a freckle, a tooth's edge, a claw, a glyph's dot) — the pencil's overshoot would lengthen it
// Change a name here and every line of that role changes on the board; a new kind is a new entry above and a name here.
// A part names its role and hands over the path and the color — at most a weight on the width. A part never names a kind; the medium
// page does (outline), to show each kind on its own
export const BOARD_LINES = { contour: "PENCIL", line: "PENCIL", mark: "RIBBON" };

export function contourWith(sketch, points, options) { return draw(sketch, points, "contour", true, options); }
export function lineWith(sketch, points, options) { return draw(sketch, points, "line", false, options); }
export function markWith(sketch, points, options) { return draw(sketch, points, "mark", false, options); }

// weight scales the kind's width (a head's contour runs a little heavier than a body's; open lines are fine 0.6 · 0.7 · 1 · heavy 1.3 · bold 1.6).
// paper is the color the pencil's bites take when the line runs over a fill. step re-samples a tiny ribbon finer (the star eye).
// joint = [start, end] marks a line end that meets another line or a fill's edge (the tail's root, the tip's arc): no overshoot, no thinning there.
// skinT = [t0, t1] tags the line's triangles with their t along a bent part's spine (stroke.js — the tail's skin reads its bones from it).
// An unknown name throws — a misspelt role or kind must not silently draw nothing
function draw(sketch, points, role, closed, { color = "#2b2724", weight = 1, paper, step, outline, joint, skinT } = {}) {
  const name = outline || BOARD_LINES[role];
  const o = GOOFY_OUTLINES[name];
  if (!o) throw new Error(`unknown outline: ${name} (${role})`);
  const options = { color, width: o.width * weight, passes: o.passes };
  if (o.jitter !== undefined) options.jitter = o.jitter;
  if (paper) options.paper = paper;
  if (step) options.step = step;
  if (joint) options.joint = joint;
  if (skinT) options.skinT = skinT;   // the skin tag along the line — [t0, t1] on a bent part's spine (the tail)
  if (o.kind === "pencil") sketch.pencil(points, { ...options, closed });
  else if (closed) sketch.outline(points, options);
  else sketch.stroke(points, options);
}
