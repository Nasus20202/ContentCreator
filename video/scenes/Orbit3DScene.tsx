import React, { useMemo } from 'react';
import { AbsoluteFill, useVideoConfig } from 'remotion';
import { ThreeCanvas } from '@remotion/three';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { Orbit3DParams } from '../../src/core/schemas';
import { useSceneTime } from '../scene-context';
import { ease } from '../sky/projection';
import { theme } from '../theme';

const STYLE: Record<string, { color: string; emissive: string; radius: number; ring: string; label: string }> = {
  Mercury: { color: '#b9a99a', emissive: '#2a221c', radius: 0.04, ring: '#8a7d70', label: '#e6ddd2' },
  Venus: { color: '#f1dcae', emissive: '#4a3c20', radius: 0.065, ring: '#c9b27d', label: '#fff1d0' },
  Earth: { color: '#4c8fe0', emissive: '#1d4f9a', radius: 0.07, ring: '#4f86c6', label: '#8ec5ff' },
  Mars: { color: '#d8693a', emissive: '#5a2410', radius: 0.055, ring: '#c46a3a', label: '#ff9a5a' },
  Jupiter: { color: '#e3c9a0', emissive: '#4a3a20', radius: 0.2, ring: '#c9a46b', label: '#ffe7c2' },
  Saturn: { color: '#ead7a4', emissive: '#4a4020', radius: 0.17, ring: '#bfae7a', label: '#fff0c4' },
};

const toV3 = (xy: [number, number]) => new THREE.Vector3(xy[0], 0, -xy[1]);

const Rig: React.FC<{ pos: THREE.Vector3; look: THREE.Vector3 }> = ({ pos, look }) => {
  const { camera } = useThree();
  camera.position.copy(pos);
  camera.lookAt(look);
  camera.updateProjectionMatrix();
  return null;
};

const Ring: React.FC<{ r: number; color: string }> = ({ r, color }) => {
  const line = useMemo(() => {
    const pts = Array.from({ length: 257 }, (_, i) => {
      const a = (i / 256) * Math.PI * 2;
      return new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
    });
    return new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.6 }),
    );
  }, [r, color]);
  return <primitive object={line} />;
};

export const Orbit3DScene: React.FC<{ sceneId: string; params: Orbit3DParams }> = ({ sceneId, params }) => {
  const { t, at, win, props } = useSceneTime();
  const { width, height } = useVideoConfig();
  const snap = props.orbits[sceneId];
  if (!snap) throw new Error(`No orbit snapshot for ${sceneId}`);
  const pos = Object.fromEntries(snap.bodies.map((b) => [b.name, toV3(b.xy)]));
  const earth = pos.Earth;
  const target = params.lineOfSight
    ? pos[params.lineOfSight.to]
    : snap.bodies.map((b) => pos[b.name]).find((v) => v !== earth)!;

  // camera: from Earth's viewpoint along the line of sight → top-down reveal framing everything
  const dir = target.clone().sub(earth).normalize();
  const startPos = earth
    .clone()
    .add(dir.clone().multiplyScalar(0.12))
    .add(new THREE.Vector3(0, 0.03, 0));
  const maxR = Math.max(...snap.bodies.map((b) => b.r));
  const centre = snap.bodies
    .reduce((c, b) => c.add(pos[b.name]), new THREE.Vector3())
    .multiplyScalar(1 / snap.bodies.length)
    .multiplyScalar(0.6);
  const endPos = centre.clone().add(new THREE.Vector3(maxR * 0.5, maxR * 1.45, maxR * 0.6));
  const k = ease(Math.max(0, Math.min(1, (t - at(params.revealAt)) / 2.4)));
  const camPos = startPos.clone().lerp(endPos, k);
  const look = target.clone().lerp(centre, k);

  const sightLine = useMemo(
    () =>
      new THREE.Line(
        new THREE.BufferGeometry(),
        new THREE.LineBasicMaterial({ color: theme.accent, transparent: true, opacity: 0.9 }),
      ),
    [],
  );
  const grow = Math.min(1, Math.max(0, (t - 0.2) / 1.2));
  sightLine.geometry.setFromPoints([
    earth,
    earth.clone().lerp(target.clone().add(target.clone().sub(earth).multiplyScalar(0.08)), grow),
  ]);

  const starGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const arr: number[] = [];
    for (let i = 0; i < 1500; i++) {
      const u = Math.sin(i * 12.9898) * 43758.5453,
        w = Math.sin(i * 78.233) * 12345.678;
      const th = (u - Math.floor(u)) * Math.PI * 2,
        ph = Math.acos(2 * (w - Math.floor(w)) - 1);
      arr.push(60 * Math.sin(ph) * Math.cos(th), 60 * Math.cos(ph), 60 * Math.sin(ph) * Math.sin(th));
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    return g;
  }, []);

  // overlay labels via a twin camera
  const twin = new THREE.PerspectiveCamera(50, width / height, 0.01, 200);
  twin.position.copy(camPos);
  twin.lookAt(look);
  twin.updateMatrixWorld();
  const screen = (v: THREE.Vector3) => {
    const q = v.clone().project(twin);
    return { x: ((q.x + 1) / 2) * width, y: ((1 - q.y) / 2) * height, ok: q.z < 1 };
  };
  const distO = params.distancesAt ? win(params.distancesAt) : 0;

  return (
    <AbsoluteFill style={{ background: theme.bg }}>
      <ThreeCanvas width={width} height={height} camera={{ fov: 50, near: 0.01, far: 200 }}>
        <Rig pos={camPos} look={look} />
        <ambientLight intensity={0.15} />
        <pointLight position={[0, 0, 0]} intensity={60} decay={1.2} color="#fff3dd" />
        <points geometry={starGeo}>
          <pointsMaterial color="#9fb3d9" size={0.12} sizeAttenuation transparent opacity={0.8} />
        </points>
        <mesh>
          <sphereGeometry args={[0.22, 48, 48]} />
          <meshBasicMaterial color="#ffd27a" />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.38, 32, 32]} />
          <meshBasicMaterial color="#ffb347" transparent opacity={0.18} />
        </mesh>
        {snap.bodies.map((b) => {
          const s = STYLE[b.name] ?? STYLE.Mars;
          return (
            <React.Fragment key={b.name}>
              <Ring r={b.r} color={s.ring} />
              <mesh position={pos[b.name]}>
                <sphereGeometry args={[s.radius, 48, 48]} />
                <meshStandardMaterial color={s.color} emissive={s.emissive} emissiveIntensity={0.25} roughness={0.85} />
              </mesh>
            </React.Fragment>
          );
        })}
        {params.lineOfSight && <primitive object={sightLine} />}
      </ThreeCanvas>
      {snap.bodies.map((b) => {
        const p = screen(pos[b.name]);
        const isEarth = b.name === 'Earth';
        const o = isEarth ? 1 : distO;
        if (!p.ok || o <= 0) return null;
        return (
          <div
            key={b.name}
            style={{
              position: 'absolute',
              left: p.x + 34,
              top: p.y - 40,
              opacity: o,
              fontFamily: theme.font,
              color: STYLE[b.name]?.label ?? '#fff',
              textShadow: '0 2px 12px #000',
            }}
          >
            <div style={{ fontSize: 50, fontWeight: 700 }}>{b.name}</div>
            <div style={{ fontSize: 34, fontWeight: 500, color: theme.muted }}>
              {isEarth ? 'you are here' : `${Math.round(b.distKm / 1e6)} million km`}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
