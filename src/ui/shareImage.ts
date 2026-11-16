import type { DecisionStyle, Scores } from '../sim';

export interface ShareData {
  scores: Scores;
  grades: { profit: string; planet: string; people: string };
  style: DecisionStyle;
  ruleName: string;
  seed: number;
  cumProfit: number;
}

const INK = '#0f1f17';
const DARK = '#10291d';
const GREEN = '#5ee38b';
const MINT = '#ddf6e5';
const DEEP = '#067a4f';
const BG = '#f2f4f0';
const RED_BG = '#fbe3e1';
const RED = '#9b1c1c';
const FONT = "'Gilroy','Madani','Gotham','Urbanist Variable','Urbanist',system-ui,sans-serif";

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
}

function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, weight: number, color: string, align: CanvasTextAlign = 'left'): void {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.fillText(s, x, y);
}

function wrap(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, maxW: number, lineH: number, size: number, weight: number, color: string): number {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  let line = '';
  let yy = y;
  for (const word of s.split(' ')) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineH;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, yy);
  return yy;
}

/** Draw the result card (1080 x 1350, portrait) in the style of the deck. */
export function drawShareImage(d: ShareData): HTMLCanvasElement {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // header
  rr(ctx, 60, 60, 300, 64, 32, DARK);
  text(ctx, 'Decision Lab', 210, 103, 30, 800, '#fff', 'center');
  rr(ctx, 376, 60, 300, 64, 32, '#fff');
  text(ctx, '36 months later', 526, 103, 28, 700, INK, 'center');

  // overall score
  rr(ctx, 60, 156, 960, 330, 56, GREEN);
  text(ctx, 'Overall score', 110, 232, 34, 700, DARK);
  text(ctx, String(Math.round(d.scores.overall)), 110, 420, 210, 800, DARK);
  ctx.font = `800 210px ${FONT}`;
  const sw = ctx.measureText(String(Math.round(d.scores.overall))).width;
  text(ctx, '/ 100', 130 + sw, 420, 54, 700, DARK);
  text(ctx, `Total profit ${Math.round(d.cumProfit)} M DA`, 970, 232, 30, 700, DARK, 'right');
  text(ctx, `Rule: ${d.ruleName}`, 970, 420, 30, 700, DARK, 'right');

  // pillars
  const pillars: [string, string, number][] = [
    ['Profit', d.grades.profit, d.scores.profit],
    ['Planet', d.grades.planet, d.scores.planet],
    ['People', d.grades.people, d.scores.people],
  ];
  pillars.forEach(([name, grade, score], i) => {
    const x = 60 + i * 326;
    const good = grade === 'A' || grade === 'B';
    const bad = grade === 'D' || grade === 'E';
    rr(ctx, x, 516, 308, 330, 48, good ? MINT : bad ? RED_BG : '#fff');
    text(ctx, name, x + 40, 584, 34, 800, INK);
    text(ctx, grade, x + 40, 760, 170, 800, good ? DEEP : bad ? RED : INK);
    text(ctx, `${Math.round(score)} / 100`, x + 40, 812, 28, 700, '#4b5b52');
  });

  // decision style
  rr(ctx, 60, 876, 960, 330, 56, DARK);
  text(ctx, 'YOUR DECISION STYLE', 110, 948, 26, 800, GREEN);
  text(ctx, d.style.title, 110, 1036, 72, 800, '#fff');
  wrap(ctx, d.style.sentence, 110, 1100, 860, 46, 34, 600, '#d5e3da');

  // footer
  text(ctx, 'A decision rule is a value. Same data, different rule, different outcome.', 60, 1262, 27, 700, INK);
  text(ctx, `Seed ${d.seed} · Decision Theory · GEDD 2026/2027 · ENP Algiers`, 60, 1304, 24, 600, '#4b5b52');
  return canvas;
}

/** Share the image with the system share sheet when possible, otherwise download it. */
export async function shareImage(d: ShareData): Promise<'shared' | 'downloaded' | 'failed'> {
  try {
    await document.fonts?.ready;
    const canvas = drawShareImage(d);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) return 'failed';
    const file = new File([blob], 'decision-lab-result.png', { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Decision Lab', text: `${d.style.title}: ${Math.round(d.scores.overall)}/100` });
        return 'shared';
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return 'shared';
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'decision-lab-result.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return 'downloaded';
  } catch {
    return 'failed';
  }
}
