import { useCallback, useEffect, useRef } from "react";
import { usePlayer } from "@/contexts/PlayerContext";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayHistory } from "@/hooks/usePlayHistory";
import { Track } from "@/types/music";

const MIN_LISTENED_SECONDS = 1;

/**
 * Hook that records play history with real listened duration.
 * Must be used inside both AuthProvider and PlayerProvider.
 */
export function usePlayHistoryRecorder() {
  const { currentTrack, currentTime } = usePlayer();
  const { user } = useAuth();
  const { recordPlay } = usePlayHistory();
  const activeTrackRef = useRef<Track | null>(null);
  const maxProgressRef = useRef(0);

  const flushActiveTrack = useCallback(() => {
    const track = activeTrackRef.current;
    if (!track || !user) return;

    const listenedSeconds = Math.round(maxProgressRef.current);
    if (listenedSeconds < MIN_LISTENED_SECONDS) return;

    void recordPlay(track, listenedSeconds);
  }, [recordPlay, user]);

  useEffect(() => {
    if (!activeTrackRef.current) return;
    if (currentTime > maxProgressRef.current) {
      maxProgressRef.current = currentTime;
    }
  }, [currentTime]);

  useEffect(() => {
    const previousTrack = activeTrackRef.current;
    const previousTrackId = previousTrack?.id;
    const nextTrackId = currentTrack?.id;

    // Track changed or stopped: persist measured duration for previous one
    if (previousTrack && previousTrackId !== nextTrackId) {
      flushActiveTrack();
    }

    if (!currentTrack) {
      activeTrackRef.current = null;
      maxProgressRef.current = 0;
      return;
    }

    // Only reset progress when we actually switch to a different track
    if (!previousTrack || previousTrackId !== nextTrackId) {
      activeTrackRef.current = currentTrack;
      maxProgressRef.current = 0;
    }
  }, [currentTrack, flushActiveTrack]);

  useEffect(() => {
    const handleBeforeUnload = () => flushActiveTrack();
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      flushActiveTrack();
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [flushActiveTrack]);
}
