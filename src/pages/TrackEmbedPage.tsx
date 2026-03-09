import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { AlertCircle, ExternalLink, Loader2, MoreHorizontal, Pause, Play, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlayer } from "@/contexts/PlayerContext";
import { usePageMetadata } from "@/hooks/usePageMetadata";
import { buildTrackSourceUrl, getTrackShareIdentifier } from "@/lib/mediaNavigation";
import { getTrackInfo, tidalTrackToAppTrack } from "@/lib/musicApi";
import { formatDuration } from "@/lib/utils";
import { inferTidalIdFromTrackId } from "@/lib/trackIdentity";
import { cn } from "@/lib/utils";
import type { Track } from "@/types/music";

type EmbedTheme = "ocean" | "graphite";

function shiftEmbedColor(
  accent: string,
  {
    hueShift = 0,
    saturationShift = 0,
    lightnessShift = 0,
  }: {
    hueShift?: number;
    saturationShift?: number;
    lightnessShift?: number;
  } = {},
) {
  const match = accent.trim().match(/^(-?\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/);
  if (!match) return "220 70% 55%";

  const hue = ((Number(match[1]) + hueShift) % 360 + 360) % 360;
  const saturation = Math.max(14, Math.min(96, Number(match[2]) + saturationShift));
  const lightness = Math.max(8, Math.min(72, Number(match[3]) + lightnessShift));

  return `${Math.round(hue)} ${Math.round(saturation)}% ${Math.round(lightness)}%`;
}

export default function TrackEmbedPage() {
  const { trackId } = useParams<{ trackId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { currentTrack, isPlaying, play, togglePlay } = usePlayer();
  const [track, setTrack] = useState<Track | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const resolvedTrackId = inferTidalIdFromTrackId(trackId);
    if (!resolvedTrackId) {
      setTrack(null);
      setLoading(false);
      setError("This track cannot be embedded.");
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const tidalTrack = await getTrackInfo(resolvedTrackId);
        if (!active) return;

        if (!tidalTrack) {
          setTrack(null);
          setError("Track unavailable");
          setLoading(false);
          return;
        }

        setTrack(tidalTrackToAppTrack(tidalTrack));
        setLoading(false);
      } catch (loadError) {
        console.error("Failed to load track embed", loadError);
        if (!active) return;
        setTrack(null);
        setError("Failed to load track");
        setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [trackId]);

  const sourceUrl = useMemo(() => (track ? buildTrackSourceUrl(track) : null), [track]);
  const isCurrentTrack = useMemo(() => {
    if (!track || !currentTrack) return false;
    return getTrackShareIdentifier(track) === getTrackShareIdentifier(currentTrack);
  }, [currentTrack, track]);
  const theme = useMemo<EmbedTheme>(() => {
    const params = new URLSearchParams(location.search);
    return params.get("theme") === "graphite" ? "graphite" : "ocean";
  }, [location.search]);
  const artworkStyles = useMemo(() => {
    const base = track?.canvasColor || "220 70% 55%";
    const glow = shiftEmbedColor(base, { saturationShift: 8, lightnessShift: 6 });
    const edge = shiftEmbedColor(base, { hueShift: 18, saturationShift: -6, lightnessShift: -22 });
    const deep = shiftEmbedColor(base, { hueShift: -12, saturationShift: -10, lightnessShift: -30 });

    return {
      shell: {
        background: `radial-gradient(circle at 14% 24%, hsl(${glow} / 0.34), transparent 32%),
radial-gradient(circle at 92% 10%, hsl(${edge} / 0.28), transparent 30%),
linear-gradient(135deg, hsl(${deep}) 0%, rgb(0 0 0) 58%, rgb(0 0 0) 100%)`,
      },
      panel: {
        background: `linear-gradient(90deg, hsl(${glow} / 0.34) 0%, hsl(${edge} / 0.18) 18%, rgba(0,0,0,0.82) 42%, rgba(0,0,0,0.94) 72%, rgba(0,0,0,0.98) 100%)`,
      },
      pill: {
        borderColor: `hsl(${glow} / 0.38)`,
        backgroundColor: `hsl(${glow} / 0.16)`,
      },
      action: {
        borderColor: `hsl(${glow} / 0.34)`,
        backgroundColor: `hsl(${glow} / 0.12)`,
      },
      play: {
        backgroundColor: `hsl(${glow})`,
        color: "black",
      },
    };
  }, [track?.canvasColor]);

  usePageMetadata(track ? {
    title: `${track.title} - ${track.artist}`,
    description: `Embedded track player for ${track.title} by ${track.artist}.`,
    image: track.coverUrl || undefined,
    imageAlt: `${track.title} cover art`,
    robots: "noindex, nofollow",
    type: "music.song",
    structuredData: {
      "@context": "https://schema.org",
      "@type": "MusicRecording",
      name: track.title,
      byArtist: {
        "@type": "MusicGroup",
        name: track.artist,
      },
      duration: track.duration ? `PT${Math.max(Math.round(track.duration), 0)}S` : undefined,
      image: track.coverUrl || undefined,
      inAlbum: track.album
        ? {
            "@type": "MusicAlbum",
            name: track.album,
          }
        : undefined,
      url: sourceUrl || undefined,
    },
  } : {
    title: "Embedded Track",
    description: "Embedded track player on Knobb.",
    robots: "noindex, nofollow",
  });

  const handlePlay = () => {
    if (!track) return;
    if (isCurrentTrack) {
      togglePlay();
      return;
    }

    play(track, [track]);
  };

  const openSourceTrack = () => {
    if (sourceUrl) {
      window.open(sourceUrl, "_blank", "noopener,noreferrer");
      return;
    }

    navigate("/");
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center overflow-hidden bg-[#050505] text-white">
        <Loader2 className="h-6 w-6 animate-spin text-white/55" />
      </div>
    );
  }

  if (!track) {
    return (
      <div className="flex h-screen items-center justify-center overflow-hidden bg-[#050505] p-4 text-white">
        <div className="w-full max-w-xl rounded-[var(--surface-radius-lg)] border border-white/10 bg-white/[0.04] p-8 text-center shadow-[0_30px_120px_rgba(0,0,0,0.45)]">
          <AlertCircle className="mx-auto h-10 w-10 text-white/45" />
          <h1 className="mt-4 text-2xl font-black tracking-tight text-white">Track unavailable</h1>
          <p className="mt-3 text-sm leading-6 text-white/55">{error || "This track could not be embedded."}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn("h-screen overflow-hidden text-white", theme === "graphite" ? "bg-black" : undefined)}
      style={theme === "ocean" ? artworkStyles.shell : undefined}
    >
      <section
        className={cn("flex h-full w-full items-center", theme === "graphite" ? "bg-black" : undefined)}
        style={theme === "ocean" ? artworkStyles.panel : undefined}
      >
        <div className="grid h-full w-full gap-0 md:grid-cols-[260px_minmax(0,1fr)] md:items-center">
          <div className="flex items-center justify-center px-8 py-6">
            <div className="h-[180px] w-[180px] overflow-hidden rounded-[var(--surface-radius-lg)] border border-white/10 bg-black shadow-[0_18px_60px_rgba(0,0,0,0.42)] md:h-[220px] md:w-[220px]">
              <img
                src={track.coverUrl || "/placeholder.svg"}
                alt={track.title}
                className="h-full w-full object-cover"
              />
            </div>
          </div>

          <div className="flex min-w-0 flex-col justify-between self-stretch px-6 py-6 md:pl-2 md:pr-8">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h1 className="truncate text-[clamp(2.4rem,4.2vw,4.3rem)] font-black tracking-tight text-white">
                  {track.title}
                </h1>
                <div className="mt-3 flex min-w-0 items-center gap-3 text-[18px] text-white/72">
                  <span
                    className={cn(
                      "rounded-[var(--surface-radius-sm)] px-3 py-1 text-sm font-semibold text-white",
                      theme === "graphite" ? "border border-white/12 bg-white/[0.08]" : undefined,
                    )}
                    style={theme === "ocean" ? artworkStyles.pill : undefined}
                  >
                    Preview
                  </span>
                  <span className="truncate">{track.artist}</span>
                </div>
                {track.album ? <p className="mt-3 truncate text-[16px] text-white/62">{track.album}</p> : null}
              </div>

              <img
                src="/brand/logo-k-black-square-256.png"
                alt="Knobb"
                className="h-12 w-12 rounded-[var(--surface-radius-sm)] border border-white/10 bg-black object-cover"
              />
            </div>

            <div className="mt-6 flex items-center gap-4 text-[18px] text-white">
              <PlusCircle className="h-11 w-11 shrink-0" strokeWidth={1.75} />
              <span>Save on Knobb</span>
            </div>

            <div className="mt-auto flex items-end justify-between pt-5">
              <div className="flex items-center gap-4 text-white/90">
                <MoreHorizontal className="h-10 w-10" />
                {track.duration ? <span className="text-sm uppercase tracking-[0.18em] text-white/58">{formatDuration(track.duration)}</span> : null}
              </div>

              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  className={cn(
                    "rounded-[var(--surface-radius-lg)] border px-4 text-white",
                    theme === "graphite" ? "border-white/12 bg-white/[0.06] hover:bg-white/[0.12]" : "hover:bg-white/10",
                  )}
                  style={theme === "ocean" ? artworkStyles.action : undefined}
                  onClick={openSourceTrack}
                >
                  Open in Knobb
                  <ExternalLink className="h-4 w-4" />
                </Button>
                <button
                  type="button"
                  className={cn("flex h-20 w-20 items-center justify-center rounded-[var(--surface-radius-lg)] transition-transform hover:scale-[1.02]", theme === "graphite" ? "bg-white text-black hover:bg-white/90" : "hover:brightness-105")}
                  style={theme === "ocean" ? artworkStyles.play : undefined}
                  onClick={handlePlay}
                  aria-label={isCurrentTrack && isPlaying ? "Pause" : "Play"}
                >
                  {isCurrentTrack && isPlaying ? (
                    <Pause className="h-9 w-9 fill-current" />
                  ) : (
                    <Play className="ml-1 h-9 w-9 fill-current" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
