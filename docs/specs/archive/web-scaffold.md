# Spec: web-scaffold

Status: done
Created: 2026-07-10
Completed: 2026-07-10

## Problem

quickapp has a verified backend, mobile clients, OpenAPI contract, and
path-filtered CI, but no `web/` tree. AGENTS.md and `docs/architecture.md` still
treat web as “not built yet,” so the third consumer of `contracts/openapi.yaml`
is missing and the “update web + mobile on contract change” rule cannot apply.
Without a scaffold, the next real feature has nowhere to land a browser client,
and there is no web CI job to catch regressions.

## Non-goals

- **OpenAPI / backend / mobile product changes** — consume the existing
  `GET /api/greeting` only; no contract edits (avoids a forced mobile client
  update in this PR).
- **OpenAPI codegen** — hand-written client under `web/src/api/` (same spirit as
  Ktor in `sharedLogic`); codegen is a follow-up.
- **Cross-platform design-token sync** with Compose/SwiftUI — document the intent
  in architecture; do not implement shared tokens or restyle mobile in this pass.
- **Auth, routing beyond a single harness page, persistence, deploy/hosting.**
- **Playwright e2e** — Vitest + Testing Library cover the greeting flow with a
  mocked API client; browser e2e is a follow-up once a real product flow exists.
- **Vue / other frameworks** — React only; lock the AGENTS.md `[React/Vue]` TBD.
- **Pixel-perfect marketing UI** — solid defaults via Tailwind + shadcn-style
  components; greeting harness only (disposable, like mobile).

## Approach

Scaffold `web/` as a **Vite + React + TypeScript** app with **Tailwind CSS** and
**shadcn/ui**-style components for a polished default look with little custom
CSS. Add a hand-written API client in `web/src/api/` that calls
`GET /api/greeting` per `contracts/openapi.yaml` (base URL configurable for local
backend `http://localhost:8080`). Single harness page: name input (or fixed
demo name), fetch greeting, show loading / error / success (message must be able
to include `from a Spring Modulith module.` when hitting a real backend).

Add `.github/workflows/web.yml` path-filtered on `web/**` (and the workflow
file): install, lint, unit test, and production build on `ubuntu-latest`. Update
`docs/architecture.md`, `AGENTS.md`, `.cursor/rules/web.mdc`, and README so web
is a first-class consumer and CI follow-ups no longer list “web CI” as missing.

No OpenAPI changes.

## Acceptance criteria

- [x] `web/` exists as a Vite + React + TypeScript app; `npm` (or project-chosen
      package manager) scripts for `dev`, `build`, `lint`, and `test` work.
- [x] Tailwind + a small set of shadcn-style UI primitives are in place; the
      harness page is not unstyled browser defaults.
- [x] `web/src/api/` holds the greeting client; no ad-hoc `fetch` to backend
      endpoints outside that client.
- [x] Harness UI shows loading, error, and success states for the greeting call
      (success path tested with a mock; manual smoke against `bootRun` optional
      but documented).
- [x] Component/unit tests (Vitest + Testing Library) cover the greeting flow
      enough that reverting the client or state handling fails a test.
- [x] `.github/workflows/web.yml` runs on PR + push to `main` when `web/**` (or
      the workflow) changes: install, lint, test, build on `ubuntu-latest`.
- [x] Docs/rules updated: AGENTS.md picks React; architecture lists web as a
      consumer + web CI; `.cursor/rules/web.mdc` FILL INs replaced with real
      conventions; README status no longer says web is the missing scaffold only.
- [x] No changes to `contracts/openapi.yaml`, backend modules, or mobile apps.

## Tasks

- [x] **Web:** Scaffold Vite + React + TS in `web/` (package manager lockfile
      committed); Tailwind + shadcn-style setup; env/base URL for API.
- [x] **Web:** Hand-written greeting client in `web/src/api/` + harness page with
      loading/error/success.
- [x] **Tests:** Vitest + Testing Library for harness/client behavior.
- [x] **CI:** Add `.github/workflows/web.yml` (path filters, Node LTS, lint +
      test + build).
- [x] **Docs:** Update `AGENTS.md`, `docs/architecture.md`, `README.md`, and
      `.cursor/rules/web.mdc` for React web + CI; note design-token sync as a
      follow-up for cross-client look consistency.
- [x] **Verify:** Local `lint`/`test`/`build` green; actionlint or structural
      check on `web.yml`; remind operator that a live green Actions run needs the
      PR push.

## Verification notes

- `cd web && npm run lint && npm test && npm run build` — all green (8 tests).
- **actionlint** on `.github/workflows/web.yml` — no findings.
- 10 acceptance dry-read checks passed; no `contracts/` / `backend/` / `mobile/`
  diffs vs `main`.
- **Operator:** open/merge the PR; live green `web` Actions run happens on the PR / merge to `main`.

## Open questions

None — stack and scope agreed: React + Vite + TS + Tailwind/shadcn, consume
existing greeting only, web CI in this spec, no OpenAPI/mobile/backend changes,
Playwright and cross-platform tokens deferred.
