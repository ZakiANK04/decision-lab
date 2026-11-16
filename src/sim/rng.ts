/** Seedable random numbers. Everything random in the model goes through here. */

export type Rng = () => number;

/** mulberry32: small, fast, good-enough 32-bit PRNG. Returns floats in [0, 1). */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash several integers into one 32-bit seed (used to derive independent streams). */
export function mixSeed(...keys: number[]): number {
  let h = 0x811c9dc5;
  for (const k of keys) {
    h ^= k >>> 0;
    h = Math.imul(h, 0x01000193);
    h ^= h >>> 15;
    h = Math.imul(h, 0x85ebca6b);
    h ^= h >>> 13;
  }
  return h >>> 0;
}

/** One uniform draw that depends only on the keys (same keys, same number). */
export function hashRand(...keys: number[]): number {
  return mulberry32(mixSeed(...keys))();
}

export function uniform(rng: Rng, min: number, max: number): number {
  return min + (max - min) * rng();
}

/** Normal(mu, sigma) by Box-Muller. */
export function normal(rng: Rng, mu: number, sigma: number): number {
  const u1 = Math.max(rng(), 1e-12);
  const u2 = rng();
  return mu + sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/** Gamma(shape, 1) by Marsaglia-Tsang, with the boost trick for shape < 1. */
export function gamma(rng: Rng, shape: number): number {
  if (shape < 1) {
    const u = Math.max(rng(), 1e-12);
    return gamma(rng, shape + 1) * Math.pow(u, 1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number;
    let v: number;
    do {
      x = normal(rng, 0, 1);
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = rng();
    if (u < 1 - 0.0331 * x * x * x * x) return d * v;
    if (Math.log(Math.max(u, 1e-12)) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

/** Beta(alpha, beta) from two Gamma draws. */
export function beta(rng: Rng, alpha: number, betaParam: number): number {
  const x = gamma(rng, alpha);
  const y = gamma(rng, betaParam);
  return x / (x + y);
}

/** Index drawn from a discrete distribution, given one uniform u in [0, 1). */
export function categorical(u: number, probs: readonly number[]): number {
  let acc = 0;
  for (let i = 0; i < probs.length; i++) {
    acc += probs[i];
    if (u < acc) return i;
  }
  return probs.length - 1;
}
