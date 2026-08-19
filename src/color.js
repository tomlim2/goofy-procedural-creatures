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
export function shade(hex, factor) {
  const v = parseInt(hex.slice(1), 16);
  const ch = (x) => Math.round(Math.max(0, Math.min(255, x * factor))).toString(16).padStart(2, "0");
  return "#" + ch((v >> 16) & 255) + ch((v >> 8) & 255) + ch(v & 255);
}
