/**
 * Decision Lab — discrete-time agent-based model (1 tick = 1 month).
 * Pure TypeScript: no React, no DOM. See README.md for the equations.
 *
 * Two layers share the same economics:
 *  - stepCore(): deterministic company-level update. Used both by the real
 *    game step and by the look-ahead that builds the payoff matrix.
 *  - step(): stepCore() + the worker agents (stress, turnover, hiring).
 */
import { CONFIG } from './config';
import {
  ACTION_IDS,
  DEMAND_LABELS,
  DEMAND_SHORT,
  GAS_LABELS,
  GAS_SHORT,
  REG_LABELS,
  REG_SHORT,
  SHOCK_IDS,
} from './catalog';
import { beta, categorical, hashRand, mixSeed, mulberry32, normal, uniform, type Rng } from './rng';
import type {
  ActionEffect,
  ActionId,
  Company,
  KpiVec,
  Kpis,
  Lens,
  LensColumn,
  Level,
  Nature,
  NatureFx,
  Params,
  PayoffMatrix,
  SimState,
  StepEvent,
  Weights,
  Worker,
  WorkerParams,
} from './types';

const N = CONFIG.nature;
const E = CONFIG.econ;
const K = CONFIG.kpi;
const S = CONFIG.staff;
const CAPS = CONFIG.caps;
const SH = CONFIG.shocks;
const FX: Record<ActionId, ActionEffect> = CONFIG.actions;

export const clamp = (x: number, lo = 0, hi = 100): number => (x < lo ? lo : x > hi ? hi : x);
export const logistic = (x: number): number => 1 / (1 + Math.exp(-x));

/* ------------------------------------------------------------------ */
/* Probabilities                                                        */
/* ------------------------------------------------------------------ */

/** Make any list of non-negative numbers sum to exactly 1 (uniform if all are 0). */
export function normalizeProbs(p: readonly number[]): number[] {
  const q = p.map((v) => (Number.isFinite(v) && v > 0 ? v : 0));
  const sum = q.reduce((a, b) => a + b, 0);
  if (sum <= 0) return q.map(() => 1 / q.length);
  return q.map((v) => v / sum);
}

/**
 * Change one probability of a list and rescale the others so the list still sums to 1.
 * The other entries keep their relative proportions.
 */
export function setProb(p: readonly number[], index: number, value: number): number[] {
  const v = clamp(value, 0, 1);
  const rest = p.reduce((a, b, i) => (i === index ? a : a + Math.max(0, b)), 0);
  const out = p.map((x, i) => {
    if (i === index) return v;
    return rest > 0 ? (Math.max(0, x) / rest) * (1 - v) : (1 - v) / (p.length - 1);
  });
  return normalizeProbs(out);
}

/** [none, supply, scandal, strike, heatwave]: always sums to 1. */
export function shockProbs(sh: Params['shocks']): number[] {
  let list = [sh.supply, sh.scandal, sh.strike, sh.heatwave].map((v) => clamp(v, 0, 1));
  const sum = list.reduce((a, b) => a + b, 0);
  const MAX = 0.6;
  if (sum > MAX) list = list.map((v) => (v / sum) * MAX);
  const total = Math.min(sum, MAX);
  return [1 - total, ...list];
}

const dot = (p: readonly number[], v: readonly number[]): number => p[0] * v[0] + p[1] * v[1] + p[2] * v[2];

export function expectedGasPrice(probs: Params['probs']): number {
  return dot(normalizeProbs(probs.gas), N.gasPrice);
}

/* ------------------------------------------------------------------ */
/* States of nature                                                     */
/* ------------------------------------------------------------------ */

/** The state of nature of a month depends only on (seed, month, probabilities): never on the player's actions. */
export function drawNature(params: Params, month: number): Nature {
  const r = mulberry32(mixSeed(params.seed, 0xa11ce, month));
  const gas = categorical(r(), normalizeProbs(params.probs.gas)) as Level;
  const demand = categorical(r(), normalizeProbs(params.probs.demand)) as Level;
  const regulation = categorical(r(), normalizeProbs(params.probs.regulation)) as Level;
  const shock = SHOCK_IDS[categorical(r(), shockProbs(params.shocks))];
  return { gas, demand, regulation, shock };
}

export function fxOf(n: Nature): NatureFx {
  return {
    gasPrice: N.gasPrice[n.gas],
    demandMult: N.demandMult[n.demand],
    carbonTax: N.carbonTax[n.regulation],
    strict: n.regulation === 2 ? 1 : 0,
    shock: n.shock,
  };
}

/**
 * Columns of the payoff matrix for a lens.
 * For a single-dimension lens the two other dimensions are held at their expected value.
 * For "scenarios" each column is one named joint state.
 */
export function lensColumns(lens: Lens, probs: Params['probs']): LensColumn[] {
  const pg = normalizeProbs(probs.gas);
  const pd = normalizeProbs(probs.demand);
  const pr = normalizeProbs(probs.regulation);
  const eg = dot(pg, N.gasPrice);
  const ed = dot(pd, N.demandMult);
  const et = dot(pr, N.carbonTax);
  const ps = pr[2];
  const cols: LensColumn[] = [];
  if (lens === 'gas') {
    for (let i = 0; i < 3; i++)
      cols.push({ key: `gas${i}`, label: GAS_LABELS[i], short: GAS_SHORT[i], prob: pg[i], fx: { gasPrice: N.gasPrice[i], demandMult: ed, carbonTax: et, strict: ps, shock: 'none' } });
  } else if (lens === 'demand') {
    for (let i = 0; i < 3; i++)
      cols.push({ key: `dem${i}`, label: DEMAND_LABELS[i], short: DEMAND_SHORT[i], prob: pd[i], fx: { gasPrice: eg, demandMult: N.demandMult[i], carbonTax: et, strict: ps, shock: 'none' } });
  } else if (lens === 'regulation') {
    for (let i = 0; i < 3; i++)
      cols.push({ key: `reg${i}`, label: REG_LABELS[i], short: REG_SHORT[i], prob: pr[i], fx: { gasPrice: eg, demandMult: ed, carbonTax: N.carbonTax[i], strict: i === 2 ? 1 : 0, shock: 'none' } });
  } else {
    const raw = CONFIG.scenarios.map((s) => pg[s.gas] * pd[s.demand] * pr[s.regulation]);
    const p = normalizeProbs(raw);
    CONFIG.scenarios.forEach((s, i) =>
      cols.push({
        key: s.key,
        label: s.label,
        short: s.label,
        hint: s.hint,
        prob: p[i],
        fx: { gasPrice: N.gasPrice[s.gas], demandMult: N.demandMult[s.demand], carbonTax: N.carbonTax[s.regulation], strict: s.regulation === 2 ? 1 : 0, shock: 'none' },
      }),
    );
  }
  return cols;
}

/* ------------------------------------------------------------------ */
/* Company                                                              */
/* ------------------------------------------------------------------ */

export function initialCompany(wp: WorkerParams): Company {
  const s = CONFIG.start;
  return {
    month: 0,
    cash: s.cash,
    profit: 0,
    cumProfit: 0,
    revenue: 0,
    costs: 0,
    taxPaid: 0,
    productivity: s.productivity,
    environment: s.environment,
    customer: s.customer,
    worker: s.worker,
    co2: emissions(s.fossil, s.green, s.waste),
    fossil: s.fossil,
    green: s.green,
    wage: s.wage,
    price: s.price,
    quality: s.quality,
    automation: s.automation,
    waste: s.waste,
    buzz: s.buzz,
    lean: s.lean,
    headcount: wp.count,
    meanSkill: wp.skillMu,
    meanMotivation: wp.motAlpha / (wp.motAlpha + wp.motBeta),
  };
}

export function emissions(fossil: number, green: number, waste: number): number {
  return fossil * E.emissionFossil * (1 - waste) + green * E.emissionGreen;
}

export function requiredStaff(c: Company): number {
  return Math.max(S.min, S.base + S.perUnit * (c.fossil + c.green) - S.perAutomation * c.automation);
}

export function actionCost(c: Company, a: ActionId): number {
  const base = FX[a].cost;
  if (a === 'expand_fossil' || a === 'invest_green' || a === 'balanced_mix') {
    const extra = Math.max(0, c.fossil + c.green - (CONFIG.start.fossil + CONFIG.start.green));
    return base * (1 + CONFIG.expansionCostGrowth * extra);
  }
  return base;
}

const EPS = 1e-9;

/** Can the action still be taken (levels are capped)? */
export function isAvailable(c: Company, a: ActionId): boolean {
  switch (a) {
    case 'expand_fossil':
    case 'invest_green':
    case 'balanced_mix':
      return c.fossil + c.green + 1 <= CAPS.capacity + EPS;
    case 'raise_wages':
      return c.wage < CAPS.wage - EPS;
    case 'training':
      return c.meanSkill < 95;
    case 'automation':
      return c.automation < CAPS.automation;
    case 'cut_costs':
      return c.lean < CAPS.lean && c.headcount - (FX.cut_costs.layoffs ?? 0) >= CAPS.minWorkersAfterLayoffs - EPS;
    case 'lower_prices':
      return c.price > CAPS.priceFloor + EPS;
    case 'improve_quality':
      return c.quality < CAPS.quality;
    case 'marketing':
      return c.buzz < E.buzzRelaunchBelow;
    case 'reduce_waste':
      return c.waste < CAPS.waste - EPS;
    case 'hold':
      return true;
  }
}

/** Immediate effect of an action on the company. With agents, headcount and skill come from the worker list instead. */
function applyAction(c: Company, a: ActionId, meanField: boolean): void {
  const e = FX[a];
  if (e.fossil) c.fossil += e.fossil;
  if (e.green) c.green += e.green;
  if (e.wage) c.wage = Math.min(CAPS.wage, c.wage + e.wage);
  if (e.price) c.price = Math.max(CAPS.priceFloor, c.price + e.price);
  if (e.quality) c.quality = Math.min(CAPS.quality, c.quality + e.quality);
  if (e.automation) c.automation = Math.min(CAPS.automation, c.automation + e.automation);
  if (e.waste) c.waste = Math.min(CAPS.waste, c.waste + e.waste);
  if (e.buzz) c.buzz = Math.min(E.buzzCap, c.buzz + e.buzz);
  if (e.lean) c.lean = Math.min(CAPS.lean, c.lean + e.lean);
  if (e.worker) c.worker = clamp(c.worker + e.worker);
  if (e.customer) c.customer = clamp(c.customer + e.customer);
  if (e.environment) c.environment = clamp(c.environment + e.environment);
  if (meanField) {
    if (e.layoffs) c.headcount = Math.max(0, c.headcount - e.layoffs);
    if (e.skill) c.meanSkill = Math.min(100, c.meanSkill + e.skill);
  }
}

export interface CoreCtx {
  /** Share of gas sales under long-term contracts. */
  hedge: number;
  /** Expected gas price under the player's probabilities (the contract price is based on it). */
  expGas: number;
  turnoverK: number;
  turnoverB: number;
  /** true: headcount follows expected attrition and hiring (look-ahead). false: the worker agents decide. */
  meanField: boolean;
}

export function ctxOf(params: Params, meanField: boolean): CoreCtx {
  return {
    hedge: clamp(params.strategy.hedge, 0, 1),
    expGas: expectedGasPrice(params.probs),
    turnoverK: params.workers.turnoverK,
    turnoverB: params.workers.turnoverB,
    meanField,
  };
}

/**
 * One month of company-level dynamics. Mutates `c`.
 * Order: action -> economics (revenue, costs, profit) -> KPI relaxation -> month + 1.
 */
export function stepCore(c: Company, action: ActionId, fx: NatureFx, ctx: CoreCtx): void {
  const cost = actionCost(c, action);
  applyAction(c, action, ctx.meanField);

  // --- shock effects of the month
  let revMult = 1;
  let dE = 0;
  let dW = 0;
  let dC = 0;
  let dP = 0;
  switch (fx.shock) {
    case 'supply':
      revMult = SH.supply.revenueMult;
      dC = SH.supply.customer;
      break;
    case 'scandal':
      dC = c.environment < SH.scandal.dirtyBelowEnv ? SH.scandal.customerIfDirty : SH.scandal.customer;
      break;
    case 'strike':
      revMult = SH.strike.revenueMult;
      dW = SH.strike.worker;
      break;
    case 'heatwave':
      revMult = SH.heatwave.revenueMult;
      dE = SH.heatwave.environment;
      dW = SH.heatwave.worker;
      dP = SH.heatwave.productivity;
      break;
    case 'none':
      break;
  }

  // --- economics
  const nreq = requiredStaff(c);
  const ratio = nreq > 0 ? c.headcount / nreq : 1;
  const staffing = Math.min(1, ratio);
  const overwork = Math.max(0, 1 - ratio);
  const phi = E.prodBase + (E.prodSlope * c.productivity) / 100;
  const demand =
    fx.demandMult *
    (E.custBase + (E.custSlope * c.customer) / 100) *
    (1 + c.buzz / 100) *
    Math.max(0.2, 1 - E.priceElasticity * (c.price - 1));
  const gasPrice = (1 - ctx.hedge) * fx.gasPrice + ctx.hedge * (1 - E.hedgeDiscount) * ctx.expGas;
  const revenue = c.price * demand * phi * staffing * (c.fossil * gasPrice + c.green * E.greenTariff) * revMult;

  const co2 = emissions(c.fossil, c.green, c.waste);
  const wages = c.headcount * E.wagePerWorker * c.wage;
  const opex = c.fossil * E.fossilOpex * (1 - E.wasteOpexSaving * c.waste) + c.green * E.greenOpex;
  const fixed = Math.max(E.fixedCostFloor, E.fixedCost - E.leanSaving * c.lean);
  const tax = fx.carbonTax * co2 + (c.environment < N.strictFineBelowEnv ? fx.strict * N.strictFine : 0);
  const interest = c.cash < 0 ? -c.cash * E.interestOnDebt : 0;
  const costs = wages + opex + fixed + tax + interest + cost;
  const profit = revenue - costs;

  c.revenue = revenue;
  c.costs = costs;
  c.taxPaid = tax;
  c.profit = profit;
  c.cash += profit;
  c.cumProfit += profit;
  c.co2 = co2;

  // --- KPI relaxation towards their targets
  const envTarget = clamp(100 - K.envPerKt * co2);
  c.environment = clamp(c.environment + K.lambdaEnv * (envTarget - c.environment) + dE);

  const kw = K.worker;
  const workerTarget =
    kw.base +
    kw.wage * (c.wage - 1) -
    kw.overwork * overwork -
    kw.automation * c.automation +
    kw.env * (c.environment - 50) +
    kw.profit * Math.tanh(profit / kw.profitScale);
  c.worker = clamp(c.worker + K.lambdaWorker * (workerTarget - c.worker) + dW);

  const kc = K.customer;
  const customerTarget =
    kc.base + kc.quality * c.quality - kc.price * (c.price - 1) + kc.env * (c.environment - 50) + kc.buzz * c.buzz + kc.worker * (c.worker - 50);
  c.customer = clamp(c.customer + K.lambdaCustomer * (customerTarget - c.customer) + dC);

  const kp = K.productivity;
  const prodTarget =
    100 * (c.meanSkill / 100) * (kp.motBase + c.meanMotivation) * (kp.satBase + (kp.satSlope * c.worker) / 100) + kp.automation * c.automation;
  c.productivity = clamp(c.productivity + K.lambdaProductivity * (prodTarget - c.productivity) + dP);

  c.buzz *= E.buzzDecay;

  // --- expected staffing (look-ahead only)
  if (ctx.meanField) {
    c.headcount -= c.headcount * logistic(-ctx.turnoverK * c.worker + ctx.turnoverB);
    if (c.headcount < Math.round(requiredStaff(c)) && c.worker >= S.hireIfSatisfactionAbove) {
      c.headcount = Math.min(c.headcount + 1, S.maxWorkers);
    }
  }
  c.month += 1;
}

/* ------------------------------------------------------------------ */
/* Payoff matrix                                                        */
/* ------------------------------------------------------------------ */

/** Absolute KPI deltas if we apply `action` now, then hold, with the state `fx` frozen for `months` months. */
export function projectPayoff(c0: Company, action: ActionId, fx: NatureFx, ctx: CoreCtx, months: number): KpiVec {
  const c = { ...c0 };
  stepCore(c, action, fx, ctx);
  for (let i = 1; i < months; i++) stepCore(c, 'hold', fx, ctx);
  return {
    profit: c.cash - c0.cash,
    planet: c.environment - c0.environment,
    people: (c.worker - c0.worker + (c.customer - c0.customer)) / 2,
    productivity: c.productivity - c0.productivity,
  };
}

export function normalizeWeights(w: Weights): Weights {
  const p = Math.max(0, w.profit);
  const e = Math.max(0, w.planet);
  const s = Math.max(0, w.people);
  const sum = p + e + s;
  if (sum <= 0) return { profit: 1 / 3, planet: 1 / 3, people: 1 / 3 };
  return { profit: p / sum, planet: e / sum, people: s / sum };
}

/** Scalar utility of a KPI-delta vector. `w` must already be normalised. */
export function utility(v: KpiVec, w: Weights): number {
  return (w.profit * v.profit) / CONFIG.profitPerPoint + w.planet * v.planet + w.people * v.people;
}

export function buildPayoffMatrix(c: Company, params: Params): PayoffMatrix {
  const columns = lensColumns(params.strategy.lens, params.probs);
  const ctx = ctxOf(params, true);
  const w = normalizeWeights(params.strategy.weights);
  const months = Math.max(1, Math.min(CONFIG.planningHorizon, params.horizon - c.month));
  const u: number[][] = [];
  const vec: KpiVec[][] = [];
  const available: boolean[] = [];
  const costs: number[] = [];
  // Baseline of each column: what happens if we do nothing in that state.
  const base = columns.map((col) => projectPayoff(c, 'hold', col.fx, ctx, months));
  for (const a of ACTION_IDS) {
    const rowU: number[] = [];
    const rowV: KpiVec[] = [];
    for (let s = 0; s < columns.length; s++) {
      // r(a, s) = what the action adds compared with holding steady in the same state.
      const abs = a === 'hold' ? base[s] : projectPayoff(c, a, columns[s].fx, ctx, months);
      const b = base[s];
      const v: KpiVec = { profit: abs.profit - b.profit, planet: abs.planet - b.planet, people: abs.people - b.people, productivity: abs.productivity - b.productivity };
      rowV.push(v);
      rowU.push(utility(v, w));
    }
    u.push(rowU);
    vec.push(rowV);
    available.push(isAvailable(c, a));
    costs.push(actionCost(c, a));
  }
  return { actions: ACTION_IDS, available, costs, columns, probs: columns.map((col) => col.prob), u, vec, base, months };
}

/* ------------------------------------------------------------------ */
/* Worker agents                                                        */
/* ------------------------------------------------------------------ */

export function makeWorker(rng: Rng, id: number, wp: WorkerParams, joined: number): Worker {
  const lo = Math.min(wp.riskMin, wp.riskMax);
  const hi = Math.max(wp.riskMin, wp.riskMax);
  return {
    id,
    skill: clamp(normal(rng, wp.skillMu, Math.max(0, wp.skillSigma)), 5, 100),
    motivation: beta(rng, Math.max(0.2, wp.motAlpha), Math.max(0.2, wp.motBeta)),
    risk: clamp(uniform(rng, lo, hi), 0, 1),
    stress: 0,
    active: true,
    joined,
    left: null,
    leftReason: null,
  };
}

export function createWorkers(params: Params): Worker[] {
  const rng = mulberry32(mixSeed(params.seed, 0xbeef));
  const n = Math.round(clamp(params.workers.count, 1, S.maxWorkers));
  const list: Worker[] = [];
  for (let i = 0; i < n; i++) list.push(makeWorker(rng, i, params.workers, 0));
  return list;
}

function refreshAggregates(c: Company, workers: Worker[]): void {
  let n = 0;
  let skill = 0;
  let mot = 0;
  for (const w of workers) {
    if (!w.active) continue;
    n++;
    skill += w.skill;
    mot += w.motivation;
  }
  c.headcount = n;
  if (n > 0) {
    c.meanSkill = skill / n;
    c.meanMotivation = mot / n;
  }
}

/** Satisfaction of one worker = company-wide satisfaction, shifted by their own motivation and stress. */
export function workerSatisfaction(w: Worker, c: Company): number {
  return clamp(c.worker + K.individualMotivation * (w.motivation - c.meanMotivation) - w.stress);
}

/** Monthly probability that a worker leaves: logistic(-k * satisfaction + b). */
export function turnoverProbability(satisfaction: number, k: number, b: number): number {
  return logistic(-k * satisfaction + b);
}

export type Mood = 'happy' | 'neutral' | 'stressed';
export function moodOf(satisfaction: number): Mood {
  return satisfaction >= 58 ? 'happy' : satisfaction >= 38 ? 'neutral' : 'stressed';
}

export function initState(params: Params): SimState {
  const workers = createWorkers(params);
  const company = initialCompany(params.workers);
  refreshAggregates(company, workers);
  return { company, workers, nextWorkerId: workers.length };
}

export function kpisOf(c: Company): Kpis {
  return {
    month: c.month,
    profit: c.profit,
    cash: c.cash,
    cumProfit: c.cumProfit,
    productivity: c.productivity,
    environment: c.environment,
    customer: c.customer,
    worker: c.worker,
    co2: c.co2,
    headcount: c.headcount,
  };
}

/**
 * Play one real month: the world draws its state, the action is applied,
 * then every worker agent reacts (stress, possible departure) and the company may hire.
 * Does not mutate `state`.
 */
export function step(state: SimState, action: ActionId, params: Params): { state: SimState; event: StepEvent } {
  const month = state.company.month;
  const nature = drawNature(params, month);
  const c: Company = { ...state.company };
  const workers = state.workers.map((w) => ({ ...w }));
  const before = kpisOf(c);
  const laidOff: number[] = [];
  const quit: number[] = [];
  const hired: number[] = [];
  let nextWorkerId = state.nextWorkerId;
  const act: ActionId = isAvailable(c, action) ? action : 'hold';
  const e = FX[act];

  // agent-level part of the action
  if (e.layoffs) {
    const pool = workers.filter((w) => w.active).sort((a, b) => a.skill - b.skill || a.id - b.id);
    for (const w of pool.slice(0, e.layoffs)) {
      w.active = false;
      w.left = month;
      w.leftReason = 'laidoff';
      laidOff.push(w.id);
    }
  }
  if (e.skill) for (const w of workers) if (w.active) w.skill = Math.min(100, w.skill + e.skill);
  refreshAggregates(c, workers);

  // company-level month
  stepCore(c, act, fxOf(nature), ctxOf(params, false));

  // agents: stress, then the decision to stay or leave
  const shaken = nature.shock !== 'none' || laidOff.length > 0;
  const stressHit = SH.stress * (nature.shock === 'strike' ? SH.strikeStressMult : 1);
  for (const w of workers) {
    if (!w.active) continue;
    w.stress *= SH.stressDecay;
    if (shaken) w.stress += stressHit * (1 - w.risk);
    const p = turnoverProbability(workerSatisfaction(w, c), params.workers.turnoverK, params.workers.turnoverB);
    if (hashRand(params.seed, 0x51aff, month, w.id) < p) {
      w.active = false;
      w.left = month;
      w.leftReason = 'quit';
      quit.push(w.id);
    }
  }
  refreshAggregates(c, workers);

  // hiring: one new worker a month while understaffed, if the company is a decent place to work
  if (c.headcount < Math.round(requiredStaff(c)) && c.headcount < S.maxWorkers && c.worker >= S.hireIfSatisfactionAbove) {
    const rng = mulberry32(mixSeed(params.seed, 0x41e, month));
    const w = makeWorker(rng, nextWorkerId++, params.workers, month + 1);
    workers.push(w);
    hired.push(w.id);
    refreshAggregates(c, workers);
  }

  return {
    state: { company: c, workers, nextWorkerId },
    event: { month, nature, action: act, before, after: kpisOf(c), quit, laidOff, hired },
  };
}
