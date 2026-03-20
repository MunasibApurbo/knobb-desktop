import React, { useEffect, useRef, memo } from "react";
import gsap from "gsap";
import { BrandLogo } from "@/components/BrandLogo";
import { readReducedMotionPreference } from "@/lib/performanceProfile";

export const ExperienceManifesto: React.FC = memo(() => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const coreRef = useRef<HTMLDivElement>(null);
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (readReducedMotionPreference() || window.innerWidth <= 1000) {
      return;
    }

    const section = sectionRef.current;
    if (!section) {
      return;
    }

    const ctx = gsap.context(() => {
      let frameId = 0;
      let listening = false;
      let latestX = window.innerWidth / 2;
      let latestY = window.innerHeight / 2;

      const renderPointerMotion = () => {
        frameId = 0;
        const { innerWidth, innerHeight } = window;
        const xFactor = (latestX / innerWidth - 0.5) * 2;
        const yFactor = (latestY / innerHeight - 0.5) * 2;

        gsap.to(coreRef.current, {
          rotateY: xFactor * 15,
          rotateX: -yFactor * 15,
          duration: 1.2,
          ease: "power2.out",
          force3D: true,
        });

        gsap.to(leftPanelRef.current, {
          x: xFactor * 20,
          y: yFactor * 10,
          duration: 1.5,
          ease: "power2.out",
        });

        gsap.to(rightPanelRef.current, {
          x: -xFactor * 20,
          y: -yFactor * 10,
          duration: 1.5,
          ease: "power2.out",
        });
      };

      const onMouseMove = (e: MouseEvent) => {
        latestX = e.clientX;
        latestY = e.clientY;
        if (frameId) return;
        frameId = window.requestAnimationFrame(renderPointerMotion);
      };

      const startListening = () => {
        if (listening) return;
        listening = true;
        window.addEventListener("mousemove", onMouseMove, { passive: true });
      };

      const stopListening = () => {
        if (!listening) return;
        listening = false;
        window.removeEventListener("mousemove", onMouseMove);
        if (frameId) {
          window.cancelAnimationFrame(frameId);
          frameId = 0;
        }
      };

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting) {
            startListening();
            return;
          }

          stopListening();
        },
        { threshold: 0.15, rootMargin: "0px 0px 20% 0px" },
      );

      observer.observe(section);

      return () => {
        observer.disconnect();
        stopListening();
      };
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section className="industrial-vault-section" ref={sectionRef}>
      <div className="gpu-noise-overlay"></div>
      
      <div className="vault-grid"></div>

      <div className="vault-container">
        {/* Left Panel: vision */}
        <div className="vault-panel left" ref={leftPanelRef}>
          <div className="panel-header mn">
            <span>[ VISION_LOG // 01 ]</span>
            <div className="header-line"></div>
          </div>
          <div className="panel-content">
            <h2 className="mn">SYSTEM_PHILOSOPHY</h2>
            <p>KNOBB IS A PREMIUM MUSIC ECOSYSTEM DESIGNED FOR THOSE WHO LIVE FOR SOUND.</p>
            <p>WE TRANSCEND TRADITIONAL STREAMING WITH A VAST LIBRARY.</p>
          </div>
          <div className="panel-footer mn">STATUS: OPERATIONAL</div>
        </div>

        {/* Center: Brand Monolith */}
        <div className="vault-core-wrapper">
          <div className="vault-3d-core" ref={coreRef}>
            <div className="face front">
               <BrandLogo className="flex-col gap-6" markClassName="h-40 w-40" textClassName="text-3xl" showLabel />
               <div className="core-scanner-line"></div>
            </div>
            <div className="face back"></div>
            <div className="face right"></div>
            <div className="face left"></div>
            <div className="face top"></div>
            <div className="face bottom"></div>
          </div>
          <div className="core-glow"></div>
        </div>

        {/* Right Panel: Data */}
        <div className="vault-panel right" ref={rightPanelRef}>
          <div className="panel-header mn">
            <div className="header-line"></div>
            <span>[ DATA_STREAM // 02 ]</span>
          </div>
          <div className="panel-content text-right">
            <h2 className="mn">ENGINE_PROTOCOL</h2>
            <p>HIGH-FIDELITY AUDIO ARCHITECTURE PRIORITIZING FLOW OVER FRICTION.</p>
            <p>CURATED BEATS. SEAMLESS TRANSITION. BEYOND THE INTERFACE.</p>
          </div>
          <div className="panel-footer mn text-right">SYNC_CORE: ACTIVE</div>
        </div>
      </div>

      {/* Industrial Footer HUD */}
      <div className="vault-footer-hud mn">
        <div className="hud-segment">
          <span>LATENCY: 4MS</span>
          <div className="pulse-dot"></div>
        </div>
        <div className="hud-segment center">
          <span>LISTEN / DISCOVER / SYNC / TRANSCEND</span>
        </div>
        <div className="hud-segment">
          <span>ENCRYPTION: AES_256</span>
          <div className="pulse-dot"></div>
        </div>
      </div>

      {/* Atmospheric Overlays */}
      <div className="vault-hud-marker top-left mn">[ AREA_51 // CORE_VAULT ]</div>
      <div className="vault-hud-marker top-right mn">REV_09.42 // {new Date().getFullYear()}</div>
    </section>
  );
});
