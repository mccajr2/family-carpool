# family-carpool

Family scheduling and carpool app — built from the quickapp SDD starter.


| Layer    | Stack                                                                  |
| -------- | ---------------------------------------------------------------------- |
| Backend  | Java 25, Spring Boot 4.1, Spring Modulith (`auth` + `family` + `carpool`) |
| Mobile   | Kotlin Multiplatform — shared logic, Android (Compose) + iOS (SwiftUI) |
| Web      | Vite + React + TypeScript + Tailwind (shadcn-style UI)                 |
| Contract | OpenAPI (`contracts/openapi.yaml`)                                     |
| Workflow | `/roadmap` → `/spec` → `/implement` → `/pr` → merge                    |


Product path so far: **email OTP + Bearer auth**, **family circle + kids**,
unified **Agenda**, and **opt-in team carpool spaces** (one per feed URL;
Organizer Enable; join by code or request; request / accept / pass rides).
Greeting harness removed.

## Quick start (auth + family smoke)

Requires **Postgres** (local Docker or Neon). Defaults:

- URL `jdbc:postgresql://localhost:5432/family_carpool`
- User/password `family_carpool` / `family_carpool`

```bash
# Backend (repo root) — leave running
./gradlew :backend:bootRun

# Request a sign-in code (dev echoes the OTP in the JSON body + server log)
curl -s -X POST http://localhost:8080/api/auth/request-code \
  -H 'Content-Type: application/json' \
  -d '{"email":"parent@example.com"}'

# Verify (use devCode from the response when AUTH_DEV_CODE_ECHO=true)
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/verify-code \
  -H 'Content-Type: application/json' \
  -d '{"email":"parent@example.com","code":"123456"}' | jq -r .accessToken)

# Create family circle (sets adult displayName; optional circle name)
curl -s -X POST http://localhost:8080/api/family/circle \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"adultDisplayName":"Alex","name":"McCarthy house"}'

# Organizer: copy invite code to share out of band
CODE=$(curl -s http://localhost:8080/api/family/circle/invite \
  -H "Authorization: Bearer $TOKEN" | jq -r .code)

# Second adult signs in, then joins as Caregiver
TOKEN2=$(curl -s -X POST http://localhost:8080/api/auth/verify-code \
  -H 'Content-Type: application/json' \
  -d '{"email":"other@example.com","code":"123456"}' | jq -r .accessToken)
# (request-code for other@example.com first, same as above)
curl -s -X POST http://localhost:8080/api/family/circle/join \
  -H "Authorization: Bearer $TOKEN2" \
  -H 'Content-Type: application/json' \
  -d "{\"code\":\"$CODE\",\"adultDisplayName\":\"Jordan\"}"

# Add a kid (Organizer only)
curl -s -X POST http://localhost:8080/api/family/circle/kids \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"displayName":"Sam"}'
```

## Team carpool smoke (enable, join, request, accept)

Same backend and `$TOKEN` (family A Organizer) as above. A second household
needs its own circle — a carpool code does not create a family.

```bash
# Family A: subscribe a team calendar (Organizer), then Enable carpool
FEED_ID=$(curl -s -X POST http://localhost:8080/api/family/circle/feeds \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Soccer","sourceUrl":"https://example.com/team.ics","kidIds":[]}' \
  | jq -r .id)

SPACE=$(curl -s -X POST http://localhost:8080/api/carpool/enable \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"feedId\":\"$FEED_ID\"}")
CARPOOL_CODE=$(echo "$SPACE" | jq -r .inviteCode)
SPACE_ID=$(echo "$SPACE" | jq -r .id)

# Family B: new adult, new circle, then join by carpool code (Caregiver OK too)
curl -s -X POST http://localhost:8080/api/auth/request-code \
  -H 'Content-Type: application/json' \
  -d '{"email":"other-family@example.com"}'
TOKEN_B=$(curl -s -X POST http://localhost:8080/api/auth/verify-code \
  -H 'Content-Type: application/json' \
  -d '{"email":"other-family@example.com","code":"123456"}' | jq -r .accessToken)
curl -s -X POST http://localhost:8080/api/family/circle \
  -H "Authorization: Bearer $TOKEN_B" \
  -H 'Content-Type: application/json' \
  -d '{"adultDisplayName":"Sam","name":"House B"}'
curl -s -X POST http://localhost:8080/api/carpool/join \
  -H "Authorization: Bearer $TOKEN_B" \
  -H 'Content-Type: application/json' \
  -d "{\"code\":\"$CARPOOL_CODE\"}"
# Join creates the feed for House B if they lacked that URL, then syncs.
# Clients reload Feeds + Agenda after join — no manual Refresh required.

# Ride loop (after Sync has feed events; mark RSVP Yes on Calendar first):
# Family B: home address for pickup snapshot
curl -s -X POST http://localhost:8080/api/family/circle/places \
  -H "Authorization: Bearer $TOKEN_B" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Home","address":"1 Main St"}'

FROM=$(date -u -v-0d +%Y-%m-%dT00:00:00Z 2>/dev/null || date -u -d 'today 00:00' +%Y-%m-%dT00:00:00Z)
TO=$(date -u -v+30d +%Y-%m-%dT00:00:00Z 2>/dev/null || date -u -d 'today + 30 days' +%Y-%m-%dT00:00:00Z)

# List upcoming rides (see seats + pickup on other families' PENDING requests)
curl -s "http://localhost:8080/api/carpool/spaces/$SPACE_ID/rides?from=$FROM&to=$TO" \
  -H "Authorization: Bearer $TOKEN_B" | jq .

EVENT_KEY=$(curl -s "http://localhost:8080/api/carpool/spaces/$SPACE_ID/rides?from=$FROM&to=$TO" \
  -H "Authorization: Bearer $TOKEN_B" | jq -r '.[0].eventKey')

# Family B requests a ride (defaults to all RSVP YES kids who still need one)
RIDE_ID=$(curl -s -X POST "http://localhost:8080/api/carpool/spaces/$SPACE_ID/rides" \
  -H "Authorization: Bearer $TOKEN_B" \
  -H 'Content-Type: application/json' \
  -d "{\"eventKey\":\"$EVENT_KEY\"}" | jq -r .id)

# Family A accepts (empty body — no vehicle required)
curl -s -X POST "http://localhost:8080/api/carpool/spaces/$SPACE_ID/rides/$RIDE_ID/accept" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

**Web:**

```bash
cd web
npm ci                 # Node ^22.22.2 || ^24.15 || >=26; CI uses web/.nvmrc + packageManager
npm run dev
```

Open the app → email OTP → **Create family** or **Have an invite code?** →
members / invite code (Organizer) → add/rename/remove kids (Organizer) →
**More / Settings → Places** (and Feeds for Organizers) →
**Calendar** (RSVP Yes for who’s going) → **Carpool** (Enable on a feed,
paste a code, request/admit, then **Request** / **Accept** / **Pass** a ride) →
Leave family or Sign out. Unnamed circles show as **Your
family**. Android/iOS Carpool UI stays membership-only for now.

**Android:** open `mobile/` in Android Studio → run `androidApp` on an emulator.
The app calls `http://127.0.0.1:8080`; `./gradlew :androidApp:installDebug` (and
Studio install) runs `adb reverse tcp:8080 tcp:8080` so that reaches your Mac.
Re-run install/`adbReverse` after an emulator restart (modern AVDs use Wi‑Fi,
so the old `10.0.2.2` host alias is unreliable for app traffic).

```bash
cd mobile && ./gradlew :androidApp:adbReverse
```

**iOS:** open `mobile/iosApp/iosApp.xcodeproj` in Xcode → run on a simulator.

Set `AUTH_DEV_CODE_ECHO=false` for production-shaped configs (no plaintext OTP in
responses). Real SMTP is Upcoming `auth-email-delivery`.

## Docs


| Doc                                                    | Purpose                                                      |
| ------------------------------------------------------ | ------------------------------------------------------------ |
| [AGENTS.md](AGENTS.md)                                 | Lean constitution + what to load for the current task        |
| [docs/context.md](docs/context.md)                     | Doc map, conversation phases, model choice (on demand)       |
| [docs/roadmap.md](docs/roadmap.md)                     | Product backlog — carve-up, re-rank, Next up                 |
| [docs/architecture.md](docs/architecture.md)           | Locked decisions — read by heading, not in full              |
| [docs/specs/](docs/specs/)                             | Planned stubs, **one** active spec, archived history         |
| [contracts/openapi.yaml](contracts/openapi.yaml)       | API source of truth                                          |
| [docs/using-as-template.md](docs/using-as-template.md) | Upstream template leftover (greeting already deleted)        |




## Tests

```bash
# Backend (needs Docker for Testcontainers Postgres)
./gradlew :backend:test

# Mobile (from mobile/) — needs Android SDK; local.properties auto-generated
cd mobile
./gradlew :sharedLogic:testAndroidHostTest :androidApp:assembleDebug

# Web (from web/)
cd web
npm test
```



## Status

Active product: family calendar + carpool roadmap. Auth, family-circle, Agenda,
and team carpool spaces shipped on feature branches via PR.
`main` is PR-protected. Next up: `auth-email-delivery`.
Pre-beta gates later: `web-auth-session-hardening`,
`adult-optional-password`.