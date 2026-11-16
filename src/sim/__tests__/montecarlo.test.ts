import { describe, expect, it } from 'vitest';
import { runCompare, runMonteCarlo, runSeed } from '../montecarlo';
import { defaultParams, PRESETS, simulate } from '../policy';
import { histogram, mean, paretoFront, percentile, summarize } from '../stats';

describe('percentiles', () => {
  it('match hand-computed values (linear interpolation)', () => {
    const v = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(percentile(v, 0)).toBe(1);
    expect(percentile(v, 100)).toBe(10);
    expect(percentile(v, 50)).toBeCloseTo(5.5, 12);
    expect(percentile(v, 5)).toBeCloseTo(1.45, 12);
    expect(percentile(v, 95)).toBeCloseTo(9.55, 12);
    expect(percentile([10, 1, 5], 50)).toBe(5); // unsorted input
    expect(percentile([7], 95)).toBe(7);
  });

  it('for 0..100 the p-th percentile is p', () => {
    const v = Array.from({ length: 101 }, (_, i) => i);
    const s = summarize(v);
    expect(s.p5).toBeCloseTo(5, 12);
    expect(s.p50).toBeCloseTo(50, 12);
    expect(s.p95).toBeCloseTo(95, 12);
    expect(s.mean).toBeCloseTo(50, 12);
  });

  it('histogram counts every value once', () => {
    const v = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const h = histogram(v, 5);
    expect(h.reduce((a, b) => a + b.count, 0)).toBe(10);
    expect(h.map((b) => b.count)).toEqual([2, 2, 2, 2, 2]);
  });

  it('paretoFront keeps the non-dominated points', () => {
    expect(paretoFront([[1, 1], [2, 2], [3, 1], [1, 3], [2, 1]])).toEqual([1, 2, 3]);
  });
});

describe('Monte Carlo', () => {
  const params = defaultParams(2026);

  it('summary percentiles are consistent with the raw outcomes', () => {
    const mc = runMonteCarlo(params, 60);
    expect(mc.outcomes).toHaveLength(60);
    const profits = mc.outcomes.map((o) => o.profit);
    const s = mc.summary.profit;
    expect(s.mean).toBeCloseTo(mean(profits), 9);
    expect(s.p5).toBeCloseTo(percentile(profits, 5), 9);
    expect(s.p95).toBeCloseTo(percentile(profits, 95), 9);
    expect(s.min).toBeLessThanOrEqual(s.p5);
    expect(s.p5).toBeLessThanOrEqual(s.p50);
    expect(s.p50).toBeLessThanOrEqual(s.p95);
    expect(s.p95).toBeLessThanOrEqual(s.max);
    // roughly 5% of runs fall below P5 and 5% above P95
    expect(profits.filter((x) => x < s.p5).length).toBeLessThanOrEqual(3);
    expect(profits.filter((x) => x > s.p95).length).toBeLessThanOrEqual(3);
  });

  it('is reproducible, and run 0 is the world of the player', () => {
    const a = runMonteCarlo(params, 20);
    const b = runMonteCarlo(params, 20);
    expect(a.outcomes).toEqual(b.outcomes);
    expect(runSeed(params.seed, 0)).toBe(params.seed);
    expect(a.outcomes[0].profit).toBeCloseTo(simulate(params).final.company.cumProfit, 9);
  });

  it('Compare uses common random numbers: a strategy against itself is a perfect tie', () => {
    const s = PRESETS.exploit.strategy;
    const r = runCompare(params, { label: 'A', strategy: s }, { label: 'B', strategy: s }, 12);
    expect(r.ties).toBe(12);
    expect(r.winner).toBe('tie');
    expect(r.a.series.cumProfit).toEqual(r.b.series.cumProfit);
  });

  it('Compare separates two different strategies', () => {
    const r = runCompare(params, { label: 'Greedy', strategy: PRESETS.greedy.strategy }, { label: 'Green', strategy: PRESETS.green.strategy }, 20);
    expect(r.a.series.environment).toHaveLength(params.horizon + 1);
    expect(r.b.summary.environment.mean).toBeGreaterThan(r.a.summary.environment.mean);
    expect(r.a.wins + r.b.wins + r.ties).toBe(20);
  });
});
