# Product roadmap

Status: active  
Updated: 2026-08-10 (cross-platform-ui-system added)

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

**Primary users:** single- and multi-adult care networks (parents in one or two
homes, grandparents, nannies, etc.).

**Success:** Before the next practice or game, adults know where kids need to
be, whether the circle can cover it, when to leave, and whether a teammate can
share the ride.

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

## Locked decisions

| Topic | Decision |
|--------|----------|
| Schedule import | **iCal / webcal / `.ics` URL** subscribe feeds (not RSS); **manual add/edit** escape hatch; dedupe by `UID` when present; **Sync now** then background poll; show **last-synced** time. **v1 target platforms to validate against:** [Crossbar](https://www.crossbar.org), [SportsYou](https://sportsyou.com), [SportsEngine](https://www.sportsengine.com) — still generic URL import, not vendor APIs |
| Identity | **Per-adult accounts**; **family circle** around kids; **invite link/code** to join; **v1 = at most one circle per adult** (multi-circle / blended / multi-grandkid households → parking) |
| Places | **Named places** (Mom’s house, Dad’s house, Grandma’s, School) — not one address for the whole circle; **unique name per circle** (case-insensitive); free-text address; **lat/lng via Nominatim** (soft-fail + retry locate) |
| Roles | **Organizer** (invite/remove, manage feeds/kids) + **Caregiver** (calendar, coverage, carpool, garage). Driver-only later |
| Circle writes | **Organizer-only:** kids, invite/roles, circle rename, **activity feeds** (+ Sync). **Any member:** **named places**, **manual events** |
| Driving | Orthogonal to role: **0+ vehicles** or “don’t drive”; non-drivers stay full Caregivers and can **request** rides |
| Same team, multiple kids | Attach **which kids** belong on a feed/team; calendar shows both |
| Carpool request | **One request covering all attending kids who still need a ride** by default (seats = kid count); **override** to drop a kid (e.g. sick) |
| Feed vs carpool | **Feed = calendar only**. **Carpool join = parent invite code/link** (first family enables space; members reshare/regenerate). No coach admin |
| Auth | **Email one-time code first** (no magic link in v1); **Bearer** sessions on web + Android + iOS; **optional password** later; web cookie hardening and production mail are follow-ups |
| Leave-by | Routed duration (OSRM) or fallback + **time-of-day multiplier** + **fixed buffer**; UI labeled **estimate** (not live traffic) |
| Vehicle specs | Free API (e.g. **NHTSA vPIC**) to suggest seats; always manually overridable |

## Upcoming (ranked)

Reorder only via `/roadmap` re-rank. Rank **1** is **Next up** for `/spec`.

| Rank | Id | Status | Added | Summary |
|------|-----|--------|-------|---------|
| 1 | family-calendar-surface | active | 2026-08-07 · re-rank split | Phone-first **agenda** of feed + manual events (unified schedule list) |
| 2 | app-shell-navigation | planned | 2026-08-10 · enhancement | Tab/nav shell: split long family scroll into focused screens (Calendar, Family, Places, …) |
| 3 | cross-platform-ui-system | planned | 2026-08-10 · enhancement | Custom shared look + aligned components/patterns across web, Android, iOS |
| 4 | family-calendar-grid | planned | 2026-08-10 · re-rank split | iOS-style **month/week calendar grid** on top of the unified schedule |
| 5 | event-leave-by-estimate | planned | 2026-08-07 · re-rank split | Per-event origin override; OSRM/fallback + time-of-day + buffer; “estimate” leave-by UI |
| 6 | conflict-detection | planned | 2026-08-07 · re-rank split | Surface overlapping kid needs and adult double-books (amber; no auto-resolve) |
| 7 | coverage-confirm-decline | planned | 2026-08-07 · re-rank split | Assign adult↔kid coverage + leave-from; explicit confirm/decline |
| 8 | team-carpool-space-invite | planned | 2026-08-07 · initial | Enable team carpool space; parent invite code/link; reshare/regenerate; feed stays calendar-only |
| 9 | garage-vehicles | planned | 2026-08-07 · initial | Adult garage; NHTSA seat hints + manual override; 0 vehicles / don’t drive still full Caregiver |
| 10 | carpool-request-accept | planned | 2026-08-07 · initial | Multi-kid default ride request + deselect override; accept; seat updates |
| 11 | driver-leave-by-pickups | planned | 2026-08-07 · initial | Leave-by when teammate pickups are part of the plan (multi-stop estimate) |
| 12 | auth-email-delivery | planned | 2026-08-07 · enhancement | Production SMTP/API mail for OTP — pre-beta gate for real users (dev keeps log delivery) |
| 13 | web-auth-session-hardening | planned | 2026-08-07 · enhancement | HTTP-only cookie (or equivalent) for web — pre-beta gate; mobile stays Bearer |
| 14 | adult-optional-password | planned | 2026-08-07 · re-rank split | Optional password for frequent users — pre-beta convenience (OTP remains primary) |

Status values: `parking` · `planned` · `active` · `done` · `cancelled`  
Added: `YYYY-MM-DD · initial` | `enhancement` | `re-rank split`

## Parking lot

Unranked ideas. Promote into **Upcoming** with `/roadmap` (re-rank).

| Id | Added | Summary |
|----|-------|---------|
| multi-circle-membership | 2026-08-08 · enhancement | Adult in multiple family circles (blended households; grandparents with more than one grandkid family) |
| read-only-calendar-follows | 2026-08-08 · enhancement | Follow another team/kid calendar read-only (e.g. last year’s teammates on a new team) |
| venue-proximity-alerts | 2026-08-08 · enhancement | Notify when followed/circle kids are at or near the same venue around the same time |
| caregiver-attention-balance | 2026-08-08 · enhancement | Surface which kids get more caregiver attention so adults (e.g. grandparents) can rebalance |
| app-identity-rename | 2026-08-07 · initial | Rename packages/clients from quickapp template identity before public beta |
| push-notifications | 2026-08-07 · initial | Push for coverage asks, ride request/accept, conflict alerts |
| sign-in-apple-google | 2026-08-07 · initial | Sign in with Apple / Google (deferred from auth v1) |
| driver-only-role | 2026-08-07 · initial | Narrow Driver-only role (orthogonal driving stays in garage for now) |
| rss-atom-schedule-feeds | 2026-08-09 · enhancement | RSS/Atom schedule import (superseded for v1 by iCal/webcal) |
| rescue-broadcast | 2026-08-07 · initial | Emergency / rescue broadcast mode |
| paid-live-traffic | 2026-08-07 · initial | Paid live-traffic providers for leave-by |
| coach-league-admin | 2026-08-07 · initial | Coach/league admin consoles, fees, club OS |
| in-app-chat | 2026-08-07 · initial | Messaging between caregivers / carpool members |
| osm-map-tiles | 2026-08-07 · initial | Optional in-app map with OSM tiles + attribution |
| maps-deep-links | 2026-08-07 · initial | Open external directions via OS maps deep links |

## Active specs

In-progress work (locked for re-rank — finish, amend, or abandon before reshuffle).

| Id | Branch | Spec |
|----|--------|------|
| family-calendar-surface | `family-calendar-surface` | [active](specs/active/family-calendar-surface.md) |

## Done

| Id | Completed | Spec |
|----|-----------|------|
| manual-events | 2026-08-10 | [archive](specs/archive/manual-events.md) |
| activity-feed-poller | 2026-08-10 | [archive](specs/archive/activity-feed-poller.md) |
| activity-feed-subscribe | 2026-08-10 | [archive](specs/archive/activity-feed-subscribe.md) |
| place-geocoding | 2026-08-09 | [archive](specs/archive/place-geocoding.md) |
| named-places | 2026-08-09 | [archive](specs/archive/named-places.md) |
| family-adult-invites-roles | 2026-08-09 | [archive](specs/archive/family-adult-invites-roles.md) |
| family-circle-and-kids | 2026-08-08 | [archive](specs/archive/family-circle-and-kids.md) |
| adult-auth-magic-link | 2026-08-08 | [archive](specs/archive/adult-auth-magic-link.md) |
| template-packaging | 2026-07-11 | [archive](specs/archive/template-packaging.md) |
| path-filtered-ci | 2026-07-10 | [archive](specs/archive/path-filtered-ci.md) |
| web-scaffold | 2026-07-10 | [archive](specs/archive/web-scaffold.md) |
| kmp-networking-spike | 2026-07-10 | [archive](specs/archive/kmp-networking-spike.md) |

## Roadmap history

Only notable events (first carve-up, major re-rank, cancelled theme) — not every edit.

| Date | Event |
|------|--------|
| 2026-07-10 | Roadmap file introduced (empty product backlog; infra specs recorded under Done). |
| 2026-07-11 | Template packaging: Vision/non-goals clarify upstream is a starter template. |
| 2026-08-07 | First product carve-up: family calendar + carpool vision; non-goals and locked decisions captured. |
| 2026-08-07 | Re-rank split: thinned auth, feed/calendar, leave-by, and coverage into 16 PR-sized slices (was 11). |
| 2026-08-07 | `/spec adult-auth-magic-link`: email OTP + Bearer v1; display name deferred to family-circle. |
| 2026-08-07 | `auth-email-delivery` + `web-auth-session-hardening` → Upcoming ranks 17–18 as pre-beta gates (dev stays easy; do not block product slices). |
| 2026-08-08 | `/pr adult-auth-magic-link`: email OTP + Bearer shipped; greeting harness deleted; next up `adult-optional-password`. |
| 2026-08-08 | Re-rank: product slices first; `adult-optional-password` → rank 17 with other pre-beta auth gates; next up `family-circle-and-kids`. |
| 2026-08-08 | Parked multi-circle, read-only calendar follows, venue-proximity alerts, and caregiver attention-balance; v1 stays one circle per adult. |
| 2026-08-08 | `/pr family-circle-and-kids`: circle + kids CRUD shipped (web/Android/iOS); next up `family-adult-invites-roles`. |
| 2026-08-09 | `/spec family-adult-invites-roles`: invite code, Caregiver join, promote/demote, leave rules; multi-circle stays parking. |
| 2026-08-09 | `/pr family-adult-invites-roles`: invite code + roles shipped (web/Android/iOS); next up `named-places`. |
| 2026-08-09 | Schedule import locked to **iCal/webcal** (not RSS); v1 validate Crossbar, SportsYou, SportsEngine; RSS/Atom → parking. |
| 2026-08-09 | `/spec named-places`: circle places (name + free-text address); any member CRUD; lat/lng → `place-geocoding`. |
| 2026-08-09 | `/pr named-places`: named places CRUD shipped (web/Android/iOS); next up `place-geocoding`. |
| 2026-08-09 | `/spec place-geocoding`: Nominatim + cache; soft-fail; Located/Not located + Retry locate (places only). |
| 2026-08-09 | `/pr place-geocoding`: place lat/lng + locate shipped (web/Android/iOS); next up `activity-feed-sync`. |
| 2026-08-10 | Re-rank split: `activity-feed-sync` → `activity-feed-subscribe` (Sync now + manage UI) then `activity-feed-poller`; next up `activity-feed-subscribe`. |
| 2026-08-10 | `/spec activity-feed-subscribe`: Organizer feed CRUD; auto-sync on create/URL change; Sync now; soft-fail; UID snapshot; manage-feeds UI (web/Android/iOS). |
| 2026-08-10 | `/pr activity-feed-subscribe`: iCal subscribe + Sync now shipped (web/Android/iOS); next up `activity-feed-poller`. |
| 2026-08-10 | `/spec activity-feed-poller`: 30m scheduled poll reusing sync path; client Refresh (list only); no sync-all. |
| 2026-08-10 | `/pr activity-feed-poller`: background poll + list Refresh shipped (web/Android/iOS); next up `manual-events`. |
| 2026-08-10 | `/spec manual-events`: any-member CRUD; 1+ kids; new `events` module; thin manage list (calendar primary later). |
| 2026-08-10 | `/pr manual-events`: manual event CRUD shipped (web/Android/iOS); next up `family-calendar-surface`. |
| 2026-08-10 | Re-rank split: `family-calendar-surface` = agenda now; add `family-calendar-grid` (iOS-style month/week) as rank 2. |
| 2026-08-10 | `/spec family-calendar-surface`: agenda + unified calendar GET; manual writes from agenda; grid deferred. |
| 2026-08-10 | Added `app-shell-navigation` (rank 2): split long family scroll into focused screens; grid → rank 3. |
| 2026-08-10 | Added `cross-platform-ui-system` (rank 3): shared custom UI language across web/Android/iOS; grid → rank 4. |
