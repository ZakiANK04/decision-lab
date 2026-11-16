/** Runs the heavy simulations off the main thread so the 3D scene keeps animating. */
import { runCompare, runMonteCarlo, runPareto } from '../sim/montecarlo';
import type { Params, Strategy } from '../sim/types';

export type SimJob =
  | { kind: 'mc'; params: Params; n: number }
  | { kind: 'compare'; params: Params; a: { label: string; strategy: Strategy }; b: { label: string; strategy: Strategy }; n: number }
  | { kind: 'pareto'; params: Params; seeds: number };

export type SimMessage = { type: 'progress'; done: number; total: number } | { type: 'done'; result: unknown } | { type: 'error'; message: string };

export function runJobSync(job: SimJob, progress?: (done: number, total: number) => void): unknown {
  switch (job.kind) {
    case 'mc':
      return runMonteCarlo(job.params, job.n, progress);
    case 'compare':
      return runCompare(job.params, job.a, job.b, job.n, progress);
    case 'pareto':
      return runPareto(job.params, job.seeds, progress);
  }
}

const ctx = self as unknown as { postMessage(m: SimMessage): void; onmessage: ((e: MessageEvent<SimJob>) => void) | null; document?: unknown };

// Only attach the handler when this file really runs inside a worker.
if (typeof ctx.document === 'undefined') {
  ctx.onmessage = (e) => {
    try {
      const result = runJobSync(e.data, (done, total) => ctx.postMessage({ type: 'progress', done, total }));
      ctx.postMessage({ type: 'done', result });
    } catch (err) {
      ctx.postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  };
}
