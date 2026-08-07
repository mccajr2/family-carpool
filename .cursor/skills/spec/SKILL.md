---
name: spec
description: Create a new feature spec (one PR-sized slice).
disable-model-invocation: true
---
Create a new feature spec (one PR-sized slice).

Argument: feature name (kebab-case), e.g. `add-password-reset`  
If omitted, use **Next up** (rank 1) from `docs/roadmap.md` Upcoming table when
present.

Steps:
1. **Size / mega-spec guard.** If the ask is clearly larger than one PR (multiple
   independent capabilities, or AC cannot be made concrete without a backlog):
   stop and redirect to `/roadmap`. Do not write a mega-spec. If a roadmap item
   already exists, say which id to flesh out first (rank 1).
2. Ensure `main` is up to date (`git checkout main && git pull --ff-only`). Create
   and check out a feature branch named after the argument (same kebab-case name,
   e.g. `add-password-reset`). Do not write the spec on `main`.
3. If `docs/specs/planned/<feature-name>.md` exists, **promote** it: move to
   `docs/specs/active/<feature-name>.md` and expand it (do not discard Problem /
   Non-goals sketches). Otherwise copy `docs/specs/_template.md` to
   `docs/specs/active/<feature-name>.md`.
4. Set `Parent: docs/roadmap.md` on the spec when this id appears on the roadmap
   (or when the user is working from the product roadmap).
5. Ask clarifying questions ONE AT A TIME if the feature request is ambiguous —
   specifically about: what's explicitly out of scope, whether this touches the
   OpenAPI contract, and what "done" looks like. Do not proceed to writing full
   acceptance criteria until scope is clear enough for real (not vague) criteria.
6. Fill in Problem, Non-goals, Approach, Acceptance Criteria, and a Tasks checklist
   broken down by layer (backend/contract/web/iOS/tests) — omit layers this feature
   doesn't touch.
7. **Split if too big (while fleshing out).** If full AC/tasks reveal multiple
   independent shippable capabilities (or the task list no longer fits one PR):
   - Stop — do not publish a mega-spec for approval.
   - Hand off to `/roadmap`: split into 2+ ids with **Added** `re-rank split`,
     re-rank, leave thin `planned/` stubs for the remainder.
   - Keep only the first slice on this branch as `active/<id>.md` (rename id if
     needed to match the surviving roadmap row); demote the rest to `planned`.
   - Update `docs/roadmap.md` Active/Upcoming accordingly, then show the narrowed
     spec for approval (or wait for the user to confirm the split first).
8. Update `docs/roadmap.md`: set this id’s status to `active`; add/update the
   **Active specs** row (branch + link). Do not re-rank other items unless the
   user also asked for a re-rank via `/roadmap` (or step 7 required a split).
9. Do NOT start implementing. Stop after the spec is written and show it to me for
   approval before any code changes.
