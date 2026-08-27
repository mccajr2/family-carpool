# Architecture

Long-lived design decisions for **family-carpool**. Feature-specific detail lives
in `docs/specs/`; this document explains *how the repo is organized* and *how
work flows through it*.

**Agents:** do not load this file in full for implementation. Jump to the
heading the active spec's **Context** names. Map: [`docs/context.md`](context.md).

## Contents

- [Auth (v1)](#auth-v1)
- [Family circle (v1)](#family-circle-v1)
- [Interaction UX](#interaction-ux)
- [Repository layout](#repository-layout)
- [SDD workflow](#sdd-workflow)
- [Cross-stack request flow](#cross-stack-request-flow)
- [Backend (Spring Modulith)](#backend-spring-modulith)
- [Mobile (Kotlin Multiplatform)](#mobile-kotlin-multiplatform)
- [Contract-first API](#contract-first-api)
- [Testing strategy](#testing-strategy)
- [Git and build hygiene](#git-and-build-hygiene)
- [CI](#ci)
- [Not built yet](#not-built-yet)
- [When to add contract validation in CI](#when-to-add-contract-validation-in-ci)
- [Adding a real feature (checklist)](#adding-a-real-feature-checklist)
- [Conventions](#conventions-accumulate-here)

## What this repo is

**family-carpool** is a product repo created from the quickapp SDD starter (see
`docs/using-as-template.md` for upstream template notes). Workflow:
roadmap → spec → contract → backend module → mobile/web clients → UI.

The disposable **greeting** harness was removed with the first product feature
(`adult-auth-magic-link`). Cross-stack smoke is **email OTP auth** plus
**family circle + kids + named places** plus **circle garage** (vehicles).

Proven toolchain checkpoints (from the starter) remain valid; the live product
path is auth → family:

| Checkpoint | Proves |
|------------|--------|
| 1 | Gradle + Spring Modulith backend (Java 25, `ModularityTests`) |
| 2 | KMP `sharedLogic` callable from native Android and iOS |
| 3 | Full cross-stack path: OpenAPI → REST endpoint → Ktor client → native UI |

Web (`web/`) is a fourth consumer of the same OpenAPI contract (React +
path-filtered CI).

## Auth (v1)

Locked for `adult-auth-magic-link` (see archive spec):

| Topic | Decision |
|--------|----------|
| Proof | Email one-time code only (no magic link in v1) |
| Session | Opaque **Bearer** token on web + Android + iOS |
| First verify | Auto-create adult; `displayName` set when creating a family circle |
| Persistence | Postgres + Flyway; Testcontainers in backend integration tests |
| Dev mail | `LoggingAuthMailPort` + optional `app.auth.dev-code-echo` |
| Prod mail | Upcoming `auth-email-delivery` (pre-beta) |
| Web hardening | Upcoming `web-auth-session-hardening` (HTTP-only cookie; pre-beta) |
| Mobile tokens | Android `EncryptedSharedPreferences`; iOS Keychain |
| Unreachable ≠ expired | Clients tell "backend not reachable" (`AuthApiException.unreachable` on mobile) apart from "server rejected the token". Only a rejection clears the stored token, and it clears **locally** (`AuthSession.clearLocalSession()`) — never via a second network call, which is what crashed Android restore. A blip keeps the session so a retry works. A failed circle load shows **Retry**, never Create family (a failure says nothing about whether a circle exists). **Sign out** always drops the local session even when the server call fails. Web + Android follow this; **iOS** still bounces to the sign-in screen on an unreachable `/api/auth/me` (token kept, no crash) — parity is a follow-up |

Modulith module: `backend/modules/auth/`. Contract paths under `/api/auth/*`.
Public surface for other modules: `AdultSessionApi` (resolve Bearer adult,
look up adult by id, update `displayName`).

## Family circle (v1)

Locked for `family-circle-and-kids` + `family-adult-invites-roles` +
`named-places` + `place-geocoding` + `activity-feed-subscribe` +
`activity-feed-poller` + `manual-events` + `family-calendar-surface` +
`app-shell-navigation` (client shell IA) + `event-leave-by-estimate` +
`coverage-confirm-decline` + `conflict-detection` + `calendar-client-cache` +
`agenda-leave-by-async` + `team-carpool-space-invite` + `garage-vehicles` +
`carpool-request-accept`:

| Topic | Decision |
|--------|----------|
| Cardinality | **At most one** circle membership per adult (multi-circle → parking) |
| Create | Required adult display name; optional circle name (UI: “Your family”) |
| Role on create | `ORGANIZER` |
| Invite | One active **short code** per circle; Organizer views/regenerates (no TTL); share out of band |
| Join | Signed-in adult with no membership accepts code → **CAREGIVER**; already a member → **409** |
| Promote / demote | Organizer may change roles; circle always keeps **≥1 Organizer** |
| Leave | Caregiver anytime; Organizer only if another Organizer remains; sole Organizer only if alone + **zero kids** |
| Writes | **Organizer-only:** invite regen, members/roles, rename circle, kids CRUD, **activity feed** CRUD + Sync now, **Enable carpool** on a circle feed. **Any member:** named places (+ retry locate), **manual events**, **calendar agenda read**, **own leave-from** per calendar item, **own default leave-from**, **RSVP** per kid on a calendar item, **coverage** assign/reassign/remove (any member) + confirm/decline (assignee only), **carpool** join-by-code / request / leave (owner leave only if sole member circle; owning-circle adults regenerate invite), **ride** request / accept / cancel / withdraw on a member space (Accept needs `drives=true` + a vehicle the adult may drive), **garage** (read all vehicles + every member’s `drives`; PATCH **own** `drives`; add/edit/delete **own** vehicles only). All members may read circle (Caregivers omit feed manage UI) |
| Kid | Stable id + display name only (no birth year / player vs sibling type) |
| Place | Circle-scoped label + free-text address; **unique name per circle** (trim + case-insensitive); optional WGS84 `latitude`/`longitude` |
| Garage | Circle-visible vehicles — **not** 1:1 adult→car. **Owner** = creator (owner-only edit/delete). **`driverAdultIds`**: 1+ members, must include owner, default `[owner]`; same named place does **not** imply sharing. Membership **`drives`** (default true) is “I don’t drive,” not a role; toggling does not delete cars. Identity: nickname `label` unique per owner + **year + make + model** from server-side vPIC (no VIN). **Seats** = total capacity **including the driver** (2–18), always overridable; `suggestedSeats` is a last hint only |
| Geocoding | **Nominatim** (OSM) via `GeocoderPort`; address→coords **cache**; ~1 req/s + identifying User-Agent; create/update **soft-fail** (place saved, coords null on miss/error); `POST .../places/{id}/locate` retries; clients show Located / Not located + Retry locate. Same cache path geocodes event free-text `location` for leave-by destinations (public `FamilyGeocodeApi`). **Prod deploy:** set `GEOCODE_USER_AGENT` to a real contact (email or public app URL) — placeholder/`example.com` contacts get **403** from public Nominatim |
| Activity feeds | Circle-scoped iCal/webcal subscription (`name`, normalized `sourceUrl`, 0+ `kidIds`); **auto-sync** on create and URL change + explicit **Sync now**; soft-fail writes `lastSyncError` (prior event snapshot kept); successful sync **upserts by iCal `UID`** (stable event UUIDs for Agenda / coverage / leave-from) and deletes only removed UIDs; null-UID rows matched by summary/starts/ends/location fingerprint when possible; duplicate normalized URL → **409**; invalid kid id → **400**; `webcal://` → `https://` for fetch. **Import never joins a carpool space** and never returns other families’ membership. **Background poll** (`FeedsPoller`): default **30 minutes** (`FEEDS_POLL_INTERVAL_MS`); toggle with `FEEDS_POLL_ENABLED` (off in CI/tests); sequential sync with short inter-feed delay; reuses the Sync now path; **single app instance assumed** for v1 (no multi-replica lease). Clients: Organizer **Refresh** re-GETs the feeds list only (does not sync-all); Sync now stays per-feed. Public `FeedsApi` (`listByCircle`, `findByCircleAndNormalizedUrl`, `ensureFeed` create-if-absent + sync) for other modules — HTTP mutations stay Organizer-only. CI uses stub fetch + fixture `.ics` files — no live vendor hosts. **Prod:** set `FEEDS_USER_AGENT` to a real contact (same spirit as geocoding) |
| Manual events | Circle-scoped one-offs (`title`, `startsAt`, optional `endsAt`/`location`, **1+ `kidIds`**); any member CRUD via `/events`; hard delete; list API remains; separate from feed snapshots (`events` module). Primary client UX is **Agenda** (not a dedicated manage-events list) |
| Calendar agenda | Unified `GET /api/family/circle/calendar?from&to` (`[from, to)`); any member; merges manual + feed items ordered by `startsAt`; feed rows carry feed kid links + `feedName`; each row has **cheap** leave-from + leave-by for the current adult (DB / cache only — **no Nominatim or OSRM HTTP**; see Leave-by below), **circle-visible `rsvps`** (Yes / No / No response per kid; missing ≡ No response), **circle-visible coverage** (`coverages` + `uncoveredKidIds` — in-play kids only; **No** kids never uncovered), and **server-computed `conflicts`** (kid time-overlap ignores No kids + adult coverage-overlap amber; overlap on event `startsAt`/`endsAt` only — see Conflict detection below); clients load **local today → +30d**, then **Load more** appends the next 30-day page (same API); optional kid filter; manual writes from agenda; Sync now / feed writes reload the loaded range; **client calendar cache** (web `localStorage` / mobile `CalendarCacheStore`) persists the last successful window per `(adultId, circleId)`, paints Agenda immediately on Ready / re-sign-in for the same adult (stale-while-revalidate), soft-TTL refresh when returning to Calendar (~5m), patches snapshot on single-item mutations (leave-from, RSVP, coverage), clears on **leave circle** (not sign-out); **family bootstrap cache** (last Ready shell: circle + invite + feeds per adult) paints the signed-in shell **before** `getCircle` so Agenda is never blocked on a full-screen spinner — follow-up **`ETag` / `304` on this cheap list** (not live OSRM) → [`calendar-conditional-get`](specs/planned/calendar-conditional-get.md); month grid → `family-calendar-grid` |
| RSVP | Per **kid** + calendar item (`MANUAL` \| `FEED` + item id): `YES` \| `NO` \| `NO_RESPONSE` (missing row ≡ No response; no implied Yes). Any member may set. Out of play when **every** kid is No — clients deemphasize and hide leave-by / leave-from / coverage / conflict chrome; RSVP + manual Edit/Remove stay. Assign / confirm coverage → `ensureYes` for those kids; cannot assign a No kid (**400**). PUT No / No response with active coverage → **hard-release** that kid (client confirm: `This will remove coverage for {kidName}.`). Modulith: `backend/modules/rsvp/`; HTTP under calendar (`PUT …/rsvps/{kidId}`) |
| Coverage | **Responsibility** for kid(s) on a calendar item — not seats, vehicles, or trips (those → carpool). Many rows per item; each row = covering adult + non-empty kid subset + `PENDING`\|`CONFIRMED`\|`DECLINED`. Any member may assign / reassign / remove; assignee confirms or declines; **self-assign → `CONFIRMED`**. Kid exclusive across **active** (`PENDING`\|`CONFIRMED`) rows on the same item; multi-kid per adult OK. Declined kids count as uncovered. **409** if confirm / self-assign would leave the same adult with two **CONFIRMED** coverages on overlapping events. Assign/confirm also set RSVP Yes (calendar orchestrates). Modulith: `backend/modules/coverage/`; HTTP under `/api/family/circle/calendar/...` (calendar controllers call `CoverageApi`). Amber conflict chrome → Conflict detection below / [`agenda-coverage-web-contract.md`](agenda-coverage-web-contract.md) |
| Carpool | Opt-in **team space** keyed **one per normalized feed URL**. Membership is the **circle**. Organizer **Enable** owns; join by **code** (`ensureFeed` if URL missing) or **request** (owner admit/decline, in-app). **Ride requests** are space + feed-event scoped (`PENDING` \| `ACCEPTED` \| `CANCELLED`); members see kid first names, seats, and pickup address. HTTP `/api/carpool/*`. See Team carpool space below |
| Leave-by | Per **signed-in adult** + calendar item (`source` + `id`): optional leave-from place override. Origin resolution order: **per-item override → membership default leave-from → first located place by name**. Estimate: `leaveBy ≈ startsAt − (travelDuration × TOD multiplier + fixedBuffer)` — math is in-process; **not** stored on the event. **Cheap list** never calls Nominatim/OSRM HTTP (`PENDING` on cache miss; `OK` when dest + duration are already in DB; `UNAVAILABLE` + `NO_ORIGIN` / `NO_DESTINATION` without fill-in). **Fill-in** is `GET /api/family/circle/calendar/leave-by?from&to` (full enrich, `OK` \| `UNAVAILABLE` only). Single-item mutation responses (leave-from PUT, RSVP PUT, coverage writes) still **fully enrich that one row**. Clients paint Agenda from the cheap list/cache **before** fill-in; near-term `[localTodayStart, +2 calendar days)` first, then the rest of the loaded window; Load more fills that page after near-term. Destination geocode reuses **`geocode_cache`** (`FamilyGeocodeApi`); driving duration is **`leaveby_route_cache`** (successful OSRM only). Recovery: origin via leave-from / Places locate / default leave-from; MANUAL destination via edit `location`; no lat/lng editors; no FEED destination override in this slice. Activity-type arrival lead times → [`event-arrival-lead-time`](specs/planned/event-arrival-lead-time.md). **OSRM is PoC-free routing**; upgrade path parked as [`paid-live-traffic`](roadmap.md) |
| Empty circle | Allowed (add kids / places / feeds / manual events later) |
| Signed-in shell | **Client IA only** (`app-shell-navigation`): four destinations in order **Calendar → Carpool → Family → More/Settings**. Calendar = Agenda; **Carpool** = team spaces (per-feed status, Enable for Organizers, Have a code, request/admit/decline, member **circle names**, **upcoming feed rides** with Request / Accept / Pass / Cancel / Withdraw on web); Family = circle/invite/members/kids/leave; More (mobile) / Settings (web) groups **General** (Places, **Garage** for all members; Feeds for Organizers only — Caregiver row omitted, with the same per-feed carpool chrome as the Carpool tab) and **Account** (email/role, danger-styled Sign out). Chrome adapts: **bottom tabs** on iOS/Android, **sidebar** on web (not a tab-bar clone). Shell appears only in Ready (has circle); default landing **Calendar**. Auth and create/join stay outside the shell |

**Write authorization (three intentional categories):**

1. **Organizer plumbing** — who is in the circle and how external calendars are
   wired: kids, invite/roles, circle rename, **activity feeds** (+ Sync now /
   poller), **Enable carpool** (first family owns the team space). Caregivers
   consume synced feed events via the **calendar Agenda**; they do not manage
   subscribe URLs. They may join a carpool by code (which can `ensureFeed`).
2. **Any-member household content** — day-to-day shared facts everyone may
   contribute: **named places** (+ retry locate) and **manual events**. Same
   write policy for both; no creator-only edit rules in v1. **Leave-from**
   (per-item override + **default leave-from** on membership) is any-member
   but **per adult**. **Coverage** assign/reassign/remove is any-member
   shared intent; confirm/decline is assignee-only. **Carpool rides**
   (request / cancel as requesting circle; accept / withdraw as accepting
   circle) are any space-member adult — Accept additionally requires
   `drives=true` and a vehicle the adult may drive.
3. **Owner-only garage vehicles** — the circle **reads** every vehicle and
   every member’s `drives` flag. **Writes** (label, year/make/model, seats,
   driver list, kept-at place, delete) are **creator/owner only**, including
   when a listed driver or Organizer is not the owner. **`drives`** is
   own-flag only (not a role). Unlike places, garage **does** use creator-only
   edit. Same named place does **not** grant driving rights.

Modulith modules: `backend/modules/family/` (circle, kids, places, membership
API + public `FamilyPlaceApi` / `FamilyGeocodeApi` / `FamilyGarageApi`), `backend/modules/feeds/`
(subscriptions + synced events), `backend/modules/events/` (manual events),
`backend/modules/leaveby/` (OSRM port, leave-from persistence, estimate math),
`backend/modules/coverage/` (assignment rows + confirm/decline rules),
`backend/modules/rsvp/` (per-kid attendance Yes/No/No response),
`backend/modules/calendar/` (orchestrates feeds + events public APIs into
the unified agenda read and composes leave-by + coverage + RSVP enrichment — no
imports of other modules’ `internal` packages), and `backend/modules/carpool/`
(team spaces keyed by normalized feed URL + ride request/accept). Family/calendar contract paths under
`/api/family/*`; carpool HTTP under `/api/carpool/*`. Family public surface used
by feeds, events, calendar, leaveby, coverage, rsvp, and carpool:
`FamilyMembershipApi` (`requireOrganizerCircleId` / `requireMemberCircleId` /
`requireMemberRole` / `findCircles` → `FamilyCircleName`, adult-in-circle
checks, validate kids, kid display names for ride snapshots), `FamilyPlaceApi`
(includes `findDefaultLeaveFromForMember` and pickup-place lookup with address
even when unlocated), `FamilyGeocodeApi`, `FamilyGarageApi` (circle garage
snapshot: `drives` + vehicles with owner and `driverAdultIds` — for ride seat
math without importing `family.internal`). Feeds public surface used by carpool:
`FeedsApi` + `FeedCalendarApi` (events in range + nullable iCal `uid`). Auth
public surface used by family: `AdultSessionApi` (`requireCurrentAdult`,
`requireAdult`, `updateDisplayName`). Leaveby public surface used by calendar:
`LeaveByApi`. Coverage public surface used by calendar: `CoverageApi`. Rsvp
public surface used by calendar and carpool: `RsvpApi`.

**How objects link (extensible):**

- **Adult** ↔ **circle** via membership (+ role `ORGANIZER` | `CAREGIVER`)
- **Invite code** lives on the circle (not per-member)
- **Kid** belongs to a **circle**
- **Place** belongs to a **circle** (shared origins for leave-by / coverage);
  coords come from geocoding the address, not manual entry
- **Vehicle** belongs to a **circle**, **owned** by one adult (cascade-delete
  owned cars on leave/remove; drop that adult from other cars’ driver lists).
  **Who may drive** is an explicit `driverAdultIds` list (owner always
  included). Optional **kept-at** named place is grouping only — not sharing.
  Seat count is one integer including the driver. Make/model/year lists and
  seat hints come from **server-side vPIC** (clients never call NHTSA; no VIN).
- **ActivityFeed** belongs to a **circle**; **feed↔kid** links mean “on this
  team / calendar.” Sibling vs player is not a kid kind — it falls out of whether
  a kid has feed links. **CarpoolSpace** is a separate opt-in (parent invite),
  keyed by the same **normalized feed URL** (not the feed UUID); membership is
  the circle. Synced **FeedEvent** rows are feed-scoped storage composed into the
  Agenda via `family-calendar-surface`; manage-feeds only exposes sync status +
  event count.
- **ManualEvent** belongs to a **circle** with **1+ kids**; not owned by a feed;
  not touched by Sync now / poller.
- **Leave-from override** is per **adult** + calendar item (`MANUAL`|`FEED` +
  item id) → a circle **Place**; not shared across adults. **Default
  leave-from** is per **membership** → a located circle **Place**. Leave-by
  estimates are computed for the signed-in adult only (cheap list from caches;
  fill-in / one-row mutations may call Nominatim + OSRM). Travel seconds are
  not stored on the event.
- **Coverage assignment** belongs to a calendar item (`MANUAL`|`FEED` + item
  id) with covering adult + kid subset + status; visible to all circle members
  on Agenda. Not a vehicle/trip plan — garage stores capacity and who may
  drive; **RideRequest** (below) is the trip seat loop.
- **RSVP** belongs to a calendar item + kid (`YES`|`NO`; missing ≡ `NO_RESPONSE`);
  circle-visible; attendance is separate from coverage responsibility.
- **RideRequest** belongs to a **CarpoolSpace** + feed **eventKey**
  (`UID:<icalUid>` or fingerprint) + requesting circle. Snapshots kid first
  names and pickup place name+address at create. Default kids = not RSVP NO
  (YES + No response) and not already on an ACCEPTED ride; create leaves RSVP
  unchanged. Status `PENDING` \| `ACCEPTED` \| `CANCELLED`. Accept records
  accepting adult/circle + vehicle and sets RSVP YES for kids on that ride;
  seat math is `remaining = vehicle.seats − 1 − accepter’s RSVP YES kids`.
  Coverage does not occupy seats. v1: both legs; one `ACCEPTED` ride per
  vehicle per event; no partial accept.

```
Adult --membership(+role, default leave-from?, drives)--> FamilyCircle <-- Kid
                                  |
                             invite_code
                                  |
                               Place (+ optional lat/lng)
                                  |
                    Vehicle --owner--> Adult
                    Vehicle --drivers--> Adult(s)  (must include owner)
                    Vehicle --kept at?--> Place
                                  |
                             ActivityFeed --feed↔kid--> Kid
                                  |
                            FeedEvent (UID snapshot)
                                  |
                    CarpoolSpace --normalized URL--> (same URL as a feed)
                    CarpoolSpace --membership(+OWNER|MEMBER)--> FamilyCircle
                    CarpoolSpace --RideRequest--> eventKey + requesting circle
                                  |
                             ManualEvent --event↔kid--> Kid
                                  |
Adult --leave-from override--> (source + itemId) --> Place
Adult --coverage assignment--> (source + itemId) + Kid(s)
Adult --RSVP--> (source + itemId) + Kid
```

### Circle garage (detail)

Locked for [`garage-vehicles`](specs/archive/garage-vehicles.md) (lives in the
**`family`** module — no separate garage module):

| Topic | Decision |
|--------|----------|
| Visibility | Circle **read**; **owner-only** vehicle writes. Organizer cannot edit Grandma’s cars |
| Don’t drive | Membership `drives`, default **true**. Not a role. Toggling does not delete vehicles or strip driver lists |
| Sharing | Explicit **`driverAdultIds`** (owner always included). Place / house does **not** imply sharing |
| Kept at | Optional named place for grouping; default leave-from when set |
| Identity | Nickname `label` unique **per owner**; **year + make + model** from vPIC lists; **no VIN** |
| Seats | One total capacity **including the driver**; integer 2–18; always overridable. `suggestedSeats` is last hint only |
| NHTSA | Server-side `VpicPort` only (`http` default; `stub` in tests). Seat hint from make/model/year (internal decode OK); soft-fail; clients never call NHTSA |
| HTTP | `/api/family/circle/garage*` under Bearer. Public **`FamilyGarageApi`** |
| Clients | More / Settings → **Garage** (all members). Caregiver sees Garage, not Feeds |
| Out of scope | Seat kinds → `garage-seat-kinds` |

### Team carpool space (detail)

Locked for [`team-carpool-space-invite`](specs/archive/team-carpool-space-invite.md)
+ [`carpool-request-accept`](specs/archive/carpool-request-accept.md)
+ [`agenda-focus-carpool-actions`](specs/archive/agenda-focus-carpool-actions.md):

| Topic | Decision |
|--------|----------|
| Identity | **One space per normalized feed URL** (trim; `webcal://` → `https://`). Same real-world team under two URLs → two spaces (no merge). Feed UUID is not the key |
| Membership | The **family circle** (every adult in the household). A circle may belong to many spaces |
| Enable | **Organizer-only** on a circle feed with no space yet; that circle **owns**; client confirms ownership first. Caregiver → **403**. Duplicate URL → **409** |
| Code join | Admit the circle as MEMBER; `FeedsApi.ensureFeed` if the URL is missing (space name, **0 kids**, then auto-sync). Caregiver redeem OK. Already a member → **409**. Unknown / regenerated code or no circle → **404**. Clients reload Feeds + the current Agenda window after join |
| Request (join) | Same-URL subscriber, not a member (`AVAILABLE`); owner-circle adults Admit / Decline in-app (no email/push). Duplicate PENDING → **409**. After Decline they may request again |
| Invite | Short **code** (same alphabet/length as family invites); any member may copy; owning circle regenerates (old code stops working); no TTL |
| Leave | Member anytime. Owner only if they are the **sole** member circle (space is then deleted). Otherwise **409** |
| Existence | Same-URL non-members may see **that a space exists** (name + Request / Have a code). They do not see members, code, or rides until joined |
| Rides | Space-scoped **RideRequest** on upcoming **feed** events (same local today → +30d spirit as Agenda). `defaultKidIds` / create default = feed-linked kids who are **not RSVP NO** (YES and No response) and not already on this circle’s ACCEPTED ride (subset override OK). **Create does not change RSVP** (requested kids may stay No response). Pickup = requester house address snapshot. Accept: other circle, `drives=true`, vehicle with enough remaining seats (`seats − 1 − own YES kids`), at most one ACCEPTED ride per vehicle per event; **successful Accept sets RSVP YES for kids on that ride** (requesting circle). Cancel / Withdraw / Pass do not auto-change RSVP. **Pass**: per-adult decline of a `PENDING` ask (request stays `PENDING` for others; list marks `passedByMe`; cleared on Accept/Cancel). Cancel (requesting) / Withdraw (accepting). Coverage orthogonal. No ride fields on `CalendarItem` |
| Clients | **Web Calendar / Agenda is the primary ride surface** — carpool-eligible FEED rows Request / status; Focus CTA precedence Confirm → Accept/Pass → **Request** (Assign secondary if remaining coverage gap) → Assign → calm (family decisions beat ride Accepts in Today/Tomorrow ranking). **Calendar is self-sufficient for reverse actions when those states are shown** (Focus is not duplicated in the day list): outline **Cancel** for own `PENDING`/`ACCEPTED` on Focus; outline **Withdraw** for accepted-by-us on Focus and on expanded rows. Expanded rows keep Request/Cancel for own request — **no** Accept/Pass on rows. **Ride-line density** matches Carpool tab fields (shared `carpoolDisplay` helpers): Focus Accept/Pass incoming = requesting circle · kid first names · **seats** · pickup (`place, address`); Focus + expanded own request = Calendar status (`Requested` / `Riding with {circle}`) · kids · seats · pickup (chips unchanged); Focus + expanded accepted-by-us = requesting circle · kids · seats · pickup (not chip-only / kids-only). **ACCEPTED own ride is not a Calendar coverage gap** in chrome: Needs coverage / Assign / Focus family-decision use remaining gap kids (`uncoveredKidIds` minus ACCEPTED `ownRequest.kidIds`); API `uncoveredKidIds` stays orthogonal. Status copy **Riding with {accepting circle}** (not “Accepted ·”). **Carpool tab** remains membership + secondary ride list (**Pass** on PENDING other asks when `!passedByMe`; Accept-after-Pass kept; no un-pass; same requestable-kid rules; may keep “Accepted by {circle}”). **Feeds** (Organizer) keeps per-feed Enable / Request / Owned chrome. Caregivers never gain Feeds manage. Android/iOS Agenda/Focus ride UI is parked (`carpool-request-accept-mobile`, `agenda-focus-card-mobile`); `sharedLogic` clients cover ride + pass paths |
| Out of scope | Partial accept; merge two families onto one vehicle (multi-stop); legs / meet-at / early-late; un-pass; least-privilege nanny roster → parked `carpool-least-privilege`; vehicles live in the **family garage** |

### Leave-by estimate (detail)

Locked for `event-leave-by-estimate` + [`agenda-leave-by-async`](specs/archive/agenda-leave-by-async.md):

| Topic | Decision |
|--------|----------|
| Formula | `leaveBy ≈ startsAt − (travelSeconds × TOD multiplier + fixedBufferSeconds)` |
| TOD | Peak vs off-peak multipliers; peak windows use `startsAt` hour in **UTC** (config under `app.leaveby.*`) |
| Travel | OSRM driving duration when origin place and destination geocode both have coords |
| Cheap list | `GET …/calendar` **must not** invoke Nominatim or OSRM HTTP. It may read `geocode_cache` + `leaveby_route_cache` and run the math in-process. Warm unique venues can return `OK` with no fill-in. Cache miss (needs HTTP) → `PENDING` (no `leaveByAt`). Settled without HTTP: `UNAVAILABLE` + `NO_ORIGIN` / `NO_DESTINATION` |
| Fill-in | `GET …/calendar/leave-by?from&to` — same auth and `[from, to)` as the list; returns `CalendarLeaveBy` (`OK` \| `UNAVAILABLE`, never `PENDING`). Soft-fail per row. Clients patch by `(source, id)`. Leave-from PUT and coverage mutation responses still fully enrich that one `CalendarItem` |
| Dest geocode | Existing **`geocode_cache`** via `FamilyGeocodeApi` (trim + lower-case key). Hit → coords, no Nominatim. Miss → Nominatim on fill-in/enrich only; persist **successful** coords only |
| Route cache | **`leaveby_route_cache`** in the `leaveby` module; key = origin + dest coords rounded to 6 decimal places (same as the OSRM request). Hit → seconds, no OSRM HTTP. Miss → OSRM; persist **successful** durations only. Do **not** cache Nominatim misses, OSRM failures, or the config fallback duration |
| Duplicate venues | One fill-in (or cheap cache-read) resolves each distinct normalized location **once** and each origin+dest pair **once**, then applies the result to matching rows |
| Soft-fail | Blank location → `NO_DESTINATION`; geocode miss → `GEOCODE_FAILED`; no located origin → `NO_ORIGIN`; neither list nor fill-in fails the whole response for a single bad row |
| OSRM down | Config `fallback-duration-seconds`; status still `OK` and UI still says **estimate**; fallback is **not** written to `leaveby_route_cache` so the next fill-in may retry |
| Default origin | **Override → membership default leave-from → first located place by name** (case-insensitive); else `UNAVAILABLE` |
| Client fill-in | Paint Agenda from cache and/or cheap list **without waiting** on leave-by. Then fill near-term (`localTodayStart` + 2 calendar days) intersected with the loaded window, then the remainder. Load more fills **that page’s** `[from, to)` only, after near-term for the initial window. Cheap `PENDING` with unchanged origin keeps cached `OK`/`UNAVAILABLE` until fill-in (avoid flicker); origin change drops stale `OK` to `PENDING`. Fill-in always overwrites matching rows. Fill-in failure keeps last known leave-by |
| UI copy | Always **estimate** — never “live traffic” / “ETA”. While `PENDING`: **Estimating leave-by…** on the leave-by line only (leave-from / coverage stay interactive) |
| ETag | Not on this slice. Conditional GET (`ETag` / `304`) belongs on the **cheap list** payload — [`calendar-conditional-get`](specs/planned/calendar-conditional-get.md) |
| Not in this slice | Activity-type arrival lead times → [`event-arrival-lead-time`](specs/planned/event-arrival-lead-time.md) |
| Routing upgrade | OSRM is free/self-hostable **PoC** routing. If leave-by proves value, replace or supplement with a paid live-traffic provider — parked as [`paid-live-traffic`](roadmap.md) |

### Coverage (detail)

Locked for `coverage-confirm-decline`:

| Topic | Decision |
|--------|----------|
| Meaning | Who is **responsible** for which kid(s) on an Agenda item |
| Status | `PENDING` (assigned to someone else), `CONFIRMED` (self-assign or assignee OK), `DECLINED` |
| Authz | Assign / reassign / remove: any member. Confirm / decline: covering adult only (**403** otherwise) |
| Kids | Non-empty subset of item kids; exclusive on active rows; multi-kid per adult OK |
| Leave-from | Not on the coverage row — reuse leave-by (default + per-item override) |
| Client UX | Web is the reference client — see [`agenda-coverage-web-contract.md`](agenda-coverage-web-contract.md) (stable). iOS/Android ports match that contract. **Coverage API stays orthogonal to rides** (`uncoveredKidIds` unchanged when a teammate accepts). Calendar / Focus chrome interprets an **ACCEPTED** own ride as clearing those kids from the coverage gap (Needs coverage / Assign / family-decision); PENDING does not |
| Double-CONFIRMED | Confirm / self-assign auto-confirm that would create two CONFIRMED coverages for the same adult on overlapping events → **409**; PENDING overlaps stay allowed (amber) |
| Out of scope | Travel/leave-by soft warn → `conflict-travel-margin`; seats / vehicles → family garage; trip seat math → Carpool **RideRequest** |

Config / CI: `LEAVEBY_OSRM_PROVIDER` (`http` \| `stub`), `LEAVEBY_OSRM_BASE_URL`, buffer / multipliers / fallback env vars under `app.leaveby`. Tests force stub OSRM + stub geocode (no live public hosts).

### Conflict detection (detail)

Locked for [`conflict-detection`](specs/archive/conflict-detection.md):

| Topic | Decision |
|--------|----------|
| Overlap | Event `startsAt` / `endsAt` only (null `endsAt` → zero-length at start); half-open intervals; not leave-by / travel |
| Kid | Same kid on two overlapping items → amber `KID_TIME_OVERLAP` on both; creation still allowed |
| Adult amber | Same adult active (`PENDING`\|`CONFIRMED`) on overlapping items with at least one PENDING → amber `ADULT_COVERAGE_OVERLAP` |
| Adult hard | Two CONFIRMED on overlapping items never persisted → **409** on confirm / self-assign |
| Truth | Server enriches `CalendarItem.conflicts`; clients render only — no client re-derivation of overlap rules |
| UI | Amber status lines on the Agenda **item** (primary band); web contract is reference |

## Interaction UX

Locked for [`calendar-ux-flow`](specs/archive/calendar-ux-flow.md). Living reference
surface: **Calendar / Agenda** (web is the behavior reference —
[`agenda-coverage-web-contract.md`](agenda-coverage-web-contract.md); iOS/Android
match decisions and strings). Distinct custom UI — not a rideshare clone.
Inspiration only: [Laws of UX that Uber follows](https://medium.com/design-bootcamp/laws-of-ux-that-uber-follows-fa7c6619748b).

### Tenets

| Tenet | Meaning for this product |
|--------|---------------------------|
| Aesthetic-Usability | Clear hierarchy and spacing make Agenda feel usable, not sparse chrome |
| Doherty | Focused busy feedback (Save → Saving…, Load more → Loading…) feels instant; **Sign out** never becomes Working… |
| Fitts | Primary actions are large enough and easy to hit (especially mobile) |
| Hick | Few choices per step; sole-option defaults / field rows; one emphasized CTA when present |
| Proximity / Similarity | Critically grouped bands within an Agenda item; consistent control patterns across clients |

### Presentation choice A (spacing / proximity only)

- Group with hierarchy, type weight, and spacing.
- **No** new card, muted band, or bordered subsection chrome inside Agenda items.
- Attribute **order / proximity** may change after critical regroup; coverage /
  leave-from / compose **behavior and copy** stay on the Agenda contract.

### Busy ladder

When a surface feels too dense:

1. Regroup + hierarchy (proximity, type weight, one primary CTA)
2. Slight type/spacing tuning — **from the destination mock**, via tokens
   (`docs/ui-system.md`); not “nearest existing role”
3. Expand/collapse dense blocks — **not** until dogfood says hierarchy failed
   (possible follow-up id, e.g. `calendar-ux-disclosure`)
4. Navigate away — only for real destination jobs (event compose; Open Places
   for `NO_ORIGIN`; Carpool tab for membership / secondary ride list). Ride
   Request / Accept / Pass / Cancel / Withdraw stay reachable on Calendar
   Agenda + Focus when those states are shown — no nested Agenda attribute
   screens for fields that belong on the item.

### Forward-looking seams (structure only)

- Agenda: schedule + RSVP attendance + coverage responsibility + leave-by +
  conflict amber + **carpool ride request/status** on eligible FEED rows;
  Focus may surface Accept/Pass or **Request** (exactly one card; CTA
  precedence Confirm → Accept/Pass → Request → Assign) plus outline Cancel /
  Withdraw when own PENDING/ACCEPTED or accepted-by-us applies. Request does
  not require prior RSVP Yes; Accept sets Yes for kids on the ride.
- Conflict chrome attaches to the **item**, not a new control dump (shipped).
- Per-coverage leave-from is a later product slice; don’t bury leave-from where
  it can’t grow.
- Carpool destination stays membership + secondary ride list (including Pass
  on PENDING other asks) — do not build a second “open asks” inbox on Context /
  week glance; Calendar is primary and self-sufficient for ride actions
  including Cancel / Withdraw when those states are shown.

## Repository layout

```
family-carpool/
├── backend/              # Spring Boot app + Modulith modules (root Gradle build)
│   └── modules/
│       ├── auth/         # Email OTP + Bearer sessions
│       ├── family/       # Family circle + kids + named places (+ geocode) + garage
│       ├── feeds/        # Activity feed subscribe + sync + background poller
│       ├── events/       # Manual (non-feed) circle events
│       ├── leaveby/      # Leave-from + OSRM estimate + route duration cache
│       ├── coverage/     # Who covers which kids on a calendar item
│       ├── rsvp/         # Per-kid Yes / No / No response on a calendar item
│       ├── calendar/     # Cheap agenda list + leave-by fill-in + coverage + RSVP
│       └── carpool/      # Team spaces (one per feed URL; circle membership)
├── mobile/               # Separate Gradle build (KMP)
│   ├── sharedLogic/      # Auth + family + carpool clients + token + calendar cache stores
│   ├── sharedUI/         # Compose Multiplatform (Android signed-in shell + destinations)
│   ├── androidApp/       # Jetpack Compose entry
│   └── iosApp/           # Native SwiftUI TabView shell (Xcode project)
├── contracts/
│   └── openapi.yaml      # API source of truth
├── build-logic/          # Backend convention plugins
├── docs/
│   ├── context.md        # agent doc map (on demand; not always-on)
│   ├── architecture.md   # ← this file (read by heading)
│   ├── using-as-template.md
│   ├── roadmap.md        # product backlog (navigation, not implement context)
│   └── specs/            # planned/ + active/ + archive/
└── web/                  # Vite + React + TypeScript (npm; separate from Gradle)
```

**Two independent Gradle builds** plus a separate **npm** web app, one git repo.
Backend root is the repo root; mobile is under `mobile/`; web is under `web/`.
Gradle builds share no Gradle code with each other or with web — only
`contracts/openapi.yaml` connects them.

## SDD workflow

`main` is protected: work lands only via pull request. **One active spec → one
feature branch → one PR.**

**Template lifecycle:** the upstream starter keeps a disposable `greeting` harness
until the first real product feature; **this product repo has already deleted
it.** Agents running `/spec` should skip the harness-deletion step when
`backend/modules/greeting/` is absent (see AGENTS.md).

Large product ideas go through the **roadmap** first; implementable slices still
use `/spec`.

```
/roadmap (optional carve-up / re-rank)
  →  /spec (on a feature branch)  →  /implement (one task at a time)
  →  commit at layer boundaries  →  /pr (archive spec + open PR)  →  merge
```

### Roadmap (product backlog)

- **One file:** `docs/roadmap.md` — living product backlog for this repo.
- **1:1 mapping:** each kebab-case backlog **id** ↔ one spec
  (`docs/specs/planned|active|archive/<id>.md`) when that spec exists.
- **`/roadmap`** — carve up big ideas, add enhancements, **re-rank** upcoming
  items, resolve conflicts with in-progress work. Rank **1** = Next up.
- **Item status:** `parking` → `planned` → `active` → `done` (or `cancelled`).
- **Provenance:** each row’s **Added** field (`initial` / `enhancement` /
  `re-rank split`) distinguishes original carve-up from later ideas.
- **Active specs are locked** for re-rank; conflicting roadmap changes must
  finish, amend, or abandon the active spec first — never silently.
- Optional thin stubs: `docs/specs/planned/<id>.md` (sketch only). `/spec`
  promotes and fleshes them out. If a stub or draft spec grows past one PR,
  **split via `/roadmap`** (`re-rank split`) — never fatten into a mega-spec.

If an idea is clearly one PR-sized slice, `/roadmap` redirects to `/spec`
instead of inventing a fake multi-item plan.

### Spec → implement → PR

1. **Branch + Spec** — From up-to-date `main`, create a branch named after the
   feature (kebab-case, e.g. `path-filtered-ci`). Prefer Next up from the
   roadmap when no name is given. Copy or promote into
   `docs/specs/active/<feature>.md`. Write problem, non-goals, **Context**
   (allowlist of design/architecture **sections** and source entry points),
   acceptance criteria, and tasks by layer. Do not implement until the spec is
   approved. Prefer a **new chat** for `/implement` and another for `/pr`
   (`docs/context.md`). Tiny non-spec fixes still use a short-lived branch +
   PR; they just skip the spec file.

2. **Checkpoint commit** — Before any multi-file change:
   `git commit -m "checkpoint: before <feature-name>"`.

3. **Implement** — One unchecked task at a time (`/implement`) on the feature
   branch — not on `main`. Each task includes its test; run the relevant suite
   before checking the box.

4. **Commit at layer boundaries** — Natural split points:
   - backend + contract
   - mobile `sharedLogic`
   - platform UI wiring (Android / iOS)
   - spec archive (usually via `/pr`)

5. **Close out** — Manual smoke where needed, check off acceptance criteria,
   then `/pr`: archive the spec to `docs/specs/archive/`, update roadmap Done /
   clear Active, push the branch, and open the PR. Merge when CI is green.

Cursor rules in `.cursor/rules/` enforce per-layer conventions; `AGENTS.md` is the
lean constitution (context-loading protocol). Doc map: `docs/context.md`.

## Cross-stack request flow

```mermaid
flowchart LR
    subgraph clients [Clients]
        Android[androidApp / sharedUI]
        iOS[iosApp / SwiftUI]
        Web[web / React]
    end

    subgraph mobile [mobile/sharedLogic]
        Client[AuthClient / AuthSession]
        ApiConfig[apiBaseUrl expect/actual]
    end

    subgraph webApp [web/src/api]
        WebClient[AuthClient]
    end

    subgraph contract [Contract]
        OpenAPI[contracts/openapi.yaml]
    end

    subgraph backend [backend]
        Controller[Module public controller]
        Service[Module internal service]
    end

    Android --> Client
    iOS --> Client
    Web --> WebClient
    Client --> ApiConfig
    Client -->|HTTP GET| Controller
    WebClient -->|HTTP GET| Controller
    OpenAPI --> Controller
    OpenAPI -.-> Client
    OpenAPI -.-> WebClient
    Controller --> Service
```

**Verified path today:** `POST /api/auth/request-code` → `POST /api/auth/verify-code`
→ Bearer token → `GET /api/auth/me` / `POST /api/auth/logout` on web, Android, and iOS.

## Backend (Spring Modulith)

- **Vertical slices** under `backend/modules/<name>/`, not horizontal layers.
- **`internal` sub-package** — invisible to other modules. Public APIs (controllers,
  DTOs, interfaces) live in the module's top-level package.
- **Cross-module communication** — Spring application events, not direct imports
  into another module's `internal` package.
- **Module discovery** — automatic from `backend/modules/`; do not edit
  `settings.gradle.kts` to add a module.
- **New module** — folder + `build.gradle.kts` with
  `plugins { id("quickapp.module-conventions") }` only; add extra deps in that
  file, not in the convention plugin (unless two+ modules need them).
- **Boundaries enforced by test** — `ModularityTests` calls
  `ApplicationModules.verify()`. Must pass before any backend PR merges.

### New endpoint checklist

1. Controller + response DTO in the module's **public** package.
2. Business logic in `internal`.
3. Update `contracts/openapi.yaml`.
4. Unit test for logic; `@SpringBootTest` + MockMvc integration test for the HTTP
   surface (Spring Boot 4 requires `spring-boot-starter-webmvc-test`).
5. Constructor injection only.

Run: `./gradlew :backend:test` and
`./gradlew :backend:test --tests ModularityTests`.

## Mobile (Kotlin Multiplatform)

### Layer responsibilities

| Layer | Owns |
|-------|------|
| `sharedLogic` | API clients, models, business logic, networking, `expect`/`actual` for platform config |
| `sharedUI` | Compose Multiplatform UI (Android uses this today; optional long-term) |
| `androidApp` | Android manifest, permissions, Compose entry (`MainActivity`) |
| `iosApp` | SwiftUI views, `Info.plist`, Xcode project |

**Rule:** HTTP calls live in `sharedLogic`, not in `androidApp` or `iosApp`.

### Networking pattern (established by kmp-networking-spike)

- **Ktor Client** — `ktor-client-core` + OkHttp (Android) + Darwin (iOS).
- **JSON** — kotlinx.serialization + Ktor ContentNegotiation.
- **Base URL** — `expect fun apiBaseUrl()` in commonMain:
  - Android (emulator/USB) → `http://127.0.0.1:8080` after
    `adb reverse tcp:8080 tcp:8080` (modern AVDs default to Wi‑Fi where
    `10.0.2.2` is only a gateway, so app sockets to it time out)
  - iOS simulator → `http://localhost:8080`
- **iOS Swift interop** — callback wrapper in `iosMain` (e.g. `AuthBridge`)
  rather than exposing `suspend` directly to SwiftUI.
- **Dev-only cleartext HTTP** — Android `network_security_config.xml` (`127.0.0.1`,
  localhost, `10.0.2.2`); iOS ATS exception for `localhost` in `Info.plist`.

### Running locally

| Target | How |
|--------|-----|
| Backend | `./gradlew :backend:bootRun` (repo root) |
| Android | Open `mobile/` in Android Studio → run `androidApp`; `installDebug` runs `adb reverse tcp:8080 tcp:8080` — re-run after emulator/`adb` reset |
| iOS | Open `mobile/iosApp/iosApp.xcodeproj` in Xcode → run on simulator |

Manual success signal: sign in with email OTP on each client (dev code echo / log
when enabled).

Run tests: `cd mobile && ./gradlew :sharedLogic:testAndroidHostTest :sharedLogic:iosSimulatorArm64Test`

## Contract-first API

- **Source of truth:** `contracts/openapi.yaml`
- **Required consumers on contract change:** **web** (`web/src/api/`). **Expo**
  API clients once `rn-expo-scaffold` exists. Do **not** update frozen KMP
  `sharedLogic` for new/changed paths (see `AGENTS.md` + roadmap Client ship
  order).
- **Legacy:** `mobile/sharedLogic` Ktor clients remain until `kmp-mobile-retire`;
  they are not part of the OpenAPI same-change rule anymore.
- **Client implementation today:** hand-written `fetch` in `web/src/api/`;
  Expo clients TBD; OpenAPI codegen is a follow-up.

## Testing strategy

| Layer | Automated | Manual |
|-------|-----------|--------|
| Backend module logic | Unit tests | — |
| Backend HTTP | MockMvc integration test | `curl` against running server |
| Modulith boundaries | `ModularityTests` | — |
| sharedLogic client | Ktor `MockEngine` in `commonTest` | — |
| Platform config | `androidHostTest` / `iosTest` | — |
| Native UI | Compile (`assembleDebug`, `xcodebuild`) | Emulator/simulator smoke |
| Web client / auth UI | Vitest + Testing Library | `npm run dev` against `bootRun` |

Never call work "done" without a passing test that would fail if the change were
reverted. Never weaken a test to make it pass.

## Git and build hygiene

- **`**/build/`** is gitignored. If build outputs appear in `git status`, they were
  committed before the ignore rule — remove with
  `git rm -r --cached <path>/build`.
- **Do not commit** Gradle problem reports or local IDE config.

## CI

Path-filtered GitHub Actions run on pull requests and pushes to `main`:

| Workflow | Paths | Job |
|----------|-------|-----|
| `.github/workflows/backend.yml` | `backend/**`, `build-logic/**`, `gradle/**`, root Gradle files, the workflow itself | `:backend:test` (JDK 25) on `ubuntu-latest` |
| `.github/workflows/mobile.yml` | `mobile/**`, the workflow itself | `:sharedLogic:testAndroidHostTest` + `:androidApp:assembleDebug` (JDK 21 + Android SDK) on `ubuntu-latest` |
| `.github/workflows/web.yml` | `web/**`, the workflow itself | Corepack-pinned npm + `npm ci` + lint + test + build (Node from `web/.nvmrc`) on `ubuntu-latest` |

Docs-only or unrelated-path changes do not start the irrelevant workflow.

### Operator setup (manual)

Branch protection on `main` is in effect (classic rules: require a pull request,
no force pushes, no deletions). Optionally require status checks `backend` /
`mobile` / `web` once those jobs have run at least once.

Land all work via feature branches and PRs. CI runs on the PR and again on push
to `main` after merge. See **SDD workflow** above for the branch-per-spec rule.

### CI follow-ups

- iOS CI (`macos-latest` / simulator tests)
- Contract validation (Spectral + spec/implementation diff) — see below
- Playwright e2e for real web product flows (auth UI uses Vitest only today)

## Not built yet

These are intentional gaps; add via spec when ready:

- OpenAPI code generation for clients
- Contract validation in CI (Spectral + spec/implementation diff)
- Shared design tokens across web / Compose / SwiftUI (look-and-feel consistency)
- Production SMTP/API mail (`auth-email-delivery`) and web cookie session hardening
- Production-grade error handling / normalized `sharedLogic` network errors

## When to add contract validation in CI

Add when **any** of these becomes true:

1. OpenAPI codegen is adopted for mobile or web
2. A second endpoint/module makes manual alignment error-prone
3. You want style/validity lint on `contracts/openapi.yaml` in every PR

Until then, `OpenApiContractTest`, auth integration tests, mobile `AuthClientTest`,
and web `AuthClient` / `AuthScreen` tests enforce contract alignment.
First CI step when ready: Spectral on `contracts/openapi.yaml` for validity/style.

## Adding a real feature (checklist)

1. `/roadmap` if the idea is multi-slice; else `/spec <feature-name>` — feature
   branch, scope, non-goals, acceptance criteria, tasks by layer.
2. If the API changes: update `contracts/openapi.yaml` first (or in the same PR as
   backend + all consumers).
3. Backend: new module or extend existing slice; controller public, logic `internal`.
4. Mobile: new or extended client in `sharedLogic`; wire UI on each platform.
5. Web: required before merge if contract changed.
6. Tests at each layer; manual smoke if UI/network involved.
7. `/pr` — archive spec, update `docs/roadmap.md` Done/Active, open the PR, merge
   when CI is green.

## Conventions (accumulate here)

Add an entry only after the same mistake happens twice (per AGENTS.md). Initial
entries from verified spikes:

- **Spring Boot 4 MockMvc** — use `spring-boot-starter-webmvc-test`; import
  `@AutoConfigureMockMvc` from `org.springframework.boot.webmvc.test.autoconfigure`.
- **Spring Boot 4 `@RequestParam`** — use explicit names (`@RequestParam("name")`)
  unless `-parameters` compiler flag is enabled project-wide.
- **Layer-boundary commits** — backend+contract, then sharedLogic, then platform UI.
