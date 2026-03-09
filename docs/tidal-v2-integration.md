# TIDAL Reference Integration

This document now describes the current reference-style search layer in the repo.

Historical note:
- the filename was kept for continuity
- the app does not currently ship a full direct `tidal-v2` proxy/client stack as the primary runtime path

## Current Files

- `src/lib/tidalReferenceSearch.ts`
- `src/lib/tidalReferenceMappers.ts`
- `src/lib/tidalV2Schemas.ts`
- `src/contexts/SearchContext.tsx`
- `src/pages/SearchPage.tsx`

## What It Does

The app uses a reference-style search/result mapping layer for parts of the search experience.

Current flow:

1. UI calls `searchTidalReference(query)`
2. that helper fans out to:
   - `searchTracks`
   - `searchArtists`
   - `searchAlbums`
   - `searchPlaylists`
3. those calls go through `src/lib/musicApi.ts`
4. `musicApi` delegates to the direct Knobb music core
5. results are normalized into app-friendly track/artist/album/playlist shapes

So the search UX can use reference-like shapes without requiring a dedicated TIDAL v2 edge proxy for normal runtime behavior.

## Important Constraint

`src/lib/tidalV2Schemas.ts` is currently a schema/reference utility layer, not proof that the app is running a full TIDAL v2 request pipeline end-to-end.

## Current Recommendation

If you need:

- normal app search/playback:
  use `musicApi`
- reference-oriented search mapping:
  use `tidalReferenceSearch`
- true TIDAL v2 endpoint coverage:
  treat that as separate future work, not as something already live in this repo
