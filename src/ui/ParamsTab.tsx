import { useState } from 'react';
import { CONFIG, DEMAND_SHORT, GAS_SHORT, normalizeWeights, PRESET_IDS, PRESETS, REG_SHORT, shockProbs, type Params, type WorkerParams } from '../sim';
import { toPercents, useGame } from '../store/game';
import { fillStyle } from './hooks';
import { Icon } from './icons';

function Slider({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="field">
      <span className="f-head">
        <span>{label}</span>
        <span>{display}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} style={fillStyle(value, min, max)} onChange={(e) => onChange(Number(e.target.value))} aria-label={label} aria-valuetext={display} />
    </label>
  );
}

const PROB_COLORS = ['#9b1c1c', '#f0b23e', '#067a4f'];

function ProbGroup({ title, dim, labels }: { title: string; dim: 'gas' | 'demand' | 'regulation'; labels: readonly string[] }) {
  const probs = useGame((s) => s.params.probs[dim]);
  const setProbability = useGame((s) => s.setProbability);
  const pct = toPercents(probs);
  return (
    <div className="stack" style={{ gap: 2 }}>
      <div className="row between">
        <b>{title}</b>
        <span className="small muted num">sum = {pct[0] + pct[1] + pct[2]}%</span>
      </div>
      <div className="stackbar" aria-hidden="true">
        {pct.map((p, i) => (
          <i key={i} style={{ width: `${p}%`, background: PROB_COLORS[i] }} />
        ))}
      </div>
      {labels.map((l, i) => (
        <Slider key={l} label={l} value={Math.round(probs[i] * 100)} min={0} max={100} step={1} display={`${pct[i]}%`} onChange={(v) => setProbability(dim, i, v / 100)} />
      ))}
    </div>
  );
}

export function ParamsTab() {
  const params = useGame((s) => s.params);
  const loadPreset = useGame((s) => s.loadPreset);
  const setWeight = useGame((s) => s.setWeight);
  const setStrategy = useGame((s) => s.setStrategy);
  const setShock = useGame((s) => s.setShock);
  const setTurnover = useGame((s) => s.setTurnover);
  const restart = useGame((s) => s.restart);
  const toast = useGame((s) => s.toast);
  const shareUrl = useGame((s) => s.shareUrl);
  const setTab = useGame((s) => s.setTab);

  const st = params.strategy;
  const w = normalizeWeights(st.weights);
  const sp = shockProbs(params.shocks);
  const preset = PRESETS[st.preset];

  // Workforce and seed only apply to a new game, so they are edited as a draft.
  const [draft, setDraft] = useState<WorkerParams>(params.workers);
  const [seed, setSeed] = useState(String(params.seed));
  const patch = (p: Partial<WorkerParams>) => setDraft((d) => ({ ...d, ...p }));
  const meanMot = draft.motAlpha / (draft.motAlpha + draft.motBeta);

  const newGame = () => {
    const parsed = Number.parseInt(seed, 10);
    const next: Params = { ...params, seed: Number.isFinite(parsed) ? Math.abs(parsed) >>> 0 : params.seed, workers: { ...draft, turnoverK: params.workers.turnoverK, turnoverB: params.workers.turnoverB } };
    restart({ params: next });
    toast({ title: 'New game started', body: `Seed ${next.seed}, ${next.workers.count} workers.`, tone: 'info', undo: true });
    setTab('decide');
  };

  const share = async () => {
    const url = shareUrl();
    try {
      if (navigator.share) await navigator.share({ title: 'Decision Lab', text: 'Play my Decision Lab world', url });
      else {
        await navigator.clipboard.writeText(url);
        toast({ title: 'Link copied', body: 'Anyone who opens it gets the same world and settings.', tone: 'good' });
      }
    } catch {
      /* the share sheet was closed */
    }
  };

  return (
    <div className="stack">
      <div className="card stack">
        <span className="label">Strategy presets</span>
        <div className="chips wrap" role="group" aria-label="Strategy presets">
          {PRESET_IDS.map((id) => (
            <button key={id} className="chip" aria-pressed={st.preset === id} onClick={() => loadPreset(id)}>
              {PRESETS[id].name}
            </button>
          ))}
        </div>
        <p className="small">
          <span className="pill mint" style={{ marginRight: 6 }}>
            {preset.tag}
          </span>
          {preset.blurb}
        </p>
      </div>

      <div className="card dark stack">
        <span className="label">What matters to you</span>
        <p className="small muted">These weights turn profit, planet and people into the single score the rule compares.</p>
        <Slider label="Profit" value={Math.round(st.weights.profit * 100)} min={0} max={100} step={1} display={`${Math.round(w.profit * 100)}%`} onChange={(v) => setWeight('profit', v / 100)} />
        <Slider label="Planet" value={Math.round(st.weights.planet * 100)} min={0} max={100} step={1} display={`${Math.round(w.planet * 100)}%`} onChange={(v) => setWeight('planet', v / 100)} />
        <Slider label="People" value={Math.round(st.weights.people * 100)} min={0} max={100} step={1} display={`${Math.round(w.people * 100)}%`} onChange={(v) => setWeight('people', v / 100)} />
      </div>

      <div className="card stack">
        <span className="label">States of nature: your beliefs</span>
        <p className="small muted">Move one slider and the others rebalance, so each group always sums to 100%.</p>
        <ProbGroup title="Gas price" dim="gas" labels={GAS_SHORT} />
        <ProbGroup title="Demand" dim="demand" labels={DEMAND_SHORT} />
        <ProbGroup title="Regulation" dim="regulation" labels={REG_SHORT} />
      </div>

      <div className="card stack">
        <div className="row between">
          <span className="label">Rare shocks, per month</span>
          <span className="small muted num">no shock: {Math.round(sp[0] * 100)}%</span>
        </div>
        {(
          [
            ['supply', 'Supply crisis'],
            ['scandal', 'Viral scandal'],
            ['strike', 'Strike'],
            ['heatwave', 'Heatwave'],
          ] as const
        ).map(([k, label]) => (
          <Slider key={k} label={label} value={Math.round(params.shocks[k] * 1000) / 10} min={0} max={15} step={0.5} display={`${(params.shocks[k] * 100).toFixed(1)}%`} onChange={(v) => setShock(k, v / 100)} />
        ))}
        <p className="small muted">Shocks are not in the payoff matrix: they are the surprises no table predicts.</p>
      </div>

      <div className="card stack">
        <span className="label">Long-term contracts</span>
        <Slider label="Share of gas sold at a fixed price" value={Math.round(st.hedge * 100)} min={0} max={100} step={5} display={`${Math.round(st.hedge * 100)}%`} onChange={(v) => setStrategy({ hedge: v / 100, preset: st.preset })} />
        <p className="small muted">Contracts trade a {Math.round(CONFIG.econ.hedgeDiscount * 100)}% discount for a stable price: less uncertainty, less upside.</p>
      </div>

      <div className="card stack">
        <span className="label">Staff turnover</span>
        <div className="formula">P(leave) = 1 / (1 + e^(k·s − b))</div>
        <Slider label="k: sensitivity to satisfaction s" value={params.workers.turnoverK} min={0.02} max={0.2} step={0.01} display={params.workers.turnoverK.toFixed(2)} onChange={(v) => setTurnover({ turnoverK: v })} />
        <Slider label="b: baseline restlessness" value={params.workers.turnoverB} min={-2} max={3} step={0.1} display={params.workers.turnoverB.toFixed(1)} onChange={(v) => setTurnover({ turnoverB: v })} />
      </div>

      <div className="card mint stack">
        <span className="label">New game</span>
        <p className="small">The workforce is drawn at the start of a game, so these apply when you press New game.</p>
        <Slider label="Workers" value={draft.count} min={8} max={20} step={1} display={String(draft.count)} onChange={(v) => patch({ count: v })} />
        <Slider label="Skill ~ Normal: mean μ" value={draft.skillMu} min={30} max={90} step={1} display={String(draft.skillMu)} onChange={(v) => patch({ skillMu: v })} />
        <Slider label="Skill ~ Normal: spread σ" value={draft.skillSigma} min={0} max={25} step={1} display={String(draft.skillSigma)} onChange={(v) => patch({ skillSigma: v })} />
        <Slider label="Motivation ~ Beta: α" value={draft.motAlpha} min={0.5} max={8} step={0.5} display={draft.motAlpha.toFixed(1)} onChange={(v) => patch({ motAlpha: v })} />
        <Slider label="Motivation ~ Beta: β" value={draft.motBeta} min={0.5} max={8} step={0.5} display={`${draft.motBeta.toFixed(1)} (mean ${(meanMot * 100).toFixed(0)}%)`} onChange={(v) => patch({ motBeta: v })} />
        <Slider label="Risk tolerance ~ Uniform: min" value={draft.riskMin} min={0} max={1} step={0.05} display={draft.riskMin.toFixed(2)} onChange={(v) => patch({ riskMin: Math.min(v, draft.riskMax) })} />
        <Slider label="Risk tolerance ~ Uniform: max" value={draft.riskMax} min={0} max={1} step={0.05} display={draft.riskMax.toFixed(2)} onChange={(v) => patch({ riskMax: Math.max(v, draft.riskMin) })} />
        <label className="field">
          <span className="f-head">
            <span>Seed (same seed = same world)</span>
          </span>
          <div className="row">
            <input className="text-input num" inputMode="numeric" value={seed} onChange={(e) => setSeed(e.target.value.replace(/[^0-9]/g, '').slice(0, 9))} aria-label="Random seed" />
            <button className="icon-btn" onClick={() => setSeed(String(Math.floor(Math.random() * 9000) + 1000))} aria-label="Random seed">
              <Icon name="dice" />
            </button>
          </div>
        </label>
        <div className="row">
          <button className="btn dark block" onClick={newGame}>
            <Icon name="restart" size={18} /> New game
          </button>
          <button className="btn ghost" onClick={share} aria-label="Share this run">
            <Icon name="share" size={18} /> Share
          </button>
        </div>
      </div>
    </div>
  );
}
