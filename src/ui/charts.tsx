import { useMemo, useState } from 'react';
import { histogram, type ParetoPoint, type Summary } from '../sim';
import { fmt } from './hooks';

const DEEP = '#067a4f';
const ORANGE = '#c2570c';
const INK = '#0f1f17';
const GRID = '#dfe5dc';

/** Distribution of one final KPI over all Monte Carlo runs, with mean and the 5th-95th percentile band. */
export function Histogram({ values, summary, unit }: { values: number[]; summary: Summary; unit: string }) {
  const W = 340;
  const H = 190;
  const L = 10;
  const R = 10;
  const T = 26;
  const B = 34;
  const bins = useMemo(() => histogram(values, 18), [values]);
  if (!bins.length) return null;
  const lo = bins[0].x0;
  const hi = bins[bins.length - 1].x1;
  const maxCount = Math.max(...bins.map((b) => b.count));
  const x = (v: number) => L + ((v - lo) / (hi - lo)) * (W - L - R);
  const y = (c: number) => H - B - (c / maxCount) * (H - T - B);
  const digits = hi - lo < 20 ? 1 : 0;
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Histogram. Mean ${fmt(summary.mean, digits)} ${unit}, 5th percentile ${fmt(summary.p5, digits)}, 95th percentile ${fmt(summary.p95, digits)}.`}>
      <rect x={x(summary.p5)} y={T - 6} width={Math.max(1, x(summary.p95) - x(summary.p5))} height={H - T - B + 6} fill="#ddf6e5" rx={8} />
      {bins.map((b, i) => (
        <rect key={i} x={x(b.x0) + 1} y={y(b.count)} width={Math.max(1, x(b.x1) - x(b.x0) - 2)} height={H - B - y(b.count)} rx={3} fill={b.x1 < summary.p5 || b.x0 > summary.p95 ? '#9fc9b3' : DEEP} />
      ))}
      <line x1={L} x2={W - R} y1={H - B} y2={H - B} stroke={INK} strokeWidth={1.5} />
      <line x1={x(summary.mean)} x2={x(summary.mean)} y1={T - 8} y2={H - B} stroke={INK} strokeWidth={2} strokeDasharray="4 3" />
      <text x={Math.min(W - 44, Math.max(44, x(summary.mean)))} y={12} textAnchor="middle" style={{ fill: INK, fontWeight: 800 }}>
        mean {fmt(summary.mean, digits)}
      </text>
      <text x={Math.max(L, x(summary.p5))} y={H - B + 14} textAnchor="middle">
        P5
      </text>
      <text x={Math.max(L, x(summary.p5))} y={H - B + 27} textAnchor="middle" style={{ fill: INK }}>
        {fmt(summary.p5, digits)}
      </text>
      <text x={Math.min(W - R, x(summary.p95))} y={H - B + 14} textAnchor="middle">
        P95
      </text>
      <text x={Math.min(W - R, x(summary.p95))} y={H - B + 27} textAnchor="middle" style={{ fill: INK }}>
        {fmt(summary.p95, digits)}
      </text>
    </svg>
  );
}

/** Two KPI curves over the months (Compare mode). B is dashed so colour is not the only cue. */
export function CompareLines({ a, b, labelA, labelB }: { a: number[]; b: number[]; labelA: string; labelB: string }) {
  const W = 340;
  const H = 200;
  const L = 34;
  const R = 12;
  const T = 12;
  const B = 24;
  const all = [...a, ...b];
  let lo = Math.min(...all);
  let hi = Math.max(...all);
  if (hi - lo < 1) {
    lo -= 1;
    hi += 1;
  }
  const pad = (hi - lo) * 0.08;
  lo -= pad;
  hi += pad;
  const n = a.length - 1;
  const x = (t: number) => L + (t / n) * (W - L - R);
  const y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const path = (s: number[]) => s.map((v, t) => `${t ? 'L' : 'M'}${x(t).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const ticks = [lo + pad, (lo + hi) / 2, hi - pad];
  const months = [0, 12, 24, 36].filter((m) => m <= n);
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Line chart. ${labelA} ends at ${fmt(a[n], 1)}, ${labelB} ends at ${fmt(b[n], 1)}.`}>
      {ticks.map((v, i) => (
        <g key={i}>
          <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={GRID} strokeWidth={1} />
          <text x={L - 6} y={y(v) + 4} textAnchor="end">
            {fmt(v, 0)}
          </text>
        </g>
      ))}
      {months.map((m) => (
        <text key={m} x={x(m)} y={H - 6} textAnchor="middle">
          {m === 0 ? 'start' : `m${m}`}
        </text>
      ))}
      <path d={path(b)} fill="none" stroke={ORANGE} strokeWidth={3} strokeDasharray="7 5" strokeLinecap="round" strokeLinejoin="round" />
      <path d={path(a)} fill="none" stroke={DEEP} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(n)} cy={y(a[n])} r={5} fill={DEEP} stroke="#fff" strokeWidth={2} />
      <circle cx={x(n)} cy={y(b[n])} r={5} fill={ORANGE} stroke="#fff" strokeWidth={2} />
    </svg>
  );
}

/** Profit vs Planet for many strategies. Non-dominated points form the Pareto front. Dot size = People. */
export function ParetoScatter({ points }: { points: ParetoPoint[] }) {
  const [active, setActive] = useState<number | null>(null);
  const W = 340;
  const H = 250;
  const L = 36;
  const R = 14;
  const T = 14;
  const B = 34;
  const xs = points.map((p) => p.profit);
  const ys = points.map((p) => p.planet);
  const ps = points.map((p) => p.people);
  const span = (arr: number[]) => {
    const lo = Math.min(...arr);
    const hi = Math.max(...arr);
    const pad = Math.max(1, (hi - lo) * 0.1);
    return [lo - pad, hi + pad] as const;
  };
  const [x0, x1] = span(xs);
  const [y0, y1] = span(ys);
  const pLo = Math.min(...ps);
  const pHi = Math.max(...ps);
  const x = (v: number) => L + ((v - x0) / (x1 - x0)) * (W - L - R);
  const y = (v: number) => T + (1 - (v - y0) / (y1 - y0)) * (H - T - B);
  const r = (v: number) => 4 + (pHi > pLo ? ((v - pLo) / (pHi - pLo)) * 5 : 2);
  // The front drawn in the Profit / Planet plane: best Planet for each level of Profit.
  const front2d = points
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => !points.some((q) => q !== p && q.profit >= p.profit && q.planet >= p.planet && (q.profit > p.profit || q.planet > p.planet)))
    .sort((u, v) => u.p.profit - v.p.profit);
  const shown = active !== null ? points[active] : (points.find((p) => p.isYou) ?? null);
  return (
    <div className="stack" style={{ gap: 8 }}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Scatter plot of ${points.length} strategies: total profit against environment. ${front2d.length} are on the Pareto front.`}>
        <line x1={L} x2={W - R} y1={H - B} y2={H - B} stroke={INK} strokeWidth={1.5} />
        <line x1={L} x2={L} y1={T} y2={H - B} stroke={INK} strokeWidth={1.5} />
        <text x={W - R} y={H - 8} textAnchor="end">
          Total profit (M DA) →
        </text>
        <text x={L + 6} y={T + 8}>
          ↑ Environment
        </text>
        <text x={L} y={H - B + 14} textAnchor="middle">
          {fmt(x0, 0)}
        </text>
        <text x={L - 6} y={H - B} textAnchor="end">
          {fmt(y0, 0)}
        </text>
        <text x={L - 6} y={T + 4} textAnchor="end">
          {fmt(y1, 0)}
        </text>
        <path d={front2d.map(({ p }, k) => `${k ? 'L' : 'M'}${x(p.profit).toFixed(1)},${y(p.planet).toFixed(1)}`).join(' ')} fill="none" stroke={DEEP} strokeWidth={2.5} strokeDasharray="2 5" strokeLinecap="round" />
        {points.map((p, i) => {
          const onFront = front2d.some((f) => f.i === i);
          return (
            <g key={i}>
              <circle
                cx={x(p.profit)}
                cy={y(p.planet)}
                r={r(p.people)}
                fill={onFront ? DEEP : '#b9d8c7'}
                stroke={active === i ? INK : '#fff'}
                strokeWidth={active === i ? 2.5 : 1.5}
              />
              {p.isYou && <circle cx={x(p.profit)} cy={y(p.planet)} r={r(p.people) + 5} fill="none" stroke={INK} strokeWidth={2.5} />}
              {/* generous invisible hit area for fingers */}
              <circle
                cx={x(p.profit)}
                cy={y(p.planet)}
                r={16}
                fill="transparent"
                tabIndex={0}
                role="button"
                aria-label={`${p.label}: profit ${fmt(p.profit, 0)}, environment ${fmt(p.planet, 0)}, people ${fmt(p.people, 0)}`}
                onClick={() => setActive(i)}
                onFocus={() => setActive(i)}
                style={{ cursor: 'pointer', outline: 'none' }}
              />
            </g>
          );
        })}
      </svg>
      <div className="legend">
        <span>
          <i style={{ background: DEEP }} />
          On the Pareto front
        </span>
        <span>
          <i style={{ background: '#b9d8c7' }} />
          Dominated
        </span>
        <span>
          <i style={{ background: 'transparent', border: `2px solid ${INK}`, height: 10, width: 10, borderRadius: '50%' }} />
          You
        </span>
      </div>
      {shown && (
        <div className="card" style={{ background: 'var(--bg)', padding: 12, borderRadius: 18 }}>
          <b>{shown.label}</b>
          <div className="small muted num">
            Profit {fmt(shown.profit, 0)} M DA · Environment {fmt(shown.planet, 0)} · People {fmt(shown.people, 0)}
          </div>
        </div>
      )}
      <p className="small muted">Bigger dot = happier people. Tap a dot to read it. No dot wins on every axis: that is the trade-off.</p>
    </div>
  );
}
