import { useRef, useEffect, useMemo, useCallback } from "react";
import { TidalLyricLine } from "@/lib/monochromeApi";

interface BeautifulLyricsProps {
  lyrics: TidalLyricLine[];
  currentTime: number;
  onSeek: (time: number) => void;
  isPlaying: boolean;
}

export function BeautifulLyrics({
  lyrics,
  currentTime,
  onSeek,
}: BeautifulLyricsProps) {
  const lineEls = useRef<(HTMLDivElement | null)[]>([]);
  const lastScrollIdx = useRef(-1);

  // Interlude detection (gaps > 8s)
  const interludeSet = useMemo(() => {
    const s = new Set<number>();
    for (let i = 0; i < lyrics.length - 1; i++) {
      if (lyrics[i + 1].time - lyrics[i].time > 8) s.add(i);
    }
    return s;
  }, [lyrics]);

  // Active index
  const activeIdx = useMemo(() => {
    if (!lyrics.length) return -1;
    let idx = -1;
    for (let i = 0; i < lyrics.length; i++) {
      if (currentTime >= lyrics[i].time) idx = i;
      else break;
    }
    return idx;
  }, [lyrics, currentTime]);

  // Auto-scroll
  useEffect(() => {
    if (activeIdx < 0 || activeIdx === lastScrollIdx.current) return;
    lastScrollIdx.current = activeIdx;
    const el = lineEls.current[activeIdx];
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeIdx]);

  const setRef = useCallback(
    (i: number) => (el: HTMLDivElement | null) => {
      lineEls.current[i] = el;
    },
    []
  );

  // Compute distance-based blur and opacity
  const getLineStyle = (i: number) => {
    if (activeIdx < 0) return {};
    const dist = Math.abs(i - activeIdx);
    if (dist === 0) return { '--line-opacity': '1', '--text-blur': '0px', fontWeight: 800 } as React.CSSProperties;
    const blur = Math.min(dist * 1.5, 6);
    const opacity = Math.max(1 - dist * 0.15, 0.3);
    return { '--line-opacity': `${opacity}`, '--text-blur': `${blur}px` } as React.CSSProperties;
  };

  return (
    <div className="beautiful-lyrics-container h-full overflow-y-auto scrollbar-thin">
      <div className="beautiful-lyrics-content py-[35vh] px-1">
        {lyrics.map((line, i) => {
          const state =
            i === activeIdx ? "active" : i < activeIdx ? "sung" : "idle";

          return (
            <div key={i}>
              <div
                ref={setRef(i)}
                data-state={state}
                className="beautiful-lyrics-line"
                style={getLineStyle(i)}
                onClick={() => onSeek(line.time)}
              >
                <span className="beautiful-lyrics-text">{line.text}</span>
              </div>
              {interludeSet.has(i) && (
                <div
                  className="beautiful-lyrics-interlude"
                  data-state={state === "active" ? "active" : "idle"}
                >
                  <span className="beautiful-lyrics-dot" />
                  <span className="beautiful-lyrics-dot" />
                  <span className="beautiful-lyrics-dot" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
