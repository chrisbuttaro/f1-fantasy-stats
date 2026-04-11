# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. If you notice anything inaccurate in this file, fix it.

## Commands

```bash
npm run dev       # Start dev server with HMR at http://localhost:5173
npm run build     # Type-check (tsc -b) then build to dist/
npm run lint      # Run ESLint
npm run preview   # Preview production build locally
```

No test runner is configured yet.

## Architecture

This is a React 19 + TypeScript app bootstrapped with Vite 8.

- Entry: `index.html` → `src/main.tsx` → `src/App.tsx`
- Styling: plain CSS via `src/App.css` and `src/index.css`
- Static assets in `public/` (SVG icons sprite at `public/icons.svg`) and `src/assets/`
- ESLint config uses flat config format (`eslint.config.js`) with `typescript-eslint`, `eslint-plugin-react-hooks`, and `eslint-plugin-react-refresh`
- TypeScript uses split tsconfig: `tsconfig.app.json` for source, `tsconfig.node.json` for Vite config

Key pieces:
- `useFantasyData` — fetches drivers + constructors from `/api/f1/driverconstructors_4.json`
- `useChartExpansion` — fetches per-race stats from `/api/f1-popup/playerstats_{playerId}.json` on row expand; prefetches all players in the background on load; in-memory cache for the session
- `useTeamPicker` — manages team selection (max 5 drivers, 2 constructors) and budget tracking
- `RankingTable` — renders the ranked list with expandable rows; `RaceChart` renders inside expanded rows

## F1 Fantasy API

All browser fetches go through the proxy (`/api/f1/*`, `/api/f1-popup/*`) — the upstream returns no CORS headers. Dev uses the Vite proxy; production uses Vercel edge functions backed by Upstash Redis.

**Stats endpoint** — `driverconstructors_4.json`:
```
{ Data: { season: "2026", driver: [ { participants: Participant[] } ], constructor: [ { participants: Participant[] } ] } }
```
`driver[0]` and `constructor[0]` are the "fantasy points" categories. Each `Participant`: `playerid`, `playername` (null for constructors), `curvalue` (price $m), `teamid`, `teamname`, `statvalue` (fantasy points), `rnk`.

**Popup endpoint** — `playerstats_{playerId}.json`:
```
{ Value: { GamedayWiseStats: [ { GamedayId, StatsWise: [ { Event, Value } ] } ], FixtureWiseStats: [ { GamedayId, RaceDayWise: [ { MeetingName, CountryName } ] } ] } }
```
Points per race are derived by joining on `GamedayId` and finding `Event === "Total"` in `StatsWise`.

## Caching

Production data is stored in Upstash Redis (connected via Vercel Storage integration — provides `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` automatically). Always import from `@upstash/redis`, not `@upstash/redis/cloudflare` — the cloudflare variant reads env vars via Cloudflare's Worker binding and silently fails on Vercel.

- **Static endpoints** (e.g. `driverconstructors_4.json`): pre-fetched daily at midnight UTC via cron and stored under `f1:stats:{endpoint}`. To add a new metric, add its filename to `STATS_ENDPOINTS` in `api/ingest.js` — nothing else needs changing.
- **Popup data** (per-player): lazily cached on first request per day under `f1:popup:{path}:{YYYY-MM-DD}`.
- **First-user-of-day fallback**: `api/f1/[...path].js` checks `f1:ingest_date` and calls `/api/ingest` if today's data isn't present yet.

Local dev uses the Vite proxy and never touches Redis.

## Code Style

Comment code, but keep it light — section headers and a brief note on non-obvious logic only. No restating what the code clearly does.

## Git

Do not run `git commit` or `git push` — the user handles all commits and pushes themselves.

## Dependency Policy

### Allowed package sources
- Only use packages from **official package registries**: npm, PyPI, Maven Central, crates.io, etc.
- Only import from packages that meet ALL of the following criteria:
    1. Published on the official registry (not raw GitHub URLs or git deps)
    2. Weekly downloads > 100,000 OR part of a well-known ecosystem (e.g. React, Express, FastAPI)
    3. Actively maintained (last release within 18 months)
    4. Has a clear license (MIT, Apache 2.0, BSD, ISC)

### Prohibited import patterns
- ❌ No `github:user/repo` or `git+https://github.com/...` dependencies
- ❌ No direct URL imports (e.g. `import x from "https://raw.githubusercontent.com/..."`)
- ❌ No packages with < 1,000 weekly downloads unless explicitly approved
- ❌ No packages with no public documentation or README
- ❌ No forked versions of popular packages (e.g. `lodash-fork-xyz`)