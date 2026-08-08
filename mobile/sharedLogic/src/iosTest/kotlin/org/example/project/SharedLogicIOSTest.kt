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
}

class SharedLogicIOSTest {

    @Test
    fun apiBaseUrlPointsAtLocalhost() {
        assertEquals("http://localhost:8080", apiBaseUrl())
    }
}
