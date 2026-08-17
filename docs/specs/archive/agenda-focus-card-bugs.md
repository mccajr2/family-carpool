# Spec: agenda-focus-card-bugs

Status: done  
Created: 2026-08-16  
Updated: 2026-08-17 (`/pr`)  
Approved: 2026-08-16  
Parent: [docs/roadmap.md](../../roadmap.md)  
Branch: `agenda-focus-card-bugs`  
Added: 2026-08-16 · enhancement

## Problem

Two display bugs found while screenshot-smoking the shipped web Focus card
(PR #38 / [`agenda-focus-hero-surface`](agenda-focus-hero-surface.md)).
Not new design work.

1. **Feed titles show HTML entities literally** (`2016/2017 (BILL): Team &amp;
   Family Meeting`). React `{item.title}` does not decode entities — seeing
   `&amp;` means the stored/API string already contains `&amp;`.
   `IcalParser.unescapeText` only handles RFC 5545 TEXT (`\,` `\;` `\\` `\n`),
   not HTML. SportsEngine-style feeds (the Sharks title pattern) put HTML
   entities in `SUMMARY` / `LOCATION`. Hero typography made it obvious; the
   same string would also show in `AgendaRow` and on mobile.
2. **Countdown ring label always uses hours past 60 minutes.** Fill already
   caps at `RING_MAX_MINUTES = 180`. `formatMinutes` does not, so a ~10-day-out
   off-season event prints `236h 39`. The ring answers “how excited should I
   be right now,” and the **unit is part of that signal** — `10` / `days` and
   `42` / `min` should both be glanceable. Hours at that range are neither.

## Non-goals

- Restyling the Focus card, changing selection logic, handlers, or copy
- Changing `RING_MAX_MINUTES` (fill stays a 3h urgency cue)
- Capping/hiding the label as `"—"` past 24h (rejected: off-season every
  event would show `"—"`, which is worse than confusing hours)
- Week / month units; mixed `1d 12h` labels
- iOS / Android Focus chrome ([`agenda-focus-card-mobile`](../planned/agenda-focus-card-mobile.md))
- Decoding `item.title` in React / Swift / Compose as the intended fix
- OpenAPI / client contract changes
- Rewriting already-stored rows in a migration (next Sync/poll + read-time
  decode is enough)
- Decoding `UID` or unused `DESCRIPTION`
- Adding a new HTML-unescape library

## Approach

**No contract change.**

**Bug 1 — ingest (and read) in `feeds`.** After RFC 5545 unescape, HTML-unescape
`SUMMARY` and `LOCATION` in `IcalParser` (package-private helper next to
`unescapeText`, then `HtmlUtils.htmlUnescape` from spring-web — already on the
feeds module via `spring-boot-starter-web`). Do not add Apache Commons.

Apply the same helper in `FeedCalendarApiImpl.toDto` for **title and location**
so already-ingested `&amp;` rows render correctly before the next Sync/poll.
Today `toDto` only re-runs `unescapeText` on location (leftover iCal TEXT), not
on summary — same leftover-encoding pattern, now including HTML.

Single decode pass. A literal `&` that is not an entity stays `&`. Parser unit
tests must cover `&amp;`, `&lt;`, `&#39;` / `&quot;`, plus existing RFC 5545
comma unescape so we do not regress SportsEngine locations.

If implement-time investigation contradicts this (e.g. the ICS is already
plain `&` and something else re-escapes), **stop and report** — do not silently
ship a display-layer decode as the fix. A client-side decode is fallback only
and must be called out in the PR plus a real follow-up; that is not the plan
here.

**Bug 2 — adaptive ring unit, not cap-and-hide.** Replace `formatMinutes` +
the `min`/`hr` ternary with `formatRingCountdown` in `agendaFocusRing.ts`
that picks one unit from remaining minutes:

| Remaining | Label | Unit (existing `uppercase` chrome → MIN / HR / DAY / DAYS) |
| --------- | ----- | --------------------------------------------------- |
| `mins == null` | `"—"` | (none) |
| `< 60` | integer minutes (unchanged) | `min` |
| `< 24h` | existing hour form (`2` or `2h 30`) | `hr` |
| `≥ 24h` | nearest whole day, minimum 1 | `day` / `days` (English plural; `min`/`hr` stay abbreviated) |

The screenshot case (~236h 39 ≈ 9.86 days) rounds to **10** / `days`. `"—"`
only when the timestamp is missing/invalid — never because the event is far
away.

Do not change `RING_MAX_MINUTES`. Far-future events still read as a full ring
(3h+ fill cap) with a day count. Between 3h and 24h the ring is full and the
label still shows hours.

Update the one countdown-ring paragraph in
`docs/agenda-focus-card-addendum.md` so it matches (adaptive label; fill still
a 3h cue; not a precise timer).

`AgendaRow` has no ring; feed titles there follow from the API once bug 1 is
fixed. No mobile code in this PR.

## Acceptance criteria

- [x] `IcalParser` turns `SUMMARY:Team &amp; Family Meeting` into
      `Team & Family Meeting` (and the same for LOCATION). `&lt;`, `&#39;`,
      `&quot;` decode; RFC 5545 `\,` in LOCATION still becomes a comma.
- [x] Calendar GET for an already-stored feed event whose DB summary is
      `Team &amp; Family Meeting` returns `Team & Family Meeting` without
      waiting for a re-sync (read-time helper on `toDto`).
- [x] No OpenAPI change. No `item.title` HTML decode in web/mobile UI.
- [x] Focus-card ring label is adaptive: minutes when `< 60`; hours when
      `< 24h`; nearest whole day when `≥ 24h`. `"—"` only when `mins` is null.
      A ~10-day-out event shows `10` / `days`, not `236h 39` and not `"—"`.
      Fill still caps at 180 minutes.
- [x] Automated tests above would fail if the parser helper or the adaptive
      unit were reverted. Manual smoke of the screenshot scenario is extra,
      not a substitute.

## Tasks

- [x] Backend: `normalizeIcalText` (RFC 5545 then `HtmlUtils.htmlUnescape`) on
      parser SUMMARY/LOCATION and on `FeedCalendarApiImpl.toDto` title + location
- [x] Web: adaptive ring unit helper (min / hr / day(s)); leave fill at 180;
      addendum sentence for the ring label
- [x] Tests: `IcalParserTest` entity + iCal-escape cases; helper/unit tests
      for the three breakpoints plus the ~10-day screenshot case; Focus-card
      render with fake timers. Extend `toDto` coverage if an existing test can
      assert stored `&amp;` → decoded title; otherwise the package-private
      helper test is the gate for read-time decode.
- [x] Run `IcalParserTest` + web `AgendaFocusCard` tests; report actual results

## Open questions

None — adaptive min / hr / day(s) is locked; 24h cap-and-hide is rejected.
Display-layer title decode is not in scope unless implement investigation
disproves the ingest path.
