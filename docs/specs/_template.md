# Spec: [feature name]

Status: draft | in-progress | done
Created: [date]
Parent: [docs/roadmap.md](../roadmap.md) — omit only for infra one-offs with no roadmap row

## Problem

[1-3 sentences: what's missing or broken, why it matters. Not a restatement of the
task title.]

## Non-goals

[What this explicitly does NOT cover — the most common source of scope creep in
AI-implemented features is skipping this section.]

## Approach

[2-6 sentences on the shape of the solution. Which modules/layers touched. Any
contract (OpenAPI) changes, called out explicitly.]

## Context

Allowlist for `/implement`. Paths and **headings**, not whole-doc dumps.

- Design: [e.g. `docs/ui-system.md`]
- Architecture: [e.g. `docs/architecture.md` → Family circle / Coverage]
- Source: [entry-point files]

Do not list `docs/roadmap.md` or the entire architecture file. Cite an archived
spec only when this slice must reuse that decision.

## Acceptance criteria

- [ ] [Testable statement, not a vague goal. "Returns 409 when X" not "handles errors well."]
- [ ]
- [ ]

## Tasks

- [ ] Backend: [specific change]
- [ ] Contract: [OpenAPI update, if any]
- [ ] Web: [specific change]
- [ ] iOS: [specific change]
- [ ] Tests: [what needs coverage beyond the inline task-level tests]

## Open questions

[Anything you're not sure about yet — resolve before implementation starts, or
mark as a deliberate risk you're accepting.]
