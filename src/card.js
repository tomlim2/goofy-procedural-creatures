// The card — what the name screen stands a creature up in (guidelines/name.md § the card): its numbers, where they sit, and how
// its words are laid out. The numbers are read off the creature: ♥ and rarity off its parts (character/name.js), its moves off its
// own clock, run for five minutes. The words are the goofy type (medium/type.js) — any script, traced off a real font and written
// in the pencil into the scene by the page. Nothing here touches the DOM at import, so scripts/names.mjs reads the same card.

import { makeClock, ACTIONS, BODY_ACTIONS, QUAD_ACTIONS } from "./motion/index.js";
import { motionRig, isGhost, heartsOf, rarityOf, RARITY_NAMES, PAPER } from "./character/index.js";
import { mix } from "./color.js";
import { TICK_FPS } from "./tick.js";

// The size SAVE draws the card at, whatever the screen — the 63 × 88 mm trading card's 5:7 (the page lays it out at the same, styles.css)
export const CARD_SAVE = [1000, 1400];

// Where everything stands, as fractions of the card — x and a word's em of its width, y of its height (a word's y is its baseline).
// art is the picture's window; zoom is the camera's, so the cell and the emoji over a head fill that window. weight is the type's
// (500 · 700, fonts/); a soft word is written in the ink taken a third of the way to the paper
export const CARD = {
  inset: 0.035,
  corner: 0.03,
  art: { x0: 0.06, x1: 0.94, y0: 0.155, y1: 0.775 },
  zoom: 1.2,
  name: { x: 0.075, y: 0.104, em: 0.07, weight: 700, max: 0.64 },
  hearts: { x: 0.925, y: 0.104, em: 0.05, weight: 700 },
  kind: { x: 0.076, y: 0.142, em: 0.03, weight: 500, soft: true },
  moves: { x: 0.075, x1: 0.925, y: 0.823, step: 0.04, em: 0.036, weight: 500 },
  rarity: { x: 0.075, y: 0.927, em: 0.036, weight: 700 },
  foot: { x: 0.925, y: 0.927, em: 0.025, weight: 700, soft: true }
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

// -- the words --
// Every word on a card, where it stands (CARD): the name as it was typed, the labels in capitals. align right puts the word's end at x
export function cardWords(card) {
  const words = [
    { text: card.name, ...CARD.name },
    { text: `♥ ${card.hearts}`, ...CARD.hearts, align: "right" },
    { text: card.kind, ...CARD.kind }
  ];
  card.moves.forEach((move, i) => {
    const y = CARD.moves.y + CARD.moves.step * i;
    words.push({ text: move.label.toUpperCase(), ...CARD.moves, y, max: 0.66 });
    if (move.count !== null) words.push({ text: `×${move.count}`, ...CARD.moves, x: CARD.moves.x1, y, align: "right" });
  });
  words.push({ text: `${"★".repeat(card.stars)} ${RARITY_NAMES[card.stars - 1]}`, ...CARD.rarity });
  words.push({ text: "MENAGERIE v1", ...CARD.foot, align: "right" });
  return words;
}

// A card's words laid out: each traced at its weight (`trace(text, weight)` → { shapes, width } in ems — medium/type.js traceType),
// shrunk to its `max` width when it runs longer, and placed — { em, x (its left end), y (its baseline), line, color } in card
// fractions, x and em of the width
export function layCard(card, trace) {
  const soft = mix(card.ink, PAPER, 0.35);
  return cardWords(card).map((word) => {
    const line = trace(word.text, word.weight);
    let em = word.em;
    if (word.max && line.width * em > word.max) em = word.max / line.width;
    const x = word.align === "right" ? word.x - line.width * em : word.x;
    return { ...word, em, x, line, color: word.soft ? soft : card.ink };
  });
}
