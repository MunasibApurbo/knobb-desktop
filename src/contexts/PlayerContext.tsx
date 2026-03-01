import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { Track, allTracks } from "@/data/mockData";

interface PlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  queue: Track[];
  shuffle: boolean;
  repeat: "off" | "one" | "all";
  volume: number;
  showRightPanel: boolean;
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
    currentTrack: allTracks[0],
    isPlaying: false,
    currentTime: 42,
    queue: allTracks.slice(0, 15),
    shuffle: false,
    repeat: "off",
    volume: 0.75,
    showRightPanel: true,
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Simulate playback timer
  useEffect(() => {
    if (state.isPlaying) {
      intervalRef.current = setInterval(() => {
        setState((prev) => {
          if (!prev.currentTrack) return prev;
          const next = prev.currentTime + 1;
          if (next >= prev.currentTrack.duration) {
            return { ...prev, currentTime: 0, isPlaying: false };
          }
          return { ...prev, currentTime: next };
        });
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [state.isPlaying]);

  // Update CSS accent variables when track changes
  useEffect(() => {
    if (state.currentTrack) {
      const root = document.documentElement;
      root.style.setProperty("--dynamic-accent", state.currentTrack.canvasColor);
      root.style.setProperty("--player-waveform", state.currentTrack.canvasColor);
      root.style.setProperty("--dynamic-accent-glow", state.currentTrack.canvasColor.replace(/\)$/, "") + " / 0.3");
    }
  }, [state.currentTrack]);

  const play = useCallback((track: Track, queue?: Track[]) => {
    setState((prev) => ({
      ...prev,
      currentTrack: track,
      isPlaying: true,
      currentTime: 0,
      queue: queue || prev.queue,
    }));
  }, []);

  const togglePlay = useCallback(() => {
    setState((prev) => ({ ...prev, isPlaying: !prev.isPlaying }));
  }, []);

  const next = useCallback(() => {
    setState((prev) => {
      if (!prev.currentTrack || prev.queue.length === 0) return prev;
      const idx = prev.queue.findIndex((t) => t.id === prev.currentTrack!.id);
      const nextIdx = (idx + 1) % prev.queue.length;
      return { ...prev, currentTrack: prev.queue[nextIdx], currentTime: 0, isPlaying: true };
    });
  }, []);

  const previous = useCallback(() => {
    setState((prev) => {
      if (!prev.currentTrack || prev.queue.length === 0) return prev;
      const idx = prev.queue.findIndex((t) => t.id === prev.currentTrack!.id);
      const prevIdx = idx <= 0 ? prev.queue.length - 1 : idx - 1;
      return { ...prev, currentTrack: prev.queue[prevIdx], currentTime: 0, isPlaying: true };
    });
  }, []);

  const seek = useCallback((time: number) => {
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
      value={{ ...state, play, togglePlay, next, previous, seek, toggleShuffle, toggleRepeat, setVolume, toggleRightPanel }}
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
