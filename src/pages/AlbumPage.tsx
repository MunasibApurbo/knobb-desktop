import { useParams } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { albums, getTotalDuration, Track } from "@/data/mockData";
import { getAlbumTracks, getTidalImageUrl, tidalTrackToAppTrack } from "@/lib/monochromeApi";
import { usePlayer } from "@/contexts/PlayerContext";
import { Play, Pause, Shuffle, Heart, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ArtistLink } from "@/components/ArtistLink";
import { TrackListRow } from "@/components/TrackListRow";
import { TrackListHeader } from "@/components/TrackListHeader";
import { PageTransition } from "@/components/PageTransition";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { motion } from "framer-motion";

const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.03 } } };

export default function AlbumPage() {
  const { id } = useParams();
  const { play, currentTrack, isPlaying, togglePlay } = usePlayer();

  const isTidal = id?.startsWith("tidal-");
  const tidalAlbumId = isTidal ? parseInt(id!.replace("tidal-", "")) : null;
  const localAlbum = !isTidal ? albums.find((a) => a.id === id) : null;

  const [tidalTracks, setTidalTracks] = useState<Track[]>([]);
  const [tidalAlbumInfo, setTidalAlbumInfo] = useState<{
    title: string; artist: string; artistId?: number; coverUrl: string; year: number; canvasColor: string;
  } | null>(null);
  const [loading, setLoading] = useState(!!isTidal);
  const [error, setError] = useState(false);
  const fetchedRef = useRef<string>("");

  const loadAlbum = () => {
    if (!isTidal || !tidalAlbumId) return;
    fetchedRef.current = id!;
    setError(false);
    setLoading(true);

    (async () => {
      try {
        const tracks = await getAlbumTracks(tidalAlbumId);
        if (tracks.length > 0) {
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
        }
      } catch (e) {
        console.error("Failed to load Tidal album:", e);
        setError(true);
      } finally {
        setLoading(false);
      }
    })();
  };

  useEffect(() => {
    if (fetchedRef.current !== id) loadAlbum();
  }, [id]);

  const albumTitle = tidalAlbumInfo?.title || localAlbum?.title;
  const albumArtist = tidalAlbumInfo?.artist || localAlbum?.artist;
  const albumArtistId = tidalAlbumInfo?.artistId;
  const albumCover = tidalAlbumInfo?.coverUrl || localAlbum?.coverUrl;
  const albumYear = tidalAlbumInfo?.year || localAlbum?.year;
  const albumColor = tidalAlbumInfo?.canvasColor || localAlbum?.canvasColor || "220 70% 55%";
  const trackList = tidalTracks.length > 0 ? tidalTracks : (localAlbum?.tracks || []);

  if (loading) return <LoadingSkeleton />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="w-12 h-12 text-muted-foreground" />
        <p className="text-muted-foreground text-lg font-medium">Failed to load album</p>
        <Button variant="outline" onClick={loadAlbum} className="gap-2">
          <RefreshCw className="w-4 h-4" /> Try again
        </Button>
      </div>
    );
  }

  if (!albumTitle) return <div className="p-8 text-foreground">Album not found.</div>;

  const isCurrentAlbum = currentTrack && trackList.some((t) => t.id === currentTrack.id);

  return (
    <PageTransition>
      {/* Hero Header */}
      <div
        className="flex flex-col md:flex-row gap-4 md:gap-6 pb-6 md:pb-8 -mx-4 md:-mx-6 -mt-14 md:-mt-16 px-4 md:px-6 pt-16 md:pt-20"
        style={{ background: `linear-gradient(180deg, hsl(${albumColor} / 0.5) 0%, transparent 100%)` }}
      >
        <motion.img
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          src={albumCover}
          alt={albumTitle}
          className="w-40 h-40 md:w-56 md:h-56 object-cover rounded-md shadow-2xl shrink-0 mx-auto md:mx-0"
        />
        <div className="flex flex-col justify-end min-w-0 text-center md:text-left">
          <p className="text-xs font-bold text-foreground/70 uppercase">Album</p>
          <h1 className="text-3xl md:text-5xl font-black text-foreground mt-2 mb-4 truncate tracking-tight">{albumTitle}</h1>
          <div className="flex items-center justify-center md:justify-start gap-1 text-sm text-foreground/80">
            <ArtistLink name={albumArtist || ""} artistId={albumArtistId} className="font-semibold text-foreground/80" />
            <span className="text-foreground/50">·</span>
            <span>{albumYear}</span>
            <span className="text-foreground/50">·</span>
            <span>{trackList.length} songs{trackList.length > 0 ? `, ${getTotalDuration(trackList)}` : ""}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4 md:gap-6 mb-6 mt-4 justify-center md:justify-start">
        <button
          className="w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center shadow-xl hover:scale-105 transition-transform active:scale-95"
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
        <TrackListHeader />
        {trackList.map((track, i) => (
          <TrackListRow key={track.id} track={track} index={i} tracks={trackList} showCover={!!isTidal} />
        ))}
      </motion.div>
    </PageTransition>
  );
}
