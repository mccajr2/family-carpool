# Spec: family-adult-invites-roles

Status: draft  
Created: 2026-08-07  
Updated: 2026-08-09  
Parent: [docs/roadmap.md](../../roadmap.md)  
Branch: `family-adult-invites-roles`

## Problem

A family circle today has a single Organizer and kids, but no way for other
adults (co-parent, grandparent, nanny) to join. Calendar and carpool need a
shared membership list with **Organizer** vs **Caregiver** powers. Without
invites + roles, every later slice invents its own “who’s in the household?”
hack or stays single-adult forever.

## Non-goals

- **Multiple circles per adult** — parking `multi-circle-membership` (v1 stays
  one membership)
- **Invite deep links / universal links** — short **code** only; a URL that wraps
  the same code can come later
- **Email or push delivery of invites** — Organizer copies/shares the code out of
  band (`auth-email-delivery` / `push-notifications`)
- **Invite expiry clocks** — regenerate invalidates; no TTL in this PR
- **Driver-only role**, places, feeds, calendar, carpool spaces
- **Transfer-ownership wizard** beyond promote / demote / leave rules below
- **OpenAPI codegen** — hand-written clients stay the pattern

## Approach

Extend the existing Modulith **`family`** module (no new module). Keep
**at most one circle membership per adult**.

**Invite:** each circle has **one active invite code** (server-generated,
human-shareable). Organizer can **view** the current code and **regenerate**
(old code stops working). Signed-in adult with **no** membership **accepts** a
code → joins as **CAREGIVER**. If they already have a membership → **409**
(leave first, then accept).

**Leave:**

- **Caregiver** may leave anytime.
- **Organizer** may leave only if ≥1 other Organizer remains afterward.
- **Sole Organizer** may leave only when they are the **only member** and the
  circle has **zero kids** (empty mistaken-create path). Otherwise **409** —
  remove kids and/or promote another Organizer first.

**Roles:**

- Join → **CAREGIVER**.
- Organizer may **promote** Caregiver → Organizer and **demote** Organizer →
  Caregiver.
- Invariant: circle always has **≥1 Organizer** (demote / remove / leave that
  would violate → **409**).
- **Organizer-only mutations:** regenerate invite, remove member, change roles,
  rename circle, kids CRUD (tighten existing kids/circle write paths).
- **All members** may read circle (kids + member list). Caregivers do not get
  invite code in API responses (Organizer-only).

**Display name:** accepting an invite requires adult `displayName` if still
null (same idea as create-circle); set via request body + auth public API.

**Contract:** new `/api/family/*` invite + members paths; extend circle GET with
members; document 403/409 behaviors. Web + Android + iOS: create **or** join
code on empty state; member list; Organizer controls; leave.

## Acceptance criteria

- [ ] OpenAPI documents invite get/regenerate, accept invite, list/remove
      members, promote/demote, leave; Bearer on all; Caregiver vs Organizer
      authorization called out.
- [ ] Organizer can retrieve the circle’s **current invite code** and
      **regenerate** it (previous code no longer accepts).
- [ ] Signed-in adult with **no** membership accepts a valid code → membership
      **CAREGIVER**; optional/required display name filled when null; GET circle
      shows them in members.
- [ ] Accept with invalid/unknown/regenerated-away code → **404** (no leak of
      other circles). Accept while already a member of any circle → **409**.
- [ ] Unauthenticated invite/member calls → **401**. Caregiver calling
      Organizer-only endpoints → **403**. Non-member → **404** where
      appropriate (no cross-circle leak).
- [ ] Organizer can **remove** a member (not themselves via remove — use leave);
      cannot remove/demote/leave into **zero Organizers** → **409**.
- [ ] Organizer can **promote** / **demote** roles subject to the ≥1 Organizer
      rule.
- [ ] Caregiver can **leave**; sole Organizer can leave only if alone and
      **zero kids**; otherwise leave → **409**.
- [ ] Kids create/update/delete and circle rename remain **Organizer-only**
      (Caregiver read-only for those); regression-tested.
- [ ] Empty-state UI (web + Android + iOS): **Create family** and **Have an
      invite code?**; after join/create, members list; Organizer sees code +
      regenerate, promote/demote/remove; any member can leave (subject to
      rules); errors surfaced.
- [ ] Backend unit + integration tests cover invite, join conflict, roles,
      leave, and authz; client tests cover new API paths; `ModularityTests`
      still green.

## Tasks

- [ ] **Contract:** Invite + members (+ leave/role) paths and schemas in
      `contracts/openapi.yaml`; update circle response with members; authz notes.
- [ ] **Backend (`family`):** Flyway for invite code (+ unique); generate /
      regenerate; accept; member list; remove; promote/demote; leave; enforce
      one-circle, ≥1 Organizer, Organizer-only writes on kids/circle.
- [ ] **Web:** Family client + empty-state join; members UI; Organizer controls;
      leave.
- [ ] **Mobile (`sharedLogic`):** Client methods + models for invite/members.
- [ ] **Android / iOS:** Same flows as web via sharedUI / SwiftUI.
- [ ] **Tests:** Backend unit + Testcontainers integration; web + sharedLogic
      tests; authz regressions for Caregiver vs Organizer.
- [ ] **Docs:** Architecture family section — invites, roles, leave rules;
      README smoke: invite second adult.

## Open questions

_None blocking — resolve at implement only if path/shape details need a pick
(e.g. exact code alphabet/length)._

## Decisions locked in `/spec`

| Topic | Choice |
|--------|--------|
| Cardinality | Still **one circle per adult**; multi-circle stays parking |
| Already a member + accept | **409** — leave first, then join |
| Invite shape | Short **code** only (no deep link PR) |
| Invite lifecycle | **One active code** per circle; regenerate invalidates; **no TTL** |
| Role on join | **CAREGIVER** |
| Promote / demote | Yes; always **≥1 Organizer** |
| Leave | Caregiver free; Organizer only if another Organizer remains; sole Organizer only if **alone + zero kids** |
| Kids / rename | **Organizer-only** writes |
| Invite delivery | Out of band (copy/share); no email/push in this PR |
| Clients | Web + Android + iOS in this PR |
| Display name on join | Required if adult `displayName` still null |
