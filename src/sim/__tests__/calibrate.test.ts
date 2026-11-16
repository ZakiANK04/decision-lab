/* Not a real test: prints a calibration report. Run with `npm run calibrate`. */
import { describe, it } from 'vitest';
import { ACTION_IDS, ACTIONS } from '../catalog';
import { buildPayoffMatrix, initState } from '../model';
import { runMonteCarlo } from '../montecarlo';
import { allRulePicks, defaultParams, PRESET_IDS, PRESETS, simulate, withStrategy } from '../policy';
import { RULE_IDS } from '../rules';

const on = Boolean((globalThis as { process?: { env?: Record<string, string> } }).process?.env?.CALIBRATE);
const f = (x: number, w = 7) => x.toFixed(1).padStart(w);

describe.skipIf(!on)('calibration report', () => {
  it('prints', () => {
    const lines: string[] = [];
    for (const id of PRESET_IDS) {
      const p = withStrategy(defaultParams(2026), PRESETS[id].strategy);
      const m = buildPayoffMatrix(initState(p).company, p);
      lines.push(`\n=== ${id} | month 0 matrix (u) | cols: ${m.columns.map((c) => c.short).join(', ')}`);
      ACTION_IDS.forEach((a, i) =>
        lines.push(
          `${ACTIONS[a].name.padEnd(16)} ${m.u[i].map((v) => f(v)).join('')}   profit: ${m.vec[i].map((v) => f(v.profit)).join('')}   planet: ${m.vec[i].map((v) => f(v.planet, 6)).join('')}   people: ${m.vec[i].map((v) => f(v.people, 6)).join('')}`,
        ),
      );
      const picks = allRulePicks(m, 0.6);
      lines.push('picks: ' + RULE_IDS.map((r) => `${r}=${picks[r]}`).join('  '));
      const run = simulate(p, true);
      lines.push('actions: ' + run.events.map((e) => e.action.slice(0, 4)).join(' '));
      const c = run.final.company;
      lines.push(
        `final: cum ${f(c.cumProfit)} cash ${f(c.cash)} P ${f(c.productivity)} E ${f(c.environment)} C ${f(c.customer)} W ${f(c.worker)} co2 ${f(c.co2)} F ${c.fossil} G ${c.green} N ${c.headcount}`,
      );
      const t0 = Date.now();
      const mc = runMonteCarlo(p, 100);
      const s = mc.summary;
      lines.push(
        `MC100 (${Date.now() - t0} ms): profit ${f(s.profit.p5)} ${f(s.profit.mean)} ${f(s.profit.p95)} | env ${f(s.environment.mean)} | cust ${f(s.customer.mean)} | work ${f(s.worker.mean)} | score ${f(s.score.p5)} ${f(s.score.mean)} ${f(s.score.p95)}`,
      );
    }
    lines.push('\n=== rule sweep on greedy weights, seed 2026');
    const base = withStrategy(defaultParams(2026), PRESETS.greedy.strategy);
    for (const rule of RULE_IDS) {
      const c = simulate(withStrategy(base, { ...base.strategy, rule })).final.company;
      lines.push(`${rule.padEnd(8)} cum ${f(c.cumProfit)} E ${f(c.environment)} C ${f(c.customer)} W ${f(c.worker)} F ${c.fossil} G ${c.green} N ${c.headcount}`);
    }
    lines.push('\n=== rule sweep on custom weights, seed 2026');
    const base2 = defaultParams(2026);
    for (const rule of RULE_IDS) {
      const c = simulate(withStrategy(base2, { ...base2.strategy, rule })).final.company;
      lines.push(`${rule.padEnd(8)} cum ${f(c.cumProfit)} E ${f(c.environment)} C ${f(c.customer)} W ${f(c.worker)} F ${c.fossil} G ${c.green} N ${c.headcount}`);
    }
    console.log(lines.join('\n'));
  });
});
