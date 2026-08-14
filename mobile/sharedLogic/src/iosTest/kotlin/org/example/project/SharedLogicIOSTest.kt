package org.example.project

import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.headersOf
import io.ktor.serialization.kotlinx.json.json
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json

class AuthBridgeTest {

    @Test
    fun requestVerifyAndLogoutViaCallbacks() =
        runBlocking {
            val mockEngine =
                MockEngine { request ->
                    when (request.url.encodedPath) {
                        "/api/auth/request-code" ->
                            respond(
                                content =
                                    """{"email":"parent@example.com","expiresInSeconds":600,"devCode":"424242"}""",
                                status = HttpStatusCode.Accepted,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        "/api/auth/verify-code" ->
                            respond(
                                content =
                                    """{"accessToken":"tok","tokenType":"Bearer","adult":{"id":"1","email":"parent@example.com"}}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        "/api/auth/logout" ->
                            respond(content = "", status = HttpStatusCode.NoContent)
                        else -> error("Unexpected ${request.url.encodedPath}")
                    }
                }
            val httpClient =
                HttpClient(mockEngine) {
                    install(ContentNegotiation) {
                        json(Json { ignoreUnknownKeys = true })
                    }
                }
            val store = InMemorySecureTokenStore()
            val bridge =
                AuthBridge(
                    session =
                        AuthSession(
                            client = AuthClient("http://localhost:8080", httpClient),
                            tokenStore = store,
                        ),
                    familyClient = FamilyClient("http://localhost:8080", httpClient),
                    scope = CoroutineScope(Dispatchers.Unconfined),
                )

            val codeDeferred = CompletableDeferred<String?>()
            bridge.requestCode(
                email = "parent@example.com",
                onSuccess = { codeDeferred.complete(it) },
                onError = { codeDeferred.completeExceptionally(IllegalStateException(it)) },
            )
            assertEquals("424242", codeDeferred.await())

            val emailDeferred = CompletableDeferred<String>()
            bridge.verifyCode(
                email = "parent@example.com",
                code = "424242",
                onSuccess = { emailDeferred.complete(it) },
                onError = { emailDeferred.completeExceptionally(IllegalStateException(it)) },
            )
            assertEquals("parent@example.com", emailDeferred.await())
            assertTrue(bridge.isSignedIn())

            val logoutDeferred = CompletableDeferred<Unit>()
            bridge.logout(
                onSuccess = { logoutDeferred.complete(Unit) },
                onError = { logoutDeferred.completeExceptionally(IllegalStateException(it)) },
            )
            logoutDeferred.await()
            assertFalse(bridge.isSignedIn())
        }

    @Test
    fun getCarpoolSummaryReturnsJsonAndEnableReloadsOwner() =
        runBlocking {
            var enabled = false
            val mockEngine =
                MockEngine { request ->
                    when (request.url.encodedPath) {
                        "/api/carpool" ->
                            respond(
                                content =
                                    if (enabled) {
                                        """{"circleRole":"ORGANIZER","feeds":[{"feedId":"f1","feedName":"Soccer","status":"OWNER","spaceId":"s1","spaceName":"Soccer"}],"spaces":[{"id":"s1","name":"Soccer","membership":"OWNER","inviteCode":"AB12CD34","callerFeedId":"f1","members":[{"circleId":"c1","circleName":"House A","membership":"OWNER"}],"pendingRequests":[]}]}"""
                                    } else {
                                        """{"circleRole":"ORGANIZER","feeds":[{"feedId":"f1","feedName":"Soccer","status":"NONE","spaceId":null,"spaceName":null}],"spaces":[]}"""
                                    },
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        "/api/carpool/enable" -> {
                            enabled = true
                            respond(
                                content =
                                    """{"id":"s1","name":"Soccer","membership":"OWNER","inviteCode":"AB12CD34","callerFeedId":"f1","members":[{"circleId":"c1","circleName":"House A","membership":"OWNER"}],"pendingRequests":[]}""",
                                status = HttpStatusCode.Created,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        }
                        else -> error("Unexpected ${request.url.encodedPath}")
                    }
                }
            val httpClient =
                HttpClient(mockEngine) {
                    install(ContentNegotiation) {
                        json(Json { ignoreUnknownKeys = true })
                    }
                }
            val store = InMemorySecureTokenStore().also { it.saveAccessToken("tok") }
            val bridge =
                AuthBridge(
                    session =
                        AuthSession(
                            client = AuthClient("http://localhost:8080", httpClient),
                            tokenStore = store,
                        ),
                    familyClient = FamilyClient("http://localhost:8080", httpClient),
                    scope = CoroutineScope(Dispatchers.Unconfined),
                    calendarCache = InMemoryCalendarCacheStore(),
                    bootstrapCache = InMemoryFamilyBootstrapCache(),
                    carpoolClient = CarpoolClient("http://localhost:8080", httpClient),
                )

            val summaryDeferred = CompletableDeferred<String>()
            bridge.getCarpoolSummary(
                onSuccess = { summaryDeferred.complete(it) },
                onError = { summaryDeferred.completeExceptionally(IllegalStateException(it)) },
            )
            val summaryJson = summaryDeferred.await()
            assertTrue(summaryJson.contains("\"status\":\"NONE\""))
            assertEquals("No carpool", bridge.carpoolFeedStatusLabel("NONE"))
            assertFalse(bridge.carpoolEmptyHint("CAREGIVER").contains("Feeds"))

            val enabledDeferred = CompletableDeferred<String>()
            bridge.enableCarpool(
                feedId = "f1",
                onSuccess = { enabledDeferred.complete(it) },
                onError = { enabledDeferred.completeExceptionally(IllegalStateException(it)) },
            )
            val enabledJson = enabledDeferred.await()
            assertTrue(enabledJson.contains("\"status\":\"OWNER\""))
            assertTrue(enabledJson.contains("AB12CD34"))
        }

    @Test
    fun calendarCacheRoundTripAndClearsOnLogout() =
        runBlocking {
            val mockEngine =
                MockEngine { request ->
                    when (request.url.encodedPath) {
                        "/api/auth/me" ->
                            respond(
                                content =
                                    """{"id":"1","email":"parent@example.com","displayName":"Alex"}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        "/api/family/circle" ->
                            respond(
                                content =
                                    """{"id":"c1","name":"House","role":"ORGANIZER","members":[{"adultId":"1","email":"parent@example.com","displayName":"Alex","role":"ORGANIZER"}],"kids":[],"places":[]}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        "/api/family/circle/invite" ->
                            respond(
                                content = """{"code":"AB12CD34"}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        "/api/auth/logout" ->
                            respond(content = "", status = HttpStatusCode.NoContent)
                        else -> error("Unexpected ${request.url.encodedPath}")
                    }
                }
            val httpClient =
                HttpClient(mockEngine) {
                    install(ContentNegotiation) {
                        json(Json { ignoreUnknownKeys = true })
                    }
                }
            val store = InMemorySecureTokenStore().also { it.saveAccessToken("tok") }
            val cache = InMemoryCalendarCacheStore()
            val bridge =
                AuthBridge(
                    session =
                        AuthSession(
                            client = AuthClient("http://localhost:8080", httpClient),
                            tokenStore = store,
                        ),
                    familyClient = FamilyClient("http://localhost:8080", httpClient),
                    scope = CoroutineScope(Dispatchers.Unconfined),
                    calendarCache = cache,
                )

            val ready = CompletableDeferred<Unit>()
            bridge.loadFamily(
                onNeedsCreate = { _, _ -> ready.completeExceptionally(IllegalStateException("expected ready")) },
                onReady = { _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _ -> ready.complete(Unit) },
                onError = { ready.completeExceptionally(IllegalStateException(it)) },
            )
            ready.await()

            assertFalse(bridge.peekCalendarCache { _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _ -> })
            val saved =
                bridge.saveCalendarCache(
                from = "2026-08-12T00:00:00Z",
                to = "2026-09-11T00:00:00Z",
                fetchedAt = 1_700_000_000_000L,
                ids = listOf("e1"),
                sources = listOf("MANUAL"),
                titles = listOf("Practice"),
                startsAts = listOf("2026-08-15T17:00:00Z"),
                endsAts = listOf(""),
                locations = listOf(""),
                kidIdsJoined = listOf("k1"),
                feedIds = listOf(""),
                feedNames = listOf(""),
                leaveFromPlaceIds = listOf(""),
                leaveFromPlaceNames = listOf(""),
                leaveByAts = listOf(""),
                leaveByStatuses = listOf("UNAVAILABLE"),
                leaveByReasons = listOf("NO_ORIGIN"),
                coveragesJson = listOf("[]"),
                uncoveredKidIdsJoined = listOf("k1"),
                conflictsJson = listOf("[]"),
            )
            assertTrue(saved)
            var peekedTitle: String? = null
            var peekedFetchedAt: Long? = null
            assertTrue(
                bridge.peekCalendarCache { _, _, fetchedAt, _, _, titles, _, _, _, _, _, _, _, _, _, _, _, _, _, _ ->
                    peekedTitle = titles.single()
                    peekedFetchedAt = fetchedAt
                },
            )
            assertEquals("Practice", peekedTitle)
            assertEquals(1_700_000_000_000L, peekedFetchedAt)

            bridge.patchCalendarCacheItem(
                id = "e1",
                source = "MANUAL",
                title = "Scrimmage",
                startsAt = "2026-08-15T17:00:00Z",
                endsAt = "",
                location = "",
                kidIdsJoined = "k1",
                feedId = "",
                feedName = "",
                leaveFromPlaceId = "",
                leaveFromPlaceName = "",
                leaveByAt = "",
                leaveByStatus = "UNAVAILABLE",
                leaveByReason = "NO_ORIGIN",
                coveragesJson = "[]",
                uncoveredKidIdsJoined = "k1",
                conflictsJson = "[]",
            )
            assertTrue(
                bridge.peekCalendarCache { _, _, _, _, _, titles, _, _, _, _, _, _, _, _, _, _, _, _, _, _ ->
                    assertEquals("Scrimmage", titles.single())
                },
            )

            val logoutDeferred = CompletableDeferred<Unit>()
            bridge.logout(
                onSuccess = { logoutDeferred.complete(Unit) },
                onError = { logoutDeferred.completeExceptionally(IllegalStateException(it)) },
            )
            logoutDeferred.await()
            // Sign-out must not wipe calendar cache — same adult paints on next login.
            assertEquals("Scrimmage", cache.load("1", "c1")!!.items.single().title)
            assertFalse(
                bridge.peekCalendarCache { _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _ -> },
                "active adult/circle cleared on logout so peek misses until Ready",
            )
        }

    @Test
    fun paintBootstrapIfPresentPaintsShellAndFeedsBeforeGetCircle() =
        runBlocking {
            val circleGate = CompletableDeferred<Unit>()
            val mockEngine =
                MockEngine { request ->
                    when (request.url.encodedPath) {
                        "/api/auth/me" ->
                            respond(
                                content =
                                    """{"id":"1","email":"parent@example.com","displayName":"Alex"}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        "/api/family/circle" -> {
                            circleGate.await()
                            respond(
                                content =
                                    """{"id":"c1","name":"House","role":"ORGANIZER","members":[{"adultId":"1","email":"parent@example.com","displayName":"Alex","role":"ORGANIZER"}],"kids":[],"places":[]}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        }
                        "/api/family/circle/invite" ->
                            respond(
                                content = """{"code":"AB12CD34"}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        "/api/family/circle/feeds" ->
                            respond(
                                content = "[]",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        else -> error("Unexpected ${request.url.encodedPath}")
                    }
                }
            val httpClient =
                HttpClient(mockEngine) {
                    install(ContentNegotiation) {
                        json(Json { ignoreUnknownKeys = true })
                    }
                }
            val bootstrap = InMemoryFamilyBootstrapCache()
            bootstrap.save(
                FamilyBootstrapSnapshot(
                    adultId = "1",
                    email = "parent@example.com",
                    adultDisplayName = "Alex",
                    circle =
                        FamilyCircle(
                            id = "c1",
                            name = "House",
                            role = FamilyRole.ORGANIZER,
                            members =
                                listOf(
                                    FamilyMember(
                                        adultId = "1",
                                        email = "parent@example.com",
                                        displayName = "Alex",
                                        role = FamilyRole.ORGANIZER,
                                    ),
                                ),
                        ),
                    inviteCode = "AB12CD34",
                    feeds =
                        listOf(
                            ActivityFeed(
                                id = "f1",
                                name = "Soccer",
                                sourceUrl = "https://example.com/soccer.ics",
                                eventCount = 3,
                            ),
                        ),
                ),
            )
            val bridge =
                AuthBridge(
                    session =
                        AuthSession(
                            client = AuthClient("http://localhost:8080", httpClient),
                            tokenStore = InMemorySecureTokenStore().also { it.saveAccessToken("tok") },
                        ),
                    familyClient = FamilyClient("http://localhost:8080", httpClient),
                    scope = CoroutineScope(Dispatchers.Unconfined),
                    calendarCache = InMemoryCalendarCacheStore(),
                    bootstrapCache = bootstrap,
                )

            var paintedTitle: String? = null
            var paintedInvite: String? = null
            assertTrue(
                bridge.paintBootstrapIfPresent { title, _, _, _, _, invite, _, _, _, _, _, _, _, _, _, _, _, _ ->
                    paintedTitle = title
                    paintedInvite = invite
                },
            )
            assertEquals("House", paintedTitle)
            assertEquals("AB12CD34", paintedInvite)
            var paintedFeed: String? = null
            assertTrue(
                bridge.peekBootstrapFeeds { _, names, _, _, _, _, _ ->
                    paintedFeed = names.single()
                },
            )
            assertEquals("Soccer", paintedFeed)
            assertFalse(circleGate.isCompleted, "paint must not wait on getCircle")
            circleGate.complete(Unit)
            Unit
        }

    @Test
    fun listCalendarLeaveByViaCallbacks() =
        runBlocking {
            val mockEngine =
                MockEngine { request ->
                    when {
                        request.url.encodedPath == "/api/family/circle/calendar/leave-by" &&
                            request.method == io.ktor.http.HttpMethod.Get -> {
                            assertEquals("2026-08-13T00:00:00Z", request.url.parameters["from"])
                            assertEquals("2026-08-15T00:00:00Z", request.url.parameters["to"])
                            respond(
                                content =
                                    """[{"id":"e1","source":"MANUAL","leaveFromPlaceId":"p1","leaveFromPlaceName":"Home","leaveByAt":"2026-08-15T16:30:00Z","leaveByStatus":"OK","leaveByReason":null}]""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        }
                        else -> error("Unexpected ${request.method} ${request.url.encodedPath}")
                    }
                }
            val httpClient =
                HttpClient(mockEngine) {
                    install(ContentNegotiation) {
                        json(Json { ignoreUnknownKeys = true })
                    }
                }
            val bridge =
                AuthBridge(
                    session =
                        AuthSession(
                            client = AuthClient("http://localhost:8080", httpClient),
                            tokenStore = InMemorySecureTokenStore().also { it.saveAccessToken("tok") },
                        ),
                    familyClient = FamilyClient("http://localhost:8080", httpClient),
                    scope = CoroutineScope(Dispatchers.Unconfined),
                )
            val done = CompletableDeferred<List<String>>()
            bridge.listCalendarLeaveBy(
                from = "2026-08-13T00:00:00Z",
                to = "2026-08-15T00:00:00Z",
                onSuccess = { ids, _, _, _, leaveByAts, statuses, _ ->
                    done.complete(listOf(ids.single(), leaveByAts.single(), statuses.single()))
                },
                onError = { done.completeExceptionally(IllegalStateException(it)) },
            )
            val row = done.await()
            assertEquals("e1", row[0])
            assertEquals("2026-08-15T16:30:00Z", row[1])
            assertEquals("OK", row[2])
        }
}

class SharedLogicIOSTest {

    @Test
    fun apiBaseUrlPointsAtLocalhost() {
        assertEquals("http://localhost:8080", apiBaseUrl())
    }
}
