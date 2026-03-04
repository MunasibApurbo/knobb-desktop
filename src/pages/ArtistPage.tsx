import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { searchArtists, searchTracks, searchAlbums, getArtistTopTracks, getArtistAlbums, getArtistBio, getRecommendations, getTidalImageUrl, tidalTrackToAppTrack, TidalArtist, TidalAlbum } from "@/lib/monochromeApi";
import { Track } from "@/types/music";
import { formatDuration } from "@/lib/utils";
import { usePlayer } from "@/contexts/PlayerContext";
import { useAuth } from "@/contexts/AuthContext";
import { useFavoriteArtists } from "@/hooks/useFavoriteArtists";
import { useLikedSongs } from "@/contexts/LikedSongsContext";
import { Play, Pause, Shuffle, Heart, Loader2, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { PlayingIndicator } from "@/components/PlayingIndicator";

function AlbumCard({ album, navigate, playAlbum }: { album: TidalAlbum; navigate: any; playAlbum: any }) {
  const typeLabel = album.type === "EP" ? "EP" : album.type === "SINGLE" ? "Single" : null;
  return (
    <div
      className="hover-desaturate-card relative group cursor-pointer border-r border-b border-white/10 transition-colors hover:bg-white/[0.03] flex flex-col"
      onClick={() => {
        const artistName = album.artists?.[0]?.name || album.artist?.name || "";
        const params = new URLSearchParams();
        if (album.title) params.set("title", album.title);
        if (artistName) params.set("artist", artistName);
        navigate(`/album/tidal-${album.id}?${params.toString()}`);
      }}
    >
      <div className="relative overflow-hidden aspect-square shadow-sm w-full">
        <img
          src={getTidalImageUrl(album.cover, "320x320")}
          alt={album.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg"; }}
        />
        {typeLabel && (
          <div className="absolute top-2 left-2 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-tight bg-black/60 text-white backdrop-blur-sm">
            {typeLabel}
          </div>
        )}
        <div
          className="absolute bottom-3 right-3 w-12 h-12 rounded-full flex items-center justify-center shadow-2xl opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all duration-300 z-20 hover:scale-110"
          style={{ background: `hsl(var(--dynamic-accent))` }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            playAlbum(album);
          }}
        >
          <Play className="w-5 h-5 text-foreground ml-0.5 fill-current" />
        </div>
      </div>
      <div className="min-h-[3.2rem] p-3 pt-2 md:p-4 md:pt-3 flex-1 flex flex-col justify-center">
        <p className="text-sm font-semibold leading-tight text-foreground line-clamp-2 break-words">{album.title}</p>
        <p className="text-xs text-muted-foreground/80 truncate mt-1">
          {album.releaseDate ? new Date(album.releaseDate).getFullYear() : ""}
          {album.numberOfTracks ? ` · ${album.numberOfTracks} track${album.numberOfTracks !== 1 ? "s" : ""}` : ""}
        </p>
      </div>
    </div>
  );
}

const INITIAL_CARD_COUNT = 5;

export default function ArtistPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const artistName = searchParams.get("name") || "";
  const navigate = useNavigate();
  const { play, playAlbum, currentTrack, isPlaying, togglePlay } = usePlayer();
  const { user } = useAuth();
  const { isFavorite, toggleFavorite } = useFavoriteArtists();
  const { isLiked, toggleLike } = useLikedSongs();

  const [artist, setArtist] = useState<TidalArtist | null>(null);
  const [topTracks, setTopTracks] = useState<Track[]>([]);
  const [albums, setAlbums] = useState<TidalAlbum[]>([]);
  const [relatedArtists, setRelatedArtists] = useState<{ id: number; name: string; picture: string }[]>([]);
  const [bio, setBio] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAllTracks, setShowAllTracks] = useState(false);
  const [showAllRelated, setShowAllRelated] = useState(false);
  const [showAllAlbums, setShowAllAlbums] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const prevIdRef = useRef<string | undefined>();

  useEffect(() => {
    const scrollContainer = document.querySelector('[data-radix-scroll-area-viewport]');
    if (!scrollContainer) return;
    const handleScroll = () => setScrollY(scrollContainer.scrollTop);
    scrollContainer.addEventListener("scroll", handleScroll, { passive: true });
    return () => scrollContainer.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    // Only reset fully if the artist ID actually changed
    const isNew = prevIdRef.current !== id;
    prevIdRef.current = id;

    if (isNew) {
      setLoading(true);
      setShowAllTracks(false);
      setShowAllAlbums(false);
    }

    let cancelled = false;

    (async () => {
      try {
        const artistId = parseInt(id || "0");
        const searchQuery = artistName || id || "";

        const artists = await searchArtists(searchQuery);
        if (cancelled) return;
        let found = artists.find((a) => a.id === artistId) || artists[0] || null;

        if (!found && artistName) {
          const trackResults = await searchTracks(artistName, 5);
          if (cancelled) return;
          if (trackResults.length > 0) {
            const fa = trackResults[0].artist;
            found = { id: fa.id, name: fa.name, picture: fa.picture, popularity: 0, url: "" };
          }
        }

        if (found && !cancelled) {
          setArtist(found);
          // Immediately show what we have, then load rest
          if (isNew) setLoading(false);

          // Fetch tracks, albums, bio, and related artists in parallel
          const [tracks, allAlbumsList, artistBio] = await Promise.all([
            getArtistTopTracks(found.id, 25).catch(() => searchTracks(found!.name, 25)),
            getArtistAlbums(found.id).catch(() => [] as TidalAlbum[]),
            getArtistBio(found.id),
          ]);

          if (cancelled) return;

          if (!cancelled) {
            const appTracks = tracks.map(tidalTrackToAppTrack);
            setTopTracks(appTracks);
            setBio(artistBio);

            // Filter albums by type from the single fetched list
            const hasTypes = allAlbumsList.some(a => !!a.type);
            if (hasTypes) {
              setAlbums(allAlbumsList.filter(a => !a.type || a.type === "ALBUM"));
            } else {
              setAlbums(allAlbumsList);
            }

            // Extract related artists from track results
            const relatedMap = new Map<number, { id: number; name: string; picture: string }>();
            for (const t of tracks) {
              if (t.artists) {
                for (const a of t.artists) {
                  if (a.id !== found!.id && !relatedMap.has(a.id) && a.name !== found!.name) {
                    relatedMap.set(a.id, {
                      id: a.id,
                      name: a.name,
                      picture: (a as any).picture ? getTidalImageUrl((a as any).picture, "320x320") : "",
                    });
                  }
                }
              }
            }

            // Also try recommendations for related artists
            if (appTracks.length > 0 && appTracks[0].tidalId) {
              try {
                const recs = await getRecommendations(appTracks[0].tidalId);
                if (!cancelled) {
                  for (const r of recs) {
                    if (r.artist && r.artist.id !== found!.id && !relatedMap.has(r.artist.id)) {
                      relatedMap.set(r.artist.id, {
                        id: r.artist.id,
                        name: r.artist.name,
                        picture: r.artist.picture ? getTidalImageUrl(r.artist.picture, "320x320") : "",
                      });
                    }
                  }
                }
              } catch { }
            }

            if (!cancelled) setRelatedArtists(Array.from(relatedMap.values()).slice(0, 8));
            setLoading(false);
          }
        } else {
          setLoading(false);
        }
      } catch (e) {
        console.error("Failed to load artist:", e);
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [id, artistName]);

  if (loading && !artist) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!artist) {
    return <div className="p-8 text-foreground">Artist not found.</div>;
  }

  const isCurrentArtist = currentTrack && topTracks.some((t) => t.id === currentTrack.id);
  const displayedTracks = showAllTracks ? topTracks : topTracks.slice(0, 5);
  const artistImageUrl = artist.picture
    ? getTidalImageUrl(artist.picture, "1080x720")
    : topTracks[0]?.coverUrl || "";
  const favorite = isFavorite(artist.id);

  const handleToggleFavorite = async () => {
    if (!user) {
      const from = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      navigate("/auth", { state: { from } });
      return;
    }

    const success = await toggleFavorite({
      artistId: artist.id,
      artistName: artist.name,
      artistImageUrl,
    });

    if (!success) {
      toast.error("Failed to update favorite artist");
      return;
    }
    toast.success(favorite ? `Removed ${artist.name} from favorites` : `Added ${artist.name} to favorites`);
  };

  // Strip HTML from bio
  const cleanBio = bio.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

  const handleShareArtist = async () => {
    const url = window.location.href;
    const text = `${artist.name}${cleanBio ? ` — ${cleanBio}` : ""}`.trim();
    if (navigator.share) {
      try {
        await navigator.share({ title: artist.name, text, url });
        return;
      } catch {
        // Fall back to clipboard
      }
    }
    await navigator.clipboard.writeText(url);
    toast.success("Artist link copied to clipboard");
  };

  const openTrackAlbum = async (track: Track) => {
    const params = new URLSearchParams();
    if (track.album) params.set("title", track.album);
    if (track.artist) params.set("artist", track.artist);

    if (track.albumId) {
      navigate(`/album/tidal-${track.albumId}?${params.toString()}`);
      return;
    }

    try {
      const matches = await searchAlbums(`${track.album} ${track.artist}`, 6);
      const exact = matches.find((a) => a.title?.toLowerCase() === track.album?.toLowerCase()) || matches[0];
      if (exact) {
        navigate(`/album/tidal-${exact.id}?${params.toString()}`);
        return;
      }
    } catch (e) {
      console.warn("Album lookup failed:", e);
    }

    toast.error("Album not found");
  };

  const artistActionBtnClass =
    "group rounded-none h-14 justify-start px-4 md:px-6 font-semibold text-base bg-transparent border-0 " +
    "relative overflow-hidden transition-colors hover:text-[hsl(var(--dynamic-accent-foreground))] " +
    "before:content-[''] before:absolute before:inset-0 before:origin-left before:scale-x-0 " +
    "before:transition-transform before:duration-300 before:ease-out before:bg-[hsl(var(--player-waveform)/0.95)] " +
    "hover:before:scale-x-100 [&>*]:relative [&>*]:z-10";

  const artistSectionHeaderClass =
    "px-4 h-14 border-b border-white/10 flex items-center justify-between";
  const artistSectionTitleClass = "text-lg font-bold text-foreground";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="hover-desaturate-page space-y-0"
    >
      {/* Hero Banner - scroll parallax zoom + blur */}
      {(() => {
        const scrollScale = 1 + scrollY * 0.001;
        const scrollBlur = Math.min(scrollY * 0.05, 12);
        const scrollOpacity = Math.max(1 - scrollY * 0.002, 0.4);

        const artistImgUrl = artist.picture
          ? getTidalImageUrl(artist.picture, "1080x720")
          : topTracks[0]?.coverUrl || "/placeholder.svg";

        return (
          <div className="relative overflow-hidden mb-0 border border-white/10 border-b-0" style={{ height: "400px" }}>
            <div
              className="absolute inset-0 z-[1]"
              style={{
                background: `linear-gradient(to right, hsl(var(--dynamic-accent) / 0.35) 0%, hsl(var(--dynamic-accent) / 0.1) 60%, transparent 85%),
                             linear-gradient(to top, hsl(var(--background)) 0%, transparent 40%)`,
              }}
            />

            <img
              src={artistImgUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover transition-[filter] duration-100"
              style={{
                opacity: 0.4,
                transform: `scale(${scrollScale + 0.5})`,
                filter: `blur(${40 + scrollBlur}px)`,
              }}
            />

            <div className="relative h-full z-[2] flex items-end">
              <div className="absolute top-0 right-0 bottom-0 w-full sm:w-[65%] shrink-0 z-0">
                <img
                  src={artistImgUrl}
                  alt={artist.name}
                  className="h-full w-full object-cover object-top transition-[filter,transform] duration-100"
                  style={{
                    transform: `scale(${scrollScale})`,
                    filter: `blur(${scrollBlur}px)`,
                    maskImage: "linear-gradient(to left, black 20%, transparent 90%), linear-gradient(to top, transparent 0%, black 25%)",
                    WebkitMaskImage: "linear-gradient(to left, black 20%, transparent 90%), linear-gradient(to top, transparent 0%, black 25%)",
                    maskComposite: "intersect",
                    WebkitMaskComposite: "source-in",
                  }}
                />
              </div>

              <div className="relative z-10 w-full sm:w-[60%] flex flex-col justify-end px-8 md:px-10 pb-8 min-w-0 pointer-events-none">
                <div className="pointer-events-auto">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/80 mb-2">Artist</p>
                  <h1
                    className="text-4xl md:text-6xl lg:text-7xl font-black text-white mb-2 leading-tight tracking-tight"
                    style={{ opacity: scrollOpacity, textShadow: "0 4px 24px rgba(0,0,0,0.5)" }}
                  >
                    {artist.name}
                  </h1>
                  <p className="text-sm font-medium text-foreground/80 max-w-prose">
                    {cleanBio
                      ? `${cleanBio.slice(0, 180)}${cleanBio.length > 180 ? "..." : ""}`
                      : `Discover top tracks, albums and related artists from ${artist.name}.`}
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      <section className="grid grid-cols-2 md:grid-cols-4 border border-white/10 divide-x divide-y md:divide-y-0 divide-white/10 bg-white/[0.02]">
        <Button
          variant="secondary"
          className={artistActionBtnClass}
          onClick={() => {
            if (isCurrentArtist) togglePlay();
            else if (topTracks.length) play(topTracks[0], topTracks);
          }}
        >
          {isCurrentArtist && isPlaying ? (
            <Pause className="w-4 h-4 mr-2 fill-current" />
          ) : (
            <Play className="w-4 h-4 mr-2 fill-current" />
          )}
          <span className="relative z-10">Play</span>
        </Button>
        <Button
          variant="secondary"
          className={artistActionBtnClass}
        >
          <Shuffle className="w-4 h-4 mr-2" />
          <span className="relative z-10">Shuffle</span>
        </Button>
        <Button
          variant="secondary"
          className={artistActionBtnClass}
          onClick={handleToggleFavorite}
        >
          <Heart
            className={`w-4 h-4 mr-2 transition-colors ${favorite
              ? "fill-current text-[hsl(var(--player-waveform))] group-hover:text-[hsl(var(--dynamic-accent-foreground))]"
              : ""
              }`}
          />
          <span className="relative z-10">{favorite ? "Favorited" : "Add"}</span>
        </Button>
        <Button
          variant="secondary"
          className={artistActionBtnClass}
          onClick={handleShareArtist}
        >
          <Share className="w-4 h-4 mr-2" />
          <span className="relative z-10">Share</span>
        </Button>
      </section>

      {/* Popular Tracks */}
      {loading && topTracks.length === 0 && (
        <div className="flex items-center gap-3 py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Loading tracks…</span>
        </div>
      )}

      {topTracks.length > 0 && (
        <section className="border border-white/10 bg-white/[0.02]">
          <div className={artistSectionHeaderClass}>
            <h2 className={artistSectionTitleClass}>Popular</h2>
            {topTracks.length > 5 && (
              <button
                type="button"
                className="relative z-10 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowAllTracks((prev) => !prev)}
              >
                {showAllTracks ? "Show less" : "See more"}
              </button>
            )}
          </div>
          <div>
            {displayedTracks.map((track, i) => {
              const isCurrent = currentTrack?.id === track.id;
              return (
                <button
                  key={track.id}
                  className={`group relative overflow-hidden w-full grid grid-cols-[36px_48px_minmax(0,1fr)_36px_72px] md:grid-cols-[36px_48px_minmax(0,1fr)_minmax(0,0.8fr)_36px_72px] gap-3 px-4 py-2.5 items-center text-left border-b last:border-b-0 border-white/10 ${isCurrent ? "" : "transition-colors duration-200"}`}
                  style={isCurrent ? { backgroundColor: "hsl(var(--player-waveform) / 0.95)" } : undefined}
                  onClick={() => play(track, topTracks)}
                >
                  {!isCurrent && (
                    <span
                      className="absolute inset-0 origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300 ease-out pointer-events-none"
                      style={{ backgroundColor: "hsl(var(--player-waveform) / 0.95)" }}
                    />
                  )}

                  <span className={`relative z-10 text-sm w-[20px] tabular-nums text-center ${isCurrent ? "text-[hsl(var(--dynamic-accent-foreground))] flex items-center justify-center h-4" : "text-muted-foreground group-hover:text-[hsl(var(--dynamic-accent-foreground))] transition-colors duration-200"}`}>
                    {isCurrent ? <PlayingIndicator isPaused={!isPlaying} /> : `${i + 1}.`}
                  </span>
                  <img src={track.coverUrl} alt="" className="relative z-10 w-12 h-12 object-cover" />
                  <div className="relative z-10 min-w-0">
                    <p
                      className={`text-sm truncate ${isCurrent ? "font-semibold text-[hsl(var(--dynamic-accent-foreground))]" : "font-medium group-hover:text-[hsl(var(--dynamic-accent-foreground))]"}`}
                    >
                      {track.title}
                    </p>
                    <p className={`text-xs truncate ${isCurrent ? "text-[hsl(var(--dynamic-accent-foreground)/0.82)]" : "text-muted-foreground group-hover:text-[hsl(var(--dynamic-accent-foreground)/0.85)] transition-colors duration-200"}`}>
                      {track.artist}
                    </p>
                  </div>
                  <span className="hidden md:block relative z-10 min-w-0">
                    <span
                      role="button"
                      tabIndex={0}
                      className={`text-sm truncate block ${isCurrent ? "" : "transition-colors duration-200"} ${isCurrent
                        ? "text-[hsl(var(--dynamic-accent-foreground)/0.92)]"
                        : "text-muted-foreground hover:text-[hsl(var(--dynamic-accent-foreground))]"
                        }`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void openTrackAlbum(track);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          void openTrackAlbum(track);
                        }
                      }}
                    >
                      {track.album}
                    </span>
                  </span>
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={isLiked(track.id) ? "Remove from liked songs" : "Add to liked songs"}
                    className="relative z-10 flex items-center justify-center w-8 h-8 rounded-none opacity-0 invisible group-hover:opacity-100 group-hover:visible focus-visible:opacity-100 focus-visible:visible transition-opacity duration-200"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleLike(track);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleLike(track);
                      }
                    }}
                  >
                    <Heart
                      className={`w-4 h-4 ${isCurrent ? "" : "transition-colors duration-200"} ${isLiked(track.id)
                        ? "fill-current text-[hsl(var(--dynamic-accent-foreground))]"
                        : isCurrent
                          ? "text-[hsl(var(--dynamic-accent-foreground))]"
                          : "text-muted-foreground group-hover:text-[hsl(var(--dynamic-accent-foreground))]"
                        }`}
                    />
                  </span>
                  <span className={`relative z-10 text-sm text-right font-mono tabular-nums ${isCurrent ? "text-[hsl(var(--dynamic-accent-foreground))]" : "text-muted-foreground group-hover:text-[hsl(var(--dynamic-accent-foreground))] transition-colors duration-200"}`}>{formatDuration(track.duration)}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {albums.length > 0 && (
        <section className="border border-white/10 border-t-0 bg-white/[0.02]">
          <div className={artistSectionHeaderClass}>
            <h2 className={artistSectionTitleClass}>Albums</h2>
            {albums.length > INITIAL_CARD_COUNT && (
              <button
                type="button"
                className="relative z-10 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowAllAlbums((prev) => !prev)}
              >
                {showAllAlbums ? "Show less" : "See more"}
              </button>
            )}
          </div>
          <div className="hover-desaturate-grid grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-0 border-l border-t border-white/10">
            {albums.slice(0, showAllAlbums ? undefined : INITIAL_CARD_COUNT).map((album) => (
              <AlbumCard key={album.id} album={album} navigate={navigate} playAlbum={playAlbum} />
            ))}
          </div>
        </section>
      )}

      {relatedArtists.length > 0 && (
        <section className="pb-4 border border-white/10 border-t-0 bg-white/[0.02]">
          <div className={artistSectionHeaderClass}>
            <h2 className={artistSectionTitleClass}>Related Artists</h2>
            {relatedArtists.length > INITIAL_CARD_COUNT && (
              <button
                type="button"
                onClick={() => setShowAllRelated((prev) => !prev)}
                className="relative z-10 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                {showAllRelated ? "Show less" : "See more"}
              </button>
            )}
          </div>
          <div className="hover-desaturate-grid grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-0 border-l border-t border-white/10">
            {(showAllRelated ? relatedArtists : relatedArtists.slice(0, INITIAL_CARD_COUNT)).map((ra) => (
              <button
                key={ra.id}
                className="hover-desaturate-card relative group cursor-pointer text-left border-r border-b border-white/10 p-3 transition-colors hover:bg-white/[0.03]"
                onClick={() => navigate(`/artist/${ra.id}?name=${encodeURIComponent(ra.name)}`)}
              >
                <div className="relative mb-2 overflow-hidden aspect-[4/3] border border-white/10">
                  <img
                    src={ra.picture || "/placeholder.svg"}
                    alt={ra.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg"; }}
                  />
                </div>
                <p className="text-sm font-semibold truncate text-foreground">{ra.name}</p>
              </button>
            ))}
          </div>
        </section>
      )}
    </motion.div>
  );
}
