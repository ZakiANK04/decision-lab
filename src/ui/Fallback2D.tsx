import { moodOf, workerSatisfaction } from '../sim';
import { useGame } from '../store/game';

const MOOD_FILL = { happy: '#2fbf71', neutral: '#f0b23e', stressed: '#e5484d' } as const;

/** Flat drawing of the island, used when WebGL is not available. Same signals as the 3D scene. */
export function Fallback2D() {
  const c = useGame((s) => s.sim.company);
  const workers = useGame((s) => s.sim.workers);
  const select = useGame((s) => s.select);
  const env = c.environment / 100;
  const smoke = Math.min(1, c.co2 / 140);
  const trees = Math.round(2 + env * 8);
  const panels = Math.min(10, Math.round(c.green));
  const tanks = Math.max(0, Math.min(8, Math.round(c.fossil) - 5));
  const active = workers.filter((w) => w.active);
  const leaf = env > 0.5 ? '#58c783' : env > 0.3 ? '#9fbf6f' : '#b99c6b';
  return (
    <div className="fallback">
      <svg viewBox="0 0 560 380" role="img" aria-label={`Your company: ${active.length} workers, ${c.fossil} gas units, ${c.green} green units, environment ${Math.round(c.environment)} out of 100.`}>
        <ellipse cx="280" cy="300" rx="250" ry="52" fill="#bfae95" />
        <ellipse cx="280" cy="280" rx="250" ry="52" fill="#a9e8b8" />
        {/* smoke */}
        {[0, 1, 2, 3].map((i) => (
          <circle key={i} cx={128 + i * 16} cy={96 - i * 24} r={(10 + i * 9) * (0.3 + smoke * 1.2)} fill={smoke > 0.5 ? '#77726a' : '#e3e3df'} opacity={0.85 - i * 0.14} />
        ))}
        {/* factory */}
        <g onClick={() => select({ kind: 'factory' })} style={{ cursor: 'pointer' }}>
          <rect x="112" y="120" width="26" height="130" rx="6" fill="#f1e9dc" />
          <rect x="112" y="136" width="26" height="14" fill="#ef6f60" />
          <rect x="130" y="190" width="150" height="80" rx="8" fill="#fff3dd" />
          <path d="M130 190l25-28 25 28 25-28 25 28 25-28 25 28z" fill="#f4a78c" />
          <rect x="236" y="226" width="26" height="44" rx="4" fill="#1b3d2d" />
        </g>
        {Array.from({ length: tanks }, (_, i) => (
          <rect key={i} x={48 + (i % 4) * 20} y={232 + Math.floor(i / 4) * 26} width="16" height="30" rx="8" fill="#c9dbea" />
        ))}
        {/* office */}
        <g onClick={() => select({ kind: 'office' })} style={{ cursor: 'pointer' }}>
          <rect x="330" y="150" width="96" height="118" rx="8" fill="#ffffff" />
          <rect x="324" y="144" width="108" height="12" rx="4" fill="#1b3d2d" />
          {[0, 1, 2].map((i) => [0, 1].map((j) => <rect key={`${i}${j}`} x={342 + i * 28} y={170 + j * 30} width="18" height="18" rx="3" fill="#bfefd0" />))}
        </g>
        {/* solar */}
        {Array.from({ length: panels }, (_, i) => (
          <path key={i} d={`M${312 + (i % 5) * 34} ${300 + Math.floor(i / 5) * 18}l22-6 8 10-22 6z`} fill="#4f76ad" stroke="#fff" strokeWidth="2" />
        ))}
        {/* trees */}
        {Array.from({ length: trees }, (_, i) => {
          const x = 40 + ((i * 97) % 480);
          const y = 262 + ((i * 53) % 40);
          return (
            <g key={i}>
              <rect x={x - 2} y={y - 10} width="5" height="16" fill="#a9805b" />
              <circle cx={x} cy={y - 18} r={9 + env * 6} fill={leaf} />
            </g>
          );
        })}
        {/* workers: shape and colour show the mood */}
        {active.map((w, i) => {
          const mood = moodOf(workerSatisfaction(w, c));
          const x = 150 + (i % 10) * 28;
          const y = 290 + Math.floor(i / 10) * 30;
          return (
            <g key={w.id} onClick={() => select({ kind: 'worker', id: w.id })} style={{ cursor: 'pointer' }}>
              <circle cx={x} cy={y} r="13" fill="transparent" />
              <rect x={x - 5} y={y} width="10" height="11" rx="5" fill="#8ecdf2" />
              <circle cx={x} cy={y - 5} r="7" fill="#f1c29b" />
              {mood === 'happy' && <circle cx={x} cy={y - 19} r="4" fill={MOOD_FILL.happy} />}
              {mood === 'neutral' && <rect x={x - 4} y={y - 23} width="8" height="8" fill={MOOD_FILL.neutral} />}
              {mood === 'stressed' && <path d={`M${x - 5} ${y - 23}h10l-5 9z`} fill={MOOD_FILL.stressed} />}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
