# Architecture

## Runtime Split

The app is intentionally split into two backends:

- `Knobb music core` for music content and playback lookups
- `Supabase` for app data and identity

That means:

- artist/album/playlist/music search flows use the direct music client
- auth, likes, saved albums, playlists, notifications, play history, and realtime use Supabase

## Frontend Layers

### UI

- `src/pages/`: route-level screens
- `src/components/`: reusable UI pieces
- `src/components/sidebar/`: sidebar internals
- `src/components/visualizers/`: playback visualizers

### State

- `src/contexts/AuthContext.tsx`: auth/session
- `src/contexts/PlayerContext.tsx`: playback state and control
- `src/contexts/LikedSongsContext.tsx`: liked songs
- `src/contexts/FavoriteArtistsContext.tsx`: favorite artists
- `src/contexts/SearchContext.tsx`: sidebar/global search state

### Hooks

- `src/hooks/useHomeFeeds.ts`: homepage recommendation orchestration
- `src/hooks/useArtistPageData.ts`: artist page loading
- `src/hooks/usePlaylists.ts`: playlist CRUD and sync
- `src/hooks/useSavedAlbums.ts`: saved albums sync
- `src/hooks/usePlayHistory.ts`: history read/write

## Music Data Layer

### Public Entry Point

- `src/lib/musicApi.ts`

This is the app-facing adapter. Pages and hooks should depend on this layer, not on raw core internals.

### Core Internals

- `src/lib/musicCore.ts`: orchestration/client
- `src/lib/musicCoreShared.ts`: shared types and constants
- `src/lib/musicCoreCache.ts`: IndexedDB + memory cache
- `src/lib/musicCoreInstances.ts`: instance discovery and prioritization
- `src/lib/musicCoreTransforms.ts`: normalization/parsing helpers

### Data Flow

1. UI requests data through `musicApi`
2. `musicApi` maps app-friendly TIDAL-like shapes
3. `musicCore` selects a upstream-compatible instance
4. core fetches content, caches responses, and records latency
5. transformed data returns to the UI

## Supabase Layer

### Client

- `src/integrations/supabase/client.ts`

### Primary Responsibilities

- auth and session persistence
- Google OAuth
- profiles
- liked songs
- favorite artists
- saved albums
- playlists and collaboration
- notifications
- play history and current status
- realtime subscriptions

### Schema

The schema lives in:

- `supabase/migrations/`

## Search Layer

There are two search paths:

- `src/pages/SearchPage.tsx`: full search page using the reference-style search mapping layer
- `src/contexts/SearchContext.tsx`: sidebar search overlay state

Reference-style mapping helpers:

- `src/lib/tidalReferenceSearch.ts`
- `src/lib/tidalReferenceMappers.ts`
- `src/lib/tidalV2Schemas.ts`

These are reference-oriented shapes used by parts of the search experience. They are not currently a full direct TIDAL v2 client.

## Deployment Model

### Required

- static frontend host such as Netlify
- Supabase project
- frontend env vars for Supabase

### Optional / Legacy

- Supabase edge functions under `supabase/functions/`

Current normal playback/search does not depend on a music relay edge function.

## Maintenance Priorities

If you continue cleanup work, the next sensible areas are:

1. repo-wide lint cleanup
2. stronger test coverage around player and API adapters
3. keep docs aligned with the actual runtime architecture
