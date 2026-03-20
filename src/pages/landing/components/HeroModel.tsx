import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import type { Group } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

function lerp(current: number, target: number, amount: number) {
  return current + (target - current) * amount;
}

function Model({ url, isVisible }: { url: string; isVisible: boolean }) {
  const { scene } = useLoader(GLTFLoader, url);
  const modelRef = useRef<Group>(null);

  useFrame((state) => {
    if (!modelRef.current || !isVisible) return;
    const t = state.clock.getElapsedTime();
    const autoY = Math.sin(t / 4) / 4;
    const autoX = Math.cos(t / 4) / 8;
    const targetX = state.pointer.x * 0.4;
    const targetY = -state.pointer.y * 0.2;
    const scroll = typeof window === "undefined" ? 0 : window.scrollY;
    const scrollFactor = Math.min(scroll / 1000, 1);

    modelRef.current.rotation.y = lerp(modelRef.current.rotation.y, autoY + targetX, 0.05);
    modelRef.current.rotation.x = lerp(modelRef.current.rotation.x, autoX + targetY, 0.05);
    modelRef.current.position.y = -1 + Math.sin(t * 0.8) * 0.14 + scrollFactor * 2;
    modelRef.current.scale.setScalar(2.45 - scrollFactor * 1.35);
    modelRef.current.rotation.z = scrollFactor * Math.PI * 0.2;
  });

  return <primitive ref={modelRef} object={scene} scale={2.45} position={[0, -1, 0]} />;
}

export function HeroModel() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (!containerRef.current || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0, rootMargin: "200px" },
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className="hero-3d-container"
      style={{
        pointerEvents: "none",
        visibility: isVisible ? "visible" : "hidden",
      }}
    >
      <Canvas
        frameloop={isVisible ? "always" : "never"}
        dpr={[1.25, 2]}
        performance={{ min: 0.75 }}
        gl={{
          antialias: true,
          powerPreference: "high-performance",
          alpha: true,
          stencil: false,
          depth: true,
        }}
        camera={{ position: [0, 0, 8], fov: 35 }}
      >
        <Suspense fallback={null}>
          <Model url="/models/hero_model/scene.gltf" isVisible={isVisible} />
        </Suspense>

        <ambientLight intensity={0.6} />
        <hemisphereLight intensity={0.9} groundColor="#060606" color="#f4f7ff" />
        <directionalLight position={[4, 7, 5]} intensity={1.9} color="#ffffff" />
        <directionalLight position={[-4, 3, 6]} intensity={0.8} color="#9ec5ff" />
        <pointLight position={[-5, -2, 4]} intensity={0.9} color="#74c0ff" />
      </Canvas>
    </div>
  );
}

useLoader.preload(GLTFLoader, "/models/hero_model/scene.gltf");
