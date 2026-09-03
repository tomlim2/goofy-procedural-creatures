// Creature and board files. **A creature is its JSON** — the whole spec, the way the editor saves it — and the
// same file goes into a cell of the board. A board is a cast of those: `{ menagerie: "board", columns, cells }`.
// The roll inside a spec is where it came from, nothing more; what is drawn is what the file says.
//
// Reading checks only what the drawing cannot do without and says, in the one word a status label shows, why
// it refused. Nothing here touches rng.

import { SPECIES } from "./vocabulary/index.js";
import { MARKS } from "./vocabulary/palette.js";
import { ghostPalette, ghostOutline, ghostInk, isGhost } from "./spec.js";
import { luminance } from "../color.js";

export const BOARD_FILE = "board";

export const isHouse = (spec) => !!spec && spec.kind === "house";

// Settles what follows from the parts. A ghost has empty eyes, wears one pale tone and breaks every line; a
// dark face takes light marks. `makeCreature` does this at the end of a roll; this is the same step for a spec
// that was edited by hand or read from a file, so what reaches the drawing is always a settled spec.
export function deriveSpec(next) {
  const parts = { ...next.parts };
  if (parts.ghost !== "none") parts.eyes = "hollow";   // a ghost has empty eyes — nothing is looking back
  const palette = { ...ghostPalette(next.palette0, parts.ghost, next.proportions.hand) };
  return {
    ...next, parts, palette,
    outline: ghostOutline(parts.ghost),
    lineInk: ghostInk(parts.ghost),
    faceInk: (next.species === "imp" && !isGhost({ parts })) || luminance(palette.skin) < 120 ? MARKS.light : null
  };
}

// A file from before the rename: a creature's `seed` was its roll and `proportions.wobbleSeed` its hand.
function migrate(next) {
  if (!next || typeof next !== "object") return next;
  const out = { ...next };
  if (out.roll === undefined && Number.isFinite(out.seed)) { out.roll = out.seed; delete out.seed; }
  if (out.proportions && out.proportions.hand === undefined && out.proportions.wobbleSeed !== undefined) {
    out.proportions = { ...out.proportions, hand: out.proportions.wobbleSeed };
    delete out.proportions.wobbleSeed;
  }
  return out;
}

// One cell's worth of JSON, already parsed: a creature, or a house. Returns { spec } or { error }.
function readCell(raw) {
  const next = migrate(raw);
  if (isHouse(next)) {
    return Number.isFinite(next.roll) && typeof next.roof === "string" && Number.isFinite(next.w) ? { spec: next } : { error: "NOT A HOUSE" };
  }
  if (!next || !next.parts || !next.palette0 || !next.proportions || !SPECIES.some((s) => s.name === next.species)) return { error: "NOT A CREATURE" };
  return { spec: deriveSpec(next) };
}

function parse(text) {
  try {
    return { value: JSON.parse(text) };
  } catch {
    return { error: "NOT JSON" };
  }
}

// A creature (or a house) from a file's text.
export function readCreature(text) {
  const parsed = parse(text);
  return parsed.error ? parsed : readCell(parsed.value);
}

// A board from a file's text: { columns, cells } with every cell settled, or { error }. `columns` is null when
// the file does not say — the screen keeps the width it has.
export function readBoard(text) {
  const parsed = parse(text);
  if (parsed.error) return parsed;
  const next = parsed.value;
  if (!next || next.menagerie !== BOARD_FILE || !Array.isArray(next.cells) || !next.cells.length) return { error: "NOT A BOARD" };
  const cells = [];
  for (const cell of next.cells) {
    const read = readCell(cell);
    if (read.error) return read;
    cells.push(read.spec);
  }
  const columns = Number.isInteger(next.columns) && next.columns > 0 ? next.columns : null;
  return { columns, cells };
}

export const creatureJson = (spec) => JSON.stringify(spec, null, 2);
export const boardJson = (columns, cells) => JSON.stringify({ menagerie: BOARD_FILE, columns, cells }, null, 2);
