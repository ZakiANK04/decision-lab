import { Component, lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AnimatePresence } from 'framer-motion';
import { gradeOf, PRESETS, RULES, scoreOf, type PresetId } from './sim';
import { useGame } from './store/game';
import { EndScreen } from './ui/EndScreen';
import { Fallback2D } from './ui/Fallback2D';
import { Hud } from './ui/Hud';
import { InfoCard } from './ui/InfoCard';
import { Intro, Onboarding } from './ui/Intro';
import { Sheet } from './ui/Sheet';
import { Toasts } from './ui/Toasts';

// three.js is loaded in its own chunk so the title appears before the 3D engine has downloaded.
const Scene = lazy(() => import('./scene/Scene'));

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

/** If the 3D scene crashes on an old phone, fall back to the flat drawing instead of a blank page. */
class SceneBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function mix(a: string, b: string, k: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * k)).join(',')})`;
}

const DEMO_ORDER: PresetId[] = ['exploit', 'explore', 'greedy', 'green'];

/** Projector view: the game plays itself and cycles through the presets. */
function DemoBanner() {
  const strategy = useGame((s) => s.params.strategy);
  const phase = useGame((s) => s.phase);
  const c = useGame((s) => s.sim.company);
  const preset = PRESETS[strategy.preset];
  const scores = scoreOf(c);
  return (
    <div className="demo-banner" role="status">
      <span className="pill green">
        {preset.tag} · {RULES[strategy.rule].short}
      </span>
      <h2 style={{ marginTop: 10 }}>{phase === 'end' ? `${preset.name}: ${Math.round(scores.overall)} / 100` : preset.name}</h2>
      <p>{phase === 'end' ? `Profit ${gradeOf(scores.profit)} · Planet ${gradeOf(scores.planet)} · People ${gradeOf(scores.people)}. Same world rules, different decision rule.` : preset.blurb}</p>
    </div>
  );
}

export default function App() {
  const phase = useGame((s) => s.phase);
  const demo = useGame((s) => s.demo);
  const sheet = useGame((s) => s.sheet);
  const auto = useGame((s) => s.auto);
  const endOpen = useGame((s) => s.endOpen);
  const env = useGame((s) => s.sim.company.environment);
  const [webgl] = useState(hasWebGL);

  // Auto-play: the selected rule decides once a second.
  useEffect(() => {
    if (!auto || phase !== 'play') return;
    const id = setInterval(() => useGame.getState().playMonth(), demo ? 1400 : 950);
    return () => clearInterval(id);
  }, [auto, phase, demo]);

  // Demo loop for the projector: show the result, then start the next preset in a new world.
  useEffect(() => {
    if (!demo) return;
    const s = useGame.getState();
    if (phase === 'play' && s.sim.company.month === 0 && s.params.strategy.preset === 'custom') {
      s.restart({ params: { ...s.params, strategy: PRESETS.exploit.strategy } });
      s.setAuto(true);
    }
    if (phase !== 'end') return;
    const id = setTimeout(() => {
      const g = useGame.getState();
      const next = DEMO_ORDER[(DEMO_ORDER.indexOf(g.params.strategy.preset) + 1) % DEMO_ORDER.length];
      g.restart({ newSeed: true, params: { ...g.params, strategy: PRESETS[next].strategy } });
      g.setAuto(true);
    }, 9000);
    return () => clearTimeout(id);
  }, [demo, phase]);

  // Keyboard shortcuts on desktop.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA' || el.tagName === 'BUTTON')) return;
      const g = useGame.getState();
      if (g.phase !== 'play') return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        g.playMonth();
      } else if (e.key.toLowerCase() === 'u') g.undo();
      else if (e.key.toLowerCase() === 'a') g.setAuto(!g.auto);
      else if (['1', '2', '3', '4'].includes(e.key)) g.setTab((['decide', 'params', 'simulate', 'learn'] as const)[Number(e.key) - 1]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Sky: sunny when the Environment score is high, smoggy when it is low.
  const sky = useMemo(() => {
    const k = Math.max(0, Math.min(1, (env / 100) * 1.3));
    return `linear-gradient(180deg, ${mix('#bdb5a3', '#c4ecee', k)} 0%, ${mix('#e3ddd0', '#f2f4f0', k)} 62%)`;
  }, [env]);

  const playing = phase === 'play' || phase === 'end';
  const flat = <Fallback2D />;

  return (
    <div className="app" data-phase={phase} data-sheet={sheet} data-demo={demo}>
      <div className="sky" style={{ background: sky }} />
      <div className="scene">
        {webgl ? (
          <SceneBoundary fallback={flat}>
            <Suspense fallback={null}>
              <Scene />
            </Suspense>
          </SceneBoundary>
        ) : (
          flat
        )}
      </div>

      {playing && <Hud />}
      {playing && !demo && <InfoCard />}
      {playing && !demo && <Sheet />}
      {playing && !demo && <Toasts />}
      {playing && demo && <DemoBanner />}

      {phase === 'intro' && <Intro />}
      <AnimatePresence>
        {phase === 'onboarding' && <Onboarding key="onboarding" />}
        {phase === 'end' && endOpen && !demo && <EndScreen key="end" />}
      </AnimatePresence>
    </div>
  );
}
