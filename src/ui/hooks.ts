import { useEffect, useRef, useState, type CSSProperties } from 'react';

/** Number that glides to its target (ease-out), for the HUD. */
export function useTween(target: number, ms = 450): number {
  const [value, setValue] = useState(target);
  const from = useRef(target);
  const current = useRef(target);
  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || ms <= 0) {
      current.current = target;
      setValue(target);
      return;
    }
    from.current = current.current;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      current.current = from.current + (target - from.current) * e;
      setValue(current.current);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return value;
}

export function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false));
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return match;
}

export function usePageVisible(): boolean {
  const [visible, setVisible] = useState(() => (typeof document !== 'undefined' ? !document.hidden : true));
  useEffect(() => {
    const on = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);
  return visible;
}

/** Signed number with a real minus sign, e.g. +4.2 / −1.3 / 0. */
export function signed(x: number, digits = 1): string {
  const r = Number(x.toFixed(digits));
  if (r === 0) return (0).toFixed(digits === 0 ? 0 : digits).replace(/^0\.0+$/, '0');
  return `${r > 0 ? '+' : '−'}${Math.abs(r).toFixed(digits)}`;
}

/** Plain number with a real minus sign. */
export function fmt(x: number, digits = 0): string {
  const r = Number(x.toFixed(digits));
  return `${r < 0 ? '−' : ''}${Math.abs(r).toFixed(digits)}`;
}

/** CSS custom property so the slider track shows its filled part. */
export function fillStyle(value: number, min: number, max: number): CSSProperties {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return { ['--fill' as string]: `${Math.max(0, Math.min(100, pct))}%` } as CSSProperties;
}
