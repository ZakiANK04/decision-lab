/** "Share this run": pack the parameters of a game into a short URL-safe string. */
import { CONFIG } from './config';
import { clamp, normalizeProbs } from './model';
import { defaultParams, PRESET_IDS } from './policy';
import { RULE_IDS } from './rules';
import type { Lens, Params, Triple } from './types';

const LENSES: Lens[] = ['gas', 'demand', 'regulation', 'scenarios'];
const r3 = (x: number): number => Math.round(x * 1000) / 1000;

function toBase64Url(text: string): string {
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromBase64Url(code: string): string {
  const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
  return atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
}

/** Compact positional array, then base64url. */
export function encodeParams(p: Params): string {
  const s = p.strategy;
  const w = p.workers;
  const data = [
    1, // format version
    p.seed >>> 0,
    PRESET_IDS.indexOf(s.preset),
    RULE_IDS.indexOf(s.rule),
    r3(s.alpha),
    [r3(s.weights.profit), r3(s.weights.planet), r3(s.weights.people)],
    LENSES.indexOf(s.lens),
    r3(s.hedge),
    p.probs.gas.map(r3),
    p.probs.demand.map(r3),
    p.probs.regulation.map(r3),
    [r3(p.shocks.supply), r3(p.shocks.scandal), r3(p.shocks.strike), r3(p.shocks.heatwave)],
    [w.count, r3(w.skillMu), r3(w.skillSigma), r3(w.motAlpha), r3(w.motBeta), r3(w.riskMin), r3(w.riskMax), r3(w.turnoverK), r3(w.turnoverB)],
  ];
  return toBase64Url(JSON.stringify(data));
}

const num = (x: unknown, fallback: number, lo: number, hi: number): number =>
  typeof x === 'number' && Number.isFinite(x) ? clamp(x, lo, hi) : fallback;

function triple(x: unknown, fallback: Triple): Triple {
  if (!Array.isArray(x) || x.length !== 3) return fallback;
  const n = normalizeProbs(x.map((v) => (typeof v === 'number' ? v : 0)));
  return [n[0], n[1], n[2]];
}

/** Returns null if the code is not a valid share code. Every value is validated and clamped. */
export function decodeParams(code: string): Params | null {
  try {
    const d: unknown = JSON.parse(fromBase64Url(code));
    if (!Array.isArray(d) || d[0] !== 1) return null;
    const def = defaultParams();
    const ws = Array.isArray(d[5]) ? d[5] : [];
    const sh = Array.isArray(d[11]) ? d[11] : [];
    const wk = Array.isArray(d[12]) ? d[12] : [];
    const dw = def.workers;
    return {
      seed: num(d[1], def.seed, 0, 0xffffffff) >>> 0,
      horizon: CONFIG.horizon,
      strategy: {
        preset: PRESET_IDS[num(d[2], 4, 0, PRESET_IDS.length - 1) | 0] ?? 'custom',
        rule: RULE_IDS[num(d[3], 5, 0, RULE_IDS.length - 1) | 0] ?? 'ev',
        alpha: num(d[4], 0.6, 0, 1),
        weights: { profit: num(ws[0], 0.4, 0, 1), planet: num(ws[1], 0.3, 0, 1), people: num(ws[2], 0.3, 0, 1) },
        lens: LENSES[num(d[6], 0, 0, LENSES.length - 1) | 0] ?? 'gas',
        hedge: num(d[7], 0, 0, 1),
      },
      probs: { gas: triple(d[8], def.probs.gas), demand: triple(d[9], def.probs.demand), regulation: triple(d[10], def.probs.regulation) },
      shocks: { supply: num(sh[0], 0.03, 0, 0.15), scandal: num(sh[1], 0.02, 0, 0.15), strike: num(sh[2], 0.02, 0, 0.15), heatwave: num(sh[3], 0.03, 0, 0.15) },
      workers: {
        count: Math.round(num(wk[0], dw.count, 8, CONFIG.staff.maxWorkers)),
        skillMu: num(wk[1], dw.skillMu, 20, 95),
        skillSigma: num(wk[2], dw.skillSigma, 0, 30),
        motAlpha: num(wk[3], dw.motAlpha, 0.5, 10),
        motBeta: num(wk[4], dw.motBeta, 0.5, 10),
        riskMin: num(wk[5], dw.riskMin, 0, 1),
        riskMax: num(wk[6], dw.riskMax, 0, 1),
        turnoverK: num(wk[7], dw.turnoverK, 0.02, 0.2),
        turnoverB: num(wk[8], dw.turnoverB, -3, 3),
      },
    };
  } catch {
    return null;
  }
}
