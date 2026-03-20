import React, { useEffect, useRef, memo } from "react";
import gsap from "gsap";
import { readReducedMotionPreference } from "@/lib/performanceProfile";

export const LibrarySync: React.FC = memo(() => {
  const containerRef = useRef<HTMLDivElement>(null);
  const crosshairRef = useRef<HTMLDivElement>(null);
  const coreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (readReducedMotionPreference() || window.innerWidth <= 1000) {
      return;
    }

    const section = containerRef.current;
    if (!section) {
      return;
    }

    const ctx = gsap.context(() => {
      const ribbons = Array.from(section.querySelectorAll<HTMLElement>(".ribbon"));
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
          rotateY: xFactor * 25,
          rotateX: -yFactor * 15,
          duration: 1.5,
          ease: "power2.out",
          force3D: true,
        });

        gsap.to(crosshairRef.current, {
          left: latestX,
          top: latestY,
          duration: 0.1,
          ease: "none",
        });

        if (ribbons.length > 0) {
          gsap.to(ribbons, {
            x: xFactor * 50,
            y: yFactor * 30,
            opacity: 0.1 + Math.abs(xFactor) * 0.2,
            duration: 2,
            stagger: 0.005,
            ease: "sine.out",
          });
        }
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
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <section className="library-audio-core-section" ref={containerRef}>
      <div className="gpu-noise-overlay"></div>
      
      {/* 3D Ribbon Tunnel - Zero Gaps Background */}
      <div className="ribbon-tunnel">
        {Array.from({ length: 80 }).map((_, i) => (
          <div 
            key={i} 
            className="ribbon" 
            style={{ 
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              transform: `translateZ(${Math.random() * -1000}px)`
            }} 
          />
        ))}
      </div>

      {/* Horizontal Scanning Lasers */}
      <div className="laser-scanner">
        <div className="laser-line"></div>
        <div className="laser-line delay-1"></div>
        <div className="laser-line delay-2"></div>
      </div>

      <div className="monolith-container">
        <div className="monolith-3d-core" ref={coreRef}>
          <div className="core-block">
            <h1 className="core-text">DATABASE</h1>
          </div>
          <div className="core-block center-piece">
            <div className="core-metadata">
              <span className="mn">MQA // OPTIMIZED</span>
              <div className="core-line"></div>
              <span className="mn">192KHZ_SYNC</span>
            </div>
            <h1 className="core-text outlined">AUDIO_CORE</h1>
          </div>
          <div className="core-block">
            <h1 className="core-text">LOSSLESS</h1>
          </div>
        </div>

        {/* Industrial Source Nodes */}
        <div className="core-nodes">
          <div className="node-item">
            <div className="node-header">
              <span className="mn">SRC_A</span>
              <div className="status-indicator active"></div>
            </div>
            <h3>TIDAL</h3>
            <p className="mn">HI-RES_DIRECT</p>
          </div>
          <div className="node-item">
            <div className="node-header">
              <span className="mn">SRC_B</span>
              <div className="status-indicator active"></div>
            </div>
            <h3>YT MUSIC</h3>
            <p className="mn">100M_NODES</p>
          </div>
        </div>
      </div>

      {/* Extreme Density HUD Markers */}
      <div className="core-hud top-left">
        <span className="mn">[ SYS_CMD: RENDER_60FPS ]</span>
        <span className="mn">COORDS: 42.92.11 / {Math.random().toFixed(2)}</span>
      </div>
      <div className="core-hud top-right">
        <span className="mn">BITRATE_STREAM: 9.2 MBPS</span>
        <div className="audio-bars">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="bar" />)}
        </div>
      </div>
      <div className="core-hud bottom-left">
        <span className="mn">ARCHITECTURE: INDUSTRIAL_V3</span>
        <span className="mn">SYNC_ENGINE // KNOBB_LLC</span>
      </div>
      <div className="core-hud bottom-right">
        <span className="mn">EST_LATENCY: 4MS</span>
        <span className="mn">© 2026 // ALL_RIGHTS_RESERVED</span>
      </div>

      {/* Technical HUD Crosshair */}
      <div className="hud-crosshair" ref={crosshairRef}>
        <div className="cross-ring"></div>
        <div className="inner-dot"></div>
        <div className="coord-label mn">X: LOCK // Y: SEARCH</div>
      </div>
    </section>
  );
});
