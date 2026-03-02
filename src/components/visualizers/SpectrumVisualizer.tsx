import { useRef, useEffect, useCallback } from "react";
import { getAudioEngine } from "@/lib/audioEngine";
import { usePlayer } from "@/contexts/PlayerContext";

export function SpectrumVisualizer({ className = "" }: { className?: string }) {
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
      .getPropertyValue("--player-waveform").trim();

    const barCount = 64;
    const gap = 2;
    const barWidth = (w - gap * (barCount - 1)) / barCount;

    for (let i = 0; i < barCount; i++) {
      const binIdx = Math.floor((i / barCount) * freqData.length * 0.5);
      const value = (freqData[binIdx] || 0) / 255;
      const barH = Math.max(2, value * h * 0.95);
      const x = i * (barWidth + gap);
      const y = h - barH;

      // Gradient per bar
      const gradient = ctx.createLinearGradient(x, h, x, y);
      gradient.addColorStop(0, `hsl(${accentHsl} / 0.4)`);
      gradient.addColorStop(0.5, `hsl(${accentHsl} / 0.8)`);
      gradient.addColorStop(1, `hsl(${accentHsl})`);
      ctx.fillStyle = gradient;

      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barH, 1);
      ctx.fill();

      // Peak dot
      if (value > 0.1) {
        ctx.fillStyle = `hsl(${accentHsl})`;
        ctx.fillRect(x, y - 3, barWidth, 2);
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
    <canvas ref={canvasRef} className={`w-full h-full ${className}`} style={{ display: "block" }} />
  );
}
