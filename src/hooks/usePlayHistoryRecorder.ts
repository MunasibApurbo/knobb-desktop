import { useCallback, useEffect, useRef } from "react";
import { usePlayer, usePlayerTimeline } from "@/contexts/PlayerContext";
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
  const { currentTrack, isPlaying } = usePlayer();
  const { currentTime } = usePlayerTimeline();
  const { user } = useAuth();
  const { scrobblePercent } = useSettings();
  const { recordPlay } = usePlayHistory();
  const activeTrackRef = useRef<Track | null>(null);
  const accumulatedSecondsRef = useRef(0);
  const lastNowPlayingTrackIdRef = useRef<string | null>(null);
  const lastScrobbledTrackKeyRef = useRef<string | null>(null);
  const lastObservationRef = useRef<{
    trackId: string | null;
    observedAt: number;
    wasPlaying: boolean;
  }>({
    trackId: null,
    observedAt: 0,
    wasPlaying: false,
  });

  const parsedScrobblePercent = Number.parseInt(scrobblePercent, 10);
  const normalizedScrobblePercent = Number.isFinite(parsedScrobblePercent)
    ? Math.min(95, Math.max(5, parsedScrobblePercent))
    : 50;

  const syncAccumulatedListening = useCallback((observedAt: number) => {
    const activeTrack = activeTrackRef.current;
    const lastObservation = lastObservationRef.current;

    if (!activeTrack || lastObservation.trackId !== activeTrack.id || !lastObservation.wasPlaying) return;

    const elapsedSeconds = Math.max(0, (observedAt - lastObservation.observedAt) / 1000);
    if (elapsedSeconds <= 0) return;

    accumulatedSecondsRef.current += elapsedSeconds;
  }, []);

  const flushActiveTrack = useCallback(() => {
    const track = activeTrackRef.current;
    if (!track || !user) return;

    syncAccumulatedListening(Date.now());

    const listenedSeconds = Math.round(accumulatedSecondsRef.current);
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
  }, [normalizedScrobblePercent, recordPlay, syncAccumulatedListening, user]);

  useEffect(() => {
    syncAccumulatedListening(Date.now());
    lastObservationRef.current = {
      trackId: currentTrack?.id ?? null,
      observedAt: Date.now(),
      wasPlaying: isPlaying,
    };
  }, [currentTime, currentTrack?.id, isPlaying, syncAccumulatedListening]);

  useEffect(() => {
    const observedAt = Date.now();
    syncAccumulatedListening(observedAt);

    const previousTrack = activeTrackRef.current;
    const previousTrackId = previousTrack?.id;
    const nextTrackId = currentTrack?.id;

    // Track changed or stopped: persist measured duration for previous one
    if (previousTrack && previousTrackId !== nextTrackId) {
      flushActiveTrack();
    }

    if (!currentTrack) {
      activeTrackRef.current = null;
      accumulatedSecondsRef.current = 0;
      lastNowPlayingTrackIdRef.current = null;
      lastObservationRef.current = {
        trackId: null,
        observedAt,
        wasPlaying: false,
      };
      return;
    }

    // Only reset accumulated time when we actually switch to a different track
    if (!previousTrack || previousTrackId !== nextTrackId) {
      activeTrackRef.current = currentTrack;
      accumulatedSecondsRef.current = 0;

      if (lastNowPlayingTrackIdRef.current !== currentTrack.id) {
        lastNowPlayingTrackIdRef.current = currentTrack.id;
        void submitListenBrainzNowPlaying(currentTrack).catch((error) => {
          console.error("ListenBrainz now playing failed", error);
        });
      }
    }

    lastObservationRef.current = {
      trackId: currentTrack.id,
      observedAt,
      wasPlaying: isPlaying,
    };
  }, [currentTrack, flushActiveTrack, isPlaying, syncAccumulatedListening]);

  useEffect(() => {
    const handleBeforeUnload = () => flushActiveTrack();
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      flushActiveTrack();
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [flushActiveTrack]);
}
