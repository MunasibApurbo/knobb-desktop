import { useRef, useEffect, useMemo, useCallback } from "react";
import { useAnimationFrame } from "framer-motion";
import { TidalLyricLine } from "@/lib/monochromeApi";

interface BeautifulLyricsProps {
  lyrics: TidalLyricLine[];
  currentTime: number;
  onSeek: (time: number) => void;
  isPlaying: boolean;
}

// Simple spring class matching Beautiful Lyrics' LegacySpring
class Spring {
  value: number;
  target: number;
  velocity = 0;

  constructor(
    initial: number,
    private damping: number,
    private frequency: number
  ) {
    this.value = initial;
    this.target = initial;
  }

  set(v: number) {
    this.value = v;
    this.target = v;
    this.velocity = 0;
  }

  update(dt: number): number {
    // Clamped damped spring
    dt = Math.min(dt, 0.064);
    const angularFreq = this.frequency * Math.PI * 2;
    const damping = this.damping * 2 * angularFreq;
    const springForce = angularFreq * angularFreq * (this.target - this.value);
    const dampForce = -damping * this.velocity;
    this.velocity += (springForce + dampForce) * dt;
    this.value += this.velocity * dt;
    return this.value;
  }

  isSleeping(): boolean {
    return (
      Math.abs(this.target - this.value) < 0.001 &&
      Math.abs(this.velocity) < 0.001
    );
  }
}

// Spline interpolation helper (matching Beautiful Lyrics' GetSpline)
function evalSpline(points: { Time: number; Value: number }[], t: number): number {
  t = Math.max(0, Math.min(1, t));
  for (let i = 0; i < points.length - 1; i++) {
    if (t >= points[i].Time && t <= points[i + 1].Time) {
      const local =
        (t - points[i].Time) / (points[i + 1].Time - points[i].Time);
      return points[i].Value + (points[i + 1].Value - points[i].Value) * local;
    }
  }
  return points[points.length - 1].Value;
}

// Visual constants from the actual Beautiful Lyrics source
const GLOW_RANGE = [
  { Time: 0, Value: 0 },
  { Time: 0.5, Value: 1 },
  { Time: 0.925, Value: 1 },
  { Time: 1, Value: 0 },
];

const IDLE_OPACITY = 0.51;
const ACTIVE_OPACITY = 1;
const SUNG_OPACITY = 0.497;

// Per-line state for imperative animation
interface LineState {
  el: HTMLElement | null;
  glowSpring: Spring;
  state: "Idle" | "Active" | "Sung";
  startTime: number;
  endTime: number;
}

export function BeautifulLyrics({
  lyrics,
  currentTime,
  onSeek,
  isPlaying,
}: BeautifulLyricsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const linesRef = useRef<LineState[]>([]);
  const lastScrollIdx = useRef(-1);

  // Interlude detection
  const interludeIndices = useMemo(() => {
    const set = new Set<number>();
    for (let i = 0; i < lyrics.length - 1; i++) {
      if (lyrics[i + 1].time - lyrics[i].time > 8) set.add(i);
    }
    return set;
  }, [lyrics]);

  // Initialize line states when lyrics change
  useEffect(() => {
    linesRef.current = lyrics.map((line, i) => ({
      el: null,
      glowSpring: new Spring(0, 0.5, 1),
      state: "Idle",
      startTime: line.time,
      endTime: i < lyrics.length - 1 ? lyrics[i + 1].time : line.time + 5,
    }));
  }, [lyrics]);

  // Set element ref
  const setLineRef = useCallback(
    (i: number) => (el: HTMLDivElement | null) => {
      if (linesRef.current[i]) {
        linesRef.current[i].el = el;
      }
    },
    []
  );

  // Find active index
  const getActiveIdx = useCallback(
    (time: number) => {
      let idx = -1;
      for (let i = 0; i < lyrics.length; i++) {
        if (time >= lyrics[i].time) idx = i;
        else break;
      }
      return idx;
    },
    [lyrics]
  );

  // Animation loop — updates CSS variables directly for performance
  useAnimationFrame((_, delta) => {
    const dt = delta / 1000;
    const time = currentTime;
    const activeIdx = getActiveIdx(time);

    for (let i = 0; i < linesRef.current.length; i++) {
      const ls = linesRef.current[i];
      if (!ls.el) continue;

      const relTime = time - ls.startTime;
      const duration = ls.endTime - ls.startTime;
      const timeScale = Math.max(0, Math.min(relTime / duration, 1));

      const pastStart = relTime >= 0;
      const beforeEnd = relTime <= duration;
      const isActive = pastStart && beforeEnd;

      const newState: "Idle" | "Active" | "Sung" = isActive
        ? "Active"
        : pastStart
        ? "Sung"
        : "Idle";

      // Update glow spring
      const glowTarget = evalSpline(GLOW_RANGE, timeScale);
      if (isActive) {
        ls.glowSpring.target = glowTarget;
      } else if (newState !== ls.state) {
        ls.glowSpring.set(0);
      }
      const glowAlpha = ls.glowSpring.update(dt);

      // Gradient progress: 0% → 120% as time progresses
      const gradientProgress = isActive ? timeScale * 120 : newState === "Sung" ? 120 : 0;

      // Glow text-shadow
      const glowBlur = 4 + 8 * glowAlpha;
      const glowOpacity = glowAlpha * 0.5;

      // Opacity
      const opacity =
        newState === "Active"
          ? ACTIVE_OPACITY
          : newState === "Sung"
          ? SUNG_OPACITY
          : IDLE_OPACITY;

      // Scale
      const scale = newState === "Active" ? 1.05 : 1;

      // Distance-based blur (like Beautiful Lyrics' SetBlur)
      const distance = Math.abs(i - activeIdx);
      const textBlur =
        activeIdx < 0
          ? 0
          : newState === "Active" || newState === "Sung"
          ? 0
          : Math.min(distance * 1.5, 6);

      // Apply CSS variables directly
      const style = ls.el.style;
      style.setProperty("--gradient-progress", `${gradientProgress}%`);
      style.setProperty("--text-shadow-blur", `${glowBlur}px`);
      style.setProperty("--text-shadow-opacity", `${glowOpacity}`);
      style.setProperty("--line-opacity", `${opacity}`);
      style.setProperty("--line-scale", `${scale}`);
      style.setProperty("--text-blur", `${textBlur}px`);

      // Toggle class for gradient state
      if (newState === "Active") {
        ls.el.setAttribute("data-state", "active");
      } else if (newState === "Sung") {
        ls.el.setAttribute("data-state", "sung");
      } else {
        ls.el.setAttribute("data-state", "idle");
      }

      ls.state = newState;
    }

    // Auto-scroll
    if (activeIdx >= 0 && activeIdx !== lastScrollIdx.current) {
      lastScrollIdx.current = activeIdx;
      const el = linesRef.current[activeIdx]?.el;
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });

  return (
    <div
      ref={containerRef}
      className="beautiful-lyrics-container h-full overflow-y-auto scrollbar-thin"
    >
      <div className="beautiful-lyrics-content py-[35vh]">
        {lyrics.map((line, i) => (
          <div key={i}>
            <div
              ref={setLineRef(i)}
              data-state="idle"
              className="beautiful-lyrics-line"
              onClick={() => onSeek(line.time)}
            >
              <span className="beautiful-lyrics-text">{line.text}</span>
            </div>
            {interludeIndices.has(i) && (
              <div className="beautiful-lyrics-interlude" data-state="idle">
                <span className="beautiful-lyrics-dot" />
                <span className="beautiful-lyrics-dot" />
                <span className="beautiful-lyrics-dot" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
