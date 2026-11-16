/** Tiny synthesised sound effects (Web Audio, no files). Silent until the player turns sound on. */

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  } catch {
    ctx = null;
  }
  return ctx;
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.08, slideTo?: number): void {
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime + start;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export const sfx = {
  unlock(): void {
    const a = audio();
    if (a?.state === 'suspended') void a.resume();
    tone(660, 0, 0.09, 'triangle', 0.06);
    tone(990, 0.07, 0.12, 'triangle', 0.06);
  },
  tick(): void {
    tone(520, 0, 0.05, 'triangle', 0.04);
  },
  coin(): void {
    tone(988, 0, 0.08, 'square', 0.035);
    tone(1319, 0.07, 0.16, 'square', 0.035);
  },
  thud(): void {
    tone(180, 0, 0.16, 'sine', 0.09, 90);
  },
  bad(): void {
    tone(330, 0, 0.14, 'sawtooth', 0.04, 220);
    tone(220, 0.13, 0.22, 'sawtooth', 0.04, 140);
  },
  fanfare(): void {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.1 * i, 0.22, 'triangle', 0.06));
  },
};
