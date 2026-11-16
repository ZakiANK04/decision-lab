import { useEffect, useMemo, useRef, useState } from 'react';
import {
  compareOptions,
  OUTCOME_KEYS,
  OUTCOME_LABELS,
  SERIES_KEYS,
  SERIES_LABELS,
  type CompareResult,
  type MonteCarloResult,
  type OutcomeKey,
  type ParetoResult,
  type SeriesKey,
} from '../sim';
import { useGame } from '../store/game';
import { runJob, type JobHandle } from '../store/simClient';
import { CompareLines, Histogram, ParetoScatter } from './charts';
import { fillStyle, fmt } from './hooks';
import { Icon } from './icons';

type Mode = 'mc' | 'compare' | 'pareto';

const UNITS: Record<OutcomeKey, string> = { profit: 'M DA', productivity: 'pts', environment: 'pts', customer: 'pts', worker: 'pts', co2: 'kt', score: '/ 100' };

function useJob<T>() {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<T | null>(null);
  const handle = useRef<JobHandle<T> | null>(null);
  useEffect(() => () => handle.current?.cancel(), []);
  const start = (job: Parameters<typeof runJob>[0]) => {
    handle.current?.cancel();
    setRunning(true);
    setProgress(0);
    const h = runJob<T>(job, (done, total) => setProgress(done / total));
    handle.current = h;
    h.promise
      .then((r) => {
        if (handle.current !== h) return;
        setResult(r);
        setRunning(false);
        try {
          navigator.vibrate?.(15);
        } catch {
          /* optional */
        }
      })
      .catch(() => handle.current === h && setRunning(false));
  };
  return { running, progress, result, start };
}

function Progress({ value }: { value: number }) {
  return (
    <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)} aria-label="Simulation progress">
      <i style={{ width: `${Math.round(value * 100)}%` }} />
    </div>
  );
}

function MonteCarlo() {
  const params = useGame((s) => s.params);
  const [n, setN] = useState(200);
  const [key, setKey] = useState<OutcomeKey>('profit');
  const job = useJob<MonteCarloResult>();
  const res = job.result;
  const values = useMemo(() => (res ? res.outcomes.map((o) => o[key]) : []), [res, key]);
  const s = res?.summary[key];
  const d = key === 'profit' || key === 'co2' ? 0 : 1;
  return (
    <div className="stack">
      <div className="card stack">
        <p className="small">
          One game is one roll of the dice. Run the same strategy in <b>{n}</b> different worlds and look at the whole distribution: a good decision is a good process, not a lucky outcome.
        </p>
        <label className="field">
          <span className="f-head">
            <span>Number of worlds N</span>
            <span>{n}</span>
          </span>
          <input type="range" min={100} max={1000} step={100} value={n} style={fillStyle(n, 100, 1000)} onChange={(e) => setN(Number(e.target.value))} aria-label="Number of simulated worlds" />
        </label>
        <button className="btn dark block" disabled={job.running} onClick={() => job.start({ kind: 'mc', params, n })}>
          <Icon name="dice" size={18} /> {job.running ? `Simulating… ${Math.round(job.progress * 100)}%` : `Run ${n} simulations`}
        </button>
        {job.running && <Progress value={job.progress} />}
      </div>
      {res && s && (
        <div className="card stack">
          <div className="chips" role="group" aria-label="Which result to show">
            {OUTCOME_KEYS.map((k) => (
              <button key={k} className="chip" aria-pressed={key === k} onClick={() => setKey(k)}>
                {OUTCOME_LABELS[k]}
              </button>
            ))}
          </div>
          <Histogram values={values} summary={s} unit={UNITS[key]} />
          <div className="stat3">
            <div>
              <span className="small muted">P5: bad luck</span>
              <b>{fmt(s.p5, d)}</b>
            </div>
            <div>
              <span className="small muted">Mean</span>
              <b>{fmt(s.mean, d)}</b>
            </div>
            <div>
              <span className="small muted">P95: good luck</span>
              <b>{fmt(s.p95, d)}</b>
            </div>
          </div>
          <p className="small muted">
            {OUTCOME_LABELS[key]} after 36 months ({UNITS[key]}), {res.n} seeded runs. The pale band holds 90% of the worlds.
          </p>
        </div>
      )}
    </div>
  );
}

function Compare() {
  const params = useGame((s) => s.params);
  const request = useGame((s) => s.compareRequest);
  const options = useMemo(() => compareOptions(params), [params]);
  const [a, setA] = useState('exploit');
  const [b, setB] = useState('explore');
  const [n, setN] = useState(60);
  const [key, setKey] = useState<SeriesKey>('cumProfit');
  const job = useJob<CompareResult>();
  const res = job.result;

  const run = (ia: string, ib: string) => {
    const oa = options.find((o) => o.id === ia) ?? options[0];
    const ob = options.find((o) => o.id === ib) ?? options[1];
    job.start({ kind: 'compare', params, n, a: { label: oa.label, strategy: oa.strategy }, b: { label: ob.label, strategy: ob.strategy } });
  };

  // A lesson in the Learn tab can ask for a ready-made comparison.
  const seen = useRef(0);
  useEffect(() => {
    if (request && request.nonce !== seen.current) {
      seen.current = request.nonce;
      setA(request.a);
      setB(request.b);
      run(request.a, request.b);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  const winner = res ? (res.winner === 'tie' ? null : res.winner === 'a' ? res.a : res.b) : null;
  return (
    <div className="stack">
      <div className="card stack">
        <p className="small">Two strategies, the same seeds: both face exactly the same gas prices, demand and shocks. Any gap comes from the decisions, not from luck.</p>
        <label className="field">
          <span className="f-head">
            <span>
              <i style={{ display: 'inline-block', width: 18, height: 4, borderRadius: 4, background: '#067a4f', marginRight: 6, verticalAlign: 'middle' }} />
              Strategy A
            </span>
          </span>
          <select className="select" value={a} onChange={(e) => setA(e.target.value)} aria-label="Strategy A">
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="f-head">
            <span>
              <i style={{ display: 'inline-block', width: 18, height: 0, borderTop: '4px dashed #c2570c', marginRight: 6, verticalAlign: 'middle' }} />
              Strategy B
            </span>
          </span>
          <select className="select" value={b} onChange={(e) => setB(e.target.value)} aria-label="Strategy B">
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="f-head">
            <span>Shared seeds</span>
            <span>{n}</span>
          </span>
          <input type="range" min={20} max={200} step={20} value={n} style={fillStyle(n, 20, 200)} onChange={(e) => setN(Number(e.target.value))} aria-label="Number of shared seeds" />
        </label>
        <button className="btn dark block" disabled={job.running} onClick={() => run(a, b)}>
          {job.running ? `Comparing… ${Math.round(job.progress * 100)}%` : 'Compare on the same seeds'}
        </button>
        {job.running && <Progress value={job.progress} />}
      </div>
      {res && (
        <>
          <div className={`card ${winner ? 'green' : 'mint'} stack`} style={{ gap: 6 }}>
            <span className="label" style={{ color: 'var(--dark)' }}>
              Winner on overall score
            </span>
            <h3 style={{ fontSize: 24 }}>{winner ? winner.label : 'A tie'}</h3>
            <p className="small num">
              {res.a.label}: {fmt(res.a.summary.score.mean, 1)} · {res.b.label}: {fmt(res.b.summary.score.mean, 1)}
              <br />
              Head to head over {res.n} worlds: A wins {res.a.wins}, B wins {res.b.wins}
              {res.ties ? `, ${res.ties} ties` : ''}.
            </p>
          </div>
          <div className="card stack">
            <div className="chips" role="group" aria-label="Which curve to show">
              {SERIES_KEYS.map((k) => (
                <button key={k} className="chip" aria-pressed={key === k} onClick={() => setKey(k)}>
                  {SERIES_LABELS[k]}
                </button>
              ))}
            </div>
            <CompareLines a={res.a.series[key]} b={res.b.series[key]} labelA={res.a.label} labelB={res.b.label} />
            <div className="legend">
              <span>
                <i style={{ background: '#067a4f' }} />
                {res.a.label}
              </span>
              <span>
                <i style={{ background: 'repeating-linear-gradient(90deg,#c2570c 0 5px,transparent 5px 8px)' }} />
                {res.b.label}
              </span>
            </div>
            <p className="small muted">Mean of {SERIES_LABELS[key].toLowerCase()} over the {res.n} shared worlds, month by month.</p>
          </div>
        </>
      )}
    </div>
  );
}

function Pareto() {
  const params = useGame((s) => s.params);
  const job = useJob<ParetoResult>();
  return (
    <div className="stack">
      <div className="card stack">
        <p className="small">
          Sustainability is multi-objective. This runs the six rules with five different value mixes, plus your own strategy, and plots what each one earns against what it leaves of the planet.
        </p>
        <button className="btn dark block" disabled={job.running} onClick={() => job.start({ kind: 'pareto', params, seeds: 12 })}>
          {job.running ? `Exploring strategies… ${Math.round(job.progress * 100)}%` : 'Draw the Pareto front'}
        </button>
        {job.running && <Progress value={job.progress} />}
      </div>
      {job.result && (
        <div className="card stack">
          <span className="label">Profit vs planet, {job.result.points.length} strategies</span>
          <ParetoScatter points={job.result.points} />
        </div>
      )}
    </div>
  );
}

export function SimulateTab() {
  const request = useGame((s) => s.compareRequest);
  const [mode, setMode] = useState<Mode>(request ? 'compare' : 'mc');
  useEffect(() => {
    if (request) setMode('compare');
  }, [request]);
  return (
    <div className="stack">
      <div className="seg" role="group" aria-label="Simulation mode">
        <button aria-pressed={mode === 'mc'} onClick={() => setMode('mc')}>
          Monte Carlo
        </button>
        <button aria-pressed={mode === 'compare'} onClick={() => setMode('compare')}>
          Compare
        </button>
        <button aria-pressed={mode === 'pareto'} onClick={() => setMode('pareto')}>
          Pareto
        </button>
      </div>
      {/* Each mode stays mounted so its results survive a switch. */}
      <div hidden={mode !== 'mc'}>
        <MonteCarlo />
      </div>
      <div hidden={mode !== 'compare'}>
        <Compare />
      </div>
      <div hidden={mode !== 'pareto'}>
        <Pareto />
      </div>
    </div>
  );
}
