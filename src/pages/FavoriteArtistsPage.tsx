import { Star, Loader2 } from "lucide-react";
import { useFavoriteArtists } from "@/contexts/FavoriteArtistsContext";
import { ArtistCard } from "@/components/ArtistCard";
import { motion } from "framer-motion";

export default function FavoriteArtistsPage() {
  const { favoriteArtists, loading } = useFavoriteArtists();

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="hover-desaturate-page space-y-6"
    >
      {/* Hero Banner */}
      <div
        className="flex items-end gap-6 pb-8 -mt-16 px-6 pt-20"
        style={{ background: "linear-gradient(180deg, hsl(250 80% 60% / 0.5) 0%, transparent 100%)" }}
      >
        <div className="w-48 h-48 md:w-56 md:h-56 shadow-2xl shrink-0 flex items-center justify-center " style={{ background: `hsl(var(--dynamic-accent))` }}>
          <Star className="w-20 h-20 text-white fill-white" />
        </div>
        <div className="flex flex-col justify-end min-w-0">
          <p className="text-xs font-bold text-foreground/70 uppercase">Collection</p>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mt-2 mb-4 tracking-tight">Favorite Artists</h1>
          <div className="flex items-center gap-1 text-sm text-foreground/80">
            <span>{favoriteArtists.length} artist{favoriteArtists.length === 1 ? "" : "s"}</span>
          </div>
        </div>
      </div>

      {favoriteArtists.length === 0 ? (
        <div className="text-center py-16">
          <Star className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground text-lg font-medium">No favorite artists yet</p>
          <p className="text-muted-foreground/60 text-sm mt-1">Open any artist page and tap Add</p>
        </div>
      ) : (
        <section className="border border-white/10 bg-white/[0.02]">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
            <h2 className="text-lg font-bold text-foreground">Saved Artists</h2>
            <p className="text-sm text-muted-foreground">{favoriteArtists.length} artists</p>
          </div>
          <div className="hover-desaturate-grid media-card-grid gap-0 border-l border-t border-white/10">
            {favoriteArtists.map((artist) => (
              <ArtistCard
                key={artist.id}
                id={artist.artist_id}
                name={artist.artist_name}
                imageUrl={artist.artist_image_url}
              />
            ))}
          </div>
        </section>
      )}
    </motion.div>
  );
}
