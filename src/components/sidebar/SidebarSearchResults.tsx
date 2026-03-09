import { Heart, MoreVertical, Search, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePlayer } from "@/contexts/PlayerContext";
import { useFavoriteArtists } from "@/contexts/FavoriteArtistsContext";
import { useAuth } from "@/contexts/AuthContext";
import { useSearch } from "@/contexts/SearchContext";
import type { Track } from "@/types/music";
import { ArtistLink } from "@/components/ArtistLink";
import { PlaylistLink } from "@/components/PlaylistLink";
import { AlbumContextMenu } from "@/components/AlbumContextMenu";
import { ArtistContextMenu } from "@/components/ArtistContextMenu";
import { PlaylistContextMenu } from "@/components/PlaylistContextMenu";
import { TrackContextMenu } from "@/components/TrackContextMenu";
import { useResolvedArtistImage } from "@/hooks/useResolvedArtistImage";
import { warmArtistPageData } from "@/lib/musicApi";
import { isSameTrack } from "@/lib/trackIdentity";
import { toast } from "sonner";

function SearchSectionHeader({ title }: { title: string }) {
  return (
    <h3 className="border-t border-white/5 px-1 pb-1.5 pt-3 text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/55 first:border-t-0 first:pt-1">
      {title}
    </h3>
  );
}

export function SidebarSearchResults() {
  const {
    tidalTracks,
    tidalArtists,
    isSearching,
    closeSearch,
    query,
    tidalAlbums,
    tidalPlaylists,
    recentQueries,
    removeRecentQuery,
    clearRecentQueries,
    searchError,
  } = useSearch();
  const { currentTrack, play } = usePlayer();
  const { user } = useAuth();
  const { isFavorite, toggleFavorite } = useFavoriteArtists();
  const navigate = useNavigate();

  const handlePlayTrack = (track: Track, list: Track[]) => {
    play(track, list);
    closeSearch();
  };

  const normalizedQuery = query.toLowerCase();
  const hasQuery = normalizedQuery.length > 0;
  const topArtist = tidalArtists[0];
  const topArtistImageUrl = useResolvedArtistImage(topArtist?.id, topArtist?.imageUrl, topArtist?.name);

  if (!hasQuery && !isSearching && recentQueries.length === 0) return null;

  const suggestions = Array.from(new Set([
    normalizedQuery,
    ...tidalTracks.slice(0, 5).map((track) => track.title.toLowerCase()),
  ])).filter(Boolean).slice(0, 6);

  const resultsFound =
    tidalTracks.length > 0 ||
    tidalArtists.length > 0 ||
    tidalAlbums.length > 0 ||
    tidalPlaylists.length > 0;

  let globalIndex = 0;

  const handleToggleFavoriteArtist = async () => {
    if (!topArtist) return;

    if (!user) {
      navigate("/auth", { state: { from: `${window.location.pathname}${window.location.search}` } });
      return;
    }

    const success = await toggleFavorite({
      artistId: topArtist.id,
      artistName: topArtist.name,
      artistImageUrl: topArtistImageUrl || topArtist.imageUrl,
    });

    if (!success) {
      toast.error("Failed to update favorite");
    }
  };

  return (
    <div className="flex min-h-0 flex-col px-2 pb-4">
      {searchError ? (
        <div className="mb-3 border border-amber-400/20 bg-amber-400/10 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-100">Search notice</p>
          <p className="mt-1 text-xs text-amber-100/85">{searchError}</p>
        </div>
      ) : null}

      {!hasQuery && recentQueries.length > 0 && !isSearching && (
        <div className="mb-1 flex flex-col">
          <div className="flex items-center justify-between px-1">
            <SearchSectionHeader title="Recent Searches" />
            <button
              type="button"
              className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40 transition-colors hover:text-white"
              onClick={clearRecentQueries}
            >
              Clear
            </button>
          </div>
          {recentQueries.map((recentQuery) => (
            <div key={recentQuery} className="group relative overflow-hidden">
              <button
                className="w-full px-1 py-1.5 text-left transition-colors"
                onClick={() => {
                  navigate(`/search?q=${encodeURIComponent(recentQuery)}`);
                  closeSearch();
                }}
              >
                <span
                  className="pointer-events-none absolute inset-0 origin-left scale-x-0 transition-transform duration-300 ease-out group-hover:scale-x-100"
                  style={{ backgroundColor: "hsl(var(--player-waveform))" }}
                />
                <div className="relative z-10 flex items-center gap-2.5 pr-8">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10">
                    <Search className="h-3.5 w-3.5 text-white/65 group-hover:text-black" />
                  </div>
                  <span className="truncate text-[0.9rem] font-medium leading-tight text-white transition-colors group-hover:text-black">
                    {recentQuery}
                  </span>
                </div>
              </button>
              <button
                type="button"
                className="absolute right-1 top-1/2 z-10 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center text-white/40 opacity-0 transition-opacity group-hover:opacity-100 hover:text-black"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  removeRecentQuery(recentQuery);
                }}
                aria-label={`Remove ${recentQuery} from recent searches`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {suggestions.length > 0 && !isSearching && (
        <div className="mb-1 flex flex-col">
          {suggestions.map((suggestion, index) => {
            const matchIndex = suggestion.indexOf(normalizedQuery);
            const beforeMatch = matchIndex >= 0 ? suggestion.slice(0, matchIndex) : "";
            const matchText = matchIndex >= 0 ? suggestion.slice(matchIndex, matchIndex + normalizedQuery.length) : suggestion;
            const afterMatch = matchIndex >= 0 ? suggestion.slice(matchIndex + normalizedQuery.length) : "";

            return (
              <button
                key={`sugg-${index}`}
                className="group relative overflow-hidden px-1 py-1.5 text-left transition-colors"
                onClick={() => {
                  navigate(`/search?q=${encodeURIComponent(suggestion)}`);
                  closeSearch();
                }}
              >
                <span
                  className="pointer-events-none absolute inset-0 origin-left scale-x-0 transition-transform duration-300 ease-out group-hover:scale-x-100"
                  style={{ backgroundColor: "hsl(var(--player-waveform))" }}
                />
                <div className="relative z-10 flex items-center gap-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10">
                    <Search className="h-3.5 w-3.5 text-white/65 group-hover:text-black" />
                  </div>
                  <span className="truncate text-[0.9rem] font-medium leading-tight transition-colors group-hover:text-black">
                    <span className="font-medium text-white/40 group-hover:text-black/60">{beforeMatch}</span>
                    <span className="font-bold text-white group-hover:text-black">{matchText}</span>
                    <span className="font-bold text-white group-hover:text-black">{afterMatch}</span>
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {tidalArtists.length > 0 && (
        <div className="mb-0.5 flex flex-col">
          <SearchSectionHeader title="Top Artist" />
          {(() => {
            globalIndex += 1;
            const artist = topArtist;
            if (!artist) return null;
            return (
              <ArtistContextMenu
                key={`top-artist-${artist.id}`}
                artistId={artist.id}
                artistName={artist.name}
                artistImageUrl={topArtistImageUrl || artist.imageUrl}
              >
                <button
                  className="content-visibility-list group relative overflow-hidden px-1 py-1.5 text-left transition-colors"
                  onMouseEnter={() => void warmArtistPageData(artist.id)}
                  onFocus={() => void warmArtistPageData(artist.id)}
                  onPointerDown={() => void warmArtistPageData(artist.id)}
                  onClick={() => {
                    navigate(`/artist/${artist.id}?name=${encodeURIComponent(artist.name)}`);
                    closeSearch();
                  }}
                >
                  <span
                    className="pointer-events-none absolute inset-0 origin-left scale-x-0 transition-transform duration-300 ease-out group-hover:scale-x-100"
                    style={{ backgroundColor: "hsl(var(--player-waveform))" }}
                  />
                  <div className="relative z-10 flex items-center gap-2.5">
                    <span className="w-5 shrink-0 text-right text-[10px] font-mono text-white/40 group-hover:text-black/70">
                      {globalIndex}.
                    </span>
                    <div className="website-avatar h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/10 bg-accent">
                      {topArtistImageUrl ? (
                        <img
                          src={topArtistImageUrl}
                          alt={artist.name}
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          onError={(event) => {
                            (event.target as HTMLImageElement).src = "/placeholder.svg";
                          }}
                        />
                      ) : (
                        <div className="h-full w-full bg-white/10" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.95rem] font-semibold leading-tight text-foreground transition-colors group-hover:text-black">
                        {artist.name}
                      </p>
                      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/40 group-hover:text-black/60">Artist Profile</p>
                    </div>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        void handleToggleFavoriteArtist();
                      }}
                      aria-label={isFavorite(artist.id) ? "Remove from favorite artists" : "Add to favorite artists"}
                      className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all ${
                        isFavorite(artist.id)
                          ? "bg-black/25 text-[hsl(var(--dynamic-accent))]"
                          : "bg-black/25 text-white/60 opacity-0 group-hover:opacity-100 hover:text-white"
                      }`}
                    >
                      <Heart className={`h-3.5 w-3.5 ${isFavorite(artist.id) ? "fill-current" : ""}`} />
                    </button>
                  </div>
                </button>
              </ArtistContextMenu>
            );
          })()}
        </div>
      )}

      {tidalTracks.length > 0 && (
        <div className="mb-0.5 flex flex-col">
          <SearchSectionHeader title="Songs" />
          {tidalTracks.slice(0, 15).map((track) => {
            globalIndex += 1;
            return (
              <TrackContextMenu key={track.id} track={track} tracks={tidalTracks}>
                <button
                  className="content-visibility-list group relative w-full overflow-hidden px-1 py-1.5 text-left transition-colors"
                  onClick={() => handlePlayTrack(track, tidalTracks)}
                >
                  <span
                    className="pointer-events-none absolute inset-0 origin-left scale-x-0 transition-transform duration-300 ease-out group-hover:scale-x-100"
                    style={{ backgroundColor: "hsl(var(--player-waveform))" }}
                  />
                  <div className="relative z-10 flex items-center gap-2.5">
                    <span className="w-5 shrink-0 text-right text-[10px] font-mono text-white/40 transition-colors group-hover:text-black/70">
                      {globalIndex}.
                    </span>
                    <div className="relative h-10 w-10 shrink-0 overflow-hidden border border-white/10">
                      <img src={track.coverUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      {isSameTrack(currentTrack, track) && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                          <div className="h-4 w-4 animate-pulse rounded-full bg-accent" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-[0.95rem] font-semibold leading-tight transition-colors ${isSameTrack(currentTrack, track) ? "text-accent" : "text-foreground"} group-hover:text-black`}>
                        {track.title}
                      </p>
                      <p className="truncate text-[0.76rem] font-medium text-white/45 transition-colors group-hover:text-black/60">
                        Track by{" "}
                        <ArtistLink
                          name={track.artist}
                          artistId={track.artistId}
                          className="text-inherit"
                          onClick={() => closeSearch()}
                        />
                      </p>
                    </div>
                    <MoreVertical className="h-3.5 w-3.5 shrink-0 text-white/35 transition-colors group-hover:text-black" />
                  </div>
                </button>
              </TrackContextMenu>
            );
          })}
        </div>
      )}

      {tidalAlbums.length > 0 && (
        <div className="mb-0.5 flex flex-col">
          <SearchSectionHeader title="Albums" />
          {tidalAlbums.slice(0, 6).map((album) => {
            globalIndex += 1;
            return (
              <AlbumContextMenu
                key={`album-${album.id}`}
                albumId={album.id}
                title={album.title}
                artist={album.artist}
                coverUrl={album.coverUrl}
              >
                <button
                  className="content-visibility-list group relative overflow-hidden px-1 py-1.5 text-left transition-colors"
                  onClick={() => {
                    const params = new URLSearchParams({ title: album.title });
                    if (album.artist) params.set("artist", album.artist);
                    navigate(`/album/tidal-${album.id}?${params.toString()}`);
                    closeSearch();
                  }}
                >
                  <span
                    className="pointer-events-none absolute inset-0 origin-left scale-x-0 transition-transform duration-300 ease-out group-hover:scale-x-100"
                    style={{ backgroundColor: "hsl(var(--player-waveform))" }}
                  />
                  <div className="relative z-10 flex items-center gap-2.5">
                    <span className="w-5 shrink-0 text-right text-[10px] font-mono text-white/40 group-hover:text-black/70">
                      {globalIndex}.
                    </span>
                    <div className="h-10 w-10 shrink-0 overflow-hidden border border-white/10">
                      <img src={album.coverUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.95rem] font-semibold leading-tight text-foreground transition-colors group-hover:text-black">
                        {album.title}
                      </p>
                      <p className="truncate text-[0.76rem] font-medium text-white/45 group-hover:text-black/60">
                        Album ·{" "}
                        <ArtistLink
                          name={album.artist}
                          className="text-inherit"
                          onClick={() => closeSearch()}
                        />
                      </p>
                    </div>
                    <MoreVertical className="h-3.5 w-3.5 shrink-0 text-white/35 group-hover:text-black" />
                  </div>
                </button>
              </AlbumContextMenu>
            );
          })}
        </div>
      )}

      {tidalPlaylists.length > 0 && (
        <div className="mb-0.5 flex flex-col">
          <SearchSectionHeader title="Playlists" />
          {tidalPlaylists.slice(0, 6).map((playlist) => {
            globalIndex += 1;
            return (
              <PlaylistContextMenu
                key={`playlist-${playlist.id}`}
                title={playlist.title}
                playlistId={playlist.id}
                coverUrl={playlist.coverUrl}
                kind="tidal"
              >
                <button
                  className="content-visibility-list group relative overflow-hidden px-1 py-1.5 text-left transition-colors"
                  onClick={() => {
                    navigate(`/playlist/${playlist.id}`);
                    closeSearch();
                  }}
                >
                  <span
                    className="pointer-events-none absolute inset-0 origin-left scale-x-0 transition-transform duration-300 ease-out group-hover:scale-x-100"
                    style={{ backgroundColor: "hsl(var(--player-waveform))" }}
                  />
                  <div className="relative z-10 flex items-center gap-2.5">
                    <span className="w-5 shrink-0 text-right text-[10px] font-mono text-white/40 group-hover:text-black/70">
                      {globalIndex}.
                    </span>
                    <div className="h-10 w-10 shrink-0 overflow-hidden border border-white/10">
                      <img src={playlist.coverUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.95rem] font-semibold leading-tight text-foreground transition-colors group-hover:text-black">
                        <PlaylistLink
                          title={playlist.title}
                          playlistId={playlist.id}
                          className="text-inherit"
                          onClick={() => closeSearch()}
                        />
                      </p>
                      <p className="truncate text-[0.76rem] font-medium text-white/45 group-hover:text-black/60">
                        Playlist · {playlist.trackCount} songs
                      </p>
                    </div>
                    <MoreVertical className="h-3.5 w-3.5 shrink-0 text-white/35 group-hover:text-black" />
                  </div>
                </button>
              </PlaylistContextMenu>
            );
          })}
        </div>
      )}

      {resultsFound && hasQuery && (
        <button
          className="group relative mx-1 mt-2 overflow-hidden border-t border-white/10 py-2.5 text-center text-[9px] font-bold uppercase tracking-widest text-muted-foreground transition-colors"
          onClick={() => {
            navigate(`/search?q=${encodeURIComponent(query)}`);
            closeSearch();
          }}
        >
          <span
            className="pointer-events-none absolute inset-0 origin-left scale-x-0 transition-transform duration-300 ease-out group-hover:scale-x-100"
            style={{ backgroundColor: "hsl(var(--player-waveform))" }}
          />
          <span className="relative z-10 transition-colors group-hover:text-black">
            View all results for "{query}"
          </span>
        </button>
      )}

      {!resultsFound && !isSearching && hasQuery && (
        <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
          <Search className="mb-3 h-7 w-7 text-muted-foreground/20" />
          <p className="mb-1 text-sm font-bold text-foreground">No results found for "{query}"</p>
          <p className="text-xs text-muted-foreground">Check the spelling or try a more general search.</p>
        </div>
      )}
    </div>
  );
}
