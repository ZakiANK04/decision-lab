/**
 * Strategies (a rule + weights + lens), full-game simulation, scoring and
 * the "decision style" shown on the end screen.
 */
import { CONFIG } from './config';
import { ACTIONS } from './catalog';
import { buildPayoffMatrix, drawNature, initState, kpisOf, step } from './model';
import { applyRule, RULE_IDS, RULES, type RuleId } from './rules';
import type { ActionId, Company, Kpis, Nature, Params, PayoffMatrix, PresetId, SimState, StepEvent, Strategy } from './types';

/* ------------------------------------------------------------------ */
/* Presets                                                              */
/* ------------------------------------------------------------------ */

export interface PresetInfo {
  id: PresetId;
  name: string;
  tag: string;
  blurb: string;
  strategy: Strategy;
}

export const PRESETS: Record<PresetId, PresetInfo> = {
  exploit: {
    id: 'exploit',
    name: 'Exploit',
    tag: 'Sonatrach-like',
    blurb: 'Security first. Maximin, with long-term contracts that flatten the gas price.',
    strategy: { preset: 'exploit', rule: 'maximin', alpha: 0.6, weights: { profit: 0.8, planet: 0.05, people: 0.15 }, lens: 'gas', hedge: 0.9 },
  },
  explore: {
    id: 'explore',
    name: 'Explore',
    tag: 'Shell-like',
    blurb: 'Scenario planning. Tests every move in four named futures and keeps the most robust.',
    strategy: { preset: 'explore', rule: 'regret', alpha: 0.6, weights: { profit: 0.45, planet: 0.3, people: 0.25 }, lens: 'scenarios', hedge: 0 },
  },
  greedy: {
    id: 'greedy',
    name: 'Greedy optimist',
    tag: 'Maximax',
    blurb: 'Only the best case counts, and profit comes first.',
    strategy: { preset: 'greedy', rule: 'maximax', alpha: 0.6, weights: { profit: 0.85, planet: 0.05, people: 0.1 }, lens: 'gas', hedge: 0 },
  },
  green: {
    id: 'green',
    name: 'Green first',
    tag: 'Planet-weighted',
    blurb: 'Expected value, but the planet weighs three times more than profit.',
    strategy: { preset: 'green', rule: 'ev', alpha: 0.6, weights: { profit: 0.2, planet: 0.6, people: 0.2 }, lens: 'gas', hedge: 0 },
  },
  custom: {
    id: 'custom',
    name: 'Custom',
    tag: 'Your mix',
    blurb: 'Your own rule, weights and probabilities.',
    strategy: { preset: 'custom', rule: 'ev', alpha: 0.6, weights: { profit: 0.4, planet: 0.3, people: 0.3 }, lens: 'gas', hedge: 0 },
  },
};

export const PRESET_IDS: PresetId[] = ['exploit', 'explore', 'greedy', 'green', 'custom'];

export function defaultParams(seed = 2026): Params {
  return {
    seed: seed >>> 0,
    horizon: CONFIG.horizon,
    probs: {
      gas: [...CONFIG.defaultProbs.gas],
      demand: [...CONFIG.defaultProbs.demand],
      regulation: [...CONFIG.defaultProbs.regulation],
    },
    shocks: { ...CONFIG.defaultShocks },
    workers: { ...CONFIG.defaultWorkers },
    strategy: { ...PRESETS.custom.strategy, weights: { ...PRESETS.custom.strategy.weights } },
  };
}

export function withStrategy(params: Params, strategy: Strategy): Params {
  return { ...params, strategy: { ...strategy, weights: { ...strategy.weights } } };
}

/* ------------------------------------------------------------------ */
/* Choosing with a rule                                                 */
/* ------------------------------------------------------------------ */

export function rulePick(matrix: PayoffMatrix, rule: RuleId, alpha: number): ActionId {
  const r = applyRule(rule, matrix.u, matrix.probs, alpha, matrix.available);
  return r.winner >= 0 ? matrix.actions[r.winner] : 'hold';
}

export function allRulePicks(matrix: PayoffMatrix, alpha: number): Record<RuleId, ActionId> {
  const out = {} as Record<RuleId, ActionId>;
  for (const id of RULE_IDS) out[id] = rulePick(matrix, id, alpha);
  return out;
}

/* ------------------------------------------------------------------ */
/* Full run                                                             */
/* ------------------------------------------------------------------ */

export interface MonthRecord {
  month: number;
  action: ActionId;
  /** true if the rule chose, false if the player chose by hand. */
  auto: boolean;
  /** What each rule would have picked that month. */
  rulePicks: Record<RuleId, ActionId> | null;
  nature: Nature;
  kpis: Kpis;
}

export interface RunResult {
  final: SimState;
  /** KPIs at month 0, 1, ..., horizon (length horizon + 1). */
  series: Kpis[];
  events: StepEvent[];
}

/** Let the strategy's rule play a whole game. Deterministic for a given `params`. */
export function simulate(params: Params, keepEvents = false): RunResult {
  let state = initState(params);
  const series: Kpis[] = [kpisOf(state.company)];
  const events: StepEvent[] = [];
  for (let t = 0; t < params.horizon; t++) {
    const matrix = buildPayoffMatrix(state.company, params);
    const action = rulePick(matrix, params.strategy.rule, params.strategy.alpha);
    const res = step(state, action, params);
    state = res.state;
    series.push(res.event.after);
    if (keepEvents) events.push(res.event);
  }
  return { final: state, series, events };
}

/** The sequence of states of nature of a game (handy for tests and for the UI timeline). */
export function natureTimeline(params: Params): Nature[] {
  const out: Nature[] = [];
  for (let t = 0; t < params.horizon; t++) out.push(drawNature(params, t));
  return out;
}

/* ------------------------------------------------------------------ */
/* Scoring                                                              */
/* ------------------------------------------------------------------ */

export interface Scores {
  profit: number;
  planet: number;
  people: number;
  overall: number;
}

export function scoreOf(c: Company): Scores {
  const { profitLo, profitHi } = CONFIG.score;
  const profit = Math.max(0, Math.min(100, (100 * (c.cumProfit - profitLo)) / (profitHi - profitLo)));
  const planet = c.environment;
  const people = (c.worker + c.customer) / 2;
  return { profit, planet, people, overall: (profit + planet + people) / 3 };
}

export function gradeOf(score: number): string {
  for (const g of CONFIG.score.grades) if (score >= g.min) return g.grade;
  return 'E';
}

/* ------------------------------------------------------------------ */
/* Decision style                                                       */
/* ------------------------------------------------------------------ */

export interface DecisionStyle {
  title: string;
  sentence: string;
  /** Rule the player's choices agreed with most often (null if nothing was chosen by hand). */
  closestRule: RuleId | null;
  /** Share of hand-made choices that matched that rule (0..1). */
  agreement: number;
  tilt: 'profit' | 'planet' | 'people' | 'balanced';
  manualShare: number;
  perRule: Record<RuleId, number>;
}

const STYLE_TITLES: Record<RuleId, string> = {
  maximax: 'Bold optimist',
  maximin: 'Cautious optimiser',
  hurwicz: 'Calibrated realist',
  laplace: 'Even-handed planner',
  regret: 'Regret dodger',
  ev: 'Cool-headed statistician',
};

const TILT_WORDS = { profit: 'a profit tilt', planet: 'a green tilt', people: 'a people tilt', balanced: 'no strong tilt' } as const;

export function decisionStyle(records: MonthRecord[], strategy: Strategy): DecisionStyle {
  const perRule = {} as Record<RuleId, number>;
  for (const id of RULE_IDS) perRule[id] = 0;

  const tiltCount = { profit: 0, planet: 0, people: 0 };
  for (const r of records) {
    const t = ACTIONS[r.action].tilt;
    if (t !== 'none') tiltCount[t]++;
  }
  const tiltTotal = tiltCount.profit + tiltCount.planet + tiltCount.people;
  let tilt: DecisionStyle['tilt'] = 'balanced';
  if (tiltTotal > 0) {
    const best = (['profit', 'planet', 'people'] as const).reduce((a, b) => (tiltCount[b] > tiltCount[a] ? b : a));
    if (tiltCount[best] / tiltTotal >= 0.45) tilt = best;
  }

  const manual = records.filter((r) => !r.auto && r.rulePicks);
  const manualShare = records.length ? manual.length / records.length : 0;

  if (manual.length < 3) {
    const rule = strategy.rule;
    return {
      title: 'The delegator',
      sentence: `You let ${RULES[rule].short} drive, with ${TILT_WORDS[tilt]}.`,
      closestRule: null,
      agreement: 0,
      tilt,
      manualShare,
      perRule,
    };
  }

  for (const r of manual) for (const id of RULE_IDS) if (r.rulePicks![id] === r.action) perRule[id]++;
  for (const id of RULE_IDS) perRule[id] /= manual.length;
  // Ties go to the rule the player had selected, then to list order.
  let closest: RuleId = strategy.rule;
  for (const id of RULE_IDS) if (perRule[id] > perRule[closest] + 1e-9) closest = id;
  const agreement = perRule[closest];

  if (agreement < 0.25) {
    return {
      title: 'Free spirit',
      sentence: `No textbook rule explains your choices. You played by instinct, with ${TILT_WORDS[tilt]}.`,
      closestRule: closest,
      agreement,
      tilt,
      manualShare,
      perRule,
    };
  }
  return {
    title: STYLE_TITLES[closest],
    sentence: `You behaved like ${RULES[closest].short} with ${TILT_WORDS[tilt]}.`,
    closestRule: closest,
    agreement,
    tilt,
    manualShare,
    perRule,
  };
}
