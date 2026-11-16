import { runJobSync, type SimJob, type SimMessage } from '../workers/sim.worker';

export interface JobHandle<T> {
  promise: Promise<T>;
  cancel: () => void;
}

/** Run a simulation job in a Web Worker. Falls back to the main thread if workers are unavailable. */
export function runJob<T>(job: SimJob, onProgress?: (done: number, total: number) => void): JobHandle<T> {
  let worker: Worker | null = null;
  let cancelled = false;
  const promise = new Promise<T>((resolve, reject) => {
    try {
      worker = new Worker(new URL('../workers/sim.worker.ts', import.meta.url), { type: 'module' });
    } catch {
      worker = null;
    }
    if (!worker) {
      // Fallback: yield once so the UI can show "running", then compute synchronously.
      setTimeout(() => {
        if (cancelled) return;
        try {
          resolve(runJobSync(job, onProgress) as T);
        } catch (e) {
          reject(e);
        }
      }, 30);
      return;
    }
    worker.onmessage = (e: MessageEvent<SimMessage>) => {
      const m = e.data;
      if (m.type === 'progress') onProgress?.(m.done, m.total);
      else if (m.type === 'done') {
        worker?.terminate();
        resolve(m.result as T);
      } else {
        worker?.terminate();
        reject(new Error(m.message));
      }
    };
    worker.onerror = (e) => {
      worker?.terminate();
      // A worker that failed to load: compute on the main thread instead.
      try {
        resolve(runJobSync(job, onProgress) as T);
      } catch (err) {
        reject(err ?? e);
      }
    };
    worker.postMessage(job);
  });
  return {
    promise,
    cancel: () => {
      cancelled = true;
      worker?.terminate();
    },
  };
}
