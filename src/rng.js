// Seeded randomness. The same seed always makes the same creature.
// The root of this lab is here, not in the renderer.

// xmur3 — string seed to a 32-bit integer.
export function seedFromString(text) {
  let h = 1779033703 ^ text.length;
  for (let i = 0; i < text.length; i += 1) {
    h = Math.imul(h ^ text.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return (h ^= h >>> 16) >>> 0;
}

// mulberry32 — short, evenly distributed PRNG.
export function makeRng(seed) {
  let state = seed >>> 0;

  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const rng = {
    next,
    float: (min, max) => min + next() * (max - min),
    int: (min, max) => Math.floor(min + next() * (max - min + 1)),
    chance: (p) => next() < p,
    pick: (list) => list[Math.floor(next() * list.length)],

    // Normal-ish distribution. Used for proportion jitter, it produces fewer extremes.
    gaussian: (mean = 0, deviation = 1) => {
      const u = 1 - next();
      const v = next();
      return mean + deviation * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },

    // A value that clusters near the mean without leaving the range.
    around: (mean, spread) => {
      const value = mean + rng.gaussian(0, spread / 2);
      return Math.max(mean - spread, Math.min(mean + spread, value));
    },

    // [["a", 3], ["b", 1]] → "a" comes up three times as often.
    weighted: (entries) => {
      let total = 0;
      for (const [, weight] of entries) total += weight;
      let roll = next() * total;
      for (const [value, weight] of entries) {
        roll -= weight;
        if (roll <= 0) return value;
      }
      return entries[entries.length - 1][0];
    }
  };

  return rng;
}

// 1D value noise. Used to make lines wobble like a hand drew them.
// A random number per lattice point, joined with smoothstep.
export function makeNoise(rng) {
  const SIZE = 256;
  const table = new Float32Array(SIZE);
  for (let i = 0; i < SIZE; i += 1) table[i] = rng.next() * 2 - 1;

  return (x) => {
    const i = Math.floor(x);
    const f = x - i;
    const a = table[((i % SIZE) + SIZE) % SIZE];
    const b = table[(((i + 1) % SIZE) + SIZE) % SIZE];
    const t = f * f * (3 - 2 * f);
    return a + (b - a) * t;
  };
}

// The seed in a form a person can read and type back in.
export function formatSeed(seed) {
  return seed.toString(36).toUpperCase().padStart(7, "0");
}
