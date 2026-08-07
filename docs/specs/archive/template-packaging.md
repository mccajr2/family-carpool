# Spec: template-packaging

Status: done
Created: 2026-07-11
Completed: 2026-07-11
Parent: [docs/roadmap.md](../roadmap.md)

## Problem

quickapp is meant to be a reusable starter, but the README still reads like
“clone and build a product here.” There is no explicit packaging path (GitHub
Template), no rename identity checklist, and no clear “keep vs delete greeting”
procedure for a fresh app repo. Without that, each new product risks inheriting
demo identity and unclear next steps.

## Non-goals

- **Cookiecutter / Copier** variable substitution — document manual rename first;
  automate after it hurts twice.
- **Deleting the greeting harness** from this template — keep it as day-one smoke
  proof; document how to remove it after the first real feature.
- **OpenAPI codegen, design tokens, iOS CI, auth/Postgres** — separate infra specs.
- **Building a sample product** on top of this repo.

## Approach

Document and wire **path 1 (package as template)**:

1. Mark the GitHub repo as a **template repository** (operator/`gh`).
2. Rewrite README “start a new app” around **Use this template** + smoke test +
   `/roadmap`.
3. Add `docs/using-as-template.md` with: clone/template steps, identity rename
   checklist (backend `com.yourorg.quickapp`, mobile `org.example.project`,
   display names), greeting deletion checklist, branch/CI operator notes.
4. Point architecture / AGENTS / roadmap at “this repo is the template, not an
   app.”

No OpenAPI, backend, mobile, or web product code changes except docs.

## Acceptance criteria

- [x] GitHub repo is (or is documented how to be) a template repository.
- [x] README has a clear “Start a new app from this template” section.
- [x] `docs/using-as-template.md` covers rename checklist + greeting removal +
      post-clone workflow (`/roadmap` / `/spec`).
- [x] AGENTS.md / architecture / roadmap state this is a starter template, not a
      product codebase.
- [x] Greeting harness remains; deletion is documented, not performed.
- [x] No cookiecutter tooling added.

## Tasks

- [x] **Docs:** Add `docs/using-as-template.md`.
- [x] **Docs:** Update README, AGENTS.md, architecture.md, roadmap.md.
- [x] **Operator:** Enable GitHub template flag (`gh repo edit --template`) or
      document Settings steps if the API fails.
- [x] **Verify:** Structural checks; remind operator to confirm Template badge on
      GitHub.

## Verification notes

- `gh repo view` → `isTemplate: true` for `https://github.com/mccajr2/quickapp`.
- Greeting harness intentionally retained.
- Structural doc checks run in the packaging PR.
