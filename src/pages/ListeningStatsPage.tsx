import { useAuth } from "@/contexts/AuthContext";
import { usePlayHistory } from "@/hooks/usePlayHistory";
import { Track } from "@/data/mockData";
import { BarChart3, Clock, Music, Disc3, Loader2, TrendingUp } from "lucide-react";
import { useState, useEffect, useMemo } from "react";

export default function ListeningStatsPage() {
  const { user } = useAuth();
  const { getHistory } = usePlayHistory();
  const [history, setHistory] = useState<(Track & { playedAt: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    getHistory(500).then((h) => {
      setHistory(h);
      setLoading(false);
    });
  }, [user, getHistory]);

  const stats = useMemo(() => {
    const totalMinutes = Math.round(history.reduce((s, t) => s + t.duration, 0) / 60);
    const artistCounts: Record<string, number> = {};
    const trackCounts: Record<string, { track: Track; count: number }> = {};
    const hourCounts = new Array(24).fill(0);

    history.forEach((t) => {
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

    return { totalMinutes, totalTracks: history.length, topArtists, topTracks, peakHour, hourCounts };
  }, [history]);

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <BarChart3 className="w-12 h-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Sign in to see your listening stats.</p>
      </div>
    );
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  const maxHour = Math.max(...stats.hourCounts, 1);

  return (
    <div className="max-w-2xl mx-auto py-8 space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <BarChart3 className="w-6 h-6" style={{ color: `hsl(var(--dynamic-accent))` }} />
        Listening Stats
      </h1>

      {/* Overview cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: Music, label: "Tracks Played", value: stats.totalTracks.toString() },
          { icon: Clock, label: "Minutes Listened", value: stats.totalMinutes.toString() },
          { icon: TrendingUp, label: "Peak Hour", value: `${stats.peakHour}:00` },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="glass-heavy rounded-xl p-4 text-center space-y-1">
            <Icon className="w-5 h-5 mx-auto text-muted-foreground" />
            <p className="text-xl font-bold text-foreground">{value}</p>
            <p className="text-[11px] text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* Listening activity by hour */}
      <div className="glass-heavy rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
          <Clock className="w-4 h-4" style={{ color: `hsl(var(--dynamic-accent))` }} />
          Activity by Hour
        </h2>
        <div className="flex items-end gap-[2px] h-20">
          {stats.hourCounts.map((count, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
              <div
                className="w-full rounded-sm transition-all"
                style={{
                  height: `${(count / maxHour) * 100}%`,
                  minHeight: count > 0 ? 2 : 0,
                  backgroundColor: `hsl(var(--dynamic-accent) / ${0.3 + (count / maxHour) * 0.7})`,
                }}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between text-[9px] text-muted-foreground">
          <span>12am</span><span>6am</span><span>12pm</span><span>6pm</span><span>11pm</span>
        </div>
      </div>

      {/* Top Artists */}
      <div className="glass-heavy rounded-xl p-5 space-y-3">
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
      <div className="glass-heavy rounded-xl p-5 space-y-3">
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
                <img src={track.coverUrl} alt="" className="w-9 h-9 rounded object-cover shrink-0" />
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
