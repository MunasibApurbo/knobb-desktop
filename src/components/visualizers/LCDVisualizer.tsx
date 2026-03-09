import { useRef, useEffect, useCallback } from "react";
import { getAudioEngine } from "@/lib/audioEngine";
import { usePlayer } from "@/contexts/PlayerContext";

interface LCDVisualizerProps {
  className?: string;
}

export function LCDVisualizer({ className = "" }: LCDVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const { isPlaying } = usePlayer();

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;

    ctx.clearRect(0, 0, w, h);

    const engine = getAudioEngine();
    const freqData = engine.getFrequencyData();

    const accentHsl = getComputedStyle(document.documentElement)
      .getPropertyValue("--player-waveform")
      .trim();

    // LCD grid parameters
    const cols = 32;
    const rows = 16;
    const cellW = w / cols;
    const cellH = h / rows;
    const gap = 1;

    for (let col = 0; col < cols; col++) {
      // Map column to frequency bin
      const binIndex = Math.floor((col / cols) * (freqData.length * 0.6));
      const value = (freqData[binIndex] || 0) / 255;
      const litRows = Math.floor(value * rows);

      for (let row = 0; row < rows; row++) {
        const x = col * cellW + gap;
        const y = (rows - 1 - row) * cellH + gap;
        const isLit = row < litRows;

        if (isLit) {
          // Color gradient: green → yellow → red from bottom to top
          const ratio = row / rows;
          if (ratio > 0.8) {
            ctx.fillStyle = `hsl(0 80% 55% / 0.9)`;
          } else if (ratio > 0.6) {
            ctx.fillStyle = `hsl(45 90% 55% / 0.9)`;
          } else {
            ctx.fillStyle = `hsl(${accentHsl} / 0.9)`;
          }
        } else {
          ctx.fillStyle = `hsl(${accentHsl} / 0.06)`;
        }

        ctx.fillRect(x, y, cellW - gap * 2, cellH - gap * 2);
      }
    }

    animationRef.current = requestAnimationFrame(draw);
  }, []);

  useEffect(() => {
    if (isPlaying) {
      animationRef.current = requestAnimationFrame(draw);
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying, draw]);

  return (
    <canvas
      ref={canvasRef}
      className={`w-full h-full ${className}`}
      style={{ display: "block" }}
    />
  );
}
