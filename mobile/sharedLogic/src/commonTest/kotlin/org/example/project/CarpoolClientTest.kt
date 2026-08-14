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

class CarpoolClientTest {

    @Test
    fun getSummarySendsBearerAndDecodesFeedStatus() =
        runTest {
            val mockEngine =
                MockEngine { request ->
                    assertEquals("/api/carpool", request.url.encodedPath)
                    assertEquals(HttpMethod.Get, request.method)
                    assertEquals("Bearer tok", request.headers[HttpHeaders.Authorization])
                    respond(
                        content =
                            """{"circleRole":"ORGANIZER","feeds":[{"feedId":"f1","feedName":"Soccer","status":"NONE","spaceId":null,"spaceName":null}],"spaces":[]}""",
                        status = HttpStatusCode.OK,
                        headers = headersOf(HttpHeaders.ContentType, "application/json"),
                    )
                }

            val client = CarpoolClient("http://localhost:8080", mockHttpClient(mockEngine))
            val summary = client.getSummary("tok")

            assertEquals(FamilyRole.ORGANIZER, summary.circleRole)
            assertEquals(CarpoolFeedStatusKind.NONE, summary.feeds.single().status)
            assertNull(summary.feeds.single().spaceId)
            assertTrue(summary.spaces.isEmpty())
        }

    @Test
    fun enableJoinRequestAdmitDeclineRegenerateAndLeave() =
        runTest {
            val spaceJson =
                """{"id":"s1","name":"Soccer","membership":"OWNER","inviteCode":"AB12CD34","callerFeedId":"f1","members":[{"circleId":"c1","circleName":"House A","membership":"OWNER"}],"pendingRequests":[]}"""
            val mockEngine =
                MockEngine { request ->
                    when {
                        request.url.encodedPath == "/api/carpool/enable" &&
                            request.method == HttpMethod.Post -> {
                            assertEquals("Bearer tok", request.headers[HttpHeaders.Authorization])
                            respond(
                                content = spaceJson,
                                status = HttpStatusCode.Created,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        }
                        request.url.encodedPath == "/api/carpool/join" &&
                            request.method == HttpMethod.Post ->
                            respond(
                                content =
                                    """{"id":"s1","name":"Soccer","membership":"MEMBER","inviteCode":"AB12CD34","callerFeedId":"f1","members":[{"circleId":"c1","circleName":"House A","membership":"OWNER"},{"circleId":"c2","circleName":"House B","membership":"MEMBER"}],"pendingRequests":[]}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/carpool/spaces/s1" &&
                            request.method == HttpMethod.Get ->
                            respond(
                                content = spaceJson,
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/carpool/spaces/s1/requests" &&
                            request.method == HttpMethod.Post ->
                            respond(
                                content =
                                    """{"id":"r1","spaceId":"s1","circleId":"c2","circleName":"House B","requestedByAdultId":"a2","requestedByDisplayName":"Sam"}""",
                                status = HttpStatusCode.Created,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/carpool/spaces/s1/requests/r1/admit" &&
                            request.method == HttpMethod.Post ->
                            respond(
                                content = spaceJson,
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/carpool/spaces/s1/requests/r1/decline" &&
                            request.method == HttpMethod.Post ->
                            respond(content = "", status = HttpStatusCode.NoContent)
                        request.url.encodedPath == "/api/carpool/spaces/s1/invite/regenerate" &&
                            request.method == HttpMethod.Post ->
                            respond(
                                content = """{"code":"XY98ZW76"}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/carpool/spaces/s1/leave" &&
                            request.method == HttpMethod.Post ->
                            respond(content = "", status = HttpStatusCode.NoContent)
                        else -> error("Unexpected ${request.method} ${request.url.encodedPath}")
                    }
                }

            val client = CarpoolClient("http://localhost:8080", mockHttpClient(mockEngine))

            val enabled = client.enable("tok", "f1")
            assertEquals(CarpoolSpaceMembership.OWNER, enabled.membership)
            assertEquals("AB12CD34", enabled.inviteCode)
            assertEquals("House A", enabled.members.single().circleName)

            val joined = client.join("tok", "AB12CD34")
            assertEquals(CarpoolSpaceMembership.MEMBER, joined.membership)

            assertEquals("Soccer", client.getSpace("tok", "s1").name)

            val request = client.createRequest("tok", "s1")
            assertEquals("r1", request.id)
            assertEquals("House B · requested by Sam", request.displayLabel())

            assertEquals("s1", client.admit("tok", "s1", "r1").id)
            client.decline("tok", "s1", "r1")
            assertEquals("XY98ZW76", client.regenerateInvite("tok", "s1").code)
            client.leave("tok", "s1")
        }

    @Test
    fun enableSurfacesOrganizerForbiddenMessage() =
        runTest {
            val mockEngine =
                MockEngine {
                    respond(
                        content = """{"message":"Organizer role required"}""",
                        status = HttpStatusCode.Forbidden,
                        headers = headersOf(HttpHeaders.ContentType, "application/json"),
                    )
                }
            val client = CarpoolClient("http://localhost:8080", mockHttpClient(mockEngine))
            val error =
                assertFailsWith<AuthApiException> {
                    client.enable("tok", "f1")
                }
            assertEquals("Organizer role required", error.message)
        }
}

class CarpoolModelsTest {

    @Test
    fun circleDisplayNameFallsBackToYourFamily() {
        assertEquals("Your family", circleDisplayName(null))
        assertEquals("Your family", circleDisplayName("  "))
        assertEquals("House A", circleDisplayName("House A"))
    }

    @Test
    fun feedStatusLabels() {
        assertEquals("No carpool", CarpoolFeedStatusKind.NONE.statusLabel())
        assertEquals("Carpool available", CarpoolFeedStatusKind.AVAILABLE.statusLabel())
        assertEquals("Requested", CarpoolFeedStatusKind.REQUESTED.statusLabel())
        assertEquals("Member", CarpoolFeedStatusKind.MEMBER.statusLabel())
        assertEquals("Owned", CarpoolFeedStatusKind.OWNER.statusLabel())
    }

    @Test
    fun enableConfirmAsksFamilyToOwnTheSpace() {
        assertTrue(
            enableCarpoolConfirmMessage("Soccer").contains("own the carpool for Soccer"),
        )
    }

    @Test
    fun caregiverEmptyHintDoesNotMentionFeeds() {
        val caregiver =
            CarpoolSummary(circleRole = FamilyRole.CAREGIVER, feeds = emptyList(), spaces = emptyList())
        val organizer =
            CarpoolSummary(circleRole = FamilyRole.ORGANIZER, feeds = emptyList(), spaces = emptyList())
        assertTrue(caregiver.hasNoCarpools())
        assertFalse(caregiver.emptyHint().contains("Feeds"))
        assertTrue(organizer.emptyHint().contains("Feeds"))
    }

    @Test
    fun primaryActionHidesEnableForCaregiver() {
        val none =
            CarpoolFeedStatus(
                feedId = "f1",
                feedName = "Soccer",
                status = CarpoolFeedStatusKind.NONE,
            )
        assertEquals(CarpoolPrimaryAction.ENABLE, none.primaryAction(FamilyRole.ORGANIZER))
        assertEquals(CarpoolPrimaryAction.NONE, none.primaryAction(FamilyRole.CAREGIVER))
        val available =
            none.copy(status = CarpoolFeedStatusKind.AVAILABLE, spaceId = "s1", spaceName = "Soccer")
        assertEquals(CarpoolPrimaryAction.REQUEST, available.primaryAction(FamilyRole.CAREGIVER))
    }
}

private fun mockHttpClient(engine: MockEngine): HttpClient =
    HttpClient(engine) {
        install(ContentNegotiation) {
            json(Json { ignoreUnknownKeys = true })
        }
    }
