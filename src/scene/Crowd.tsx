import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { moodOf, workerSatisfaction } from '../sim';
import { useGame } from '../store/game';
import { CLOTH, easeOutBack, FACTORY_DOOR, HAIR, HARD_HAT, MAT, PLAZA, rnd, SKIN, vis } from './shared';

/**
 * Every chibi character (workers, queueing customers, the owner) is drawn with a
 * handful of instanced meshes: body, head, cap, eyes, a ground shadow and a mood shape.
 * That is about 8 draw calls for up to 30 characters.
 */
const MAX = 30;

type Kind = 'worker' | 'customer' | 'ceo';
type Mode = 'idle' | 'walk' | 'work' | 'leave';

interface Agent {
  key: string;
  kind: Kind;
  id: number;
  x: number;
  z: number;
  tx: number;
  tz: number;
  yaw: number;
  mode: Mode;
  timer: number;
  phase: number;
  /** vis.t at which the character pops in. */
  born: number;
  /** vis.t at which it started to vanish (-1 = alive). */
  dying: number;
  skin: THREE.Color;
  cloth: THREE.Color;
  cap: THREE.Color;
  mood: 0 | 1 | 2 | -1;
  size: number;
}

const WAYPOINTS: [number, number][] = [
  [-1.7, -0.6], [-3.3, -0.6], [-3.4, 1.4], [1.5, -1.2], [2.3, 2.8], [4.2, 2.7], [-1.6, 3.2], [0.6, 4.4],
  [-4.2, 3.4], [4.8, 1.4], [0.3, -4.3], [-0.6, -2.9], [3.6, -0.4], [-2.4, 2.4], [1.4, 2.9],
];
const WORK_SPOTS: [number, number][] = [[-3.7, -0.62], [-3.0, -0.62], [-2.3, -0.62], [-4.3, 0.2], [-3.4, 3.4], [2.0, 2.95], [3.0, 2.95], [4.0, 2.95], [3.7, -1.3]];
const QUEUE: [number, number][] = [0, 1, 2, 3, 4, 5].map((i) => [2.9 + Math.sin(i * 0.9) * 0.12, -1.25 + i * 0.6]);

const mChar = new THREE.Matrix4();
const mPart = new THREE.Matrix4();
const mOut = new THREE.Matrix4();
const pos = new THREE.Vector3();
const quat = new THREE.Quaternion();
const scl = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const DARK_SUIT = new THREE.Color('#1b3d2d');

function part(mesh: THREE.InstancedMesh, i: number, x: number, y: number, z: number, sx: number, sy: number, sz: number): void {
  mPart.makeScale(sx, sy, sz).setPosition(x, y, z);
  mOut.multiplyMatrices(mChar, mPart);
  mesh.setMatrixAt(i, mOut);
}

export function Crowd() {
  const body = useRef<THREE.InstancedMesh>(null);
  const head = useRef<THREE.InstancedMesh>(null);
  const cap = useRef<THREE.InstancedMesh>(null);
  const eyes = useRef<THREE.InstancedMesh>(null);
  const blob = useRef<THREE.InstancedMesh>(null);
  const hit = useRef<THREE.InstancedMesh>(null);
  const moodA = useRef<THREE.InstancedMesh>(null);
  const moodB = useRef<THREE.InstancedMesh>(null);
  const moodC = useRef<THREE.InstancedMesh>(null);
  const hat = useRef<THREE.Group>(null);

  const agents = useRef(new Map<string, Agent>());
  const order = useRef<Agent[]>([]);
  const react = useRef({ seq: 0, t0: -10, good: true });

  const geo = useMemo(
    () => ({
      body: new THREE.CapsuleGeometry(0.17, 0.16, 5, 12),
      head: new THREE.SphereGeometry(0.27, 18, 14),
      cap: new THREE.SphereGeometry(0.29, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(-0.25),
      eye: new THREE.SphereGeometry(0.036, 8, 6),
      blob: new THREE.CircleGeometry(0.27, 18).rotateX(-Math.PI / 2),
      hit: new THREE.SphereGeometry(0.62, 8, 6),
      moodHappy: new THREE.SphereGeometry(0.095, 12, 10),
      moodNeutral: new THREE.BoxGeometry(0.15, 0.15, 0.15),
      moodStressed: new THREE.ConeGeometry(0.11, 0.19, 4).rotateX(Math.PI),
      brim: new THREE.CylinderGeometry(0.31, 0.31, 0.04, 20),
      crown: new THREE.CylinderGeometry(0.19, 0.21, 0.3, 20),
      band: new THREE.CylinderGeometry(0.215, 0.215, 0.07, 20),
    }),
    [],
  );

  useLayoutEffect(() => {
    // Create the per-instance colour buffers before the first render.
    for (const m of [body.current, head.current, cap.current]) m?.setColorAt(0, new THREE.Color('#ffffff'));
    // Characters move, so give the hit mesh a bounding sphere that always contains the island.
    if (hit.current) hit.current.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 40);
  }, []);

  const spawn = (key: string, kind: Kind, id: number, x: number, z: number, born: number): Agent => {
    const seed = kind === 'worker' ? id : id + 100;
    const a: Agent = {
      key,
      kind,
      id,
      x,
      z,
      tx: x,
      tz: z,
      yaw: rnd(seed, 3) * 6.28,
      mode: 'idle',
      timer: rnd(seed, 4) * 2,
      phase: rnd(seed, 5) * 10,
      born,
      dying: -1,
      skin: SKIN[Math.floor(rnd(seed, 6) * SKIN.length)],
      cloth: kind === 'ceo' ? DARK_SUIT : CLOTH[Math.floor(rnd(seed, 7) * CLOTH.length)],
      cap: kind === 'worker' ? HARD_HAT : HAIR[Math.floor(rnd(seed, 8) * HAIR.length)],
      mood: -1,
      size: kind === 'ceo' ? 1.28 : 0.92 + rnd(seed, 9) * 0.16,
    };
    agents.current.set(key, a);
    return a;
  };

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const B = body.current;
    const H = head.current;
    const C = cap.current;
    const E = eyes.current;
    const S = blob.current;
    const X = hit.current;
    const MA = moodA.current;
    const MB = moodB.current;
    const MC = moodC.current;
    if (!B || !H || !C || !E || !S || !X || !MA || !MB || !MC) return;

    const st = useGame.getState();
    const company = st.sim.company;
    const map = agents.current;
    const inIntro = vis.intro < 90;
    const now = vis.t;

    // --- owner
    if (!map.has('ceo')) spawn('ceo', 'ceo', 0, PLAZA.x, PLAZA.z, inIntro ? now + 2.6 : now);
    if (st.eventSeq !== react.current.seq) {
      react.current.seq = st.eventSeq;
      const ev = st.lastEvent;
      if (ev) {
        react.current.t0 = now;
        react.current.good = ev.after.profit >= 0 && ev.nature.shock === 'none';
      }
    }

    // --- workers follow the simulation: new hires walk out of the factory, leavers walk off the island
    const alive = new Set<string>();
    let wi = 0;
    for (const w of st.sim.workers) {
      const key = `w${w.id}`;
      let a = map.get(key);
      if (w.active) {
        alive.add(key);
        if (!a) {
          if (inIntro) {
            const p = WAYPOINTS[w.id % WAYPOINTS.length];
            a = spawn(key, 'worker', w.id, p[0] + (rnd(w.id, 11) - 0.5), p[1] + (rnd(w.id, 12) - 0.5), now + Math.max(0, 2.9 - vis.intro) + wi * 0.11);
          } else {
            a = spawn(key, 'worker', w.id, FACTORY_DOOR.x + (rnd(w.id, 11) - 0.5) * 0.6, FACTORY_DOOR.z + rnd(w.id, 12) * 0.4, now);
          }
        } else if (a.dying >= 0 || a.mode === 'leave') {
          // undo brought this worker back
          a.dying = -1;
          a.mode = 'idle';
          a.born = now;
          a.x = FACTORY_DOOR.x;
          a.z = FACTORY_DOOR.z;
        }
        const mood = moodOf(workerSatisfaction(w, company));
        a.mood = mood === 'happy' ? 0 : mood === 'neutral' ? 1 : 2;
        wi++;
      }
    }
    for (const a of map.values()) {
      if (a.kind === 'worker' && !alive.has(a.key) && a.mode !== 'leave' && a.dying < 0) {
        a.mode = 'leave';
        const r = Math.hypot(a.x, a.z) || 1;
        a.tx = (a.x / r) * 7.5;
        a.tz = (a.z / r) * 7.5;
      }
    }

    // --- customers: the queue is as long as customers are satisfied
    const queueLen = Math.round(vis.customer * 6);
    for (let i = 0; i < QUEUE.length; i++) {
      const key = `c${i}`;
      const a = map.get(key);
      if (i < queueLen) {
        if (!a) spawn(key, 'customer', i, QUEUE[i][0], QUEUE[i][1], inIntro ? now + Math.max(0, 3.3 - vis.intro) + i * 0.1 : now);
        else if (a.dying >= 0) {
          a.dying = -1;
          a.born = now;
        }
      } else if (a && a.dying < 0) a.dying = now;
    }

    // --- simulate and draw
    const speed = (0.55 + vis.productivity * 1.5) * (vis.reduced ? 0.6 : 1);
    let n = 0;
    order.current.length = 0;
    for (const a of map.values()) {
      if (a.dying >= 0 && now - a.dying > 0.5) {
        map.delete(a.key);
        continue;
      }
      if (n >= MAX) break;
      a.phase += dt;

      let bob = 0;
      let squash = 1;
      let lean = 0;
      if (a.kind === 'worker') {
        if (a.mode === 'walk' || a.mode === 'leave') {
          const dx = a.tx - a.x;
          const dz = a.tz - a.z;
          const d = Math.hypot(dx, dz);
          const v = (a.mode === 'leave' ? 2.3 : speed) * dt;
          if (d <= v) {
            a.x = a.tx;
            a.z = a.tz;
            if (a.mode === 'leave') a.dying = now;
            else {
              a.mode = a.timer < 0 ? 'work' : 'idle';
              a.timer = a.mode === 'work' ? 2.5 + Math.random() * 3.5 : 0.8 + Math.random() * 1.6;
            }
          } else {
            a.x += (dx / d) * v;
            a.z += (dz / d) * v;
            const target = Math.atan2(dx, dz);
            let diff = target - a.yaw;
            diff = Math.atan2(Math.sin(diff), Math.cos(diff));
            a.yaw += diff * Math.min(1, dt * 10);
          }
          const stride = a.phase * (6 + speed * 5);
          bob = Math.abs(Math.sin(stride)) * 0.075;
          squash = 1 + Math.sin(stride * 2) * 0.05;
          lean = 0.12;
        } else {
          a.timer -= dt;
          if (a.mode === 'work') {
            // hammering away: quick squash and stretch
            squash = 1 + Math.sin(a.phase * (7 + vis.productivity * 7)) * 0.085;
            lean = 0.2;
          } else {
            squash = 1 + Math.sin(a.phase * 2.2) * 0.025;
          }
          if (a.timer <= 0) {
            const toWork = Math.random() < 0.6;
            const list = toWork ? WORK_SPOTS : WAYPOINTS;
            const p = list[Math.floor(Math.random() * list.length)];
            a.tx = p[0] + (Math.random() - 0.5) * 0.5;
            a.tz = p[1] + (Math.random() - 0.5) * 0.4;
            a.mode = 'walk';
            a.timer = toWork ? -1 : 1; // sign remembers what to do on arrival
          }
        }
      } else if (a.kind === 'customer') {
        squash = 1 + Math.sin(a.phase * 2 + a.id) * 0.03;
        a.yaw = Math.PI + Math.sin(a.phase * 0.7 + a.id * 2) * 0.35; // looking at the office, glancing around
      } else {
        // the owner reacts to every decision
        const tau = now - react.current.t0;
        a.yaw = 0.35 + Math.sin(a.phase * 0.5) * 0.25;
        squash = 1 + Math.sin(a.phase * 1.8) * 0.02;
        if (tau >= 0 && tau < 1.3 && !vis.reduced) {
          const fade = 1 - tau / 1.3;
          if (react.current.good) {
            bob = Math.abs(Math.sin(tau * 9.5)) * 0.42 * fade;
            a.yaw += tau < 0.66 ? (tau / 0.66) * Math.PI * 2 : 0;
            squash = 1 + Math.sin(tau * 19) * 0.12 * fade;
          } else {
            a.yaw += Math.sin(tau * 26) * 0.45 * fade;
            squash = 1 - 0.16 * fade;
          }
        }
      }

      // pop in / out with squash and stretch
      let s = a.size;
      let rise = 0;
      const age = now - a.born;
      if (age <= 0) s = 0;
      else if (age < 0.6 && !vis.reduced) {
        const k = age / 0.6;
        s *= easeOutBack(k);
        squash *= 1 + Math.sin(k * Math.PI) * 0.32;
      }
      if (a.dying >= 0) {
        const k = Math.min(1, (now - a.dying) / 0.5);
        s *= 1 - k;
        rise = k * 1.3;
      }

      const baseY = a.kind === 'ceo' ? 0.43 : 0;
      const wide = s / Math.sqrt(Math.max(0.4, squash));
      pos.set(a.x, baseY + bob + rise, a.z);
      quat.setFromAxisAngle(UP, a.yaw);
      scl.set(wide, s * squash, wide);
      mChar.compose(pos, quat, scl);
      if (lean) {
        mPart.makeRotationX(lean);
        mChar.multiply(mPart);
      }

      part(B, n, 0, 0.27, 0, 1, 1, 1);
      part(H, n, 0, 0.72, 0, 1, 1, 1);
      part(C, n, 0, 0.745, 0, 1.05, 1.05, 1.05);
      const blink = Math.sin(a.phase * 0.9 + a.id * 3) > 0.985 ? 0.15 : 1;
      part(E, n * 2, -0.1, 0.735, 0.245, 1, 1.3 * blink, 0.6);
      part(E, n * 2 + 1, 0.1, 0.735, 0.245, 1, 1.3 * blink, 0.6);
      B.setColorAt(n, a.cloth);
      H.setColorAt(n, a.skin);
      C.setColorAt(n, a.cap);

      // shadow, hit area and mood shape ignore squash and lean
      pos.set(a.x, baseY + 0.022, a.z);
      scl.set(s, s, s);
      mOut.compose(pos, quat, scl);
      S.setMatrixAt(n, mOut);
      pos.set(a.x, baseY + 0.55 * s, a.z);
      mOut.compose(pos, quat, scl);
      X.setMatrixAt(n, mOut);
      const my = baseY + bob + (1.3 + (vis.reduced ? 0 : Math.sin(a.phase * 3) * 0.035)) * s;
      pos.set(a.x, my, a.z);
      quat.setFromAxisAngle(UP, a.phase * 1.4);
      mOut.compose(pos, quat, scl);
      MA.setMatrixAt(n, a.mood === 0 ? mOut : ZERO);
      MB.setMatrixAt(n, a.mood === 1 ? mOut : ZERO);
      MC.setMatrixAt(n, a.mood === 2 ? mOut : ZERO);

      if (a.kind === 'ceo' && hat.current) {
        hat.current.matrix.copy(mChar);
        hat.current.matrixWorldNeedsUpdate = true;
      }
      order.current.push(a);
      n++;
    }

    for (const m of [B, H, C, S, X, MA, MB, MC]) {
      m.count = n;
      m.instanceMatrix.needsUpdate = true;
    }
    E.count = n * 2;
    E.instanceMatrix.needsUpdate = true;
    for (const m of [B, H, C]) if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });

  const onTap = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > 8 || e.instanceId === undefined) return;
    const a = order.current[e.instanceId];
    if (!a) return;
    const select = useGame.getState().select;
    if (a.kind === 'worker') select({ kind: 'worker', id: a.id });
    else if (a.kind === 'customer') select({ kind: 'customers' });
    else select({ kind: 'ceo' });
    try {
      navigator.vibrate?.(8);
    } catch {
      /* optional */
    }
  };

  return (
    <group>
      <instancedMesh ref={body} args={[geo.body, MAT.instanced, MAX]} castShadow frustumCulled={false} />
      <instancedMesh ref={head} args={[geo.head, MAT.instanced, MAX]} castShadow frustumCulled={false} />
      <instancedMesh ref={cap} args={[geo.cap, MAT.instanced, MAX]} frustumCulled={false} />
      <instancedMesh ref={eyes} args={[geo.eye, MAT.eye, MAX * 2]} frustumCulled={false} />
      <instancedMesh ref={blob} args={[geo.blob, MAT.blob, MAX]} frustumCulled={false} renderOrder={1} />
      <instancedMesh ref={moodA} args={[geo.moodHappy, MAT.moodHappy, MAX]} frustumCulled={false} />
      <instancedMesh ref={moodB} args={[geo.moodNeutral, MAT.moodNeutral, MAX]} frustumCulled={false} />
      <instancedMesh ref={moodC} args={[geo.moodStressed, MAT.moodStressed, MAX]} frustumCulled={false} />
      <instancedMesh
        ref={hit}
        args={[geo.hit, MAT.hit, MAX]}
        frustumCulled={false}
        onClick={onTap}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          document.body.style.cursor = '';
        }}
      />
      {/* the owner's top hat follows the owner's body matrix */}
      <group ref={hat} matrixAutoUpdate={false}>
        <mesh geometry={geo.brim} material={MAT.dark} position={[0, 0.955, 0]} />
        <mesh geometry={geo.crown} material={MAT.dark} position={[0, 1.12, 0]} />
        <mesh geometry={geo.band} material={MAT.bright} position={[0, 1.01, 0]} />
      </group>
    </group>
  );
}
