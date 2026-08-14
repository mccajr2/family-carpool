# Product roadmap

Status: active  
Updated: 2026-08-14 (`/pr team-carpool-space-invite`)

Living backlog for this product repo. **One roadmap ↔ many specs** (1:1 by
kebab-case id). `/roadmap` updates and re-ranks; `/spec <id>` fleshes out the
next slice. Do not turn this file into a mega-spec.

## Vision

A **family scheduling and carpool app** for households with **multiple kids**
across **multiple sports and activities**.

Adults need one place to see every kid’s events (when/where/travel), detect
conflicts, assign **who covers whom**, and coordinate **team carpools** —
without living inside each activity’s proprietary app and without coaches
administering software.

**Two pillars**

1. **Calendar** — unified schedule across kids/activities; overridable
  leave-from places; estimated leave-by; conflict detection; coverage
   confirmation.
2. **Carpool** — opt-in team spaces (parent invite); household garage; simple
  **request / accept** with multi-kid seat counts.

**Look and feel:** Simple and intuitive — a distinct custom UI, not a clone of
any rideshare app. Interaction quality matters as much as features: few choices
per step, clear primary actions, fast feedback, reachable targets, and grouped
related controls (see Locked decisions → Interaction UX).

**Primary users:** single- and multi-adult care networks (parents in one or two
homes, grandparents, nannies, etc.).

**Success:** Before the next practice or game, adults know where kids need to
be, whether the circle can cover it, when to leave, and whether a teammate can
share the ride — without fighting the UI.

**Clients (beta):** **Web + Android + iOS in parallel**, contract-first
(OpenAPI → backend → web + mobile clients together when a surface ships).

## Product non-goals

- Emergency / rescue broadcast mode
- Live turn-by-turn navigation inside the app
- Paid live-traffic providers
- Coach/league admin consoles, fees, full club OS
- Vendor-specific private sport APIs as the schedule source of truth
- Desktop-first dashboard UX
- Driver-only role (defer)
- Sign in with Apple/Google (defer)
- Cloning Uber (or any rideshare) visual brand, map-first home, or booking IA
— tenets only; our flows stay family-calendar + carpool



## Locked decisions


| Topic                    | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Schedule import          | **iCal / webcal /** `.ics` **URL** subscribe feeds (not RSS); **manual add/edit** escape hatch; dedupe by `UID` when present; **Sync now** then background poll; show **last-synced** time. **v1 target platforms to validate against:** [Crossbar](https://www.crossbar.org), [SportsYou](https://sportsyou.com), [SportsEngine](https://www.sportsengine.com) — still generic URL import, not vendor APIs                                                                                                                                                                       |
| Identity                 | **Per-adult accounts**; **family circle** around kids; **invite link/code** to join; **v1 = at most one circle per adult** (multi-circle / blended / multi-grandkid households → parking)                                                                                                                                                                                                                                                                                                                                                                                         |
| Places                   | **Named places** (Mom’s house, Dad’s house, Grandma’s, School) — not one address for the whole circle; **unique name per circle** (case-insensitive); free-text address; **lat/lng via Nominatim** (soft-fail + retry locate)                                                                                                                                                                                                                                                                                                                                                     |
| Roles                    | **Organizer** (invite/remove, manage feeds/kids) + **Caregiver** (calendar, coverage, carpool, garage). Driver-only later                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Circle writes            | **Organizer-only:** kids, invite/roles, circle rename, **activity feeds** (+ Sync). **Any member:** **named places**, **manual events**                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Driving                  | Orthogonal to role: **0+ vehicles** or “don’t drive”; non-drivers stay full Caregivers and can **request** rides                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Same team, multiple kids | Attach **which kids** belong on a feed/team; calendar shows both                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Carpool request          | **One request covering all attending kids who still need a ride** by default (seats = kid count); **override** to drop a kid (e.g. sick)                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Feed vs carpool          | **Feed = calendar only** (import does not join rides). **One space per normalized feed URL**; **Organizer** of the first family enables and that circle **owns**. Join = **code** (admits + adds feed if missing) or **request** (same-URL subscriber; owner admit/decline, in-app). Members reshare code; owner regenerates. No coach admin. Done: `[team-carpool-space-invite](specs/archive/team-carpool-space-invite.md)`                                                                                           |
| Auth                     | **Email one-time code first** (no magic link in v1); **Bearer** sessions on web + Android + iOS; **optional password** later; web cookie hardening and production mail are follow-ups                                                                                                                                                                                                                                                                                                                                                                                             |
| Leave-by                 | Routed duration (OSRM) or fallback + **time-of-day multiplier** + **fixed buffer**; UI labeled **estimate** (not live traffic). Destination coords: **geocode event** `location` (soft-fail); origins = named places. Origin order: per-item override → **per-adult default leave-from** → first located by name. **Agenda must not wait on leave-by** — schedule first, estimates async, near-term before later days. Done: `[agenda-leave-by-async](specs/archive/agenda-leave-by-async.md)`. **Follow-up:** when adults take separate cars/kids, leave-from may differ per coverage — `[coverage-leave-from](specs/planned/coverage-leave-from.md)`                                                                                                          |
| Coverage                 | **Responsibility** rows (adult + kid subset + PENDING/CONFIRMED/DECLINED); any member assigns; assignee confirms/declines; kid exclusive per item on active rows; not a trip/seat plan — carpool later. Done: `[coverage-confirm-decline](specs/archive/coverage-confirm-decline.md)`                                                                                                                                                                                                                                                                                             |
| Event RSVP               | **Per kid + event:** **Yes / No / No response** (explicit; no implied Yes). Circle-visible; any member. Out of play when every kid is No (one-kid No included): summary stays, row deemphasized, hide leave-by/coverage/other dependent controls; RSVP + Edit/Remove stay. Mixed: No kid’s per-kid controls off. Assign/confirm coverage sets Yes. No (or No response) with active coverage: client confirm + hard-release. Foundation for carpool/team rollups. Done: `[agenda-event-rsvp](specs/archive/agenda-event-rsvp.md)` |
| Arrival lead time        | Follow-up `[event-arrival-lead-time](specs/planned/event-arrival-lead-time.md)`: editable defaults — game **30m** early, practice **15m**, other **0** — after leave-by ships                                                                                                                                                                                                                                                                                                                                                                                                     |
| Vehicle specs            | Free API (e.g. **NHTSA vPIC**) to suggest seats; always manually overridable                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| UI token adoption        | When a destination adopts `cross-platform-ui-system` tokens, **re-verify** light/dark screenshots + WCAG AA for **that** surface — More’s pass does not certify elsewhere. See `[ui-system-destination-adoption](specs/planned/ui-system-destination-adoption.md)`                                                                                                                                                                                                                                                                                                                |
| Interaction UX           | Distinct custom UI guided by UX-law tenets (not a rideshare clone): **Aesthetic-Usability** (polish reads as usable), **Doherty** (focused busy feedback feels instant), **Fitts** (primary actions large/reachable), **Hick** (few choices per step; sole-option defaults), **Proximity / Similarity** (group related controls; consistent patterns). Calendar/Agenda is the living reference: `[calendar-ux-flow](specs/archive/calendar-ux-flow.md)`. Inspired by [Laws of UX that Uber follows](https://medium.com/design-bootcamp/laws-of-ux-that-uber-follows-fa7c6619748b) |




## Upcoming (ranked)

Reorder only via `/roadmap` re-rank. Rank **1** is **Next up** for `/spec`.


| Rank | Id                             | Status  | Added                                                            | Summary                                                                                                                                                         |
| ---- | ------------------------------ | ------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | garage-vehicles                | planned | 2026-08-07 · initial                                             | Adult garage; NHTSA seat hints + manual override; 0 vehicles / don’t drive still full Caregiver                                                                 |
| 2    | carpool-request-accept         | planned | 2026-08-07 · initial                                             | Multi-kid default ride request + deselect override; accept; seat updates                                                                                        |
| 3    | manual-event-team-link         | planned | 2026-08-13 · re-rank split                                       | Manual events: attach to a team (feed UUID, carpool-eligible) or standalone (family tracking only)                                                              |
| 4    | event-arrival-lead-time        | planned | 2026-08-11 · enhancement                                         | Editable arrival lead times: game ~30m / practice ~15m / other ~0 (defaults); refine leave-by target                                                            |
| 5    | coverage-leave-from            | planned | 2026-08-12 · enhancement                                         | Leave-from (and leave-by) per coverage when adults take separate cars/kids                                                                                      |
| 6    | conflict-travel-margin         | planned | 2026-08-12 · enhancement                                         | Soft “cutting it close” warn from leave-by/travel gaps (not hard overlap; after leave-from / lead-time)                                                         |
| 7    | calendar-conditional-get       | planned | 2026-08-12 · re-rank split                                       | Server `ETag` + client `If-None-Match` / `304` on calendar background revalidate (after cheap list + client cache)                                              |
| 8    | driver-leave-by-pickups        | planned | 2026-08-07 · initial                                             | Leave-by when teammate pickups are part of the plan (multi-stop estimate)                                                                                       |
| 9    | family-calendar-grid           | planned | 2026-08-10 · re-rank split                                       | iOS-style **month/week calendar grid** on top of the unified schedule (after Agenda UX is solid)                                                                |
| 10   | ui-system-destination-adoption | planned | 2026-08-10 · note carried from cross-platform-ui-system approval | Adopt shared tokens on destinations after their product UI exists (grid, carpool, etc.); re-run screenshots + WCAG AA per surface                               |
| 11   | ui-palette-refresh             | planned | 2026-08-10 · enhancement                                         | Replace provisional teal/slate hex values with a more distinctive brand palette; keep token roles; re-verify screenshots + WCAG AA (after destination adoption) |
| 12   | auth-email-delivery            | planned | 2026-08-07 · enhancement                                         | Production SMTP/API mail for OTP — pre-beta gate for real users (dev keeps log delivery)                                                                        |
| 13   | web-auth-session-hardening     | planned | 2026-08-07 · enhancement                                         | HTTP-only cookie (or equivalent) for web — pre-beta gate; mobile stays Bearer                                                                                   |
| 14   | adult-optional-password        | planned | 2026-08-07 · re-rank split                                       | Optional password for frequent users — pre-beta convenience (OTP remains primary)                                                                               |


Status values: `parking` · `planned` · `active` · `done` · `cancelled`  
Added: `YYYY-MM-DD · initial` | `enhancement` | `re-rank split`

## Parking lot

Unranked ideas. Promote into **Upcoming** with `/roadmap` (re-rank).


| Id                          | Added                    | Summary                                                                                                                                                           |
| --------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| multi-circle-membership     | 2026-08-08 · enhancement | Adult in multiple family circles (blended households; grandparents with more than one grandkid family)                                                            |
| read-only-calendar-follows  | 2026-08-08 · enhancement | Follow another team/kid calendar read-only (e.g. last year’s teammates on a new team)                                                                             |
| venue-proximity-alerts      | 2026-08-08 · enhancement | Notify when followed/circle kids are at or near the same venue around the same time                                                                               |
| caregiver-attention-balance | 2026-08-08 · enhancement | Surface which kids get more caregiver attention so adults (e.g. grandparents) can rebalance                                                                       |
| carpool-least-privilege     | 2026-08-13 · enhancement | Some circle adults (nanny, grandparent) get own-kids calendar/coverage without teammate carpool roster, codes, or addresses — after invite v1                     |
| app-identity-rename         | 2026-08-07 · initial     | Rename packages/clients from quickapp template identity before public beta                                                                                        |
| push-notifications          | 2026-08-07 · initial     | Push for coverage asks, ride request/accept, conflict alerts                                                                                                      |
| sign-in-apple-google        | 2026-08-07 · initial     | Sign in with Apple / Google (deferred from auth v1)                                                                                                               |
| driver-only-role            | 2026-08-07 · initial     | Narrow Driver-only role (orthogonal driving stays in garage for now)                                                                                              |
| rss-atom-schedule-feeds     | 2026-08-09 · enhancement | RSS/Atom schedule import (superseded for v1 by iCal/webcal)                                                                                                       |
| rescue-broadcast            | 2026-08-07 · initial     | Emergency / rescue broadcast mode                                                                                                                                 |
| paid-live-traffic           | 2026-08-07 · initial     | After leave-by proves value: replace/supplement free **OSRM** routing with a paid live-traffic provider (still labeled estimate unless product decides otherwise) |
| coach-league-admin          | 2026-08-07 · initial     | Coach/league admin consoles, fees, club OS                                                                                                                        |
| in-app-chat                 | 2026-08-07 · initial     | Messaging between caregivers / carpool members                                                                                                                    |
| osm-map-tiles               | 2026-08-07 · initial     | Optional in-app map with OSM tiles + attribution                                                                                                                  |
| maps-deep-links             | 2026-08-07 · initial     | Open external directions via OS maps deep links                                                                                                                   |




## Active specs

In-progress work (locked for re-rank — finish, amend, or abandon before reshuffle).


| Id | Branch | Spec |
| -- | ------ | ---- |


## Done


| Id                         | Completed  | Spec                                                   |
| -------------------------- | ---------- | ------------------------------------------------------ |
| team-carpool-space-invite  | 2026-08-14 | [archive](specs/archive/team-carpool-space-invite.md)  |
| agenda-event-rsvp          | 2026-08-13 | [archive](specs/archive/agenda-event-rsvp.md)          |
| agenda-leave-by-async      | 2026-08-13 | [archive](specs/archive/agenda-leave-by-async.md)      |
| calendar-client-cache     | 2026-08-12 | [archive](specs/archive/calendar-client-cache.md)      |
| conflict-detection         | 2026-08-12 | [archive](specs/archive/conflict-detection.md)         |
| calendar-ux-flow           | 2026-08-12 | [archive](specs/archive/calendar-ux-flow.md)           |
| coverage-confirm-decline   | 2026-08-12 | [archive](specs/archive/coverage-confirm-decline.md)   |
| event-leave-by-estimate    | 2026-08-11 | [archive](specs/archive/event-leave-by-estimate.md)    |
| cross-platform-ui-system   | 2026-08-10 | [archive](specs/archive/cross-platform-ui-system.md)   |
| agenda-event-compose       | 2026-08-10 | [archive](specs/archive/agenda-event-compose.md)       |
| app-shell-navigation       | 2026-08-10 | [archive](specs/archive/app-shell-navigation.md)       |
| family-calendar-surface    | 2026-08-10 | [archive](specs/archive/family-calendar-surface.md)    |
| manual-events              | 2026-08-10 | [archive](specs/archive/manual-events.md)              |
| activity-feed-poller       | 2026-08-10 | [archive](specs/archive/activity-feed-poller.md)       |
| activity-feed-subscribe    | 2026-08-10 | [archive](specs/archive/activity-feed-subscribe.md)    |
| place-geocoding            | 2026-08-09 | [archive](specs/archive/place-geocoding.md)            |
| named-places               | 2026-08-09 | [archive](specs/archive/named-places.md)               |
| family-adult-invites-roles | 2026-08-09 | [archive](specs/archive/family-adult-invites-roles.md) |
| family-circle-and-kids     | 2026-08-08 | [archive](specs/archive/family-circle-and-kids.md)     |
| adult-auth-magic-link      | 2026-08-08 | [archive](specs/archive/adult-auth-magic-link.md)      |
| template-packaging         | 2026-07-11 | [archive](specs/archive/template-packaging.md)         |
| path-filtered-ci           | 2026-07-10 | [archive](specs/archive/path-filtered-ci.md)           |
| web-scaffold               | 2026-07-10 | [archive](specs/archive/web-scaffold.md)               |
| kmp-networking-spike       | 2026-07-10 | [archive](specs/archive/kmp-networking-spike.md)       |




## Roadmap history

Only notable events (first carve-up, major re-rank, cancelled theme) — not every edit.


| Date       | Event                                                                                                                                                                                                                             |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-10 | Roadmap file introduced (empty product backlog; infra specs recorded under Done).                                                                                                                                                 |
| 2026-07-11 | Template packaging: Vision/non-goals clarify upstream is a starter template.                                                                                                                                                      |
| 2026-08-07 | First product carve-up: family calendar + carpool vision; non-goals and locked decisions captured.                                                                                                                                |
| 2026-08-07 | Re-rank split: thinned auth, feed/calendar, leave-by, and coverage into 16 PR-sized slices (was 11).                                                                                                                              |
| 2026-08-07 | `/spec adult-auth-magic-link`: email OTP + Bearer v1; display name deferred to family-circle.                                                                                                                                     |
| 2026-08-07 | `auth-email-delivery` + `web-auth-session-hardening` → Upcoming ranks 17–18 as pre-beta gates (dev stays easy; do not block product slices).                                                                                      |
| 2026-08-08 | `/pr adult-auth-magic-link`: email OTP + Bearer shipped; greeting harness deleted; next up `adult-optional-password`.                                                                                                             |
| 2026-08-08 | Re-rank: product slices first; `adult-optional-password` → rank 17 with other pre-beta auth gates; next up `family-circle-and-kids`.                                                                                              |
| 2026-08-08 | Parked multi-circle, read-only calendar follows, venue-proximity alerts, and caregiver attention-balance; v1 stays one circle per adult.                                                                                          |
| 2026-08-08 | `/pr family-circle-and-kids`: circle + kids CRUD shipped (web/Android/iOS); next up `family-adult-invites-roles`.                                                                                                                 |
| 2026-08-09 | `/spec family-adult-invites-roles`: invite code, Caregiver join, promote/demote, leave rules; multi-circle stays parking.                                                                                                         |
| 2026-08-09 | `/pr family-adult-invites-roles`: invite code + roles shipped (web/Android/iOS); next up `named-places`.                                                                                                                          |
| 2026-08-09 | Schedule import locked to **iCal/webcal** (not RSS); v1 validate Crossbar, SportsYou, SportsEngine; RSS/Atom → parking.                                                                                                           |
| 2026-08-09 | `/spec named-places`: circle places (name + free-text address); any member CRUD; lat/lng → `place-geocoding`.                                                                                                                     |
| 2026-08-09 | `/pr named-places`: named places CRUD shipped (web/Android/iOS); next up `place-geocoding`.                                                                                                                                       |
| 2026-08-09 | `/spec place-geocoding`: Nominatim + cache; soft-fail; Located/Not located + Retry locate (places only).                                                                                                                          |
| 2026-08-09 | `/pr place-geocoding`: place lat/lng + locate shipped (web/Android/iOS); next up `activity-feed-sync`.                                                                                                                            |
| 2026-08-10 | Re-rank split: `activity-feed-sync` → `activity-feed-subscribe` (Sync now + manage UI) then `activity-feed-poller`; next up `activity-feed-subscribe`.                                                                            |
| 2026-08-10 | `/spec activity-feed-subscribe`: Organizer feed CRUD; auto-sync on create/URL change; Sync now; soft-fail; UID snapshot; manage-feeds UI (web/Android/iOS).                                                                       |
| 2026-08-10 | `/pr activity-feed-subscribe`: iCal subscribe + Sync now shipped (web/Android/iOS); next up `activity-feed-poller`.                                                                                                               |
| 2026-08-10 | `/spec activity-feed-poller`: 30m scheduled poll reusing sync path; client Refresh (list only); no sync-all.                                                                                                                      |
| 2026-08-10 | `/pr activity-feed-poller`: background poll + list Refresh shipped (web/Android/iOS); next up `manual-events`.                                                                                                                    |
| 2026-08-10 | `/spec manual-events`: any-member CRUD; 1+ kids; new `events` module; thin manage list (calendar primary later).                                                                                                                  |
| 2026-08-10 | `/pr manual-events`: manual event CRUD shipped (web/Android/iOS); next up `family-calendar-surface`.                                                                                                                              |
| 2026-08-10 | Re-rank split: `family-calendar-surface` = agenda now; add `family-calendar-grid` (iOS-style month/week) as rank 2.                                                                                                               |
| 2026-08-10 | `/spec family-calendar-surface`: agenda + unified calendar GET; manual writes from agenda; grid deferred.                                                                                                                         |
| 2026-08-10 | Added `app-shell-navigation` (rank 2): split long family scroll into focused screens; grid → rank 3.                                                                                                                              |
| 2026-08-10 | Added `cross-platform-ui-system` (rank 3): shared custom UI language across web/Android/iOS; grid → rank 4.                                                                                                                       |
| 2026-08-10 | `/implement family-calendar-surface`: calendar module + Agenda UI (web/Android/iOS); docs updated.                                                                                                                                |
| 2026-08-10 | `/pr family-calendar-surface`: unified calendar Agenda shipped; next up `app-shell-navigation`.                                                                                                                                   |
| 2026-08-10 | Agenda **Load more**: clients append +30d pages beyond the initial window (web/Android/iOS).                                                                                                                                      |
| 2026-08-10 | `/spec app-shell-navigation`: Calendar → Carpool (placeholder) → Family → More/Settings; web sidebar vs mobile tabs; Caregiver Feeds omitted.                                                                                     |
| 2026-08-10 | `/implement app-shell-navigation`: web sidebar + Android/iOS bottom tabs; architecture shell IA noted; Active row unchanged.                                                                                                      |
| 2026-08-10 | `/pr app-shell-navigation`: 4-destination shell shipped (web/Android/iOS); next up `cross-platform-ui-system`.                                                                                                                    |
| 2026-08-10 | Added `agenda-event-compose` (rank 1): Calendar Add → dedicated create/edit compose; bumped UI system / grid.                                                                                                                     |
| 2026-08-10 | `/spec agenda-event-compose`: remove inline Agenda create/edit; chrome Add + compose sheet/page (web/Android/iOS).                                                                                                                |
| 2026-08-10 | `/pr agenda-event-compose`: Calendar Add → dedicated compose shipped; next up `cross-platform-ui-system`.                                                                                                                         |
| 2026-08-10 | `/spec cross-platform-ui-system`: shared tokens + parity primitives; More as reference screen (light+dark); other screens deferred.                                                                                               |
| 2026-08-10 | Carry-forward: `ui-system-destination-adoption` — destination token adoption must re-run screenshots + WCAG AA (More pass does not certify elsewhere).                                                                            |
| 2026-08-10 | Promoted `ui-system-destination-adoption` → Upcoming (after carpool product slices; not parking).                                                                                                                                 |
| 2026-08-10 | `/pr cross-platform-ui-system`: shared tokens + More reference shipped; next up `ui-palette-refresh`.                                                                                                                             |
| 2026-08-10 | Added `ui-palette-refresh` (rank 1): more distinctive brand hex values on existing token roles.                                                                                                                                   |
| 2026-08-11 | PoC re-rank: leave-by → conflicts → coverage → carpool cluster → grid → UI adoption → palette → pre-beta auth.                                                                                                                    |
| 2026-08-11 | `/spec event-leave-by-estimate`: geocode event location + per-adult leave-from + OSRM estimate; added follow-up `event-arrival-lead-time`.                                                                                        |
| 2026-08-11 | `/pr event-leave-by-estimate`: leave-by estimates on Agenda (web/Android/iOS); next up `conflict-detection`.                                                                                                                      |
| 2026-08-11 | Re-rank: `coverage-confirm-decline` before `conflict-detection` so adult double-books use real coverage (still two PRs).                                                                                                          |
| 2026-08-11 | `/spec coverage-confirm-decline`: responsibility coverage + confirm/decline; per-adult default leave-from; conflicts next.                                                                                                        |
| 2026-08-12 | `/pr coverage-confirm-decline`: Agenda coverage + default leave-from (web/Android/iOS); next up `conflict-detection`.                                                                                                             |
| 2026-08-12 | Enhancement: `coverage-leave-from` (rank 2) — per-coverage leave-from when adults take separate cars/kids; next up still `conflict-detection`.                                                                                    |
| 2026-08-12 | Major re-rank: look-and-feel first — add `calendar-ux-flow` (Next up); lock Interaction UX tenets; pull `event-arrival-lead-time` before carpool; keep conflicts/coverage-leave-from next; grid/palette/adoption after Agenda UX. |
| 2026-08-12 | `/pr calendar-ux-flow`: Agenda presentation hierarchy + Interaction UX tenets (web/Android/iOS); next up `conflict-detection`.                                                                                                    |
| 2026-08-12 | `/spec conflict-detection`: server conflicts + amber Agenda + 409 double-CONFIRMED; add `calendar-client-cache` (Next up) + `conflict-travel-margin`.                                                                            |
| 2026-08-12 | `/pr conflict-detection`: Agenda conflict amber + 409 double-CONFIRMED (web/Android/iOS); next up `calendar-client-cache`.                                                                                                        |
| 2026-08-12 | `/spec calendar-client-cache`: re-rank split — client persist + SWR now; add `calendar-conditional-get` (ETag/`304`) as rank 2.                                                                                                  |
| 2026-08-12 | `/pr calendar-client-cache`: Agenda client cache + SWR (web/Android/iOS); next up `calendar-conditional-get`.                                                                                                                    |
| 2026-08-13 | `/pr calendar-client-cache` follow-up: family bootstrap cache paints Ready before `getCircle`; keep calendar cache across sign-out.                                                                                               |
| 2026-08-13 | Enhancement: `agenda-leave-by-async` (Next up) — schedule first, leave-by async near-term-first; `calendar-conditional-get` → rank 2.                                                                                            |
| 2026-08-13 | Enhancement: `agenda-event-rsvp` (rank 2) — simple Agenda RSVP + skip-cover deemphasis; carpool/team rollups consume later.                                                                                                      |
| 2026-08-13 | `/spec agenda-leave-by-async`: cheap calendar GET + async leave-by fill-in (near-term first); `calendar-conditional-get` stays next after this PR.                                                                              |
| 2026-08-13 | `/pr agenda-leave-by-async`: cheap calendar list + async leave-by fill-in (web/Android/iOS); next up `agenda-event-rsvp`.                                                                                                      |
| 2026-08-13 | `/spec agenda-event-rsvp`: per-kid Yes/No/No response; all-No deemphasis; assign implies Yes; confirm + hard-release when No would drop coverage.                                                                              |
| 2026-08-13 | `/pr agenda-event-rsvp`: per-kid Agenda RSVP + out-of-play chrome (web/Android/iOS); next up `calendar-conditional-get`.                                                                                                      |
| 2026-08-13 | PoC re-rank: purpose #1 (family planning) is dogfoodable; purpose #2 (team carpool) unproven — pull invite → garage → request/accept ahead of leave-by/cache polish; next up `team-carpool-space-invite`.                  |
| 2026-08-13 | `/spec team-carpool-space-invite`: space per feed URL; owner family; code adds feed; request/admit; split `manual-event-team-link` (rank 4).                                                                              |
| 2026-08-14 | `/pr team-carpool-space-invite`: opt-in team spaces (web/Android/iOS); next up `garage-vehicles`.                                                                                                                          |

