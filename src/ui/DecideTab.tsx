import { useMemo } from 'react';
import { ACTIONS, applyRule, DEMAND_LABELS, GAS_LABELS, REG_LABELS, RULE_IDS, RULES, SHOCK_LABELS, type Lens } from '../sim';
import { useGame } from '../store/game';
import { fillStyle, fmt } from './hooks';
import { Icon } from './icons';
import { PayoffMatrix } from './PayoffMatrix';

const LENSES: { id: Lens; label: string }[] = [
  { id: 'gas', label: 'Gas price' },
  { id: 'demand', label: 'Demand' },
  { id: 'regulation', label: 'Rules' },
  { id: 'scenarios', label: 'Scenarios' },
];

export function DecideTab() {
  const params = useGame((s) => s.params);
  const matrix = useGame((s) => s.matrix);
  const selected = useGame((s) => s.selected);
  const ev = useGame((s) => s.lastEvent);
  const phase = useGame((s) => s.phase);
  const selectAction = useGame((s) => s.selectAction);
  const setStrategy = useGame((s) => s.setStrategy);
  const st = params.strategy;
  const rule = RULES[st.rule];
  const result = useMemo(() => applyRule(st.rule, matrix.u, matrix.probs, st.alpha, matrix.available), [st.rule, st.alpha, matrix]);

  return (
    <div className="stack">
      <div className="card" style={{ padding: 14 }}>
        {ev ? (
          <div className="stack" style={{ gap: 8 }}>
            <span className="label">Last month, the world chose</span>
            <div className="row wrap" style={{ gap: 6 }}>
              <span className="pill mint">{GAS_LABELS[ev.nature.gas]}</span>
              <span className="pill mint">{DEMAND_LABELS[ev.nature.demand]}</span>
              <span className="pill mint">{REG_LABELS[ev.nature.regulation]}</span>
              {ev.nature.shock !== 'none' && <span className="pill red">{SHOCK_LABELS[ev.nature.shock]}</span>}
            </div>
            <p className="small muted">
              You played <b style={{ color: 'var(--ink)' }}>{ACTIONS[ev.action].name}</b> and made{' '}
              <b className={ev.after.profit < 0 ? 'neg-text' : 'pos-text'}>{fmt(ev.after.profit, 1)} M DA</b>.
            </p>
          </div>
        ) : (
          <div className="stack" style={{ gap: 4 }}>
            <span className="label">How it works</span>
            <p className="small">
              Pick a move, then press <b>Play</b>. The world answers with a gas price, a demand level and a regulation. You cannot control those.
            </p>
          </div>
        )}
      </div>

      <div className="card stack" style={{ padding: 14, gap: 10 }}>
        <div className="row between">
          <span className="label">Decision rule</span>
          <span className="pill mint">{rule.persona}</span>
        </div>
        <div className="chips" role="group" aria-label="Decision rule">
          {RULE_IDS.map((id) => (
            <button key={id} className="chip" aria-pressed={st.rule === id} onClick={() => setStrategy({ rule: id })}>
              {RULES[id].short}
            </button>
          ))}
        </div>
        <p className="small">{rule.how}</p>
        <div className="formula" aria-label={`Formula: ${rule.formula}`}>
          {rule.formula}
        </div>
        {st.rule === 'hurwicz' && (
          <label className="field">
            <span className="f-head">
              <span>Optimism α</span>
              <span>{st.alpha.toFixed(2)}</span>
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={st.alpha}
              style={fillStyle(st.alpha, 0, 1)}
              onChange={(e) => setStrategy({ alpha: Number(e.target.value) })}
              aria-label="Hurwicz optimism alpha"
            />
          </label>
        )}
      </div>

      <div className="stack" style={{ gap: 8 }}>
        <div className="row between">
          <span className="label" style={{ paddingLeft: 6 }}>
            Payoff matrix
          </span>
          <span className="small muted">columns = states of nature</span>
        </div>
        <div className="seg" role="group" aria-label="Which uncertainty to look at">
          {LENSES.map((l) => (
            <button key={l.id} aria-pressed={st.lens === l.id} onClick={() => setStrategy({ lens: l.id, preset: st.preset })}>
              {l.label}
            </button>
          ))}
        </div>
        <PayoffMatrix matrix={matrix} result={result} rule={st.rule} selected={selected} onSelect={selectAction} />
        <p className="small muted" style={{ padding: '0 6px' }}>
          Each cell is r(a, s): what the move adds compared with holding steady, over the next {matrix.months} month{matrix.months > 1 ? 's' : ''}, scored with your Profit / Planet / People weights.
          {st.lens !== 'scenarios' ? ' The other uncertainties are held at their expected value.' : ' Each column is one named future.'}
          {phase === 'end' ? ' The game is over: start a new one in Parameters.' : ''}
        </p>
      </div>
    </div>
  );
}

/** Sticky controls under the Decide tab: Undo, Auto and the big Play button. */
export function DecideFooter() {
  const phase = useGame((s) => s.phase);
  const month = useGame((s) => s.sim.company.month);
  const selected = useGame((s) => s.selected);
  const pick = useGame((s) => s.picks[s.params.strategy.rule]);
  const auto = useGame((s) => s.auto);
  const canUndo = useGame((s) => s.past.length > 0);
  const playMonth = useGame((s) => s.playMonth);
  const undo = useGame((s) => s.undo);
  const setAuto = useGame((s) => s.setAuto);
  const setEndOpen = useGame((s) => s.setEndOpen);
  const action = selected ?? pick;

  if (phase === 'end') {
    return (
      <div className="sheet-footer">
        <button className="icon-btn" onClick={undo} disabled={!canUndo} aria-label="Undo last month">
          <Icon name="undo" />
        </button>
        <button className="btn block" onClick={() => setEndOpen(true)}>
          See your results <Icon name="arrow" size={18} />
        </button>
      </div>
    );
  }
  return (
    <div className="sheet-footer">
      <button className="icon-btn" onClick={undo} disabled={!canUndo} aria-label="Undo last month">
        <Icon name="undo" />
      </button>
      <button className="icon-btn" onClick={() => setAuto(!auto)} aria-pressed={auto} aria-label={auto ? 'Stop auto-play' : 'Auto-play: let the rule decide every month'}>
        <Icon name={auto ? 'pause' : 'play'} />
      </button>
      <button className="btn block" onClick={() => playMonth()} disabled={phase !== 'play'} style={{ minWidth: 0 }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          Play month {month + 1}: {ACTIONS[action].name}
        </span>
        <Icon name="arrow" size={18} />
      </button>
    </div>
  );
}
