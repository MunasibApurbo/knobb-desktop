import { useNavigate } from "react-router-dom";
import { Star, Loader2, UserRoundX } from "lucide-react";
import { useFavoriteArtists } from "@/hooks/useFavoriteArtists";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { motion } from "framer-motion";

export default function FavoriteArtistsPage() {
  const navigate = useNavigate();
  const { favoriteArtists, loading, removeFavorite } = useFavoriteArtists();

  const handleRemove = async (artistId: number, artistName: string) => {
    const removed = await removeFavorite(artistId);
    if (removed) toast.success(`Removed ${artistName} from favorites`);
    else toast.error(`Failed to remove ${artistName}`);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="space-y-6">
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
        <div className="space-y-4">
          {favoriteArtists.map((artist) => (
            <div key={artist.id} className="relative group">
              <button
                className="relative w-full text-left overflow-hidden border border-white/10 hover:border-white/20 transition-colors h-44 sm:h-52 lg:h-56"
                onClick={() => navigate(`/artist/${artist.artist_id}?name=${encodeURIComponent(artist.artist_name)}`)}
              >
                <img
                  src={artist.artist_image_url || "/placeholder.svg"}
                  alt={artist.artist_name}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg"; }}
                />
                <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/45 to-black/20" />
                <div className="absolute inset-y-0 left-0 w-[58%] bg-gradient-to-r from-amber-900/50 via-amber-800/20 to-transparent" />
                <div className="relative z-10 h-full flex flex-col justify-end p-5 sm:p-6">
                  <h2 className="text-white font-black tracking-tight leading-[0.95] text-3xl sm:text-4xl max-w-[70%] break-words">
                    {artist.artist_name}
                  </h2>
                </div>
              </button>

              <Button
                variant="ghost"
                size="icon"
                className="absolute top-3 right-3 w-9 h-9 bg-black/45 hover:bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => handleRemove(artist.artist_id, artist.artist_name)}
              >
                <UserRoundX className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
