// The card — what the name screen stands a creature up in (guidelines/name.md § the card): its three words and where they sit.
// A card says who it is and no more: the name as it was typed, the species, and the release (the owner, 2026-09-17 — the ♥, the
// moves and the rarity it carried read as ranking a person by their name, and went). The species is said in the screen's
// language (lang.js). The words are the goofy type (medium/type.js) — any script, traced off a real font and written in the
// pencil into the scene by the page. Nothing here touches the DOM at import, so scripts/names.mjs reads the same card.

import { PAPER } from "./character/index.js";
import { mix } from "./color.js";
import { WORDS } from "./lang.js";

// The size SAVE draws the card at, whatever the screen — the 63 × 88 mm trading card's 5:7 (the page lays it out at the same, styles.css)
export const CARD_SAVE = [1000, 1400];

// Where everything stands, as fractions of the card — x and a word's em of its width, y of its height (a word's y is its baseline).
// art is the picture's window; zoom is the camera's and origin is where the scene's origin (the middle of the creature's cell) sits
// down the card, so the cell and the emoji over a head fill the window (guidelines/name.md § the card). weight is the type's
// (500 · 700, fonts/); a soft word is written in the ink taken a third of the way to the paper
export const CARD = {
  inset: 0.035,
  corner: 0.03,
  art: { x0: 0.06, x1: 0.94, y0: 0.155, y1: 0.885 },
  zoom: 1.45,
  origin: 0.566,
  name: { x: 0.075, y: 0.104, em: 0.07, weight: 700, max: 0.85 },
  kind: { x: 0.076, y: 0.142, em: 0.03, weight: 500, soft: true },
  foot: { x: 0.925, y: 0.927, em: 0.025, weight: 700, soft: true }
};

// -- the card --
// What a card says about a made creature (character/name.js creatureOfName), in a language (lang.js WORDS): the species — in English
// the vocabulary's own name in capitals, in Korean its table's word
export function cardOf(made, lang = "en") {
  const { spec } = made;
  const species = WORDS[lang].species;
  return {
    name: made.shown,
    kind: species ? species[spec.species] || spec.species : spec.species.toUpperCase(),
    // The ink its words and its frame take — the creature's own, from before a ghost pales it
    ink: (spec.palette0 || spec.palette).ink
  };
}

// -- the words --
// Every word on a card, where it stands (CARD): the name as it was typed, the species, the release. align right puts the word's end at x
export function cardWords(card) {
  return [
    { text: card.name, ...CARD.name },
    { text: card.kind, ...CARD.kind },
    { text: "MENAGERIE v1", ...CARD.foot, align: "right" }
  ];
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
