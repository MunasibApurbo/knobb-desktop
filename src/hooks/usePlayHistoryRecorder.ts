import { useCallback, useEffect, useRef } from "react";
import { usePlayer } from "@/contexts/PlayerContext";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { usePlayHistory } from "@/hooks/usePlayHistory";
import {
  submitListenBrainzNowPlaying,
  submitListenBrainzScrobble,
} from "@/lib/externalScrobbling";
import { Track } from "@/types/music";

const MIN_LISTENED_SECONDS = 1;

/**
 * Hook that records play history with real listened duration.
 * Must be used inside both AuthProvider and PlayerProvider.
 */
export function usePlayHistoryRecorder() {
  const { currentTrack, currentTime } = usePlayer();
  const { user } = useAuth();
  const { scrobblePercent } = useSettings();
  const { recordPlay } = usePlayHistory();
  const activeTrackRef = useRef<Track | null>(null);
  const maxProgressRef = useRef(0);
  const lastNowPlayingTrackIdRef = useRef<string | null>(null);
  const lastScrobbledTrackKeyRef = useRef<string | null>(null);

  const parsedScrobblePercent = Number.parseInt(scrobblePercent, 10);
  const normalizedScrobblePercent = Number.isFinite(parsedScrobblePercent)
    ? Math.min(95, Math.max(5, parsedScrobblePercent))
    : 50;

  const flushActiveTrack = useCallback(() => {
    const track = activeTrackRef.current;
    if (!track || !user) return;

    const listenedSeconds = Math.round(maxProgressRef.current);
    if (listenedSeconds < MIN_LISTENED_SECONDS) return;

    void recordPlay(track, listenedSeconds, {
      scrobblePercent: normalizedScrobblePercent,
      contextType: "player",
      contextId: "main",
    });

    const scrobbleKey = `${track.id}:${listenedSeconds}:${normalizedScrobblePercent}`;
    if (lastScrobbledTrackKeyRef.current === scrobbleKey) return;

    lastScrobbledTrackKeyRef.current = scrobbleKey;
    void submitListenBrainzScrobble(track, listenedSeconds, normalizedScrobblePercent).catch((error) => {
      console.error("ListenBrainz scrobble failed", error);
    });
  }, [normalizedScrobblePercent, recordPlay, user]);

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
      lastNowPlayingTrackIdRef.current = null;
      return;
    }

    // Only reset progress when we actually switch to a different track
    if (!previousTrack || previousTrackId !== nextTrackId) {
      activeTrackRef.current = currentTrack;
      maxProgressRef.current = 0;

      if (lastNowPlayingTrackIdRef.current !== currentTrack.id) {
        lastNowPlayingTrackIdRef.current = currentTrack.id;
        void submitListenBrainzNowPlaying(currentTrack).catch((error) => {
          console.error("ListenBrainz now playing failed", error);
        });
      }
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
