import { AnimatePresence, motion } from 'framer-motion';
import { moodOf, requiredStaff, RULES, turnoverProbability, workerSatisfaction, type Company, type Params, type Worker } from '../sim';
import { useGame, type Selection } from '../store/game';
import { fmt } from './hooks';
import { Icon } from './icons';

const MOOD_LABEL = { happy: 'Happy', neutral: 'So-so', stressed: 'Stressed' } as const;

function content(sel: Selection, c: Company, workers: Worker[], params: Params, decisions: number): { title: string; lead?: React.ReactNode; rows: [string, string][] } | null {
  switch (sel.kind) {
    case 'worker': {
      const w = workers.find((x) => x.id === sel.id);
      if (!w) return null;
      const sat = workerSatisfaction(w, c);
      const mood = moodOf(sat);
      const p = turnoverProbability(sat, params.workers.turnoverK, params.workers.turnoverB);
      return {
        title: `Worker ${w.id + 1}`,
        lead: (
          <span>
            <i className={`mood-shape ${mood}`} aria-hidden="true" />
            {MOOD_LABEL[mood]}
          </span>
        ),
        rows: [
          ['Satisfaction', fmt(sat, 0)],
          ['Skill', fmt(w.skill, 0)],
          ['Motivation', `${fmt(w.motivation * 100, 0)}%`],
          ['Risk tolerance', `${fmt(w.risk * 100, 0)}%`],
          ['May leave this month', `${fmt(p * 100, 1)}%`],
        ],
      };
    }
    case 'factory':
    case 'tanks':
      return {
        title: 'Gas plant',
        lead: 'Smoke follows your emissions.',
        rows: [
          ['Gas units', fmt(c.fossil, 1)],
          ['CO₂ per month', `${fmt(c.co2, 0)} kt`],
          ['Waste cut', `${fmt(c.waste * 100, 0)}%`],
          ['Automation level', fmt(c.automation, 0)],
        ],
      };
    case 'office':
      return {
        title: 'Head office',
        rows: [
          ['Staff', `${fmt(c.headcount, 0)} / ${fmt(Math.round(requiredStaff(c)), 0)} needed`],
          ['Wage level', `${fmt(c.wage * 100, 0)}%`],
          ['Mean skill', fmt(c.meanSkill, 0)],
          ['Productivity', fmt(c.productivity, 0)],
        ],
      };
    case 'solar':
    case 'turbine':
      return {
        title: sel.kind === 'solar' ? 'Solar field' : 'Wind turbine',
        lead: 'Fixed tariff: income does not follow the gas price.',
        rows: [
          ['Green units', fmt(c.green, 1)],
          ['Share of capacity', `${fmt((c.green / (c.green + c.fossil)) * 100, 0)}%`],
        ],
      };
    case 'trees':
      return { title: 'Trees', lead: 'They grow or wither with the Environment score.', rows: [['Environment', fmt(c.environment, 0)]] };
    case 'truck':
      return {
        title: 'Delivery truck',
        rows: [
          ['Revenue last month', `${fmt(c.revenue, 1)} M DA`],
          ['Costs last month', `${fmt(c.costs, 1)} M DA`],
          ['Carbon tax paid', `${fmt(c.taxPaid, 1)} M DA`],
        ],
      };
    case 'customers':
      return {
        title: 'Customers',
        lead: 'A longer queue means happier customers.',
        rows: [
          ['Satisfaction', fmt(c.customer, 0)],
          ['Price level', `${fmt(c.price * 100, 0)}%`],
          ['Quality level', `${fmt(c.quality, 0)} / 5`],
        ],
      };
    case 'ceo':
      return {
        title: 'You, the owner',
        lead: RULES[params.strategy.rule].persona,
        rows: [
          ['Decision rule', RULES[params.strategy.rule].short],
          ['Decisions made', fmt(decisions, 0)],
          ['Total profit', `${fmt(c.cumProfit, 0)} M DA`],
        ],
      };
  }
}

export function InfoCard() {
  const sel = useGame((s) => s.selection);
  const c = useGame((s) => s.sim.company);
  const workers = useGame((s) => s.sim.workers);
  const params = useGame((s) => s.params);
  const decisions = useGame((s) => s.records.length);
  const select = useGame((s) => s.select);
  const info = sel ? content(sel, c, workers, params, decisions) : null;
  return (
    <AnimatePresence>
      {info && sel && (
        <motion.div
          key={`${sel.kind}-${sel.id ?? ''}`}
          className="info-card"
          role="dialog"
          aria-label={info.title}
          initial={{ opacity: 0, scale: 0.85, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 520, damping: 28 }}
        >
          <div className="row between">
            <h3>{info.title}</h3>
            <button className="icon-btn" style={{ width: 36, height: 36, boxShadow: 'none', background: 'var(--bg)' }} onClick={() => select(null)} aria-label="Close">
              <Icon name="close" size={16} />
            </button>
          </div>
          {info.lead && <div className="small muted">{info.lead}</div>}
          <dl>
            {info.rows.map(([k, v]) => (
              <div key={k} style={{ display: 'contents' }}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
