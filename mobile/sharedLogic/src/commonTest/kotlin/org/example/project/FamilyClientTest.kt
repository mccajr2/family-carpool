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
import kotlin.test.assertTrue
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
                                    """{"id":"c1","name":"Our house","role":"ORGANIZER","members":[{"adultId":"1","email":"a@example.com","displayName":"Alex","role":"ORGANIZER"}],"kids":[]}""",
                                status = HttpStatusCode.Created,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        }
                        request.url.encodedPath == "/api/family/circle" &&
                            request.method == HttpMethod.Get ->
                            respond(
                                content =
                                    """{"id":"c1","name":null,"role":"ORGANIZER","members":[{"adultId":"1","email":"a@example.com","displayName":"Alex","role":"ORGANIZER"}],"kids":[{"id":"k1","displayName":"Sam"}]}""",
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
            assertEquals(1, created.members.size)

            assertEquals("Sam", client.addKid("tok", "Sam").displayName)
            assertEquals("Samantha", client.updateKid("tok", "k1", "Samantha").displayName)
            client.deleteKid("tok", "k1")

            val loaded = client.getCircle("tok")
            assertEquals("Your family", loaded?.displayTitle())
            assertEquals("Sam", loaded?.kids?.first()?.displayName)
        }

    @Test
    fun placesCrudAndLocate() =
        runTest {
            val mockEngine =
                MockEngine { request ->
                    when {
                        request.url.encodedPath == "/api/family/circle/places" &&
                            request.method == HttpMethod.Post ->
                            respond(
                                content =
                                    """{"id":"p1","name":"Mom's house","address":"123 Main St","latitude":40.1,"longitude":-74.2}""",
                                status = HttpStatusCode.Created,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/places/p1" &&
                            request.method == HttpMethod.Patch ->
                            respond(
                                content =
                                    """{"id":"p1","name":"Mom's house","address":"456 Oak Ave","latitude":40.2,"longitude":-74.3}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/places/p1" &&
                            request.method == HttpMethod.Delete ->
                            respond(content = "", status = HttpStatusCode.NoContent)
                        request.url.encodedPath == "/api/family/circle/places/p2/locate" &&
                            request.method == HttpMethod.Post ->
                            respond(
                                content =
                                    """{"id":"p2","name":"School","address":"1 Rd","latitude":null,"longitude":null}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        else -> error("Unexpected ${request.method} ${request.url.encodedPath}")
                    }
                }

            val client = FamilyClient("http://localhost:8080", mockHttpClient(mockEngine))
            val created = client.addPlace("tok", "Mom's house", "123 Main St")
            assertEquals("Mom's house", created.name)
            assertEquals("123 Main St", created.address)
            assertEquals(40.1, created.latitude)
            assertTrue(created.isLocated())
            assertEquals(
                "456 Oak Ave",
                client.updatePlace("tok", "p1", "Mom's house", "456 Oak Ave").address,
            )
            client.deletePlace("tok", "p1")
            val located = client.locatePlace("tok", "p2")
            assertEquals(null, located.latitude)
            assertTrue(!located.isLocated())
        }

    @Test
    fun inviteJoinLeaveAndMemberRole() =
        runTest {
            val mockEngine =
                MockEngine { request ->
                    when {
                        request.url.encodedPath == "/api/family/circle/invite" &&
                            request.method == HttpMethod.Get ->
                            respond(
                                content = """{"code":"AB12CD34"}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/invite/regenerate" &&
                            request.method == HttpMethod.Post ->
                            respond(
                                content = """{"code":"XY98ZW76"}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/join" &&
                            request.method == HttpMethod.Post ->
                            respond(
                                content =
                                    """{"id":"c1","name":"House","role":"CAREGIVER","members":[{"adultId":"1","email":"a@example.com","displayName":"Alex","role":"ORGANIZER"},{"adultId":"2","email":"b@example.com","displayName":"Jordan","role":"CAREGIVER"}],"kids":[]}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/members/2" &&
                            request.method == HttpMethod.Patch ->
                            respond(
                                content =
                                    """{"id":"c1","name":"House","role":"ORGANIZER","members":[{"adultId":"1","email":"a@example.com","displayName":"Alex","role":"ORGANIZER"},{"adultId":"2","email":"b@example.com","displayName":"Jordan","role":"ORGANIZER"}],"kids":[]}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/members/2" &&
                            request.method == HttpMethod.Delete ->
                            respond(content = "", status = HttpStatusCode.NoContent)
                        request.url.encodedPath == "/api/family/circle/leave" &&
                            request.method == HttpMethod.Post ->
                            respond(content = "", status = HttpStatusCode.NoContent)
                        else -> error("Unexpected ${request.method} ${request.url.encodedPath}")
                    }
                }

            val client = FamilyClient("http://localhost:8080", mockHttpClient(mockEngine))
            assertEquals("AB12CD34", client.getInvite("tok").code)
            assertEquals("XY98ZW76", client.regenerateInvite("tok").code)

            val joined = client.joinCircle("tok", "AB12CD34", "Jordan")
            assertEquals(FamilyRole.CAREGIVER, joined.role)
            assertEquals(2, joined.members.size)

            val promoted = client.updateMemberRole("tok", "2", FamilyRole.ORGANIZER)
            assertEquals(FamilyRole.ORGANIZER, promoted.members.first { it.adultId == "2" }.role)

            client.removeMember("tok", "2")
            client.leaveCircle("tok")
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
            FamilyCircle(id = "c1", name = null, role = FamilyRole.ORGANIZER)
        assertEquals("Your family", unnamed.displayTitle())

        val blank =
            FamilyCircle(id = "c1", name = "  ", role = FamilyRole.ORGANIZER)
        assertEquals("Your family", blank.displayTitle())

        val named =
            FamilyCircle(
                id = "c1",
                name = "McCarthy house",
                role = FamilyRole.ORGANIZER,
            )
        assertEquals("McCarthy house", named.displayTitle())
    }

    @Test
    fun memberDisplayLabelFallsBackToEmail() {
        val named =
            FamilyMember(
                adultId = "1",
                email = "a@example.com",
                displayName = "Alex",
                role = FamilyRole.ORGANIZER,
            )
        assertEquals("Alex", named.displayLabel())

        val unnamed =
            FamilyMember(
                adultId = "2",
                email = "b@example.com",
                displayName = null,
                role = FamilyRole.CAREGIVER,
            )
        assertEquals("b@example.com", unnamed.displayLabel())
    }
}

private fun mockHttpClient(engine: MockEngine): HttpClient =
    HttpClient(engine) {
        install(ContentNegotiation) {
            json(Json { ignoreUnknownKeys = true })
        }
    }
