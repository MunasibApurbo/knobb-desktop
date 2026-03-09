import { FormEvent, forwardRef, KeyboardEvent, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { TrackListRow } from "@/components/detail/TrackListRow";
import { usePlayer } from "@/contexts/PlayerContext";
import { useFavoriteArtists } from "@/contexts/FavoriteArtistsContext";
import { useAuth } from "@/contexts/AuthContext";
import { searchTidalReference } from "@/lib/tidalReferenceSearch";
import { Track } from "@/types/music";
import { motion } from "framer-motion";
import { PlayingIndicator } from "@/components/PlayingIndicator";
import { Play, Heart } from "lucide-react";
import { ArtistsLink } from "@/components/ArtistsLink";
import { PlaylistLink } from "@/components/PlaylistLink";
import { AlbumContextMenu } from "@/components/AlbumContextMenu";
import { ArtistContextMenu } from "@/components/ArtistContextMenu";
import { PlaylistContextMenu } from "@/components/PlaylistContextMenu";
import { TrackContextMenu } from "@/components/TrackContextMenu";
import { useResolvedArtistImage } from "@/hooks/useResolvedArtistImage";
import { warmArtistPageData } from "@/lib/musicApi";
import { useIsMobile } from "@/hooks/use-mobile";
import { startPlaylistDrag } from "@/lib/playlistDrag";
import {
  TidalReferenceAlbumResult,
  TidalReferenceArtistResult,
  TidalReferencePlaylistResult,
} from "@/lib/tidalReferenceMappers";
import { isSameTrack } from "@/lib/trackIdentity";
import { toast } from "sonner";

type TabKey = "top" | "profiles" | "tracks" | "albums" | "playlists";

type SearchResultsState = {
  tracks: Track[];
  artists: TidalReferenceArtistResult[];
  albums: TidalReferenceAlbumResult[];
  playlists: TidalReferencePlaylistResult[];
};

const EMPTY_RESULTS: SearchResultsState = {
  tracks: [],
  artists: [],
  albums: [],
  playlists: [],
};

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "top", label: "Top Results" },
  { key: "profiles", label: "Profiles" },
  { key: "tracks", label: "Tracks" },
  { key: "albums", label: "Albums" },
  { key: "playlists", label: "Playlists" },
];

function SearchTabButton({
  active,
  label,
  onClick,
  className,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "menu-sweep-hover relative inline-flex h-11 min-w-0 items-center justify-center overflow-hidden rounded-[var(--mobile-control-radius)] border border-white/10 px-3 text-center font-semibold text-[10px] uppercase tracking-[0.16em] transition-colors md:h-14 md:min-w-0 md:rounded-none md:border-0 md:border-r md:px-4 md:text-base md:normal-case md:tracking-normal last:md:border-r-0 " +
        (active ? "text-black" : "text-muted-foreground") +
        (className ? ` ${className}` : "")
      }
      style={active ? { backgroundColor: "hsl(var(--player-waveform))" } : undefined}
    >
      <span>{label}</span>
    </button>
  );
}

type SearchRowProps = {
  index: number;
  imageUrl?: string;
  artistId?: number;
  artistName?: string;
  title: string | React.ReactNode;
  subtitle?: string | React.ReactNode;
  middleLabel?: string | React.ReactNode;
  trailing?: string;
  onSelect: () => void;
  roundedImage?: boolean;
  isCurrent?: boolean;
  onPlay?: () => void;
  onLike?: () => void;
  isLiked?: boolean;
  onRowMouseEnter?: () => void;
  onRowFocus?: () => void;
  onRowPointerDown?: () => void;
} & Omit<React.HTMLAttributes<HTMLDivElement>, "onClick" | "onMouseEnter" | "onFocus" | "onPointerDown">;

const SearchRow = forwardRef<HTMLDivElement, SearchRowProps>(function SearchRow({
  index,
  imageUrl,
  artistId,
  artistName,
  title,
  subtitle,
  middleLabel,
  trailing,
  onSelect,
  roundedImage = false,
  isCurrent = false,
  onPlay,
  onLike,
  isLiked,
  onRowMouseEnter,
  onRowFocus,
  onRowPointerDown,
  onClick,
  onMouseEnter,
  onFocus,
  onPointerDown,
  ...buttonProps
}, ref) {
  const resolvedImageUrl = useResolvedArtistImage(artistId, imageUrl, artistName);
  const displayImageUrl = artistId ? resolvedImageUrl : imageUrl;

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          onSelect();
        }
      }}
      onMouseEnter={(event) => {
        onMouseEnter?.(event);
        onRowMouseEnter?.();
      }}
      onFocus={(event) => {
        onFocus?.(event);
        onRowFocus?.();
      }}
      onPointerDown={(event) => {
        onPointerDown?.(event);
        onRowPointerDown?.();
      }}
      onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
        if (event.target !== event.currentTarget) return;
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onSelect();
      }}
      className={`content-visibility-list group relative flex w-full items-center gap-2.5 overflow-hidden border-b border-white/10 px-3 py-2.5 text-left last:border-b-0 md:gap-3 md:px-4 md:py-3 ${isCurrent ? "" : "transition-colors duration-200"}`}
      style={isCurrent ? { backgroundColor: "hsl(var(--dynamic-accent) / 0.94)" } : undefined}
      {...buttonProps}
    >
      {!isCurrent && (
        <span
          className="absolute inset-0 origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300 ease-out pointer-events-none"
          style={{ backgroundColor: "hsl(var(--player-waveform) / 0.95)" }}
        />
      )}

      <span
        className={`relative z-10 hidden w-4 shrink-0 items-center justify-center text-center text-xs tabular-nums md:flex md:w-[20px] md:text-sm ${isCurrent
          ? "h-4 text-black"
          : "text-muted-foreground group-hover:text-[hsl(var(--dynamic-accent-foreground))] transition-colors duration-200"
          }`}
      >
        {isCurrent ? <PlayingIndicator isPaused={false} /> : `${index + 1}.`}
      </span>

      <div className={`relative z-10 shrink-0 overflow-hidden bg-white/10 group/img ${roundedImage ? "website-avatar h-11 w-11 rounded-full md:h-12 md:w-12" : "h-11 w-11 rounded-[calc(var(--mobile-control-radius)-4px)] md:h-12 md:w-12 md:rounded-[var(--cover-radius)]"}`}>
        {displayImageUrl ? (
          <img
            src={displayImageUrl}
            alt={typeof title === "string" ? title : "Result"}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover transition-transform duration-500 group-hover/img:scale-110"
            onError={(event) => {
              (event.target as HTMLImageElement).src = "/placeholder.svg";
            }}
          />
        ) : null}
        {(onPlay || onLike) && (
          <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/40 opacity-100 transition-opacity md:opacity-0 md:group-hover/img:opacity-100">
            {onPlay && (
              <button
                onClick={(e) => { e.stopPropagation(); onPlay(); }}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-[hsl(var(--dynamic-accent))] text-foreground transition-transform hover:scale-110"
              >
                <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
              </button>
            )}
            {onLike && (
              <button
                onClick={(e) => { e.stopPropagation(); onLike(); }}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-black/50 text-white hover:scale-110 transition-transform"
              >
                <Heart className={`w-3.5 h-3.5 ${isLiked ? "fill-current text-[hsl(var(--dynamic-accent))]" : ""}`} />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="relative z-10 min-w-0 flex-1">
        <p className={`truncate text-[13px] md:text-sm ${isCurrent ? "font-semibold text-black" : "font-medium group-hover:text-[hsl(var(--dynamic-accent-foreground))]"}`}>
          {title}
        </p>
        {subtitle ? (
          <p className={`truncate text-[11px] md:text-xs ${isCurrent ? "text-black/78" : "text-muted-foreground group-hover:text-[hsl(var(--dynamic-accent-foreground)/0.85)] transition-colors duration-200"}`}>
            {subtitle}
          </p>
        ) : null}
      </div>

      <span className={`relative z-10 hidden w-[min(28vw,11rem)] shrink-0 text-sm truncate md:block ${isCurrent ? "text-black/82" : "text-muted-foreground group-hover:text-[hsl(var(--dynamic-accent-foreground))] transition-colors duration-200"}`}>
        {middleLabel || ""}
      </span>

      {trailing ? (
        <span className={`relative z-10 w-14 shrink-0 text-right font-mono text-sm tabular-nums ${isCurrent ? "text-black" : "text-muted-foreground group-hover:text-[hsl(var(--dynamic-accent-foreground))] transition-colors duration-200"}`}>
          {trailing}
        </span>
      ) : (
        <span className="relative z-10" />
      )}
    </div>
  );
});

export default function SearchPage() {
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { play, currentTrack, isPlaying, playArtist } = usePlayer();
  const { user } = useAuth();
  const { isFavorite, toggleFavorite } = useFavoriteArtists();
  const initialQuery = searchParams.get("q") || "";
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResultsState>(EMPTY_RESULTS);
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("top");

  useEffect(() => {
    const q = searchParams.get("q") || "";
    setQuery(q);
  }, [searchParams]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults(EMPTY_RESULTS);
      return;
    }

    const timeout = setTimeout(async () => {
      setIsSearching(true);
      try {
        const next = await searchTidalReference(trimmed);
        setResults({
          tracks: next.tracks,
          artists: next.artists,
          albums: next.albums,
          playlists: next.playlists,
        });
      } catch (error) {
        console.error("Search failed:", error);
        setResults(EMPTY_RESULTS);
      } finally {
        setIsSearching(false);
      }
    }, 260);

    return () => clearTimeout(timeout);
  }, [query]);

  const hasAnyResults = useMemo(
    () =>
      results.tracks.length > 0 ||
      results.artists.length > 0 ||
      results.albums.length > 0 ||
      results.playlists.length > 0,
    [results],
  );

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = query.trim();
    if (!next) {
      setSearchParams({});
      return;
    }
    setSearchParams({ q: next });
  };

  const openAlbum = (album: TidalReferenceAlbumResult) => {
    const params = new URLSearchParams();
    params.set("title", album.title);
    if (album.artist) params.set("artist", album.artist);
    navigate(`/album/tidal-${album.id}?${params.toString()}`);
  };

  const prefetchArtist = (artistId: number) => {
    void warmArtistPageData(artistId);
  };

  const handleToggleFavoriteArtist = async (artist: TidalReferenceArtistResult) => {
    if (!user) {
      navigate("/auth", { state: { from: `${window.location.pathname}${window.location.search}` } });
      return;
    }

    const success = await toggleFavorite({
      artistId: artist.id,
      artistName: artist.name,
      artistImageUrl: artist.imageUrl,
    });

    if (!success) {
      toast.error("Failed to update favorite");
    }
  };

  const renderTrackResultRow = (track: Track, index: number, tracks: Track[]) => {
    const isCurrent = isSameTrack(currentTrack, track);

    return (
      <TrackContextMenu key={`search-track-${track.id}-${index}`} track={track} tracks={tracks}>
        <TrackListRow
          className="px-3 py-2.5 md:px-4 md:py-3"
          dragHandleLabel={`Drag ${track.title} to a playlist`}
          index={index}
          isCurrent={isCurrent}
          isPlaying={isPlaying}
          onDragHandleStart={(event) => {
            startPlaylistDrag(event.dataTransfer, {
              label: track.title,
              source: "track",
              tracks: [track],
            });
          }}
          onPlay={() => play(track, tracks)}
          track={track}
        />
      </TrackContextMenu>
    );
  };

  const renderTopResults = () => (
    <div>
      {isMobile && results.artists[0] ? (
        <ArtistContextMenu
          artistId={results.artists[0].id}
          artistName={results.artists[0].name}
          artistImageUrl={results.artists[0].imageUrl}
        >
          <button
            type="button"
            className="relative m-3 overflow-hidden rounded-[var(--mobile-panel-radius)] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(61,223,179,0.14),transparent_34%),radial-gradient(circle_at_85%_18%,rgba(63,191,255,0.16),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-3.5 text-left"
            onClick={() => navigate(`/artist/${results.artists[0].id}?name=${encodeURIComponent(results.artists[0].name)}`)}
          >
            <div className="flex items-center gap-3">
              <img
                src={results.artists[0].imageUrl || "/placeholder.svg"}
                alt={results.artists[0].name}
                className="website-avatar h-16 w-16 rounded-full object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/48">Top result</p>
                <p className="mt-1.5 truncate text-xl font-black tracking-tight text-white">{results.artists[0].name}</p>
                <p className="mt-1.5 text-[12px] leading-5 text-white/58">Open the profile, start radio, or favorite this artist.</p>
              </div>
            </div>
          </button>
        </ArtistContextMenu>
      ) : null}
      {!isMobile && results.artists[0] ? (
        <ArtistContextMenu
          artistId={results.artists[0].id}
          artistName={results.artists[0].name}
          artistImageUrl={results.artists[0].imageUrl}
        >
          <SearchRow
            index={0}
            imageUrl={results.artists[0].imageUrl}
            artistId={results.artists[0].id}
            artistName={results.artists[0].name}
            roundedImage
            title={results.artists[0].name}
            subtitle="Profile"
            middleLabel="Artist Profile"
            onSelect={() => navigate(`/artist/${results.artists[0].id}?name=${encodeURIComponent(results.artists[0].name)}`)}
            onRowMouseEnter={() => prefetchArtist(results.artists[0].id)}
            onRowFocus={() => prefetchArtist(results.artists[0].id)}
            onRowPointerDown={() => prefetchArtist(results.artists[0].id)}
            onPlay={() => playArtist(results.artists[0].id, results.artists[0].name)}
            onLike={() => void handleToggleFavoriteArtist(results.artists[0])}
            isLiked={isFavorite(results.artists[0].id)}
          />
        </ArtistContextMenu>
      ) : null}
      {results.tracks
        .slice(0, 10)
        .map((track, i) => renderTrackResultRow(track, (results.artists[0] ? 1 : 0) + i, results.tracks))}
      {results.albums.slice(0, 6).map((album, i) => (
        <AlbumContextMenu
          key={`top-album-${album.id}`}
          albumId={album.id}
          title={album.title}
          artist={album.artist}
          coverUrl={album.coverUrl}
        >
          <SearchRow
            index={(results.artists[0] ? 1 : 0) + Math.min(10, results.tracks.length) + i}
            imageUrl={album.coverUrl}
            title={album.title}
            subtitle={
              <span className="flex items-center gap-1">
                <span>Album ·</span>
                <ArtistsLink name={album.artist} className="text-xs" onClick={(e) => e.stopPropagation()} />
              </span>
            }
            middleLabel={<ArtistsLink name={album.artist} className="text-sm" onClick={(e) => e.stopPropagation()} />}
            onSelect={() => openAlbum(album)}
          />
        </AlbumContextMenu>
      ))}
      {results.playlists.slice(0, 4).map((playlist, i) => (
        <PlaylistContextMenu
          key={`top-playlist-${playlist.id}`}
          title={playlist.title}
          playlistId={playlist.id}
          coverUrl={playlist.coverUrl}
          kind="tidal"
        >
          <SearchRow
            index={(results.artists[0] ? 1 : 0) + Math.min(10, results.tracks.length) + Math.min(6, results.albums.length) + i}
            imageUrl={playlist.coverUrl}
            title={<PlaylistLink title={playlist.title} playlistId={playlist.id} className="text-inherit" />}
            subtitle={`Playlist · ${playlist.trackCount} songs`}
            middleLabel="Playlist"
            onSelect={() => navigate(`/playlist/${playlist.id}`)}
          />
        </PlaylistContextMenu>
      ))}
    </div>
  );

  const renderRowsByTab = () => {
    if (activeTab === "top") return renderTopResults();
    if (activeTab === "profiles") {
      return (
        <div>
          {results.artists.map((artist, i) => (
            <ArtistContextMenu
              key={`artist-${artist.id}`}
              artistId={artist.id}
              artistName={artist.name}
              artistImageUrl={artist.imageUrl}
            >
              <SearchRow
                index={i}
                imageUrl={artist.imageUrl}
                artistId={artist.id}
                artistName={artist.name}
                roundedImage
                title={artist.name}
                subtitle="Profile"
                middleLabel="Artist Profile"
                onSelect={() => navigate(`/artist/${artist.id}?name=${encodeURIComponent(artist.name)}`)}
                onRowMouseEnter={() => prefetchArtist(artist.id)}
                onRowFocus={() => prefetchArtist(artist.id)}
                onRowPointerDown={() => prefetchArtist(artist.id)}
                onPlay={() => playArtist(artist.id, artist.name)}
                onLike={() => void handleToggleFavoriteArtist(artist)}
                isLiked={isFavorite(artist.id)}
              />
            </ArtistContextMenu>
          ))}
        </div>
      );
    }
    if (activeTab === "tracks") {
      return (
        <div>{results.tracks.map((track, i) => renderTrackResultRow(track, i, results.tracks))}</div>
      );
    }
    if (activeTab === "albums") {
      return (
        <div>
          {results.albums.map((album, i) => (
            <AlbumContextMenu
              key={`album-${album.id}`}
              albumId={album.id}
              title={album.title}
              artist={album.artist}
              coverUrl={album.coverUrl}
            >
              <SearchRow
                index={i}
                imageUrl={album.coverUrl}
                title={album.title}
                subtitle={
                  <span className="flex items-center gap-1">
                    <span>Album ·</span>
                    <ArtistsLink name={album.artist} className="text-xs" onClick={(e) => e.stopPropagation()} />
                  </span>
                }
                middleLabel={<ArtistsLink name={album.artist} className="text-sm" onClick={(e) => e.stopPropagation()} />}
                onSelect={() => openAlbum(album)}
              />
            </AlbumContextMenu>
          ))}
        </div>
      );
    }
    if (activeTab === "playlists") {
      return (
        <div>
          {results.playlists.map((playlist, i) => (
            <PlaylistContextMenu
              key={`playlist-${playlist.id}`}
              title={playlist.title}
              playlistId={playlist.id}
              coverUrl={playlist.coverUrl}
              kind="tidal"
            >
              <SearchRow
                index={i}
                imageUrl={playlist.coverUrl}
                title={<PlaylistLink title={playlist.title} playlistId={playlist.id} className="text-inherit" />}
                subtitle={`Playlist · ${playlist.trackCount} songs`}
                middleLabel={`${playlist.trackCount} songs`}
                onSelect={() => navigate(`/playlist/${playlist.id}`)}
              />
            </PlaylistContextMenu>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="mobile-page-shell hover-desaturate-page"
    >
      <div className="mobile-page-sticky-stack sticky top-0 z-20">
      <section className="mobile-page-panel border border-white/10 border-b-0 seekbar-tone-box backdrop-blur-xl">
        <form onSubmit={submitSearch} className="h-14 px-4 flex items-center gap-3">
          <Search className="w-5 h-5 text-muted-foreground shrink-0" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={isMobile ? "Search artists, tracks, albums..." : "Search artists, tracks, albums, playlists"}
            className="h-10 min-w-0 border-0 bg-transparent px-0 text-base font-semibold focus-visible:ring-0 focus-visible:ring-offset-0 sm:text-lg md:text-xl placeholder:text-muted-foreground/85"
            autoFocus
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setSearchParams({});
              }}
              className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          ) : (
            <span className="w-5 h-5" />
          )}
        </form>
      </section>

      <section className="mobile-page-panel border border-white/10 bg-white/[0.02] backdrop-blur-xl">
        <div className="grid grid-cols-2 gap-2 px-3 py-3 md:grid-cols-6 md:gap-0 md:px-0 md:py-0">
          {TABS.map((tab, index) => (
            <SearchTabButton
              key={tab.key}
              active={activeTab === tab.key}
              label={tab.label}
              onClick={() => setActiveTab(tab.key)}
              className={index === TABS.length - 1 ? "col-span-2 md:col-span-1" : ""}
            />
          ))}
        </div>
      </section>
      </div>


      <section className="mobile-page-panel overflow-hidden border border-white/10 bg-white/[0.02]">

        {isSearching ? (
          <div className="py-12 text-center text-muted-foreground md:py-20">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3" />
            Searching...
          </div>
        ) : !query.trim() ? (
          <div className="py-12 px-6 text-center text-muted-foreground md:py-20">Type a name to search.</div>
        ) : !hasAnyResults ? (
          <div className="py-12 px-6 text-center text-muted-foreground md:py-20">No results found.</div>
        ) : (
          renderRowsByTab()
        )}
      </section>
    </motion.div>
  );
}
