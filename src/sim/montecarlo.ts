/**
 * Monte Carlo, Compare (common random numbers) and Pareto sweeps.
 * Pure functions: the Web Worker in src/workers just calls them.
 */
import { mixSeed } from './rng';
import { PRESETS, scoreOf, simulate, withStrategy } from './policy';
import { RULE_IDS, RULES, type RuleId } from './rules';
import { paretoFront, summarize, type Summary } from './stats';
import type { Kpis, Params, SimState, Strategy, Weights } from './types';

export type OutcomeKey = 'profit' | 'productivity' | 'environment' | 'customer' | 'worker' | 'co2' | 'score';
export const OUTCOME_KEYS: OutcomeKey[] = ['profit', 'productivity', 'environment', 'customer', 'worker', 'co2', 'score'];
export const OUTCOME_LABELS: Record<OutcomeKey, string> = {
  profit: 'Total profit',
  productivity: 'Productivity',
  environment: 'Environment',
  customer: 'Customers',
  worker: 'Workers',
  co2: 'CO₂ / month',
  score: 'Overall score',
};

export type Outcome = Record<OutcomeKey, number>;

export function outcomeOf(state: SimState): Outcome {
  const c = state.company;
  return {
    profit: c.cumProfit,
    productivity: c.productivity,
    environment: c.environment,
    customer: c.customer,
    worker: c.worker,
    co2: c.co2,
    score: scoreOf(c).overall,
  };
}

/** Seed of run i. Run 0 is the player's own world. */
export function runSeed(baseSeed: number, i: number): number {
  return i === 0 ? baseSeed >>> 0 : mixSeed(baseSeed, 0x5eed, i);
}

export type Progress = (done: number, total: number) => void;

/* ------------------------------------------------------------------ */
/* Monte Carlo                                                          */
/* ------------------------------------------------------------------ */

export interface MonteCarloResult {
  n: number;
  outcomes: Outcome[];
  summary: Record<OutcomeKey, Summary>;
}

export function summarizeOutcomes(outcomes: Outcome[]): Record<OutcomeKey, Summary> {
  const out = {} as Record<OutcomeKey, Summary>;
  for (const k of OUTCOME_KEYS) out[k] = summarize(outcomes.map((o) => o[k]));
  return out;
}

export function runMonteCarlo(params: Params, n: number, onProgress?: Progress): MonteCarloResult {
  const outcomes: Outcome[] = [];
  for (let i = 0; i < n; i++) {
    outcomes.push(outcomeOf(simulate({ ...params, seed: runSeed(params.seed, i) }).final));
    if (onProgress && (i % 10 === 9 || i === n - 1)) onProgress(i + 1, n);
  }
  return { n, outcomes, summary: summarizeOutcomes(outcomes) };
}

/* ------------------------------------------------------------------ */
/* Compare: two strategies on the same seeds                            */
/* ------------------------------------------------------------------ */

export type SeriesKey = 'cumProfit' | 'productivity' | 'environment' | 'customer' | 'worker' | 'co2';
export const SERIES_KEYS: SeriesKey[] = ['cumProfit', 'productivity', 'environment', 'customer', 'worker', 'co2'];
export const SERIES_LABELS: Record<SeriesKey, string> = {
  cumProfit: 'Total profit',
  productivity: 'Productivity',
  environment: 'Environment',
  customer: 'Customers',
  worker: 'Workers',
  co2: 'CO₂ / month',
};

export interface CompareSide {
  label: string;
  /** Mean of each KPI at month 0..horizon over all seeds. */
  series: Record<SeriesKey, number[]>;
  summary: Record<OutcomeKey, Summary>;
  wins: number;
}

export interface CompareResult {
  n: number;
  a: CompareSide;
  b: CompareSide;
  ties: number;
  /** 'a', 'b' or 'tie', judged on the mean overall score. */
  winner: 'a' | 'b' | 'tie';
}

function emptySeries(len: number): Record<SeriesKey, number[]> {
  const s = {} as Record<SeriesKey, number[]>;
  for (const k of SERIES_KEYS) s[k] = new Array<number>(len).fill(0);
  return s;
}

function addSeries(acc: Record<SeriesKey, number[]>, series: Kpis[]): void {
  for (const k of SERIES_KEYS) {
    const row = acc[k];
    for (let t = 0; t < series.length; t++) row[t] += series[t][k];
  }
}

export function runCompare(
  params: Params,
  a: { label: string; strategy: Strategy },
  b: { label: string; strategy: Strategy },
  n: number,
  onProgress?: Progress,
): CompareResult {
  const len = params.horizon + 1;
  const sa = emptySeries(len);
  const sb = emptySeries(len);
  const oa: Outcome[] = [];
  const ob: Outcome[] = [];
  let winsA = 0;
  let winsB = 0;
  let ties = 0;
  for (let i = 0; i < n; i++) {
    const seed = runSeed(params.seed, i);
    // Common random numbers: both strategies face exactly the same world.
    const ra = simulate({ ...withStrategy(params, a.strategy), seed });
    const rb = simulate({ ...withStrategy(params, b.strategy), seed });
    addSeries(sa, ra.series);
    addSeries(sb, rb.series);
    const xa = outcomeOf(ra.final);
    const xb = outcomeOf(rb.final);
    oa.push(xa);
    ob.push(xb);
    if (Math.abs(xa.score - xb.score) < 1e-6) ties++;
    else if (xa.score > xb.score) winsA++;
    else winsB++;
    if (onProgress && (i % 5 === 4 || i === n - 1)) onProgress(i + 1, n);
  }
  for (const k of SERIES_KEYS) {
    for (let t = 0; t < len; t++) {
      sa[k][t] /= n;
      sb[k][t] /= n;
    }
  }
  const sumA = summarizeOutcomes(oa);
  const sumB = summarizeOutcomes(ob);
  const diff = sumA.score.mean - sumB.score.mean;
  return {
    n,
    a: { label: a.label, series: sa, summary: sumA, wins: winsA },
    b: { label: b.label, series: sb, summary: sumB, wins: winsB },
    ties,
    winner: Math.abs(diff) < 0.05 ? 'tie' : diff > 0 ? 'a' : 'b',
  };
}

/* ------------------------------------------------------------------ */
/* Pareto: many strategies, mean outcome of each                        */
/* ------------------------------------------------------------------ */

export interface ParetoPoint {
  label: string;
  rule: RuleId | null;
  weights: Weights;
  /** Mean total profit (M DA). */
  profit: number;
  /** Mean final Environment. */
  planet: number;
  /** Mean final (Workers + Customers) / 2. */
  people: number;
  onFront: boolean;
  isYou: boolean;
}

export interface ParetoResult {
  points: ParetoPoint[];
  seedsPerPoint: number;
}

const WEIGHT_MIXES: { name: string; w: Weights }[] = [
  { name: 'profit only', w: { profit: 1, planet: 0, people: 0 } },
  { name: 'profit-led', w: { profit: 0.7, planet: 0.15, people: 0.15 } },
  { name: 'balanced', w: { profit: 0.34, planet: 0.33, people: 0.33 } },
  { name: 'planet-led', w: { profit: 0.2, planet: 0.6, people: 0.2 } },
  { name: 'people-led', w: { profit: 0.2, planet: 0.2, people: 0.6 } },
];

function meanOutcome(params: Params, seeds: number): { profit: number; planet: number; people: number } {
  let profit = 0;
  let planet = 0;
  let people = 0;
  for (let i = 0; i < seeds; i++) {
    const c = simulate({ ...params, seed: runSeed(params.seed, i) }).final.company;
    profit += c.cumProfit;
    planet += c.environment;
    people += (c.worker + c.customer) / 2;
  }
  return { profit: profit / seeds, planet: planet / seeds, people: people / seeds };
}

/** Sweep rules x weight mixes (plus the player's own strategy) and mark the non-dominated ones. */
export function runPareto(params: Params, seedsPerPoint: number, onProgress?: Progress): ParetoResult {
  const points: ParetoPoint[] = [];
  const total = RULE_IDS.length * WEIGHT_MIXES.length + 1;
  let done = 0;
  for (const rule of RULE_IDS) {
    for (const mix of WEIGHT_MIXES) {
      const strategy: Strategy = { ...params.strategy, preset: 'custom', rule, weights: mix.w };
      const m = meanOutcome(withStrategy(params, strategy), seedsPerPoint);
      points.push({ label: `${RULES[rule].short} · ${mix.name}`, rule, weights: mix.w, ...m, onFront: false, isYou: false });
      onProgress?.(++done, total);
    }
  }
  const you = meanOutcome(params, seedsPerPoint);
  points.push({ label: 'Your strategy', rule: params.strategy.rule, weights: params.strategy.weights, ...you, onFront: false, isYou: true });
  onProgress?.(++done, total);
  for (const i of paretoFront(points.map((p) => [p.profit, p.planet, p.people]))) points[i].onFront = true;
  return { points, seedsPerPoint };
}

/** Labelled strategies offered in Compare mode: the four presets, then each rule with the player's weights. */
export function compareOptions(params: Params): { id: string; label: string; strategy: Strategy }[] {
  const out: { id: string; label: string; strategy: Strategy }[] = [
    { id: 'you', label: 'Your strategy', strategy: params.strategy },
    { id: 'exploit', label: 'Exploit (Sonatrach-like)', strategy: PRESETS.exploit.strategy },
    { id: 'explore', label: 'Explore (Shell-like)', strategy: PRESETS.explore.strategy },
    { id: 'greedy', label: 'Greedy optimist', strategy: PRESETS.greedy.strategy },
    { id: 'green', label: 'Green first', strategy: PRESETS.green.strategy },
  ];
  for (const rule of RULE_IDS) out.push({ id: `rule:${rule}`, label: `${RULES[rule].short} · your weights`, strategy: { ...params.strategy, preset: 'custom', rule } });
  return out;
}
