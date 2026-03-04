import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { Track } from "@/types/music";
import { getAudioEngine } from "@/lib/audioEngine";
import { getStreamUrl, getRecommendations, tidalTrackToAppTrack } from "@/lib/monochromeApi";
import { extractDominantColor } from "@/lib/colorExtractor";

export type AudioQuality = "LOW" | "MEDIUM" | "HIGH" | "LOSSLESS";
export type RightPanelTab = "lyrics" | "queue";

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
  rightPanelTab: RightPanelTab;
  isLoading: boolean;
  quality: AudioQuality;
  normalization: boolean;
  equalizerEnabled: boolean;
  eqGains: number[];
  crossfadeDuration: number;
  playbackSpeed: number;
}

interface PlayerContextType extends PlayerState {
  play: (track: Track, queue?: Track[]) => void;
  playAlbum: (album: { id: number | string; title: string, artist?: { name: string }, artists?: { name: string }[] }) => Promise<void>;
  togglePlay: () => void;
  next: () => void;
  previous: () => void;
  seek: (time: number) => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  setVolume: (v: number) => void;
  toggleRightPanel: () => void;
  openRightPanel: (tab: RightPanelTab) => void;
  setQuality: (q: AudioQuality) => void;
  toggleNormalization: () => void;
  toggleEqualizer: () => void;
  setEqBandGain: (bandIndex: number, gainDb: number) => void;
  crossfadeDuration: number;
  setCrossfadeDuration: (s: number) => void;
  playbackSpeed: number;
  setPlaybackSpeed: (s: number) => void;
  reorderQueue: (from: number, to: number) => void;
  removeFromQueue: (index: number) => void;
}

const PlayerContext = createContext<PlayerContextType | null>(null);

function dimWaveformColor(hsl: string, lightnessDrop = 10): string {
  const match = hsl.trim().match(
    /^(-?\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/
  );
  if (!match) return hsl;

  const hue = Number(match[1]);
  const sat = Number(match[2]);
  const light = Number(match[3]);
  const nextLight = Math.max(0, Math.min(100, light - lightnessDrop));

  return `${hue} ${sat}% ${nextLight}%`;
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PlayerState>({
    currentTrack: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    queue: [],
    shuffle: false,
    repeat: "off",
    volume: 0.75,
    showRightPanel: false,
    rightPanelTab: "lyrics" as RightPanelTab,
    isLoading: false,
    quality: (localStorage.getItem("audio-quality") as AudioQuality) || "HIGH",
    normalization: localStorage.getItem("audio-normalization") === "true",
    equalizerEnabled: localStorage.getItem("equalizer-enabled") === "true",
    eqGains: JSON.parse(localStorage.getItem("equalizer-gains") || "[0,0,0,0,0,0,0,0,0,0]"),
    crossfadeDuration: Number(localStorage.getItem("crossfade-duration") || "0"),
    playbackSpeed: Number(localStorage.getItem("playback-speed") || "1"),
  });

  const engineRef = useRef(getAudioEngine());
  const stateRef = useRef(state);
  stateRef.current = state;

  // Sync engine features
  useEffect(() => {
    engineRef.current.setNormalization(state.normalization);
  }, [state.normalization]);

  useEffect(() => {
    engineRef.current.setEqualizerEnabled(state.equalizerEnabled);
  }, [state.equalizerEnabled]);

  useEffect(() => {
    state.eqGains.forEach((gain, index) => {
      engineRef.current.setEqBandGain(index, gain);
    });
  }, []);

  useEffect(() => {
    engineRef.current.setCrossfadeDuration(state.crossfadeDuration);
  }, [state.crossfadeDuration]);

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
    const quality = stateRef.current.quality;

    try {
      let url = track.streamUrl;

      if (track.tidalId && !url) {
        url = await getStreamUrl(track.tidalId, quality);
        if (url) track.streamUrl = url;
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

  const advanceToNext = useCallback(() => {
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

  // Fetch radio tracks logic removed as Radio Mode is being removed

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
          advanceToNext();
        } else {
          setState((prev) => ({ ...prev, isPlaying: false }));
        }
      } else {
        setState((prev) => ({ ...prev, isPlaying: false }));
      }
    });

    engine.on("crossfade", async () => {
      const s = stateRef.current;
      if (!s.currentTrack || s.queue.length === 0) return;

      let nextIdx: number;
      if (s.shuffle) {
        nextIdx = Math.floor(Math.random() * s.queue.length);
      } else {
        const idx = s.queue.findIndex((t) => t.id === s.currentTrack!.id);
        if (idx === s.queue.length - 1 && s.repeat !== "all") return;
        nextIdx = (idx + 1) % s.queue.length;
      }

      const nextTrack = s.queue[nextIdx];

      setState((prev) => ({
        ...prev,
        currentTrack: nextTrack,
        currentTime: 0,
        duration: nextTrack.duration,
      }));

      let url = nextTrack.streamUrl;
      if (nextTrack.tidalId && !url) {
        url = await getStreamUrl(nextTrack.tidalId, s.quality);
        if (url) nextTrack.streamUrl = url;
      }

      if (url) {
        await engine.crossfadeInto(url, nextTrack.replayGain || 0, nextTrack.peak || 1);
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

    return () => { };
  }, [advanceToNext]);

  useEffect(() => {
    engineRef.current.setVolume(state.volume);
  }, [state.volume]);

  // Update CSS accent variables when track changes
  useEffect(() => {
    if (state.currentTrack) {
      const root = document.documentElement;
      root.style.setProperty("--dynamic-accent", state.currentTrack.canvasColor);
      root.style.setProperty("--player-waveform", dimWaveformColor(state.currentTrack.canvasColor));
      root.style.setProperty("--dynamic-accent-glow", state.currentTrack.canvasColor.replace(/\)$/, "") + " / 0.3");

      extractDominantColor(state.currentTrack.coverUrl).then((hsl) => {
        root.style.setProperty("--dynamic-accent", hsl);
        root.style.setProperty("--player-waveform", dimWaveformColor(hsl));
        root.style.setProperty("--dynamic-accent-glow", hsl + " / 0.3");
      });
    }
  }, [state.currentTrack?.id]);

  const play = useCallback(
    (track: Track, queue?: Track[]) => {
      setState((prev) => ({
        ...prev,
        showRightPanel: true,
        ...(queue ? { queue } : {}),
      }));
      loadAndPlay(track);
    },
    [loadAndPlay]
  );

  const playAlbum = useCallback(async (album: { id: number | string; title: string, artist?: { name: string }, artists?: { name: string }[] }) => {
    setState((prev) => ({ ...prev, isLoading: true }));
    try {
      const isTidal = typeof album.id === 'string' ? album.id.toString().startsWith("tidal-") : true;
      const tidalId = isTidal ? parseInt(album.id.toString().replace("tidal-", "")) : album.id as number;

      const { tracks } = await import("@/lib/monochromeApi").then(m => m.getAlbumWithTracks(tidalId));

      const knownArtist = album.artists?.map(a => a.name).join(", ") || album.artist?.name || "";
      let finalTracks = tracks;

      if (finalTracks.length === 0 && album.title) {
        finalTracks = await import("@/lib/monochromeApi").then(m => m.searchAlbumTracksByName(album.title, knownArtist));
      }

      const appTracks = finalTracks.length > 0 ? await import("@/lib/monochromeApi").then(m => finalTracks.map(m.tidalTrackToAppTrack)) : [];

      if (appTracks.length > 0) {
        play(appTracks[0], appTracks);
      } else {
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    } catch (e) {
      console.error("Failed to play album:", e);
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, [play]);

  const togglePlay = useCallback(() => {
    const engine = engineRef.current;
    if (engine.paused) engine.play();
    else engine.pause();
  }, []);

  const next = useCallback(() => advanceToNext(), [advanceToNext]);

  const previous = useCallback(() => {
    const s = stateRef.current;
    if (!s.currentTrack || s.queue.length === 0) return;
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

  const openRightPanel = useCallback((tab: RightPanelTab) => {
    setState((prev) => {
      if (prev.showRightPanel && prev.rightPanelTab === tab) {
        return { ...prev, showRightPanel: false };
      }
      return { ...prev, showRightPanel: true, rightPanelTab: tab };
    });
  }, []);

  const setQuality = useCallback((q: AudioQuality) => {
    localStorage.setItem("audio-quality", q);
    setState((prev) => ({ ...prev, quality: q }));
  }, []);

  const toggleNormalization = useCallback(() => {
    setState((prev) => {
      const next = !prev.normalization;
      localStorage.setItem("audio-normalization", String(next));
      return { ...prev, normalization: next };
    });
  }, []);

  const toggleEqualizer = useCallback(() => {
    setState((prev) => {
      const next = !prev.equalizerEnabled;
      localStorage.setItem("equalizer-enabled", String(next));
      return { ...prev, equalizerEnabled: next };
    });
  }, []);

  const setEqBandGain = useCallback((bandIndex: number, gainDb: number) => {
    setState((prev) => {
      const newGains = [...prev.eqGains];
      newGains[bandIndex] = gainDb;
      localStorage.setItem("equalizer-gains", JSON.stringify(newGains));

      engineRef.current.setEqBandGain(bandIndex, gainDb);
      return { ...prev, eqGains: newGains };
    });
  }, []);

  const setCrossfadeDuration = useCallback((seconds: number) => {
    localStorage.setItem("crossfade-duration", String(seconds));
    setState((prev) => ({ ...prev, crossfadeDuration: seconds }));
  }, []);

  const setPlaybackSpeed = useCallback((s: number) => {
    localStorage.setItem("playback-speed", String(s));
    setState((prev) => ({ ...prev, playbackSpeed: s }));
    engineRef.current.setPlaybackRate(s);
  }, []);

  const reorderQueue = useCallback((from: number, to: number) => {
    setState((prev) => {
      const newQueue = [...prev.queue];
      const [moved] = newQueue.splice(from, 1);
      newQueue.splice(to, 0, moved);
      return { ...prev, queue: newQueue };
    });
  }, []);

  const removeFromQueue = useCallback((index: number) => {
    setState((prev) => {
      const newQueue = prev.queue.filter((_, i) => i !== index);
      return { ...prev, queue: newQueue };
    });
  }, []);

  return (
    <PlayerContext.Provider
      value={{
        ...state,
        play, playAlbum, togglePlay, next, previous, seek,
        toggleShuffle, toggleRepeat, setVolume, toggleRightPanel, openRightPanel,
        setQuality, toggleNormalization, toggleEqualizer, setEqBandGain,
        setCrossfadeDuration, setPlaybackSpeed,
        reorderQueue, removeFromQueue,
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
