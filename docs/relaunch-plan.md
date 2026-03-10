# Relaunch Plan

This relaunch resets existing app data and keeps only the schema, policies, and runtime code.

## Scope

Keep Supabase for:

- auth
- profiles
- playlists and collaboration
- likes, saved albums, and favorite artists
- notifications
- play history
- live status and playback handoff

Do not add more user-generated storage surfaces until the current ones have explicit limits and retention rules.

## Reset Baseline

The relaunch reset migration clears:

- all public app tables
- all auth users
- all stored profile banner objects

It does not remove migrations, policies, functions, or buckets.

## Profile Banner Rules

Profile banners now have hard constraints:

- source formats: JPG, PNG, WebP
- source upload limit: 2 MB
- minimum source size: 1200x540
- exported banner size: up to 1680x720 JPG
- stored banner limit: 2 MB

These rules must stay aligned between frontend validation and Supabase storage bucket settings.

## Data Rules

- `play_history` remains user-scoped and should stay retention-bound.
- `current_status` is ephemeral and should never be treated as historical data.
- `playback_sessions` is device-state sync, not analytics.
- `client_events` is diagnostic data and should stay aggressively disposable.

## Before Public Scale

Complete these before treating the project as more than a beta:

1. Replace trigger-per-insert play-history pruning with scheduled or batched cleanup.
2. Add explicit retention rules for `client_events`, `notifications`, and stale `playback_sessions`.
3. Add upload constraints anywhere a new user media surface is introduced.
4. Review every realtime subscription against a clear user-facing requirement.
