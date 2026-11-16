import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { decisionStyle, gradeOf, RULES, scoreOf } from '../sim';
import { useGame } from '../store/game';
import { fmt, useTween } from './hooks';
import { Icon } from './icons';
import { shareImage } from './shareImage';

/** Shown after month 36: one grade per pillar, the player's decision style, and a shareable image. */
export function EndScreen() {
  const c = useGame((s) => s.sim.company);
  const records = useGame((s) => s.records);
  const params = useGame((s) => s.params);
  const restart = useGame((s) => s.restart);
  const setEndOpen = useGame((s) => s.setEndOpen);
  const setTab = useGame((s) => s.setTab);
  const toast = useGame((s) => s.toast);
  const shareUrl = useGame((s) => s.shareUrl);

  const scores = useMemo(() => scoreOf(c), [c]);
  const style = useMemo(() => decisionStyle(records, params.strategy), [records, params.strategy]);
  const grades = { profit: gradeOf(scores.profit), planet: gradeOf(scores.planet), people: gradeOf(scores.people) };
  const overall = useTween(scores.overall, 1100);

  const saveImage = async () => {
    const r = await shareImage({ scores, grades, style, ruleName: RULES[params.strategy.rule].short, seed: params.seed, cumProfit: c.cumProfit });
    if (r === 'downloaded') toast({ title: 'Image saved', body: 'Look in your downloads.', tone: 'good' });
    if (r === 'failed') toast({ title: 'Could not create the image', tone: 'bad' });
  };
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl());
      toast({ title: 'Link copied', body: 'Same seed, same settings.', tone: 'good' });
    } catch {
      toast({ title: 'Copy failed', body: shareUrl(), tone: 'bad' });
    }
  };

  const pillars = [
    { key: 'profit', name: 'Profit', grade: grades.profit, detail: `${fmt(c.cumProfit, 0)} M DA earned` },
    { key: 'planet', name: 'Planet', grade: grades.planet, detail: `Environment ${fmt(c.environment, 0)}` },
    { key: 'people', name: 'People', grade: grades.people, detail: `Workers ${fmt(c.worker, 0)} · Customers ${fmt(c.customer, 0)}` },
  ] as const;

  return (
    <motion.div className="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="end" role="dialog" aria-label="Your results" initial={{ y: 50, scale: 0.92 }} animate={{ y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 320, damping: 24 }}>
        <div className="row between">
          <span className="pill dark">36 months later</span>
          <button className="icon-btn" onClick={() => setEndOpen(false)} aria-label="Close results and look at the island">
            <Icon name="close" />
          </button>
        </div>
        <div className="card green row between" style={{ borderRadius: 32, alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontWeight: 700 }}>Overall score</div>
            <div className="score-big num">
              {Math.round(overall)}
              <span style={{ fontSize: 22, letterSpacing: 0, fontWeight: 700 }}> / 100</span>
            </div>
          </div>
          <div className="small" style={{ textAlign: 'right', fontWeight: 700 }}>
            Rule: {RULES[params.strategy.rule].short}
            <br />
            Seed {params.seed}
          </div>
        </div>
        <div className="grades">
          {pillars.map((p, i) => (
            <motion.div key={p.key} className={`grade ${p.grade}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 + i * 0.12, type: 'spring', stiffness: 400, damping: 22 }}>
              <div style={{ fontWeight: 800 }}>{p.name}</div>
              <div className="g" aria-label={`Grade ${p.grade}`}>
                {p.grade}
              </div>
              <div className="small muted">{p.detail}</div>
            </motion.div>
          ))}
        </div>
        <div className="card dark" style={{ borderRadius: 32 }}>
          <span className="label">Your decision style</span>
          <h2 style={{ marginTop: 4 }}>{style.title}</h2>
          <p style={{ marginTop: 6, fontWeight: 600 }}>{style.sentence}</p>
          {style.closestRule && (
            <p className="small muted" style={{ marginTop: 6 }}>
              {Math.round(style.agreement * 100)}% of your hand-picked moves matched {RULES[style.closestRule].short}.
            </p>
          )}
        </div>
        <div className="row wrap">
          <button className="btn" style={{ flex: 1 }} onClick={saveImage}>
            <Icon name="image" size={18} /> Share result
          </button>
          <button className="btn ghost" style={{ flex: 1 }} onClick={copyLink}>
            <Icon name="link" size={18} /> Copy link
          </button>
        </div>
        <div className="row wrap">
          <button className="btn dark" style={{ flex: 1 }} onClick={() => restart({ newSeed: true })}>
            <Icon name="restart" size={18} /> New world
          </button>
          <button
            className="btn ghost"
            style={{ flex: 1 }}
            onClick={() => {
              restart();
              setTab('decide');
            }}
          >
            Same world, new rule
          </button>
        </div>
        <p className="small muted" style={{ textAlign: 'center' }}>
          A good decision is a good process, not a lucky outcome. Try Simulate to see your strategy in 200 other worlds.
        </p>
      </motion.div>
    </motion.div>
  );
}
