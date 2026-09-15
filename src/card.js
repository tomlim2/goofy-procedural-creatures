// The card — what the name screen stands a creature up in (guidelines/name.md § the card): its numbers, where they sit, and the
// one function that writes them. The numbers are read off the creature: ♥ and rarity off its parts (character/name.js), its moves
// off its own clock, run for five minutes. The words are written onto a 2D canvas by drawCardWords — the screen's overlay and the
// saved PNG alike, so the two cannot disagree. Nothing here touches the DOM at import, so scripts/names.mjs reads the same card.

import { makeClock, ACTIONS, BODY_ACTIONS, QUAD_ACTIONS } from "./motion/index.js";
import { motionRig, isGhost, heartsOf, rarityOf, RARITY_NAMES } from "./character/index.js";
import { TICK_FPS } from "./tick.js";

// The size SAVE draws the card at, whatever the screen — the 63 × 88 mm trading card's 5:7 (the page lays it out at the same, styles.css)
export const CARD_SAVE = [1000, 1400];

// Where everything stands, as fractions of the card — x and sizes of its width, y of its height (a word's y is the top of its
// letters). art is the picture's window; zoom is the camera's, so the cell and the emoji over a head fill that window
export const CARD = {
  inset: 0.035,
  corner: 0.03,
  art: { x0: 0.06, x1: 0.94, y0: 0.155, y1: 0.775 },
  zoom: 1.2,
  name: { x: 0.075, y: 0.052, size: 0.066, max: 0.64 },
  hearts: { x: 0.925, y: 0.062, size: 0.048 },
  kind: { x: 0.076, y: 0.117, size: 0.028 },
  moves: { x: 0.075, x1: 0.925, y: 0.8, step: 0.044, size: 0.034 },
  rarity: { x: 0.075, y: 0.905, size: 0.034 },
  foot: { x: 0.925, y: 0.911, size: 0.022 }
};

// -- the moves --
// The two actions it starts most often in its first five minutes, and how many times — its own clock run tick by tick, the way
// guidelines/motion/rules.md counts firing. The arm layer (a quad's legs and tail) comes first and the body layer only fills in:
// the body has one action, the hop, and every creature starts it — counted with the rest it topped nearly every card (13 of 14
// hops in five minutes against 6 of the likeliest arm action) and the cards all opened on the same move. A ghost only floats
const MOVE_TICKS = TICK_FPS * 300;
const ACTION_DEFS = { ...ACTIONS, ...BODY_ACTIONS, ...QUAD_ACTIONS };
// An action's label, cut at its first parenthesis: "hopping in place (crouch and spring)" → "hopping in place"
export const moveLabel = (name) => (ACTION_DEFS[name] && ACTION_DEFS[name].label ? ACTION_DEFS[name].label.replace(/\s*\(.*$/, "") : null);

export function movesOf(spec) {
  if (isGhost(spec)) return [{ name: "float", label: "floating", count: null }];
  const clock = makeClock(spec.roll, 0, spec.species, motionRig(spec), false);
  const layers = [new Map(), new Map()];   // the arm (or quad) layer, the body layer: name → { count, first }
  const was = [null, null];
  for (let n = 0; n < MOVE_TICKS; n += 1) {
    const state = clock.update(n / TICK_FPS);
    [state.action, state.bodyAction].forEach((now, layer) => {
      if (now && now !== was[layer]) {
        const seen = layers[layer].get(now) || { count: 0, first: n };
        seen.count += 1;
        layers[layer].set(now, seen);
      }
      was[layer] = now;
    });
  }
  const ranked = (starts) => [...starts.entries()].sort((a, b) => b[1].count - a[1].count || a[1].first - b[1].first);
  return [...ranked(layers[0]), ...ranked(layers[1])]
    .slice(0, 2)
    .map(([name, seen]) => ({ name, label: moveLabel(name) || name, count: seen.count }));
}

// -- the card --
// What a card says about a made creature (character/name.js creatureOfName)
export function cardOf(made) {
  const { spec } = made;
  return {
    name: made.shown,
    hearts: heartsOf(spec),
    kind: `${spec.archetype} · ${spec.species}`.toUpperCase(),
    moves: movesOf(spec),
    stars: rarityOf(spec),
    // The ink its words and its frame take — the creature's own, from before a ghost pales it
    ink: (spec.palette0 || spec.palette).ink
  };
}

const FONT = "ui-monospace, SFMono-Regular, Menlo, monospace";   // the page's own stack (styles.css); a Hangul or kana name falls back to the platform's

// Writes a card's words over whatever a 2D context `width` × `height` pixels (the whole card's size) already holds — the saved
// card's scene, or the overlay's cleared glass. A blank card (no card) writes nothing
export function drawCardWords(ctx, width, height, card) {
  if (!card) return;
  ctx.save();
  ctx.fillStyle = card.ink;
  ctx.textBaseline = "top";
  // One word: its size a fraction of the width, shrunk to fit `max` (a fraction of the width) when it runs longer — and then
  // lowered by half of what it lost, so a long name stays on its line's middle instead of riding up to its top
  const write = (text, at, { weight = 400, align = "left", alpha = 1, spacing = 0.04, size = at.size, x = at.x, y = at.y, max = at.max } = {}) => {
    const full = size * width;
    let px = full;
    const font = () => {
      ctx.font = `${weight} ${px.toFixed(2)}px ${FONT}`;
      if ("letterSpacing" in ctx) ctx.letterSpacing = `${(px * spacing).toFixed(2)}px`;
    };
    font();
    if (max) {
      const measured = ctx.measureText(text).width;
      if (measured > max * width) {
        px *= (max * width) / measured;
        font();
      }
    }
    ctx.globalAlpha = alpha;
    ctx.textAlign = align;
    ctx.fillText(text, x * width, y * height + (full - px) / 2);
  };
  write(card.name, CARD.name, { weight: 700, spacing: 0.02 });
  write(`♥ ${card.hearts}`, CARD.hearts, { weight: 700, align: "right" });
  write(card.kind, CARD.kind, { alpha: 0.72, spacing: 0.16 });
  card.moves.forEach((move, i) => {
    const y = CARD.moves.y + CARD.moves.step * i;
    write(move.label, CARD.moves, { y, max: 0.7 });
    if (move.count !== null) write(`×${move.count}`, CARD.moves, { x: CARD.moves.x1, y, align: "right", weight: 700 });
  });
  write(`${"★".repeat(card.stars)} ${RARITY_NAMES[card.stars - 1]}`, CARD.rarity, { weight: 700, spacing: 0.12 });
  write("MENAGERIE v1", CARD.foot, { align: "right", alpha: 0.6, spacing: 0.18, weight: 700 });
  ctx.restore();
}
