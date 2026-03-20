# TIDAL API Coverage Report

Date: 2026-03-19
Reference: https://tidal-music.github.io/tidal-api-reference/

## Summary

KNOBB currently uses three classes of TIDAL integrations:

1. Official browse endpoints on `https://api.tidal.com/v1/pages/...` for home and discovery shelves.
2. The official `genres` endpoints on `https://api.tidal.com/v1/genres` and `https://api.tidal.com/v1/genres/{id}`.
3. A separate unofficial proxy layer for playback, search, album, artist, playlist, mix, lyrics, and recommendation data.

## Official TIDAL reference endpoints now used in the website

- `GET /artists/{id}`
- `GET /albums/{id}`
- `GET /playlists/{id}`
- `GET /tracks/{id}`
- `GET /videos/{id}`
- `GET /genres`
- `GET /genres/{id}`

## Official TIDAL endpoints already used in the app, but not listed in the JSON:API reference bundle

- `GET /pages/home`
- `GET /pages/explore`
- `GET /pages/explore_new_music`
- `GET /artists/{id}/bio`

## Still not used from the official reference bundle

The app does not currently use the JSON:API catalog/resource families below:

- `albums`
- `artists`
- `playlists`
- `tracks`
- `lyrics`
- `credits`
- `providers`
- `searchResults`
- `searchSuggestions`
- `trackManifests`
- `videoManifests`
- `userCollections`
- `userCollectionAlbums`
- `userCollectionArtists`
- `userCollectionPlaylists`
- `userCollectionTracks`
- `userCollectionVideos`
- `userRecommendations`
- `dynamicPages`
- `dynamicModules`
- plus the write/admin/social resources such as comments, shares, reactions, offline tasks, and claims

## Why those endpoints were not wired into the site in this pass

- The current website does not implement TIDAL Developer OAuth or client-credentials token exchange.
- Probe requests with the shipped anonymous `X-Tidal-Token` succeeded for `genres`, but search/catalog JSON:API endpoints returned auth or availability failures (`404`, `400`, or `500`) during verification.
- Exposing those endpoints in the UI right now would create broken options for users.

## Applied change

The website now exposes the official genre API directly:

- Browse and Genre pages use a live TIDAL genre catalog when available.
- Genre detail uses `GET /genres/{id}` to show which content types are available for the selected genre.
- The old hardcoded genre list remains as a fallback if the live API is unavailable.
- Existing artist, album, playlist, track, and artist-video metadata loaders now prefer the working official single-resource endpoints before falling back to the legacy proxy layer.

## Files updated for this work

- `src/lib/tidalGenresApi.ts`
- `src/lib/tidalDirectApi.ts`
- `src/hooks/useTidalGenres.ts`
- `src/lib/browseGenres.ts`
- `src/pages/BrowsePage.tsx`
- `src/pages/GenrePage.tsx`
- `vite.config.ts`
- `netlify/functions/tidal-browse-proxy.js`
