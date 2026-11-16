import { describe, expect, it } from 'vitest';
import { applyRule, regretMatrix, TEXTBOOK } from '../rules';

const { payoffs, probs, actions, hurwiczAlpha } = TEXTBOOK;
const run = (rule: Parameters<typeof applyRule>[0]) => applyRule(rule, payoffs, probs, hurwiczAlpha);

describe('decision rules on the textbook example (slide 08)', () => {
  it('Maximax picks Expand gas with a best case of 90', () => {
    const r = run('maximax');
    expect(actions[r.winner]).toBe('Expand gas');
    expect(r.scores).toEqual([90, 40, 60]);
  });

  it('Maximin picks Go solar with a worst case of 30', () => {
    const r = run('maximin');
    expect(actions[r.winner]).toBe('Go solar');
    expect(r.scores).toEqual([-20, 30, 10]);
  });

  it('Hurwicz (alpha = 0.6) picks Expand gas with 46', () => {
    const r = run('hurwicz');
    expect(actions[r.winner]).toBe('Expand gas');
    expect(r.scores[0]).toBeCloseTo(46, 10);
    expect(r.scores[1]).toBeCloseTo(36, 10);
    expect(r.scores[2]).toBeCloseTo(40, 10);
  });

  it('Laplace picks Balanced mix with 38.3', () => {
    const r = run('laplace');
    expect(actions[r.winner]).toBe('Balanced mix');
    expect(r.scores[2]).toBeCloseTo(38.33, 2);
    expect(r.scores[0]).toBeCloseTo(36.67, 2);
    expect(r.scores[1]).toBeCloseTo(35, 10);
  });

  it('Minimax regret picks Balanced mix with a maximum regret of 30', () => {
    const r = run('regret');
    expect(actions[r.winner]).toBe('Balanced mix');
    expect(r.better).toBe('min');
    expect(r.scores).toEqual([50, 50, 30]);
    expect(regretMatrix(payoffs)).toEqual([
      [50, 5, 0],
      [0, 10, 50],
      [20, 0, 30],
    ]);
  });

  it('Expected value picks Balanced mix with 37.5 (slide 09)', () => {
    const r = run('ev');
    expect(actions[r.winner]).toBe('Balanced mix');
    expect(r.scores[0]).toBeCloseTo(32.0, 10);
    expect(r.scores[1]).toBeCloseTo(34.5, 10);
    expect(r.scores[2]).toBeCloseTo(37.5, 10);
  });

  it('Hurwicz equals Maximax at alpha = 1 and Maximin at alpha = 0', () => {
    expect(applyRule('hurwicz', payoffs, probs, 1).scores).toEqual(applyRule('maximax', payoffs, probs).scores);
    expect(applyRule('hurwicz', payoffs, probs, 0).scores).toEqual(applyRule('maximin', payoffs, probs).scores);
  });

  it('skips unavailable actions and breaks ties with the first action', () => {
    expect(applyRule('maximax', payoffs, probs, 0.6, [false, true, true]).winner).toBe(2);
    expect(applyRule('ev', [[1, 1], [1, 1]], [0.5, 0.5]).winner).toBe(0);
    expect(applyRule('ev', payoffs, probs, 0.6, [false, false, false]).winner).toBe(-1);
  });
});
