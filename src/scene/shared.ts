import * as THREE from 'three';

/**
 * Smoothed values shared by every scene component. Updated once per frame by <Driver/>.
 * A plain mutable object: reading it in useFrame costs nothing and never re-renders React.
 */
export const vis = {
  /** Seconds since the scene started. */
  t: 0,
  /** Seconds into the intro sequence (99 = intro finished, everything is in place). */
  intro: 99,
  /** 0..1 smoothed KPIs. */
  env: 0.5,
  productivity: 0.5,
  customer: 0.5,
  /** CO2 in kt / month, smoothed. */
  co2: 60,
  fossil: 6,
  green: 1,
  reduced: false,
};

export const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
export const damp = (a: number, b: number, lambda: number, dt: number): number => a + (b - a) * (1 - Math.exp(-lambda * dt));

export function easeOutBack(x: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

/** 0 -> 1 with a little overshoot, starting `t` seconds ago. */
export function pop(t: number, dur = 0.55): number {
  if (t <= 0) return 0;
  if (t >= dur) return 1;
  return easeOutBack(t / dur);
}

/** Scale of something that appears at `t0` seconds into the intro. */
export const introPop = (t0: number, dur = 0.55): number => pop(vis.intro - t0, dur);

/* ---------- toon shading ---------- */

const gradientMap = (() => {
  const tex = new THREE.DataTexture(new Uint8Array([120, 185, 230, 255]), 4, 1, THREE.RedFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
})();

export function toon(color: string): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({ color, gradientMap });
}

/** Pastel versions of the deck palette, plus warm accents. */
export const MAT = {
  grass: toon('#a9e8b8'),
  grassDark: toon('#86d79d'),
  path: toon('#eef5e4'),
  rock: toon('#d9cbb3'),
  rockDark: toon('#bfae95'),
  wall: toon('#fff3dd'),
  roof: toon('#f4a78c'),
  chimney: toon('#f1e9dc'),
  stripe: toon('#ef6f60'),
  dark: toon('#1b3d2d'),
  white: toon('#ffffff'),
  glass: toon('#bfefd0'),
  bright: toon('#5ee38b'),
  panel: toon('#4f76ad'),
  tank: toon('#c9dbea'),
  trunk: toon('#a9805b'),
  wheel: toon('#33423a'),
  instanced: toon('#ffffff'), // colour comes from instanceColor
  moodHappy: toon('#2fbf71'),
  moodNeutral: toon('#f0b23e'),
  moodStressed: toon('#e5484d'),
  eye: new THREE.MeshBasicMaterial({ color: '#1a2a22' }),
  blob: new THREE.MeshBasicMaterial({ color: '#10291d', transparent: true, opacity: 0.16, depthWrite: false }),
  hit: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
};

export const SKIN = ['#ffd9b8', '#f1c29b', '#d9a27a', '#b97e5a', '#8d5a3c'].map((c) => new THREE.Color(c));
export const CLOTH = ['#ff9e8a', '#ffd166', '#8ecdf2', '#c8a8f0', '#7fe0a0', '#f7a8c8', '#ffb37a'].map((c) => new THREE.Color(c));
export const HAIR = ['#3b2a20', '#5a3d2b', '#1f1f24', '#8a5a34', '#c98f4f'].map((c) => new THREE.Color(c));
export const HARD_HAT = new THREE.Color('#ffd84d');

/** Where the top of the chimney is, in island coordinates (smoke starts here). */
export const CHIMNEY_TOP = new THREE.Vector3(-3.8, 3.35, -2.6);
/** Centre of the little roundabout where the owner stands. */
export const PLAZA = new THREE.Vector3(0, 0, 0.2);
export const FACTORY_DOOR = new THREE.Vector3(-1.7, 0, -0.5);

/** Deterministic pseudo-random in [0, 1) for visual variety (not part of the model). */
export function rnd(i: number, salt = 0): number {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}
