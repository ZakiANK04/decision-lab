/**
 * CONFIG — every tunable coefficient of the Decision Lab model lives here.
 *
 * Nothing in this file is measured data. All numbers are ASSUMPTIONS chosen so
 * that (1) a 36-month game is interesting, (2) the six decision rules disagree
 * with each other, and (3) the trade-off profit / planet / people is visible.
 * Change values here; you should never need to touch the logic in model.ts.
 *
 * Units: money in M DA (million dinars) per month, CO2 in kt per month,
 * KPIs in points on a 0-100 scale.
 */
export const CONFIG = {
  /** Length of a game in months (1 tick = 1 month). */
  horizon: 36,
  /** Look-ahead used to build the payoff matrix r(a, s), in months. */
  planningHorizon: 18,

  /** Company at month 0. */
  start: {
    cash: 30,
    productivity: 54,
    environment: 52,
    customer: 56,
    worker: 58,
    fossil: 6, // gas production units
    green: 1, // solar / wind units
    wage: 1, // wage level (1 = market wage)
    price: 1, // selling-price level (1 = list price)
    quality: 1, // quality level 0..qualityCap
    automation: 0,
    waste: 0, // share of emissions avoided by recycling, 0..wasteCap
    buzz: 0, // marketing buzz, decays every month
    lean: 0, // number of cost-cutting rounds done
  },

  /** States of nature: what each level does. Index 0 / 1 / 2. */
  nature: {
    /** Revenue per fossil unit (M DA / month) at Low / Medium / High gas price. */
    gasPrice: [0.7, 1.5, 2.6],
    /** Demand multiplier at Weak / Normal / Boom. */
    demandMult: [0.8, 1.0, 1.22],
    /** Carbon tax (M DA per kt CO2) at Lax / Carbon tax / Strict. */
    carbonTax: [0, 0.035, 0.08],
    /** Under "Strict", a flat monthly fine if Environment is below the threshold. */
    strictFine: 2.5,
    strictFineBelowEnv: 40,
  },

  /** Default probabilities (the player can change them; they always sum to 1). */
  defaultProbs: {
    gas: [0.3, 0.5, 0.2], // same as slide 08 of the deck
    demand: [0.25, 0.5, 0.25],
    regulation: [0.4, 0.4, 0.2],
  },
  /** Default monthly probability of each rare shock. */
  defaultShocks: { supply: 0.03, scandal: 0.02, strike: 0.02, heatwave: 0.03 },

  /** Effects of rare shocks in the month they hit. */
  shocks: {
    supply: { revenueMult: 0.8, customer: -5 },
    scandal: { customer: -10, customerIfDirty: -18, dirtyBelowEnv: 45 },
    strike: { revenueMult: 0.65, worker: -8 },
    heatwave: { revenueMult: 0.95, environment: -5, worker: -3, productivity: -3 },
    /** Personal stress added to a worker by a shock or a layoff round: stress * (1 - riskTolerance). */
    stress: 10,
    strikeStressMult: 1.5,
    /** Share of personal stress that remains after one month. */
    stressDecay: 0.75,
  },

  /** Economics. */
  econ: {
    /** Revenue per green unit (M DA / month). Fixed tariff: it does not move with the gas price. */
    greenTariff: 1.0,
    /** Output factor phi = prodBase + prodSlope * Productivity / 100 (equals ~1 at Productivity 50). */
    prodBase: 0.55,
    prodSlope: 0.9,
    /** Demand factor from customers = custBase + custSlope * CustomerSatisfaction / 100. */
    custBase: 0.7,
    custSlope: 0.6,
    /** Volume lost per unit of price level above 1 (and gained below 1). */
    priceElasticity: 0.3,
    /** Buzz cap (points). Demand is multiplied by (1 + buzz / 100). */
    buzzCap: 30,
    buzzDecay: 0.7,
    /** Marketing can be launched again once buzz has faded below this. */
    buzzRelaunchBelow: 5,
    /** Costs (M DA / month). */
    wagePerWorker: 0.25,
    fossilOpex: 0.32,
    greenOpex: 0.12,
    fixedCost: 1.0,
    fixedCostFloor: 0.4,
    leanSaving: 0.2, // fixed cost removed by each cost-cutting round
    /** Share of fossil opex saved per unit of waste reduction. */
    wasteOpexSaving: 0.5,
    /** Emissions (kt CO2 per unit per month). */
    emissionFossil: 10,
    emissionGreen: 0.5,
    /** Monthly interest on negative cash. */
    interestOnDebt: 0.02,
    /** Long-term contracts: price discount accepted in exchange for a stable price. */
    hedgeDiscount: 0.04,
  },

  /** Staffing. Required staff = base + perUnit * (fossil + green) - perAutomation * automation. */
  staff: {
    base: 6,
    perUnit: 0.8,
    perAutomation: 1.5,
    min: 4,
    maxWorkers: 20,
    /** New workers only join if worker satisfaction is at least this. */
    hireIfSatisfactionAbove: 45,
  },

  /** KPI dynamics: x <- x + lambda * (x* - x). */
  kpi: {
    lambdaEnv: 0.12,
    lambdaWorker: 0.2,
    lambdaCustomer: 0.2,
    lambdaProductivity: 0.25,
    /** Environment target E* = 100 - envPerKt * CO2. */
    envPerKt: 0.75,
    /** Worker target W* = base + wage*(wage-1) - overwork*overwork - automation*automation + env*(E-50) + profit*tanh(profit/profitScale). */
    worker: { base: 56, wage: 40, overwork: 30, automation: 2.5, env: 0.12, profit: 3, profitScale: 4 },
    /** Customer target C* = base + quality*q - price*(price-1) + env*(E-50) + buzz*buzz + worker*(W-50). */
    customer: { base: 51, quality: 4, price: 60, env: 0.15, buzz: 0.4, worker: 0.1 },
    /** Productivity target P* = 100 * skill/100 * (motBase + motivation) * (satBase + satSlope*W/100) + automation*automation. */
    productivity: { motBase: 0.5, satBase: 0.6, satSlope: 0.4, automation: 7 },
    /** How much an individual's motivation shifts their own satisfaction (points per unit of motivation above the mean). */
    individualMotivation: 25,
  },

  /** Actions: one-off cost (M DA) and immediate effects. Levels are capped. */
  actions: {
    expand_fossil: { cost: 6.5, fossil: 1, worker: -1 },
    invest_green: { cost: 12, green: 1, customer: 1 },
    balanced_mix: { cost: 9, fossil: 0.5, green: 0.5 },
    raise_wages: { cost: 0, wage: 0.08, worker: 3 },
    training: { cost: 4, skill: 4, worker: 1.5 },
    automation: { cost: 9, automation: 1, worker: -3 },
    cut_costs: { cost: 1, layoffs: 2, lean: 1, worker: -8, customer: -2 },
    lower_prices: { cost: 0, price: -0.05, customer: 2 },
    improve_quality: { cost: 5, quality: 1 },
    marketing: { cost: 5, buzz: 10 },
    reduce_waste: { cost: 4, waste: 0.07, environment: 1.5 },
    hold: { cost: 0 },
  },
  /** Each extra production unit above the starting 7 makes the next one this much dearer. */
  expansionCostGrowth: 0.06,
  caps: {
    wage: 1.5,
    priceFloor: 0.8,
    quality: 5,
    automation: 5,
    waste: 0.42,
    lean: 3,
    capacity: 16, // fossil + green
    minWorkersAfterLayoffs: 6,
  },

  /** Scalar utility: 1 point of the profit pillar = this many M DA of cash over the look-ahead. */
  profitPerPoint: 3,

  /** End-of-game scoring. */
  score: {
    /** Cumulative profit (M DA) mapped linearly to 0..100. */
    profitLo: -20,
    profitHi: 380,
    grades: [
      { min: 80, grade: 'A' },
      { min: 65, grade: 'B' },
      { min: 50, grade: 'C' },
      { min: 35, grade: 'D' },
      { min: -Infinity, grade: 'E' },
    ],
  },

  /** Default worker population. */
  defaultWorkers: {
    count: 12,
    skillMu: 60,
    skillSigma: 12,
    motAlpha: 4,
    motBeta: 3,
    riskMin: 0.1,
    riskMax: 0.9,
    turnoverK: 0.09,
    turnoverB: 0.3,
  },

  /** Named scenarios used by the "Explore" (Shell-like) preset: one joint state each. */
  scenarios: [
    { key: 'archipelagos', label: 'Archipelagos', hint: 'Security first: high gas price, lax rules', gas: 2, demand: 1, regulation: 0 },
    { key: 'sky', label: 'Sky 2050', hint: 'Fast transition: low gas price, strict rules', gas: 0, demand: 1, regulation: 2 },
    { key: 'boom', label: 'Boom', hint: 'Strong demand, medium price, carbon tax', gas: 1, demand: 2, regulation: 1 },
    { key: 'crunch', label: 'Crunch', hint: 'Weak demand, low price, carbon tax', gas: 0, demand: 0, regulation: 1 },
  ],
} as const;

export type Config = typeof CONFIG;
