import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { searchTracks, tidalTrackToAppTrack } from "@/lib/monochromeApi";
import { Track } from "@/data/mockData";
import { usePlayer } from "@/contexts/PlayerContext";
import { Play, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

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
  const navigate = useNavigate();
  const { play, currentTrack, isPlaying } = usePlayer();
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);

  const loadGenre = useCallback(async (genre: typeof GENRES[0]) => {
    setSelectedGenre(genre.id);
    setLoading(true);
    try {
      const results = await searchTracks(genre.query, 20);
      setTracks(results.map(tidalTrackToAppTrack));
    } catch (e) {
      console.error("Failed to load genre:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <h1 className="text-3xl font-bold text-foreground mb-6">Browse All</h1>

      {/* Genre Grid */}
      <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-8">
        {GENRES.map((genre) => (
          <motion.button
            key={genre.id}
            variants={fadeUp}
            onClick={() => loadGenre(genre)}
            className={`relative h-28 rounded-lg overflow-hidden text-left p-4 transition-all hover:scale-[1.02] active:scale-[0.98] ${
              selectedGenre === genre.id ? "ring-2 ring-foreground/30" : ""
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
            <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
              {tracks.map((track) => {
                const isCurrent = currentTrack?.id === track.id;
                return (
                  <motion.div
                    key={track.id}
                    variants={fadeUp}
                    className="glass-card rounded-md p-4 cursor-pointer group relative"
                    onClick={() => play(track, tracks)}
                  >
                    <div className="relative mb-4 rounded-md overflow-hidden aspect-square shadow-lg">
                      <img src={track.coverUrl} alt={track.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      <div
                        className="absolute bottom-2 right-2 w-12 h-12 rounded-full flex items-center justify-center shadow-xl opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300"
                        style={{ background: `hsl(var(--dynamic-accent))` }}
                      >
                        {isCurrent && isPlaying ? (
                          <div className="playing-bars flex items-end gap-[2px]"><span /><span /><span /></div>
                        ) : (
                          <Play className="w-5 h-5 text-foreground ml-0.5 fill-current" />
                        )}
                      </div>
                    </div>
                    <p className="text-sm font-bold text-foreground truncate">{track.title}</p>
                    <p className="text-xs text-muted-foreground truncate mt-1">{track.artist}</p>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </div>
      )}
    </motion.div>
  );
}
