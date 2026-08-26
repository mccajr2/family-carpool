# Product roadmap

Status: active  
Updated: 2026-08-25 (`/pr calendar-item-event-key`)

Living backlog for this product repo. **One roadmap ↔ many specs** (1:1 by
kebab-case id). `/roadmap` updates and re-ranks; `/spec <id>` fleshes out the
next slice. Do not turn this file into a mega-spec.

**Agents:** load this file for `/roadmap`, `/spec` status updates, or “what's
next.” Do **not** load it for `/implement`. Current work is
`docs/specs/active/`. Skip **Roadmap history** unless asked.

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

**Clients (beta):** **Web** remains the product reference (OpenAPI → backend →
web). Mobile target is **Expo (React Native)**. Carpool **push** (request /
accept / deny) is a **pre-beta gate** — that pulls a thin Expo scaffold ahead
of full web polish, not lockstep feature parity. Do not ship every product
slice on web + RN together. KMP is **frozen**; retire via `kmp-mobile-retire`.

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
| Circle writes            | **Organizer-only:** kids, invite/roles, circle rename, **activity feeds** (+ Sync). **Any member:** **named places**, **manual events**. **Garage:** any member, **owner-only** vehicle writes (including who may drive); circle-visible read — `[garage-vehicles](specs/archive/garage-vehicles.md)`                                                                                                                                                                                                                                                                        |
| Driving                  | Orthogonal to role: **0+ vehicles** or “don’t drive”; non-drivers stay full Caregivers and can **request** rides. A vehicle has an **owner** plus explicit **drivers** (same house does not imply sharing) — `[garage-vehicles](specs/archive/garage-vehicles.md)`                                                                                                                                                                                                                                                                                                              |
| Same team, multiple kids | Attach **which kids** belong on a feed/team; calendar shows both                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Carpool request          | **v1** Done: [`carpool-request-accept`](specs/archive/carpool-request-accept.md) — **one request covering all attending kids who still need a ride** by default (seats = kid count); **override** to drop a kid (e.g. sick). v1 is **both legs** (to and from the event) and **pickup at the requester’s house**. Richer shapes are parking: to XOR from (`carpool-leg-to-from`), pickup vs drop-off at a teammate house (`carpool-meet-at`), early/late windows the driver must approve (`carpool-early-late-window`) |
| Feed vs carpool          | **Feed = calendar only** (import does not join rides). **One space per normalized feed URL**; **Organizer** of the first family enables and that circle **owns**. Join = **code** (admits + adds feed if missing) or **request** (same-URL subscriber; owner admit/decline, in-app). Members reshare code; owner regenerates. No coach admin. Done: `[team-carpool-space-invite](specs/archive/team-carpool-space-invite.md)`                                                                                           |
| Auth                     | **Email one-time code first** (no magic link in v1); **Bearer** sessions on web + (soon) Expo; **optional password** later; web cookie hardening and production mail are follow-ups. KMP Bearer clients are frozen with the KMP apps.                                                                                                                                                                                                                                                                                                                                              |
| Client ship order        | **Web is the product reference**; new verticals still land on web first when they are not mobile-gated. **Pre-beta exception:** carpool **push** needs Expo — promote [`rn-expo-scaffold`](specs/planned/rn-expo-scaffold.md) then [`push-notifications`](specs/planned/push-notifications.md) (ride request / accept / deny) without waiting for full web polish or a full in-app inbox. **Do not** lockstep every feature on web + RN. KMP Android/iOS are **frozen** — cancelled KMP `*-mobile` ports; no new Compose/SwiftUI or `sharedLogic` OpenAPI work. Remove KMP via [`kmp-mobile-retire`](specs/planned/kmp-mobile-retire.md). Contract same-change rule: **web** (+ Expo when it exists), not KMP — see `AGENTS.md`. |
| Leave-by                 | Routed duration (OSRM) or fallback + **time-of-day multiplier** + **fixed buffer**; UI labeled **estimate** (not live traffic). Destination coords: **geocode event** `location` (soft-fail); origins = named places. Origin order: per-item override → **per-adult default leave-from** → first located by name. **Agenda must not wait on leave-by** — schedule first, estimates async, near-term before later days. Done: `[agenda-leave-by-async](specs/archive/agenda-leave-by-async.md)`. **Follow-up:** when adults take separate cars/kids, leave-from may differ per coverage — `[coverage-leave-from](specs/planned/coverage-leave-from.md)`                                                                                                          |
| Coverage                 | **Responsibility** rows (adult + kid subset + PENDING/CONFIRMED/DECLINED); any member assigns; assignee confirms/declines; kid exclusive per item on active rows; not a trip/seat plan — carpool later. Done: `[coverage-confirm-decline](specs/archive/coverage-confirm-decline.md)`                                                                                                                                                                                                                                                                                             |
| Event RSVP               | **Per kid + event:** **Yes / No / No response** (explicit; no implied Yes). Circle-visible; any member. Out of play when every kid is No (one-kid No included): summary stays, row deemphasized, hide leave-by/coverage/other dependent controls; RSVP + Edit/Remove stay. Mixed: No kid’s per-kid controls off. Assign/confirm coverage sets Yes. No (or No response) with active coverage: client confirm + hard-release. Foundation for carpool/team rollups. Done: `[agenda-event-rsvp](specs/archive/agenda-event-rsvp.md)` |
| Arrival lead time        | Follow-up `[event-arrival-lead-time](specs/planned/event-arrival-lead-time.md)`: editable defaults — game **30m** early, practice **15m**, other **0** — after leave-by ships                                                                                                                                                                                                                                                                                                                                                                                                     |
| Vehicle specs            | User picks **year / make / model** (vPIC lists); **no VIN**. vPIC suggests **total seats including driver**; always overridable. Kid vs adult vs booster kinds → parking `[garage-seat-kinds](specs/planned/garage-seat-kinds.md)`. Done: `[garage-vehicles](specs/archive/garage-vehicles.md)`                                                                                                                                                                                                                                                                              |
| UI token adoption        | When a destination adopts `cross-platform-ui-system` tokens, **re-verify** light/dark screenshots + WCAG AA for **that** surface — More’s pass does not certify elsewhere. Remainder adoption parked until carpool is dogfoodable on web — `[ui-system-destination-adoption](specs/planned/ui-system-destination-adoption.md)`                                                                                                                                                                                                                                                  |
| Interaction UX           | Distinct custom UI guided by UX-law tenets (not a rideshare clone): **Aesthetic-Usability** (polish reads as usable), **Doherty** (focused busy feedback feels instant), **Fitts** (primary actions large/reachable), **Hick** (few choices per step; sole-option defaults), **Proximity / Similarity** (group related controls; consistent patterns). Calendar/Agenda is the living reference: `[calendar-ux-flow](specs/archive/calendar-ux-flow.md)`. Inspired by [Laws of UX that Uber follows](https://medium.com/design-bootcamp/laws-of-ux-that-uber-follows-fa7c6619748b) |
| Visual language          | Destination mocks are the visual source of truth for **size, weight, spacing, and color** — tokens absorb those values (new/updated roles in the same PR); do not snap to a nearby existing role. **WCAG AA** (4.5:1 text, 3.0:1 icons) is the only allowed mock-hex exception. See `[docs/ui-system.md](ui-system.md)`. **One visual priority per screen**; everything else calmer. Destructive actions (Remove/Delete) get **less** weight than neutral (Edit/Sync). A design pass restyles only — **same handlers**. Web typography: Space Grotesk (display) + Plus Jakarta Sans (body) — `[typography-web](specs/archive/typography-web.md)`. Expo typography/fonts are deferred until RN surfaces exist (KMP `typography-font-family` cancelled). `hero*` **color** roles are Focus-card urgent spotlight only. **Filters and states prefer chips** over body-copy labels on restyled surfaces. |
| Web shell rail           | Signed-in web chrome is an **always-dark docked left rail** (independent of page theme): Calendar / Carpool / Family with icons; Settings Places / Garage / Feeds; **ACCOUNT** footer (avatar, email, role, sign out) **always visible** — pinned; nav list may scroll, Sign out must not. Expo will use bottom tabs (IA parity, not KMP). Rail wordmark is placeholder chrome (accent mark) — do not lock copy; real name is `[app-identity-rename](specs/planned/app-identity-rename.md)`. Done: `[web-shell-nav-rail](specs/archive/web-shell-nav-rail.md)`. **Page frame:** flush-left `md:w-60` rail, uncarded main (`max-w-[820px]`), Calendar-only Context aside — `[web-shell-page-frame](specs/archive/web-shell-page-frame.md)`. **Week at a glance:** five-day coverage/status strip in that aside — `[agenda-week-glance](specs/archive/agenda-week-glance.md)`. **Page header:** Calendar mock Today/date, `page`/`subtitle` type, main 36×44 / rail 28×20 padding — `[web-shell-page-header](specs/archive/web-shell-page-header.md)`. |
| Agenda week strip        | **Five-day coverage/status** rail in Calendar Context (today + next four local days; event counts, not kids; no driver copy). Not the month/week grid (`family-calendar-grid`). Done: `[agenda-week-glance](specs/archive/agenda-week-glance.md)`. KMP mobile port cancelled; Expo port carved later if needed. The mock’s numbered-stop **carpool card** + Open in Maps stays parked `[carpool-multi-stop](specs/planned/carpool-multi-stop.md)`. |
| Focus card selection     | Exactly one Agenda item. **Next action**, not “earliest uncovered in the loaded window.” **Today/tomorrow** decisions (RSVP / uncovered / conflict / pending confirm / **pending ride accept for self**) beat a sooner all-set item; otherwise the **next in-play event to leave for** (on time first). Rest-of-week gaps surface in the list + `[agenda-week-glance](specs/archive/agenda-week-glance.md)` strip, not Focus. Done: `[agenda-focus-next-action](specs/archive/agenda-focus-next-action.md)`. **Agenda-primary carpool** (Done: `[agenda-focus-carpool-actions](specs/archive/agenda-focus-carpool-actions.md)`): Request/status on event cards; Focus Accept + Pass + **Request** (when eligible); **Within Today/Tomorrow** family decisions beat teammate ride Accept, then earliest `startsAt`; **own PENDING ride is not a Focus decision**; Request without prior RSVP Yes (**Accept** sets Yes). Never multi-hero or Context ask inbox. Focus chrome: slim summary + primary CTA; leave-from / full RSVP bands stay on expanded rows — `[agenda-focus-card-polish](specs/archive/agenda-focus-card-polish.md)`. Solid Agenda↔ride id: Done `[calendar-item-event-key](specs/archive/calendar-item-event-key.md)`. |




## Upcoming (ranked)

Reorder only via `/roadmap` re-rank. Rank **1** is **Next up** for `/spec`.


| Rank | Id                              | Status  | Added                      | Summary                                                                                                                       |
| ---- | ------------------------------- | ------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 1    | auth-email-delivery             | planned | 2026-08-07 · enhancement   | Production SMTP/API mail for OTP — pre-beta gate (dev keeps log delivery); needed before real-device Expo auth                 |
| 2    | rn-expo-scaffold                | planned | 2026-08-25 · enhancement   | Expo app: OTP auth + shell + push-token registration hook against existing OpenAPI — infra for carpool push beta              |
| 3    | push-notifications              | planned | 2026-08-07 · initial       | Expo push for carpool ride **request / accept / deny (pass)** — pre-beta differentiator; not blocked on in-app inbox          |
| 4    | manual-event-team-link          | planned | 2026-08-13 · re-rank split | Manual events: attach to a team (feed UUID, carpool-eligible) or standalone (family tracking only) — web first                |
| 5    | carpool-recurring-rotation      | planned | 2026-08-16 · enhancement   | Standing teammate rotation for a recurring team event (e.g. every Tuesday); RSVP No drops that kid for that week only         |
| 6    | event-arrival-lead-time         | planned | 2026-08-11 · enhancement   | Editable arrival lead times: game ~30m / practice ~15m / other ~0 (defaults); refine leave-by target                          |
| 7    | coverage-leave-from             | planned | 2026-08-12 · enhancement   | Leave-from (and leave-by) per coverage when adults take separate cars/kids                                                    |
| 8    | conflict-travel-margin          | planned | 2026-08-12 · enhancement   | Soft “cutting it close” warn from leave-by/travel gaps (not hard overlap; after leave-from / lead-time)                       |
| 9    | calendar-conditional-get        | planned | 2026-08-12 · re-rank split | Server `ETag` + client `If-None-Match` / `304` on calendar background revalidate (after cheap list + client cache)            |
| 10   | event-venue-display-label       | planned | 2026-08-17 · enhancement   | Short venue label (rink, park, field) from geocoded event destination; Focus + Agenda fallback to full `location`             |
| 11   | web-auth-session-hardening      | planned | 2026-08-07 · enhancement   | HTTP-only cookie (or equivalent) for web — pre-beta gate; Expo stays Bearer                                                   |
| 12   | adult-optional-password         | planned | 2026-08-07 · re-rank split | Optional password for frequent users — pre-beta convenience (OTP remains primary)                                             |
| 13   | app-identity-rename             | planned | 2026-08-07 · initial       | Rename packages/clients from quickapp template identity before public beta                                                    |


Status values: `parking` · `planned` · `active` · `done` · `cancelled`  
Added: `YYYY-MM-DD · initial` | `enhancement` | `re-rank split`

## Parking lot

Unranked ideas. Promote into **Upcoming** with `/roadmap` (re-rank).


| Id                            | Added                    | Summary                                                                                                                                                           |
| ----------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| kmp-mobile-retire             | 2026-08-25 · enhancement | Remove KMP `mobile/` + mobile CI/docs after Expo can sign in (or earlier if freeze-only is enough)                                                                |
| family-calendar-grid          | 2026-08-10 · re-rank split | Month/week calendar grid — parked (design surface; Agenda on web is enough for carpool dogfood); future client is Expo if revived                               |
| ui-system-destination-adoption | 2026-08-10 · note carried from cross-platform-ui-system approval | Remainder token adoption (Carpool / Family / Places / Garage / grid) — parked with other design work; Expo adopts separately when surfaces exist |
| multi-circle-membership       | 2026-08-08 · enhancement | Adult in multiple family circles (blended households; grandparents with more than one grandkid family)                                                            |
| read-only-calendar-follows  | 2026-08-08 · enhancement | Follow another team/kid calendar read-only (e.g. last year’s teammates on a new team)                                                                             |
| venue-proximity-alerts      | 2026-08-08 · enhancement | Notify when followed/circle kids are at or near the same venue around the same time                                                                               |
| caregiver-attention-balance | 2026-08-08 · enhancement | Surface which kids get more caregiver attention so adults (e.g. grandparents) can rebalance                                                                       |
| carpool-least-privilege     | 2026-08-13 · enhancement | Some circle adults (nanny, grandparent) get own-kids calendar/coverage without teammate carpool roster, codes, or addresses — after invite v1                     |
| in-app-notifications        | 2026-08-16 · enhancement | In-app alert inbox (coverage, rides, rotation gaps); **not** required before carpool push beta — promote after push if inbox UX is needed                        |
| carpool-driver-gap-fill     | 2026-08-16 · enhancement | When the rotation’s driver family can’t cover that week: alert + confirm a replacement; fill rule still open (shift vs double-duty)                               |
| driver-leave-by-pickups     | 2026-08-07 · initial     | Leave-by when teammate pickups are part of the plan — parked until `carpool-multi-stop` defines pickup order                                                      |
| carpool-page-redesign       | 2026-08-16 · enhancement | Carpool destination visual restyle — needs mockups / design intent before `/spec` (sibling of Family/Places/Garage)                                               |
| ui-palette-refresh          | 2026-08-10 · enhancement | Brand hex already landed in `agenda-focus-card`; leftover AA is per-destination adoption — do not run as a separate palette PR                                    |
| sign-in-apple-google        | 2026-08-07 · initial     | Sign in with Apple / Google (deferred from auth v1)                                                                                                               |
| driver-only-role            | 2026-08-07 · initial     | Narrow Driver-only role (orthogonal driving stays in garage for now)                                                                                              |
| rss-atom-schedule-feeds     | 2026-08-09 · enhancement | RSS/Atom schedule import (superseded for v1 by iCal/webcal)                                                                                                       |
| rescue-broadcast            | 2026-08-07 · initial     | Emergency / rescue broadcast mode                                                                                                                                 |
| paid-live-traffic           | 2026-08-07 · initial     | After leave-by proves value: replace/supplement free **OSRM** routing with a paid live-traffic provider (still labeled estimate unless product decides otherwise) |
| coach-league-admin          | 2026-08-07 · initial     | Coach/league admin consoles, fees, club OS                                                                                                                        |
| in-app-chat                 | 2026-08-07 · initial     | Messaging between caregivers / carpool members                                                                                                                    |
| osm-map-tiles               | 2026-08-07 · initial     | Optional in-app map with OSM tiles + attribution                                                                                                                  |
| maps-deep-links             | 2026-08-07 · initial     | Open external directions via OS maps deep links                                                                                                                   |
| carpool-leg-to-from         | 2026-08-14 · enhancement | Request a ride **to** the event, **from** the event, or **both** (v1 request/accept is both)                                                                      |
| carpool-meet-at             | 2026-08-14 · enhancement | Pickup at the requester’s house vs drop-off at a teammate’s house (who drives to whom)                                                                            |
| carpool-early-late-window   | 2026-08-14 · enhancement | Optional early drop-off / late pickup times the accepting driver must approve (e.g. 2h before so the family can cover another kid)                                |
| ride-playlist-merge         | 2026-08-14 · enhancement | Kids’ ride playlists; merge for a carpool (prefer shared songs, balance coverage); shuffle; pin lucky songs; edit through the season                              |
| playlist-open-in-streaming  | 2026-08-14 · enhancement | Free song lookup + open/export in Apple Music or Spotify (no paid music API)                                                                                      |
| locker-room-mix             | 2026-08-14 · enhancement | Team pump-up mix using the same playlist engine as ride merge                                                                                                     |
| garage-seat-kinds           | 2026-08-14 · enhancement | Distinguish adult seats, kid seats, and boosters (v1 garage is one total including driver)                                                                        |
| family-places-garage-redesign | 2026-08-15 · re-rank split | Family / Places / Garage visual restyle — needs a mockup pass before `/spec` (split from `destination-design-pass`)                                             |
| carpool-multi-stop          | 2026-08-15 · enhancement | Ordered pickups + Open in Maps + Agenda “N stops”; includes the Calendar mock’s right-rail carpool card — parked until pickup order exists                        |


## Cancelled

Superseded by Expo migration (KMP ports / KMP-only fixes). Do not promote.


| Id                            | Cancelled  | Reason |
| ----------------------------- | ---------- | ------ |
| carpool-request-accept-mobile | 2026-08-25 | KMP iOS/Android port; Expo replaces KMP |
| agenda-focus-card-mobile      | 2026-08-25 | KMP port; Expo replaces KMP |
| agenda-full-page-redesign-mobile | 2026-08-25 | KMP port; Expo replaces KMP |
| feeds-page-redesign-mobile    | 2026-08-25 | KMP port; Expo replaces KMP |
| agenda-week-glance-mobile     | 2026-08-25 | KMP port; Expo replaces KMP |
| typography-font-family        | 2026-08-25 | KMP font bundling; Expo fonts later if needed |
| ios-auth-unreachable-parity   | 2026-08-25 | KMP iOS-only fix; no new KMP work |




## Active specs

In-progress work (locked for re-rank — finish, amend, or abandon before reshuffle).

| Id | Branch | Spec |
| --- | --- | --- |

## Done


| Id                         | Completed  | Spec                                                   |
| -------------------------- | ---------- | ------------------------------------------------------ |
| calendar-item-event-key    | 2026-08-25 | [archive](specs/archive/calendar-item-event-key.md)     |
| agenda-focus-carpool-actions | 2026-08-24 | [archive](specs/archive/agenda-focus-carpool-actions.md) |
| carpool-request-accept     | 2026-08-21 | [archive](specs/archive/carpool-request-accept.md)     |
| agenda-week-glance         | 2026-08-18 | [archive](specs/archive/agenda-week-glance.md)         |
| feeds-page-redesign        | 2026-08-18 | [archive](specs/archive/feeds-page-redesign.md)        |
| agenda-list-chips          | 2026-08-18 | [archive](specs/archive/agenda-list-chips.md)          |
| agenda-focus-card-polish   | 2026-08-17 | [archive](specs/archive/agenda-focus-card-polish.md)   |
| agenda-focus-next-action   | 2026-08-17 | [archive](specs/archive/agenda-focus-next-action.md)   |
| web-shell-page-header      | 2026-08-17 | [archive](specs/archive/web-shell-page-header.md)      |
| web-shell-page-frame       | 2026-08-17 | [archive](specs/archive/web-shell-page-frame.md)       |
| web-shell-nav-rail         | 2026-08-17 | [archive](specs/archive/web-shell-nav-rail.md)         |
| agenda-focus-card-bugs     | 2026-08-17 | [archive](specs/archive/agenda-focus-card-bugs.md)     |
| typography-web             | 2026-08-16 | [archive](specs/archive/typography-web.md)             |
| agenda-full-page-redesign  | 2026-08-16 | [archive](specs/archive/agenda-full-page-redesign.md)  |
| agenda-focus-hero-surface  | 2026-08-15 | [archive](specs/archive/agenda-focus-hero-surface.md)  |
| agenda-focus-card          | 2026-08-15 | [archive](specs/archive/agenda-focus-card.md)          |
| garage-vehicles            | 2026-08-14 | [archive](specs/archive/garage-vehicles.md)            |
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
| 2026-08-14 | Parked richer ride-request shapes (`carpool-leg-to-from`, `carpool-meet-at`, `carpool-early-late-window`) and playlists (`ride-playlist-merge`, `playlist-open-in-streaming`, `locker-room-mix`); v1 request/accept stays both-legs + pickup-at-requester; next up still `garage-vehicles`. |
| 2026-08-14 | `/spec garage-vehicles`: circle-visible garage, own-only writes, `drives` flag, total seats including driver, optional NHTSA VIN hint (soft-fail). |
| 2026-08-14 | Amend `garage-vehicles`: year/make/model only (no VIN); vPIC seat hint stays overridable; park `garage-seat-kinds`. |
| 2026-08-14 | Amend `garage-vehicles`: explicit per-car drivers (shared vs personal); optional kept-at place; house ≠ sharing. |
| 2026-08-14 | `/pr garage-vehicles`: circle garage (owner + drivers, no VIN) shipped (web/Android/iOS); next up `carpool-request-accept`. |
| 2026-08-14 | `/roadmap agenda-focus-card`: first visual/UX differentiation slice (web Focus card + token refresh) promoted to Active; follow-ups `agenda-focus-card-mobile`, `destination-design-pass`, `typography-font-family` ranked after the carpool/grid cluster; next up `/implement agenda-focus-card`. |
| 2026-08-15 | `/pr agenda-focus-card`: web Focus card + WCAG AA token refresh shipped; iOS/Android port remains `agenda-focus-card-mobile`; next up `carpool-request-accept`. |
| 2026-08-15 | `/roadmap` Agenda + Feeds redesign: split `destination-design-pass`; web `agenda-full-page-redesign` then `feeds-page-redesign` ahead of `carpool-request-accept`; park Family/Places/Garage (needs mockups) and `carpool-multi-stop`. |
| 2026-08-15 | `/spec agenda-focus-hero-surface`: land intake `hero*` Focus-card spotlight as a prerequisite slice before `/spec agenda-full-page-redesign`. |
| 2026-08-15 | `/pr agenda-focus-hero-surface`: web Focus card `hero*` spotlight + countdown ring; next up `agenda-full-page-redesign`. |
| 2026-08-16 | `/roadmap` recurring carpool: add `carpool-recurring-rotation` after v1 request/accept + team-link; park `carpool-driver-gap-fill` (fill rule open) and `in-app-notifications` (native push stays a follow-up). Active Agenda redesign unchanged. |
| 2026-08-16 | `/roadmap` review: pull Agenda/Feeds mobile ports up with the web visual cluster (they were stranded after grid); park `driver-leave-by-pickups` until multi-stop exists and `ui-palette-refresh` (hex already shipped); promote `app-identity-rename` to pre-beta gates; add parked `carpool-page-redesign` + `ios-auth-unreachable-parity`. Next up still `agenda-full-page-redesign`. |
| 2026-08-16 | Re-rank split: `typography-font-family` → web-now `typography-web` (rank 2, no mobile dependency) + remaining iOS/Android asset bundling. Agenda redesign stays locked Active rank 1; `typography-web` stacked on that branch because `AgendaRow` lives there. |
| 2026-08-16 | `/pr agenda-full-page-redesign`: web day-grouped Agenda rows shipped ([#39](https://github.com/mccajr2/family-carpool/pull/39)); spec archived. Next up `typography-web` (rebased onto `main`). |
| 2026-08-16 | `/pr typography-web`: Space Grotesk + Plus Jakarta Sans on web; mobile font bundling stays `typography-font-family`. Next up `feeds-page-redesign`. |
| 2026-08-16 | `/roadmap agenda-focus-card-bugs`: smoke-test follow-up (feed HTML entities + Focus ring label cap) promoted to Next up; `feeds-page-redesign` → rank 2. |
| 2026-08-16 | `/spec agenda-focus-card-bugs`: ingest HTML-entity decode + Focus ring adaptive min/hr/day label (not 24h cap-and-hide); no OpenAPI. |
| 2026-08-17 | `/pr agenda-focus-card-bugs`: feed HTML-entity decode at iCal ingest + Focus ring adaptive min/hr/days; spec archived. Next up `feeds-page-redesign`. |
| 2026-08-17 | `/roadmap` Claude Calendar + Feeds intake: web-first visual cluster (rail, Focus polish, list chips, Feeds mock, week-glance); mobile ports after; park Agenda carpool stop card in `carpool-multi-stop`. Next up `web-shell-nav-rail`. |
| 2026-08-17 | `/spec web-shell-nav-rail`: always-dark `rail*` tokens (not `hero*`); placeholder wordmark (no locked copy); icons; ACCOUNT footer always visible; same destinations/handlers. |
| 2026-08-17 | `/pr web-shell-nav-rail`: always-dark web rail + pinned ACCOUNT footer; spec archived. Next up `agenda-focus-card-polish`. |
| 2026-08-17 | `/roadmap web-shell-page-frame`: deferred rail PR layout (flush-left ~240px, fluid center, Calendar-only empty right rail) ranked Next up so Focus polish / week-glance land in the mock frame. |
| 2026-08-17 | `/spec web-shell-page-frame`: signed-in flush-left `md:w-60` rail, uncarded main (`max-w-[820px]`), Calendar-only empty Context aside; signed-out/empty states keep `max-w-5xl`. |
| 2026-08-17 | `/roadmap web-shell-page-header`: deferred from page-frame review (header type/copy/color/gap; no new 34px/36/44 roles). Rank 2 after page-frame, before Focus polish. |
| 2026-08-17 | `/pr web-shell-page-frame`: flush-left `md:w-60` rail, uncarded main, Calendar-only empty Context aside; spec archived. Next up `web-shell-page-header`. |
| 2026-08-17 | `/spec web-shell-page-header`: destination header token type + ink/slate; Calendar Today/date; no new 34px roles. |
| 2026-08-17 | Visual language lock: destination mocks are source of truth for size/weight/spacing/color; tokens absorb mock values (WCAG AA remains the hex exception). |
| 2026-08-17 | `/pr web-shell-page-header`: destination header Today/date + mock type/padding; spec archived. Next up `agenda-focus-card-polish`. |
| 2026-08-17 | `/roadmap agenda-focus-next-action`: Focus card was missing a next-action ranking (3-week RSVP stole the hero). Rank 1 ahead of polish; park ride accept/decline as `agenda-focus-carpool-actions`. Next up `agenda-focus-next-action`. |
| 2026-08-17 | `/spec agenda-focus-next-action`: today/tomorrow decisions else next in-play event; pending-for-self on the same urgent predicate; no OpenAPI. |
| 2026-08-17 | `/pr agenda-focus-next-action`: web Focus next-action ranking (today/tomorrow else next event); spec archived. Next up `agenda-focus-card-polish`. |
| 2026-08-17 | `/spec agenda-focus-card-polish`: mock-aligned Focus header — isolated ring, covering under ring, status chips; slim body (Assign/Confirm + Edit; write bands on expanded rows). |
| 2026-08-17 | `/pr agenda-focus-card-polish`: mock-aligned Focus card (tokens, chips, covering row, destination meta, Edit leave-from); add `event-venue-display-label` (rank 12). Next up `agenda-list-chips`. |
| 2026-08-18 | `/pr agenda-list-chips`: web kid-filter chips + collapsed row pills/avatars; spec archived. Next up `feeds-page-redesign`. |
| 2026-08-18 | `/spec feeds-page-redesign`: web Feeds raised cards, OWNED/NO CARPOOL chips, quieter Sync/Edit, Remove as text; no OpenAPI; Carpool tab chrome unchanged. |
| 2026-08-18 | `/pr feeds-page-redesign`: web Feeds raised cards, OWNED/NO CARPOOL chips, quieter Sync/Edit; spec archived. Next up `agenda-week-glance`. |
| 2026-08-18 | `/pr agenda-week-glance`: web Calendar Context five-day coverage/status strip; spec archived. Next up `agenda-focus-card-mobile`. |
| 2026-08-18 | Major re-rank: web-first product — carpool request/accept cluster ahead of design; park Agenda/Feeds mobile ports, typography, destination adoption, and calendar grid; promote `agenda-focus-carpool-actions`. Next up `carpool-request-accept`. |
| 2026-08-21 | `/pr carpool-request-accept`: ride request/accept shipped (OpenAPI + backend + web Carpool tab + sharedLogic); Android/iOS UI parked as `carpool-request-accept-mobile`. Next up `agenda-focus-carpool-actions`. |
| 2026-08-21 | `/roadmap` Agenda-primary carpool: expand `agenda-focus-carpool-actions` — Request on Agenda event cards + single Focus for teammate asks (no multi-hero, no Context request panel). Carpool tab stays membership/secondary. Next up unchanged. |
| 2026-08-21 | `/spec agenda-focus-carpool-actions`: Agenda-primary rides (web) + per-adult Pass OpenAPI; join listRides to FEED rows; Focus Accept/Pass; no CalendarItem ride fields. |
| 2026-08-21 | Spec lock: Focus family-before-community in Today/Tomorrow; own PENDING ride off Focus decisions; same-card CTA Confirm → Accept → Assign. |
| 2026-08-21 | Amend `agenda-focus-carpool-actions` (dogfood): Request for Yes + No response; Accept→Yes (not create); Focus Request CTA; heuristic match this PR; add Upcoming `calendar-item-event-key` for solid uid/eventKey join. |
| 2026-08-24 | `/pr agenda-focus-carpool-actions`: Agenda-primary rides (web Request/status + Focus Accept/Pass/Request + per-adult Pass); Android/iOS UI parked. Next up `calendar-item-event-key`. |
| 2026-08-25 | Major re-rank (client strategy): lock **Expo (React Native)** as the mobile target; **web MVP dogfood first** (no parallel web+RN product delivery); freeze KMP; cancel KMP `*-mobile` ports + `ios-auth-unreachable-parity` + `typography-font-family`; park `rn-expo-scaffold` + `kmp-mobile-retire`. Next up unchanged: `calendar-item-event-key`. |
| 2026-08-25 | Re-rank (carpool beta): promote `auth-email-delivery` → `rn-expo-scaffold` → `push-notifications` (ride request/accept/deny) as pre-beta after `calendar-item-event-key`; push **not** blocked on `in-app-notifications`. Governance: OpenAPI same-change = web (+ Expo when present), not frozen KMP (`AGENTS.md`, `mobile.mdc`, architecture Contract-first). |
| 2026-08-25 | `/spec calendar-item-event-key`: nullable carpool-compatible `eventKey` on `CalendarItem` (FEED); shared feeds key helper; web exact-key join (heuristic fallback when null). No KMP/Expo. |
| 2026-08-25 | `/pr calendar-item-event-key`: nullable `eventKey` on FEED `CalendarItem`; shared feeds key helper; web exact-key Agenda↔ride join. Next up `auth-email-delivery`. |

