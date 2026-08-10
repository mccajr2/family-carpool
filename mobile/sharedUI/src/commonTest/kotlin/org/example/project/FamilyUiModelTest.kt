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
import kotlin.test.assertNull
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
                                    """{"id":"c1","name":null,"role":"ORGANIZER","members":[{"adultId":"1","email":"parent@example.com","displayName":"Alex","role":"ORGANIZER"}],"kids":[]}""",
                                status = HttpStatusCode.Created,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/invite" &&
                            request.method == HttpMethod.Get ->
                            respond(
                                content = """{"code":"AB12CD34"}""",
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
                            request.method == HttpMethod.Delete ->
                            respond(content = "", status = HttpStatusCode.NoContent)
                        else -> error("Unexpected ${request.method} ${request.url.encodedPath}")
                    }
                }
            val model = familyUiModel(mockEngine, token = "tok")

            model.load()
            val needs = assertIs<FamilyUiModel.State.NeedsMembership>(model.state)
            assertEquals("parent@example.com", needs.email)
            assertEquals(FamilyUiModel.EmptyMode.CHOOSE, needs.mode)

            model.showCreate()
            model.updateAdultDisplayName("Alex")
            model.createCircle()
            val ready = assertIs<FamilyUiModel.State.Ready>(model.state)
            assertEquals("Your family", ready.circle.displayTitle())
            assertEquals("Alex", ready.adultDisplayName)
            assertEquals("AB12CD34", ready.inviteCode)

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
    fun caregiverCanAddAndRemovePlace() =
        runTest {
            val mockEngine =
                MockEngine { request ->
                    when {
                        request.url.encodedPath == "/api/auth/me" ->
                            respond(
                                content =
                                    """{"id":"2","email":"other@example.com","displayName":"Jordan"}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle" &&
                            request.method == HttpMethod.Get ->
                            respond(
                                content =
                                    """{"id":"c1","name":"House","role":"CAREGIVER","members":[{"adultId":"2","email":"other@example.com","displayName":"Jordan","role":"CAREGIVER"}],"kids":[],"places":[]}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/places" &&
                            request.method == HttpMethod.Post ->
                            respond(
                                content =
                                    """{"id":"p1","name":"Mom's house","address":"123 Main St"}""",
                                status = HttpStatusCode.Created,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/places/p1" &&
                            request.method == HttpMethod.Delete ->
                            respond(content = "", status = HttpStatusCode.NoContent)
                        else -> error("Unexpected ${request.method} ${request.url.encodedPath}")
                    }
                }
            val model = familyUiModel(mockEngine, token = "tok")
            model.load()
            assertIs<FamilyUiModel.State.Ready>(model.state)
            model.updateNewPlaceName("Mom's house")
            model.updateNewPlaceAddress("123 Main St")
            model.addPlace()
            val withPlace = assertIs<FamilyUiModel.State.Ready>(model.state)
            assertEquals(1, withPlace.circle.places.size)
            assertEquals("Mom's house", withPlace.circle.places.first().name)

            model.removePlace("p1")
            val withoutPlace = assertIs<FamilyUiModel.State.Ready>(model.state)
            assertTrue(withoutPlace.circle.places.isEmpty())
        }

    @Test
    fun joinCircleAsCaregiver() =
        runTest {
            val mockEngine =
                MockEngine { request ->
                    when {
                        request.url.encodedPath == "/api/auth/me" ->
                            respond(
                                content =
                                    """{"id":"2","email":"other@example.com","displayName":null}""",
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
                        request.url.encodedPath == "/api/family/circle/join" &&
                            request.method == HttpMethod.Post ->
                            respond(
                                content =
                                    """{"id":"c1","name":"House","role":"CAREGIVER","members":[{"adultId":"1","email":"a@example.com","displayName":"Alex","role":"ORGANIZER"},{"adultId":"2","email":"other@example.com","displayName":"Jordan","role":"CAREGIVER"}],"kids":[]}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        else -> error("Unexpected ${request.method} ${request.url.encodedPath}")
                    }
                }
            val model = familyUiModel(mockEngine, token = "tok")
            model.load()
            model.showJoin()
            model.updateInviteCodeInput("AB12CD34")
            model.updateAdultDisplayName("Jordan")
            model.joinCircle()

            val ready = assertIs<FamilyUiModel.State.Ready>(model.state)
            assertEquals(FamilyRole.CAREGIVER, ready.circle.role)
            assertEquals("House", ready.circle.displayTitle())
            assertNull(ready.inviteCode)
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
                                    """{"id":"c1","name":"McCarthy house","role":"ORGANIZER","members":[{"adultId":"1","email":"parent@example.com","displayName":"Alex","role":"ORGANIZER"}],"kids":[]}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        "/api/family/circle/invite" ->
                            respond(
                                content = """{"code":"ZZ99YY88"}""",
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
            assertEquals("ZZ99YY88", ready.inviteCode)
        }
    @Test
    fun leaveReturnsToChooseMembership() =
        runTest {
            val mockEngine =
                MockEngine { request ->
                    when {
                        request.url.encodedPath == "/api/auth/me" ->
                            respond(
                                content =
                                    """{"id":"2","email":"other@example.com","displayName":"Jordan"}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle" &&
                            request.method == HttpMethod.Get ->
                            respond(
                                content =
                                    """{"id":"c1","name":"House","role":"CAREGIVER","members":[{"adultId":"2","email":"other@example.com","displayName":"Jordan","role":"CAREGIVER"}],"kids":[]}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/leave" &&
                            request.method == HttpMethod.Post ->
                            respond(content = "", status = HttpStatusCode.NoContent)
                        else -> error("Unexpected ${request.method} ${request.url.encodedPath}")
                    }
                }
            val model = familyUiModel(mockEngine, token = "tok")
            model.load()
            assertIs<FamilyUiModel.State.Ready>(model.state)
            model.leaveCircle()
            val needs = assertIs<FamilyUiModel.State.NeedsMembership>(model.state)
            assertEquals(FamilyUiModel.EmptyMode.CHOOSE, needs.mode)
            assertEquals("other@example.com", needs.email)
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
