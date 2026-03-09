import { useAuth } from "@/contexts/AuthContext";
import { usePlayer } from "@/contexts/PlayerContext";
import { useSettings } from "@/contexts/SettingsContext";
import { PlayHistoryEntry, usePlayHistory } from "@/hooks/usePlayHistory";
import { BarChart3, Clock, Music, Disc3, Loader2, TrendingUp } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { StatsRange, computeListeningStats, filterHistoryByRange } from "@/lib/listeningIntelligence";
import { ArtistLink } from "@/components/ArtistLink";
import { ArtistContextMenu } from "@/components/ArtistContextMenu";
import { TrackContextMenu } from "@/components/TrackContextMenu";

function formatListenedMinutes(listenedSeconds: number) {
  return `${Math.max(1, Math.round(listenedSeconds / 60))} min`;
}

function formatPeakHour(hour: number) {
  const normalizedHour = ((hour % 24) + 24) % 24;
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(2026, 0, 1, normalizedHour, 0, 0));
}

export default function ListeningStatsPage() {
  const { user } = useAuth();
  const { scrobblePercent } = useSettings();
  const { getHistory } = usePlayHistory();
  const { play } = usePlayer();
  const navigate = useNavigate();
  const [history, setHistory] = useState<PlayHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<StatsRange>("30d");

  const parsedScrobblePercent = Number.parseInt(scrobblePercent, 10);
  const normalizedScrobblePercent = Number.isFinite(parsedScrobblePercent)
    ? Math.min(95, Math.max(5, parsedScrobblePercent))
    : 50;

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    getHistory(1000).then(setHistory).finally(() => setLoading(false));
  }, [user, getHistory]);

  const filteredHistory = useMemo(
    () => filterHistoryByRange(history, range),
    [history, range]
  );

  const stats = useMemo(
    () => computeListeningStats(filteredHistory, normalizedScrobblePercent),
    [filteredHistory, normalizedScrobblePercent]
  );
  const topTracksQueue = useMemo(() => stats.topTracks.map(({ track }) => track), [stats.topTracks]);

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <BarChart3 className="w-12 h-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground mb-4">Sign in to see your listening stats.</p>
        <Button onClick={() => navigate("/auth")}>Sign In</Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const maxHour = Math.max(...stats.hourCounts, 1);

  return (
    <div className="max-w-2xl mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="w-6 h-6" style={{ color: `hsl(var(--dynamic-accent))` }} />
          Listening Stats
        </h1>
        <div className="flex items-center gap-2">
          {[
            { value: "7d", label: "7D" },
            { value: "30d", label: "30D" },
            { value: "all", label: "All" },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => setRange(option.value as StatsRange)}
              className={`px-2.5 py-1 text-xs font-semibold transition-colors ${range === option.value
                  ? "text-foreground bg-accent/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/30"
                }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: Music, label: "Counted Plays", value: stats.totalCountedPlays.toString() },
          { icon: Clock, label: "Minutes Listened", value: stats.totalMinutes.toString() },
          { icon: TrendingUp, label: "Peak Hour", value: formatPeakHour(stats.peakHour) },
        ].map(({ icon: Icon, label, value }) => (
          <div
            key={label}
            className="glass-heavy group relative isolate cursor-pointer overflow-hidden p-4 text-center"
          >
            <span
              className="absolute inset-0 origin-left scale-x-0 bg-[hsl(var(--player-waveform)/0.95)] transition-transform duration-300 ease-out group-hover:scale-x-100"
              aria-hidden="true"
            />
            <span
              className="absolute inset-0 bg-white/0 transition-colors duration-300 group-hover:bg-white/[0.04]"
              aria-hidden="true"
            />
            <div className="relative z-10 space-y-1">
              <Icon className="mx-auto h-5 w-5 text-muted-foreground transition-colors duration-300 group-hover:text-[hsl(var(--dynamic-accent-foreground))]" />
              <p className="text-xl font-bold text-foreground transition-colors duration-300 group-hover:text-[hsl(var(--dynamic-accent-foreground))]">{value}</p>
              <p className="text-xs text-muted-foreground transition-colors duration-300 group-hover:text-[hsl(var(--dynamic-accent-foreground)/0.82)]">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Listening activity by hour */}
      <div className="glass-heavy  p-5 space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
          <Clock className="w-4 h-4" style={{ color: `hsl(var(--dynamic-accent))` }} />
          Activity by Hour
        </h2>
        <div className="flex items-end gap-[2px] h-20">
          {stats.hourCounts.map((count, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
              <div
                className="w-full  transition-all"
                style={{
                  height: `${(count / maxHour) * 100}%`,
                  minHeight: count > 0 ? 2 : 0,
                  backgroundColor: `hsl(var(--dynamic-accent) / ${0.3 + (count / maxHour) * 0.7})`,
                }}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>12am</span><span>6am</span><span>12pm</span><span>6pm</span><span>11pm</span>
        </div>
      </div>

      {/* Top Artists */}
      <div className="glass-heavy  p-5 space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
          <Disc3 className="w-4 h-4" style={{ color: `hsl(var(--dynamic-accent))` }} />
          Top Artists
        </h2>
        {stats.topArtists.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data yet.</p>
        ) : (
          <div className="space-y-2">
            {stats.topArtists.map(({ artist, listenedSeconds }, i) => (
              <ArtistContextMenu key={artist} artistName={artist}>
                <button type="button" onClick={() => navigate(`/search?q=${encodeURIComponent(artist)}`)} className="flex w-full items-center gap-3 p-1 text-left transition-colors hover:bg-white/[0.06]">
                  <span className="w-5 text-right text-xs font-mono text-muted-foreground">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <ArtistLink
                      name={artist}
                      className="block truncate text-sm font-semibold text-foreground"
                      onClick={(event) => event.stopPropagation()}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">{formatListenedMinutes(listenedSeconds)}</span>
                </button>
              </ArtistContextMenu>
            ))}
          </div>
        )}
      </div>

      {/* Top Tracks */}
      <div className="glass-heavy  p-5 space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
          <Music className="w-4 h-4" style={{ color: `hsl(var(--dynamic-accent))` }} />
          Top Tracks
        </h2>
        {stats.topTracks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data yet.</p>
        ) : (
          <div className="space-y-2">
            {stats.topTracks.map(({ track, listenedSeconds }, i) => (
              <TrackContextMenu key={track.id} track={track} tracks={topTracksQueue}>
                <button
                  type="button"
                  onClick={() => play(track, topTracksQueue)}
                  className="content-visibility-list w-full flex items-center gap-3 text-left p-1 transition-colors hover:bg-white/[0.06]"
                >
                  <span className="text-xs font-mono text-muted-foreground w-5 text-right">{i + 1}</span>
                  <img src={track.coverUrl} alt="" loading="lazy" decoding="async" className="w-9 h-9 object-cover shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate text-foreground">{track.title}</p>
                    <ArtistLink
                      name={track.artist}
                      artistId={track.artistId}
                      className="text-xs text-muted-foreground truncate block"
                      onClick={(event) => event.stopPropagation()}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">{formatListenedMinutes(listenedSeconds)}</span>
                </button>
              </TrackContextMenu>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
