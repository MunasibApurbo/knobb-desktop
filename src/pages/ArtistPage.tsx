import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { searchArtists, searchTracks, searchAlbums, getRecommendations, getTidalImageUrl, tidalTrackToAppTrack, TidalArtist, TidalAlbum } from "@/lib/monochromeApi";
import { Track, formatDuration } from "@/data/mockData";
import { usePlayer } from "@/contexts/PlayerContext";
import { useLikedSongs } from "@/contexts/LikedSongsContext";
import { Play, Pause, Shuffle, Heart, Loader2, Mic2 } from "lucide-react";
import { Button } from "@/components/ui/button";


export default function ArtistPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const artistName = searchParams.get("name") || "";
  const navigate = useNavigate();
  const { play, currentTrack, isPlaying, togglePlay } = usePlayer();
  const { isLiked, toggleLike } = useLikedSongs();

  const [artist, setArtist] = useState<TidalArtist | null>(null);
  const [topTracks, setTopTracks] = useState<Track[]>([]);
  const [discography, setDiscography] = useState<TidalAlbum[]>([]);
  const [relatedArtists, setRelatedArtists] = useState<{ id: number; name: string; picture: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllTracks, setShowAllTracks] = useState(false);
  const loadIdRef = useRef<string>("");

  useEffect(() => {
    const key = `${id}-${artistName}`;
    if (loadIdRef.current === key) return;
    loadIdRef.current = key;

    if (artistName) {
      setArtist((prev) => prev?.name === artistName ? prev : { id: parseInt(id || "0"), name: artistName, picture: null, popularity: 0, url: "" });
    }
    setLoading(true);
    setShowAllTracks(false);

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

          // Fetch tracks, albums, and related artists in parallel
          const [tracks, albums] = await Promise.all([
            searchTracks(found.name, 20),
            searchAlbums(found.name, 20),
          ]);

          if (!cancelled) {
            const appTracks = tracks.map(tidalTrackToAppTrack);
            setTopTracks(appTracks);

            // Filter albums to only those by this artist
            const artistAlbums = albums.filter((a) =>
              a.artist?.name?.toLowerCase() === found!.name.toLowerCase() ||
              a.artists?.some((ar) => ar.name.toLowerCase() === found!.name.toLowerCase())
            );
            setDiscography(artistAlbums);

            // Extract related artists from track results (different artists featured)
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

            // Also try to get related from recommendations
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
          }
        }
      } catch (e) {
        console.error("Failed to load artist:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [id, artistName]);

  if (!artist && loading) {
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

  return (
    <div>
      {/* Hero */}
      <div className="flex items-end gap-6 pb-8 -mx-6 -mt-16 px-6 pt-20"
        style={{
          background: "linear-gradient(180deg, hsl(var(--dynamic-accent) / 0.4) 0%, transparent 100%)",
        }}
      >
        <div className="w-56 h-56 rounded-full overflow-hidden shadow-2xl shrink-0">
          <img
            src={
              artist.picture
                ? getTidalImageUrl(artist.picture, "750x750")
                : topTracks[0]?.coverUrl || "/placeholder.svg"
            }
            alt={artist.name}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="flex flex-col justify-end min-w-0">
          <p className="text-xs font-bold text-foreground/70 uppercase">Artist</p>
          <h1 className="text-5xl font-black text-foreground mt-2 mb-3 truncate tracking-tight">{artist.name}</h1>
          <p className="text-sm text-foreground/70">
            Popularity: {artist.popularity}% · {topTracks.length} top tracks
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-6 mb-6 mt-4">
        <button
          className="w-14 h-14 rounded-full flex items-center justify-center shadow-xl hover:scale-105 transition-transform active:scale-95"
          style={{ background: `hsl(var(--dynamic-accent))` }}
          onClick={() => {
            if (isCurrentArtist && isPlaying) togglePlay();
            else if (topTracks.length) play(topTracks[0], topTracks);
          }}
        >
          {isCurrentArtist && isPlaying ? (
            <Pause className="w-6 h-6 text-foreground fill-current" />
          ) : (
            <Play className="w-6 h-6 text-foreground fill-current ml-1" />
          )}
        </button>
        <Button variant="ghost" size="icon" className="w-9 h-9 text-muted-foreground hover:text-foreground">
          <Shuffle className="w-5 h-5" />
        </Button>
      </div>

      {/* Popular Tracks */}
      {loading && topTracks.length === 0 && (
        <div className="flex items-center gap-3 py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Loading tracks…</span>
        </div>
      )}
      {topTracks.length > 0 && (
        <>
          <h2 className="text-xl font-bold text-foreground mb-4">Popular</h2>
          <div className="mb-2">
            {displayedTracks.map((track, i) => {
              const isCurrent = currentTrack?.id === track.id;
              return (
                <div
                  key={track.id}
                  className={`grid grid-cols-[40px_1fr_1fr_40px_60px] gap-4 px-4 py-2.5 items-center cursor-pointer rounded-md transition-all group
                    ${isCurrent ? "bg-accent/30" : "hover:bg-accent/15"}`}
                  onClick={() => play(track, topTracks)}
                >
                  <span className="text-center text-sm text-muted-foreground">
                    {isCurrent && isPlaying ? (
                      <div className="playing-bars flex items-end gap-[2px] justify-center"><span /><span /><span /></div>
                    ) : (
                      <span className="group-hover:hidden">{i + 1}</span>
                    )}
                    <Play className="w-4 h-4 mx-auto text-foreground hidden group-hover:block" />
                  </span>
                  <div className="flex items-center gap-3 min-w-0">
                    <img src={track.coverUrl} alt="" className="w-10 h-10 rounded object-cover" />
                    <p className={`text-sm truncate ${isCurrent ? "font-semibold" : ""}`}
                      style={isCurrent ? { color: `hsl(var(--dynamic-accent))` } : {}}>
                      {track.title}
                    </p>
                  </div>
                  <span className="text-sm text-muted-foreground truncate">{track.album}</span>
                  <button
                    className="flex items-center justify-center"
                    onClick={(e) => { e.stopPropagation(); toggleLike(track); }}
                  >
                    <Heart className={`w-4 h-4 transition-colors ${isLiked(track.id) ? "text-[hsl(var(--dynamic-accent))] fill-current" : "text-muted-foreground hover:text-foreground"}`} />
                  </button>
                  <span className="text-sm text-muted-foreground text-right font-mono">{formatDuration(track.duration)}</span>
                </div>
              );
            })}
          </div>
          {topTracks.length > 5 && (
            <button
              className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors mb-8 px-4"
              onClick={() => setShowAllTracks(!showAllTracks)}
            >
              {showAllTracks ? "Show less" : "See more"}
            </button>
          )}
        </>
      )}

      {/* Discography */}
      {discography.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-bold text-foreground mb-4">Discography</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 mb-8">
            {discography.map((album) => (
              <div
                key={album.id}
                className="glass-card rounded-lg p-3.5 cursor-pointer group"
                onClick={() => navigate(`/album/tidal-${album.id}`)}
              >
                <div className="relative mb-3 rounded-md overflow-hidden aspect-square shadow-lg">
                  <img
                    src={getTidalImageUrl(album.cover, "480x480")}
                    alt={album.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div
                    className="absolute bottom-2 right-2 w-11 h-11 rounded-full flex items-center justify-center shadow-xl opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300"
                    style={{ background: `hsl(var(--dynamic-accent))` }}
                  >
                    <Play className="w-5 h-5 text-foreground ml-0.5 fill-current" />
                  </div>
                </div>
                <p className="text-sm font-bold text-foreground truncate">{album.title}</p>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {album.releaseDate ? new Date(album.releaseDate).getFullYear() : "Album"}
                  {album.numberOfTracks ? ` · ${album.numberOfTracks} tracks` : ""}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Related Artists */}
      {relatedArtists.length > 0 && (
        <div className="mt-4">
          <h2 className="text-xl font-bold text-foreground mb-4">Related Artists</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 mb-8">
            {relatedArtists.map((ra) => (
              <div
                key={ra.id}
                className="glass-card rounded-lg p-3.5 cursor-pointer group"
                onClick={() => navigate(`/artist/${ra.id}?name=${encodeURIComponent(ra.name)}`)}
              >
                <div className="relative mb-3 rounded-full overflow-hidden aspect-square shadow-lg mx-auto">
                  <img
                    src={ra.picture || "/placeholder.svg"}
                    alt={ra.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                </div>
                <p className="text-sm font-bold text-foreground truncate text-center">{ra.name}</p>
                <div className="flex items-center justify-center gap-1 mt-0.5">
                  <Mic2 className="w-3 h-3 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Artist</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}