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
import kotlin.test.assertIs
import kotlin.test.assertTrue
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json

class FamilyUiModelTest {

    @Test
    fun createCircleThenAddAndRemoveKid() =
        runTest {
            val mockEngine =
                MockEngine { request ->
                    when {
                        request.url.encodedPath == "/api/auth/me" ->
                            respond(
                                content =
                                    """{"id":"1","email":"parent@example.com","displayName":"Alex"}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle" &&
                            request.method == HttpMethod.Get ->
                            respond(
                                content = """{"message":"Family circle not found"}""",
                                status = HttpStatusCode.NotFound,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle" &&
                            request.method == HttpMethod.Post ->
                            respond(
                                content =
                                    """{"id":"c1","name":null,"role":"ORGANIZER","kids":[]}""",
                                status = HttpStatusCode.Created,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/kids" &&
                            request.method == HttpMethod.Post ->
                            respond(
                                content = """{"id":"k1","displayName":"Sam"}""",
                                status = HttpStatusCode.Created,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/kids/k1" &&
                            request.method == HttpMethod.Delete ->
                            respond(content = "", status = HttpStatusCode.NoContent)
                        else -> error("Unexpected ${request.method} ${request.url.encodedPath}")
                    }
                }
            val model = familyUiModel(mockEngine, token = "tok")

            model.load()
            val needsCreate = assertIs<FamilyUiModel.State.NeedsCreate>(model.state)
            assertEquals("parent@example.com", needsCreate.email)

            model.updateAdultDisplayName("Alex")
            model.createCircle()
            val ready = assertIs<FamilyUiModel.State.Ready>(model.state)
            assertEquals("Your family", ready.circle.displayTitle())
            assertEquals("Alex", ready.adultDisplayName)

            model.updateNewKidName("Sam")
            model.addKid()
            val withKid = assertIs<FamilyUiModel.State.Ready>(model.state)
            assertEquals(1, withKid.circle.kids.size)
            assertEquals("Sam", withKid.circle.kids.first().displayName)

            model.removeKid("k1")
            val withoutKid = assertIs<FamilyUiModel.State.Ready>(model.state)
            assertTrue(withoutKid.circle.kids.isEmpty())
        }

    @Test
    fun loadShowsNamedCircleWhenPresent() =
        runTest {
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
                                    """{"id":"c1","name":"McCarthy house","role":"ORGANIZER","kids":[]}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        else -> error("Unexpected ${request.url.encodedPath}")
                    }
                }
            val model = familyUiModel(mockEngine, token = "tok")
            model.load()
            val ready = assertIs<FamilyUiModel.State.Ready>(model.state)
            assertEquals("McCarthy house", ready.circle.displayTitle())
        }
}

private fun familyUiModel(
    mockEngine: MockEngine,
    token: String,
): FamilyUiModel {
    val httpClient =
        HttpClient(mockEngine) {
            install(ContentNegotiation) {
                json(Json { ignoreUnknownKeys = true })
            }
        }
    val store = InMemorySecureTokenStore().also { it.saveAccessToken(token) }
    val session =
        AuthSession(
            client = AuthClient("http://localhost:8080", httpClient),
            tokenStore = store,
        )
    return FamilyUiModel(
        session = session,
        familyClient = FamilyClient("http://localhost:8080", httpClient),
    )
}
