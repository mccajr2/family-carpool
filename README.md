# quickapp

**Spec-driven starter template** for full-stack products. Use this repository as a
GitHub **Template** to spin up a new app — do not build the product inside this
copy.

| Layer | Stack |
|-------|--------|
| Backend | Java 25, Spring Boot 4.1, Spring Modulith (vertical modules) |
| Mobile | Kotlin Multiplatform — shared logic, Android (Compose) + iOS (SwiftUI) |
| Web | Vite + React + TypeScript + Tailwind (shadcn-style UI) |
| Contract | OpenAPI (`contracts/openapi.yaml`) |
| Workflow | `/roadmap` → `/spec` → `/implement` → `/pr` → merge |

The `greeting` module and demo UI are **disposable harnesses** that prove the
cross-stack path works. Real features get their own Modulith modules and specs
in the **new** app repo.

## Start a new app from this template

1. On GitHub: **Use this template** → create your app repository  
   (details: [docs/using-as-template.md](docs/using-as-template.md)).
2. Clone **that** repo; run the harness smoke test (backend + web at minimum).
3. Rename demo identity when ready (checklist in the doc above).
4. Fill `docs/roadmap.md` and run `/roadmap` (or `/spec` for one slice).
5. After your first real feature is shipping, delete the greeting harness
   (checklist in the same doc).

## Quick start (harness smoke test)

```bash
# Backend (repo root) — leave running
./gradlew :backend:bootRun

# Verify API
curl "http://localhost:8080/api/greeting?name=Android"
```

**Android:** open `mobile/` in Android Studio → run `androidApp` on an emulator.

**iOS:** open `mobile/iosApp/iosApp.xcodeproj` in Xcode → run on a simulator.

**Web:**

```bash
cd web
npm ci                 # Node >=20 locally; CI uses web/.nvmrc + packageManager
npm run dev
```

Success looks like a greeting ending in `from a Spring Modulith module.` (proves a
real HTTP round-trip).

## Docs

| Doc | Purpose |
|-----|---------|
| [AGENTS.md](AGENTS.md) | Constitution for humans and coding agents |
| [docs/using-as-template.md](docs/using-as-template.md) | Template → new app, rename, delete greeting |
| [docs/roadmap.md](docs/roadmap.md) | Product backlog — carve-up, re-rank, Next up |
| [docs/architecture.md](docs/architecture.md) | SDD workflow, module patterns, how to add features |
| [docs/specs/](docs/specs/) | Planned stubs, active, and archived feature specs |
| [contracts/openapi.yaml](contracts/openapi.yaml) | API source of truth |

## Tests

```bash
# Backend
./gradlew :backend:test

# Mobile (from mobile/) — needs Android SDK installed; local.properties is
# auto-generated from ANDROID_HOME or the default SDK path (see docs/using-as-template.md)
cd mobile
./gradlew :sharedLogic:testAndroidHostTest :androidApp:assembleDebug

# Web (from web/)
cd web
npm test
```

## Status

Verified starter: Modulith backend, KMP sharedLogic, cross-stack networking,
path-filtered CI (backend / mobile / web), React web harness, pinned web
toolchain, and `/roadmap` workflow. `main` is PR-protected.

This repo stays a **clean template**. Product work happens in repos created from
it. Optional follow-ups for the template itself: web OpenAPI codegen, contract
lint, shared design tokens, iOS CI.
