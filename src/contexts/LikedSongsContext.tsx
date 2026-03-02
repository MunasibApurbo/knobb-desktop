import React, { createContext, useContext, useState, useCallback } from "react";
import { Track } from "@/data/mockData";

interface LikedSongsContextType {
  likedSongs: Track[];
  isLiked: (trackId: string) => boolean;
  toggleLike: (track: Track) => void;
}

const LikedSongsContext = createContext<LikedSongsContextType | null>(null);

export function LikedSongsProvider({ children }: { children: React.ReactNode }) {
  const [likedSongs, setLikedSongs] = useState<Track[]>([]);

  const isLiked = useCallback(
    (trackId: string) => likedSongs.some((t) => t.id === trackId),
    [likedSongs]
  );

  const toggleLike = useCallback((track: Track) => {
    setLikedSongs((prev) =>
      prev.some((t) => t.id === track.id)
        ? prev.filter((t) => t.id !== track.id)
        : [track, ...prev]
    );
  }, []);

  return (
    <LikedSongsContext.Provider value={{ likedSongs, isLiked, toggleLike }}>
      {children}
    </LikedSongsContext.Provider>
  );
}

export function useLikedSongs() {
  const ctx = useContext(LikedSongsContext);
  if (!ctx) throw new Error("useLikedSongs must be used inside LikedSongsProvider");
  return ctx;
}
