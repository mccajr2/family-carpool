# Spec: kmp-networking-spike

Status: done
Created: 2026-07-09
Completed: 2026-07-10

## Strategic context

The `greeting` module and mobile demo UI are **disposable test harnesses**, not a product.
This spike's real deliverable is verified, repeatable SDD infrastructure: spec → OpenAPI
contract → Modulith module endpoint → KMP shared client → native UI. Future apps and
modules should follow the same pattern; greeting exists only to prove the toolchain.

## Problem

Checkpoints 1 and 2 proved the backend (Spring Modulith + `greeting` module) and mobile
(KMP `sharedLogic` callable from native Android and iOS) work in isolation. There is no
HTTP surface on the backend yet (`GreetingApi` is an in-process interface, not a REST
controller), no `contracts/openapi.yaml`, and no networking code in `mobile/sharedLogic`.
We cannot verify the full cross-stack toolchain — contract → backend endpoint → KMP HTTP
client → native UI — until this plumbing exists.

## Non-goals

- **Web client.** No `web/` directory exists yet. Creating `contracts/openapi.yaml` is
  in scope as the API source of truth, but wiring a web client is explicitly deferred.
  (AGENTS.md normally requires web + mobile client updates with contract changes; this
  spike is an accepted exception because web does not exist.)
- **Production error handling** — no retry logic, offline mode, structured error types,
  or user-facing error copy beyond a minimal failure string if the call fails.
- **UI polish** — keep existing checkpoint-2 UI patterns (button reveals content); no new
  screens, navigation, or design work.
- **OpenAPI code generation** — document the endpoint in OpenAPI; implement the KMP
  client by hand with Ktor for this spike. Codegen tooling is a follow-up once the
  pattern is proven.
- **Persistence, auth, CORS, HTTPS/TLS** — plain HTTP to a local dev server is fine.
- **CI workflow changes** — no new GitHub Actions in this spike unless required to keep
  existing checks green.
- **Replacing or removing `sharedUI`** — Android continues to use the existing
  `sharedUI` `App()` composable; only the data source changes from local to remote.

## Approach

**Backend:** Add a REST controller in the `greeting` module's public package (not
`internal`) that exposes the existing `GreetingService` over HTTP. The greeting module
will need `spring-boot-starter-web` (or equivalent) added to its own `build.gradle.kts`
since the convention plugin does not include web support. Proposed shape:

```
GET /api/greeting?name={name}
→ 200 { "message": "Hello, {name}, from a Spring Modulith module." }
```

**Contract:** Create `contracts/openapi.yaml` (file does not exist yet) documenting this
single endpoint and response schema. This establishes the contract-first pattern even
though only mobile consumes it for now.

**Mobile (`sharedLogic`):** Add Ktor Client (`ktor-client-core` + platform engines:
`ktor-client-okhttp` for Android, `ktor-client-darwin` for iOS) as the first networking
dependencies in the mobile version catalog. Introduce a small shared API client (e.g.
`GreetingClient` or `ApiClient`) with a `suspend fun fetchGreeting(name: String): String`
that performs the GET, parses JSON, and returns the message. Base URL is supplied via
`expect`/`actual` or a simple config object so Android emulator can use `10.0.2.2:8080`
while iOS simulator uses `localhost:8080`. Extend or replace the existing `Greeting`
class so platform UIs call the remote fetch instead of the local `sayHello()` helper.

**Android:** Add `INTERNET` permission and allow cleartext HTTP to localhost in
`AndroidManifest.xml` (dev spike only). Update `sharedUI` `App()` to trigger the suspend
fetch (e.g. `LaunchedEffect` + coroutines) and display the backend response string.

**iOS:** Add App Transport Security exception for localhost HTTP in `Info.plist`. Update
`ContentView.swift` to call the shared Kotlin suspend function (via coroutines bridge or
a simple callback wrapper exported from `sharedLogic`) and display the result.

**Verification:** Backend gets a `@SpringBootTest` + `MockMvc` integration test (no
Postgres/Testcontainers — this endpoint is stateless). `sharedLogic` gets a `commonTest`
using Ktor `MockEngine` to verify request shape and response parsing without a running
server. Manual smoke test: run backend locally, launch Android emulator and iOS simulator,
confirm both UIs show the backend greeting string.

## Acceptance criteria

- [x] `GET /api/greeting?name=Android` returns HTTP 200 with JSON body
      `{ "message": "Hello, Android, from a Spring Modulith module." }` when the backend
      is running locally. *(Verified via live `curl` during spec completion.)*
- [x] `contracts/openapi.yaml` exists and describes the greeting endpoint and response
      schema; it matches the implemented backend behavior.
- [x] `mobile/sharedLogic` contains a shared HTTP client that calls the greeting endpoint
      and parses the response — not a platform-specific fetch in `androidApp` or `iosApp`.
- [x] Android app (emulator, backend running on host) displays the backend greeting
      message (not the local `sayHello()` string) after user interaction triggers the fetch.
      *(Verified manually 2026-07-10.)*
- [x] iOS app (simulator, backend running on host) displays the same backend greeting
      message via the same shared client code path. *(Verified manually 2026-07-10.)*
- [x] `ModularityTests` still passes — greeting controller and service remain within
      module boundaries.
- [x] Backend integration test (MockMvc) passes for the new endpoint.
- [x] `sharedLogic` commonTest with Ktor MockEngine passes for the client.
- [x] `./gradlew :backend:test` and `./gradlew :sharedLogic:allTests` (or equivalent
      mobile test tasks) pass.

## Tasks

- [x] **Backend:** Add `spring-boot-starter-web` to `backend/modules/greeting/build.gradle.kts`.
- [x] **Backend:** Create `GreetingController` in `com.yourorg.quickapp.greeting` (public
      package) with `GET /api/greeting`, delegating to `GreetingApi`.
- [x] **Backend:** Add response DTO record/class in the public package.
- [x] **Backend:** Add `@SpringBootTest` + MockMvc integration test for the endpoint.
- [x] **Backend:** Run `./gradlew :backend:test --tests ModularityTests` and full backend
      test suite.
- [x] **Contract:** Create `contracts/openapi.yaml` with the greeting endpoint spec.
- [x] **Mobile/sharedLogic:** Add Ktor client dependencies to `mobile/gradle/libs.versions.toml`
      and `sharedLogic/build.gradle.kts` (ask before adding if versions are not already present).
- [x] **Mobile/sharedLogic:** Implement base-URL `expect`/`actual` for Android vs iOS localhost.
- [x] **Mobile/sharedLogic:** Implement `GreetingClient` (or equivalent) with suspend fetch + JSON parse.
- [x] **Mobile/sharedLogic:** Wire `Greeting` (or new facade) to call remote API; keep platform
      name as the `name` query parameter.
- [x] **Mobile/sharedLogic:** Add `commonTest` with Ktor `MockEngine` covering happy path.
- [x] **Android:** Add `INTERNET` permission and cleartext-traffic allowance for localhost.
- [x] **Android:** Update `sharedUI` `App()` to fetch and display remote greeting asynchronously.
- [x] **iOS:** Add ATS localhost exception to `Info.plist`.
- [x] **iOS:** Update `ContentView.swift` to fetch and display remote greeting from sharedLogic.
- [x] **Tests:** Manual smoke checklist documented in PR or spec notes (backend up → Android
      emulator → iOS simulator).

## Verification

### Automated (run 2026-07-10)

```bash
# Backend
./gradlew :backend:test
# → BUILD SUCCESSFUL (ModularityTests + GreetingControllerIntegrationTest)

# Mobile unit tests
cd mobile && ./gradlew :sharedLogic:testAndroidHostTest :sharedLogic:iosSimulatorArm64Test
# → BUILD SUCCESSFUL

# Android compile
cd mobile && ./gradlew :androidApp:assembleDebug
# → BUILD SUCCESSFUL

# iOS compile
cd mobile/iosApp && xcodebuild -project iosApp.xcodeproj -scheme iosApp \
  -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' build
# → BUILD SUCCEEDED

# Live endpoint (backend running)
curl "http://localhost:8080/api/greeting?name=Android"
# → {"message":"Hello, Android, from a Spring Modulith module."}
```

### Manual smoke checklist (verified 2026-07-10)

Prerequisites: backend running on host port 8080 (`./gradlew :backend:bootRun` from repo root).

**Android (emulator)**
1. [x] Start Android emulator.
2. [x] Install/run debug app (Android Studio run config `androidApp`).
3. [x] Tap **Click me!**
4. [x] Confirmed: `Compose: Hello, Android 37, from a Spring Modulith module.`
5. [x] Backend stopped → tap again → short error string (no crash).

**iOS (simulator)**
1. [x] Open `mobile/iosApp` in Xcode, run on iOS Simulator.
2. [x] Tap **Click me!**
3. [x] Confirmed: `SwiftUI: Hello, iOS 26.5, from a Spring Modulith module.`
4. [x] Backend stopped → tap again → verbose error string from Darwin/Ktor (no crash).
      *(Acceptable for spike; normalize in sharedLogic in a follow-up.)*

## Follow-ups (deferred)

- **Normalize network error messages** in `sharedLogic` so Android and iOS show consistent
  user-facing copy (Darwin engine messages are verbose; OkHttp messages are short).
- **OpenAPI codegen** for mobile/web clients once a second endpoint exists.
- **Web client scaffold** (`web/`) — required before next contract change per AGENTS.md.
- **CI workflows** (path-filtered GitHub Actions for backend + mobile).
- **`docs/architecture.md`** — document the SDD loop and when to add contract validation.
- **Contract linter in CI** — when web exists or codegen is adopted.

## Open questions

1. ~~**Ktor dependency approval.**~~ Resolved: Ktor **3.5.1** (Kotlin 2.4 compatibility fix in KTOR-9646).
2. ~~**iOS coroutine bridge.**~~ Resolved: `GreetingBridge` in `iosMain` exposes callback-based
   `fetchGreeting(onSuccess, onError)` for SwiftUI — no extra bridge library.
3. ~~**Endpoint path prefix.**~~ Resolved: implemented as `/api/greeting` per OpenAPI spec.
