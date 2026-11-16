import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { useGame, type SelectionKind } from '../store/game';
import { clamp01, damp, introPop, MAT, PLAZA, rnd, vis } from './shared';

const tmp = new THREE.Object3D();
const col = new THREE.Color();
const WITHERED = new THREE.Color('#b99c6b');
const HEALTHY = new THREE.Color('#58c783');

/** Props that make a mesh or group tappable and open its info card. */
function tappable(kind: SelectionKind) {
  return {
    onClick: (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      if (e.delta > 8) return; // it was a drag, not a tap
      useGame.getState().select({ kind });
    },
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      document.body.style.cursor = 'pointer';
    },
    onPointerOut: () => {
      document.body.style.cursor = '';
    },
  };
}

/** A fixed set of copies of one geometry, drawn in a single draw call. */
function StaticInstances({ geometry, material, items }: { geometry: THREE.BufferGeometry; material: THREE.Material; items: { p: [number, number, number]; r?: [number, number, number]; s?: number }[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current!;
    items.forEach((it, i) => {
      tmp.position.set(...it.p);
      tmp.rotation.set(...(it.r ?? [0, 0, 0]));
      tmp.scale.setScalar(it.s ?? 1);
      tmp.updateMatrix();
      m.setMatrixAt(i, tmp.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  }, [items]);
  return <instancedMesh ref={ref} args={[geometry, material, items.length]} castShadow />;
}

/* ------------------------------------------------------------------ */

function Island() {
  const geo = useMemo(
    () => ({
      top: new THREE.CylinderGeometry(7.2, 7.0, 0.5, 44),
      mid: new THREE.CylinderGeometry(7.0, 5.0, 1.5, 44),
      bottom: new THREE.ConeGeometry(5.0, 4.4, 44),
      plaza: new THREE.CylinderGeometry(2.4, 2.4, 0.04, 40),
      centre: new THREE.CylinderGeometry(1.05, 1.05, 0.08, 32),
      podium: new THREE.CylinderGeometry(0.6, 0.72, 0.36, 24),
      podiumTop: new THREE.CylinderGeometry(0.54, 0.54, 0.05, 24),
      pebble: new THREE.DodecahedronGeometry(0.5, 0),
    }),
    [],
  );
  const pebbles = useMemo(
    () => [
      { p: [-5.2, -3.4, 3.4] as [number, number, number], s: 1.1 },
      { p: [5.6, -2.6, -2.2] as [number, number, number], s: 0.8 },
      { p: [1.2, -4.4, 5.0] as [number, number, number], s: 0.55 },
    ],
    [],
  );
  return (
    <group>
      <mesh geometry={geo.top} material={MAT.grass} position={[0, -0.25, 0]} receiveShadow />
      <mesh geometry={geo.mid} material={MAT.rock} position={[0, -1.25, 0]} />
      <mesh geometry={geo.bottom} material={MAT.rockDark} position={[0, -4.2, 0]} rotation={[Math.PI, 0, 0]} />
      <mesh geometry={geo.plaza} material={MAT.path} position={[PLAZA.x, 0.012, PLAZA.z]} receiveShadow />
      <mesh geometry={geo.centre} material={MAT.grassDark} position={[PLAZA.x, 0.04, PLAZA.z]} receiveShadow />
      <group {...tappable('ceo')}>
        <mesh geometry={geo.podium} material={MAT.dark} position={[PLAZA.x, 0.22, PLAZA.z]} castShadow />
        <mesh geometry={geo.podiumTop} material={MAT.bright} position={[PLAZA.x, 0.41, PLAZA.z]} />
      </group>
      <StaticInstances geometry={geo.pebble} material={MAT.rock} items={pebbles} />
    </group>
  );
}

/* ------------------------------------------------------------------ */

function Factory() {
  const group = useRef<THREE.Group>(null);
  const geo = useMemo(() => {
    const prism = new THREE.CylinderGeometry(0.62, 0.62, 2.2, 3);
    prism.rotateY(Math.PI);
    prism.rotateX(Math.PI / 2);
    const roofs = [-1.07, 0, 1.07].map((x) => prism.clone().translate(x, 2.01, 0));
    return {
      hall: new THREE.BoxGeometry(3.2, 1.7, 2.2),
      roof: mergeGeometries(roofs)!,
      chimney: new THREE.CylinderGeometry(0.25, 0.34, 3.3, 14),
      stripe: mergeGeometries([new THREE.CylinderGeometry(0.285, 0.3, 0.3, 14).translate(0, 2.6, 0), new THREE.CylinderGeometry(0.3, 0.3, 0.12, 14).translate(0, 3.3, 0)])!,
      door: new THREE.BoxGeometry(0.62, 0.95, 0.08),
      windows: mergeGeometries([new THREE.BoxGeometry(0.62, 0.42, 0.08).translate(-0.95, 1.05, 1.1), new THREE.BoxGeometry(0.62, 0.42, 0.08).translate(-0.15, 1.05, 1.1)])!,
    };
  }, []);
  useFrame(() => {
    if (group.current) group.current.scale.setScalar(introPop(1.2));
  });
  return (
    <group ref={group} position={[-2.6, 0, -2.0]} {...tappable('factory')}>
      <mesh geometry={geo.hall} material={MAT.wall} position={[0, 0.85, 0]} castShadow receiveShadow />
      <mesh geometry={geo.roof} material={MAT.roof} castShadow />
      <mesh geometry={geo.chimney} material={MAT.chimney} position={[-1.2, 1.65, -0.6]} castShadow />
      <mesh geometry={geo.stripe} material={MAT.stripe} position={[-1.2, 0, -0.6]} />
      <mesh geometry={geo.door} material={MAT.dark} position={[0.95, 0.475, 1.1]} />
      <mesh geometry={geo.windows} material={MAT.glass} />
    </group>
  );
}

/** Gas storage tanks: one more pops up each time gas capacity grows. */
function Tanks() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => new THREE.CapsuleGeometry(0.34, 0.5, 6, 14), []);
  const scales = useRef<number[]>(new Array(10).fill(0));
  const slots = useMemo(() => {
    const out: [number, number][] = [];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) out.push([-5.05 + c * 0.82 + (r % 2) * 0.2, 0.55 + r * 0.82]);
    return out.filter(([x, z]) => Math.hypot(x, z) < 6.5).slice(0, 10);
  }, []);
  useFrame((_, dt) => {
    const m = ref.current;
    if (!m) return;
    const shown = Math.max(0, Math.min(slots.length, Math.round(vis.fossil) - 5));
    const intro = introPop(2.0);
    for (let i = 0; i < slots.length; i++) {
      scales.current[i] = damp(scales.current[i], i < shown ? 1 : 0, 9, dt);
      const s = scales.current[i] * intro;
      tmp.position.set(slots[i][0], 0.58 * s, slots[i][1]);
      tmp.rotation.set(0, 0, 0);
      tmp.scale.set(s, s, s);
      tmp.updateMatrix();
      m.setMatrixAt(i, tmp.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[geometry, MAT.tank, slots.length]} castShadow frustumCulled={false} {...tappable('tanks')} />;
}

function Office() {
  const group = useRef<THREE.Group>(null);
  const geo = useMemo(() => {
    const wins: THREE.BufferGeometry[] = [];
    for (const y of [1.25, 1.95]) for (const x of [-0.68, 0, 0.68]) wins.push(new THREE.BoxGeometry(0.44, 0.44, 0.08).translate(x, y, 0.95));
    return {
      body: new THREE.BoxGeometry(2.2, 2.6, 1.9),
      roof: new THREE.BoxGeometry(2.42, 0.2, 2.1),
      windows: mergeGeometries(wins)!,
      door: new THREE.BoxGeometry(0.56, 0.84, 0.08),
      mast: mergeGeometries([new THREE.CylinderGeometry(0.03, 0.03, 0.7, 6).translate(0.7, 3.15, -0.5), new THREE.SphereGeometry(0.1, 10, 8).translate(0.7, 3.55, -0.5)])!,
    };
  }, []);
  useFrame(() => {
    if (group.current) group.current.scale.setScalar(introPop(1.5));
  });
  return (
    <group ref={group} position={[2.9, 0, -2.5]} {...tappable('office')}>
      <mesh geometry={geo.body} material={MAT.white} position={[0, 1.3, 0]} castShadow receiveShadow />
      <mesh geometry={geo.roof} material={MAT.dark} position={[0, 2.7, 0]} castShadow />
      <mesh geometry={geo.windows} material={MAT.glass} />
      <mesh geometry={geo.door} material={MAT.dark} position={[0, 0.42, 0.95]} />
      <mesh geometry={geo.mast} material={MAT.bright} />
    </group>
  );
}

/** Solar panels appear one by one as green capacity grows. */
function Solar() {
  const panels = useRef<THREE.InstancedMesh>(null);
  const frames = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(
    () => ({
      panel: new THREE.BoxGeometry(0.78, 0.05, 0.5),
      frame: mergeGeometries([new THREE.BoxGeometry(0.86, 0.04, 0.58).translate(0, -0.035, 0), new THREE.CylinderGeometry(0.035, 0.035, 0.4, 6).translate(0, -0.22, 0.1)])!,
    }),
    [],
  );
  const scales = useRef<number[]>(new Array(10).fill(0));
  const slots = useMemo(() => {
    const out: [number, number][] = [];
    for (let r = 0; r < 2; r++) for (let c = 0; c < 5; c++) out.push([1.7 + c * 0.98 - r * 0.45, 3.5 + r * 0.95]);
    return out;
  }, []);
  useFrame((_, dt) => {
    const a = panels.current;
    const b = frames.current;
    if (!a || !b) return;
    const shown = Math.max(0, Math.min(10, Math.round(vis.green)));
    const intro = introPop(2.1);
    for (let i = 0; i < 10; i++) {
      scales.current[i] = damp(scales.current[i], i < shown ? 1 : 0, 9, dt);
      const s = scales.current[i] * intro;
      tmp.position.set(slots[i][0], 0.42 * s, slots[i][1]);
      tmp.rotation.set(-0.55, 0, 0);
      tmp.scale.set(s, s, s);
      tmp.updateMatrix();
      a.setMatrixAt(i, tmp.matrix);
      b.setMatrixAt(i, tmp.matrix);
    }
    a.instanceMatrix.needsUpdate = true;
    b.instanceMatrix.needsUpdate = true;
  });
  return (
    <group {...tappable('solar')}>
      <instancedMesh ref={panels} args={[geo.panel, MAT.panel, 10]} castShadow frustumCulled={false} />
      <instancedMesh ref={frames} args={[geo.frame, MAT.white, 10]} frustumCulled={false} />
    </group>
  );
}

/** The wind turbine is built once the company owns three green units. */
function Turbine() {
  const group = useRef<THREE.Group>(null);
  const blades = useRef<THREE.Mesh>(null);
  const scale = useRef(0);
  const geo = useMemo(() => {
    const blade = new THREE.BoxGeometry(0.16, 1.45, 0.05).translate(0, 0.78, 0);
    const three = [0, 1, 2].map((i) => blade.clone().rotateZ((i * Math.PI * 2) / 3));
    return {
      pole: mergeGeometries([new THREE.CylinderGeometry(0.07, 0.12, 3.3, 10).translate(0, 1.65, 0), new THREE.SphereGeometry(0.17, 12, 10).translate(0, 3.3, 0.02)])!,
      blades: mergeGeometries(three)!,
    };
  }, []);
  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    scale.current = damp(scale.current, vis.green >= 2.5 ? 1 : 0, 6, dt);
    g.scale.setScalar(Math.max(0.0001, scale.current));
    g.visible = scale.current > 0.01;
    if (blades.current && !vis.reduced) blades.current.rotation.z -= dt * (1.2 + vis.green * 0.12);
  });
  return (
    <group ref={group} position={[5.6, 0, 0.7]} rotation={[0, -0.5, 0]} {...tappable('turbine')}>
      <mesh geometry={geo.pole} material={MAT.white} castShadow />
      <mesh ref={blades} geometry={geo.blades} material={MAT.white} position={[0, 3.3, 0.2]} castShadow />
    </group>
  );
}

/** Trees grow or wither, one after another, as the Environment score moves. */
function Trees() {
  const trunks = useRef<THREE.InstancedMesh>(null);
  const leaves = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => ({ trunk: new THREE.CylinderGeometry(0.09, 0.14, 0.8, 7), leaf: new THREE.IcosahedronGeometry(1, 1) }), []);
  const trees = useMemo(() => {
    const spots: [number, number][] = [
      [-6.2, -0.6], [-5.6, -3.2], [-3.9, -5.2], [-1.2, -5.9], [1.0, -5.6], [5.0, -4.2], [6.1, -2.0],
      [6.3, 2.6], [-0.4, 6.2], [-2.6, 5.6], [-4.6, 4.2], [-6.0, 2.2], [-1.6, 3.8], [0.6, -3.9], [4.9, -1.3], [-3.3, 3.4],
    ];
    return spots.map(([x, z], i) => ({ x, z, size: 0.75 + rnd(i, 1) * 0.5, threshold: 14 + (i * 67) % 62, hue: rnd(i, 2) }));
  }, []);
  const health = useRef<number[]>(trees.map(() => 0.6));
  useLayoutEffect(() => {
    leaves.current?.setColorAt(0, HEALTHY);
  }, []);
  useFrame((_, dt) => {
    const a = trunks.current;
    const b = leaves.current;
    if (!a || !b) return;
    const env = vis.env * 100;
    trees.forEach((t, i) => {
      health.current[i] = damp(health.current[i], clamp01((env - t.threshold) / 18), 3, dt);
      const h = health.current[i];
      const s = t.size * introPop(1.6 + i * 0.06);
      const sway = vis.reduced ? 0 : Math.sin(vis.t * 1.3 + i * 1.7) * 0.035;
      tmp.position.set(t.x, 0.4 * s, t.z);
      tmp.rotation.set(0, i, sway);
      tmp.scale.set(s, s, s);
      tmp.updateMatrix();
      a.setMatrixAt(i, tmp.matrix);
      const crown = (0.36 + 0.26 * h) * s;
      tmp.position.set(t.x + sway * 2, (0.8 + 0.42 * (0.4 + 0.6 * h)) * s, t.z);
      tmp.scale.set(crown, crown * (0.85 + 0.25 * h), crown);
      tmp.updateMatrix();
      b.setMatrixAt(i * 2, tmp.matrix);
      const small = (0.22 + 0.2 * h) * s * (h > 0.15 ? 1 : h / 0.15);
      tmp.position.set(t.x + 0.24 * s + sway * 3, (1.25 + 0.3 * h) * s, t.z + 0.12 * s);
      tmp.scale.set(small, small, small);
      tmp.updateMatrix();
      b.setMatrixAt(i * 2 + 1, tmp.matrix);
      col.lerpColors(WITHERED, HEALTHY, h).offsetHSL((t.hue - 0.5) * 0.03, 0, (t.hue - 0.5) * 0.06);
      b.setColorAt(i * 2, col);
      b.setColorAt(i * 2 + 1, col);
    });
    a.instanceMatrix.needsUpdate = true;
    b.instanceMatrix.needsUpdate = true;
    if (b.instanceColor) b.instanceColor.needsUpdate = true;
  });
  return (
    <group {...tappable('trees')}>
      <instancedMesh ref={trunks} args={[geo.trunk, MAT.trunk, trees.length]} castShadow frustumCulled={false} />
      <instancedMesh ref={leaves} args={[geo.leaf, MAT.instanced, trees.length * 2]} castShadow frustumCulled={false} />
    </group>
  );
}

/** The delivery truck circles the roundabout, faster when customers are happy. */
function Truck() {
  const group = useRef<THREE.Group>(null);
  const angle = useRef(0);
  const geo = useMemo(
    () => ({
      cargo: new THREE.BoxGeometry(0.78, 0.46, 0.5).translate(-0.16, 0.44, 0),
      cabin: new THREE.BoxGeometry(0.34, 0.36, 0.48).translate(0.42, 0.39, 0),
      wheels: mergeGeometries([new THREE.CylinderGeometry(0.13, 0.13, 0.58, 12).rotateX(Math.PI / 2).translate(-0.3, 0.13, 0), new THREE.CylinderGeometry(0.13, 0.13, 0.58, 12).rotateX(Math.PI / 2).translate(0.36, 0.13, 0)])!,
    }),
    [],
  );
  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    if (!vis.reduced) angle.current += dt * (0.35 + vis.customer * 0.75);
    const a = angle.current;
    g.position.set(PLAZA.x + Math.sin(a) * 1.72, 0.02 + (vis.reduced ? 0 : Math.abs(Math.sin(vis.t * 9)) * 0.015), PLAZA.z + Math.cos(a) * 1.72);
    g.rotation.y = a;
    g.scale.setScalar(introPop(2.4));
  });
  return (
    <group ref={group} {...tappable('truck')}>
      <mesh geometry={geo.cargo} material={MAT.bright} castShadow />
      <mesh geometry={geo.cabin} material={MAT.white} castShadow />
      <mesh geometry={geo.wheels} material={MAT.wheel} />
    </group>
  );
}

export function World() {
  return (
    <>
      <Island />
      <Factory />
      <Tanks />
      <Office />
      <Solar />
      <Turbine />
      <Trees />
      <Truck />
    </>
  );
}
