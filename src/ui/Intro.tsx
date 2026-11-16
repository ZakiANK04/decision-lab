import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useGame } from '../store/game';
import { Icon, type IconName } from './icons';

const SEEN_KEY = 'decision-lab-onboarded';

function hasSeenOnboarding(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

/** Title sequence shown over the 3D camera swoop. Always skippable. */
export function Intro() {
  const reduce = useReducedMotion();
  const setPhase = useGame((s) => s.setPhase);
  const [stage, setStage] = useState(reduce ? 2 : 0);

  useEffect(() => {
    if (reduce) return;
    const a = setTimeout(() => setStage(1), 3600);
    const b = setTimeout(() => setStage(2), 5400);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [reduce]);

  const next = () => setPhase(hasSeenOnboarding() ? 'play' : 'onboarding');
  const lines = ['Decision', 'Lab'];
  let k = 0;

  return (
    <>
      <motion.div className="intro-veil" initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ duration: reduce ? 0.4 : 1.1, ease: 'easeOut' }} />
      <button className="btn ghost small skip" onClick={next}>
        Skip
      </button>
      <div className="overlay">
        {stage >= 1 && (
          <h1 className="intro-title" aria-label="Decision Lab">
            {lines.map((line) => (
              <span key={line} style={{ display: 'block' }} aria-hidden="true">
                {line.split('').map((ch) => {
                  const i = k++;
                  return (
                    <motion.span
                      key={i}
                      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 70, rotate: i % 2 ? 14 : -14, scale: 0.6 }}
                      animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
                      transition={reduce ? { duration: 0.3 } : { type: 'spring', stiffness: 420, damping: 17, delay: i * 0.07 }}
                    >
                      {ch}
                    </motion.span>
                  );
                })}
              </span>
            ))}
          </h1>
        )}
        {stage >= 2 && (
          <>
            <motion.p className="intro-sub" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
              Run a tiny energy company. Your decision rule is your value.
            </motion.p>
            <motion.button
              className="btn play-btn"
              onClick={next}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 380, damping: 15, delay: 0.1 }}
              whileTap={{ scale: 0.93 }}
              autoFocus
            >
              <Icon name="play" size={22} /> Play
            </motion.button>
            <motion.p className="credits" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
              Aouanouk A. Zakaria · Britah Abdessamed
              <br />
              ENP Algiers · GEDD 2026/2027
            </motion.p>
          </>
        )}
      </div>
    </>
  );
}

const CARDS: { title: string; body: string; icon: IconName; bg: string; fg: string }[] = [
  { title: 'You choose an action', body: 'One move a month: gas, solar, wages, prices, recycling. Your call.', icon: 'joystick', bg: '#ffffff', fg: 'var(--ink)' },
  { title: 'The world picks a state', body: 'Gas price, demand and regulation change every month. Nobody controls them.', icon: 'world', bg: 'var(--green)', fg: 'var(--dark)' },
  { title: 'You get a payoff', body: 'Profit, planet and people all move. Your decision rule sets the trade-off.', icon: 'profit', bg: 'var(--dark)', fg: '#ffffff' },
];

/** Three swipeable cards: action, state of nature, payoff (slide 03 of the deck). */
export function Onboarding() {
  const setPhase = useGame((s) => s.setPhase);
  const [index, setIndex] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);

  const start = () => {
    try {
      localStorage.setItem(SEEN_KEY, '1');
    } catch {
      /* private mode */
    }
    setPhase('play');
  };
  const goTo = (i: number) => {
    const el = scroller.current;
    const card = el?.children[i] as HTMLElement | undefined;
    if (el && card) el.scrollTo({ left: card.offsetLeft - el.offsetLeft - 18, behavior: 'smooth' });
    setIndex(i);
  };

  return (
    <motion.div className="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="onb" role="dialog" aria-label="How to play" initial={{ y: 40, scale: 0.94 }} animate={{ y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 360, damping: 26 }}>
        <div
          className="onb-cards"
          ref={scroller}
          onScroll={(e) => {
            const el = e.currentTarget;
            setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth - 24)));
          }}
        >
          {CARDS.map((c, i) => (
            <div key={c.title} className="onb-card" style={{ background: c.bg, color: c.fg }} aria-label={`Step ${i + 1} of 3`}>
              <div className="row between">
                <span className="big-ico">
                  <Icon name={c.icon} size={40} stroke={1.8} />
                </span>
                <span className="pill" style={{ background: 'rgba(255,255,255,0.55)', color: 'var(--dark)' }}>
                  {i + 1} / 3
                </span>
              </div>
              <div>
                <h2>{c.title}</h2>
                <p style={{ marginTop: 8 }}>{c.body}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="dots" aria-hidden="true">
          {CARDS.map((c, i) => (
            <i key={c.title} className={i === Math.min(index, 2) ? 'on' : ''} />
          ))}
        </div>
        <div className="row" style={{ padding: '0 18px' }}>
          <button className="btn ghost" onClick={start}>
            Skip
          </button>
          <button className="btn block" onClick={() => (index >= 2 ? start() : goTo(index + 1))} autoFocus>
            {index >= 2 ? 'Start playing' : 'Next'} <Icon name="arrow" size={18} />
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
