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
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json

class GreetingClientTest {

    @Test
    fun fetchGreetingParsesResponse() = runTest {
        val mockEngine =
            MockEngine { request ->
                assertEquals("/api/greeting", request.url.encodedPath)
                assertEquals("Android", request.url.parameters["name"])
                respond(
                    content = """{"message":"Hello, Android, from a Spring Modulith module."}""",
                    status = HttpStatusCode.OK,
                    headers = headersOf(HttpHeaders.ContentType, "application/json"),
                )
            }

        val httpClient =
            HttpClient(mockEngine) {
                install(ContentNegotiation) {
                    json(Json { ignoreUnknownKeys = true })
                }
            }

        val client = GreetingClient("http://localhost:8080", httpClient)
        assertEquals(
            "Hello, Android, from a Spring Modulith module.",
            client.fetchGreeting("Android"),
        )
    }
}
