import { Star } from "lucide-react";
import { useFavoriteArtists } from "@/contexts/FavoriteArtistsContext";
import { ArtistCard } from "@/components/ArtistCard";
import { PageTransition } from "@/components/PageTransition";
import { UtilityPageLayout, UtilityPagePanel } from "@/components/UtilityPageLayout";
import { motion } from "framer-motion";

export default function FavoriteArtistsPage() {
  const { favoriteArtists } = useFavoriteArtists();

  return (
    <PageTransition>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="hover-desaturate-page"
      >
        <UtilityPageLayout
          eyebrow="Collection"
          title="Favorite Artists"
          description={
            <div className="space-y-1">
              <p>Keep your saved artists close to your mixes, browse flow, and listening history.</p>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/52">
                {favoriteArtists.length} artist{favoriteArtists.length === 1 ? "" : "s"} saved
              </p>
            </div>
          }
          headerVisual={
            <div className="flex h-16 w-16 items-center justify-center rounded-[var(--control-radius)] border border-white/10 bg-[hsl(var(--dynamic-accent))] shadow-[0_18px_42px_rgba(0,0,0,0.28)] sm:h-20 sm:w-20">
              <Star className="h-8 w-8 fill-white text-white sm:h-10 sm:w-10" />
            </div>
          }
        >
          {favoriteArtists.length === 0 ? (
            <UtilityPagePanel className="px-4 py-16 text-center sm:px-6">
              <Star className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-lg font-medium text-foreground">No favorite artists yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Open any artist page and tap Add.</p>
            </UtilityPagePanel>
          ) : (
            <UtilityPagePanel className="overflow-hidden p-0">
              <div className="flex flex-col gap-2 border-b border-white/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
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
            </UtilityPagePanel>
          )}
        </UtilityPageLayout>
      </motion.div>
    </PageTransition>
  );
}
