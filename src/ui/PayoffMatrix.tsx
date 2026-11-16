import { useMemo, useState } from 'react';
import { ACTIONS, applyRule, CATEGORY_LABEL, RULE_IDS, RULES, TEXTBOOK, type ActionId, type PayoffMatrix as Matrix, type RuleId, type RuleResult } from '../sim';
import { toPercents } from '../store/game';
import { fmt, signed } from './hooks';
import { Icon } from './icons';

/** Cell colour like slides 08 and 09: red for losses, deeper green for bigger gains. */
export function cellStyle(v: number, maxAbs: number): { className: string; style?: React.CSSProperties } {
  if (v < -0.049) return { className: 'm-cell neg' };
  const k = maxAbs > 0 ? Math.min(1, Math.max(0, v) / maxAbs) : 0;
  return { className: 'm-cell', style: { background: `rgba(94, 205, 139, ${0.14 + 0.62 * k})` } };
}

interface Props {
  matrix: Matrix;
  result: RuleResult;
  rule: RuleId;
  selected: ActionId | null;
  onSelect: (a: ActionId) => void;
}

/** The live payoff matrix of the game: rows = actions, columns = states of nature. */
export function PayoffMatrix({ matrix, result, rule, selected, onSelect }: Props) {
  const pct = toPercents(matrix.probs);
  const maxAbs = useMemo(() => Math.max(0.5, ...matrix.u.flat().map((v) => Math.abs(v))), [matrix]);
  const cols = matrix.columns.length;
  let lastCat = '';
  return (
    <div className="matrix" style={{ ['--cols' as string]: cols } as React.CSSProperties} role="table" aria-label="Payoff matrix">
      <div className="m-head" role="row">
        <span role="columnheader">Your move</span>
        {matrix.columns.map((c, i) => (
          <span key={c.key} role="columnheader" title={c.hint}>
            {c.short}
            <br />
            <span className="num">{pct[i]}%</span>
          </span>
        ))}
        <span className="m-score-h" role="columnheader">
          {RULES[rule].scoreLabel}
        </span>
      </div>
      {matrix.actions.map((a, i) => {
        const info = ACTIONS[a];
        const isPick = result.winner === i;
        const isMine = selected === a;
        const off = !matrix.available[i];
        const cat = info.category;
        const showCat = cat !== lastCat;
        lastCat = cat;
        return (
          <div key={a} role="rowgroup">
            {showCat && <div className="m-cat">{CATEGORY_LABEL[cat]}</div>}
            <button
              className={`m-row${isPick ? ' pick' : ''}${isMine ? ' mine' : ''}${off ? ' off' : ''}`}
              onClick={() => !off && onSelect(a)}
              aria-pressed={isMine}
              aria-disabled={off}
              aria-label={`${info.name}${isPick ? ', the rule picks this' : ''}${off ? ', maxed out' : ''}. ${RULES[rule].scoreLabel} ${fmt(result.scores[i], 1)}`}
            >
              <div className="m-row-main" role="row">
                <div className="m-name">
                  <span className="ico">
                    <Icon name={a} size={18} />
                  </span>
                  <span className="txt">
                    <b>{info.name}</b>
                    {isMine ? (
                      <span className="m-tag mine">Your pick</span>
                    ) : isPick ? (
                      <span className="m-tag">Rule pick</span>
                    ) : off ? (
                      <span>Maxed out</span>
                    ) : (
                      <span className="num">{matrix.costs[i] > 0 ? `${fmt(matrix.costs[i], 1)} M DA` : 'Free'}</span>
                    )}
                  </span>
                </div>
                {matrix.u[i].map((v, s) => {
                  const cs = cellStyle(v, maxAbs);
                  return (
                    <span key={s} role="cell" {...cs}>
                      {fmt(v, 1)}
                    </span>
                  );
                })}
                <span className="m-score" role="cell">
                  {fmt(result.scores[i], 1)}
                </span>
              </div>
              {isMine && (
                <div className="m-detail">
                  <div className="muted" style={{ marginBottom: 4 }}>
                    {info.blurb} Change vs holding steady, after {matrix.months} months:
                  </div>
                  <table>
                    <thead>
                      <tr>
                        <th />
                        {matrix.columns.map((c) => (
                          <th key={c.key}>{c.short}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(
                        [
                          ['Cash, M DA', 'profit'],
                          ['Planet, pts', 'planet'],
                          ['People, pts', 'people'],
                        ] as const
                      ).map(([label, key]) => (
                        <tr key={key}>
                          <td>{label}</td>
                          {matrix.vec[i].map((v, s) => (
                            <td key={s} className={v[key] < -0.05 ? 'neg-text' : v[key] > 0.05 ? 'pos-text' : ''}>
                              {signed(v[key], 1)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}

/** Slide 08, interactive: same numbers, six rules, six winners. */
export function TextbookMatrix({ onRule }: { onRule?: (rule: RuleId) => void }) {
  const [rule, setRule] = useState<RuleId>('maximax');
  const r = applyRule(rule, TEXTBOOK.payoffs, TEXTBOOK.probs, TEXTBOOK.hurwiczAlpha);
  const pct = toPercents(TEXTBOOK.probs);
  const info = RULES[rule];
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="chips" role="group" aria-label="Decision rule">
        {RULE_IDS.map((id) => (
          <button
            key={id}
            className="chip"
            aria-pressed={rule === id}
            onClick={() => {
              setRule(id);
              onRule?.(id);
            }}
          >
            {RULES[id].short}
          </button>
        ))}
      </div>
      <div className="m-head" style={{ gridTemplateColumns: 'minmax(0,1fr) repeat(3, 52px) 56px', gap: 6, padding: '0 10px' }}>
        <span>Strategy</span>
        {['Low', 'Medium', 'High'].map((s, i) => (
          <span key={s}>
            {s}
            <br />
            <span className="num">{pct[i]}%</span>
          </span>
        ))}
        <span className="m-score-h">{info.scoreLabel}</span>
      </div>
      {TEXTBOOK.actions.map((name, i) => (
        <div key={name} className={`tb-row${r.winner === i ? ' pick' : ''}`}>
          <span>
            <b>{name}</b>
            {r.winner === i && (
              <>
                <br />
                <span className="m-tag">Chosen</span>
              </>
            )}
          </span>
          {TEXTBOOK.payoffs[i].map((v, s) => {
            const cs = cellStyle(v, 90);
            return (
              <span key={s} {...cs}>
                {fmt(v, 0)}
              </span>
            );
          })}
          <span className="m-score" style={{ color: r.winner === i ? 'var(--deep)' : undefined }}>
            {fmt(r.scores[i], Number.isInteger(Math.round(r.scores[i] * 10) / 10) ? 0 : 1)}
          </span>
        </div>
      ))}
      <div className="formula" aria-label={`Formula: ${info.formula}`}>
        {info.formula}
      </div>
      <p className="small muted">
        <b style={{ color: 'var(--ink)' }}>{info.persona}.</b> {info.how} {rule === 'hurwicz' ? 'Here α = 0.6.' : ''} Winner: <b style={{ color: 'var(--deep)' }}>{TEXTBOOK.actions[r.winner]}</b>.
      </p>
    </div>
  );
}
