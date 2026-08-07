package org.example.project

import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.get
import io.ktor.client.request.parameter
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

@Serializable
data class GreetingResponse(val message: String)

class GreetingClient(
    private val baseUrl: String,
    private val httpClient: HttpClient = createHttpClient(),
) {
    suspend fun fetchGreeting(name: String): String {
        val response: GreetingResponse =
            httpClient
                .get("$baseUrl/api/greeting") {
                    parameter("name", name)
                }
                .body()
        return response.message
    }

    companion object {
        fun create(baseUrl: String = apiBaseUrl()): GreetingClient = GreetingClient(baseUrl)
    }
}

private fun createHttpClient(): HttpClient =
    HttpClient {
        install(ContentNegotiation) {
            json(
                Json {
                    ignoreUnknownKeys = true
                },
            )
        }
    }
