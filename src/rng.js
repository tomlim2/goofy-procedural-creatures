// 시드 기반 난수. 같은 시드는 항상 같은 크리처를 만든다.
// 렌더러가 아니라 여기가 이 랩의 뿌리다.

// xmur3 — 문자열 시드를 32비트 정수로.
export function seedFromString(text) {
  let h = 1779033703 ^ text.length;
  for (let i = 0; i < text.length; i += 1) {
    h = Math.imul(h ^ text.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return (h ^= h >>> 16) >>> 0;
}

// mulberry32 — 짧고 분포가 고른 PRNG.
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

    // 정규분포 근사. 비율 지터에 쓰면 극단값이 덜 나온다.
    gaussian: (mean = 0, deviation = 1) => {
      const u = 1 - next();
      const v = next();
      return mean + deviation * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },

    // 평균 근처로 몰리되 범위를 벗어나지 않는 값.
    around: (mean, spread) => {
      const value = mean + rng.gaussian(0, spread / 2);
      return Math.max(mean - spread, Math.min(mean + spread, value));
    },

    // [["a", 3], ["b", 1]] → "a"가 3배 자주 나온다.
    weighted: (entries) => {
      let total = 0;
      for (const [, weight] of entries) total += weight;
      let roll = next() * total;
      for (const [value, weight] of entries) {
        roll -= weight;
        if (roll <= 0) return value;
      }
      return entries[entries.length - 1][0];
    },

    shuffle: (list) => {
      const out = list.slice();
      for (let i = out.length - 1; i > 0; i -= 1) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    }
  };

  return rng;
}

// 1D 값 노이즈. 선을 손그림처럼 떨리게 만드는 데 쓴다.
// 격자점마다 난수를 두고 smoothstep으로 잇는다.
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

// 시드를 사람이 읽고 다시 입력할 수 있는 형태로.
export function formatSeed(seed) {
  return seed.toString(36).toUpperCase().padStart(7, "0");
}
