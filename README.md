# family-carpool

Family scheduling and carpool app — built from the quickapp SDD starter.

| Layer | Stack |
|-------|--------|
| Backend | Java 25, Spring Boot 4.1, Spring Modulith (`auth` module) |
| Mobile | Kotlin Multiplatform — shared logic, Android (Compose) + iOS (SwiftUI) |
| Web | Vite + React + TypeScript + Tailwind (shadcn-style UI) |
| Contract | OpenAPI (`contracts/openapi.yaml`) |
| Workflow | `/roadmap` → `/spec` → `/implement` → `/pr` → merge |

First product slice: **email OTP + Bearer session auth** on web, Android, and iOS.
The disposable greeting harness has been removed.

## Quick start (auth smoke)

Requires **Postgres** (local Docker or Neon). Defaults:

- URL `jdbc:postgresql://localhost:5432/family_carpool`
- User/password `family_carpool` / `family_carpool`

```bash
# Backend (repo root) — leave running
./gradlew :backend:bootRun

# Request a sign-in code (dev echoes the OTP in the JSON body + server log)
curl -s -X POST http://localhost:8080/api/auth/request-code \
  -H 'Content-Type: application/json' \
  -d '{"email":"parent@example.com"}'

# Verify (use devCode from the response when AUTH_DEV_CODE_ECHO=true)
curl -s -X POST http://localhost:8080/api/auth/verify-code \
  -H 'Content-Type: application/json' \
  -d '{"email":"parent@example.com","code":"123456"}'
```

**Web:**

```bash
cd web
npm ci                 # Node ^22.22.2 || ^24.15 || >=26; CI uses web/.nvmrc + packageManager
npm run dev
```

Open the app → enter email → Send code → Verify → Sign out.

**Android:** open `mobile/` in Android Studio → run `androidApp` on an emulator
(backend on host; emulator uses `10.0.2.2:8080`).

**iOS:** open `mobile/iosApp/iosApp.xcodeproj` in Xcode → run on a simulator.

Set `AUTH_DEV_CODE_ECHO=false` for production-shaped configs (no plaintext OTP in
responses). Real SMTP is Upcoming `auth-email-delivery`.

## Docs

| Doc | Purpose |
|-----|---------|
| [AGENTS.md](AGENTS.md) | Constitution for humans and coding agents |
| [docs/roadmap.md](docs/roadmap.md) | Product backlog — carve-up, re-rank, Next up |
| [docs/architecture.md](docs/architecture.md) | SDD workflow, auth decisions, how to add features |
| [docs/specs/](docs/specs/) | Planned stubs, active, and archived feature specs |
| [contracts/openapi.yaml](contracts/openapi.yaml) | API source of truth |
| [docs/using-as-template.md](docs/using-as-template.md) | Upstream template notes (this repo already deleted greeting) |

## Tests

```bash
# Backend (needs Docker for Testcontainers Postgres)
./gradlew :backend:test

# Mobile (from mobile/) — needs Android SDK; local.properties auto-generated
cd mobile
./gradlew :sharedLogic:testAndroidHostTest :androidApp:assembleDebug

# Web (from web/)
cd web
npm test
```

## Status

Active product: family calendar + carpool roadmap; `adult-auth-magic-link` is
done (this PR). `main` is PR-protected. Next up: `adult-optional-password`.
Pre-beta gates later: `auth-email-delivery`, `web-auth-session-hardening`.
