/**
 * FILE: apps/web/src/components/three/DeploymentEngine.tsx
 *
 * PURPOSE:
 * Renders FLASHLIVE's deployment-engine 3D visual with React Three Fiber.
 *
 * WHY THIS FILE EXISTS:
 * Provides the signature torus/worker-pool visual for landing and auth pages.
 *
 * HOW IT WORKS:
 * Uses a metallic torus knot, wireframe overlay, orbiting worker slots and
 * floating geometric rings with requestAnimationFrame cleanup via R3F.
 *
 * USED BY:
 * Landing hero and auth side panels.
 */

import { Canvas, useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

function TorusCore() {
  const mesh = useRef<THREE.Mesh>(null);
  const wire = useRef<THREE.Mesh>(null);
  useFrame((state, delta) => {
    if (mesh.current) {
      mesh.current.rotation.x += delta * 0.18;
      mesh.current.rotation.y += delta * 0.28;
    }
    if (wire.current) {
      wire.current.rotation.x -= delta * 0.12;
      wire.current.rotation.z += delta * 0.16;
    }
  });
  return (
    <group>
      <mesh ref={mesh}>
        <torusKnotGeometry args={[1.15, 0.32, 180, 24]} />
        <meshStandardMaterial color="#111111" metalness={0.85} roughness={0.25} />
      </mesh>
      <mesh ref={wire}>
        <torusKnotGeometry args={[1.28, 0.34, 90, 16]} />
        <meshBasicMaterial color="#E8FF00" wireframe transparent opacity={0.22} />
      </mesh>
    </group>
  );
}

function WorkerSlots() {
  const group = useRef<THREE.Group>(null);
  const slots = useMemo(() => [0, 1, 2].map((index) => {
    const angle = (index / 3) * Math.PI * 2;
    return new THREE.Vector3(Math.cos(angle) * 2.4, Math.sin(angle) * 0.9, Math.sin(angle) * 0.7);
  }), []);
  useFrame((state) => {
    if (!group.current) return;
    group.current.rotation.y = state.clock.elapsedTime * 0.18;
    group.current.children.forEach((child, index) => {
      const mesh = child as THREE.Mesh;
      const material = mesh.material as THREE.MeshBasicMaterial;
      material.opacity = 0.45 + Math.sin(state.clock.elapsedTime * 2 + index) * 0.2;
    });
  });
  return (
    <group ref={group}>
      {slots.map((position, index) => (
        <mesh key={index} position={position}>
          <octahedronGeometry args={[0.18, 0]} />
          <meshBasicMaterial color={index === 1 ? '#E8FF00' : '#00CCFF'} transparent opacity={0.7} />
        </mesh>
      ))}
    </group>
  );
}

function FloatingRings() {
  const group = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!group.current) return;
    group.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.25) * 0.15;
    group.current.rotation.y = state.clock.elapsedTime * 0.12;
  });
  return (
    <group ref={group}>
      <mesh rotation={[Math.PI / 2.4, 0.2, 0]}>
        <torusGeometry args={[2.8, 0.012, 8, 128]} />
        <meshBasicMaterial color="#E8FF00" transparent opacity={0.16} />
      </mesh>
      <mesh rotation={[Math.PI / 1.8, -0.4, 0.2]}>
        <torusGeometry args={[3.4, 0.01, 8, 128]} />
        <meshBasicMaterial color="#00CCFF" transparent opacity={0.12} />
      </mesh>
    </group>
  );
}

export function DeploymentEngine({ className }: { className?: string }) {
  return (
    <div className={className} aria-hidden="true">
      <Canvas camera={{ position: [0, 0, 5.2], fov: 45 }} gl={{ antialias: true, alpha: true }} dpr={[1, 1.6]}>
        <ambientLight intensity={0.7} />
        <pointLight position={[4, 4, 4]} intensity={60} color="#E8FF00" />
        <pointLight position={[-4, -2, 2]} intensity={30} color="#00CCFF" />
        <TorusCore />
        <WorkerSlots />
        <FloatingRings />
      </Canvas>
    </div>
  );
}
