# Knobb

Knobb is a React/Vite music app with a custom UI, a direct music data layer, and Supabase-backed account and library features.

The source app in `src/` is now the canonical website build. The recovered Netlify snapshot remains available only as a fallback through the explicit backup scripts.

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

If you need the recovered snapshot for comparison, use:

```sh
npm run dev:backup
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
npm run build:backup
npm run desktop:app
npm run desktop:app:dev
npm run desktop:package:mac
npm run test
npm run lint
npm run preflight
npm run discord:bridge
```

## Environment Variables

Frontend runtime:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SITE_URL` (optional, recommended for canonical/absolute metadata)

Server/runtime options for the Netlify YouTube Music proxy:

- `YTMUSIC_COOKIE` for a raw YouTube cookie header string
- or `YTMUSIC_COOKIE_FILE` for a Netscape-format cookies file path
- optional: `YTMUSIC_VISITOR_DATA`
- optional: `YTMUSIC_PO_TOKEN`

Copy `.env.example` to `.env.local` and fill in your own values before starting the app. Do not commit local env files.

The current frontend code does not require a music proxy env var for normal playback/search. The direct music layer uses its built-in upstream instance pool.

## Desktop App

This repo can publish installable macOS and Windows apps from the same codebase.

Local desktop usage:

```sh
npm run build
npm run desktop:app
```

Desktop development against Vite:

```sh
npm run dev
npm run desktop:app:dev
```

Packaging commands:

```sh
npm run desktop:package:mac
npm run desktop:package:win
```

What the desktop build does:

- loads the real app at `/app`, so the packaged app never opens the marketing landing page
- keeps the native tray + Discord presence bridge
- uses `electron-updater` against tagged GitHub Releases from this repo
- makes published Windows builds auto-update when you ship newer tagged releases from the current codebase

Desktop release flow:

1. Bump the app version with one of:
   - `npm run desktop:release:patch`
   - `npm run desktop:release:minor`
   - `npm run desktop:release:major`
2. Commit the version bump.
3. Push a matching git tag like `v0.1.8`.
4. GitHub Actions publishes the Windows installer and update metadata used by auto-update.
5. GitHub Actions publishes signed macOS installers when Apple signing secrets are configured.

Required desktop release secrets:

- macOS signing + notarization: `APPLE_CSC_LINK`, `APPLE_CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`
- optional Windows signing: `WINDOWS_CSC_LINK`, `WINDOWS_CSC_KEY_PASSWORD`

Required GitHub repository variables for desktop builds:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- optional: `VITE_SITE_URL`
- optional: `VITE_TURNSTILE_SITE_KEY`

## Website Deployment

This repo now targets the website only.

GitHub Actions delivery flow:

1. Push to `main` to:
   - build the web app
   - deploy Supabase migrations and edge functions
   - deploy the website and Netlify functions
2. Push a `v*` tag to publish desktop installers from the same repo

Required GitHub repository variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- optional: `VITE_SITE_URL`
- optional override: `SUPABASE_PROJECT_REF`

Required GitHub repository secrets:

- automated website deploy: `NETLIFY_AUTH_TOKEN`, `NETLIFY_SITE_ID`
- automated Supabase deploy: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`

## Discord Rich Presence

Use the local Discord bridge on the same machine as Discord desktop.

Setup:

1. Copy [discord-presence.bridge.example.json](discord-presence.bridge.example.json) to `discord-presence.bridge.json`.
2. Set `clientId` to your Discord application client ID.
3. Set `siteUrl` to your real Knobb web app URL if you are not running Knobb locally.
4. Optional: upload Rich Presence art assets in your Discord application and set `largeImageKey`, `playImageKey`, and `pauseImageKey`.
5. Start the bridge with `npm run discord:bridge`.
6. Open Discord desktop and enable `Discord activity status` in Settings.

Notes:

- The browser bridge listens on `http://127.0.0.1:32145` by default.
- The browser app can queue activity for the local bridge, but Discord will only show presence if the bridge is running and your Discord client is open.
- `discord-presence.bridge.json` is gitignored on purpose because it contains your local app configuration.

## Supabase Requirements

You still need a Supabase project for:

- auth
- Google login
- Discord login
- liked songs
- favorite artists
- saved albums
- playlists
- collaboration/sharing
- notifications
- play history
- current status / friend activity

The GitHub Actions delivery workflow now applies the SQL migrations in [supabase/migrations](supabase/migrations) and deploys the Supabase edge functions automatically when the required secrets are configured.

## Netlify Deployment

This repo is already configured for Netlify in [netlify.toml](netlify.toml), [public/_redirects](public/_redirects), and [public/_headers](public/_headers).

Recommended settings:

- Base directory: repository root (leave empty)
- Build command: `npm run build`
- Publish directory: `dist`
- Functions directory: leave empty unless you separately deploy backend functions

Set these environment variables in Netlify for runtime parity:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `YTMUSIC_COOKIE` or `YTMUSIC_COOKIE_FILE`
- optional: `YTMUSIC_VISITOR_DATA`
- optional: `YTMUSIC_PO_TOKEN`

Set the same values as GitHub repository variables so the GitHub Actions build can produce the production site before deploy.

If YouTube Music search works on Netlify but playback fails with a `Sign in to confirm you're not a bot` error, the production function is missing valid YouTube auth cookies. The Netlify YouTube Music fallback now forwards `YTMUSIC_COOKIE` and `YTMUSIC_COOKIE_FILE` into `yt-dlp`, so set one of those runtime vars on the site before redeploying.

Deploy notes:

- `npm run build` builds the current Vite source app into `dist/`.
- `npm run build:backup` still copies the recovered Netlify deploy bundle from `deploy-backup-site/` into `dist/` if you need a fallback artifact.
- `main` pushes are intended to deploy through GitHub Actions.
- `dist/404.html` is generated automatically so SPA routes still resolve on static hosts.
- For manual deploys, upload the contents of `dist/` as the site root, not a parent folder containing `dist`.
- If the site loads but auth is broken, your Netlify domain is usually missing from Supabase Auth URL settings.

For the initial release, treat the deployment as a soft public launch and use [docs/soft-public-launch.md](docs/soft-public-launch.md) as the release checklist.

For Google and Discord login:

- enable the Google and Discord providers in Supabase Auth
- add your Netlify domain to Supabase site URL / redirect URLs
- add the Supabase callback URL to each provider's OAuth app settings
  - format: `https://<project-ref>.supabase.co/auth/v1/callback`
  - for this repo: `https://nqggizilkxudjdyxdsnl.supabase.co/auth/v1/callback`
- for local OAuth testing with `npm run dev`, allow `http://localhost:5173/auth` and `http://127.0.0.1:5173/auth` in Supabase redirect URLs

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
