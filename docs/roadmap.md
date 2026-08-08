# Product roadmap

Status: active  
Updated: 2026-08-08 (park multi-circle / follow / attention stories)

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
| Schedule import | **RSS/Atom + iCal/`.ics` URL** first; **manual add/edit** escape hatch; dedupe by feed item UID when present; poll on a sensible interval; show **last-synced** time |
| Identity | **Per-adult accounts**; **family circle** around kids; **invite link/code** to join; **v1 = at most one circle per adult** (multi-circle / blended / multi-grandkid households → parking) |
| Places | **Named places** (Mom’s house, Dad’s house, Grandma’s, School) — not one address for the whole circle |
| Roles | **Organizer** (invite/remove, manage feeds/kids) + **Caregiver** (calendar, coverage, carpool, garage). Driver-only later |
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
| 1 | family-circle-and-kids | active | 2026-08-07 · initial | Create family circle; add/edit kids; creating adult is Organizer |
| 2 | family-adult-invites-roles | planned | 2026-08-07 · initial | Invite link/code to join circle; Organizer invite/remove; Caregiver role |
| 3 | named-places | planned | 2026-08-07 · initial | Named places (homes, school, etc.) with addresses — not one address for the circle |
| 4 | place-geocoding | planned | 2026-08-07 · re-rank split | Nominatim geocode for places/venues; cache; respectful User-Agent |
| 5 | activity-feed-sync | planned | 2026-08-07 · re-rank split | RSS/Atom + iCal URL import; poll; dedupe by UID; last-synced; kid↔feed attachment |
| 6 | manual-events | planned | 2026-08-07 · re-rank split | Manual add/edit escape hatch for events not on a feed |
| 7 | family-calendar-surface | planned | 2026-08-07 · re-rank split | Unified family calendar UI across kids and imported/manual activities |
| 8 | event-leave-by-estimate | planned | 2026-08-07 · re-rank split | Per-event origin override; OSRM/fallback + time-of-day + buffer; “estimate” leave-by UI |
| 9 | conflict-detection | planned | 2026-08-07 · re-rank split | Surface overlapping kid needs and adult double-books (amber; no auto-resolve) |
| 10 | coverage-confirm-decline | planned | 2026-08-07 · re-rank split | Assign adult↔kid coverage + leave-from; explicit confirm/decline |
| 11 | team-carpool-space-invite | planned | 2026-08-07 · initial | Enable team carpool space; parent invite code/link; reshare/regenerate; feed stays calendar-only |
| 12 | garage-vehicles | planned | 2026-08-07 · initial | Adult garage; NHTSA seat hints + manual override; 0 vehicles / don’t drive still full Caregiver |
| 13 | carpool-request-accept | planned | 2026-08-07 · initial | Multi-kid default ride request + deselect override; accept; seat updates |
| 14 | driver-leave-by-pickups | planned | 2026-08-07 · initial | Leave-by when teammate pickups are part of the plan (multi-stop estimate) |
| 15 | auth-email-delivery | planned | 2026-08-07 · enhancement | Production SMTP/API mail for OTP — pre-beta gate for real users (dev keeps log delivery) |
| 16 | web-auth-session-hardening | planned | 2026-08-07 · enhancement | HTTP-only cookie (or equivalent) for web — pre-beta gate; mobile stays Bearer |
| 17 | adult-optional-password | planned | 2026-08-07 · re-rank split | Optional password for frequent users — pre-beta convenience (OTP remains primary) |

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
| family-circle-and-kids | `family-circle-and-kids` | [active](specs/active/family-circle-and-kids.md) |

## Done

| Id | Completed | Spec |
|----|-----------|------|
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
