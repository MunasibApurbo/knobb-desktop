import { useRef, useEffect, useCallback } from "react";
import { getAudioEngine } from "@/lib/audioEngine";
import { usePlayer } from "@/contexts/PlayerContext";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
  hue: number;
}

export function ParticlesVisualizer({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
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

    // Fade previous frame
    ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
    ctx.fillRect(0, 0, w, h);

    const engine = getAudioEngine();
    const freqData = engine.getFrequencyData();

    // Calculate energy bands
    const bass = average(freqData, 0, 10) / 255;
    const mid = average(freqData, 10, 100) / 255;
    const high = average(freqData, 100, 300) / 255;
    const energy = (bass * 0.5 + mid * 0.3 + high * 0.2);

    const accentHsl = getComputedStyle(document.documentElement)
      .getPropertyValue("--player-waveform")
      .trim();
    const hueMatch = accentHsl.match(/^(\d+)/);
    const baseHue = hueMatch ? parseInt(hueMatch[1]) : 220;

    // Spawn particles based on energy
    const spawnCount = Math.floor(energy * 8);
    for (let i = 0; i < spawnCount; i++) {
      particlesRef.current.push({
        x: w / 2 + (Math.random() - 0.5) * w * 0.3,
        y: h / 2 + (Math.random() - 0.5) * h * 0.3,
        vx: (Math.random() - 0.5) * energy * 6,
        vy: (Math.random() - 0.5) * energy * 6 - energy * 2,
        size: 1 + Math.random() * 3 * energy,
        life: 0,
        maxLife: 40 + Math.random() * 60,
        hue: baseHue + (Math.random() - 0.5) * 40,
      });
    }

    // Limit particles
    if (particlesRef.current.length > 500) {
      particlesRef.current = particlesRef.current.slice(-500);
    }

    // Update and draw particles
    particlesRef.current = particlesRef.current.filter((p) => {
      p.life++;
      if (p.life > p.maxLife) return false;

      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.02; // slight gravity
      p.vx *= 0.99;
      p.vy *= 0.99;

      const alpha = 1 - p.life / p.maxLife;
      const size = p.size * (1 - p.life / p.maxLife * 0.5);

      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${p.hue}, 70%, 60%, ${alpha * 0.8})`;
      ctx.fill();

      // Glow effect
      ctx.beginPath();
      ctx.arc(p.x, p.y, size * 2, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${p.hue}, 70%, 60%, ${alpha * 0.15})`;
      ctx.fill();

      return true;
    });

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
      style={{ display: "block", background: "transparent" }}
    />
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
