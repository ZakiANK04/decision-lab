import { create } from 'zustand';
import {
  ACTIONS,
  allRulePicks,
  buildPayoffMatrix,
  decodeParams,
  defaultParams,
  encodeParams,
  initState,
  normalizeProbs,
  PRESETS,
  setProb,
  SHOCK_BLURB,
  SHOCK_LABELS,
  step,
  type ActionId,
  type MonthRecord,
  type Params,
  type PayoffMatrix,
  type PresetId,
  type RuleId,
  type SimState,
  type StepEvent,
  type Strategy,
  type Triple,
  type Weights,
  type WorkerParams,
} from '../sim';
import { sfx } from '../ui/sound';

export type Phase = 'intro' | 'onboarding' | 'play' | 'end';
export type Tab = 'decide' | 'params' | 'simulate' | 'learn';
export type SheetState = 'peek' | 'half' | 'full';
export type SelectionKind = 'worker' | 'factory' | 'tanks' | 'office' | 'solar' | 'turbine' | 'trees' | 'truck' | 'ceo' | 'customers';
export interface Selection {
  kind: SelectionKind;
  id?: number;
}
export interface Toast {
  id: number;
  title: string;
  body?: string;
  tone: 'good' | 'bad' | 'info';
  undo?: boolean;
}

interface Snapshot {
  sim: SimState;
  params: Params;
}

/** Everything a "New game" replaces, kept so the toast can offer Undo instead of an "Are you sure?" dialog. */
interface Backup {
  params: Params;
  sim: SimState;
  past: Snapshot[];
  records: MonthRecord[];
  phase: Phase;
  lastEvent: StepEvent | null;
}

export interface Game {
  phase: Phase;
  demo: boolean;
  endOpen: boolean;
  params: Params;
  sim: SimState;
  past: Snapshot[];
  records: MonthRecord[];
  matrix: PayoffMatrix;
  picks: Record<RuleId, ActionId>;
  /** Row the player tapped (null = follow the rule). */
  selected: ActionId | null;
  lastEvent: StepEvent | null;
  eventSeq: number;
  auto: boolean;
  tab: Tab;
  sheet: SheetState;
  sound: boolean;
  selection: Selection | null;
  toasts: Toast[];
  /** Pre-filled Compare request coming from the Learn tab. */
  compareRequest: { a: string; b: string; nonce: number } | null;
  backup: Backup | null;

  setPhase: (p: Phase) => void;
  startPlay: () => void;
  playMonth: (action?: ActionId) => void;
  undo: () => void;
  restart: (opts?: { newSeed?: boolean; params?: Params }) => void;
  undoRestart: () => void;
  selectAction: (a: ActionId | null) => void;
  setStrategy: (patch: Partial<Strategy>) => void;
  setWeight: (key: keyof Weights, value: number) => void;
  setProbability: (dim: 'gas' | 'demand' | 'regulation', index: number, value: number) => void;
  setShock: (key: keyof Params['shocks'], value: number) => void;
  setTurnover: (patch: Partial<Pick<WorkerParams, 'turnoverK' | 'turnoverB'>>) => void;
  loadPreset: (id: PresetId) => void;
  setAuto: (on: boolean) => void;
  setTab: (t: Tab) => void;
  setSheet: (s: SheetState) => void;
  toggleSound: () => void;
  select: (s: Selection | null) => void;
  toast: (t: Omit<Toast, 'id'>) => void;
  dismissToast: (id: number) => void;
  setEndOpen: (open: boolean) => void;
  requestCompare: (a: string, b: string) => void;
  shareUrl: () => string;
}

let toastId = 1;

function derive(sim: SimState, params: Params): { matrix: PayoffMatrix; picks: Record<RuleId, ActionId> } {
  const matrix = buildPayoffMatrix(sim.company, params);
  return { matrix, picks: allRulePicks(matrix, params.strategy.alpha) };
}

function readUrl(): { params: Params; demo: boolean; skipIntro: boolean } {
  let params = defaultParams(Math.floor(Math.random() * 9000) + 1000);
  let demo = false;
  let skipIntro = false;
  try {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const query = new URLSearchParams(window.location.search);
    const code = hash.get('r') ?? query.get('r');
    if (code) {
      const decoded = decodeParams(code);
      if (decoded) params = decoded;
    }
    demo = query.has('demo') || hash.has('demo');
    skipIntro = query.has('skip') || demo;
  } catch {
    /* ignore malformed URLs */
  }
  return { params, demo, skipIntro };
}

const boot = readUrl();
const bootSim = initState(boot.params);

export const useGame = create<Game>((set, get) => ({
  phase: boot.skipIntro ? 'play' : 'intro',
  demo: boot.demo,
  endOpen: true,
  params: boot.params,
  sim: bootSim,
  past: [],
  records: [],
  ...derive(bootSim, boot.params),
  selected: null,
  lastEvent: null,
  eventSeq: 0,
  auto: boot.demo,
  tab: 'decide',
  sheet: 'half',
  sound: false,
  selection: null,
  toasts: [],
  compareRequest: null,
  backup: null,

  setPhase: (phase) => set({ phase }),
  startPlay: () => set({ phase: 'play' }),

  playMonth: (action) => {
    const s = get();
    if (s.phase !== 'play') return;
    const rulePick = s.picks[s.params.strategy.rule];
    const chosen = action ?? s.selected ?? rulePick;
    const auto = action === undefined && s.selected === null;
    const res = step(s.sim, chosen, s.params);
    const ev = res.event;
    const record: MonthRecord = { month: ev.month, action: ev.action, auto, rulePicks: s.picks, nature: ev.nature, kpis: ev.after };
    const done = res.state.company.month >= s.params.horizon;

    const toasts = [...s.toasts];
    const push = (t: Omit<Toast, 'id'>) => toasts.push({ ...t, id: toastId++ });
    if (ev.nature.shock !== 'none') push({ title: SHOCK_LABELS[ev.nature.shock], body: SHOCK_BLURB[ev.nature.shock], tone: 'bad' });
    if (ev.quit.length) push({ title: ev.quit.length === 1 ? 'A worker quit' : `${ev.quit.length} workers quit`, body: 'Satisfaction was too low for them.', tone: 'bad' });
    if (ev.hired.length) push({ title: 'New hire', body: 'Someone joined the team.', tone: 'good' });
    if (ev.action !== chosen) push({ title: `${ACTIONS[chosen].name} is maxed out`, body: 'The month was played with Hold steady.', tone: 'info' });

    if (s.sound) {
      if (ev.nature.shock !== 'none') sfx.bad();
      else if (ev.after.profit > 0) sfx.coin();
      else sfx.thud();
      if (done) sfx.fanfare();
    }
    try {
      if (ev.nature.shock !== 'none') navigator.vibrate?.([30, 40, 30]);
      else navigator.vibrate?.(12);
    } catch {
      /* haptics are optional */
    }

    set({
      sim: res.state,
      past: [...s.past, { sim: s.sim, params: s.params }].slice(-40),
      records: [...s.records, record],
      lastEvent: ev,
      eventSeq: s.eventSeq + 1,
      selected: null,
      toasts: toasts.slice(-3),
      phase: done ? 'end' : 'play',
      endOpen: true,
      auto: done ? false : s.auto,
      ...derive(res.state, s.params),
    });
  },

  undo: () => {
    const s = get();
    const prev = s.past[s.past.length - 1];
    if (!prev) return;
    set({
      sim: prev.sim,
      past: s.past.slice(0, -1),
      records: s.records.slice(0, -1),
      lastEvent: null,
      selected: null,
      phase: 'play',
      auto: false,
      ...derive(prev.sim, s.params),
    });
    get().toast({ title: 'Month undone', body: `Back to month ${prev.sim.company.month + 1}.`, tone: 'info' });
  },

  restart: (opts) => {
    const s = get();
    let params = opts?.params ?? s.params;
    if (opts?.newSeed) params = { ...params, seed: Math.floor(Math.random() * 9000) + 1000 };
    const sim = initState(params);
    set({
      backup: { params: s.params, sim: s.sim, past: s.past, records: s.records, phase: s.phase, lastEvent: s.lastEvent },
      params,
      sim,
      past: [],
      records: [],
      lastEvent: null,
      selected: null,
      selection: null,
      phase: s.phase === 'intro' || s.phase === 'onboarding' ? s.phase : 'play',
      endOpen: true,
      auto: s.demo,
      ...derive(sim, params),
    });
  },

  undoRestart: () => {
    const s = get();
    const b = s.backup;
    if (!b) return;
    set({ params: b.params, sim: b.sim, past: b.past, records: b.records, phase: b.phase, lastEvent: b.lastEvent, backup: null, selected: null, auto: false, endOpen: false, ...derive(b.sim, b.params) });
  },

  selectAction: (a) => {
    const s = get();
    set({ selected: s.selected === a ? null : a });
    if (s.sound) sfx.tick();
  },

  setStrategy: (patch) => {
    const s = get();
    const strategy: Strategy = { ...s.params.strategy, ...patch, preset: patch.preset ?? 'custom' };
    const params = { ...s.params, strategy };
    set({ params, selected: null, ...derive(s.sim, params) });
  },

  setWeight: (key, value) => {
    const s = get();
    const weights = { ...s.params.strategy.weights, [key]: Math.max(0, Math.min(1, value)) };
    if (weights.profit + weights.planet + weights.people <= 0) weights[key] = 0.01;
    get().setStrategy({ weights });
  },

  setProbability: (dim, index, value) => {
    const s = get();
    const next = setProb(s.params.probs[dim], index, value) as Triple;
    const params = { ...s.params, probs: { ...s.params.probs, [dim]: next } };
    set({ params, ...derive(s.sim, params) });
  },

  setShock: (key, value) => {
    const s = get();
    const params = { ...s.params, shocks: { ...s.params.shocks, [key]: Math.max(0, Math.min(0.15, value)) } };
    set({ params });
  },

  setTurnover: (patch) => {
    const s = get();
    const params = { ...s.params, workers: { ...s.params.workers, ...patch } };
    set({ params, ...derive(s.sim, params) });
  },

  loadPreset: (id) => {
    const s = get();
    const st = PRESETS[id].strategy;
    const params = { ...s.params, strategy: { ...st, weights: { ...st.weights } } };
    set({ params, selected: null, ...derive(s.sim, params) });
    get().toast({ title: `${PRESETS[id].name} loaded`, body: PRESETS[id].blurb, tone: 'info' });
  },

  setAuto: (auto) => set({ auto }),
  setTab: (tab) => set((s) => ({ tab, sheet: s.sheet === 'peek' ? 'half' : s.sheet })),
  setSheet: (sheet) => set({ sheet }),
  toggleSound: () => {
    const on = !get().sound;
    set({ sound: on });
    if (on) sfx.unlock();
  },
  select: (selection) => set({ selection }),
  toast: (t) => set((s) => ({ toasts: [...s.toasts, { ...t, id: toastId++ }].slice(-3) })),
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  setEndOpen: (endOpen) => set({ endOpen }),
  requestCompare: (a, b) => set((s) => ({ compareRequest: { a, b, nonce: (s.compareRequest?.nonce ?? 0) + 1 }, tab: 'simulate', sheet: s.sheet === 'peek' ? 'half' : s.sheet })),

  shareUrl: () => {
    const { params } = get();
    const base = `${window.location.origin}${window.location.pathname}`;
    return `${base}#r=${encodeParams(params)}`;
  },
}));

/** Probabilities as whole percentages that sum to exactly 100 (largest-remainder rounding). */
export function toPercents(p: readonly number[]): number[] {
  const n = normalizeProbs(p).map((v) => v * 100);
  const floor = n.map(Math.floor);
  let rest = 100 - floor.reduce((a, b) => a + b, 0);
  const order = n.map((v, i) => [v - Math.floor(v), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (rest <= 0) break;
    floor[i]++;
    rest--;
  }
  return floor;
}
