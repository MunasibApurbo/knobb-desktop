# Knobb

Knobb is a React/Vite music app with a custom UI, a direct music data layer, and Supabase-backed account and library features.

## What This Repo Contains

- `src/`: frontend app code
- `src/lib/musicCore.ts`: direct music/content client with instance failover
- `src/lib/musicApi.ts`: app-facing adapter around the core client
- `src/contexts/`: auth, player, library, and search state
- `supabase/`: migrations and edge functions for app data features
- `docs/`: project documentation
- `scripts/`: maintained project scripts

This repo no longer uses a Supabase proxy as the primary music content path. Music search, album/artist lookups, lyrics, and stream resolution are handled through the direct Knobb music core. Supabase is still required for auth, playlists, likes, saved albums, notifications, history, and realtime.

## Current Architecture

High level:

1. UI pages/components call app-facing helpers in `src/lib/musicApi.ts`.
2. `musicApi` delegates to `musicCore`, which talks directly to upstream-compatible instances.
3. User/library state goes through Supabase client, tables, RPCs, and realtime channels.

See [docs/architecture.md](docs/architecture.md) for the current repo map and data flow.

## Contributor Notes

For code review and maintenance, these boundaries matter:

- `src/pages/`: route-level composition only. Fetch orchestration can live here or in a route-specific hook, but reusable UI should move out.
- `src/components/`: presentational and interaction components. Repeated page patterns should be extracted here instead of copied between routes.
- `src/hooks/`: route-specific state/data hooks and reusable client hooks.
- `src/lib/`: pure helpers, API adapters, transport/client logic, and transform code. Prefer keeping network/data normalization here instead of inside components.
- `src/contexts/`: app-wide state only. Avoid adding route-local concerns here unless multiple distant surfaces truly need shared live state.

Recommended approach for new work:

1. Keep data fetching and transformation close to `src/lib/` or a dedicated hook.
2. Keep route files readable by pushing repeated sections into named components.
3. Prefer extending existing shared patterns like `PlaylistCreateDialog`, `ArtistsLink`, and hero visual helpers before adding another one-off implementation.
4. If a component needs comments to be understood, consider extracting smaller named helpers first.

## Open Source Readiness

Before publishing changes, verify:

- `npm run lint`
- `npm run test`
- `npm run build`

The repo already has a broad set of generated and migration files, so contributors should avoid unrelated churn in large formatting-only edits. Small focused PRs will review better here than repo-wide rewrites.

Community files:

- [LICENSE](LICENSE)
- [CONTRIBUTING.md](CONTRIBUTING.md)
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)

## Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Radix UI primitives
- Framer Motion
- Supabase Auth / Postgres / Realtime

## Local Development

Requirements:

- Node.js 18+
- npm

Install and run:

```sh
npm install
npm run dev
```

Before `npm run dev`, copy `.env.example` to `.env.local`.

On macOS/Linux, use:

```sh
cp .env.example .env.local
```

On Windows PowerShell, use:

```powershell
Copy-Item .env.example .env.local
```

Useful commands:

```sh
npm run build
npm run test
npm run lint
npm run preflight
npm run desktop:app
npm run desktop:app:dev
npm run desktop:package
npm run desktop:package:mac
npm run desktop:package:win
npm run discord:bridge
npm run discord:companion
```

## Environment Variables

Frontend runtime:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SITE_URL` (optional, recommended for canonical/absolute metadata)

Copy `.env.example` to `.env.local` and fill in your own values before starting the app. Do not commit local env files.

The current frontend code does not require a music proxy env var for normal playback/search. The direct music layer uses its built-in upstream instance pool.

## Desktop App

Knobb now includes a real Electron desktop app.

Use the production build inside Electron:

```sh
npm run build
npm run desktop:app
```

For development against Vite:

```sh
npm run dev
npm run desktop:app:dev
```

The desktop app:

- runs the full Knobb UI inside Electron
- injects native Discord Rich Presence support directly into the app
- keeps background presence alive in the tray when you close the window

To package the current host platform locally:

```sh
npm run desktop:package
```

Explicit host-platform packages:

```sh
npm run desktop:package:mac
npm run desktop:package:win
```

This writes artifacts to `release/desktop/`.

The desktop bundle version comes from `package.json`.

Artifacts:

- `Knobb-Desktop-macOS.dmg`
- `Knobb-Desktop-macOS.zip`
- `Knobb-Desktop-Setup.exe`
- `latest-mac.yml`
- `latest.yml`

Release publishing now uses `electron-builder` and `electron-updater` with GitHub Releases for `MunasibApurbo/soft-visuals-studio`.

The packaged desktop apps now:

- support auto-updates on packaged macOS and Windows builds
- treat every newer desktop release as required
- check automatically on launch and every 4 hours
- block the app if a required update is available or if offline update verification has been stale for more than 3 days

GitHub Actions release workflow:

1. Bump `package.json` / `package-lock.json` with one of:
   - `npm run desktop:release:patch`
   - `npm run desktop:release:minor`
   - `npm run desktop:release:major`
   - `npm run desktop:release -- --version 0.1.1`
2. Commit the version bump.
3. Push a matching git tag like `v0.1.1`.
4. GitHub Actions builds and publishes the macOS and Windows installers to the latest GitHub Release.

Required GitHub Actions secrets:

- macOS: `APPLE_CSC_LINK`, `APPLE_CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`
- Windows: `WINDOWS_CSC_LINK`, `WINDOWS_CSC_KEY_PASSWORD`

The website and desktop updater both target the GitHub latest-release URLs:

- macOS: `https://github.com/MunasibApurbo/soft-visuals-studio/releases/latest/download/Knobb-Desktop-macOS.dmg`
- Windows: `https://github.com/MunasibApurbo/soft-visuals-studio/releases/latest/download/Knobb-Desktop-Setup.exe`
- Release page: `https://github.com/MunasibApurbo/soft-visuals-studio/releases/latest`

## Discord Rich Presence

Preferred path: run Knobb Desktop on the same machine as Discord desktop.

Browser fallback: use the local Discord bridge.

Setup:

1. Copy [discord-presence.bridge.example.json](discord-presence.bridge.example.json) to `discord-presence.bridge.json`.
2. Set `clientId` to your Discord application client ID.
3. Set `siteUrl` to your real Knobb web app URL if you are not running Knobb locally.
4. Optional: upload Rich Presence art assets in your Discord application and set `largeImageKey`, `playImageKey`, and `pauseImageKey`.
5. Start Knobb Desktop with `npm run desktop:app` or a packaged app from `release/macos/`, or use `npm run discord:bridge` if you are staying in the browser.
6. Open Discord desktop and enable `Discord activity status` in Settings.

Notes:

- Knobb Desktop talks to Discord directly and does not need the HTTP bridge.
- The browser bridge listens on `http://127.0.0.1:32145` by default.
- The browser app can queue activity for the local bridge, but Discord will only show presence if the bridge is running and your Discord client is open.
- `discord-presence.bridge.json` is gitignored on purpose because it contains your local app configuration.

Legacy companion:

- `npm run discord:companion` still exists as a bridge-only helper.
- The preferred user-facing path is now `npm run desktop:app`.

## Supabase Requirements

You still need a Supabase project for:

- auth
- Google login
- liked songs
- favorite artists
- saved albums
- playlists
- collaboration/sharing
- notifications
- play history
- current status / friend activity

Apply the SQL migrations in [supabase/migrations](supabase/migrations) before deploying.

## Netlify Deployment

This repo is already configured for Netlify in [netlify.toml](netlify.toml), [public/_redirects](public/_redirects), and [public/_headers](public/_headers).

Recommended settings:

- Base directory: repository root (leave empty)
- Build command: `npm run build`
- Publish directory: `dist`
- Functions directory: leave empty unless you separately deploy backend functions

Set these environment variables in Netlify:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Deploy notes:

- `dist/404.html` is generated automatically so SPA routes still resolve on static hosts.
- For manual deploys, upload the contents of `dist/` as the site root, not a parent folder containing `dist`.
- If the site loads but auth is broken, your Netlify domain is usually missing from Supabase Auth URL settings.

For the initial release, treat the deployment as a soft public launch and use [docs/soft-public-launch.md](docs/soft-public-launch.md) as the release checklist.

For Google login:

- enable Google provider in Supabase Auth
- add your Netlify domain to Supabase site URL / redirect URLs
- add the Supabase callback URL in Google Cloud OAuth

## Performance Notes

- UI and static assets can be fast on Netlify/CDN.
- Supabase is fine for app data.
- The main runtime variability now comes from public upstream-compatible instances.
- For production-grade stability, run your own compatible instance pool instead of relying on public shared endpoints.

## Known Repo Notes

- Project docs live in `docs/`.
- Maintained scripts live in `scripts/`.
- Build is green. Repo-wide lint is intended to cover the actual app/runtime files.

## Recommended Reading

- [docs/architecture.md](docs/architecture.md)
- [docs/launch-readiness.md](docs/launch-readiness.md)
- [docs/soft-public-launch.md](docs/soft-public-launch.md)
- [docs/tidal-v2-integration.md](docs/tidal-v2-integration.md)
- [docs/README.md](docs/README.md)
