package org.example.project

import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.delete
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.patch
import io.ktor.client.request.post
import io.ktor.client.request.put
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

    suspend fun getInvite(accessToken: String): FamilyInvite {
        val response =
            httpClient.get("$baseUrl/api/family/circle/invite") {
                header(HttpHeaders.Authorization, "Bearer $accessToken")
            }
        ensureSuccess(response, "Get invite failed")
        return response.body()
    }

    suspend fun regenerateInvite(accessToken: String): FamilyInvite {
        val response =
            httpClient.post("$baseUrl/api/family/circle/invite/regenerate") {
                header(HttpHeaders.Authorization, "Bearer $accessToken")
            }
        ensureSuccess(response, "Regenerate invite failed")
        return response.body()
    }

    suspend fun joinCircle(
        accessToken: String,
        code: String,
        adultDisplayName: String? = null,
    ): FamilyCircle {
        val response =
            httpClient.post("$baseUrl/api/family/circle/join") {
                header(HttpHeaders.Authorization, "Bearer $accessToken")
                contentType(ContentType.Application.Json)
                setBody(JoinFamilyCircleRequest(code, adultDisplayName))
            }
        ensureSuccess(response, "Join family circle failed")
        return response.body()
    }

    suspend fun leaveCircle(accessToken: String) {
        val response =
            httpClient.post("$baseUrl/api/family/circle/leave") {
                header(HttpHeaders.Authorization, "Bearer $accessToken")
            }
        if (response.status != HttpStatusCode.NoContent &&
            response.status.value !in 200..299
        ) {
            throw AuthApiException(awaitMessage(response, "Leave family circle failed"))
        }
    }

    suspend fun updateMemberRole(
        accessToken: String,
        adultId: String,
        role: FamilyRole,
    ): FamilyCircle {
        val response =
            httpClient.patch("$baseUrl/api/family/circle/members/$adultId") {
                header(HttpHeaders.Authorization, "Bearer $accessToken")
                contentType(ContentType.Application.Json)
                setBody(UpdateFamilyMemberRoleRequest(role))
            }
        ensureSuccess(response, "Update member role failed")
        return response.body()
    }

    suspend fun removeMember(
        accessToken: String,
        adultId: String,
    ) {
        val response =
            httpClient.delete("$baseUrl/api/family/circle/members/$adultId") {
                header(HttpHeaders.Authorization, "Bearer $accessToken")
            }
        if (response.status != HttpStatusCode.NoContent &&
            response.status.value !in 200..299
        ) {
            throw AuthApiException(awaitMessage(response, "Remove member failed"))
        }
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

    suspend fun addPlace(
        accessToken: String,
        name: String,
        address: String,
    ): Place {
        val response =
            httpClient.post("$baseUrl/api/family/circle/places") {
                header(HttpHeaders.Authorization, "Bearer $accessToken")
                contentType(ContentType.Application.Json)
                setBody(CreatePlaceRequest(name, address))
            }
        ensureSuccess(response, "Add place failed")
        return response.body()
    }

    suspend fun updatePlace(
        accessToken: String,
        placeId: String,
        name: String,
        address: String,
    ): Place {
        val response =
            httpClient.patch("$baseUrl/api/family/circle/places/$placeId") {
                header(HttpHeaders.Authorization, "Bearer $accessToken")
                contentType(ContentType.Application.Json)
                setBody(UpdatePlaceRequest(name, address))
            }
        ensureSuccess(response, "Update place failed")
        return response.body()
    }

    suspend fun deletePlace(
        accessToken: String,
        placeId: String,
    ) {
        val response =
            httpClient.delete("$baseUrl/api/family/circle/places/$placeId") {
                header(HttpHeaders.Authorization, "Bearer $accessToken")
            }
        if (response.status != HttpStatusCode.NoContent &&
            response.status.value !in 200..299
        ) {
            throw AuthApiException(awaitMessage(response, "Delete place failed"))
        }
    }

    suspend fun locatePlace(
        accessToken: String,
        placeId: String,
    ): Place {
        val response =
            httpClient.post("$baseUrl/api/family/circle/places/$placeId/locate") {
                header(HttpHeaders.Authorization, "Bearer $accessToken")
            }
        ensureSuccess(response, "Locate place failed")
        return response.body()
    }

    suspend fun listFeeds(accessToken: String): List<ActivityFeed> {
        val response =
            httpClient.get("$baseUrl/api/family/circle/feeds") {
                header(HttpHeaders.Authorization, "Bearer $accessToken")
            }
        ensureSuccess(response, "List feeds failed")
        return response.body()
    }

    suspend fun createFeed(
        accessToken: String,
        name: String,
        sourceUrl: String,
        kidIds: List<String> = emptyList(),
    ): ActivityFeed {
        val response =
            httpClient.post("$baseUrl/api/family/circle/feeds") {
                header(HttpHeaders.Authorization, "Bearer $accessToken")
                contentType(ContentType.Application.Json)
                setBody(CreateActivityFeedRequest(name, sourceUrl, kidIds))
            }
        ensureSuccess(response, "Create feed failed")
        return response.body()
    }

    suspend fun updateFeed(
        accessToken: String,
        feedId: String,
        name: String,
        sourceUrl: String,
        kidIds: List<String> = emptyList(),
    ): ActivityFeed {
        val response =
            httpClient.put("$baseUrl/api/family/circle/feeds/$feedId") {
                header(HttpHeaders.Authorization, "Bearer $accessToken")
                contentType(ContentType.Application.Json)
                setBody(UpdateActivityFeedRequest(name, sourceUrl, kidIds))
            }
        ensureSuccess(response, "Update feed failed")
        return response.body()
    }

    suspend fun deleteFeed(
        accessToken: String,
        feedId: String,
    ) {
        val response =
            httpClient.delete("$baseUrl/api/family/circle/feeds/$feedId") {
                header(HttpHeaders.Authorization, "Bearer $accessToken")
            }
        if (response.status != HttpStatusCode.NoContent &&
            response.status.value !in 200..299
        ) {
            throw AuthApiException(awaitMessage(response, "Delete feed failed"))
        }
    }

    suspend fun syncFeed(
        accessToken: String,
        feedId: String,
    ): ActivityFeed {
        val response =
            httpClient.post("$baseUrl/api/family/circle/feeds/$feedId/sync") {
                header(HttpHeaders.Authorization, "Bearer $accessToken")
            }
        ensureSuccess(response, "Sync feed failed")
        return response.body()
    }

    suspend fun listEvents(accessToken: String): List<ManualEvent> {
        val response =
            httpClient.get("$baseUrl/api/family/circle/events") {
                header(HttpHeaders.Authorization, "Bearer $accessToken")
            }
        ensureSuccess(response, "List events failed")
        return response.body()
    }

    suspend fun getEvent(
        accessToken: String,
        eventId: String,
    ): ManualEvent {
        val response =
            httpClient.get("$baseUrl/api/family/circle/events/$eventId") {
                header(HttpHeaders.Authorization, "Bearer $accessToken")
            }
        ensureSuccess(response, "Get event failed")
        return response.body()
    }

    suspend fun createEvent(
        accessToken: String,
        title: String,
        startsAt: String,
        kidIds: List<String>,
        endsAt: String? = null,
        location: String? = null,
    ): ManualEvent {
        val response =
            httpClient.post("$baseUrl/api/family/circle/events") {
                header(HttpHeaders.Authorization, "Bearer $accessToken")
                contentType(ContentType.Application.Json)
                setBody(CreateManualEventRequest(title, startsAt, endsAt, location, kidIds))
            }
        ensureSuccess(response, "Create event failed")
        return response.body()
    }

    suspend fun updateEvent(
        accessToken: String,
        eventId: String,
        title: String,
        startsAt: String,
        kidIds: List<String>,
        endsAt: String? = null,
        location: String? = null,
    ): ManualEvent {
        val response =
            httpClient.put("$baseUrl/api/family/circle/events/$eventId") {
                header(HttpHeaders.Authorization, "Bearer $accessToken")
                contentType(ContentType.Application.Json)
                setBody(UpdateManualEventRequest(title, startsAt, endsAt, location, kidIds))
            }
        ensureSuccess(response, "Update event failed")
        return response.body()
    }

    suspend fun deleteEvent(
        accessToken: String,
        eventId: String,
    ) {
        val response =
            httpClient.delete("$baseUrl/api/family/circle/events/$eventId") {
                header(HttpHeaders.Authorization, "Bearer $accessToken")
            }
        if (response.status != HttpStatusCode.NoContent &&
            response.status.value !in 200..299
        ) {
            throw AuthApiException(awaitMessage(response, "Delete event failed"))
        }
    }

    companion object {
        fun create(baseUrl: String = apiBaseUrl()): FamilyClient = FamilyClient(baseUrl)
    }
}
