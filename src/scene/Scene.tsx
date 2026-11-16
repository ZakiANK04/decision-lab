import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useGame } from '../store/game';
import { useMediaQuery, usePageVisible } from '../ui/hooks';
import { Crowd } from './Crowd';
import { Bursts, Sky, Smoke } from './Effects';
import { clamp01, damp, vis } from './shared';
import { World } from './World';

const TARGET = new THREE.Vector3(0, 1.1, 0);
const AZIMUTH = 0.62;
const POLAR = 1.02;
const SWOOP = 4.6;
const SUN_WARM = new THREE.Color('#fff4e0');
const SUN_SMOG = new THREE.Color('#e6c9a0');

/** Copies the game state into smoothed values once per frame. */
function Driver({ reduced }: { reduced: boolean }) {
  const started = useRef(false);
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const st = useGame.getState();
    const c = st.sim.company;
    vis.reduced = reduced;
    vis.t += dt;
    if (!started.current) {
      started.current = true;
      vis.intro = st.phase === 'intro' && !reduced ? 0 : 99;
      vis.env = c.environment / 100;
      vis.co2 = c.co2;
    }
    if (st.phase === 'intro' && vis.intro < 90) vis.intro += dt;
    else if (vis.intro < 90) vis.intro += dt * 5; // skipped: finish the pop-ins quickly
    if (vis.intro > 8 && st.phase !== 'intro') vis.intro = 99;
    vis.env = damp(vis.env, c.environment / 100, 1.6, dt);
    vis.productivity = damp(vis.productivity, c.productivity / 100, 2, dt);
    vis.customer = damp(vis.customer, c.customer / 100, 2, dt);
    vis.co2 = damp(vis.co2, c.co2, 1.6, dt);
    vis.fossil = c.fossil;
    vis.green = c.green;
  });
  return null;
}

function Lights({ shadows }: { shadows: boolean }) {
  const sun = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  useFrame(() => {
    const k = clamp01(vis.env * 1.3);
    if (sun.current) {
      sun.current.intensity = 1.5 + k * 1.1;
      sun.current.color.lerpColors(SUN_SMOG, SUN_WARM, k);
    }
    if (hemi.current) hemi.current.intensity = 1.0 + k * 0.35;
  });
  return (
    <>
      <hemisphereLight ref={hemi} args={['#ffffff', '#b9e2c6', 1.2]} />
      <directionalLight ref={sun} position={[-9, 15, 7]} intensity={2.4} castShadow={shadows} shadow-mapSize={[1024, 1024]} shadow-bias={-0.0006} shadow-normalBias={0.03}>
        <orthographicCamera attach="shadow-camera" args={[-10, 10, 10, -10, 1, 40]} />
      </directionalLight>
    </>
  );
}

/** Cinematic swoop during the intro, then orbit / pinch-zoom with a slow idle drift. */
function CameraRig({ reduced }: { reduced: boolean }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controls = useRef<any>(null);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const phase = useGame((s) => s.phase);
  const swoop = useRef(useGame.getState().phase === 'intro' && !reduced ? 0 : SWOOP);
  const settled = useRef(false);
  /** performance.now() of the last touch (Infinity while a finger is down). */
  const lastTouch = useRef(0);

  // Distance at which the whole island fits the viewport, whatever its shape.
  const fit = useMemo(() => {
    const aspect = size.width / Math.max(1, size.height);
    const vFov = (camera.fov * Math.PI) / 180;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
    const radius = 8.3;
    return Math.max(radius / Math.sin(hFov / 2), (radius * 0.74) / Math.sin(vFov / 2));
  }, [size.width, size.height, camera.fov]);

  useEffect(() => {
    if (!settled.current) return;
    const c = controls.current;
    const target: THREE.Vector3 = c?.target ?? TARGET;
    const dir = camera.position.clone().sub(target).normalize();
    camera.position.copy(target).addScaledVector(dir, fit);
    c?.update();
  }, [fit, camera]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const c = controls.current;
    if (!settled.current) {
      swoop.current += phase === 'intro' ? dt : dt * 4;
      const k = clamp01(swoop.current / SWOOP);
      const e = 1 - Math.pow(1 - k, 3);
      camera.position.setFromSphericalCoords(fit * (1 + (1 - e) * 2.1), POLAR - (1 - e) * 0.62, AZIMUTH + (1 - e) * 2.7).add(TARGET);
      camera.lookAt(TARGET);
      if (k >= 1 && phase !== 'intro') {
        settled.current = true;
        if (c) {
          c.target.copy(TARGET);
          c.update();
        }
        lastTouch.current = performance.now() - 3000;
      }
      return;
    }
    if (c) {
      c.autoRotate = !reduced && performance.now() - lastTouch.current > 6000;
      c.update();
    }
  });

  return (
    <OrbitControls
      ref={controls}
      enabled={phase !== 'intro'}
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.7}
      zoomSpeed={0.8}
      minDistance={fit * 0.5}
      maxDistance={fit * 1.45}
      minPolarAngle={0.35}
      maxPolarAngle={1.45}
      autoRotateSpeed={0.3}
      onStart={() => {
        lastTouch.current = Number.POSITIVE_INFINITY;
      }}
      onEnd={() => {
        lastTouch.current = performance.now();
      }}
    />
  );
}

/** The floating island and everything on it. It bobs gently unless motion is reduced. */
function Floating({ reduced }: { reduced: boolean }) {
  const group = useRef<THREE.Group>(null);
  useFrame(() => {
    if (group.current) group.current.position.y = reduced ? 0 : Math.sin(vis.t * 0.7) * 0.1;
  });
  return (
    <group ref={group}>
      <World />
      <Crowd />
      <Smoke />
      <Bursts />
    </group>
  );
}

export default function Scene() {
  const visible = usePageVisible();
  const coarse = useMediaQuery('(pointer: coarse)');
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const select = useGame((s) => s.select);
  return (
    <Canvas
      dpr={[1, coarse ? 1.75 : 2]}
      shadows={!coarse}
      frameloop={visible ? 'always' : 'never'}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      camera={{ fov: 30, near: 0.5, far: 220, position: [40, 40, 60] }}
      onPointerMissed={() => select(null)}
      aria-label="3D view of your company island. Drag to orbit, pinch to zoom, tap a worker or a building for details."
      role="img"
    >
      <Driver reduced={reduced} />
      <Lights shadows={!coarse} />
      <CameraRig reduced={reduced} />
      <Floating reduced={reduced} />
      <Sky />
    </Canvas>
  );
}
