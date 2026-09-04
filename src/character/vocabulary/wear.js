// Wear — which of the individual's materials a part is made of.
//
// **A material is a palette box with a texture.** The roll deals the palette's boxes — skin, cloth, hair, accent,
// a pop when it has one — and the ink its marks are drawn in; each is a colour, and each is laid at the main
// material's texture and density (`material`, `density`) except cloth, which is laid at the body's
// (`bodyMaterial`, `bodyDensity`). What each part wore before wear existed is `WEAR_DEFAULTS` — exactly the box
// draw/ painted it from — so a roll's creature does not move and a generated spec carries no `wear` at all.
//
// The editor writes `spec.wear[part]` when a hand puts a part in another material, and `spec.materials[key]`:
// for a box, a texture or density of its own (hair hatched while the skin is oil); for a material of the hand's
// own (m1, m2 …), a name, a texture, a density and a colour that comes with it. **Colour belongs to the
// material**: a part in another box is painted that box's colour, in a hand's own that material's, and in its
// own box the colour the drawing chose for it (a tone of the box, a lid a shade darker). A key that names
// nothing (a file from elsewhere) falls back to the drawing's own.
//
// The parts listed are the ones that take a material at all. The rest — an eyepatch, cheeks, a pattern — are
// objects with a colour of their own, or flat by rule (the whites of the eyes): nothing to wear.
export const BOXES = ["skin", "cloth", "hair", "accent", "pop", "ink"];
export const WEAR_DEFAULTS = {
  head: "skin", ears: "skin", horns: "skin", nose: "skin",
  hair: "hair", headgear: "accent",
  eyes: "ink", brow: "ink", mouth: "ink",
  body: "cloth", arms: "cloth", legs: "cloth", tail: "cloth"
};

// The parts that wear a material, in the editor's order.
export const WEARABLE = Object.keys(WEAR_DEFAULTS);

export const isBox = (key) => BOXES.includes(key);
// What `spec.materials` holds for a key: a box's own texture and density, or a hand's own material entire
export const extraOf = (spec, key) => (spec && spec.materials && key && spec.materials[key]) || null;
// A material of the hand's own — in `spec.materials`, and not a box
export const isOwn = (spec, key) => !!key && !isBox(key) && !!extraOf(spec, key);

// Every material the individual wears, in the editor's order: the boxes it has (a pop only when it has one),
// then the hand's own.
export function materialKeys(spec) {
  const hasPop = !!((spec.palette0 && spec.palette0.pop) || (spec.palette && spec.palette.pop));
  const boxes = BOXES.filter((box) => box !== "pop" || hasPop);
  return [...boxes, ...Object.keys((spec && spec.materials) || {}).filter((key) => !isBox(key))];
}

// Which material a part wears — the hand's choice, or the drawing's own. null for a part that wears none.
export function wearOf(spec, part) {
  const worn = spec.wear && spec.wear[part];
  if (isBox(worn) || isOwn(spec, worn)) return worn;
  return WEAR_DEFAULTS[part] || null;
}

// The drawing's word for a part's side, kept for the callers that ask by it: now the key of what the part wears
export function sideOf(spec, part) {
  return wearOf(spec, part);
}

// A material's colour: a box's is the palette's (a pop's its colour; a box the palette lacks is null), a hand's
// own its own.
export function colourOf(spec, key) {
  if (!key) return null;
  if (!isBox(key)) {
    const own = extraOf(spec, key);
    return (own && own.colour) || null;
  }
  if (key === "pop") return (spec.palette.pop && spec.palette.pop.color) || null;
  return spec.palette[key] || null;
}

// The texture and density a material is laid with: cloth's are the body's slots, skin's the main slots, any
// other box's its own when a hand set them and the main's otherwise, a hand's own material's its own.
export function surfaceOf(spec, key) {
  const p = spec.parts;
  if (key === "cloth") {
    return {
      texture: p.bodyMaterial && p.bodyMaterial !== "same" ? p.bodyMaterial : p.material,
      density: p.bodyDensity && p.bodyDensity !== "same" ? p.bodyDensity : p.density
    };
  }
  const own = key === "skin" ? null : extraOf(spec, key);
  return { texture: (own && own.texture) || p.material, density: (own && own.density) || p.density };
}
