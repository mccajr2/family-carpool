package org.example.project

import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpMethod
import io.ktor.http.HttpStatusCode
import io.ktor.http.headersOf
import io.ktor.serialization.kotlinx.json.json
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json

class AuthClientTest {

    @Test
    fun requestVerifyMeAndLogoutHappyPath() =
        runTest {
            val mockEngine =
                MockEngine { request ->
                    when {
                        request.url.encodedPath == "/api/auth/request-code" &&
                            request.method == HttpMethod.Post ->
                            respond(
                                content =
                                    """{"email":"parent@example.com","expiresInSeconds":600,"devCode":"123456"}""",
                                status = HttpStatusCode.Accepted,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/auth/verify-code" &&
                            request.method == HttpMethod.Post ->
                            respond(
                                content =
                                    """{"accessToken":"tok","tokenType":"Bearer","adult":{"id":"1","email":"parent@example.com","displayName":null}}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/auth/me" -> {
                            assertEquals("Bearer tok", request.headers[HttpHeaders.Authorization])
                            respond(
                                content =
                                    """{"id":"1","email":"parent@example.com","displayName":null}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        }
                        request.url.encodedPath == "/api/auth/logout" &&
                            request.method == HttpMethod.Post ->
                            respond(
                                content = "",
                                status = HttpStatusCode.NoContent,
                            )
                        else -> error("Unexpected ${request.method} ${request.url.encodedPath}")
                    }
                }

            val httpClient =
                HttpClient(mockEngine) {
                    install(ContentNegotiation) {
                        json(Json { ignoreUnknownKeys = true })
                    }
                }
            val client = AuthClient("http://localhost:8080", httpClient)

            val requested = client.requestCode("parent@example.com")
            assertEquals("123456", requested.devCode)

            val session = client.verifyCode("parent@example.com", "123456")
            assertEquals("tok", session.accessToken)

            assertEquals("parent@example.com", client.getMe("tok").email)
            client.logout("tok")
        }

    @Test
    fun requestCodeSurfacesServerErrorMessage() =
        runTest {
            val mockEngine =
                MockEngine {
                    respond(
                        content = """{"message":"Too many code requests"}""",
                        status = HttpStatusCode.TooManyRequests,
                        headers = headersOf(HttpHeaders.ContentType, "application/json"),
                    )
                }
            val httpClient =
                HttpClient(mockEngine) {
                    install(ContentNegotiation) {
                        json(Json { ignoreUnknownKeys = true })
                    }
                }
            val client = AuthClient("http://localhost:8080", httpClient)

            val error =
                assertFailsWith<AuthApiException> {
                    client.requestCode("parent@example.com")
                }
            assertEquals("Too many code requests", error.message)
            assertFalse(error.unreachable)
        }

    @Test
    fun connectFailureIsFlaggedUnreachable() =
        runTest {
            val mockEngine = MockEngine { throw RuntimeException("Failed to connect to /127.0.0.1:8080") }
            val httpClient =
                HttpClient(mockEngine) {
                    install(ContentNegotiation) {
                        json(Json { ignoreUnknownKeys = true })
                    }
                }
            val client = AuthClient("http://127.0.0.1:8080", httpClient)

            val error = assertFailsWith<AuthApiException> { client.getMe("tok") }
            assertTrue(error.unreachable)
            assertTrue(error.message?.contains("Cannot reach http://127.0.0.1:8080") == true)
        }
}

class AuthSessionTest {

    @Test
    fun verifyPersistsTokenAndLogoutClearsIt() =
        runTest {
            val mockEngine =
                MockEngine { request ->
                    when (request.url.encodedPath) {
                        "/api/auth/verify-code" ->
                            respond(
                                content =
                                    """{"accessToken":"tok","tokenType":"Bearer","adult":{"id":"1","email":"a@b.com"}}""",
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
            val session =
                AuthSession(
                    client = AuthClient("http://localhost:8080", httpClient),
                    tokenStore = store,
                )

            session.verifyCode("a@b.com", "123456")
            assertTrue(session.isSignedIn())
            assertEquals("tok", store.loadAccessToken())

            session.logout()
            assertNull(store.loadAccessToken())
        }

    @Test
    fun logoutClearsTokenEvenWhenServerCallFails() =
        runTest {
            val mockEngine =
                MockEngine { request ->
                    when (request.url.encodedPath) {
                        "/api/auth/logout" -> throw RuntimeException("Failed to connect")
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
            val session =
                AuthSession(
                    client = AuthClient("http://localhost:8080", httpClient),
                    tokenStore = store,
                )

            val error = assertFailsWith<Throwable> { session.logout() }
            assertTrue(error.message?.contains("Failed to connect") == true)
            assertNull(store.loadAccessToken())
            assertFalse(session.isSignedIn())
        }

    @Test
    fun clearLocalSessionDropsTokenWithoutCallingServer() {
        val mockEngine = MockEngine { error("clearLocalSession must not call the server") }
        val httpClient = HttpClient(mockEngine)
        val store = InMemorySecureTokenStore().also { it.saveAccessToken("tok") }
        val session =
            AuthSession(
                client = AuthClient("http://localhost:8080", httpClient),
                tokenStore = store,
            )

        session.clearLocalSession()

        assertNull(store.loadAccessToken())
        assertFalse(session.isSignedIn())
        assertTrue(mockEngine.requestHistory.isEmpty())
    }
}

class InMemorySecureTokenStoreTest {

    @Test
    fun storesAndClearsToken() {
        val store = InMemorySecureTokenStore()
        store.saveAccessToken("abc")
        assertEquals("abc", store.loadAccessToken())
        store.clear()
        assertNull(store.loadAccessToken())
    }
}
