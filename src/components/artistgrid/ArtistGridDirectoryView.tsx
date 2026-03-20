import { useDeferredValue, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowLeft, ArrowUpRight, Search, X } from "lucide-react";

import { ArtistGridArtistCard } from "@/components/ArtistGridArtistCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getArtistGridSheetEditUrl, type ArtistGridArtist } from "@/lib/unreleasedArchiveApi";
import { PANEL_SURFACE_CLASS } from "@/components/ui/surfaceStyles";

type ArtistGridFilterOptions = {
  hideAlts: boolean;
  showWorkingOnly: boolean;
};

const DEFAULT_FILTERS: ArtistGridFilterOptions = {
  hideAlts: false,
  showWorkingOnly: false,
};

const FILTER_CHIPS: Array<{ key: keyof ArtistGridFilterOptions; label: string }> = [
  { key: "showWorkingOnly", label: "Working" },
  { key: "hideAlts", label: "Hide Alts" },
];

type ArtistGridDirectoryViewProps = {
  artists: ArtistGridArtist[];
  sortedArtists: ArtistGridArtist[];
  loaded: boolean;
  error: string | null;
  showBackButton?: boolean;
};

function normalizeQuery(value: string) {
  return value.trim().toLowerCase();
}

export function ArtistGridDirectoryView({
  artists,
  sortedArtists,
  loaded,
  error,
  showBackButton = false,
}: ArtistGridDirectoryViewProps) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<ArtistGridFilterOptions>(DEFAULT_FILTERS);
  const deferredQuery = useDeferredValue(searchQuery);

  const filteredArtists = useMemo(() => {
    const normalizedQuery = normalizeQuery(deferredQuery);

    return sortedArtists.filter((artist) => {
      if (filters.hideAlts && artist.isAlt) return false;
      if (filters.showWorkingOnly && !artist.isLinkWorking) return false;
      if (!normalizedQuery) return true;

      return [
        artist.name,
        artist.cleanName,
        artist.credit,
      ].some((value) => value.toLowerCase().includes(normalizedQuery));
    });
  }, [deferredQuery, filters, sortedArtists]);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const hasSearchQuery = normalizeQuery(searchQuery).length > 0;
  const resetControls = () => {
    setSearchQuery("");
    setFilters(DEFAULT_FILTERS);
  };

  const openArtist = (sheetId: string | null, artistName: string, fallbackUrl: string) => {
    if (!sheetId) {
      window.open(fallbackUrl, "_blank", "noopener,noreferrer");
      return;
    }

    navigate(`/browse/artistgrid/${sheetId}?artist=${encodeURIComponent(artistName)}`);
  };

  const directoryContent = error && artists.length === 0 ? (
    <div className="px-5 py-12 md:px-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <AlertTriangle className="h-8 w-8 text-white/48" />
        <div className="space-y-2">
          <h2 className="text-2xl font-black tracking-tight text-white">ArtistGrid could not load</h2>
          <p className="max-w-xl text-sm leading-6 text-white/60">{error}</p>
        </div>
      </div>
    </div>
  ) : filteredArtists.length > 0 ? (
    <div className="media-card-grid hover-desaturate-grid gap-0 border-l border-t border-white/10">
      {filteredArtists.map((artist, index) => (
        <ArtistGridArtistCard
          key={`${artist.name}-${artist.url}`}
          artist={artist}
          isPriority={index < 10}
          onOpenPrimary={() => openArtist(artist.sheetId, artist.cleanName, artist.url)}
          onOpenSheet={() => window.open(getArtistGridSheetEditUrl(artist.url), "_blank", "noopener,noreferrer")}
        />
      ))}
    </div>
  ) : loaded ? (
    <div className="flex min-h-[18rem] flex-col items-center justify-center gap-3 px-4 py-10 text-center">
      <Search className="h-6 w-6 text-white/34" />
      <div>
        <p className="text-lg font-semibold text-white">No archives matched</p>
        <p className="mt-1 text-sm text-white/54">Try clearing a filter or searching with a broader artist name.</p>
      </div>
    </div>
  ) : null;

  return (
    <div className="page-substack">
      {showBackButton ? (
        <section className={cn("page-panel px-5 py-5 md:px-6 md:py-6", PANEL_SURFACE_CLASS)}>
          <div className="flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <button
                type="button"
                onClick={() => navigate("/browse")}
                className="inline-flex items-center gap-2 text-sm font-medium text-white/60 transition-colors hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Browse
              </button>
              <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/42">
                ArtistGrid
              </p>
              <h1 className="mt-2 text-[2.2rem] font-black tracking-tight text-white md:text-[3.3rem]">Unreleased Archives</h1>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                onClick={() => window.open("https://artistgrid.cx", "_blank", "noopener,noreferrer")}
                className="gap-2 border-white/12 bg-white/[0.03] text-white/86 hover:bg-white/[0.08] hover:text-black"
              >
                Open Original
                <ArrowUpRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      <section className={cn("page-panel overflow-hidden", PANEL_SURFACE_CLASS)}>
        <div className="px-4 py-4 md:px-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative max-w-2xl flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/38" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search ArtistGrid archives..."
                className="h-12 border-white/10 bg-white/[0.04] pl-11 pr-12 text-white placeholder:text-white/36"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="menu-sweep-hover absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-white/45 transition-colors hover:bg-white/8 hover:text-white"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              {FILTER_CHIPS.map((item) => {
                const active = filters[item.key];
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() =>
                      setFilters((current) => ({
                        ...current,
                        [item.key]: !current[item.key],
                      }))
                    }
                    className={cn(
                      "menu-sweep-hover relative inline-flex h-11 items-center justify-center rounded-full border px-4 text-xs font-semibold uppercase tracking-[0.16em] transition-colors",
                      active
                        ? "border-[hsl(var(--player-waveform))] bg-[hsl(var(--player-waveform))] text-black"
                        : "border-white/10 bg-white/[0.03] text-white/68 hover:text-black",
                    )}
                  >
                    {item.label}
                  </button>
                );
              })}
              {(activeFilterCount > 0 || hasSearchQuery) ? (
                <button
                  type="button"
                  onClick={resetControls}
                  className="menu-sweep-hover inline-flex h-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] px-4 text-xs font-semibold uppercase tracking-[0.16em] text-white/68 transition-colors hover:text-black"
                >
                  Clear all
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {directoryContent}
      </section>
    </div>
  );
}
