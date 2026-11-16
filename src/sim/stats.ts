/** Small statistics helpers used by the Monte Carlo mode. */

export function mean(values: readonly number[]): number {
  if (!values.length) return NaN;
  let s = 0;
  for (const v of values) s += v;
  return s / values.length;
}

/**
 * Percentile with linear interpolation between order statistics
 * (the same convention as NumPy's default): rank = p/100 * (n - 1).
 */
export function percentile(values: readonly number[], p: number): number {
  if (!values.length) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (Math.min(100, Math.max(0, p)) / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (rank - lo);
}

export interface Summary {
  mean: number;
  p5: number;
  p50: number;
  p95: number;
  min: number;
  max: number;
}

export function summarize(values: readonly number[]): Summary {
  return {
    mean: mean(values),
    p5: percentile(values, 5),
    p50: percentile(values, 50),
    p95: percentile(values, 95),
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

export interface Bin {
  x0: number;
  x1: number;
  count: number;
}

export function histogram(values: readonly number[], bins = 16): Bin[] {
  if (!values.length) return [];
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (hi - lo < 1e-9) {
    lo -= 0.5;
    hi += 0.5;
  }
  const w = (hi - lo) / bins;
  const out: Bin[] = Array.from({ length: bins }, (_, i) => ({ x0: lo + i * w, x1: lo + (i + 1) * w, count: 0 }));
  for (const v of values) out[Math.min(bins - 1, Math.floor((v - lo) / w))].count++;
  return out;
}

/**
 * Indices of the non-dominated points when every coordinate is "higher is better".
 * A point is dominated if another one is at least as good everywhere and strictly better somewhere.
 */
export function paretoFront(points: readonly (readonly number[])[]): number[] {
  const front: number[] = [];
  for (let i = 0; i < points.length; i++) {
    let dominated = false;
    for (let j = 0; j < points.length && !dominated; j++) {
      if (i === j) continue;
      let allGE = true;
      let anyGT = false;
      for (let k = 0; k < points[i].length; k++) {
        if (points[j][k] < points[i][k]) allGE = false;
        if (points[j][k] > points[i][k]) anyGT = true;
      }
      if (allGE && anyGT) dominated = true;
    }
    if (!dominated) front.push(i);
  }
  return front;
}
