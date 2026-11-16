import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { DEMAND_SHORT, GAS_SHORT, REG_SHORT, SHOCK_LABELS } from '../sim';
import { useGame } from '../store/game';
import { fmt, signed, useTween } from './hooks';
import { Icon, type IconName } from './icons';

type GaugeKey = 'profit' | 'productivity' | 'environment' | 'customer' | 'worker';

const GAUGES: { key: GaugeKey; label: string; short: string; icon: IconName }[] = [
  { key: 'profit', label: 'Profit', short: 'Profit', icon: 'profit' },
  { key: 'productivity', label: 'Productivity', short: 'Output', icon: 'productivity' },
  { key: 'environment', label: 'Environment', short: 'Planet', icon: 'environment' },
  { key: 'customer', label: 'Customers', short: 'Clients', icon: 'customer' },
  { key: 'worker', label: 'Workers', short: 'Team', icon: 'worker' },
];

function Gauge({ g, value, delta, seq }: { g: (typeof GAUGES)[number]; value: number; delta: number | null; seq: number }) {
  const shown = useTween(value);
  const isProfit = g.key === 'profit';
  const level = value < 35 ? 'low' : value < 55 ? 'mid' : '';
  return (
    <div className="gauge" role="group" aria-label={`${g.label}: ${fmt(value, isProfit ? 1 : 0)}${isProfit ? ' million dinars this month' : ' out of 100'}`}>
      <div className="g-label">
        <Icon name={g.icon} size={13} stroke={2.4} />
        <span className="lbl-long">{g.label}</span>
        <span className="lbl-short">{g.short}</span>
      </div>
      <div className={`g-value num${isProfit && shown < -0.05 ? ' neg' : ''}`}>{isProfit ? signed(shown, 1) : fmt(shown, 0)}</div>
      {isProfit ? (
        <div className="g-unit">M DA / mo</div>
      ) : (
        <div className="g-bar" aria-hidden="true">
          <i className={level} style={{ width: `${Math.max(3, Math.min(100, shown))}%` }} />
        </div>
      )}
      <AnimatePresence>
        {delta !== null && Math.abs(delta) >= (isProfit ? 0.05 : 0.5) && (
          <motion.span
            key={seq}
            className={`delta num${delta < 0 ? ' down' : ''}`}
            initial={{ opacity: 0, y: 8, scale: 0.6 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ type: 'spring', stiffness: 520, damping: 22 }}
          >
            {delta > 0 ? '↑' : '↓'} {fmt(Math.abs(delta), isProfit ? 1 : 0)}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Hud() {
  const c = useGame((s) => s.sim.company);
  const horizon = useGame((s) => s.params.horizon);
  const ev = useGame((s) => s.lastEvent);
  const seq = useGame((s) => s.eventSeq);
  const sound = useGame((s) => s.sound);
  const toggleSound = useGame((s) => s.toggleSound);
  const demo = useGame((s) => s.demo);
  const cash = useTween(c.cash);

  // Delta chips stay on screen for a moment after each month.
  const [showDelta, setShowDelta] = useState(false);
  useEffect(() => {
    if (!seq) return;
    setShowDelta(true);
    const t = setTimeout(() => setShowDelta(false), 2600);
    return () => clearTimeout(t);
  }, [seq]);

  const month = Math.min(c.month + 1, horizon);
  const finished = c.month >= horizon;
  return (
    <div className="hud">
      <div className="hud-top">
        <div className="month" role="status" aria-label={finished ? 'Game finished' : `Month ${month} of ${horizon}`}>
          <span>
            {finished ? 'Done' : 'Month'} <b className="num">{finished ? '' : month}</b>
            <span className="num" style={{ opacity: 0.7 }}>
              {finished ? '' : ` / ${horizon}`}
            </span>
          </span>
          <span className="bar" aria-hidden="true">
            <i style={{ width: `${(c.month / horizon) * 100}%` }} />
          </span>
        </div>
        {!demo && (
          <button className="icon-btn" onClick={toggleSound} aria-pressed={sound} aria-label={sound ? 'Turn sound off' : 'Turn sound on'}>
            <Icon name={sound ? 'sound_on' : 'sound_off'} />
          </button>
        )}
      </div>
      <div className="gauges">
        {GAUGES.map((g) => (
          <Gauge key={g.key} g={g} value={c[g.key]} seq={seq} delta={showDelta && ev ? ev.after[g.key] - ev.before[g.key] : null} />
        ))}
      </div>
      <div className="hud-sub">
        <span className={`pill num${c.cash < 0 ? ' red' : ''}`}>Cash {fmt(cash, 0)} M DA</span>
        <span className="pill num">CO₂ {fmt(c.co2, 0)} kt</span>
        {ev && (
          <>
            <span className="pill mint">Gas: {GAS_SHORT[ev.nature.gas]}</span>
            <span className="pill mint">Demand: {DEMAND_SHORT[ev.nature.demand]}</span>
            <span className="pill mint">{REG_SHORT[ev.nature.regulation]}</span>
            {ev.nature.shock !== 'none' && <span className="pill red">{SHOCK_LABELS[ev.nature.shock]}</span>}
          </>
        )}
      </div>
    </div>
  );
}
