"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

export default function HeroOrbit() {
  const mount = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = mount.current;
    if (!host) return;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.z = 8;
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    host.appendChild(renderer.domElement);
    const world = new THREE.Group();
    scene.add(world);
    const nodeMaterial = new THREE.MeshBasicMaterial({ color: 0x0b8062, transparent: true, opacity: 0.9 });
    const glowMaterial = new THREE.MeshBasicMaterial({ color: 0xf2b84b, transparent: true, opacity: 0.85 });
    const points = [[-2.8, 0.9, 0.3], [-1.6, -0.65, 0.2], [-0.25, 0.25, 0.55], [1.25, 1.05, 0.1], [2.55, -0.15, 0.2], [1.45, -1.1, 0.5], [-0.7, -1.35, 0.1], [0.1, 1.65, -0.25]] as const;
    points.forEach(([x, y, z], index) => {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(index % 3 === 0 ? 0.1 : 0.06, 12, 12), index % 3 === 0 ? glowMaterial : nodeMaterial);
      mesh.position.set(x, y, z);
      world.add(mesh);
    });
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x0b8062, transparent: true, opacity: 0.2 });
    [[0, 2], [1, 2], [2, 3], [2, 5], [3, 4], [5, 6], [6, 1], [7, 2], [7, 3]].forEach(([from, to]) => {
      const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...points[from]), new THREE.Vector3(...points[to])]);
      world.add(new THREE.Line(geometry, lineMaterial));
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.35, 0.012, 8, 96), new THREE.MeshBasicMaterial({ color: 0x0b8062, transparent: true, opacity: 0.18 }));
    ring.rotation.x = 0.9;
    world.add(ring);
    const resize = () => {
      const width = host.clientWidth || 640;
      const height = host.clientHeight || 360;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    resize();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    const animate = (time: number) => {
      if (!reduced) {
        world.rotation.y = time * 0.00008;
        world.rotation.x = Math.sin(time * 0.00018) * 0.08;
      }
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.dispose();
      scene.traverse(object => { if (object instanceof THREE.Mesh || object instanceof THREE.Line) object.geometry.dispose(); });
      host.removeChild(renderer.domElement);
    };
  }, []);

  return <div className="hero-orbit" ref={mount} aria-hidden="true" />;
}
