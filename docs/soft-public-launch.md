# Soft Public Launch Checklist

Use this checklist when pushing Knobb live on Netlify for an early public release.

## Deploy Setup

- Netlify base directory: repository root
- Netlify build command: `npm run build`
- Netlify publish directory: `dist`
- Netlify env vars:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`

## Supabase Setup

- apply all SQL in `supabase/migrations/`
- enable realtime for the tables used by:
  - likes
  - playlists
  - notifications
  - history
- deploy required Supabase functions
- set Supabase Auth site URL to the production Netlify domain
- add the production `/auth` callback URL to Supabase redirect URLs
- if Google sign-in is enabled, add the same production domain and callback settings in Google Cloud OAuth

## Local Release Gates

Run these before deploying:

- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run preflight`

`npm run preflight` now checks env values from the process environment, `.env.local`, and `.env`.

## Live Smoke Test

Run this on the deployed site before broader promotion.

1. Landing and routing
   - home page loads
   - nested route refresh works
   - unknown routes resolve to app fallback / not-found behavior
2. Auth
   - sign up / sign in
   - sign out
   - password reset
   - Google sign in, if enabled
   - auth callback returns to the app cleanly
3. Core music flows
   - search returns results
   - artist page loads
   - album page loads
   - playback starts
   - playback still works when one upstream source is slow or unavailable
4. Library flows
   - like/unlike a song
   - save/unsave an album
   - favorite/unfavorite an artist
   - create a playlist
   - add/remove playlist tracks
   - reload and confirm data persists
5. Production sanity
   - no startup crash in the browser console
   - no missing env/runtime error appears
   - unreleased proxy route works if unreleased features are part of this launch

## Launch Positioning

- treat the first live deployment as a soft public launch
- limit promotion until the smoke test passes
- expect follow-up fixes based on early feedback
- do not treat this as a full public launch until the live checks are stable and the music backend reliability is acceptable
