/**
 * The six decision rules of the deck (slides 08 and 09).
 * Input: a payoff matrix u[a][s] (rows = actions, columns = states of nature)
 * and, for Expected value, the probabilities P(s).
 */

export type RuleId = 'maximax' | 'maximin' | 'hurwicz' | 'laplace' | 'regret' | 'ev';

export const RULE_IDS: RuleId[] = ['maximax', 'maximin', 'hurwicz', 'laplace', 'regret', 'ev'];

export interface RuleInfo {
  id: RuleId;
  name: string;
  short: string;
  persona: string;
  formula: string;
  how: string;
  scoreLabel: string;
}

export const RULES: Record<RuleId, RuleInfo> = {
  maximax: {
    id: 'maximax',
    name: 'Maximax',
    short: 'Maximax',
    persona: 'The optimist',
    formula: 'argmax_a  max_s  r(a, s)',
    how: 'Look only at the best case of each action. Take the highest.',
    scoreLabel: 'Best case',
  },
  maximin: {
    id: 'maximin',
    name: 'Maximin (Wald)',
    short: 'Maximin',
    persona: 'The pessimist',
    formula: 'argmax_a  min_s  r(a, s)',
    how: 'Look only at the worst case of each action. Take the least bad.',
    scoreLabel: 'Worst case',
  },
  hurwicz: {
    id: 'hurwicz',
    name: 'Hurwicz',
    short: 'Hurwicz',
    persona: 'The realist',
    formula: 'argmax_a  α·max_s r + (1−α)·min_s r',
    how: 'Mix best and worst case with an optimism dial α.',
    scoreLabel: 'α-mix',
  },
  laplace: {
    id: 'laplace',
    name: 'Laplace',
    short: 'Laplace',
    persona: 'The equal-chances thinker',
    formula: 'argmax_a  (1/n)·Σ_s r(a, s)',
    how: 'No idea about the odds? Treat every state as equally likely.',
    scoreLabel: 'Average',
  },
  regret: {
    id: 'regret',
    name: 'Minimax regret (Savage)',
    short: 'Min regret',
    persona: 'The regret-averse',
    formula: 'argmin_a  max_s [ max_a′ r(a′, s) − r(a, s) ]',
    how: 'Regret = best payoff in the column minus yours. Keep the worst regret small.',
    scoreLabel: 'Max regret',
  },
  ev: {
    id: 'ev',
    name: 'Expected value',
    short: 'Expected value',
    persona: 'The statistician',
    formula: 'argmax_a  Σ_s P(s)·r(a, s)',
    how: 'Weight each payoff by its probability. Highest average wins.',
    scoreLabel: 'Expected',
  },
};

export interface RuleResult {
  /** One score per action, in the rule's own unit (for regret: the maximum regret). */
  scores: number[];
  /** Index of the winning action (-1 if no action is available). */
  winner: number;
  /** 'max' if a higher score is better, 'min' for minimax regret. */
  better: 'max' | 'min';
}

/** Regret matrix: best payoff in each column minus the cell. Unavailable rows are ignored for the column best. */
export function regretMatrix(u: readonly (readonly number[])[], available?: readonly boolean[]): number[][] {
  const nS = u.length ? u[0].length : 0;
  const colBest = new Array<number>(nS).fill(-Infinity);
  for (let a = 0; a < u.length; a++) {
    if (available && !available[a]) continue;
    for (let s = 0; s < nS; s++) if (u[a][s] > colBest[s]) colBest[s] = u[a][s];
  }
  return u.map((row) => row.map((v, s) => colBest[s] - v));
}

/**
 * Apply one rule. Ties go to the first action in the list.
 * `alpha` is the Hurwicz optimism weight (1 = Maximax, 0 = Maximin).
 */
export function applyRule(
  rule: RuleId,
  u: readonly (readonly number[])[],
  probs: readonly number[],
  alpha = 0.6,
  available?: readonly boolean[],
): RuleResult {
  const nA = u.length;
  const nS = nA ? u[0].length : 0;
  const scores = new Array<number>(nA).fill(0);
  const better: 'max' | 'min' = rule === 'regret' ? 'min' : 'max';
  const regrets = rule === 'regret' ? regretMatrix(u, available) : null;

  for (let a = 0; a < nA; a++) {
    const row = u[a];
    let max = -Infinity;
    let min = Infinity;
    let sum = 0;
    let ev = 0;
    for (let s = 0; s < nS; s++) {
      const v = row[s];
      if (v > max) max = v;
      if (v < min) min = v;
      sum += v;
      ev += probs[s] * v;
    }
    switch (rule) {
      case 'maximax':
        scores[a] = max;
        break;
      case 'maximin':
        scores[a] = min;
        break;
      case 'hurwicz':
        scores[a] = alpha * max + (1 - alpha) * min;
        break;
      case 'laplace':
        scores[a] = nS ? sum / nS : 0;
        break;
      case 'ev':
        scores[a] = ev;
        break;
      case 'regret': {
        let worst = -Infinity;
        for (let s = 0; s < nS; s++) if (regrets![a][s] > worst) worst = regrets![a][s];
        scores[a] = worst;
        break;
      }
    }
  }

  let winner = -1;
  const EPS = 1e-9;
  for (let a = 0; a < nA; a++) {
    if (available && !available[a]) continue;
    if (winner === -1) {
      winner = a;
      continue;
    }
    if (better === 'max' ? scores[a] > scores[winner] + EPS : scores[a] < scores[winner] - EPS) winner = a;
  }
  return { scores, winner, better };
}

/** Slide 08 of the deck, reproduced exactly. Payoffs are illustrative (NPV, M$). */
export const TEXTBOOK = {
  actions: ['Expand gas', 'Go solar', 'Balanced mix'],
  states: ['Low gas price', 'Medium', 'High gas price'],
  probs: [0.3, 0.5, 0.2],
  payoffs: [
    [-20, 40, 90],
    [30, 35, 40],
    [10, 45, 60],
  ],
  hurwiczAlpha: 0.6,
} as const;
