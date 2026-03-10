import { BarChart3, Clock, Disc3, Music, TrendingUp, User } from "lucide-react";
import { ArtistLink } from "@/components/ArtistLink";
import { ArtistContextMenu } from "@/components/ArtistContextMenu";
import { TrackContextMenu } from "@/components/TrackContextMenu";
import { UtilityPagePanel } from "@/components/UtilityPageLayout";
import type { ListeningStats, StatsRange } from "@/lib/listeningIntelligence";
import type { Track } from "@/types/music";

type ProfileStatsSectionProps = {
  range: StatsRange;
  stats: ListeningStats;
  maxHour: number;
  artistImages: Record<string, string>;
  onRangeChange: (range: StatsRange) => void;
  onArtistSelect: (artist: string) => void;
  onTrackSelect: (track: Track) => void;
};

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

export function ProfileStatsSection({
  range,
  stats,
  maxHour,
  artistImages,
  onRangeChange,
  onArtistSelect,
  onTrackSelect,
}: ProfileStatsSectionProps) {
  const topTracksQueue = stats.topTracks.map(({ track }) => track);

  return (
    <UtilityPagePanel className="profile-stats-panel flex w-full flex-col overflow-hidden p-0 !bg-black">
      <div className="flex flex-col gap-3 border-b border-white/10 bg-black px-4 py-4 sm:flex-row sm:items-center sm:justify-between md:px-6">
        <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
          <BarChart3 className="w-5 h-5" style={{ color: "hsl(var(--dynamic-accent))" }} />
          Listening Stats
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {[
            { value: "7d", label: "7D" },
            { value: "30d", label: "30D" },
            { value: "all", label: "All" },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => onRangeChange(option.value as StatsRange)}
              className={`px-3 py-1 text-xs font-semibold transition-colors ${range === option.value
                ? "text-foreground bg-white/10"
                : "text-muted-foreground hover:text-foreground hover:bg-white/10"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 divide-y divide-white/10 border-b border-white/10 bg-black sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {[
          { icon: Music, label: "Counted Plays", value: stats.totalCountedPlays.toString() },
          { icon: Clock, label: "Minutes Listened", value: stats.totalMinutes.toString() },
          { icon: TrendingUp, label: "Peak Hour", value: formatPeakHour(stats.peakHour) },
        ].map(({ icon: Icon, label, value }) => (
          <div
            key={label}
            className="group relative isolate flex cursor-pointer flex-col items-center justify-center overflow-hidden p-6 sm:p-8 transition-colors"
          >
            <span
              className="absolute inset-0 origin-left scale-x-0 bg-[hsl(var(--player-waveform)/0.95)] transition-transform duration-300 ease-out group-hover:scale-x-100"
              aria-hidden="true"
            />
            <span
              className="absolute inset-0 bg-white/0 transition-colors duration-300 group-hover:bg-white/[0.04]"
              aria-hidden="true"
            />
            <Icon className="relative z-10 mb-3 h-6 w-6 text-muted-foreground transition-colors duration-300 group-hover:text-[hsl(var(--dynamic-accent-foreground))] sm:h-8 sm:w-8" />
            <p className="relative z-10 mb-1 text-2xl font-bold leading-none text-foreground transition-colors duration-300 group-hover:text-[hsl(var(--dynamic-accent-foreground))] sm:text-3xl">{value}</p>
            <p className="relative z-10 text-[10px] font-medium uppercase tracking-wider text-muted-foreground transition-colors duration-300 group-hover:text-[hsl(var(--dynamic-accent-foreground)/0.82)] sm:text-xs">{label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col border-b border-white/10 bg-black group">
        <div className="flex min-h-14 items-center border-b border-white/10 px-4 py-4 md:px-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
            <Clock className="w-4 h-4" style={{ color: "hsl(var(--dynamic-accent))" }} />
            Activity by Hour
          </h2>
        </div>
        <div className="px-4 md:px-6 py-6 pb-4">
          <div className="flex h-24 items-end gap-[2px] sm:h-40">
            {stats.hourCounts.map((count, index) => (
              <div key={index} className="flex-1 flex flex-col items-center group/bar cursor-default h-full justify-end">
                <div
                  className="w-full transition-all duration-300 group-hover/bar:bg-[hsl(var(--dynamic-accent))] group-hover/bar:scale-y-[1.05] origin-bottom"
                  style={{
                    height: `${(count / maxHour) * 100}%`,
                    minHeight: count > 0 ? 2 : 0,
                    backgroundColor: `hsl(var(--dynamic-accent) / ${0.3 + (count / maxHour) * 0.7})`,
                  }}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground/50 pt-3 mt-1 font-mono uppercase tracking-wider">
            <span>12am</span>
            <span>6am</span>
            <span>12pm</span>
            <span>6pm</span>
            <span>11pm</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 divide-y divide-white/10 bg-black md:grid-cols-2 md:divide-x md:divide-y-0">
        <div className="flex flex-col">
          <div className="flex min-h-14 items-center border-b border-white/10 px-4 py-4 md:px-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
              <Disc3 className="w-4 h-4" style={{ color: "hsl(var(--dynamic-accent))" }} />
              Top Artists
            </h2>
          </div>
          {stats.topArtists.length === 0 ? (
            <div className="p-6">
              <p className="text-sm text-muted-foreground">No data yet.</p>
            </div>
          ) : (
            <div className="flex flex-col">
              {stats.topArtists.map(({ artist, listenedSeconds }, index) => (
                <ArtistContextMenu key={artist} artistName={artist} artistImageUrl={artistImages[artist]}>
                  <button
                    type="button"
                    className="group relative overflow-hidden flex w-full items-center gap-4 px-4 py-3 text-left transition-colors border-b border-white/10 last:border-b-0 md:px-6"
                    onClick={() => onArtistSelect(artist)}
                  >
                    <span
                      className="absolute inset-0 origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300 ease-out pointer-events-none"
                      style={{ backgroundColor: "hsl(var(--player-waveform) / 0.95)" }}
                    />
                    <span className="relative z-10 w-4 text-xs font-mono tabular-nums text-muted-foreground transition-colors group-hover:text-[hsl(var(--dynamic-accent-foreground))]">{index + 1}.</span>
                    {artistImages[artist] ? (
                      <img src={artistImages[artist]} alt={artist} loading="lazy" decoding="async" className="relative z-10 h-10 w-10 shrink-0 object-cover" />
                    ) : (
                      <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center bg-white/5">
                        <User className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-[hsl(var(--dynamic-accent-foreground)/0.7)]" />
                      </div>
                    )}
                    <div className="relative z-10 min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground transition-colors group-hover:text-[hsl(var(--dynamic-accent-foreground))]">{artist}</p>
                    </div>
                    <span className="relative z-10 text-[11px] font-mono text-muted-foreground transition-colors group-hover:text-[hsl(var(--dynamic-accent-foreground))] sm:text-xs">{formatListenedMinutes(listenedSeconds)}</span>
                  </button>
                </ArtistContextMenu>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col">
          <div className="flex min-h-14 items-center border-b border-white/10 px-4 py-4 md:px-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
              <Music className="w-4 h-4" style={{ color: "hsl(var(--dynamic-accent))" }} />
              Top Tracks
            </h2>
          </div>
          {stats.topTracks.length === 0 ? (
            <div className="p-6">
              <p className="text-sm text-muted-foreground">No data yet.</p>
            </div>
          ) : (
            <div className="flex flex-col">
              {stats.topTracks.map(({ track, listenedSeconds }, index) => (
                <TrackContextMenu key={track.id} track={track} tracks={topTracksQueue}>
                  <button
                    type="button"
                    className="content-visibility-list group relative overflow-hidden flex w-full items-center gap-4 px-4 py-3 text-left transition-colors border-b border-white/10 last:border-b-0 md:px-6"
                    onClick={() => onTrackSelect(track)}
                  >
                    <span
                      className="absolute inset-0 origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300 ease-out pointer-events-none"
                      style={{ backgroundColor: "hsl(var(--player-waveform) / 0.95)" }}
                    />
                    <span className="relative z-10 w-4 text-xs font-mono tabular-nums text-muted-foreground transition-colors group-hover:text-[hsl(var(--dynamic-accent-foreground))]">{index + 1}.</span>
                    <img src={track.coverUrl} alt="" loading="lazy" decoding="async" className="relative z-10 h-10 w-10 shrink-0 object-cover" />
                    <div className="relative z-10 min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground transition-colors group-hover:text-[hsl(var(--dynamic-accent-foreground))]">{track.title}</p>
                      <ArtistLink
                        name={track.artist}
                        artistId={track.artistId}
                        className="block truncate text-xs text-muted-foreground transition-colors group-hover:text-[hsl(var(--dynamic-accent-foreground)/0.85)]"
                        onClick={(event) => event.stopPropagation()}
                      />
                    </div>
                    <span className="relative z-10 text-[11px] font-mono text-muted-foreground transition-colors group-hover:text-[hsl(var(--dynamic-accent-foreground))] sm:text-xs">{formatListenedMinutes(listenedSeconds)}</span>
                  </button>
                </TrackContextMenu>
              ))}
            </div>
          )}
        </div>
      </div>
    </UtilityPagePanel>
  );
}
