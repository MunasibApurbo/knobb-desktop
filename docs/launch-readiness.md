# Launch Readiness

This checklist reflects the current app architecture:

- direct upstream-compatible instance access for music content
- Supabase for auth and app data
- Netlify-style static deployment for the frontend
- Electron packaging for macOS and Windows desktop releases

## Core Launch Requirements

### Frontend

- `npm run build` passes
- SPA redirects are configured
- production env vars are set:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`

### Desktop

- `npm run desktop:package:mac` passes on a macOS machine
- Windows GitHub Actions runner can build `npm run desktop:package:win`
- `package.json` version matches the pushed `v*` git tag used for release publishing
- the packaged app opens `/app` directly instead of the marketing landing page
- macOS signing/notarization secrets are configured before claiming signed public macOS releases
- Windows signing certificate is configured if SmartScreen reputation/signing is required immediately
- GitHub Releases are enabled for this repo so `electron-updater` can fetch `latest.yml`

### Supabase

- all migrations in `supabase/migrations/` are applied
- Auth site URL and redirect URLs are configured
- Google and Discord providers are configured if social login is enabled
- realtime is enabled for the tables used by library/notifications/history flows

### Music Layer

- public upstream-compatible instances are reachable
- or, preferably, your own instance pool is available

## Soft Public Launch Baseline

Use this repo for a soft public launch, not a broad public announcement, once the following are true:

- `npm run lint`, `npm run test`, `npm run build`, and `npm run preflight` pass locally
- Netlify is configured with:
  - base directory: repository root
  - build command: `npm run build`
  - publish directory: `dist`
- Netlify production env vars are set:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`
- the target Supabase project has current migrations applied
- Supabase Auth site URL and redirect URLs match the production Netlify domain
- Google and Discord OAuth are updated with the same production domain and callback settings if social sign-in is enabled
  - provider callback format: `https://<project-ref>.supabase.co/auth/v1/callback`
  - current project callback: `https://nqggizilkxudjdyxdsnl.supabase.co/auth/v1/callback`

This launch tier assumes the app is live and usable, but promotion stays limited until production smoke tests are complete and early feedback is stable.

## Recommended Validation Steps

1. Run:
  - `npm run test`
  - `npm run build`
  - `npm run preflight`
2. Validate landing and routing:
  - home load
  - refresh on nested routes
  - not-found route / SPA fallback
3. Validate auth flows:
  - email/password sign in
  - Google sign in
  - Discord sign in
  - password reset
  - sign out
  - auth callback route
4. Validate music flows:
  - artist page load
  - album page load
  - search
  - playback start
  - playback remains usable when one upstream source is slow
5. Validate account/library flows:
  - like/unlike song
  - save/unsave album
  - favorite/unfavorite artist
  - create playlist
  - add/remove playlist tracks
  - reload and confirm data persists
6. Validate production sanity:
  - no startup crash in browser console
  - no missing env/runtime error in the deployed app
  - `/.netlify/functions/unreleased-proxy` works if unreleased features are exposed in this launch
7. Validate desktop release sanity:
  - packaged app boots into `/app`
  - tray show/hide still works
  - Discord bridge config folder/file actions still work
  - Windows release uploads `latest.yml` and installer assets
  - a previously installed Windows build detects the newer tagged release

## Minimum Production Expectations

- first meaningful UI should not block on all recommendation sections
- playback should still work when one public instance is slow
- auth and library mutations should survive refresh and cross-device use

## Known Risks

- public upstream-compatible instances can vary in uptime and latency
- production auth and playback still require live-environment verification

## Stronger Production Setup

Best current setup:

1. Netlify for the frontend
2. Supabase for auth/data
3. your own upstream-compatible backend instances

That gives better stability than relying on public shared music endpoints.
