# Contributing

## Before You Start

- Read [README.md](README.md).
- Review [docs/architecture.md](docs/architecture.md) if your change touches data flow or page composition.
- Keep changes focused. This repo is easier to review in small PRs than broad rewrites.

## Local Setup

1. Install dependencies:

```sh
npm install
```

2. Start the app:

```sh
npm run dev
```

3. Before opening a PR, run:

```sh
npm run lint
npm run test
npm run build
```

## Project Conventions

- Put route composition in `src/pages/`.
- Put reusable UI in `src/components/`.
- Put reusable logic in `src/hooks/`.
- Put API adapters, transforms, and pure helpers in `src/lib/`.
- Keep app-wide state in `src/contexts/`. Do not move route-local concerns there unless multiple distant surfaces need them.

## Pull Requests

- Describe the user-visible change and the technical approach.
- Call out any required env vars, migrations, or follow-up deployment steps.
- Include screenshots or screen recordings for UI changes.
- Avoid unrelated formatting churn in files you did not intend to change.

## Quality Bar

- Prefer clear names over clever abstractions.
- Extract repeated UI or logic instead of copying it into another page.
- Remove dead imports, stale props, and one-off duplication while touching a file.
- If behavior changes, add or update tests where practical.

## Database and Supabase Changes

- Put schema changes in `supabase/migrations/`.
- Keep frontend assumptions aligned with generated Supabase types.
- Mention any migration ordering or rollout dependency in the PR description.
