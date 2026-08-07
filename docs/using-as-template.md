# Using quickapp as a template

This repository is a **spec-driven starter**, not a product. Create a **new GitHub
repo from the template** for each real app; leave this copy clean.

## Create a new app repo

1. On GitHub: **Use this template** → create a new repository  
   (or: `gh repo create <org>/<new-app> --template <owner>/quickapp --private`)
2. Clone the **new** repo (not a long-lived fork of quickapp).
3. Confirm CI workflows exist under `.github/workflows/` and `main` is protected
   (require PR; optionally require `backend` / `mobile` / `web` checks).
4. Smoke-test the harness (below), then start product work with `/roadmap` or
   `/spec`.

### Smoke test (keep greeting until this passes)

```bash
# Backend
./gradlew :backend:bootRun
curl "http://localhost:8080/api/greeting?name=Android"

# Web (separate terminal) — Node >=20 locally; CI uses .nvmrc + packageManager
cd web && npm ci && npm run dev
# open http://127.0.0.1:5173/ → Fetch greeting
```

Success: greeting text includes `from a Spring Modulith module.`

### Mobile (Android SDK required)

Install Android Studio (or the command-line SDK). On a fresh clone, mobile Gradle
auto-detects the SDK from `ANDROID_HOME` / `ANDROID_SDK_ROOT`, or from the default
install path (`~/Library/Android/sdk` on macOS, `~/Android/Sdk` on Linux) and
writes gitignored `mobile/local.properties`.

Only set the SDK location manually if yours is non-standard:

```bash
export ANDROID_HOME="/path/to/Android/sdk"
# or create mobile/local.properties with sdk.dir=... (never commit it)
```

Then:

```bash
cd mobile
./gradlew :sharedLogic:testAndroidHostTest :androidApp:assembleDebug
```

Run iOS once in Xcode if that client matters for the new app.

## Identity rename checklist

Replace demo identity before shipping or publishing clients. Search the new repo
for these strings and update consistently:

| Area | Find | Replace with |
|------|------|----------------|
| Backend Maven/Gradle group | `com.yourorg.quickapp` | your org + app group |
| Backend Java packages | `com.yourorg.quickapp` | matching package path |
| Android `namespace` / `applicationId` | `org.example.project` | your application id |
| KMP `sharedLogic` / `sharedUI` namespaces | `org.example.project.*` | matching ids |
| iOS bundle / display name | Xcode project + `Info.plist` | your app name |
| Repo / product name in docs | `quickapp` | your product name |
| OpenAPI `info.title` | `Quickapp API` | your API title |
| Web `index.html` title / harness copy | `quickapp` | your product name |

After renames: `./gradlew :backend:test`, mobile host tests / `assembleDebug`
(Android SDK — see above), `cd web && npm test && npm run build`.

Automation (cookiecutter/Copier) is intentionally deferred until manual rename
hurts twice.

## Delete the greeting harness (after first real feature)

Keep `greeting` until the new app has its own vertical slice and you no longer
need the cross-stack smoke demo. Then:

1. Remove `backend/modules/greeting/`.
2. Remove greeting API usage from mobile (`sharedLogic` client + UI) and web
   (`web/src/api` + harness page).
3. Trim or replace `contracts/openapi.yaml` greeting path (update **web and
   mobile** in the same change per AGENTS.md).
4. Delete obsolete tests; keep `ModularityTests`.
5. Update README quick start to the real feature’s smoke path.
6. `/pr` as usual.

## Product workflow on the new repo

1. Edit `docs/roadmap.md` — Vision, non-goals, first carve-up via `/roadmap`.
2. `/spec` on **Next up** (rank 1) — one PR-sized slice.
3. `/implement` → `/pr` → merge.
4. Do not land product features on the upstream **quickapp** template repo.

## Operator notes (template maintainers)

On the **quickapp** template repository itself:

- Enable **Template repository** (GitHub → Settings → General → Template
  repository, or `gh repo edit --template`).
- Keep `docs/specs/active/` empty on `main` between packaging PRs.
- Prefer improving the template from pain cloning into real apps — not by
  building a sample product into this repo.
