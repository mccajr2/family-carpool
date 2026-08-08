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
import kotlin.test.assertNull
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json

class FamilyClientTest {

    @Test
    fun createGetKidsCrudAndNotFound() =
        runTest {
            val mockEngine =
                MockEngine { request ->
                    when {
                        request.url.encodedPath == "/api/family/circle" &&
                            request.method == HttpMethod.Post -> {
                            assertEquals("Bearer tok", request.headers[HttpHeaders.Authorization])
                            respond(
                                content =
                                    """{"id":"c1","name":"Our house","role":"ORGANIZER","kids":[]}""",
                                status = HttpStatusCode.Created,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        }
                        request.url.encodedPath == "/api/family/circle" &&
                            request.method == HttpMethod.Get ->
                            respond(
                                content =
                                    """{"id":"c1","name":null,"role":"ORGANIZER","kids":[{"id":"k1","displayName":"Sam"}]}""",
                                status = HttpStatusCode.OK,
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
                            request.method == HttpMethod.Patch ->
                            respond(
                                content = """{"id":"k1","displayName":"Samantha"}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/kids/k1" &&
                            request.method == HttpMethod.Delete ->
                            respond(content = "", status = HttpStatusCode.NoContent)
                        else -> error("Unexpected ${request.method} ${request.url.encodedPath}")
                    }
                }

            val client = FamilyClient("http://localhost:8080", mockHttpClient(mockEngine))

            val created = client.createCircle("tok", "Alex", "Our house")
            assertEquals(FamilyRole.ORGANIZER, created.role)
            assertEquals("Our house", created.displayTitle())

            assertEquals("Sam", client.addKid("tok", "Sam").displayName)
            assertEquals("Samantha", client.updateKid("tok", "k1", "Samantha").displayName)
            client.deleteKid("tok", "k1")

            val loaded = client.getCircle("tok")
            assertEquals("Your family", loaded?.displayTitle())
            assertEquals("Sam", loaded?.kids?.first()?.displayName)
        }

    @Test
    fun getCircleReturnsNullOn404() =
        runTest {
            val mockEngine =
                MockEngine {
                    respond(
                        content = """{"message":"Family circle not found"}""",
                        status = HttpStatusCode.NotFound,
                        headers = headersOf(HttpHeaders.ContentType, "application/json"),
                    )
                }
            val client = FamilyClient("http://localhost:8080", mockHttpClient(mockEngine))
            assertNull(client.getCircle("tok"))
        }

    @Test
    fun createSurfacesServerErrorMessage() =
        runTest {
            val mockEngine =
                MockEngine {
                    respond(
                        content = """{"message":"Adult already belongs to a family circle"}""",
                        status = HttpStatusCode.Conflict,
                        headers = headersOf(HttpHeaders.ContentType, "application/json"),
                    )
                }
            val client = FamilyClient("http://localhost:8080", mockHttpClient(mockEngine))
            val error =
                assertFailsWith<AuthApiException> {
                    client.createCircle("tok", "Alex")
                }
            assertEquals("Adult already belongs to a family circle", error.message)
        }
}

class FamilyModelsTest {

    @Test
    fun displayTitleUsesPlaceholderWhenNameMissing() {
        val unnamed =
            FamilyCircle(id = "c1", name = null, role = FamilyRole.ORGANIZER, kids = emptyList())
        assertEquals("Your family", unnamed.displayTitle())

        val blank =
            FamilyCircle(id = "c1", name = "  ", role = FamilyRole.ORGANIZER, kids = emptyList())
        assertEquals("Your family", blank.displayTitle())

        val named =
            FamilyCircle(
                id = "c1",
                name = "McCarthy house",
                role = FamilyRole.ORGANIZER,
                kids = emptyList(),
            )
        assertEquals("McCarthy house", named.displayTitle())
    }
}

private fun mockHttpClient(engine: MockEngine): HttpClient =
    HttpClient(engine) {
        install(ContentNegotiation) {
            json(Json { ignoreUnknownKeys = true })
        }
    }
