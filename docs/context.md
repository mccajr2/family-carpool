# Agent context map

Read this file when you need to **find** a document. Do not load it on every
task, and do not treat it as a substitute for the active spec.

Implementation load order: active spec → its **Context** paths → those source
files. Skip everything else.

## Current work

| Need | Open |
|------|------|
| What to implement now | The single file in `docs/specs/active/` |
| What's next / re-rank | `docs/roadmap.md` (Upcoming + Active + Parking; skip **Roadmap history**) |
| How to write a spec | `docs/specs/_template.md` + `/spec` |
| How to implement / PR | `.cursor/skills/implement`, `.cursor/skills/pr` |

## Project knowledge (on demand)

Open the **section**, not the whole file, unless the spec says otherwise.

| Topic | File |
|-------|------|
| Locked product/engineering decisions | `docs/architecture.md` — jump via its Contents |
| UI tokens, mocks, WCAG, icons | `docs/ui-system.md` |
| Agenda coverage / RSVP / conflict chrome (web) | `docs/agenda-coverage-web-contract.md` |
| Agenda list layout constraints (wrap, no truncate) | `docs/agenda-full-redesign-addendum.md` |
| Focus card layout notes | `docs/agenda-focus-card-addendum.md` |
| OpenAPI | `contracts/openapi.yaml` |
| Token source | `design-tokens/tokens.json` |
| Human smoke / how to run | `README.md` |
| Upstream template leftover | `docs/using-as-template.md` |

### `docs/architecture.md` headings

Auth · Family circle · Interaction UX · Repository layout · SDD workflow ·
Cross-stack request flow · Backend · Mobile · Contract-first API · Testing ·
Git/CI · Not built yet · Adding a feature · Conventions

## Historical (do not search by default)

Archived specs stay in `docs/specs/archive/` as history. They are excluded from
normal codebase search (`.cursorindexingignore`). Open a **specific** archive
file only when the active spec's Context names it, or the user asks.

Planned stubs stay searchable: `docs/specs/planned/<id>.md`.

## Conversation phases (solo)

Start a **new chat** when the phase changes. Reconstruct from the repo.

1. **Spec** — `/spec` or spec edits. Ends when the spec is approved.
2. **Implement** — `/implement` (one task, or the whole list if asked). Ends
   when tasks + AC are checked, or when you need a review.
3. **Review / PR** — `/pr` or a review pass. Reconstruct from the spec +
   `git diff`. Do not paste the implement transcript.
4. **Closeout** — leftover docs/roadmap notes if `/pr` did not cover them.

A long implement chat that is still on the same spec is fine. Do not keep
using it for the next spec or for `/roadmap`.

## Model choice (cost per successful task)

Stronger / higher-reasoning: `/spec`, architecture, ambiguous requirements,
hard debugging, cross-layer (contract + backend + clients), design trade-offs.

Faster / cheaper: locating files, mechanical UI/token wiring, checklist
updates, running/fixing straightforward tests, `/pr` once the diff is known,
routine transformations.

Default to the cheaper model unless the task is one of the stronger-reasoning
cases above. Do not optimize for the lowest token cost if it will thrash.
