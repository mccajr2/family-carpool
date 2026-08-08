# web

Vite + React + TypeScript client for quickapp.

## Toolchain

Local installs must satisfy `package.json` → `engines` (aligned with jsdom 30:
Node `^22.22.2 || ^24.15.0 || >=26`). CI pins Node via `web/.nvmrc` and npm via
`packageManager` + Corepack.

| What | Where | Role |
|------|--------|------|
| Node `^22.22.2 \|\| ^24.15.0 \|\| >=26` | `package.json` → `engines` | Local floor — Node 20 is too old for the Vitest/jsdom stack |
| Node `24.19.0` | `web/.nvmrc` | CI (and preferred when regenerating the lockfile) |
| npm `11.4.2` | `package.json` → `packageManager` | CI via Corepack |

```bash
cd web
npm ci          # preferred when lockfile exists
npm run dev
```

Prefer matching `.nvmrc` when regenerating `package-lock.json`. CI runs
`corepack enable` + `npm ci` only (never `npm install`).

## Quick start

```bash
cp .env.example .env   # optional
npm ci                 # or npm install on first bootstrap of a new lockfile
npm run dev
```

Scripts: `dev`, `build`, `lint`, `test`.

In `npm run dev`, `/api` is proxied to `http://localhost:8080` (avoids CORS).
Override with `VITE_API_BASE_URL` when you need a different origin.

With the backend running (`./gradlew :backend:bootRun` from the repo root), open
the app and fetch a greeting — success text includes
`from a Spring Modulith module.`
