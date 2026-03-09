# Spotify-Parity Roadmap (Knobb)

This roadmap now reflects the current repository state rather than the earlier pre-integration plan.

## Implemented In Repo

### Account-Linked Library
- `favorite_playlists` is wired into playlist actions and the sidebar library.
- `saved_albums`, `liked_songs`, and `favorite_artists` remain account-scoped through Supabase-backed state.
- Library entities are stored against the signed-in account and refreshed through realtime-aware hooks.

### Profile + Session Layer
- Profile editing now exists for display name and cover/avatar styling on the profile page.
- Account settings now expose password-reset email flow and sign-out-other-sessions controls.
- Per-device playback session metadata is stored in `playback_sessions` and surfaced in the UI.

### Collaboration + Playlist Ops
- Playlist metadata editing includes name, description, cover, visibility, and share-token regeneration.
- Playlist collaboration supports owner/editor/viewer roles and invite flows.
- Playlist reordering and track-level mutations already run through optimistic client updates.

### Listening Intelligence
- Listening stats and completion-threshold logic are implemented in the client.
- Listening-intelligence, notifications, observability, sharing, and playback-session migrations exist in `supabase/migrations/`.
- Observability hooks already capture latency and client-side failures.

## Still Left

### Production Validation
- Apply the current Supabase migrations in the target environment.
- Configure production Auth redirect URLs and Google OAuth settings.
- Run deployed smoke tests for auth, library mutations, collaboration, and playback.
- Verify playback against the intended upstream instance pool instead of relying only on local checks.

### Performance + Reliability
- Introduce edge caching for read-heavy album, playlist, and search requests.
- Add request coalescing and stale-while-revalidate behavior where repeated requests still fan out.
- Turn the existing latency telemetry into enforced budgets with alerting around p95 regressions.

## Latency Target Reality

- True zero latency is not physically possible on networked systems.
- The practical target remains sub-100ms perceived response using optimistic updates, cache hydration, and realtime reconciliation.

## Next Recommended Build Slice

1. Production smoke-test pass on the deployed environment.
2. Edge caching plus request coalescing for read-heavy routes.
3. p95 latency alerting and instance-pool hardening.
