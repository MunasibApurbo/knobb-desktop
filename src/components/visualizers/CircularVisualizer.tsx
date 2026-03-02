import { useRef, useEffect, useCallback } from "react";
import { getAudioEngine } from "@/lib/audioEngine";
import { usePlayer } from "@/contexts/PlayerContext";

export function CircularVisualizer({ className = "" }: { className?: string }) {
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

    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(cx, cy) * 0.35;
    const barCount = 80;

    for (let i = 0; i < barCount; i++) {
      const angle = (i / barCount) * Math.PI * 2 - Math.PI / 2;
      const binIdx = Math.floor((i / barCount) * freqData.length * 0.4);
      const value = (freqData[binIdx] || 0) / 255;
      const barLen = value * radius * 1.8 + 2;

      const x1 = cx + Math.cos(angle) * radius;
      const y1 = cy + Math.sin(angle) * radius;
      const x2 = cx + Math.cos(angle) * (radius + barLen);
      const y2 = cy + Math.sin(angle) * (radius + barLen);

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineWidth = 2;
      ctx.strokeStyle = `hsl(${accentHsl} / ${0.3 + value * 0.7})`;
      ctx.lineCap = "round";
      ctx.stroke();

      // Inner mirror (smaller)
      const barLenInner = value * radius * 0.5 + 1;
      const x3 = cx + Math.cos(angle) * (radius - barLenInner);
      const y3 = cy + Math.sin(angle) * (radius - barLenInner);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x3, y3);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = `hsl(${accentHsl} / ${0.15 + value * 0.35})`;
      ctx.stroke();
    }

    // Center circle glow
    const bassAvg = average(freqData, 0, 10) / 255;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = `hsl(${accentHsl} / ${0.05 + bassAvg * 0.15})`;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = `hsl(${accentHsl} / 0.15)`;
    ctx.lineWidth = 1;
    ctx.stroke();

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

function average(data: Uint8Array, start: number, end: number): number {
  if (data.length === 0) return 0;
  const s = Math.min(start, data.length);
  const e = Math.min(end, data.length);
  let sum = 0;
  for (let i = s; i < e; i++) sum += data[i];
  return sum / (e - s || 1);
}
