import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGame } from '../store/game';
import { CHIMNEY_TOP, clamp01, FACTORY_DOOR, PLAZA, rnd, vis } from './shared';

const tmp = new THREE.Object3D();
const col = new THREE.Color();
const SMOKE_CLEAN = new THREE.Color('#f4f4f1');
const SMOKE_DIRTY = new THREE.Color('#6f6a62');
const CLOUD_CLEAN = new THREE.Color('#ffffff');
const CLOUD_SMOG = new THREE.Color('#aaa192');
const CONFETTI = ['#5ee38b', '#067a4f', '#ffd166', '#ff9e8a', '#8ecdf2', '#ffffff'].map((c) => new THREE.Color(c));

/** Chimney smoke: the more CO2, the bigger and darker the puffs. Lives in island coordinates. */
export function Smoke() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const N = 16;
  const geometry = useMemo(() => new THREE.IcosahedronGeometry(1, 1), []);
  const material = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.82, depthWrite: false }), []);
  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    const level = clamp01(vis.co2 / 140);
    const density = 0.2 + Math.pow(level, 0.8) * 1.5;
    const speed = 0.11 + level * 0.1;
    const shown = vis.intro > 1.9 ? 1 : 0;
    for (let i = 0; i < N; i++) {
      const a = (vis.t * speed + i / N) % 1;
      const grow = Math.sin(Math.min(1, a * 1.15) * Math.PI * 0.85) * (0.16 + a * 0.52) * density * shown;
      tmp.position.set(CHIMNEY_TOP.x + Math.sin(a * 5 + i) * 0.35 * a + a * 1.1, CHIMNEY_TOP.y + a * (2.6 + level * 2.2), CHIMNEY_TOP.z + Math.cos(a * 4 + i * 2) * 0.3 * a);
      tmp.rotation.set(i, a * 2 + i, 0);
      tmp.scale.setScalar(Math.max(0.0001, grow));
      tmp.updateMatrix();
      m.setMatrixAt(i, tmp.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
    material.color.lerpColors(SMOKE_CLEAN, SMOKE_DIRTY, clamp01(level * 1.25));
    material.opacity = 0.55 + level * 0.35;
  });
  return <instancedMesh ref={ref} args={[geometry, material, N]} frustumCulled={false} renderOrder={2} />;
}

/** Sun and drifting clouds. Both fade towards smog as the Environment score drops. */
export function Sky() {
  const clouds = useRef<THREE.InstancedMesh>(null);
  const sun = useRef<THREE.Mesh>(null);
  const geometry = useMemo(() => new THREE.IcosahedronGeometry(1, 1), []);
  const cloudMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.92 }), []);
  const sunMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffd66b' }), []);
  const puffs = useMemo(() => {
    const out: { cloud: number; dx: number; dy: number; dz: number; s: number }[] = [];
    for (let c = 0; c < 6; c++) {
      out.push({ cloud: c, dx: 0, dy: 0, dz: 0, s: 1.25 });
      out.push({ cloud: c, dx: 1.3, dy: -0.15, dz: 0.2, s: 0.9 });
      out.push({ cloud: c, dx: -1.2, dy: -0.2, dz: -0.1, s: 0.8 });
    }
    return out;
  }, []);
  useFrame(() => {
    const m = clouds.current;
    const smog = 1 - vis.env;
    if (m) {
      puffs.forEach((p, i) => {
        const base = (p.cloud / 6) * Math.PI * 2 + (vis.reduced ? 0 : vis.t * 0.012 * (1 + (p.cloud % 3) * 0.3));
        const radius = 10.5 + (p.cloud % 3) * 2.6;
        // smog pulls the clouds down and makes them swell
        const lower = clamp01((smog - 0.45) * 2);
        // the island floats above the clouds, so they never hide it
        const y = -3.4 - (p.cloud % 2) * 1.7;
        const s = p.s * (1 + lower * 0.5) * (vis.intro > 0.4 ? 1 : 0);
        tmp.position.set(Math.cos(base) * radius + p.dx, y + p.dy, Math.sin(base) * radius + p.dz);
        tmp.rotation.set(0, 0, 0);
        tmp.scale.set(s * 1.35, s * 0.8, s);
        tmp.updateMatrix();
        m.setMatrixAt(i, tmp.matrix);
      });
      m.instanceMatrix.needsUpdate = true;
      cloudMat.color.lerpColors(CLOUD_CLEAN, CLOUD_SMOG, clamp01((smog - 0.3) * 1.6));
    }
    if (sun.current) {
      const k = clamp01(vis.env * 1.4);
      sun.current.scale.setScalar(0.6 + k * 0.6);
      sunMat.color.set('#d9bf95').lerp(col.set('#ffd66b'), k);
    }
  });
  return (
    <>
      <instancedMesh ref={clouds} args={[geometry, cloudMat, puffs.length]} frustumCulled={false} />
      <mesh ref={sun} position={[-15, 13, -17]} material={sunMat}>
        <sphereGeometry args={[1.7, 20, 16]} />
      </mesh>
    </>
  );
}

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  max: number;
  spin: number;
}

/** Coins fly out of the factory on a profitable month; confetti falls on milestones. Island coordinates. */
export function Bursts() {
  const coins = useRef<THREE.InstancedMesh>(null);
  const confetti = useRef<THREE.InstancedMesh>(null);
  const NC = 14;
  const NF = 56;
  const coinGeo = useMemo(() => new THREE.CylinderGeometry(0.14, 0.14, 0.045, 14).rotateX(Math.PI / 2), []);
  const coinMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffcf4d' }), []);
  const confGeo = useMemo(() => new THREE.PlaneGeometry(0.16, 0.1), []);
  const confMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide }), []);
  const coinP = useRef<Particle[]>(Array.from({ length: NC }, () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, spin: 0 })));
  const confP = useRef<Particle[]>(Array.from({ length: NF }, () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, spin: 0 })));
  const seen = useRef(useGame.getState().eventSeq);

  useLayoutEffect(() => {
    const m = confetti.current;
    if (!m) return;
    for (let i = 0; i < NF; i++) m.setColorAt(i, CONFETTI[i % CONFETTI.length]);
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, []);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const st = useGame.getState();
    if (st.eventSeq !== seen.current) {
      seen.current = st.eventSeq;
      const ev = st.lastEvent;
      if (ev && !vis.reduced) {
        if (ev.after.profit > 0) {
          const n = Math.max(3, Math.min(NC, Math.round(ev.after.profit * 1.2)));
          for (let i = 0; i < n; i++) {
            const p = coinP.current[i];
            p.x = FACTORY_DOOR.x - 0.6 + Math.random() * 0.5;
            p.y = 1.4;
            p.z = FACTORY_DOOR.z - 0.4;
            p.vx = 0.4 + Math.random() * 1.6;
            p.vy = 3.6 + Math.random() * 1.8;
            p.vz = 0.4 + Math.random() * 1.4;
            p.max = 0.9 + Math.random() * 0.4;
            p.life = p.max + i * 0.05;
            p.spin = Math.random() * 6;
          }
        }
        const month = ev.month + 1;
        if (month % 12 === 0 || month >= st.params.horizon) {
          confP.current.forEach((p, i) => {
            const ang = rnd(i, month) * Math.PI * 2;
            p.x = PLAZA.x;
            p.y = 2.2;
            p.z = PLAZA.z;
            p.vx = Math.cos(ang) * (1 + rnd(i, 7) * 3.2);
            p.vz = Math.sin(ang) * (1 + rnd(i, 8) * 3.2);
            p.vy = 4 + rnd(i, 9) * 4.5;
            p.max = 1.8 + rnd(i, 10) * 1.2;
            p.life = p.max;
            p.spin = rnd(i, 11) * 6;
          });
        }
      }
    }

    const update = (mesh: THREE.InstancedMesh | null, list: Particle[], gravity: number, drag: number, flutter: boolean) => {
      if (!mesh) return;
      list.forEach((p, i) => {
        let s = 0;
        if (p.life > 0) {
          p.life -= dt;
          if (p.life <= p.max) {
            p.vy -= gravity * dt;
            p.vx *= 1 - drag * dt;
            p.vz *= 1 - drag * dt;
            if (flutter && p.vy < -1.6) p.vy = -1.6;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.z += p.vz * dt;
            s = Math.min(1, p.life * 3.5) * (p.y < 0.05 ? 0 : 1);
          }
        }
        tmp.position.set(p.x, p.y, p.z);
        tmp.rotation.set(flutter ? p.spin + p.life * 7 : 0, p.spin + p.life * (flutter ? 5 : 9), flutter ? p.life * 4 : 0);
        tmp.scale.setScalar(Math.max(0.0001, s));
        tmp.updateMatrix();
        mesh.setMatrixAt(i, tmp.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    };
    update(coins.current, coinP.current, 9.5, 0.4, false);
    update(confetti.current, confP.current, 7, 1.1, true);
  });

  return (
    <>
      <instancedMesh ref={coins} args={[coinGeo, coinMat, NC]} frustumCulled={false} />
      <instancedMesh ref={confetti} args={[confGeo, confMat, NF]} frustumCulled={false} />
    </>
  );
}
