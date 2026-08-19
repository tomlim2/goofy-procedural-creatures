// State sets for brows and mouth — rest / alt / angry / ^^. The scene stands a mesh up per set and switches them by clock state (browAlt, mouthAlt, angry, happy).
// Docs: guidelines/motion/catalog.md § the face (brow swap, mouth swap, angry, ^^), guidelines/character/parts.md § mouth

import { Sketch } from "../../stroke.js";
import { makeNoise, makeRng } from "../../rng.js";
import { layout, eyeGeometry } from "./layout.js";
import { SPECIES } from "../vocabulary/species.js";
import { drawBrow } from "./face.js";
import { drawMouth } from "./mouth.js";

// The brows' alt state. From rest it crosses over to this now and then and comes back.
// An individual with no brows has no alt either — a part that does not exist is not drawn in on a mood change
const ALT_BROW = { none: "none", flat: "worry", angry: "flat", worry: "flat" };

// The mouth's alt state — shifts slightly to a neighbour in the same mood (line↔wave, dot↔3, smile→smug, tense↔grid…)
const ALT_MOUTH = {
  dot: "line", line: "wave", open: "line", wave: "line", smile: "grin", pout: "dot", omega: "three", zigzag: "wave",
  frown: "smug", smug: "frown", three: "omega", grimace: "line", grin: "smile", scribble: "wave", tongue: "open", fangs: "line", shout: "open", meow: "omega", blep: "omega", bracket: "line"
};

// The angry (state.angry) mouth — per species. Humans and dogs get the tooth grid (clenched teeth), imps and cats get fangs (a hiss). Docs: guidelines/character/parts.md § mouth
const ANGRY_MOUTH = { human: "grimace", pup: "grimace", cat: "fangs", imp: "fangs" };
// The ^^ (state.happy) mouth — only dogs stick their tongue out (panting). The rest keep their rest mouth (same kind means the same mesh)
const HAPPY_MOUTH = { pup: "tongue" };

// Set list: brow [rest, alt, angry] · mouth [rest, alt, angry, ^^]. Species forbid applies to the values — a species with no brows (dogs, cats)
// must not grow brows on a mood change. When the same kind appears in two sets, the scene shares one mesh
export function facePartKinds(spec) {
  const forbid = (SPECIES.find((s) => s.name === spec.species) || {}).forbid || {};
  const allow = (slot, value) => (forbid[slot] && forbid[slot][value] !== undefined ? forbid[slot][value] : value);
  const brow = spec.parts.brow, mouth = spec.parts.mouth;
  return {
    brow: [brow, allow("brow", ALT_BROW[brow] || "flat"), allow("brow", brow === "none" ? "none" : "angry")],
    mouth: [
      mouth,
      allow("mouth", ALT_MOUTH[mouth] || "line"),
      allow("mouth", ANGRY_MOUTH[spec.species] || "grimace"),
      allow("mouth", HAPPY_MOUTH[spec.species] || mouth)
    ]
  };
}

// Bakes one brow or mouth state as an independent Sketch. The scene stands them up as per-state meshes.
export function facePartSketch(spec, part, kind) {
  const rng = makeRng((spec.proportions.wobbleSeed + (part === "brow" ? 101 : 202)) >>> 0);
  const noise = makeNoise(rng);
  const sketch = new Sketch(noise, spec.proportions.wobble);
  const box = layout(spec);
  if (part === "brow") drawBrow(sketch, spec, box, eyeGeometry(spec, box), kind);
  else drawMouth(sketch, sketch, spec, box, kind);
  return sketch;
}
