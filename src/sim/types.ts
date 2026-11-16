import type { RuleId } from './rules';

export type ActionId =
  | 'expand_fossil'
  | 'invest_green'
  | 'balanced_mix'
  | 'raise_wages'
  | 'training'
  | 'automation'
  | 'cut_costs'
  | 'lower_prices'
  | 'improve_quality'
  | 'marketing'
  | 'reduce_waste'
  | 'hold';

export type ShockId = 'none' | 'supply' | 'scandal' | 'strike' | 'heatwave';
export type Lens = 'gas' | 'demand' | 'regulation' | 'scenarios';
export type PresetId = 'exploit' | 'explore' | 'greedy' | 'green' | 'custom';
export type Level = 0 | 1 | 2;
export type Triple = [number, number, number];

/** One realised state of nature for a month. */
export interface Nature {
  gas: Level;
  demand: Level;
  regulation: Level;
  shock: ShockId;
}

/** Numeric effect of a state of nature. Expected (mixed) states use fractional values. */
export interface NatureFx {
  gasPrice: number;
  demandMult: number;
  carbonTax: number;
  /** Probability that regulation is "Strict" (0 or 1 for a realised state). */
  strict: number;
  shock: ShockId;
}

export interface Weights {
  profit: number;
  planet: number;
  people: number;
}

export interface Strategy {
  preset: PresetId;
  rule: RuleId;
  /** Hurwicz optimism (1 = Maximax, 0 = Maximin). */
  alpha: number;
  weights: Weights;
  /** Which states of nature form the columns of the payoff matrix. */
  lens: Lens;
  /** Share of gas sales under long-term contracts (0..1): stabilises the price. */
  hedge: number;
}

export interface WorkerParams {
  count: number;
  skillMu: number;
  skillSigma: number;
  motAlpha: number;
  motBeta: number;
  riskMin: number;
  riskMax: number;
  turnoverK: number;
  turnoverB: number;
}

export interface Params {
  seed: number;
  horizon: number;
  probs: { gas: Triple; demand: Triple; regulation: Triple };
  /** Monthly probability of each rare shock. */
  shocks: { supply: number; scandal: number; strike: number; heatwave: number };
  workers: WorkerParams;
  strategy: Strategy;
}

/** Company-level state. Flat and numeric so that projections are cheap. */
export interface Company {
  month: number;
  cash: number;
  /** Profit of the last month played. */
  profit: number;
  cumProfit: number;
  revenue: number;
  costs: number;
  taxPaid: number;
  productivity: number;
  environment: number;
  customer: number;
  worker: number;
  co2: number;
  fossil: number;
  green: number;
  wage: number;
  price: number;
  quality: number;
  automation: number;
  waste: number;
  buzz: number;
  lean: number;
  headcount: number;
  meanSkill: number;
  meanMotivation: number;
}

export interface Worker {
  id: number;
  skill: number;
  motivation: number;
  risk: number;
  /** Personal stress (points removed from this worker's satisfaction). */
  stress: number;
  active: boolean;
  joined: number;
  left: number | null;
  leftReason: 'quit' | 'laidoff' | null;
}

export interface SimState {
  company: Company;
  workers: Worker[];
  nextWorkerId: number;
}

export interface Kpis {
  month: number;
  profit: number;
  cash: number;
  cumProfit: number;
  productivity: number;
  environment: number;
  customer: number;
  worker: number;
  co2: number;
  headcount: number;
}

export interface StepEvent {
  /** Month index that was just played (0-based). */
  month: number;
  nature: Nature;
  action: ActionId;
  before: Kpis;
  after: Kpis;
  quit: number[];
  laidOff: number[];
  hired: number[];
}

/** KPI deltas after the look-ahead. */
export interface KpiVec {
  /** Change in cash over the look-ahead (M DA). */
  profit: number;
  /** Change in Environment (points). */
  planet: number;
  /** Mean change of Worker and Customer satisfaction (points). */
  people: number;
  /** Change in Productivity (points), shown for information. */
  productivity: number;
}

export interface LensColumn {
  key: string;
  label: string;
  short: string;
  hint?: string;
  prob: number;
  fx: NatureFx;
}

export interface PayoffMatrix {
  actions: ActionId[];
  available: boolean[];
  costs: number[];
  columns: LensColumn[];
  probs: number[];
  /** Scalar utility u[a][s] used by the rules. */
  u: number[][];
  /** KPI-delta vectors r[a][s], measured against "Hold steady" in the same state. */
  vec: KpiVec[][];
  /** Per column: absolute KPI deltas of "Hold steady" (the baseline every row is compared with). */
  base: KpiVec[];
  /** Look-ahead actually used (months). */
  months: number;
}

export interface ActionEffect {
  cost: number;
  fossil?: number;
  green?: number;
  wage?: number;
  price?: number;
  quality?: number;
  automation?: number;
  waste?: number;
  buzz?: number;
  lean?: number;
  layoffs?: number;
  skill?: number;
  worker?: number;
  customer?: number;
  environment?: number;
}

export type { RuleId };
