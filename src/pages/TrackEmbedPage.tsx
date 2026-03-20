import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { AlertCircle, ExternalLink, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlayer } from "@/contexts/PlayerContext";
import { usePageMetadata } from "@/hooks/usePageMetadata";
import { buildTrackSourceUrl, getTrackShareIdentifier } from "@/lib/mediaNavigation";
import { getTrackInfo, tidalTrackToAppTrack } from "@/lib/musicApi";
import { APP_HOME_PATH } from "@/lib/routes";
import { formatDuration } from "@/lib/utils";
import type { TrackEmbedSize } from "@/lib/trackSharing";
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
  const { currentTrack, play } = usePlayer();
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
        const loadedTrack = await getTrackInfo(resolvedTrackId);
        if (!active) return;

        if (!loadedTrack) {
          setTrack(null);
          setError("Track unavailable");
          setLoading(false);
          return;
        }

        setTrack(tidalTrackToAppTrack(loadedTrack));
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
    return params.get("theme") === "ocean" ? "ocean" : "graphite";
  }, [location.search]);
  const size = useMemo<TrackEmbedSize>(() => {
    const params = new URLSearchParams(location.search);
    return params.get("size") === "compact" ? "compact" : "normal";
  }, [location.search]);
  const artworkStyles = useMemo(() => {
    const base = track?.canvasColor || "220 70% 55%";
    const glow = shiftEmbedColor(base, { saturationShift: 8, lightnessShift: 6 });
    const edge = shiftEmbedColor(base, { hueShift: 18, saturationShift: -6, lightnessShift: -22 });
    const deep = shiftEmbedColor(base, { hueShift: -12, saturationShift: -10, lightnessShift: -30 });

    return {
      shell: {
        background: `radial-gradient(circle at 12% 18%, hsl(${glow} / 0.24), transparent 30%),
radial-gradient(circle at 88% 14%, hsl(${edge} / 0.18), transparent 28%),
linear-gradient(145deg, hsl(${deep}) 0%, rgb(5 5 5) 58%, rgb(0 0 0) 100%)`,
      },
      panel: {
        background: `linear-gradient(160deg, hsl(${glow} / 0.12) 0%, rgba(0,0,0,0.92) 26%, rgba(0,0,0,0.98) 100%)`,
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
    title: `${track.title} | Listen on Knobb`,
    description: `Listen to ${track.title} by ${track.artist} on Knobb. ${track.album ? `From the album ${track.album}.` : ""} High-quality audio discovery and archives.`,
    image: track.coverUrl || undefined,
    imageAlt: `${track.title} cover art`,
    twitterCard: "summary",
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
    play(track, [track]);
  };

  const openSourceTrack = () => {
    if (sourceUrl) {
      window.open(sourceUrl, "_blank", "noopener,noreferrer");
      return;
    }

    navigate(APP_HOME_PATH);
  };

  if (!track && !loading) {
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

  if (!track) {
    return (
      <div className="h-screen overflow-hidden bg-[#050505] p-4 text-white">
        <section className="flex h-full w-full items-center justify-center rounded-[36px] border border-white/10 bg-white/[0.04] p-4">
          <div className="w-full max-w-[1180px] rounded-[34px] border border-white/10 bg-black/90 p-5">
            <div className={cn("overflow-hidden rounded-[30px] border border-white/10 bg-black", size === "compact" ? "px-4 py-4" : "px-6 py-6 md:px-8 md:py-8")}>
              <div className={cn("flex items-center gap-4", size === "compact" ? "" : "md:gap-7")}>
                <div className={cn("shrink-0 overflow-hidden rounded-[24px] border border-white/10 bg-neutral-900", size === "compact" ? "h-24 w-24" : "h-32 w-32 md:h-36 md:w-36")} />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/45">Knobb embed</p>
                  <h1 className={cn("mt-3 truncate font-black tracking-tight text-white", size === "compact" ? "text-[1.65rem]" : "text-[clamp(2rem,3vw,3.25rem)]")}>Track Preview</h1>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div
      className={cn("h-screen overflow-hidden text-white", theme === "graphite" ? "bg-black" : undefined)}
      style={theme === "ocean" ? artworkStyles.shell : undefined}
    >
      <section
        className={cn("flex h-full w-full items-center justify-center p-4", theme === "graphite" ? "bg-black" : undefined)}
        style={theme === "ocean" ? artworkStyles.panel : undefined}
      >
        <div className="w-full max-w-[1180px] rounded-[38px] border border-white/10 bg-black/95 p-5 shadow-[0_36px_120px_rgba(0,0,0,0.5)]">
          <div className={cn("rounded-[32px] border border-white/10 bg-black shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]", size === "compact" ? "px-4 py-4" : "px-6 py-6 md:px-8 md:py-8")}>
            <div className={cn("flex min-w-0 items-center", size === "compact" ? "gap-4" : "gap-6 md:gap-8")}>
              <div className={cn("shrink-0 overflow-hidden rounded-[24px] border border-white/10 bg-neutral-950 shadow-[0_18px_40px_rgba(0,0,0,0.42)]", size === "compact" ? "h-24 w-24" : "h-32 w-32 md:h-36 md:w-36")}>
                <img
                  src={track.coverUrl || "/placeholder.svg"}
                  alt={track.title}
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="flex min-w-0 flex-1 flex-col">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/45">Knobb embed</p>
                  <h1 className={cn("mt-3 truncate font-black tracking-tight text-white", size === "compact" ? "text-[1.65rem]" : "text-[clamp(2rem,3vw,3.25rem)]")}>
                    {track.title}
                  </h1>
                  <div className={cn("mt-3 flex min-w-0 items-center gap-3 text-white/78", size === "compact" ? "text-sm" : "text-[18px]")}>
                    <span
                      className={cn(
                        "rounded-full px-3 py-1 font-semibold text-white",
                        size === "compact" ? "text-[11px]" : "text-sm",
                        theme === "graphite" ? "border border-white/12 bg-white/[0.08]" : undefined,
                      )}
                      style={theme === "ocean" ? artworkStyles.pill : undefined}
                    >
                      Preview
                    </span>
                    <span className="truncate">{track.artist}</span>
                  </div>
                  {track.album ? (
                    <p className={cn("mt-2 truncate text-white/62", size === "compact" ? "text-xs" : "text-[16px]")}>
                      {track.album}
                    </p>
                  ) : null}
                </div>

                <div className={cn("mt-5 flex min-w-0 items-center justify-between gap-3", size === "compact" ? "flex-wrap" : "pt-1")}>
                  <div className="flex items-center gap-3 text-white/60">
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-white/85" />
                      <span className="h-1.5 w-1.5 rounded-full bg-white/85" />
                      <span className="h-1.5 w-1.5 rounded-full bg-white/85" />
                    </div>
                    {track.duration ? (
                      <span className={cn("uppercase tracking-[0.18em]", size === "compact" ? "text-[10px]" : "text-sm")}>
                        {formatDuration(track.duration)}
                      </span>
                    ) : null}
                  </div>

                  <div className={cn("flex items-center", size === "compact" ? "gap-2" : "gap-4")}>
                    <Button
                      variant="ghost"
                      className={cn(
                        "rounded-full border text-white",
                        size === "compact" ? "h-10 px-4 text-xs" : "h-14 px-6 text-base",
                        theme === "graphite" ? "border-white/12 bg-white/[0.06] hover:bg-white/[0.12]" : "hover:bg-white/10",
                      )}
                      style={theme === "ocean" ? artworkStyles.action : undefined}
                      onClick={openSourceTrack}
                    >
                      {size === "compact" ? "Open" : "Open in Knobb"}
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    <button
                      type="button"
                      className={cn(
                        "flex items-center justify-center rounded-full transition-transform hover:scale-[1.02]",
                        size === "compact" ? "h-12 w-12" : "h-16 w-16",
                        theme === "graphite" ? "bg-white text-black hover:bg-white/90" : "hover:brightness-105",
                      )}
                      style={theme === "ocean" ? artworkStyles.play : undefined}
                      onClick={handlePlay}
                      aria-label={isCurrentTrack ? "Play from start" : "Play"}
                    >
                      <Play className={cn("ml-1 fill-current", size === "compact" ? "h-5 w-5" : "h-7 w-7")} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
