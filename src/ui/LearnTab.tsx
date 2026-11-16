import { useRef, useState } from 'react';
import type { RuleId } from '../sim';
import { useGame } from '../store/game';
import { Icon } from './icons';
import { TextbookMatrix } from './PayoffMatrix';

/** Five one-screen lessons that tie the game to the deck. Each ends with a "Try it" button. */
export function LearnTab() {
  const setStrategy = useGame((s) => s.setStrategy);
  const setTab = useGame((s) => s.setTab);
  const requestCompare = useGame((s) => s.requestCompare);
  const toast = useGame((s) => s.toast);
  const [index, setIndex] = useState(0);
  const [tbRule, setTbRule] = useState<RuleId>('maximax');
  const scroller = useRef<HTMLDivElement>(null);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const cards = Array.from(el.children) as HTMLElement[];
    const mid = el.scrollLeft + el.clientWidth / 2;
    let best = 0;
    cards.forEach((c, i) => {
      if (Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid) < Math.abs(cards[best].offsetLeft + cards[best].offsetWidth / 2 - mid)) best = i;
    });
    setIndex(best);
  };

  const go = (patch: Parameters<typeof setStrategy>[0], title: string, body: string) => {
    setStrategy(patch);
    setTab('decide');
    toast({ title, body, tone: 'info' });
  };

  return (
    <div className="stack">
      <div className="lessons" ref={scroller} onScroll={onScroll} tabIndex={0} aria-label="Lessons, swipe sideways">
        <article className="card lesson">
          <span className="pill dark" style={{ alignSelf: 'flex-start' }}>
            1 · The idea
          </span>
          <h3>It is the agent loop</h3>
          <div className="stack" style={{ gap: 6 }}>
            <div className="card green" style={{ padding: 12, borderRadius: 18 }}>
              <b>Agent</b> = you, the decision maker
            </div>
            <div className="row" style={{ justifyContent: 'center', gap: 6 }}>
              <span className="pill dark">action a →</span>
              <span className="pill mint">← reward r(a, s)</span>
            </div>
            <div className="card dark" style={{ padding: 12, borderRadius: 18 }}>
              <b>Environment</b> = the states of nature
            </div>
          </div>
          <div className="formula">a* = argmax E[ r(a, s) ]</div>
          <p className="small muted grow">Every month you act, the world answers, you collect a payoff. Same loop as reinforcement learning.</p>
          <button className="btn block" onClick={() => go({ rule: 'ev', lens: 'gas' }, 'Expected value loaded', 'Play a few months and watch the loop.')}>
            Try it <Icon name="arrow" size={18} />
          </button>
        </article>

        <article className="card lesson">
          <span className="pill dark" style={{ alignSelf: 'flex-start' }}>
            2 · The building blocks
          </span>
          <h3>Write the table first</h3>
          <div className="mini-grid">
            <div style={{ background: 'var(--dark)', color: '#fff' }}>Rows = your actions</div>
            <div>Columns = states of nature</div>
            <div style={{ background: 'var(--mint)' }}>Cells = payoffs</div>
            <div style={{ background: 'var(--green)' }}>Rule = who wins</div>
          </div>
          <p className="small muted grow">
            Rows are what you control. Columns are what you do not. In the game the table is rebuilt every month from your company, and you can change its columns: gas price, demand, regulation or named scenarios.
          </p>
          <button className="btn block" onClick={() => go({ lens: 'demand' }, 'Columns switched to Demand', 'Same actions, another uncertainty.')}>
            Try it <Icon name="arrow" size={18} />
          </button>
        </article>

        <article className="card lesson" style={{ width: 'min(94%, 400px)' }}>
          <span className="pill dark" style={{ alignSelf: 'flex-start' }}>
            3 · The rules
          </span>
          <h3>Same data, different rule, different winner</h3>
          <p className="small muted">The deck example: an energy company picks a 5-year strategy (NPV, M$).</p>
          <TextbookMatrix onRule={setTbRule} />
          <button className="btn block" onClick={() => go({ rule: tbRule }, 'Rule loaded into the game', 'The same rule now picks your moves.')}>
            Try this rule in the game <Icon name="arrow" size={18} />
          </button>
        </article>

        <article className="card lesson">
          <span className="pill dark" style={{ alignSelf: 'flex-start' }}>
            4 · Risk vs uncertainty
          </span>
          <h3>How much do you know about the future?</h3>
          <div className="stack" style={{ gap: 6 }}>
            <div className="card green" style={{ padding: 12, borderRadius: 18 }}>
              <b>Certainty.</b> One future. Just optimise.
            </div>
            <div className="card" style={{ padding: 12, borderRadius: 18, background: 'var(--bg)' }}>
              <b>Risk.</b> You know the probabilities. Maximise the expected value.
            </div>
            <div className="card dark" style={{ padding: 12, borderRadius: 18 }}>
              <b>Uncertainty.</b> No probabilities. Pick a robust rule.
            </div>
          </div>
          <p className="small muted grow">Expected value trusts your probability sliders. Laplace, Maximin and Minimax regret ignore them. Shocks are in no table at all.</p>
          <button className="btn block" onClick={() => go({ rule: 'laplace' }, 'Laplace loaded', 'It ignores your probabilities: every state counts the same.')}>
            Try it: play without probabilities <Icon name="arrow" size={18} />
          </button>
        </article>

        <article className="card lesson">
          <span className="pill dark" style={{ alignSelf: 'flex-start' }}>
            5 · Sonatrach vs Shell
          </span>
          <h3>Exploit or explore?</h3>
          <div className="stack" style={{ gap: 6 }}>
            <div className="card" style={{ padding: 12, borderRadius: 18, background: 'var(--orange-bg)' }}>
              <b>Exploit: reduce uncertainty.</b>
              <div className="small">Security first, close to Maximin. Long-term contracts fix the price.</div>
            </div>
            <div className="card" style={{ padding: 12, borderRadius: 18, background: '#fff4cc' }}>
              <b>Explore: map uncertainty.</b>
              <div className="small">Scenario planning. Stay robust in every named future.</div>
            </div>
          </div>
          <p className="small muted grow">Like a multi-armed bandit: exploit what you know, or explore what you do not. Run both on the same worlds and see who pays which price.</p>
          <button className="btn block" onClick={() => requestCompare('exploit', 'explore')}>
            Try it: compare both <Icon name="arrow" size={18} />
          </button>
        </article>
      </div>
      <div className="dots" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <i key={i} className={i === index ? 'on' : ''} />
        ))}
      </div>
      <p className="credits">
        Aouanouk A. Zakaria · Britah Abdessamed
        <br />
        ENP Algiers · GEDD 2026/2027 · Decision Theory
        <br />
        All numbers are illustrative. Presets are inspired by public case studies and are not affiliated with any company.
      </p>
    </div>
  );
}
