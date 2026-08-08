package org.example.project

import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.delete
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.patch
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType

class FamilyClient(
    private val baseUrl: String,
    private val httpClient: HttpClient = createHttpClient(),
) {
    suspend fun createCircle(
        accessToken: String,
        adultDisplayName: String,
        name: String? = null,
    ): FamilyCircle {
        val response =
            httpClient.post("$baseUrl/api/family/circle") {
                header(HttpHeaders.Authorization, "Bearer $accessToken")
                contentType(ContentType.Application.Json)
                setBody(CreateFamilyCircleRequest(adultDisplayName, name))
            }
        ensureSuccess(response, "Create family circle failed")
        return response.body()
    }

    /**
     * @return the circle, or null when the adult has no circle yet (HTTP 404).
     */
    suspend fun getCircle(accessToken: String): FamilyCircle? {
        val response =
            httpClient.get("$baseUrl/api/family/circle") {
                header(HttpHeaders.Authorization, "Bearer $accessToken")
            }
        if (response.status == HttpStatusCode.NotFound) {
            return null
        }
        ensureSuccess(response, "Get family circle failed")
        return response.body()
    }

    suspend fun updateCircleName(
        accessToken: String,
        name: String?,
    ): FamilyCircle {
        val response =
            httpClient.patch("$baseUrl/api/family/circle") {
                header(HttpHeaders.Authorization, "Bearer $accessToken")
                contentType(ContentType.Application.Json)
                setBody(UpdateFamilyCircleRequest(name))
            }
        ensureSuccess(response, "Update family circle failed")
        return response.body()
    }

    suspend fun addKid(
        accessToken: String,
        displayName: String,
    ): Kid {
        val response =
            httpClient.post("$baseUrl/api/family/circle/kids") {
                header(HttpHeaders.Authorization, "Bearer $accessToken")
                contentType(ContentType.Application.Json)
                setBody(CreateKidRequest(displayName))
            }
        ensureSuccess(response, "Add kid failed")
        return response.body()
    }

    suspend fun updateKid(
        accessToken: String,
        kidId: String,
        displayName: String,
    ): Kid {
        val response =
            httpClient.patch("$baseUrl/api/family/circle/kids/$kidId") {
                header(HttpHeaders.Authorization, "Bearer $accessToken")
                contentType(ContentType.Application.Json)
                setBody(UpdateKidRequest(displayName))
            }
        ensureSuccess(response, "Update kid failed")
        return response.body()
    }

    suspend fun deleteKid(
        accessToken: String,
        kidId: String,
    ) {
        val response =
            httpClient.delete("$baseUrl/api/family/circle/kids/$kidId") {
                header(HttpHeaders.Authorization, "Bearer $accessToken")
            }
        if (response.status != HttpStatusCode.NoContent &&
            response.status.value !in 200..299
        ) {
            throw AuthApiException(awaitMessage(response, "Delete kid failed"))
        }
    }

    companion object {
        fun create(baseUrl: String = apiBaseUrl()): FamilyClient = FamilyClient(baseUrl)
    }
}
