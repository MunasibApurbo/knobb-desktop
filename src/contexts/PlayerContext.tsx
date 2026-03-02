import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { Track, allTracks } from "@/data/mockData";
import { getAudioEngine } from "@/lib/audioEngine";
import { getStreamUrl } from "@/lib/monochromeApi";
import { extractDominantColor } from "@/lib/colorExtractor";

interface PlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  queue: Track[];
  shuffle: boolean;
  repeat: "off" | "one" | "all";
  volume: number;
  showRightPanel: boolean;
  isLoading: boolean;
}

interface PlayerContextType extends PlayerState {
  play: (track: Track, queue?: Track[]) => void;
  togglePlay: () => void;
  next: () => void;
  previous: () => void;
  seek: (time: number) => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  setVolume: (v: number) => void;
  toggleRightPanel: () => void;
}

const PlayerContext = createContext<PlayerContextType | null>(null);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PlayerState>({
    currentTrack: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    queue: allTracks.slice(0, 15),
    shuffle: false,
    repeat: "off",
    volume: 0.75,
    showRightPanel: true,
    isLoading: false,
  });

  const engineRef = useRef(getAudioEngine());
  const stateRef = useRef(state);
  stateRef.current = state;

  // Set up audio engine callbacks once
  useEffect(() => {
    const engine = engineRef.current;

    engine.on("timeupdate", (currentTime: number, duration: number) => {
      setState((prev) => ({
        ...prev,
        currentTime,
        duration: duration || prev.currentTrack?.duration || 0,
      }));
    });

    engine.on("ended", () => {
      const s = stateRef.current;
      if (s.repeat === "one") {
        engine.seek(0);
        engine.play();
      } else if (s.queue.length > 0 && s.currentTrack) {
        const idx = s.queue.findIndex((t) => t.id === s.currentTrack!.id);
        if (idx < s.queue.length - 1 || s.repeat === "all") {
          const nextIdx = (idx + 1) % s.queue.length;
          const nextTrack = s.queue[nextIdx];
          loadAndPlay(nextTrack);
        } else {
          setState((prev) => ({ ...prev, isPlaying: false }));
        }
      } else {
        setState((prev) => ({ ...prev, isPlaying: false }));
      }
    });

    engine.on("play", () => {
      setState((prev) => ({ ...prev, isPlaying: true, isLoading: false }));
    });

    engine.on("pause", () => {
      setState((prev) => ({ ...prev, isPlaying: false }));
    });

    engine.on("error", (error: string) => {
      console.error("Audio engine error:", error);
      setState((prev) => ({ ...prev, isPlaying: false, isLoading: false }));
    });

    engine.on("loadstart", () => {
      setState((prev) => ({ ...prev, isLoading: true }));
    });

    engine.on("canplay", () => {
      setState((prev) => ({ ...prev, isLoading: false }));
    });

    // Don't destroy engine on unmount — it's a singleton and HMR will re-mount
    return () => {};
  }, []);

  // Update volume on engine
  useEffect(() => {
    engineRef.current.setVolume(state.volume);
  }, [state.volume]);

  // Update CSS accent variables when track changes
  useEffect(() => {
    if (state.currentTrack) {
      const root = document.documentElement;
      root.style.setProperty("--dynamic-accent", state.currentTrack.canvasColor);
      root.style.setProperty("--player-waveform", state.currentTrack.canvasColor);
      root.style.setProperty(
        "--dynamic-accent-glow",
        state.currentTrack.canvasColor.replace(/\)$/, "") + " / 0.3"
      );

      // Also try to extract color from the actual image
      extractDominantColor(state.currentTrack.coverUrl).then((hsl) => {
        root.style.setProperty("--dynamic-accent", hsl);
        root.style.setProperty("--player-waveform", hsl);
        root.style.setProperty("--dynamic-accent-glow", hsl + " / 0.3");
      });
    }
  }, [state.currentTrack?.id]);

  const loadAndPlay = useCallback(async (track: Track) => {
    setState((prev) => ({
      ...prev,
      currentTrack: track,
      currentTime: 0,
      duration: track.duration,
      isLoading: true,
      isPlaying: false,
    }));

    const engine = engineRef.current;

    try {
      let url = track.streamUrl;

      // If track has a Tidal ID, fetch stream URL
      if (track.tidalId && !url) {
        url = await getStreamUrl(track.tidalId, "HIGH");
        if (url) {
          // Cache the stream URL on the track
          track.streamUrl = url;
        }
      }

      if (url) {
        await engine.load(url, track.replayGain || 0, track.peak || 1);
        await engine.play();
      } else {
        console.warn("No stream URL available for track:", track.title);
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    } catch (e) {
      console.error("Failed to load track:", e);
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  const play = useCallback(
    (track: Track, queue?: Track[]) => {
      if (queue) {
        setState((prev) => ({ ...prev, queue }));
      }
      loadAndPlay(track);
    },
    [loadAndPlay]
  );

  const togglePlay = useCallback(() => {
    const engine = engineRef.current;
    if (engine.paused) {
      engine.play();
    } else {
      engine.pause();
    }
  }, []);

  const next = useCallback(() => {
    const s = stateRef.current;
    if (!s.currentTrack || s.queue.length === 0) return;

    let nextIdx: number;
    if (s.shuffle) {
      nextIdx = Math.floor(Math.random() * s.queue.length);
    } else {
      const idx = s.queue.findIndex((t) => t.id === s.currentTrack!.id);
      nextIdx = (idx + 1) % s.queue.length;
    }
    loadAndPlay(s.queue[nextIdx]);
  }, [loadAndPlay]);

  const previous = useCallback(() => {
    const s = stateRef.current;
    if (!s.currentTrack || s.queue.length === 0) return;

    // If more than 3s into track, restart; otherwise go to previous
    if (engineRef.current.currentTime > 3) {
      engineRef.current.seek(0);
      return;
    }

    const idx = s.queue.findIndex((t) => t.id === s.currentTrack!.id);
    const prevIdx = idx <= 0 ? s.queue.length - 1 : idx - 1;
    loadAndPlay(s.queue[prevIdx]);
  }, [loadAndPlay]);

  const seek = useCallback((time: number) => {
    engineRef.current.seek(time);
    setState((prev) => ({ ...prev, currentTime: time }));
  }, []);

  const toggleShuffle = useCallback(() => {
    setState((prev) => ({ ...prev, shuffle: !prev.shuffle }));
  }, []);

  const toggleRepeat = useCallback(() => {
    setState((prev) => ({
      ...prev,
      repeat: prev.repeat === "off" ? "all" : prev.repeat === "all" ? "one" : "off",
    }));
  }, []);

  const setVolume = useCallback((v: number) => {
    setState((prev) => ({ ...prev, volume: v }));
  }, []);

  const toggleRightPanel = useCallback(() => {
    setState((prev) => ({ ...prev, showRightPanel: !prev.showRightPanel }));
  }, []);

  return (
    <PlayerContext.Provider
      value={{
        ...state,
        play,
        togglePlay,
        next,
        previous,
        seek,
        toggleShuffle,
        toggleRepeat,
        setVolume,
        toggleRightPanel,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used inside PlayerProvider");
  return ctx;
}
