import { useEffect } from "react";
import { usePlayer } from "@/contexts/PlayerContext";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayHistory } from "@/hooks/usePlayHistory";

/**
 * Hook that auto-records play history when a track starts playing.
 * Must be used inside both AuthProvider and PlayerProvider.
 */
export function usePlayHistoryRecorder() {
  const { currentTrack, isPlaying } = usePlayer();
  const { user } = useAuth();
  const { recordPlay } = usePlayHistory();

  useEffect(() => {
    if (currentTrack && isPlaying && user) {
      recordPlay(currentTrack);
    }
    // Only record when track changes, not on every play/pause
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack?.id, user?.id]);
}
