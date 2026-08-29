// The goofy outline — what a creature's lines are drawn with: the kinds, the switch and the procedures. A Sketch delegates
// contour() and line() here. Docs: guidelines/drawing.md § the outline; how.html § the goofy outline

// The kinds — what a line is made of. A separate concept from the goofy materials (a line is not a way of filling).
// A kind is named **the pen, then the hold**: STROKE (once, at full width — mass) · SLINE (thin, and the pen lifts — detail) ·
// BROKEN (laid three times over itself — contour). A dot or a dash needs no hold of its own: the pencil keeps the ends of
// anything shorter than PENCIL.stub and sheds nothing there (stroke.js), so a dot drawn as a line stays its own length.
// One pen draws them all: stroke.js pencil() — it wanders, breathes, runs past its ends and sheds; closed, one seamless loop.
// `pen` names the hand that draws a kind, for when a second pen comes back
// The pen sizes — every kind names its own ladder of three: **S · M · L**. The board draws at **M**, so a kind's M
// is its width on the board and the other two are the same hold held finer or fatter. A ladder is the kind's own
// rather than a multiple of one width: SLINE is a hairline, and a hairline scaled to STROKE's L stops being one.
// The medium page draws each kind at all three off this table, so the figures and the ladder cannot drift apart
export const PEN_SIZES = { S: 0.004, M: 0.007, L: 0.012 };   // the default ladder — STROKE's own
export const SIZE_NAMES = Object.keys(PEN_SIZES);

export const GOOFY_OUTLINES = {
  // The pencil's stroke — full width, laid once. Mass: what every line on the board is
  PENCIL_STROKE: { pen: "pencil", sizes: PEN_SIZES, passes: 1 },
  // The pencil's sline — held light: a hairline, laid once, and **the pen lifts** now and then, leaving it open for a width or two
  // (PENCIL.lift). Detail. A line too short to be a detail never breaks, so a dot or a dash keeps its whole extent
  // A hairline at every size — its ladder is tight (0.6 · 1 · 1.6 against STROKE's 0.58 · 1 · 1.83) because a hairline
  // blown up to STROKE's L is no longer detail, and the width's breath, which is a share of the width, comes with it
  // ...and it holds its width: `breathe` 0.5 halves the width's sines and the per-stroke jitter. At the full share a
  // hairline's swing reads as lumps in the line rather than as a hand — the breath is a share of the width, and there is
  // little width to spend it on
  PENCIL_SLINE: { pen: "pencil", sizes: { S: 0.002, M: 0.003, L: 0.005 }, passes: 1, lift: true, breathe: 0.5 },
  // The pencil's broken — the **ghost** habit stacked: the line, then two more of it at PENCIL.ghost of the width, each wandering
  // and breathing on its own, so it comes out doubled and offset the way a hand going round twice leaves it. Contour. Built, and
  // on nothing yet (BOARD_LINES, below)
  PENCIL_BROKEN: { pen: "pencil", sizes: { S: 0.0035, M: 0.006, L: 0.011 }, passes: 3 }
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

// size picks one of the kind's three widths — **the only way a width is said**. M unless asked: fine detail asks for S, the
// one heavy line on the board (an imp's horn, a stub tail) for L. There is no free multiplier; a width that is not on a
// kind's ladder cannot be drawn, which is what keeps the board's line weights countable.
// paper is the color the pencil's bites take when the line runs over a fill. step re-samples a tiny ribbon finer (the star eye).
// joint = [start, end] marks a line end that meets another line or a fill's edge (the tail's root, the tip's arc): no overshoot, no thinning there.
// skinT = [t0, t1] tags the line's triangles with their t along a bent part's spine (stroke.js — the tail's skin reads its bones from it).
// An unknown name throws — a misspelt role or kind must not silently draw nothing
function draw(sketch, points, role, closed, { color = "#2b2724", size = "M", paper, step, outline, joint, skinT } = {}) {
  // outline: named by the call · sketch.outline: named for this whole creature (a ghost's broken stroke —
  // character/spec.js) · BOARD_LINES: the board's switch. Most specific first
  const name = outline || sketch.outline || BOARD_LINES[role];
  const o = GOOFY_OUTLINES[name];
  if (!o) throw new Error(`unknown outline: ${name} (${role})`);
  const width = o.sizes[size];
  if (width === undefined) throw new Error(`outline ${name}: unknown size ${size}`);
  const options = { color, width, passes: o.passes };
  if (o.jitter !== undefined) options.jitter = o.jitter;
  if (paper) options.paper = paper;
  if (step) options.step = step;
  if (joint) options.joint = joint;
  if (skinT) options.skinT = skinT;   // the skin tag along the line — [t0, t1] on a bent part's spine (the tail)
  if (o.lift) options.lift = o.lift;
  if (o.breathe !== undefined) options.breathe = o.breathe;
  sketch.pencil(points, { ...options, closed });
}
