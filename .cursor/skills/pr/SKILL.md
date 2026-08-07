---
name: pr
description: Open a pull request for the current changes.
disable-model-invocation: true
---
Open a pull request for the current changes.

Steps:
1. Confirm you are not on `main`. If you are, stop — create/switch to the feature
   branch first. Prefer a branch named after the active/archived spec (kebab-case).
2. Run `git diff` and `git diff --staged` to see everything changed.
3. Confirm all relevant tests pass (per the layer(s) touched — see
   `.cursor/rules/backend.mdc` / `web.mdc` / `ios.mdc` for the right command).
   Do not proceed if something fails; report it instead.
4. Write a clear commit message: what changed and why, referencing the spec file
   if one exists (`docs/specs/active/<feature>.md`).
5. Commit and push to the current branch (`git push -u origin HEAD` if needed).
6. If the spec for this feature is fully checked off, move it from
   `docs/specs/active/` to `docs/specs/archive/` in the same commit. If
   `docs/roadmap.md` lists this id, mark it **done**, remove it from Active /
   Upcoming, and link the archive path under Done.
7. Open the PR with `gh pr create` (base `main`), using the spec's
   Problem/Acceptance Criteria sections as the PR description if a spec exists.
8. Return the PR URL. Do not merge unless asked.
