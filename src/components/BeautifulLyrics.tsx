import { useRef, useEffect, useMemo } from "react";
import { motion, useSpring, useTransform } from "framer-motion";
import { TidalLyricLine } from "@/lib/monochromeApi";

interface BeautifulLyricsProps {
  lyrics: TidalLyricLine[];
  currentTime: number;
  onSeek: (time: number) => void;
  isPlaying: boolean;
}

// Interlude dots component for instrumental breaks
function InterludeDots({ isActive }: { isActive: boolean }) {
  return (
    <div className="flex items-center gap-2 py-4 h-12">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="rounded-full bg-foreground"
          animate={{
            width: isActive ? 8 : 6,
            height: isActive ? 8 : 6,
            opacity: isActive ? 1 : 0.2,
            scale: isActive ? [1, 1.4, 1] : 1,
          }}
          transition={{
            scale: {
              repeat: isActive ? Infinity : 0,
              duration: 1.2,
              delay: i * 0.2,
              ease: "easeInOut",
            },
            default: { duration: 0.4 },
          }}
        />
      ))}
    </div>
  );
}

// Individual lyric line with Beautiful Lyrics-style effects
function LyricLine({
  line,
  state,
  progress,
  onClick,
}: {
  line: TidalLyricLine;
  state: "active" | "sung" | "upcoming";
  progress: number; // 0-1 for gradient fill on active line
  onClick: () => void;
}) {
  const scale = useSpring(1, { stiffness: 200, damping: 20 });
  const blur = useSpring(0, { stiffness: 120, damping: 18 });
  const opacity = useSpring(0.3, { stiffness: 150, damping: 20 });
  const glowOpacity = useSpring(0, { stiffness: 100, damping: 15 });
  const yOffset = useSpring(0, { stiffness: 180, damping: 22 });

  useEffect(() => {
    if (state === "active") {
      scale.set(1.05);
      blur.set(0);
      opacity.set(1);
      glowOpacity.set(1);
      yOffset.set(-2);
    } else if (state === "sung") {
      scale.set(1);
      blur.set(0);
      opacity.set(0.4);
      glowOpacity.set(0);
      yOffset.set(0);
    } else {
      scale.set(1);
      blur.set(4);
      opacity.set(0.25);
      glowOpacity.set(0);
      yOffset.set(0);
    }
  }, [state, scale, blur, opacity, glowOpacity, yOffset]);

  const filterStr = useTransform(blur, (b) =>
    b > 0.1 ? `blur(${b}px)` : "none"
  );

  // Gradient fill: text fills from left to right based on progress
  const gradientProgress = Math.min(Math.max(progress * 100, 0), 100);

  return (
    <motion.p
      style={{
        scale,
        opacity,
        filter: filterStr,
        y: yOffset,
      }}
      className="text-[1.7rem] leading-[1.5] font-bold cursor-pointer select-none origin-left py-1 transition-none will-change-transform"
      onClick={onClick}
    >
      <motion.span
        style={{
          backgroundImage:
            state === "active"
              ? `linear-gradient(90deg, hsl(var(--foreground)) ${gradientProgress}%, hsl(var(--muted-foreground)) ${gradientProgress}%)`
              : undefined,
          WebkitBackgroundClip: state === "active" ? "text" : undefined,
          WebkitTextFillColor: state === "active" ? "transparent" : undefined,
          backgroundClip: state === "active" ? "text" : undefined,
          textShadow:
            state === "active"
              ? `0 0 20px hsl(var(--dynamic-accent-glow)), 0 0 40px hsl(var(--dynamic-accent-glow))`
              : undefined,
        }}
        className={
          state === "active"
            ? "text-foreground"
            : state === "sung"
            ? "text-muted-foreground"
            : "text-muted-foreground"
        }
      >
        {line.text}
      </motion.span>
    </motion.p>
  );
}

export function BeautifulLyrics({
  lyrics,
  currentTime,
  onSeek,
  isPlaying,
}: BeautifulLyricsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLElement | null)[]>([]);
  const lastScrolledIdx = useRef(-1);

  // Find active lyric index
  const activeLyricIdx = useMemo(() => {
    if (lyrics.length === 0) return -1;
    let idx = -1;
    for (let i = 0; i < lyrics.length; i++) {
      if (currentTime >= lyrics[i].time) idx = i;
      else break;
    }
    return idx;
  }, [lyrics, currentTime]);

  // Detect interludes (gaps > 5 seconds between lines)
  const interludeMap = useMemo(() => {
    const map = new Map<number, boolean>();
    for (let i = 0; i < lyrics.length - 1; i++) {
      const gap = lyrics[i + 1].time - (lyrics[i].time + 4); // rough estimate
      if (gap > 5) map.set(i, true);
    }
    return map;
  }, [lyrics]);

  // Calculate progress within active line
  const activeProgress = useMemo(() => {
    if (activeLyricIdx < 0) return 0;
    const start = lyrics[activeLyricIdx].time;
    const end =
      activeLyricIdx < lyrics.length - 1
        ? lyrics[activeLyricIdx + 1].time
        : start + 5;
    const elapsed = currentTime - start;
    const dur = end - start;
    return Math.min(Math.max(elapsed / dur, 0), 1);
  }, [activeLyricIdx, currentTime, lyrics]);

  // Auto-scroll to active line
  useEffect(() => {
    if (activeLyricIdx < 0 || activeLyricIdx === lastScrolledIdx.current) return;
    lastScrolledIdx.current = activeLyricIdx;
    const el = lineRefs.current[activeLyricIdx];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeLyricIdx]);

  return (
    <div
      ref={containerRef}
      className="h-full overflow-y-auto scrollbar-thin scroll-smooth"
    >
      <div className="space-y-1 py-[35vh]">
        {lyrics.map((line, i) => {
          const state: "active" | "sung" | "upcoming" =
            i === activeLyricIdx
              ? "active"
              : i < activeLyricIdx
              ? "sung"
              : "upcoming";

          const showInterlude =
            interludeMap.has(i) &&
            state === "active" &&
            activeProgress > 0.85;

          return (
            <div
              key={i}
              ref={(el) => {
                lineRefs.current[i] = el;
              }}
            >
              <LyricLine
                line={line}
                state={state}
                progress={state === "active" ? activeProgress : state === "sung" ? 1 : 0}
                onClick={() => onSeek(line.time)}
              />
              {interludeMap.has(i) && (
                <InterludeDots
                  isActive={
                    i === activeLyricIdx ||
                    (i === activeLyricIdx - 1 &&
                      activeLyricIdx < lyrics.length &&
                      currentTime < lyrics[activeLyricIdx].time + 1)
                  }
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
