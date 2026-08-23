// The goofy outline — what a creature's lines are drawn with: the kinds, the switch and the procedures. A Sketch delegates
// contour() and line() here. Docs: guidelines/drawing.md § the outline; how.html § the goofy outline

// The kinds — what a line is made of. A separate concept from the goofy materials (a line is not a way of filling).
// A kind is named **the pen, then the hold**: STROKE (once, at full width — mass) · SLINE (thin, and the pen lifts — detail) ·
// BROKEN (laid three times over itself — contour). A dot or a dash needs no hold of its own: the pencil keeps the ends of
// anything shorter than PENCIL.stub and sheds nothing there (stroke.js), so a dot drawn as a line stays its own length.
// One pen draws them all: stroke.js pencil() — it wanders, breathes, runs past its ends and sheds; closed, one seamless loop.
// `pen` names the hand that draws a kind, for when a second pen comes back
export const GOOFY_OUTLINES = {
  // The pencil's stroke — full width, laid once. Mass: what every line on the board is
  PENCIL_STROKE: { pen: "pencil", width: 0.012, passes: 1 },
  // The pencil's sline — held light: thin, laid once, and **the pen lifts** now and then, leaving the line open (lift, in pencil()).
  // Detail. A line shorter than lift.min never breaks, so a dot or a dash keeps its whole extent
  PENCIL_SLINE: { pen: "pencil", width: 0.008, passes: 1, lift: { per: 0.26, gap: [0.006, 0.016], min: 0.07, edge: 0.025 } },
  // The pencil's broken — the **ghost** habit stacked: the line, then two more of it at PENCIL.ghost of the width, each wandering
  // and breathing on its own, so it comes out doubled and offset the way a hand going round twice leaves it. Contour. Built, and
  // on nothing yet (BOARD_LINES, below)
  PENCIL_BROKEN: { pen: "pencil", width: 0.011, passes: 3 }
};

// The switch — what the board draws each **role** with. A role is what a line is on the board, not what it is made of:
//   contour — the closed line of a shape (the head, the body, ears, hats, hands, eyes, the nose, the mouth's parts…)
//   line — an open line, down to a dot or a dash (a brow, a lid, a whisker, a limb, a strand, a horn, the floor, a tooth's edge,
//          a claw, the dot mouth). A stub keeps its ends and sheds nothing — that is its length's doing, not a role of its own
// Change a name here and every line of that role changes on the board; a new kind is a new entry above and a name here.
// A part names its role and hands over the path and the color — at most a weight on the width. A part never names a kind; the medium
// page does (outline), to show each kind on its own
export const BOARD_LINES = { contour: "PENCIL_STROKE", line: "PENCIL_STROKE" };

export function contourWith(sketch, points, options) { return draw(sketch, points, "contour", true, options); }
export function lineWith(sketch, points, options) { return draw(sketch, points, "line", false, options); }

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
  if (o.lift) options.lift = o.lift;
  if (o.pen === "pencil") sketch.pencil(points, { ...options, closed });
  else if (closed) sketch.outline(points, options);
  else sketch.stroke(points, options);
}
