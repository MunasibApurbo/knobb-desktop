import { useAuth } from "@/contexts/AuthContext";
import { PlayHistoryEntry, usePlayHistory } from "@/hooks/usePlayHistory";
import { Track } from "@/types/music";
import { BarChart3, Clock, Music, Disc3, Loader2, TrendingUp } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

type StatsRange = "7d" | "30d" | "all";

export default function ListeningStatsPage() {
  const { user } = useAuth();
  const { getHistory } = usePlayHistory();
  const navigate = useNavigate();
  const [history, setHistory] = useState<PlayHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<StatsRange>("30d");

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    getHistory(1000).then(setHistory).finally(() => setLoading(false));
  }, [user, getHistory]);

  const filteredHistory = useMemo(() => {
    if (range === "all") return history;

    const cutoffDays = range === "7d" ? 7 : 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - cutoffDays);
    return history.filter((entry) => new Date(entry.playedAt) >= cutoff);
  }, [history, range]);

  const stats = useMemo(() => {
    const totalListenedSeconds = filteredHistory.reduce((s, t) => s + t.listenedSeconds, 0);
    const totalMinutes = Math.round(totalListenedSeconds / 60);
    const artistCounts: Record<string, number> = {};
    const trackCounts: Record<string, { track: Track; count: number }> = {};
    const hourCounts = new Array(24).fill(0);

    filteredHistory.forEach((t) => {
      artistCounts[t.artist] = (artistCounts[t.artist] || 0) + 1;
      if (!trackCounts[t.id]) trackCounts[t.id] = { track: t, count: 0 };
      trackCounts[t.id].count++;
      const hour = new Date(t.playedAt).getHours();
      hourCounts[hour]++;
    });

    const topArtists = Object.entries(artistCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    const topTracks = Object.values(trackCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const peakHour = hourCounts.indexOf(Math.max(...hourCounts));

    return { totalMinutes, totalTracks: filteredHistory.length, topArtists, topTracks, peakHour, hourCounts };
  }, [filteredHistory]);

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
              className={`px-2.5 py-1 text-xs font-semibold transition-colors ${
                range === option.value
                  ? "text-foreground bg-accent/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/20"
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
          { icon: Music, label: "Tracks Played", value: stats.totalTracks.toString() },
          { icon: Clock, label: "Minutes Listened", value: stats.totalMinutes.toString() },
          { icon: TrendingUp, label: "Peak Hour", value: `${String(stats.peakHour).padStart(2, "0")}:00` },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="glass-heavy  p-4 text-center space-y-1">
            <Icon className="w-5 h-5 mx-auto text-muted-foreground" />
            <p className="text-xl font-bold text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
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
            {stats.topArtists.map(([artist, count], i) => (
              <div key={artist} className="flex items-center gap-3">
                <span className="text-xs font-mono text-muted-foreground w-5 text-right">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate text-foreground">{artist}</p>
                </div>
                <span className="text-xs text-muted-foreground">{count} plays</span>
              </div>
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
            {stats.topTracks.map(({ track, count }, i) => (
              <div key={track.id} className="flex items-center gap-3">
                <span className="text-xs font-mono text-muted-foreground w-5 text-right">{i + 1}</span>
                <img src={track.coverUrl} alt="" className="w-9 h-9 object-cover shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate text-foreground">{track.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
                </div>
                <span className="text-xs text-muted-foreground">{count} plays</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
