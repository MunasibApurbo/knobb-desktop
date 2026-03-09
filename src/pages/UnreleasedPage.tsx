import { useDeferredValue, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, RadioTower, Search } from "lucide-react";
import { motion } from "framer-motion";

import { PageTransition } from "@/components/PageTransition";
import { UnreleasedArtistCard } from "@/components/unreleased/UnreleasedArtistCard";
import { Input } from "@/components/ui/input";
import { PANEL_SURFACE_CLASS } from "@/components/ui/surfaceStyles";
import { useUnreleasedArtists } from "@/hooks/useUnreleasedArtists";

export default function UnreleasedPage() {
  const navigate = useNavigate();
  const { artists, loading, error } = useUnreleasedArtists();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  const filteredArtists = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();
    if (!normalizedQuery) return artists;

    return artists.filter((artist) => artist.name.toLowerCase().includes(normalizedQuery));
  }, [artists, deferredQuery]);

  return (
    <PageTransition>
      <div className="space-y-0 pb-24">
        <section className="border border-white/10 bg-[linear-gradient(180deg,_rgba(255,255,255,0.03),_rgba(255,255,255,0.01))]">
          <div className="flex flex-col gap-5 px-5 py-5 md:px-6 md:py-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                <RadioTower className="h-3.5 w-3.5" />
                Unreleased archive
              </div>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-white md:text-4xl">ArtistGrid archive</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/68">
                The same archive-style unreleased artist index, adapted for Knobb.
              </p>
            </div>

            <div className={`${PANEL_SURFACE_CLASS} w-full max-w-md p-3`}>
              <label htmlFor="unreleased-search" className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Search artists
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/42" />
                <Input
                  id="unreleased-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search artists..."
                  className="border-white/10 bg-black/25 pl-9 text-white placeholder:text-white/34"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="border border-t-0 border-white/10 bg-white/[0.02]">
          <div className="flex flex-col gap-3 border-b border-white/10 px-5 py-5 md:px-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Archive index</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-white">All unreleased artists</h2>
            </div>
            <p className="text-sm text-white/56">
              {loading ? "Loading archive..." : `${filteredArtists.length} artists`}
            </p>
          </div>

          {loading ? (
            <div className="flex min-h-[240px] items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="px-5 py-12 md:px-6">
              <div className={`${PANEL_SURFACE_CLASS} p-6`}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Archive unavailable</p>
                <p className="mt-3 text-sm text-white/68">{error}</p>
              </div>
            </div>
          ) : filteredArtists.length > 0 ? (
            <motion.div
              variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.04 } } }}
              initial="hidden"
              animate="show"
              className="hover-desaturate-page"
            >
              <div className="hover-desaturate-grid media-card-grid gap-0 border-l border-t border-white/10">
                {filteredArtists.map((artist) => (
                  <UnreleasedArtistCard
                    key={artist.sheetId}
                    artist={artist}
                    onClick={() => navigate(`/unreleased/${artist.sheetId}`)}
                  />
                ))}
              </div>
            </motion.div>
          ) : (
            <div className="px-5 py-12 md:px-6">
              <div className={`${PANEL_SURFACE_CLASS} p-6`}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">No results</p>
                <p className="mt-3 text-sm text-white/68">No artists found matching your search.</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </PageTransition>
  );
}
