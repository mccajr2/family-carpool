# AGENTS.md — family-carpool

Constitution for this product repo. Change only when an architectural
decision changes, not per feature. Layer detail lives in `.cursor/rules/`.
Doc map: `docs/context.md`.

## What this is

**family-carpool** is a family scheduling and carpool app (web + Android + iOS)
on a Spring Modulith backend. Created from the quickapp SDD starter; this clone
is the product, not the upstream template. Template notes (greeting already
gone): `docs/using-as-template.md`.

## Stack

- Backend: Java 25, Spring Boot 4.1, Gradle (Kotlin DSL), Spring Modulith
  vertical modules under `backend/modules/*` (auto-discovered).
- Mobile: KMP `mobile/sharedLogic` → Android Compose + iOS SwiftUI. Separate
  Gradle build from backend. Shared only via `contracts/openapi.yaml`.
- Web: Vite + React + TypeScript + Tailwind (`web/`, npm). Hand-written
  clients in `web/src/api/` stay aligned with the OpenAPI contract.
- CI: GitHub Actions, path-filtered. Hosting: Render, Neon, UptimeRobot.

## Non-negotiables

- One active spec → one feature branch → one PR. `main` is PR-protected.
- Never change `contracts/openapi.yaml` without updating web **and** mobile
  clients in the same change.
- No placeholder implementations. If you can't finish, stop and say so.
- Don't invent a dependency. Check the layer's lockfile / catalog first; ask
  before adding one.
- Tests: `.cursor/rules/testing.mdc`. Backend modules:
  `.cursor/rules/backend.mdc` (`ModularityTests` must pass).
- Visual restyles: `.cursor/rules/visual-source.mdc`.

## Specs and context loading

Current task = the single file in `docs/specs/active/` (also listed under
Active specs in `docs/roadmap.md`).

On implementation work:

1. Read that active spec in full (Problem, Non-goals, Context, AC, Tasks).
2. Read **only** paths in the spec's **Context** section, plus the source
   those paths name.
3. Citations in Problem/Non-goals are hints — open those files only if the
   current task needs that prior decision.
4. Do **not** read `docs/roadmap.md`, `docs/architecture.md`,
   `docs/using-as-template.md`, `docs/specs/planned/`, or
   `docs/specs/archive/` unless the Context section (or the user) names a
   specific file or heading.
5. Lost? Read `docs/context.md` (short index), then only the cited file.

`/roadmap` reads the roadmap (skip **Roadmap history** unless asked).
`/spec` fleshes out one slice. `/implement` takes the next unchecked task.
`/pr` archives the spec and opens the PR.

## Conversation scope

The repo is memory, not the chat. Prefer a new conversation per phase
(spec → implement → review/`/pr`). Reconstruct from the active spec,
Context paths, and git diff — do not require the previous transcript.

## Conventions

Add an entry here only after the same mistake happens twice.
