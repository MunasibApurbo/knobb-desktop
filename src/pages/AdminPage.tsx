import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Search, Shield, UserRound } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AdminAuditPayload, AdminSearchUser, AdminSummary } from "@/lib/adminApi";
import { getUserAudit, searchUsers } from "@/lib/adminApi";

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Unknown";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Unknown" : parsed.toLocaleString();
}

function getTrackLabel(trackData: Record<string, unknown> | null | undefined) {
  if (!trackData) return "Unknown track";
  const title = typeof trackData.title === "string" ? trackData.title : "Unknown track";
  const artist = typeof trackData.artist === "string" ? trackData.artist : null;
  return artist ? `${title} • ${artist}` : title;
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-white/10 bg-black/30 px-4 py-4">
      <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-black text-foreground">{value}</p>
    </div>
  );
}

export default function AdminPage() {
  const [queryInput, setQueryInput] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [page, setPage] = useState(1);
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [results, setResults] = useState<AdminSearchUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [audit, setAudit] = useState<AdminAuditPayload | null>(null);
  const [searchLoading, setSearchLoading] = useState(true);
  const [auditLoading, setAuditLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const selectedUser = useMemo(
    () => results.find((entry) => entry.user_id === selectedUserId) ?? audit?.user ?? null,
    [audit?.user, results, selectedUserId],
  );

  const loadAudit = useCallback(async (userId: string) => {
    setAuditLoading(true);
    setSelectedUserId(userId);

    try {
      const payload = await getUserAudit(userId);
      setAudit(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load user audit";
      toast.error(message);
    } finally {
      setAuditLoading(false);
    }
  }, []);

  const loadUsers = useCallback(async (query: string, nextPage: number) => {
    setSearchLoading(true);

    try {
      const payload = await searchUsers(query, nextPage);
      setSummary(payload.summary);
      setResults(payload.users);
      setPage(payload.page);
      setHasMore(payload.has_more);

      const nextSelectedUserId =
        payload.users.find((entry) => entry.user_id === selectedUserId)?.user_id ??
        payload.users[0]?.user_id ??
        null;

      if (nextSelectedUserId) {
        void loadAudit(nextSelectedUserId);
      } else {
        setSelectedUserId(null);
        setAudit(null);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load admin users";
      toast.error(message);
    } finally {
      setSearchLoading(false);
    }
  }, [loadAudit, selectedUserId]);

  useEffect(() => {
    void loadUsers("", 1);
  }, [loadUsers]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 pb-28 md:px-6">
      <header className="space-y-3">
        <div className="inline-flex items-center gap-2 border border-white/10 bg-black/35 px-3 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
          <Shield className="h-4 w-4" />
          Admin Audit
        </div>
        <div>
          <h1 className="text-4xl font-black tracking-tight text-foreground">User privacy audit</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Review account data through the server-side admin endpoint. This page is read-only and scoped.
          </p>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-4">
        <SummaryCard label="Total Users" value={summary?.totalUsers ?? "…"} />
        <SummaryCard label="Shared Profiles" value={summary?.sharedProfiles ?? "…"} />
        <SummaryCard label="Shared Live Status" value={summary?.sharedLiveStatuses ?? "…"} />
        <SummaryCard label="Public Playlists" value={summary?.publicPlaylists ?? "…"} />
      </section>

      <section className="border border-white/10 bg-black/35 p-4">
        <form
          className="flex flex-col gap-3 md:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            const nextQuery = queryInput.trim();
            setActiveQuery(nextQuery);
            void loadUsers(nextQuery, 1);
          }}
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={queryInput}
              onChange={(event) => setQueryInput(event.target.value)}
              placeholder="Search by email, user ID, or display name"
              className="border-white/10 bg-black/30 pl-10 text-foreground"
            />
          </div>
          <Button type="submit" className="md:min-w-[120px]">
            Search
          </Button>
        </form>
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>{activeQuery ? `Showing matches for "${activeQuery}"` : "Showing newest users"}</span>
          <span>Page {page}</span>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="border border-white/10 bg-black/35">
          <div className="border-b border-white/10 px-4 py-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-muted-foreground">Matches</h2>
          </div>
          {searchLoading ? (
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading users...
            </div>
          ) : results.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">No users matched this query.</div>
          ) : (
            <div className="divide-y divide-white/10">
              {results.map((entry) => {
                const selected = entry.user_id === selectedUserId;
                return (
                  <button
                    key={entry.user_id}
                    type="button"
                    onClick={() => void loadAudit(entry.user_id)}
                    className={`w-full px-4 py-3 text-left transition-colors ${
                      selected ? "bg-white/[0.08]" : "hover:bg-white/[0.04]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {entry.avatar_url ? (
                        <img src={entry.avatar_url} alt="" className="h-11 w-11 object-cover" />
                      ) : (
                        <div className="flex h-11 w-11 items-center justify-center border border-white/10 bg-black/40 text-muted-foreground">
                          <UserRound className="h-4 w-4" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {entry.display_name || entry.email || entry.user_id}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{entry.email || entry.user_id}</p>
                        <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                          Profile {entry.profile_visibility} • Live {entry.live_status_visibility}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          <div className="flex items-center justify-between border-t border-white/10 px-4 py-3">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || searchLoading}
              onClick={() => void loadUsers(activeQuery, page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasMore || searchLoading}
              onClick={() => void loadUsers(activeQuery, page + 1)}
            >
              Next
            </Button>
          </div>
        </div>

        <div className="border border-white/10 bg-black/35">
          <div className="border-b border-white/10 px-4 py-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-muted-foreground">Audit detail</h2>
          </div>
          {auditLoading ? (
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading audit...
            </div>
          ) : !audit || !selectedUser ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">Select a user to inspect their account data.</div>
          ) : (
            <div className="space-y-6 px-4 py-4">
              <section className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Account</h3>
                  <p className="text-lg font-bold text-foreground">{selectedUser.display_name || "Unnamed user"}</p>
                  <p className="text-sm text-muted-foreground">{selectedUser.email || selectedUser.user_id}</p>
                  <p className="text-sm text-muted-foreground">Created {formatDateTime(selectedUser.created_at)}</p>
                  <p className="text-sm text-muted-foreground">Last sign-in {formatDateTime(selectedUser.last_sign_in_at)}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <SummaryCard label="Playlists" value={audit.counts.playlists} />
                  <SummaryCard label="Play History" value={audit.counts.playHistory} />
                  <SummaryCard label="Liked Songs" value={audit.counts.likedSongs} />
                  <SummaryCard label="Notifications" value={audit.counts.notifications} />
                </div>
              </section>

              <section className="grid gap-3 md:grid-cols-3">
                <div className="border border-white/10 bg-black/20 px-4 py-3 text-sm text-muted-foreground">
                  <p className="text-xs uppercase tracking-[0.18em]">Profile visibility</p>
                  <p className="mt-2 text-base font-semibold text-foreground">{selectedUser.profile_visibility}</p>
                </div>
                <div className="border border-white/10 bg-black/20 px-4 py-3 text-sm text-muted-foreground">
                  <p className="text-xs uppercase tracking-[0.18em]">Live status visibility</p>
                  <p className="mt-2 text-base font-semibold text-foreground">{selectedUser.live_status_visibility}</p>
                </div>
                <div className="border border-white/10 bg-black/20 px-4 py-3 text-sm text-muted-foreground">
                  <p className="text-xs uppercase tracking-[0.18em]">Current status</p>
                  <p className="mt-2 text-base font-semibold text-foreground">
                    {audit.currentStatus ? `${audit.currentStatus.track_title || "Unknown"} • ${audit.currentStatus.artist_name || "Unknown"}` : "No active status"}
                  </p>
                </div>
              </section>

              <section className="grid gap-6 xl:grid-cols-2">
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Recent play history</h3>
                  <div className="divide-y divide-white/10 border border-white/10">
                    {audit.recent.playHistory.length === 0 ? (
                      <p className="px-4 py-6 text-sm text-muted-foreground">No play history recorded.</p>
                    ) : (
                      audit.recent.playHistory.map((entry) => (
                        <div key={entry.id} className="px-4 py-3 text-sm">
                          <p className="font-medium text-foreground">{getTrackLabel(entry.track_data)}</p>
                          <p className="text-xs text-muted-foreground">
                            {entry.event_type} • {entry.listened_seconds}s of {entry.duration_seconds}s • {formatDateTime(entry.played_at)}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Recent playlists</h3>
                  <div className="divide-y divide-white/10 border border-white/10">
                    {audit.recent.playlists.length === 0 ? (
                      <p className="px-4 py-6 text-sm text-muted-foreground">No playlists saved.</p>
                    ) : (
                      audit.recent.playlists.map((playlist) => (
                        <div key={playlist.id} className="px-4 py-3 text-sm">
                          <p className="font-medium text-foreground">{playlist.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {playlist.visibility} • Updated {formatDateTime(playlist.updated_at)}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </section>

              <section className="grid gap-6 xl:grid-cols-2">
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Library activity</h3>
                  <div className="border border-white/10">
                    <div className="border-b border-white/10 px-4 py-3 text-sm text-muted-foreground">
                      Saved albums {audit.counts.savedAlbums} • Favorite artists {audit.counts.favoriteArtists}
                    </div>
                    <div className="space-y-0 divide-y divide-white/10">
                      {audit.recent.savedAlbums.map((album) => (
                        <div key={album.id} className="px-4 py-3 text-sm">
                          <p className="font-medium text-foreground">{album.album_title}</p>
                          <p className="text-xs text-muted-foreground">
                            {album.album_artist} • Saved {formatDateTime(album.created_at)}
                          </p>
                        </div>
                      ))}
                      {audit.recent.favoriteArtists.map((artist) => (
                        <div key={artist.id} className="px-4 py-3 text-sm">
                          <p className="font-medium text-foreground">{artist.artist_name}</p>
                          <p className="text-xs text-muted-foreground">Favorited {formatDateTime(artist.created_at)}</p>
                        </div>
                      ))}
                      {audit.recent.savedAlbums.length === 0 && audit.recent.favoriteArtists.length === 0 ? (
                        <p className="px-4 py-6 text-sm text-muted-foreground">No saved albums or favorite artists.</p>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Recent notifications and likes</h3>
                  <div className="border border-white/10">
                    <div className="border-b border-white/10 px-4 py-3 text-sm text-muted-foreground">
                      Liked songs {audit.counts.likedSongs} • Notifications {audit.counts.notifications}
                    </div>
                    <div className="space-y-0 divide-y divide-white/10">
                      {audit.recent.likedSongs.map((song) => (
                        <div key={song.id} className="px-4 py-3 text-sm">
                          <p className="font-medium text-foreground">{getTrackLabel(song.track_data)}</p>
                          <p className="text-xs text-muted-foreground">Liked {formatDateTime(song.liked_at)}</p>
                        </div>
                      ))}
                      {audit.recent.notifications.map((item) => (
                        <div key={item.id} className="px-4 py-3 text-sm">
                          <p className="font-medium text-foreground">{item.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.type} • {item.is_read ? "read" : "unread"} • {formatDateTime(item.created_at)}
                          </p>
                        </div>
                      ))}
                      {audit.recent.likedSongs.length === 0 && audit.recent.notifications.length === 0 ? (
                        <p className="px-4 py-6 text-sm text-muted-foreground">No likes or notifications recorded.</p>
                      ) : null}
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
