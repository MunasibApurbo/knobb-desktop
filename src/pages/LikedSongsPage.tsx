import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePlayer } from "@/contexts/PlayerContext";
import { useLikedSongs } from "@/contexts/LikedSongsContext";
import { formatDuration, getTotalDuration } from "@/lib/utils";
import { searchAlbums } from "@/lib/monochromeApi";
import { Track } from "@/types/music";
import { Play, Pause, Shuffle, Heart, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageTransition } from "@/components/PageTransition";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { PlayingIndicator } from "@/components/PlayingIndicator";

export default function LikedSongsPage() {
  const navigate = useNavigate();
  const { play, currentTrack, isPlaying, togglePlay } = usePlayer();
  const { likedSongs, isLiked, toggleLike } = useLikedSongs();

  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const scrollContainer = document.querySelector("[data-radix-scroll-area-viewport]");
    if (!scrollContainer) return;
    const handleScroll = () => setScrollY(scrollContainer.scrollTop);
    scrollContainer.addEventListener("scroll", handleScroll, { passive: true });
    return () => scrollContainer.removeEventListener("scroll", handleScroll);
  }, []);

  const isCurrentLiked = currentTrack && likedSongs.some((track) => track.id === currentTrack.id);
  const coverUrl = likedSongs[0]?.coverUrl || "/placeholder.svg";

  const handleShuffle = () => {
    if (likedSongs.length === 0) return;
    const shuffled = [...likedSongs].sort(() => Math.random() - 0.5);
    play(shuffled[0], shuffled);
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Liked Songs", text: "My liked songs", url });
        return;
      } catch {
        // fall through to clipboard
      }
    }
    await navigator.clipboard.writeText(url);
    toast.success("Liked Songs link copied to clipboard");
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
    } catch (error) {
      console.warn("Album lookup failed:", error);
    }

    toast.error("Album not found");
  };

  const actionBtnClass =
    "group rounded-none h-14 justify-start px-4 md:px-6 font-semibold text-base bg-transparent border-0 " +
    "relative overflow-hidden transition-colors hover:text-[hsl(var(--dynamic-accent-foreground))] " +
    "before:content-[''] before:absolute before:inset-0 before:origin-left before:scale-x-0 " +
    "before:transition-transform before:duration-300 before:ease-out before:bg-[hsl(var(--player-waveform)/0.95)] " +
    "hover:before:scale-x-100 [&>*]:relative [&>*]:z-10";

  return (
    <PageTransition>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="space-y-0">
        {(() => {
          const scrollScale = 1 + scrollY * 0.001;
          const scrollBlur = Math.min(scrollY * 0.05, 12);
          const scrollOpacity = Math.max(1 - scrollY * 0.002, 0.4);

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
                src={coverUrl}
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
                    src={coverUrl}
                    alt="Liked Songs"
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
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/80 mb-2">Playlist</p>
                    <h1
                      className="text-4xl md:text-6xl lg:text-7xl font-black text-white mb-2 leading-tight tracking-tight"
                      style={{ opacity: scrollOpacity, textShadow: "0 4px 24px rgba(0,0,0,0.5)" }}
                    >
                      Liked Songs
                    </h1>
                    <p className="text-sm font-medium text-foreground/80 mb-1" style={{ opacity: scrollOpacity }}>
                      Your saved tracks.
                    </p>
                    <div className="text-xs font-medium text-foreground/60 tracking-wide uppercase mt-1" style={{ opacity: scrollOpacity }}>
                      {likedSongs.length} TRACK{likedSongs.length !== 1 ? "S" : ""} {likedSongs.length > 0 ? `(${getTotalDuration(likedSongs)})` : ""}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        <section className="grid grid-cols-2 md:grid-cols-4 border border-white/10 divide-x divide-y md:divide-y-0 divide-white/10 bg-white/[0.02]">
          <Button
            variant="secondary"
            className={actionBtnClass}
            onClick={() => {
              if (isCurrentLiked) togglePlay();
              else if (likedSongs.length) play(likedSongs[0], likedSongs);
            }}
            disabled={likedSongs.length === 0}
          >
            {isCurrentLiked && isPlaying ? (
              <Pause className="w-4 h-4 mr-2 fill-current" />
            ) : (
              <Play className="w-4 h-4 mr-2 fill-current" />
            )}
            <span className="relative z-10">Play</span>
          </Button>
          <Button variant="secondary" className={actionBtnClass} onClick={handleShuffle} disabled={likedSongs.length === 0}>
            <Shuffle className="w-4 h-4 mr-2" />
            <span className="relative z-10">Shuffle</span>
          </Button>
          <Button variant="secondary" className={actionBtnClass} disabled>
            <Heart className="w-4 h-4 mr-2 fill-current text-[hsl(var(--player-waveform))] group-hover:text-[hsl(var(--dynamic-accent-foreground))]" />
            <span className="relative z-10">Liked</span>
          </Button>
          <Button variant="secondary" className={actionBtnClass} onClick={handleShare}>
            <Share className="w-4 h-4 mr-2" />
            <span className="relative z-10">Share</span>
          </Button>
        </section>

        {likedSongs.length > 0 ? (
          <section className="border border-white/10 bg-white/[0.02]">
            <div>
              {likedSongs.map((track, i) => {
                const isCurrent = currentTrack?.id === track.id;
                return (
                  <button
                    key={track.id}
                    className={`group relative overflow-hidden w-full grid grid-cols-[36px_48px_minmax(0,1fr)_36px_72px] md:grid-cols-[36px_48px_minmax(0,1fr)_minmax(0,0.8fr)_36px_72px] gap-3 px-4 py-2.5 items-center text-left border-b last:border-b-0 border-white/10 ${isCurrent ? "" : "transition-colors duration-200"}`}
                    style={isCurrent ? { backgroundColor: "hsl(var(--player-waveform) / 0.95)" } : undefined}
                    onClick={() => play(track, likedSongs)}
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
                      <p className={`text-sm truncate ${isCurrent ? "font-semibold text-[hsl(var(--dynamic-accent-foreground))]" : "font-medium group-hover:text-[hsl(var(--dynamic-accent-foreground))]"}`}>
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
                        className={`text-sm truncate block ${isCurrent ? "text-[hsl(var(--dynamic-accent-foreground)/0.92)]" : "text-muted-foreground hover:text-[hsl(var(--dynamic-accent-foreground))] transition-colors duration-200"}`}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          void openTrackAlbum(track);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            event.stopPropagation();
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
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        void toggleLike(track);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          event.stopPropagation();
                          void toggleLike(track);
                        }
                      }}
                    >
                      <Heart className={`w-4 h-4 ${isLiked(track.id) ? "fill-current text-[hsl(var(--dynamic-accent-foreground))]" : isCurrent ? "text-[hsl(var(--dynamic-accent-foreground))]" : "text-muted-foreground group-hover:text-[hsl(var(--dynamic-accent-foreground))] transition-colors duration-200"}`} />
                    </span>
                    <span className={`relative z-10 text-sm text-right font-mono tabular-nums ${isCurrent ? "text-[hsl(var(--dynamic-accent-foreground))]" : "text-muted-foreground group-hover:text-[hsl(var(--dynamic-accent-foreground))] transition-colors duration-200"}`}>
                      {formatDuration(track.duration)}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ) : (
          <section className="border border-white/10 bg-white/[0.02]">
            <p className="text-muted-foreground text-sm py-10 text-center">Songs you like will appear here.</p>
          </section>
        )}
      </motion.div>
    </PageTransition>
  );
}
