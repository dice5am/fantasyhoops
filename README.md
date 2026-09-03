# FantasyHoops

A fantasy basketball team builder. Browse a pool of NBA players ranked by
projected fantasy points, draft up to eight of them, and watch your lineup's
projected score update in real time.

The project is a TypeScript monorepo with two workspaces:

| Package | Description | Dev port |
| --- | --- | --- |
| `@fantasyhoops/server` | Express REST API with the player pool and fantasy scoring engine | `4000` |
| `@fantasyhoops/web` | React + Vite single-page app for drafting a roster | `5173` |

## Getting started

```bash
npm ci        # install all workspace dependencies
npm run dev   # start the API (4000) and the web app (5173) together
```

Then open http://localhost:5173. The web dev server proxies `/api` requests to
the backend, so both must be running.

## Common commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Run API + web dev servers concurrently |
| `npm run dev:server` | Run just the API (`tsx watch`) |
| `npm run dev:web` | Run just the Vite dev server |
| `npm test` | Run the server unit + API tests (Vitest) |
| `npm run typecheck` | Type-check both workspaces |
| `npm run lint` | Lint the repository with ESLint |
| `npm run build` | Build the API and the web bundle |

## Fantasy scoring

Projected fantasy points per game are computed from per-game averages:

```
FPTS = PTS×1 + REB×1.2 + AST×1.5 + STL×3 + BLK×3 − TO×1
```

See `packages/server/src/scoring.ts`.

## API

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Service health + player count |
| `GET` | `/api/players` | Player pool, sorted by fantasy points |
| `GET` | `/api/team` | Current roster + projected points |
| `POST` | `/api/team/roster` | Draft a player (`{ "playerId": "jokic" }`) |
| `DELETE` | `/api/team/roster/:playerId` | Release a player |
