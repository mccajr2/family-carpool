---
name: roadmap
description: Maintain the product roadmap and break large ideas into ranked spec slices.
disable-model-invocation: true
---
Maintain the product roadmap and break large ideas into ranked spec slices.

Argument (optional): free-text product idea, “re-rank”, “what’s next?”, or a
new enhancement to add.

## Source of truth

- Single file: `docs/roadmap.md` (create from the structure in-repo if missing).
- Each backlog **id** (kebab-case) maps **1:1** to a spec when it exists:
  `docs/specs/planned|active|archive/<id>.md`.

## Size check (do this first)

If the ask is clearly **one PR-sized slice** (real acceptance criteria + a short
task list, one vertical cut):

1. Say so: this fits a single spec — do not invent a multi-item backlog.
2. Offer to run `/spec <id>` immediately (or run it if the user confirms).
3. Optionally add one row under Done/Upcoming for traceability — do not force
   decomposition.

If the ask is large, multi-capability, or sequencing is unclear → full roadmap
flow below.

## Split if too big (stub or planned item grew)

A stub may stay vague; a slice that needs full AC/tasks must stay **one PR**.

If while carving up, editing a `planned/` stub, or reviewing Upcoming you see an
item that is clearly multiple shippable capabilities:

1. Stop — do not fatten one id into a mega-spec.
2. **Split** into 2+ kebab-case ids (vertical slices).
3. Set each new/kept row’s **Added** to `YYYY-MM-DD · re-rank split` (or keep
   `initial`/`enhancement` on the surviving first slice if it was already
   provenance-tagged — new siblings use `re-rank split`).
4. Re-rank **Upcoming**; rank **1** = the first slice to `/spec` next.
5. Replace or trim the oversized stub; add thin stubs for the new ids under
   `docs/specs/planned/` as needed.
6. History line if the split is notable.
7. Stop and report the new Next up.

If the oversized item is already **`active`**, use Conflict rules (finish /
amend down / abandon) — do not split an in-progress spec from `/roadmap`
without the user picking a path.

## Modes

### A. Initial carve-up / add ideas

1. Read `docs/roadmap.md` and any `docs/specs/active/*.md` (conflict check).
2. Ask clarifying questions **ONE AT A TIME** only as needed (users, must-haves,
   hard non-goals, sequencing constraints).
3. Update Vision / Product non-goals if empty or stale.
4. Add or adjust backlog rows:
   - Prefer vertical slices (user-visible capability), not “all backend”.
   - Set **Added** to `YYYY-MM-DD · initial` (first carve-up) or `enhancement`
     (later idea) or `re-rank split` (one item became two).
   - Status `planned` when ranked; `parking` when unranked.
5. Optionally create thin stubs in `docs/specs/planned/<id>.md` from
   `docs/specs/planned/_stub-template.md` (Problem + Non-goals sketch only —
   no full AC/tasks).
6. Produce a ranked **Upcoming** table. Rank **1** = Next up.
7. Append a line under **Roadmap history** only for notable events (first
   carve-up, major re-rank).
8. Stop. Do **not** write a full `/spec` or start implementing. Show the
   roadmap diff and state Next up.

### B. Re-rank

Triggers: user says re-rank / what’s next / changes priority / adds an idea /
an active spec was archived.

1. Read roadmap + active specs.
2. **Do not re-rank or rewrite `active` / in-progress items.** Those are locked.
3. If a requested change **conflicts** with an active spec, stop and present
   options — do not silently reshape current work:
   - (a) Finish the active slice as-is, then apply roadmap change
   - (b) Amend the active spec (small AC/non-goal delta, same branch)
   - (c) Abandon/cancel the active spec, then re-rank
4. Reorder **Upcoming** (`planned` / promote from parking). Refresh ranks 1…n
   with a one-line rationale for the new order.
5. Leave **Parking lot** unranked unless promoting items.
6. History line only if the re-rank is major.
7. Stop and report Next up.

### C. After a spec completes

When the user notes a spec was archived (or you see it during `/roadmap`):

1. Move the item to **Done** (id, date, link to `specs/archive/<id>.md`).
2. Remove from Upcoming / Active.
3. Offer re-rank for remaining **planned** items.

## Conflict rules (active specs)

- Roadmap updates may change only `parking` / `planned` / parking-lot text.
- Never silently change scope of `docs/specs/active/<id>.md` from `/roadmap`.
- Record “blocked by …” or “superseded by …” on the roadmap row only after the
  user picks amend/abandon/finish.

## Output rules

- Keep `docs/roadmap.md` as the only product roadmap file.
- Do not create `docs/roadmaps/` multi-file trees.
- Do not implement code in this command.
- Prefer editing the existing roadmap in place on a feature branch if the user
  is already on one; otherwise use a short-lived branch (e.g. `roadmap-update`)
  and remind them to PR (roadmap-only changes still need a PR while `main` is
  protected).
