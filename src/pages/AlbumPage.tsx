import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { albums, formatDuration, getTotalDuration, Track } from "@/data/mockData";
import { getAlbumTracks, searchTracks, getTidalImageUrl, tidalTrackToAppTrack, TidalAlbum } from "@/lib/monochromeApi";
import { usePlayer } from "@/contexts/PlayerContext";
import { useLikedSongs } from "@/contexts/LikedSongsContext";
import { Play, Pause, Shuffle, Heart, MoreHorizontal, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ArtistLink } from "@/components/ArtistLink";
import { motion } from "framer-motion";

const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.03 } } };
const fadeUp = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

export default function AlbumPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { play, currentTrack, isPlaying, togglePlay } = usePlayer();
  const { isLiked, toggleLike } = useLikedSongs();

  // Check if this is a Tidal album
  const isTidal = id?.startsWith("tidal-");
  const tidalAlbumId = isTidal ? parseInt(id!.replace("tidal-", "")) : null;

  // Local album
  const localAlbum = !isTidal ? albums.find((a) => a.id === id) : null;

  // Tidal album state
  const [tidalTracks, setTidalTracks] = useState<Track[]>([]);
  const [tidalAlbumInfo, setTidalAlbumInfo] = useState<{
    title: string;
    artist: string;
    artistId?: number;
    coverUrl: string;
    year: number;
    canvasColor: string;
  } | null>(null);
  const [loading, setLoading] = useState(!!isTidal);
  const fetchedRef = useRef<string>("");

  useEffect(() => {
    if (!isTidal || !tidalAlbumId) return;
    if (fetchedRef.current === id) return;
    fetchedRef.current = id!;

    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        // Try fetching album tracks directly
        let tracks = await getAlbumTracks(tidalAlbumId);

        if (tracks.length === 0) {
          // Fallback: we might have album info from navigation state
          // Try searching by the album ID in track results
        }

        if (!cancelled && tracks.length > 0) {
          const appTracks = tracks.map(tidalTrackToAppTrack);
          setTidalTracks(appTracks);
          setTidalAlbumInfo({
            title: tracks[0].album?.title || "Unknown Album",
            artist: tracks[0].artists?.map((a) => a.name).join(", ") || tracks[0].artist?.name || "Unknown",
            artistId: tracks[0].artist?.id,
            coverUrl: getTidalImageUrl(tracks[0].album?.cover || "", "750x750"),
            year: new Date().getFullYear(),
            canvasColor: appTracks[0]?.canvasColor || "220 70% 55%",
          });
        } else if (!cancelled) {
          // No tracks found via API, album might not be accessible
          setTidalAlbumInfo(null);
        }
      } catch (e) {
        console.error("Failed to load Tidal album:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [id, isTidal, tidalAlbumId]);

  // Use Tidal or local data
  const albumTitle = tidalAlbumInfo?.title || localAlbum?.title;
  const albumArtist = tidalAlbumInfo?.artist || localAlbum?.artist;
  const albumArtistId = tidalAlbumInfo?.artistId;
  const albumCover = tidalAlbumInfo?.coverUrl || localAlbum?.coverUrl;
  const albumYear = tidalAlbumInfo?.year || localAlbum?.year;
  const albumColor = tidalAlbumInfo?.canvasColor || localAlbum?.canvasColor || "220 70% 55%";
  const trackList = tidalTracks.length > 0 ? tidalTracks : (localAlbum?.tracks || []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!albumTitle) return <div className="p-8 text-foreground">Album not found.</div>;

  const isCurrentAlbum = currentTrack && trackList.some((t) => t.id === currentTrack.id);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      {/* Hero Header */}
      <div
        className="flex gap-6 pb-8 -mx-6 -mt-16 px-6 pt-20"
        style={{
          background: `linear-gradient(180deg, hsl(${albumColor} / 0.5) 0%, transparent 100%)`,
        }}
      >
        <motion.img
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          src={albumCover}
          alt={albumTitle}
          className="w-56 h-56 object-cover rounded-md shadow-2xl shrink-0"
        />
        <div className="flex flex-col justify-end min-w-0">
          <p className="text-xs font-bold text-foreground/70 uppercase">Album</p>
          <h1 className="text-5xl font-black text-foreground mt-2 mb-4 truncate tracking-tight">{albumTitle}</h1>
          <div className="flex items-center gap-1 text-sm text-foreground/80">
            <ArtistLink name={albumArtist || ""} artistId={albumArtistId} className="font-semibold text-foreground/80" />
            <span className="text-foreground/50">·</span>
            <span>{albumYear}</span>
            <span className="text-foreground/50">·</span>
            <span>{trackList.length} songs{trackList.length > 0 ? `, ${getTotalDuration(trackList)}` : ""}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-6 mb-6 mt-4">
        <button
          className="w-14 h-14 rounded-full flex items-center justify-center shadow-xl hover:scale-105 transition-transform active:scale-95"
          style={{ background: `hsl(var(--dynamic-accent))` }}
          onClick={() => {
            if (isCurrentAlbum) togglePlay();
            else if (trackList.length) play(trackList[0], trackList);
          }}
        >
          {isCurrentAlbum && isPlaying ? (
            <Pause className="w-6 h-6 text-foreground fill-current" />
          ) : (
            <Play className="w-6 h-6 text-foreground fill-current ml-1" />
          )}
        </button>
        <Button variant="ghost" size="icon" className="w-9 h-9 text-muted-foreground hover:text-foreground">
          <Shuffle className="w-5 h-5" />
        </Button>
        <Button variant="ghost" size="icon" className="w-9 h-9 text-muted-foreground hover:text-foreground">
          <Heart className="w-5 h-5" />
        </Button>
      </div>

      {/* Track list */}
      <motion.div variants={stagger} initial="hidden" animate="show">
        <div className="grid grid-cols-[40px_1fr_1fr_40px_60px] gap-4 px-4 py-2 text-xs font-medium text-muted-foreground border-b border-border/30 uppercase tracking-wider mb-1">
          <span className="text-center">#</span>
          <span>Title</span>
          <span>Artist</span>
          <span></span>
          <span className="text-right"><Clock className="w-4 h-4 inline" /></span>
        </div>

        {trackList.map((track, i) => {
          const isCurrent = currentTrack?.id === track.id;
          return (
            <motion.div
              key={track.id}
              variants={fadeUp}
              className={`grid grid-cols-[40px_1fr_1fr_40px_60px] gap-4 px-4 py-2.5 items-center cursor-pointer rounded-md transition-all duration-200 group
                ${isCurrent ? "bg-accent/30" : "hover:bg-accent/15"}`}
              onClick={() => play(track, trackList)}
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
                {isTidal && (
                  <img src={track.coverUrl} alt="" className="w-10 h-10 rounded object-cover" />
                )}
                <span className={`text-sm truncate ${isCurrent ? "font-semibold" : ""}`}
                  style={isCurrent ? { color: `hsl(var(--dynamic-accent))` } : {}}>
                  {track.title}
                </span>
              </div>
              <span className="text-sm truncate"><ArtistLink name={track.artist} artistId={track.artistId} className="text-sm" /></span>
              <button
                className="flex items-center justify-center"
                onClick={(e) => { e.stopPropagation(); toggleLike(track); }}
              >
                <Heart className={`w-4 h-4 transition-colors ${isLiked(track.id) ? "text-[hsl(var(--dynamic-accent))] fill-current" : "text-muted-foreground hover:text-foreground"}`} />
              </button>
              <span className="text-sm text-muted-foreground text-right font-mono">{formatDuration(track.duration)}</span>
            </motion.div>
          );
        })}
      </motion.div>
    </motion.div>
  );
}