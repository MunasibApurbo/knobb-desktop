import { useRef, useEffect, useMemo, memo } from "react";
import { motion, useSpring, useTransform } from "framer-motion";
import { TidalLyricLine } from "@/lib/monochromeApi";

interface BeautifulLyricsProps {
  lyrics: TidalLyricLine[];
  currentTime: number;
  onSeek: (time: number) => void;
  isPlaying: boolean;
}

// Interlude dots — animated during instrumental breaks
const InterludeDots = memo(({ isActive }: { isActive: boolean }) => (
  <div className="flex items-center gap-[6px] py-6 pl-1">
    {[0, 1, 2].map((i) => (
      <motion.div
        key={i}
        className="rounded-full bg-foreground"
        animate={{
          width: isActive ? 8 : 5,
          height: isActive ? 8 : 5,
          opacity: isActive ? 0.9 : 0.15,
          scale: isActive ? [1, 1.5, 1] : 1,
        }}
        transition={{
          scale: {
            repeat: isActive ? Infinity : 0,
            duration: 1.4,
            delay: i * 0.25,
            ease: "easeInOut",
          },
          default: { duration: 0.5 },
        }}
      />
    ))}
  </div>
));

// Single lyric line with Beautiful Lyrics-style rendering
const LyricLine = memo(({
  text,
  state,
  progress,
  onClick,
}: {
  text: string;
  state: "active" | "sung" | "upcoming";
  progress: number;
  onClick: () => void;
}) => {
  const scale = useSpring(1, { stiffness: 170, damping: 20 });
  const blur = useSpring(0, { stiffness: 100, damping: 16 });
  const opacity = useSpring(0.3, { stiffness: 120, damping: 18 });
  const yOffset = useSpring(0, { stiffness: 160, damping: 20 });

  useEffect(() => {
    switch (state) {
      case "active":
        scale.set(1.04);
        blur.set(0);
        opacity.set(1);
        yOffset.set(-1);
        break;
      case "sung":
        scale.set(1);
        blur.set(0);
        opacity.set(0.35);
        yOffset.set(0);
        break;
      case "upcoming":
        scale.set(0.98);
        blur.set(3.5);
        opacity.set(0.2);
        yOffset.set(0);
        break;
    }
  }, [state, scale, blur, opacity, yOffset]);

  const filterVal = useTransform(blur, (b) =>
    b > 0.05 ? `blur(${b}px)` : "none"
  );

  const pct = Math.min(Math.max(progress * 100, 0), 100);

  return (
    <motion.div
      style={{ scale, opacity, filter: filterVal, y: yOffset }}
      className="origin-left will-change-transform cursor-pointer select-none"
      onClick={onClick}
    >
      {/* Glow layer (behind text, only for active) */}
      {state === "active" && (
        <p
          className="absolute text-[1.65rem] leading-[1.55] font-extrabold pointer-events-none"
          style={{
            WebkitTextStroke: "0px",
            color: "hsl(var(--foreground))",
            filter: "blur(16px)",
            opacity: 0.35,
            maskImage: `linear-gradient(90deg, black ${pct}%, transparent ${pct}%)`,
            WebkitMaskImage: `linear-gradient(90deg, black ${pct}%, transparent ${pct}%)`,
          }}
          aria-hidden
        >
          {text}
        </p>
      )}

      {/* Main text with gradient fill */}
      <p
        className="relative text-[1.65rem] leading-[1.55] font-extrabold"
        style={
          state === "active"
            ? {
                backgroundImage: `linear-gradient(90deg, hsl(var(--foreground)) ${pct}%, hsl(var(--muted-foreground) / 0.45) ${pct}%)`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }
            : undefined
        }
      >
        {text}
      </p>
    </motion.div>
  );
});

export function BeautifulLyrics({
  lyrics,
  currentTime,
  onSeek,
}: BeautifulLyricsProps) {
  const lineRefs = useRef<(HTMLElement | null)[]>([]);
  const lastScrolledIdx = useRef(-1);

  // Active lyric index
  const activeLyricIdx = useMemo(() => {
    if (!lyrics.length) return -1;
    let idx = -1;
    for (let i = 0; i < lyrics.length; i++) {
      if (currentTime >= lyrics[i].time) idx = i;
      else break;
    }
    return idx;
  }, [lyrics, currentTime]);

  // Interludes: gaps > 5s
  const interludeSet = useMemo(() => {
    const s = new Set<number>();
    for (let i = 0; i < lyrics.length - 1; i++) {
      if (lyrics[i + 1].time - lyrics[i].time > 8) s.add(i);
    }
    return s;
  }, [lyrics]);

  // Progress within active line (0–1)
  const activeProgress = useMemo(() => {
    if (activeLyricIdx < 0) return 0;
    const start = lyrics[activeLyricIdx].time;
    const end =
      activeLyricIdx < lyrics.length - 1
        ? lyrics[activeLyricIdx + 1].time
        : start + 5;
    return Math.min(Math.max((currentTime - start) / (end - start), 0), 1);
  }, [activeLyricIdx, currentTime, lyrics]);

  // Auto-scroll
  useEffect(() => {
    if (activeLyricIdx < 0 || activeLyricIdx === lastScrolledIdx.current) return;
    lastScrolledIdx.current = activeLyricIdx;
    const el = lineRefs.current[activeLyricIdx];
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeLyricIdx]);

  return (
    <div className="h-full overflow-y-auto scrollbar-thin scroll-smooth">
      <div className="py-[35vh] space-y-[2px]">
        {lyrics.map((line, i) => {
          const state: "active" | "sung" | "upcoming" =
            i === activeLyricIdx ? "active" : i < activeLyricIdx ? "sung" : "upcoming";

          return (
            <div key={i} ref={(el) => { lineRefs.current[i] = el; }} className="relative">
              <LyricLine
                text={line.text}
                state={state}
                progress={state === "active" ? activeProgress : state === "sung" ? 1 : 0}
                onClick={() => onSeek(line.time)}
              />
              {interludeSet.has(i) && (
                <InterludeDots isActive={state === "active" && activeProgress > 0.7} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
