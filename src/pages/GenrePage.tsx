import { useState, useCallback } from "react";
import { filterAudioTracks, searchTracks, tidalTrackToAppTrack } from "@/lib/musicApi";
import { Track } from "@/types/music";
import { usePlayer } from "@/contexts/PlayerContext";
import { Play, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { ArtistsLink } from "@/components/ArtistsLink";
import { TrackContextMenu } from "@/components/TrackContextMenu";
import {
  MEDIA_CARD_ACTION_ICON_CLASS,
  MEDIA_CARD_META_CLASS,
  MEDIA_CARD_TITLE_CLASS,
} from "@/components/mediaCardStyles";
import { isSameTrack } from "@/lib/trackIdentity";

const GENRES = [
  { id: "pop", label: "Pop", query: "pop hits 2025", color: "330 80% 55%" },
  { id: "hiphop", label: "Hip-Hop", query: "hip hop new 2025", color: "35 90% 55%" },
  { id: "rock", label: "Rock", query: "rock anthems", color: "0 70% 50%" },
  { id: "electronic", label: "Electronic", query: "electronic dance", color: "200 80% 55%" },
  { id: "rnb", label: "R&B", query: "r&b soul 2025", color: "280 60% 55%" },
  { id: "jazz", label: "Jazz", query: "jazz classics modern", color: "45 70% 50%" },
  { id: "classical", label: "Classical", query: "classical masterpieces", color: "220 50% 55%" },
  { id: "indie", label: "Indie", query: "indie alternative", color: "160 60% 45%" },
  { id: "latin", label: "Latin", query: "latin reggaeton 2025", color: "15 85% 55%" },
  { id: "kpop", label: "K-Pop", query: "kpop trending", color: "310 70% 60%" },
  { id: "metal", label: "Metal", query: "heavy metal", color: "0 0% 35%" },
  { id: "country", label: "Country", query: "country hits 2025", color: "30 60% 45%" },
];

const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.04 } } };
const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

export default function GenrePage() {
  const { play, currentTrack, isPlaying } = usePlayer();
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);

  const loadGenre = useCallback(async (genre: typeof GENRES[0]) => {
    setSelectedGenre(genre.id);
    setLoading(true);
    try {
      const results = await searchTracks(genre.query, 20);
      setTracks(filterAudioTracks(results.map(t => tidalTrackToAppTrack(t))));
    } catch (e) {
      console.error("Failed to load genre:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <h1 className="text-2xl font-bold text-foreground mb-6">Browse All</h1>

      {/* Genre Grid */}
      <motion.div variants={stagger} initial="hidden" animate="show" className="media-card-grid gap-4 mb-8">
        {GENRES.map((genre) => (
          <motion.button
            key={genre.id}
            variants={fadeUp}
            onClick={() => loadGenre(genre)}
            className={`relative h-28  overflow-hidden text-left p-4 transition-all hover:scale-[1.02] active:scale-[0.98] ${selectedGenre === genre.id ? "ring-2 ring-foreground/30" : ""
              }`}
            style={{
              background: `linear-gradient(135deg, hsl(${genre.color}), hsl(${genre.color} / 0.6))`,
            }}
          >
            <span className="text-lg font-bold text-white drop-shadow-md">{genre.label}</span>
          </motion.button>
        ))}
      </motion.div>

      {/* Genre Results */}
      {selectedGenre && (
        <div>
          <h2 className="text-xl font-bold text-foreground mb-4">
            {GENRES.find((g) => g.id === selectedGenre)?.label}
          </h2>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <motion.div variants={stagger} initial="hidden" animate="show" className="media-card-grid gap-5">
              {tracks.map((track) => {
                const isCurrent = isSameTrack(currentTrack, track);
                return (
                  <TrackContextMenu key={track.id} track={track} tracks={tracks}>
                    <motion.div
                      variants={fadeUp}
                      className="media-card-shell relative group cursor-pointer transition-opacity hover:opacity-80"
                      onClick={() => play(track, tracks)}
                    >
                      <div className="relative mb-2 overflow-hidden aspect-square shadow-sm">
                        <img src={track.coverUrl} alt={track.title} className="media-card-artwork w-full h-full object-cover" />
                        <div
                          className="media-card-hover-control media-card-hover-control-left absolute flex items-center justify-center shadow-xl"
                          style={{ background: `hsl(var(--dynamic-accent))` }}
                        >
                          {isCurrent && isPlaying ? (
                            <div className="playing-bars flex items-end gap-[2px]"><span /><span /><span /></div>
                          ) : (
                            <Play className={`${MEDIA_CARD_ACTION_ICON_CLASS} text-foreground ml-0.5 fill-current`} />
                          )}
                        </div>
                      </div>
                      <p className={`${MEDIA_CARD_TITLE_CLASS} font-medium mt-1 truncate`}>{track.title}</p>
                      <ArtistsLink
                        name={track.artist}
                        artists={track.artists}
                        artistId={track.artistId}
                        className={`${MEDIA_CARD_META_CLASS} truncate block`}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </motion.div>
                  </TrackContextMenu>
                );
              })}
            </motion.div>
          )}
        </div>
      )}
    </motion.div>
  );
}
