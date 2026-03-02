import { useRef, useEffect } from "react";
import { usePlayer } from "@/contexts/PlayerContext";

export function WaveformCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { currentTrack, currentTime, isPlaying } = usePlayer();
  const barsRef = useRef<number[]>([]);

  useEffect(() => {
    // Generate random waveform bars once per track
    const bars: number[] = [];
    for (let i = 0; i < 80; i++) {
      bars.push(0.15 + Math.random() * 0.85);
    }
    barsRef.current = bars;
  }, [currentTrack?.id]);

  useEffect(() => {
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
    const barWidth = w / barCount - 1;
    const progress = currentTime / currentTrack.duration;

    ctx.clearRect(0, 0, w, h);

    // Parse the accent color for canvas drawing
    const accentHsl = getComputedStyle(document.documentElement).getPropertyValue("--player-waveform").trim();

    for (let i = 0; i < barCount; i++) {
      const x = i * (barWidth + 1);
      const barH = bars[i] * h * 0.85;
      const y = (h - barH) / 2;
      const played = i / barCount < progress;

      if (played) {
        ctx.fillStyle = `hsl(${accentHsl})`;
      } else {
        ctx.fillStyle = `hsl(${accentHsl} / 0.25)`;
      }

      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barH, 1);
      ctx.fill();
    }
  }, [currentTime, currentTrack, isPlaying]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ display: "block" }}
    />
  );
}
