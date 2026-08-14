package org.example.project

import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType

class CarpoolClient(
    private val baseUrl: String,
    private val httpClient: HttpClient = createHttpClient(),
) {
    suspend fun getSummary(accessToken: String): CarpoolSummary {
        val response =
            httpClient.get("$baseUrl/api/carpool") {
                header(HttpHeaders.Authorization, "Bearer $accessToken")
            }
        ensureSuccess(response, "Get carpool summary failed")
        return response.body()
    }

    suspend fun enable(
        accessToken: String,
        feedId: String,
    ): CarpoolSpace {
        val response =
            httpClient.post("$baseUrl/api/carpool/enable") {
                header(HttpHeaders.Authorization, "Bearer $accessToken")
                contentType(ContentType.Application.Json)
                setBody(EnableCarpoolSpaceRequest(feedId))
            }
        ensureSuccess(response, "Enable carpool failed")
        return response.body()
    }

    suspend fun join(
        accessToken: String,
        code: String,
    ): CarpoolSpace {
        val response =
            httpClient.post("$baseUrl/api/carpool/join") {
                header(HttpHeaders.Authorization, "Bearer $accessToken")
                contentType(ContentType.Application.Json)
                setBody(JoinCarpoolSpaceRequest(code))
            }
        ensureSuccess(response, "Join carpool failed")
        return response.body()
    }

    suspend fun getSpace(
        accessToken: String,
        spaceId: String,
    ): CarpoolSpace {
        val response =
            httpClient.get("$baseUrl/api/carpool/spaces/$spaceId") {
                header(HttpHeaders.Authorization, "Bearer $accessToken")
            }
        ensureSuccess(response, "Get carpool space failed")
        return response.body()
    }

    suspend fun regenerateInvite(
        accessToken: String,
        spaceId: String,
    ): CarpoolInvite {
        val response =
            httpClient.post("$baseUrl/api/carpool/spaces/$spaceId/invite/regenerate") {
                header(HttpHeaders.Authorization, "Bearer $accessToken")
            }
        ensureSuccess(response, "Regenerate carpool invite failed")
        return response.body()
    }

    suspend fun leave(
        accessToken: String,
        spaceId: String,
    ) {
        val response =
            httpClient.post("$baseUrl/api/carpool/spaces/$spaceId/leave") {
                header(HttpHeaders.Authorization, "Bearer $accessToken")
            }
        if (response.status != HttpStatusCode.NoContent &&
            response.status.value !in 200..299
        ) {
            throw AuthApiException(awaitMessage(response, "Leave carpool failed"))
        }
    }

    suspend fun createRequest(
        accessToken: String,
        spaceId: String,
    ): CarpoolJoinRequest {
        val response =
            httpClient.post("$baseUrl/api/carpool/spaces/$spaceId/requests") {
                header(HttpHeaders.Authorization, "Bearer $accessToken")
            }
        ensureSuccess(response, "Request to join carpool failed")
        return response.body()
    }

    suspend fun admit(
        accessToken: String,
        spaceId: String,
        requestId: String,
    ): CarpoolSpace {
        val response =
            httpClient.post("$baseUrl/api/carpool/spaces/$spaceId/requests/$requestId/admit") {
                header(HttpHeaders.Authorization, "Bearer $accessToken")
            }
        ensureSuccess(response, "Admit carpool request failed")
        return response.body()
    }

    suspend fun decline(
        accessToken: String,
        spaceId: String,
        requestId: String,
    ) {
        val response =
            httpClient.post("$baseUrl/api/carpool/spaces/$spaceId/requests/$requestId/decline") {
                header(HttpHeaders.Authorization, "Bearer $accessToken")
            }
        if (response.status != HttpStatusCode.NoContent &&
            response.status.value !in 200..299
        ) {
            throw AuthApiException(awaitMessage(response, "Decline carpool request failed"))
        }
    }

    companion object {
        fun create(baseUrl: String = apiBaseUrl()): CarpoolClient = CarpoolClient(baseUrl)
    }
}
