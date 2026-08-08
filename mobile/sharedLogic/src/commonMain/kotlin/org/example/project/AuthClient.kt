package org.example.project

import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.http.isSuccess
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

class AuthClient(
    private val baseUrl: String,
    private val httpClient: HttpClient = createHttpClient(),
) {
    suspend fun requestCode(email: String): RequestAuthCodeResponse =
        withConnectivityHint {
            val response =
                httpClient.post("$baseUrl/api/auth/request-code") {
                    contentType(ContentType.Application.Json)
                    setBody(RequestAuthCodeRequest(email))
                }
            ensureSuccess(response, "Request code failed")
            response.body()
        }

    suspend fun verifyCode(
        email: String,
        code: String,
    ): AuthSessionResponse =
        withConnectivityHint {
            val response =
                httpClient.post("$baseUrl/api/auth/verify-code") {
                    contentType(ContentType.Application.Json)
                    setBody(VerifyAuthCodeRequest(email, code))
                }
            ensureSuccess(response, "Verify code failed")
            response.body()
        }

    suspend fun getMe(accessToken: String): Adult =
        withConnectivityHint {
            val response =
                httpClient.get("$baseUrl/api/auth/me") {
                    header(HttpHeaders.Authorization, "Bearer $accessToken")
                }
            ensureSuccess(response, "Current adult failed")
            response.body()
        }

    suspend fun logout(accessToken: String) {
        withConnectivityHint {
            val response =
                httpClient.post("$baseUrl/api/auth/logout") {
                    header(HttpHeaders.Authorization, "Bearer $accessToken")
                }
            if (response.status != HttpStatusCode.NoContent && !response.status.isSuccess()) {
                throw AuthApiException(awaitMessage(response, "Logout failed"))
            }
        }
    }

    private suspend inline fun <T> withConnectivityHint(block: suspend () -> T): T =
        try {
            block()
        } catch (error: AuthApiException) {
            throw error
        } catch (error: Throwable) {
            throw AuthApiException(connectivityMessage(baseUrl, error), error)
        }

    companion object {
        fun create(baseUrl: String = apiBaseUrl()): AuthClient = AuthClient(baseUrl)
    }
}

class AuthApiException(
    message: String,
    cause: Throwable? = null,
) : Exception(message, cause)

@Serializable
private data class RequestAuthCodeRequest(val email: String)

@Serializable
private data class VerifyAuthCodeRequest(
    val email: String,
    val code: String,
)

internal fun createHttpClient(): HttpClient =
    HttpClient {
        install(ContentNegotiation) {
            json(
                Json {
                    ignoreUnknownKeys = true
                    explicitNulls = false
                },
            )
        }
    }

internal fun connectivityMessage(
    baseUrl: String,
    error: Throwable,
): String {
    val detail = error.message?.takeIf { it.isNotBlank() } ?: error::class.simpleName ?: "network error"
    return "Cannot reach $baseUrl ($detail). Is the backend running? On Android run: adb reverse tcp:8080 tcp:8080"
}

internal suspend fun ensureSuccess(
    response: HttpResponse,
    fallback: String,
) {
    if (!response.status.isSuccess()) {
        throw AuthApiException(awaitMessage(response, fallback))
    }
}

internal suspend fun awaitMessage(
    response: HttpResponse,
    fallback: String,
): String {
    val text = response.bodyAsText()
    return try {
        Json { ignoreUnknownKeys = true }.decodeFromString<ErrorBody>(text).message
    } catch (_: Throwable) {
        "$fallback (${response.status.value})"
    }
}
