import { useRef, useEffect, useCallback } from "react";
import { usePlayer } from "@/contexts/PlayerContext";

export function WaveformCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { currentTrack, currentTime, duration, isPlaying } = usePlayer();
  const barsRef = useRef<number[]>([]);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const bars: number[] = [];
    for (let i = 0; i < 100; i++) {
      bars.push(0.15 + Math.random() * 0.85);
    }
    barsRef.current = bars;
  }, [currentTrack?.id]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !currentTrack) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const bars = barsRef.current;
    const barCount = bars.length;
    const gap = 1.5;
    const barWidth = (w - (barCount - 1) * gap) / barCount;
    const trackDuration = duration || currentTrack.duration || 1;
    const progress = trackDuration > 0 ? currentTime / trackDuration : 0;

    ctx.clearRect(0, 0, w, h);

    const accentHsl = getComputedStyle(document.documentElement)
      .getPropertyValue("--player-waveform")
      .trim();

    for (let i = 0; i < barCount; i++) {
      const x = i * (barWidth + gap);
      const barH = bars[i] * h * 0.8;
      const y = (h - barH) / 2;
      const played = i / barCount < progress;

      if (played) {
        ctx.fillStyle = `hsl(${accentHsl})`;
      } else {
        ctx.fillStyle = `hsl(${accentHsl} / 0.2)`;
      }

      ctx.beginPath();
      ctx.roundRect(x, y, Math.max(barWidth, 1), barH, 2);
      ctx.fill();
    }
  }, [currentTime, currentTrack, duration]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  // Redraw on resize
  useEffect(() => {
    const observer = new ResizeObserver(() => draw());
    if (canvasRef.current) observer.observe(canvasRef.current);
    return () => observer.disconnect();
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ display: "block" }}
    />
  );
}
