import { useRef, useEffect, useCallback } from "react";
import { getAudioEngine } from "@/lib/audioEngine";
import { usePlayer } from "@/contexts/PlayerContext";

type WaveformVisualizerProps = {
  className?: string;
  currentTime?: number;
};

export function WaveformVisualizer({ className = "", currentTime: currentTimeOverride }: WaveformVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const barsRef = useRef<number[]>([]);
  const currentTimeRef = useRef(0);
  const isPlayingRef = useRef(false);
  const currentTrackRef = useRef<ReturnType<typeof usePlayer>["currentTrack"]>(null);
  const lastFrameTimeRef = useRef(0);
  const { isPlaying, currentTime, currentTrack } = usePlayer();
  const trackId = currentTrack?.id ?? null;

  // Generate static bar heights per track
  useEffect(() => {
    const bars: number[] = [];
    for (let i = 0; i < 120; i++) {
      bars.push(0.12 + Math.random() * 0.88);
    }
    barsRef.current = bars;
  }, [currentTrack?.id]);

  useEffect(() => {
    currentTimeRef.current = currentTimeOverride ?? currentTime;
  }, [currentTime, currentTimeOverride]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    currentTrackRef.current = currentTrack;
  }, [currentTrack]);

  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    const track = currentTrackRef.current;
    if (!canvas || !track) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const nextWidth = Math.max(1, Math.round(rect.width * dpr));
    const nextHeight = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
      canvas.width = nextWidth;
      canvas.height = nextHeight;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const w = rect.width;
    const h = rect.height;
    ctx.clearRect(0, 0, w, h);

    const engine = getAudioEngine();
    const freqData = engine.getFrequencyData();
    const accentHsl = getComputedStyle(document.documentElement)
      .getPropertyValue("--player-waveform")
      .trim();

    const duration = engine.duration || track.duration;
    const progress = duration > 0 ? currentTimeRef.current / duration : 0;

    const bars = barsRef.current;
    const barCount = bars.length;
    const gap = 1;
    const barWidth = (w - gap * (barCount - 1)) / barCount;

    for (let i = 0; i < barCount; i++) {
      const x = i * (barWidth + gap);
      
      // Modulate bar height with frequency data when playing
      let barHeight = bars[i];
      if (isPlayingRef.current && freqData.length > 0) {
        const freqIdx = Math.floor((i / barCount) * freqData.length * 0.5);
        const freqInfluence = (freqData[freqIdx] || 0) / 255;
        barHeight = bars[i] * 0.5 + freqInfluence * 0.5;
      }

      const barH = barHeight * h * 0.9;
      const y = (h - barH) / 2;
      const played = i / barCount <= progress;

      if (played) {
        ctx.fillStyle = `hsl(${accentHsl})`;
      } else {
        ctx.fillStyle = `hsl(${accentHsl} / 0.18)`;
      }

      // Sharp rectangles — no rounding
      ctx.fillRect(x, y, barWidth, barH);
    }

    // Playhead line
    if (progress > 0 && progress < 1) {
      const px = progress * w;
      ctx.fillStyle = `hsl(${accentHsl})`;
      ctx.fillRect(px - 1, 0, 2, h);

      // Playhead glow
      ctx.shadowColor = `hsl(${accentHsl})`;
      ctx.shadowBlur = 8;
      ctx.fillRect(px - 1, 0, 2, h);
      ctx.shadowBlur = 0;
    }
  }, []);

  useEffect(() => {
    if (!trackId) return;
    drawFrame();
  }, [drawFrame, trackId]);

  useEffect(() => {
    if (!trackId || isPlaying) return;
    drawFrame();
  }, [currentTime, drawFrame, isPlaying, trackId]);

  useEffect(() => {
    if (!trackId || !isPlaying) return;

    const draw = (timestamp: number) => {
      if (timestamp - lastFrameTimeRef.current >= 33) {
        lastFrameTimeRef.current = timestamp;
        drawFrame();
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    animationRef.current = requestAnimationFrame(draw);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      animationRef.current = 0;
    };
  }, [drawFrame, isPlaying, trackId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => drawFrame());
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [drawFrame]);

  return (
    <canvas
      ref={canvasRef}
      className={`w-full h-full seekbar-hover transition-transform duration-200 ${className}`}
      style={{ display: "block" }}
    />
  );
}
