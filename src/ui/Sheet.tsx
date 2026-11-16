import { useRef } from 'react';
import { useGame, type SheetState, type Tab } from '../store/game';
import { DecideFooter, DecideTab } from './DecideTab';
import { LearnTab } from './LearnTab';
import { ParamsTab } from './ParamsTab';
import { SimulateTab } from './SimulateTab';

const TABS: { id: Tab; label: string }[] = [
  { id: 'decide', label: 'Decide' },
  { id: 'params', label: 'Parameters' },
  { id: 'simulate', label: 'Simulate' },
  { id: 'learn', label: 'Learn' },
];

const ORDER: SheetState[] = ['peek', 'half', 'full'];

/** Bottom sheet on phones, side panel on desktop. */
export function Sheet() {
  const tab = useGame((s) => s.tab);
  const sheet = useGame((s) => s.sheet);
  const setTab = useGame((s) => s.setTab);
  const setSheet = useGame((s) => s.setSheet);
  const startY = useRef<number | null>(null);

  const move = (dir: number) => {
    const i = ORDER.indexOf(sheet);
    setSheet(ORDER[Math.max(0, Math.min(ORDER.length - 1, i + dir))]);
  };

  return (
    <section className="sheet" data-state={sheet} aria-label="Game panel">
      <button
        className="sheet-handle"
        aria-label={sheet === 'peek' ? 'Open the panel' : sheet === 'half' ? 'Expand the panel' : 'Shrink the panel'}
        onPointerDown={(e) => {
          startY.current = e.clientY;
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        }}
        onPointerUp={(e) => {
          const dy = startY.current === null ? 0 : e.clientY - startY.current;
          startY.current = null;
          if (dy < -24) move(1);
          else if (dy > 24) move(-1);
          else setSheet(sheet === 'peek' ? 'half' : sheet === 'half' ? 'full' : 'half');
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp') move(1);
          if (e.key === 'ArrowDown') move(-1);
        }}
      >
        <i />
      </button>
      <div className="tabs" role="tablist" aria-label="Sections">
        {TABS.map((t) => (
          <button key={t.id} role="tab" id={`tab-${t.id}`} aria-selected={tab === t.id} aria-controls="tab-panel" className="tab" onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="sheet-body" role="tabpanel" id="tab-panel" aria-labelledby={`tab-${tab}`} key={tab}>
        {tab === 'decide' && <DecideTab />}
        {tab === 'params' && <ParamsTab />}
        {tab === 'simulate' && <SimulateTab />}
        {tab === 'learn' && <LearnTab />}
      </div>
      {tab === 'decide' && <DecideFooter />}
    </section>
  );
}
