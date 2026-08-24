// Color utilities — everything goes through one hex string ("#rrggbb"). Character (palette, face-ink decisions) and drawing (vertex colors, tones) share these functions.
// Docs: guidelines/drawing.md § colors go in as linear

// three.js reads vertex colors as linear and converts to sRGB on output.
// Feed it an sRGB hex as-is and dark colors brighten into mid grey.
export function srgbToLinear(channel) {
  return channel < 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
}

// "#rrggbb" → linear [r, g, b] (0~1). Called once per stroke, so cached per string (thousands of strokes on one board, a few dozen colors)
const linearCache = new Map();
export function hexToRgb(hex) {
  let rgb = linearCache.get(hex);
  if (!rgb) {
    const value = parseInt(hex.slice(1), 16);
    rgb = [
      srgbToLinear(((value >> 16) & 255) / 255),
      srgbToLinear(((value >> 8) & 255) / 255),
      srgbToLinear((value & 255) / 255)
    ];
    linearCache.set(hex, rgb);
  }
  return rgb;
}

// Luminance (0~255, Rec.601 weights). Decides whether face ink is black or light (spec.js), and whether a scribble scratches dark or light (isDark)
export function luminance(hex) {
  const v = parseInt(hex.slice(1), 16);
  return 0.299 * ((v >> 16) & 255) + 0.587 * ((v >> 8) & 255) + 0.114 * (v & 255);
}

// Is this a dark color. Over dark surfaces — imp heads and bodies — the scribble scratches light
export function isDark(hex) {
  return luminance(hex) < 90;
}

// A tone in the same family. factor < 1 darker, > 1 lighter. For pencil shading (a shade darker than the fill) and for giving dogs, cats and imps a body "close to" the head color
// Mixes two hex colors in sRGB, t of the way toward b. Lightening by mixing toward a pale neutral is "adding white pigment" — it
// desaturates as it brightens — where multiplying a saturated color past its channels' tops clips it into neon (shade × 1.6 on a pop)
export function mix(a, b, t) {
  const va = parseInt(a.slice(1), 16), vb = parseInt(b.slice(1), 16);
  const ch = (s) => Math.round(((va >> s) & 255) * (1 - t) + ((vb >> s) & 255) * t).toString(16).padStart(2, "0");
  return "#" + ch(16) + ch(8) + ch(0);
}

export function shade(hex, factor) {
  const v = parseInt(hex.slice(1), 16);
  const ch = (x) => Math.round(Math.max(0, Math.min(255, x * factor))).toString(16).padStart(2, "0");
  return "#" + ch((v >> 16) & 255) + ch((v >> 8) & 255) + ch(v & 255);
}

// -- lighter and deeper **in the same family** ------------------------------------------------------------------
// A mark has to belong to the part it is drawn on. Mixing toward a pale neutral (the light ink) to lighten turns a blue mark grey
// and a red one pink-beige — the part's colour stops being in it — and multiplying up (shade × >1) keeps the hue but clips a
// saturated colour into neon. So a lighter tone moves **lightness** and leaves the hue where it is: a blue part gets a lighter blue.
// Saturation eases off a quarter of the amount as it rises, which is what a colour thinned with water does; it is not a bleach.
function toHsl(hex) {
  const v = parseInt(hex.slice(1), 16);
  const r = ((v >> 16) & 255) / 255, g = ((v >> 8) & 255) / 255, b = (v & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (!d) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = (max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4) / 6;
  return [h, s, l];
}
function fromHsl(h, s, l) {
  const f = (n) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    const x = l - a * Math.max(-1, Math.min(Math.min(k - 3, 9 - k), 1));
    return Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16).padStart(2, "0");
  };
  return "#" + f(0) + f(8) + f(4);
}
// `amount` of the way to white — 0 leaves the colour, 1 is white
export function tint(hex, amount) {
  const a = Math.max(0, Math.min(1, amount));
  const [h, s, l] = toHsl(hex);
  return fromHsl(h, s * (1 - a * 0.25), l + (1 - l) * a);
}
// The mirror: `amount` of the way to black
export function deepen(hex, amount) {
  const a = Math.max(0, Math.min(1, amount));
  const [h, s, l] = toHsl(hex);
  return fromHsl(h, s, l * (1 - a));
}
// How far this colour can still be lightened — what `tint` has left to work with
export function headroom(hex) {
  return 1 - toHsl(hex)[2];
}
