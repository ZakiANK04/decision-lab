import type { ActionId, ShockId } from './types';

/** Display data for actions and states of nature (no logic here). */

export type ActionCategory = 'energy' | 'people' | 'market' | 'planet' | 'wait';

export interface ActionInfo {
  id: ActionId;
  name: string;
  category: ActionCategory;
  blurb: string;
  /** Which pillar the action mostly serves (used for the "decision style" tilt). */
  tilt: 'profit' | 'planet' | 'people' | 'none';
}

export const ACTION_IDS: ActionId[] = [
  'expand_fossil',
  'invest_green',
  'balanced_mix',
  'raise_wages',
  'training',
  'automation',
  'cut_costs',
  'lower_prices',
  'improve_quality',
  'marketing',
  'reduce_waste',
  'hold',
];

export const ACTIONS: Record<ActionId, ActionInfo> = {
  expand_fossil: { id: 'expand_fossil', name: 'Expand gas', category: 'energy', tilt: 'profit', blurb: '+1 gas unit. Great if prices are high, more CO₂.' },
  invest_green: { id: 'invest_green', name: 'Go solar', category: 'energy', tilt: 'planet', blurb: '+1 green unit. Steady income, almost no CO₂.' },
  balanced_mix: { id: 'balanced_mix', name: 'Balanced mix', category: 'energy', tilt: 'none', blurb: '+½ gas and +½ green unit.' },
  raise_wages: { id: 'raise_wages', name: 'Raise wages', category: 'people', tilt: 'people', blurb: 'Happier workers, higher wage bill every month.' },
  training: { id: 'training', name: 'Training', category: 'people', tilt: 'people', blurb: 'Skills go up, so productivity follows.' },
  automation: { id: 'automation', name: 'Automation', category: 'people', tilt: 'profit', blurb: 'More output with fewer people. Workers worry.' },
  cut_costs: { id: 'cut_costs', name: 'Cut costs', category: 'people', tilt: 'profit', blurb: 'Lay off 2 workers and trim fixed costs.' },
  lower_prices: { id: 'lower_prices', name: 'Lower prices', category: 'market', tilt: 'people', blurb: 'Customers like it. Margin per unit drops.' },
  improve_quality: { id: 'improve_quality', name: 'Improve quality', category: 'market', tilt: 'people', blurb: 'Customer satisfaction rises month after month.' },
  marketing: { id: 'marketing', name: 'Marketing', category: 'market', tilt: 'profit', blurb: 'A burst of demand that fades.' },
  reduce_waste: { id: 'reduce_waste', name: 'Reduce waste', category: 'planet', tilt: 'planet', blurb: 'Recycling: less CO₂ and lower running costs.' },
  hold: { id: 'hold', name: 'Hold steady', category: 'wait', tilt: 'none', blurb: 'Spend nothing this month.' },
};

export const CATEGORY_LABEL: Record<ActionCategory, string> = {
  energy: 'Energy',
  people: 'People',
  market: 'Market',
  planet: 'Planet',
  wait: 'Wait',
};

export const GAS_LABELS = ['Low gas price', 'Medium', 'High gas price'] as const;
export const GAS_SHORT = ['Low', 'Medium', 'High'] as const;
export const DEMAND_LABELS = ['Weak demand', 'Normal demand', 'Boom'] as const;
export const DEMAND_SHORT = ['Weak', 'Normal', 'Boom'] as const;
export const REG_LABELS = ['Lax rules', 'Carbon tax', 'Strict rules'] as const;
export const REG_SHORT = ['Lax', 'Carbon tax', 'Strict'] as const;

export const SHOCK_IDS: ShockId[] = ['none', 'supply', 'scandal', 'strike', 'heatwave'];
export const SHOCK_LABELS: Record<ShockId, string> = {
  none: 'No shock',
  supply: 'Supply crisis',
  scandal: 'Viral scandal',
  strike: 'Strike',
  heatwave: 'Heatwave',
};
export const SHOCK_BLURB: Record<ShockId, string> = {
  none: '',
  supply: 'Deliveries are stuck: revenue −20% this month.',
  scandal: 'A post goes viral. Customers punish dirty companies harder.',
  strike: 'Work stops: revenue −35% and morale drops.',
  heatwave: 'Heat hits people and nature.',
};
