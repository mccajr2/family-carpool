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

            assertEquals(null, bridge.peekCalendarCache())
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
            val hit = bridge.peekCalendarCache()
            assertEquals("Practice", hit!!.titles.single())
            assertEquals(1_700_000_000_000L, hit.fetchedAt)

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
            assertEquals("Scrimmage", bridge.peekCalendarCache()!!.titles.single())

            val logoutDeferred = CompletableDeferred<Unit>()
            bridge.logout(
                onSuccess = { logoutDeferred.complete(Unit) },
                onError = { logoutDeferred.completeExceptionally(IllegalStateException(it)) },
            )
            logoutDeferred.await()
            assertEquals(null, cache.load("1", "c1"))
        }
}

class SharedLogicIOSTest {

    @Test
    fun apiBaseUrlPointsAtLocalhost() {
        assertEquals("http://localhost:8080", apiBaseUrl())
    }
}
