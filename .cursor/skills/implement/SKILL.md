---
name: implement
description: Implement the next unchecked task(s) from an active spec.
disable-model-invocation: true
---
Implement the next unchecked task(s) from an active spec.

Argument: feature name matching a file in `docs/specs/active/`

Steps:
1. Confirm you are on the feature branch for this spec (branch name should match
   `<feature-name>`, or otherwise clearly belong to it — not `main`). If on
   `main`, stop and create/switch to the feature branch before changing files.
2. Read `docs/specs/active/<feature-name>.md` in full — Problem, Non-goals, and
   Acceptance Criteria constrain every task below, not just the task text itself.
3. Create a git checkpoint commit before starting:
   `git add -A && git commit -m "checkpoint: before <feature-name>"`.
4. Take the NEXT unchecked task in the Tasks list — one task, not the whole list —
   and implement it fully, including its test, per the rules in `.cursor/rules/`
   for whichever layer it touches.
5. Run the relevant test suite for that layer. If it fails, fix it before moving on
   — don't check the box on a failing test.
6. Check the task off in the spec file.
7. Stop and report: what changed, what you tested, what's next. Wait for me before
   continuing to the next task, unless I've told you to run through the whole list
   unattended.
8. If a task turns out to be bigger or more ambiguous than the spec implies, stop
   and flag it rather than improvising scope — this usually means the spec needs
   a quick edit, not a bigger diff. If the **whole spec** is too big for one PR,
   stop implementing: narrow via amend, or abandon and `/roadmap` split
   (`re-rank split`) — do not silently expand the active spec.
9. When all tasks and acceptance criteria are done, remind me to run `/pr` (do not
   merge to `main` directly).
