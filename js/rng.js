// Deterministic RNG (Mulberry32)
export function makeRNG(seed = 1) {
  return function rng() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Range helper: integer or float
export function randRange(rng, [min, max], { float = false } = {}) {
  const v = rng() * (max - min) + min;
  return float ? v : Math.round(v);
}
