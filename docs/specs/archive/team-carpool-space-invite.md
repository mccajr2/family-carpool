# Spec: team-carpool-space-invite

Status: done  
Created: 2026-08-07  
Updated: 2026-08-14 (`/pr`)  
Approved: 2026-08-13  
Parent: [docs/roadmap.md](../../roadmap.md)  
Branch: `team-carpool-space-invite`  
Added: 2026-08-07 · initial

## Problem

Families already import team calendars, but importing a feed must not drop them
into other families’ rides. There is no opt-in **team carpool space**: no way
for the first family to enable a space, share a parent invite code (listserv),
or admit a same-calendar family that asks to join. The Carpool tab is still
“Coming soon,” so purpose #2 of the product is unproven.

## Non-goals

- **Garage / vehicles** — `garage-vehicles`
- **Ride request / accept / seats** — `carpool-request-accept`
- **Manual events on a team** (feed UUID so a one-off is carpool-eligible) —
  `manual-event-team-link` (planned this spec; separate PR)
- **Additional space admins** beyond the owning family (follow-up if dogfood
  needs it; owner cannot abandon a space that still has other families)
- **Merging spaces** when the same real-world team is imported under different
  URLs (Google/Apple re-publish vs league subscribe link)
- **Moving a space** when an Organizer edits a feed URL
- **Deleting a space** when a feed is deleted (space stays keyed to the URL)
- **Coach / league admin**, fees, club OS
- **Email / push / SMS** delivery of codes or join requests (`auth-email-delivery`,
  `push-notifications` parking). In-app only.
- **Deep links / universal links** — short **code** only (same as family invites)
- **Permanent ban list** after Decline (they may request again)
- **Restyling Carpool onto shared UI tokens** — `ui-system-destination-adoption`
- **OpenAPI codegen** — hand-written clients stay the pattern
- **Playwright e2e** (not in toolchain)

## Approach

New Modulith module **`carpool`** (vertical slice). Family membership and feed
subscribe stay in **`family`** / **`feeds`**. Carpool talks to them only through
public APIs — no `internal` imports. HTTP under **`/api/carpool/*`** (cross-circle
resource; not nested under `/api/family`).

A **space is a team**. **One space per normalized feed URL** (same normalize as
feeds: trim; `webcal://` → `https://`). Importing that URL does **not** join the
space or show rides. At most, a subscriber **sees that a space exists**.

**Membership is the family circle** (all adults in the circle). Join / request /
admit / leave act for the whole household. A circle may belong to **many**
spaces.

### Enable (first family owns)

**Organizer-only.** An Organizer whose circle already has the feed may **Enable
carpool** on that feed, after confirming they **agree this family will own**
the space (admit / decline requests). Creates the space (name copied from the
feed), marks that circle **OWNER**, issues an invite code. Caregiver Enable →
**403**. Extra gate on top of “already subscribed”: only the household’s
Organizer can create a team space.

If a space already exists for that normalized URL → **409**; client refreshes
and shows Join / Request instead.

### Code path (listserv shortcut)

`POST /api/carpool/join` with the code, signed-in adult **with a circle**:

- Invalid / regenerated-away code → **404** (no existence leak).
- Already a member → **409**.
- Else **admit the circle** immediately.
- If the circle has **no** feed with that normalized URL → **`FeedsApi.ensureFeed`**
  (name copied from the space, **zero kid links**, then the existing auto-sync
  path). Caregiver redeem is allowed; this does **not** open general Caregiver
  feed CRUD.
- If the circle already has that URL → join only (no second feed).
- No circle yet → **404** / client keeps create-or-join-family first. A carpool
  code does not create a household.

### Request path (same calendar, no code)

A circle that has the matching feed, is **not** a member, and sees status
**AVAILABLE** may **Request to join**. Owner-circle adults get an in-app pending
list and **Admit** (circle becomes MEMBER) or **Decline** (request closed; they
may request again). Admit does **not** add a feed — they already have it.
Duplicate **PENDING** request from the same circle → **409**.

### Invite lifecycle

Same alphabet / length as family invites (8 chars,
`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`). Lookup is on the carpool join endpoint
only.

- **Any space member** may **view / copy** the current code (reshare).
- **Owning circle only** may **regenerate** (old code stops working).
- No TTL. No email/push. Share out of band.

### Leave

- **Member** circle may leave anytime.
- **Owner** may leave only if they are the **only** member circle (space is
  then removed). Otherwise **409** — additional admins are out of this PR.

### Client IA

**Carpool tab** (all members) is the product home: per-feed status + actions,
paste-a-code, spaces you belong to, owner pending requests. Remove “Coming soon”.
**Enable** is shown only to Organizers (and on Feeds). Caregivers with no space
yet see that the team has no carpool and **Have a code?** — not Enable.

**Feeds settings** (Organizer, unchanged row visibility) shows the same per-feed
carpool status next to each feed (Enable / space exists → Request or code /
Owned) so the “this team has a carpool” moment sits on the calendar they added.

Caregivers never gain the Feeds manage screen; they use Carpool (including the
code shortcut that may add a feed).

Hick: one primary CTA per feed row (Enable for Organizer when none exists,
Request, or Open). Paste-code is a secondary “Have a code?” control, not a
competing primary.

### Contract / module seams

- New OpenAPI tag `carpool`; bump `info.version`.
- **`FeedsApi`** (new public surface): list feeds for a circle; find by
  circle + normalized URL; `ensureFeed(circleId, sourceUrl, name)` create-if-absent
  + sync. HTTP feed **mutations** stay Organizer-only.
- **`FamilyMembershipApi`**: add circle name (and enough to render “requested by
  {displayName}”) so carpool does not import `family.internal`.
- Unique index on space `normalized_source_url`. Unique `(space_id, circle_id)`
  membership.

Do not change Agenda, RSVP, coverage, or leave-by in this PR.

## Acceptance criteria

- [x] OpenAPI documents carpool summary, enable, join-by-code, space detail,
      regenerate invite, leave, create request, admit, decline; Bearer on all;
      401 / 403 / 404 / 409 behaviors below. Hand-written web + mobile clients
      updated in the same change.
- [x] **Enable** is **Organizer-only**. On a circle feed with no space for that
      normalized URL it creates a space named after the feed, OWNER membership
      for that circle, and an invite code. Client shows a confirmation that
      this family will **own** the space before the call. Caregiver Enable →
      **403**; Caregiver UI omits Enable.
- [x] Second Enable for the same normalized URL (same or other circle) → **409**.
      The other circle’s summary shows **AVAILABLE** (space exists, not a member)
      with Request + Have a code — **not** member list, rides, or invite code.
- [x] Importing a feed never auto-joins a space and never returns other families’
      membership or rides.
- [x] **Join by valid code:** circle becomes MEMBER (or already OWNER); if the
      circle lacked that URL, a feed is created (space name, 0 kids) and synced;
      if it already had the URL, no duplicate feed (**409** on duplicate URL
      must not fire — join-only). Caregiver redeem succeeds. Already a member →
      **409**. Unknown code → **404**. No circle → **404**.
- [x] **Request:** circle with matching feed, not a member, space exists →
      PENDING request. Owner-circle adults see it in-app (circle name +
      requester display name) and can **Admit** (MEMBER, no new feed) or
      **Decline**. Duplicate PENDING → **409**. Non-owner admit/decline → **403**.
      After Decline, a new request is allowed.
- [x] Any **space member** can view/copy the current invite code. Only the
      **owning circle** can regenerate; previous code no longer joins.
      Non-member GET of space detail / code → **404**.
- [x] Member leave removes that circle. Owner leave with other member circles
      → **409**. Owner leave as sole member removes the space (that URL may be
      Enabled again).
- [x] A circle can be OWNER or MEMBER of **multiple** spaces (two feeds → two
      teams).
- [x] **Carpool tab** (web + Android + iOS): “Coming soon” gone; summary +
      code / request / admit-decline / member list of **circle names**
      (not other families’ kids). **Enable** on Carpool + Feeds for
      **Organizers only**. Errors surfaced. Empty: add a feed or paste a
      code (Caregiver copy does not send them to Feeds).
- [x] Backend unit + Testcontainers integration cover enable (including
      Caregiver **403**), URL uniqueness, code join ± feed ensure, request
      admit/decline, authz, leave; client tests cover new API paths + Carpool
      UI (Enable hidden for Caregiver); `ModularityTests` still green.

## Tasks

- [x] **Contract:** `/api/carpool/*` paths + schemas in `contracts/openapi.yaml`;
      `carpool` tag; version bump; description notes feed-URL key, owner vs
      member, **Organizer-only enable**, code shortcut, in-app requests (no
      push).
- [x] **Backend (`feeds`):** public `FeedsApi` — list by circle, find by
      normalized URL, `ensureFeed` + sync; keep HTTP create/update/delete/sync
      Organizer-only.
- [x] **Backend (`family`):** public circle name (and adult display name already
      on `AdultSessionApi.requireAdult`) for member/request rendering.
- [x] **Backend (`carpool`):** new module (`quickapp.module-conventions` + JPA +
      web); Flyway for spaces, memberships, invite code, join requests; enable /
      join / request / admit / decline / regenerate / leave; unique URL +
      membership constraints.
- [x] **Web:** `web/src/api/` client; replace Carpool placeholder; Organizer
      Feeds per-feed carpool chrome; loading / error / empty.
- [x] **Mobile (`sharedLogic`):** client methods + models.
- [x] **Android / iOS:** same flows via sharedUI / SwiftUI.
- [x] **Tests:** backend unit + integration; web + sharedLogic (+ iOS script
      tests as elsewhere); ModularityTests.
- [x] **Docs:** architecture — carpool module, space-per-URL, circle membership,
      owner, code shortcut vs request, Carpool tab vs Feeds; README smoke:
      enable + second family join by code.

## Open questions

_None blocking._ Path/JSON names are implementer’s pick if they match the
behaviors above.

## Decisions locked in `/spec`

| Topic | Choice |
|--------|--------|
| Space identity | **One space per normalized feed URL**; not per circle-feed UUID |
| Same team, different URL | **Two spaces** in v1 (no merge) |
| Membership | The **family circle**, not the individual adult |
| Many spaces | Yes — one per team / feed |
| Who enables | **Organizer-only**; confirm **this family owns**; Caregiver → **403** |
| Owner | Enabling circle; additional admins **out** |
| Code join | Admit **and** `ensureFeed` if URL missing (0 kids); Caregiver OK |
| Request join | Same-URL subscriber, not a member; owner Admit / Decline; in-app only |
| Invite shape | Short **code** only; reshare = any member; regenerate = owner only; no TTL |
| Leave | Member free; owner only if sole member circle |
| Clients | Web + Android + iOS in this PR |
| Manual events on a team | **Not this PR** — `manual-event-team-link` |
| Existence leak | Same-URL subscribers may see **that a space exists** (name + Request/code). They do not see members, code, or rides until joined |
