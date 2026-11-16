import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { ACTION_IDS } from '../catalog';
import {
  buildPayoffMatrix,
  drawNature,
  initState,
  lensColumns,
  normalizeProbs,
  setProb,
  shockProbs,
  step,
  turnoverProbability,
} from '../model';
import { defaultParams, natureTimeline, PRESETS, simulate, withStrategy } from '../policy';
import { beta, mulberry32, normal } from '../rng';
import { RULE_IDS } from '../rules';
import { decodeParams, encodeParams } from '../share';
import type { Lens, Params } from '../types';

const sum = (a: readonly number[]) => a.reduce((x, y) => x + y, 0);

describe('probabilities always sum to 1', () => {
  it('normalizeProbs handles any input', () => {
    for (const p of [[0.3, 0.5, 0.2], [3, 5, 2], [0, 0, 0], [1, 0, 0], [-1, 2, 2], [NaN, 1, 1]]) {
      const n = normalizeProbs(p);
      expect(sum(n)).toBeCloseTo(1, 12);
      expect(n.every((v) => v >= 0)).toBe(true);
    }
  });

  it('setProb keeps the sum at 1 and the proportions of the others', () => {
    const p = setProb([0.3, 0.5, 0.2], 0, 0.6);
    expect(sum(p)).toBeCloseTo(1, 12);
    expect(p[0]).toBeCloseTo(0.6, 12);
    expect(p[1] / p[2]).toBeCloseTo(0.5 / 0.2, 9);
    expect(sum(setProb([1, 0, 0], 0, 0.4))).toBeCloseTo(1, 12);
    expect(sum(setProb([0.3, 0.5, 0.2], 2, 1))).toBeCloseTo(1, 12);
  });

  it('shock probabilities (with "no shock") sum to 1, even with extreme sliders', () => {
    expect(sum(shockProbs(CONFIG.defaultShocks))).toBeCloseTo(1, 12);
    const extreme = shockProbs({ supply: 1, scandal: 1, strike: 1, heatwave: 1 });
    expect(sum(extreme)).toBeCloseTo(1, 12);
    expect(extreme[0]).toBeGreaterThan(0);
  });

  it('every lens gives columns whose probabilities sum to 1', () => {
    const p = defaultParams();
    for (const lens of ['gas', 'demand', 'regulation', 'scenarios'] as Lens[]) {
      expect(sum(lensColumns(lens, p.probs).map((c) => c.prob))).toBeCloseTo(1, 12);
    }
  });

  it('default probabilities in CONFIG sum to 1', () => {
    expect(sum(CONFIG.defaultProbs.gas)).toBeCloseTo(1, 12);
    expect(sum(CONFIG.defaultProbs.demand)).toBeCloseTo(1, 12);
    expect(sum(CONFIG.defaultProbs.regulation)).toBeCloseTo(1, 12);
  });

  it('realised states follow the probabilities', () => {
    const p = defaultParams(7);
    const counts = [0, 0, 0];
    const n = 20000;
    for (let t = 0; t < n; t++) counts[drawNature(p, t).gas]++;
    expect(counts[0] / n).toBeCloseTo(0.3, 1);
    expect(counts[1] / n).toBeCloseTo(0.5, 1);
    expect(counts[2] / n).toBeCloseTo(0.2, 1);
  });
});

describe('random number generator', () => {
  it('mulberry32 is deterministic and uniform on [0, 1)', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    let s = 0;
    for (let i = 0; i < 10000; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
      s += x;
    }
    expect(s / 10000).toBeCloseTo(0.5, 1);
  });

  it('Normal and Beta samplers have the right mean', () => {
    const r = mulberry32(1);
    let n = 0;
    let b = 0;
    const N = 20000;
    for (let i = 0; i < N; i++) {
      n += normal(r, 60, 12);
      b += beta(r, 4, 3);
    }
    expect(n / N).toBeCloseTo(60, 0);
    expect(b / N).toBeCloseTo(4 / 7, 1);
  });

  it('turnover probability is logistic(-k*s + b): falls as satisfaction rises', () => {
    const { turnoverK: k, turnoverB: b } = CONFIG.defaultWorkers;
    expect(turnoverProbability(0, k, b)).toBeCloseTo(1 / (1 + Math.exp(-b)), 12);
    expect(turnoverProbability(20, k, b)).toBeGreaterThan(turnoverProbability(60, k, b));
    expect(turnoverProbability(60, k, b)).toBeLessThan(0.02);
    expect(turnoverProbability(15, k, b)).toBeGreaterThan(0.2);
  });
});

describe('seed reproducibility', () => {
  it('same seed and parameters give exactly the same game', () => {
    const p = defaultParams(12345);
    expect(simulate(p).series).toEqual(simulate(p).series);
    expect(natureTimeline(p)).toEqual(natureTimeline(p));
  });

  it('a different seed gives a different world', () => {
    expect(natureTimeline(defaultParams(1))).not.toEqual(natureTimeline(defaultParams(2)));
  });

  it('the world does not depend on the strategy (common random numbers)', () => {
    const base = defaultParams(99);
    const a = natureTimeline(withStrategy(base, PRESETS.greedy.strategy));
    const b = natureTimeline(withStrategy(base, PRESETS.green.strategy));
    expect(a).toEqual(b);
  });

  it('step() does not mutate its input (so Undo is exact)', () => {
    const p = defaultParams(5);
    const s0 = initState(p);
    const copy = JSON.parse(JSON.stringify(s0));
    step(s0, 'cut_costs', p);
    expect(s0).toEqual(copy);
  });

  it('share codes round-trip the parameters', () => {
    const p: Params = withStrategy(
      { ...defaultParams(424242), probs: { gas: [0.1, 0.2, 0.7], demand: [0.25, 0.5, 0.25], regulation: [0.4, 0.4, 0.2] } },
      PRESETS.exploit.strategy,
    );
    const back = decodeParams(encodeParams(p));
    expect(back).not.toBeNull();
    expect(back!.seed).toBe(424242);
    expect(back!.strategy).toEqual(p.strategy);
    expect(back!.probs.gas[2]).toBeCloseTo(0.7, 6);
    expect(simulate(back!).series).toEqual(simulate(p).series);
    expect(decodeParams('not-a-code')).toBeNull();
  });
});

describe('model behaviour', () => {
  it('KPIs stay inside 0..100 for every preset', () => {
    for (const id of ['exploit', 'explore', 'greedy', 'green', 'custom'] as const) {
      for (let seed = 1; seed <= 5; seed++) {
        const run = simulate(withStrategy(defaultParams(seed), PRESETS[id].strategy));
        expect(run.series).toHaveLength(CONFIG.horizon + 1);
        for (const k of run.series) {
          for (const key of ['productivity', 'environment', 'customer', 'worker'] as const) {
            expect(k[key]).toBeGreaterThanOrEqual(0);
            expect(k[key]).toBeLessThanOrEqual(100);
          }
          expect(Number.isFinite(k.cash)).toBe(true);
          expect(k.co2).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it('the payoff matrix has one row per action and one column per state', () => {
    const p = defaultParams(3);
    const m = buildPayoffMatrix(initState(p).company, p);
    expect(m.u).toHaveLength(ACTION_IDS.length);
    expect(m.u[0]).toHaveLength(3);
    expect(m.months).toBe(CONFIG.planningHorizon);
    // "Hold steady" is the baseline: its payoff is 0 in every state.
    expect(m.u[ACTION_IDS.indexOf('hold')]).toEqual([0, 0, 0]);
    // Expanding gas pays more when the gas price is high than when it is low.
    const gasRow = m.vec[ACTION_IDS.indexOf('expand_fossil')];
    expect(gasRow[2].profit).toBeGreaterThan(gasRow[0].profit);
    // Going solar is better for the planet than expanding gas, in every state.
    const solarRow = m.vec[ACTION_IDS.indexOf('invest_green')];
    for (let s = 0; s < 3; s++) expect(solarRow[s].planet).toBeGreaterThan(gasRow[s].planet);
  });

  it('switching only the decision rule changes the outcome on the same seed', () => {
    const base = withStrategy(defaultParams(2026), PRESETS.greedy.strategy);
    const finals = RULE_IDS.map((rule) => {
      const c = simulate(withStrategy(base, { ...base.strategy, rule })).final.company;
      return `${c.cumProfit.toFixed(1)}|${c.environment.toFixed(1)}|${c.fossil}|${c.green}`;
    });
    expect(new Set(finals).size).toBeGreaterThanOrEqual(3);
    const maximax = simulate(withStrategy(base, { ...base.strategy, rule: 'maximax' })).final.company;
    const maximin = simulate(withStrategy(base, { ...base.strategy, rule: 'maximin' })).final.company;
    expect(maximax.fossil).toBeGreaterThan(maximin.fossil);
    expect(maximin.environment).toBeGreaterThan(maximax.environment);
  });

  it('long-term contracts (hedge) reduce the spread of profit across gas prices', () => {
    const p = defaultParams(1);
    const free = buildPayoffMatrix(initState(p).company, p);
    const hedged = buildPayoffMatrix(initState(p).company, withStrategy(p, { ...p.strategy, hedge: 0.9 }));
    const spread = (m: typeof free) => m.base[2].profit - m.base[0].profit;
    expect(spread(hedged)).toBeLessThan(spread(free) * 0.5);
  });

  it('workers leave when satisfaction collapses', () => {
    const p = { ...defaultParams(8), shocks: { supply: 0, scandal: 0, strike: 0, heatwave: 0 } };
    let s = initState(p);
    let quits = 0;
    for (let t = 0; t < 6; t++) {
      const r = step({ ...s, company: { ...s.company, worker: 8 } }, 'hold', p);
      quits += r.event.quit.length;
      s = r.state;
    }
    expect(quits).toBeGreaterThanOrEqual(3);
  });
});
