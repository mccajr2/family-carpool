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
import kotlin.test.assertIs
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json

class AuthUiModelTest {

    @Test
    fun sendCodeThenVerifySignsIn() =
        runTest {
            val mockEngine =
                MockEngine { request ->
                    when (request.url.encodedPath) {
                        "/api/auth/request-code" ->
                            respond(
                                content =
                                    """{"email":"parent@example.com","expiresInSeconds":600,"devCode":"111222"}""",
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
                        else -> error("Unexpected ${request.url.encodedPath}")
                    }
                }
            val (model, store) = authUiModel(mockEngine)

            model.updateEmail("parent@example.com")
            model.sendCode()
            val afterSend = assertIs<AuthUiModel.State.SignedOut>(model.state)
            assertTrue(afterSend.codeSent)
            assertEquals("111222", afterSend.devHint)

            model.verifyCode()
            val signedIn = assertIs<AuthUiModel.State.SignedIn>(model.state)
            assertEquals("parent@example.com", signedIn.email)
            assertEquals("tok", store.loadAccessToken())
        }

    @Test
    fun signOutClearsSession() =
        runTest {
            val mockEngine =
                MockEngine { request ->
                    when (request.url.encodedPath) {
                        "/api/auth/request-code" ->
                            respond(
                                content =
                                    """{"email":"a@b.com","expiresInSeconds":600,"devCode":"123456"}""",
                                status = HttpStatusCode.Accepted,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
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
            val (model, store) = authUiModel(mockEngine)

            model.updateEmail("a@b.com")
            model.sendCode()
            model.verifyCode()
            assertIs<AuthUiModel.State.SignedIn>(model.state)

            model.signOut()
            assertIs<AuthUiModel.State.SignedOut>(model.state)
            assertNull(store.loadAccessToken())
        }

    @Test
    fun sendCodeSurfacesError() =
        runTest {
            val mockEngine =
                MockEngine {
                    respond(
                        content = """{"message":"Too many code requests"}""",
                        status = HttpStatusCode.TooManyRequests,
                        headers = headersOf(HttpHeaders.ContentType, "application/json"),
                    )
                }
            val (model, _) = authUiModel(mockEngine)
            model.updateEmail("a@b.com")
            model.sendCode()
            val state = assertIs<AuthUiModel.State.SignedOut>(model.state)
            assertEquals("Too many code requests", state.error)
        }
}

private fun authUiModel(mockEngine: MockEngine): Pair<AuthUiModel, InMemorySecureTokenStore> {
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
    return AuthUiModel(session) to store
}
