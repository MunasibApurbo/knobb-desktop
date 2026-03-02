import { useRef, useEffect, useCallback } from "react";
import { getAudioEngine } from "@/lib/audioEngine";
import { usePlayer } from "@/contexts/PlayerContext";

export function WaveformVisualizer({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const { isPlaying, currentTime, currentTrack } = usePlayer();

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
    ctx.clearRect(0, 0, w, h);

    const engine = getAudioEngine();
    const timeDomain = engine.getTimeDomainData();
    const accentHsl = getComputedStyle(document.documentElement)
      .getPropertyValue("--player-waveform")
      .trim();

    const duration = engine.duration || currentTrack.duration;
    const progress = duration > 0 ? currentTime / duration : 0;
    const progressX = progress * w;

    // Draw waveform from time domain data
    if (timeDomain.length > 0 && isPlaying) {
      // Played section
      ctx.beginPath();
      ctx.strokeStyle = `hsl(${accentHsl})`;
      ctx.lineWidth = 2;
      for (let i = 0; i < timeDomain.length; i++) {
        const x = (i / timeDomain.length) * w;
        if (x > progressX) break;
        const v = timeDomain[i] / 128.0;
        const y = (v * h) / 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Unplayed section
      ctx.beginPath();
      ctx.strokeStyle = `hsl(${accentHsl} / 0.25)`;
      ctx.lineWidth = 2;
      let started = false;
      for (let i = 0; i < timeDomain.length; i++) {
        const x = (i / timeDomain.length) * w;
        if (x < progressX) continue;
        const v = timeDomain[i] / 128.0;
        const y = (v * h) / 2;
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    } else {
      // Static bars when paused
      const barCount = 80;
      const barWidth = w / barCount - 1;

      for (let i = 0; i < barCount; i++) {
        const x = i * (barWidth + 1);
        const barH = (0.15 + Math.sin(i * 0.3 + currentTime * 0.1) * 0.35 + 0.35) * h * 0.85;
        const y = (h - barH) / 2;
        const played = i / barCount < progress;

        ctx.fillStyle = played ? `hsl(${accentHsl})` : `hsl(${accentHsl} / 0.25)`;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barH, 1);
        ctx.fill();
      }
    }

    // Playhead
    if (progress > 0 && progress < 1) {
      ctx.fillStyle = `hsl(${accentHsl})`;
      ctx.beginPath();
      ctx.arc(progressX, h / 2, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    animationRef.current = requestAnimationFrame(draw);
  }, [isPlaying, currentTime, currentTrack]);

  useEffect(() => {
    animationRef.current = requestAnimationFrame(draw);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      className={`w-full h-full ${className}`}
      style={{ display: "block" }}
    />
  );
}
