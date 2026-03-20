import { useCallback, useEffect, useRef } from "react";

import { getAudioEngine } from "@/lib/audioEngine";

type WaveformVisualizerProps = {
  className?: string;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  playbackSpeed: number;
  trackId: string;
};

type CanvasMetrics = {
  width: number;
  height: number;
  dpr: number;
};

const DEFAULT_WAVEFORM_COLOR = "0 0% 60%";

export function WaveformVisualizer({
  className = "",
  currentTime,
  duration,
  isPlaying,
  playbackSpeed,
  trackId,
}: WaveformVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const barsRef = useRef<number[]>([]);
  const currentTimeRef = useRef(currentTime);
  const durationRef = useRef(duration);
  const isPlayingRef = useRef(isPlaying);
  const playbackSpeedRef = useRef(playbackSpeed);
  const lastFrameTimeRef = useRef(0);
  const waveformColorRef = useRef(DEFAULT_WAVEFORM_COLOR);
  const canvasMetricsRef = useRef<CanvasMetrics>({ width: 0, height: 0, dpr: 1 });
  const progressSyncTimestampRef = useRef(0);

  useEffect(() => {
    const bars: number[] = [];
    for (let i = 0; i < 120; i++) {
      bars.push(0.12 + Math.random() * 0.88);
    }
    barsRef.current = bars;
  }, [trackId]);

  useEffect(() => {
    currentTimeRef.current = currentTime;
    progressSyncTimestampRef.current = typeof performance === "undefined" ? 0 : performance.now();
  }, [currentTime, trackId]);

  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
    if (typeof performance !== "undefined") {
      progressSyncTimestampRef.current = performance.now();
    }
  }, [isPlaying]);

  useEffect(() => {
    playbackSpeedRef.current = Number.isFinite(playbackSpeed) && playbackSpeed > 0 ? playbackSpeed : 1;
    if (typeof performance !== "undefined") {
      progressSyncTimestampRef.current = performance.now();
    }
  }, [playbackSpeed]);

  const syncWaveformColor = useCallback(() => {
    if (typeof document === "undefined") return;

    waveformColorRef.current = getComputedStyle(document.documentElement)
      .getPropertyValue("--player-waveform")
      .trim() || DEFAULT_WAVEFORM_COLOR;
  }, []);

  const updateCanvasMetrics = useCallback((canvas: HTMLCanvasElement, width?: number, height?: number) => {
    const dpr = window.devicePixelRatio || 1;
    const nextWidth = Math.max(1, Math.round((width ?? canvas.clientWidth) * dpr));
    const nextHeight = Math.max(1, Math.round((height ?? canvas.clientHeight) * dpr));

    if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
      canvas.width = nextWidth;
      canvas.height = nextHeight;
    }

    canvasMetricsRef.current = {
      width: nextWidth / dpr,
      height: nextHeight / dpr,
      dpr,
    };
  }, []);

  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !trackId) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (canvasMetricsRef.current.width <= 0 || canvasMetricsRef.current.height <= 0) {
      updateCanvasMetrics(canvas);
    }

    const { width, height, dpr } = canvasMetricsRef.current;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const engine = getAudioEngine();
    const freqData = engine.getFrequencyData();
    const accentHsl = waveformColorRef.current;
    const playbackDuration = engine.duration || durationRef.current;
    const now = typeof performance === "undefined" ? 0 : performance.now();
    const elapsedSeconds = isPlayingRef.current
      ? Math.max(0, (now - progressSyncTimestampRef.current) / 1000)
      : 0;
    const effectiveCurrentTime = Math.min(
      playbackDuration || Number.POSITIVE_INFINITY,
      currentTimeRef.current + elapsedSeconds * playbackSpeedRef.current,
    );
    const progress = playbackDuration > 0 ? effectiveCurrentTime / playbackDuration : 0;

    const bars = barsRef.current;
    const barCount = bars.length;
    const gap = 1;
    const barWidth = (width - gap * (barCount - 1)) / barCount;

    for (let i = 0; i < barCount; i++) {
      const x = i * (barWidth + gap);

      let barHeight = bars[i];
      if (isPlayingRef.current && freqData.length > 0) {
        const freqIdx = Math.floor((i / barCount) * freqData.length * 0.5);
        const freqInfluence = (freqData[freqIdx] || 0) / 255;
        barHeight = bars[i] * 0.5 + freqInfluence * 0.5;
      }

      const barH = barHeight * height * 0.9;
      const y = (height - barH) / 2;
      const played = i / barCount <= progress;

      ctx.fillStyle = played
        ? `hsl(${accentHsl})`
        : `hsl(${accentHsl} / 0.18)`;
      ctx.fillRect(x, y, barWidth, barH);
    }

    if (progress > 0 && progress < 1) {
      const px = progress * width;
      ctx.fillStyle = `hsl(${accentHsl})`;
      ctx.fillRect(px - 1, 0, 2, height);

      ctx.shadowColor = `hsl(${accentHsl})`;
      ctx.shadowBlur = 8;
      ctx.fillRect(px - 1, 0, 2, height);
      ctx.shadowBlur = 0;
    }
  }, [trackId, updateCanvasMetrics]);

  useEffect(() => {
    syncWaveformColor();
    drawFrame();
  }, [drawFrame, syncWaveformColor, trackId]);

  useEffect(() => {
    if (!trackId || isPlaying) return;
    drawFrame();
  }, [currentTime, drawFrame, isPlaying, trackId]);

  useEffect(() => {
    if (typeof document === "undefined" || typeof MutationObserver === "undefined") return;

    const observer = new MutationObserver(() => {
      syncWaveformColor();
      drawFrame();
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });

    return () => observer.disconnect();
  }, [drawFrame, syncWaveformColor]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    updateCanvasMetrics(canvas);
    drawFrame();

    const handleWindowResize = () => {
      updateCanvasMetrics(canvas);
      drawFrame();
    };

    window.addEventListener("resize", handleWindowResize);
    return () => window.removeEventListener("resize", handleWindowResize);
  }, [drawFrame, updateCanvasMetrics]);

  useEffect(() => {
    if (!trackId || !isPlaying) return;

    const draw = (timestamp: number) => {
      if (timestamp - lastFrameTimeRef.current >= 50) {
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

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        updateCanvasMetrics(canvas, entry.contentRect.width, entry.contentRect.height);
      }
      drawFrame();
    });

    observer.observe(canvas);
    return () => observer.disconnect();
  }, [drawFrame, updateCanvasMetrics]);

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none w-full h-full seekbar-hover transition-transform duration-200 ${className}`}
      style={{ display: "block" }}
    />
  );
}
