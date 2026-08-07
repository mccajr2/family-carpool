# Spec: path-filtered-ci

Status: done
Created: 2026-07-10
Completed: 2026-07-10

## Problem

The stack has three verified checkpoints (Modulith backend, KMP sharedLogic, cross-stack
networking) and automated tests, but `.github/workflows/` is empty. Nothing runs on
push or PR, so regressions can land on `main` unnoticed. AGENTS.md and
`docs/architecture.md` already assume path-filtered GitHub Actions; that plumbing is
the next infrastructure gap before web or a real feature.

## Non-goals

- **iOS CI** — no `macos-latest` / `xcodebuild` / `:sharedLogic:iosSimulatorArm64Test`
  in this pass. Linux covers backend + Android host tests + `assembleDebug`.
- **Web CI** — `web/` does not exist yet; add a job when the web scaffold lands.
- **Contract validation** (Spectral, OpenAPI diff) — deferred until web or codegen
  exists (see `docs/architecture.md`).
- **Deploy / hosting** — no Render deploy, no release publishing.
- **Branch protection as code** — enabling “require PRs / block force-push” is a
  GitHub settings step after the first successful workflow run; document it, don’t
  automate it in this spec.
- **OpenAPI / backend / mobile product code** — CI only; no contract or app changes.
- **Caching perfection / matrix builds** — simple, reliable jobs first.

## Approach

Add two path-filtered GitHub Actions workflows under `.github/workflows/`:

1. **`backend.yml`** — triggers on `pull_request` and `push` to `main` when
   `backend/**`, `build-logic/**`, `gradle/**`, root `settings.gradle.kts` /
   `build.gradle.kts` / `gradlew*`, or the workflow file itself change. Runs
   `./gradlew :backend:test` on `ubuntu-latest` with a JDK matching the project
   (Java 25).

2. **`mobile.yml`** — triggers on `pull_request` and `push` to `main` when
   `mobile/**` or the workflow file itself change. Runs from `mobile/`:
   `./gradlew :sharedLogic:testAndroidHostTest :androidApp:assembleDebug`
   on `ubuntu-latest` with JDK + Android SDK as required by the KMP/Android build.

Document a short **operator setup** section in the spec (or a note in
`docs/architecture.md`): push current `main` to origin once, then enable branch
protection (require PR, no force-push / no delete on `main`, optionally require the
new status checks once they exist).

No OpenAPI changes.

## Acceptance criteria

- [x] `.github/workflows/backend.yml` exists and runs `:backend:test` on
      `ubuntu-latest` for PRs and pushes to `main` when backend-related paths change.
- [x] `.github/workflows/mobile.yml` exists and runs
      `:sharedLogic:testAndroidHostTest` and `:androidApp:assembleDebug` on
      `ubuntu-latest` for PRs and pushes to `main` when `mobile/**` changes.
- [x] A docs-only or unrelated-path change does not start the irrelevant workflow
      (path filters work as configured).
- [x] Workflows use checked-in Gradle wrappers; no inventing undeclared CI-only
      dependencies beyond Actions (`actions/checkout`, `actions/setup-java`, and
      Android setup as needed).
- [x] `docs/architecture.md` “Not built yet” / CI section updated to reflect that
      path-filtered PR + `main` CI exists; iOS/web/contract lint still listed as
      follow-ups.
- [x] Spec notes (or architecture) include the manual steps: push `main` to remote,
      then protect `main` (PR required, no force-push/delete).

## Tasks

- [x] **CI:** Add `.github/workflows/backend.yml` (path filters, JDK 25, `:backend:test`).
- [x] **CI:** Add `.github/workflows/mobile.yml` (path filters, JDK + Android SDK,
      sharedLogic Android host tests + `assembleDebug`).
- [x] **Docs:** Update `docs/architecture.md` — CI present; remaining gaps; operator
      setup for remote + branch protection.
- [x] **Verify:** Confirm workflow YAML is valid (actionlint if available, or dry-read
      against GitHub Actions schema / local sanity). Note that a live green run on
      GitHub requires the remote push (operator step).

## Verification notes

- **actionlint v1.7.12** — no findings on `.github/workflows/backend.yml` or
  `mobile.yml` (one-shot download; not added as a repo dependency).
- **Local command parity** — `./gradlew :backend:test` and
  `cd mobile && ./gradlew :sharedLogic:testAndroidHostTest :androidApp:assembleDebug`
  both succeeded during implementation.
- **Acceptance dry-read** — 23 structural checks covering path filters, allowed
  Actions, architecture CI/operator docs, and task commands all passed.
- **Still operator-side** — after push, confirm green workflow runs on GitHub, then
  apply classic branch protection on `main` (see Operator setup).

## Operator setup (manual, after merge)

1. Push current `main` to `origin` to establish the remote baseline.
2. In GitHub → Settings → Branches → protect `main`:
   - Require a pull request before merging
   - Do not allow force pushes
   - Do not allow deletions
   - After the workflows have run at least once: optionally require status checks
     `backend` / `mobile` (exact job names as defined in the YAML).
3. Subsequent work lands via PRs; CI runs on the PR and again on push to `main`
   after merge.

## Open questions

None — scope agreed: Linux-only, PR + push to `main`, path-filtered, no iOS/web/
contract lint in this pass.
