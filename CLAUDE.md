# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server with HMR at http://localhost:5173
npm run build     # Type-check (tsc -b) then build to dist/
npm run lint      # Run ESLint
npm run preview   # Preview production build locally
```

No test runner is configured yet.

## Architecture

This is a React 19 + TypeScript app bootstrapped with Vite 8. Currently in early/starter state — `src/App.tsx` is the single component with placeholder content.

- Entry: `index.html` → `src/main.tsx` → `src/App.tsx`
- Styling: plain CSS via `src/App.css` and `src/index.css`
- Static assets in `public/` (SVG icons sprite at `public/icons.svg`) and `src/assets/`
- ESLint config uses flat config format (`eslint.config.js`) with `typescript-eslint`, `eslint-plugin-react-hooks`, and `eslint-plugin-react-refresh`
- TypeScript uses split tsconfig: `tsconfig.app.json` for source, `tsconfig.node.json` for Vite config

## F1 Fantasy API

The app fetches from `https://fantasy.formula1.com/feeds/v2/statistics/driverconstructors_4.json`. This endpoint returns no CORS headers, so all browser fetches must go through the Vite dev proxy configured in `vite.config.ts` at `/api/f1/*` → `https://fantasy.formula1.com/feeds/v2/statistics/*`. Production deployments will need an equivalent proxy or server-side fetch.

Response shape:
```
{ Data: { season: "2026", driver: [ { config: {...}, participants: Driver[] } ] } }
```

`driver[0]` is the "fantasy points" category. Each `Driver` has: `playerid`, `playername`, `curvalue` (price in $m), `teamid`, `teamname`, `statvalue` (fantasy points), `rnk`.

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