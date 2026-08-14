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
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json

class FamilyUiModelTest {

    @Test
    fun unreachableLoadFailsRetryablyInsteadOfOfferingCreate() =
        runTest {
            var reachable = false
            val mockEngine =
                MockEngine { request ->
                    if (!reachable) {
                        throw RuntimeException("Failed to connect to /127.0.0.1:8080")
                    }
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
                                content =
                                    """{"id":"c1","name":"House","role":"ORGANIZER","members":[{"adultId":"1","email":"parent@example.com","displayName":"Alex","role":"ORGANIZER"}],"kids":[],"places":[]}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/invite" ->
                            respond(
                                content = """{"code":"AB12CD34"}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/feeds" ->
                            respond(
                                content = "[]",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/calendar" ->
                            respond(
                                content = "[]",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        else -> error("Unexpected ${request.method} ${request.url.encodedPath}")
                    }
                }
            val model = familyUiModel(mockEngine, token = "tok")

            model.load()

            // Never NeedsMembership: a failed load says nothing about whether a circle exists,
            // and offering Create family there invites a duplicate circle.
            val failed = assertIs<FamilyUiModel.State.LoadFailed>(model.state)
            assertTrue(failed.message.contains("Cannot reach"))

            reachable = true
            model.load()

            val ready = assertIs<FamilyUiModel.State.Ready>(model.state)
            assertEquals("House", ready.circle.displayTitle())
        }

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
                        request.url.encodedPath == "/api/family/circle/calendar" &&
                            request.method == HttpMethod.Get ->
                            respond(
                                content = "[]",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
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
                                    """{"id":"p1","name":"Mom's house","address":"123 Main St","latitude":40.1,"longitude":-74.2}""",
                                status = HttpStatusCode.Created,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/places/p1" &&
                            request.method == HttpMethod.Delete ->
                            respond(content = "", status = HttpStatusCode.NoContent)
                        request.url.encodedPath == "/api/family/circle/calendar" &&
                            request.method == HttpMethod.Get ->
                            respond(
                                content = "[]",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
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
            assertTrue(withPlace.circle.places.first().isLocated())

            model.removePlace("p1")
            val withoutPlace = assertIs<FamilyUiModel.State.Ready>(model.state)
            assertTrue(withoutPlace.circle.places.isEmpty())
        }

    @Test
    fun caregiverCanAddAndRemoveManualEvent() =
        runTest {
            var calendarJson = "[]"
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
                                    """{"id":"c1","name":"House","role":"CAREGIVER","members":[{"adultId":"2","email":"other@example.com","displayName":"Jordan","role":"CAREGIVER"}],"kids":[{"id":"k1","displayName":"Sam"}],"places":[]}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/calendar" &&
                            request.method == HttpMethod.Get ->
                            respond(
                                content = calendarJson,
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/events" &&
                            request.method == HttpMethod.Post -> {
                            calendarJson =
                                """[{"id":"e1","source":"MANUAL","title":"Dentist","startsAt":"2026-08-15T17:00:00Z","endsAt":"2026-08-15T18:00:00Z","location":"Clinic","kidIds":["k1"]}]"""
                            respond(
                                content =
                                    """{"id":"e1","title":"Dentist","startsAt":"2026-08-15T17:00:00Z","endsAt":"2026-08-15T18:00:00Z","location":"Clinic","kidIds":["k1"]}""",
                                status = HttpStatusCode.Created,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        }
                        request.url.encodedPath == "/api/family/circle/events/e1" &&
                            request.method == HttpMethod.Delete -> {
                            calendarJson = "[]"
                            respond(content = "", status = HttpStatusCode.NoContent)
                        }
                        else -> error("Unexpected ${request.method} ${request.url.encodedPath}")
                    }
                }
            val model = familyUiModel(mockEngine, token = "tok")
            model.load()
            val beforeCompose = assertIs<FamilyUiModel.State.Ready>(model.state)
            assertEquals(false, beforeCompose.eventComposeOpen)
            model.openCreateEventCompose()
            assertEquals(true, assertIs<FamilyUiModel.State.Ready>(model.state).eventComposeOpen)
            model.updateNewEventTitle("Dentist")
            model.updateNewEventStartsAt("2030-08-15T17:00:00Z")
            model.updateNewEventEndsAt("2030-08-15T18:00:00Z")
            model.updateNewEventLocation("Clinic")
            model.toggleNewEventKid("k1")
            model.addEvent()
            val withEvent = assertIs<FamilyUiModel.State.Ready>(model.state)
            assertEquals(1, withEvent.calendarItems.size)
            assertEquals("Dentist", withEvent.calendarItems.first().title)
            assertEquals(CalendarItemSource.MANUAL, withEvent.calendarItems.first().source)
            assertEquals(false, withEvent.eventComposeOpen)

            model.removeEvent("e1")
            val withoutEvent = assertIs<FamilyUiModel.State.Ready>(model.state)
            assertTrue(withoutEvent.calendarItems.isEmpty())
        }

    @Test
    fun caregiverCanEditManualEventViaCompose() =
        runTest {
            var calendarJson =
                """[{"id":"e1","source":"MANUAL","title":"Dentist","startsAt":"2030-08-15T17:00:00Z","endsAt":"2030-08-15T18:00:00Z","location":"Clinic","kidIds":["k1"]}]"""
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
                                    """{"id":"c1","name":"House","role":"CAREGIVER","members":[{"adultId":"2","email":"other@example.com","displayName":"Jordan","role":"CAREGIVER"}],"kids":[{"id":"k1","displayName":"Sam"}],"places":[]}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/calendar" &&
                            request.method == HttpMethod.Get ->
                            respond(
                                content = calendarJson,
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/events/e1" &&
                            request.method == HttpMethod.Put -> {
                            calendarJson =
                                """[{"id":"e1","source":"MANUAL","title":"Orthodontist","startsAt":"2030-08-15T17:00:00Z","endsAt":"2030-08-15T18:00:00Z","location":"Ortho","kidIds":["k1"]}]"""
                            respond(
                                content =
                                    """{"id":"e1","title":"Orthodontist","startsAt":"2030-08-15T17:00:00Z","endsAt":"2030-08-15T18:00:00Z","location":"Ortho","kidIds":["k1"]}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        }
                        else -> error("Unexpected ${request.method} ${request.url.encodedPath}")
                    }
                }
            val model = familyUiModel(mockEngine, token = "tok")
            model.load()
            val ready = assertIs<FamilyUiModel.State.Ready>(model.state)
            val manual = ready.calendarItems.first()
            model.beginEditEvent(manual)
            val composing = assertIs<FamilyUiModel.State.Ready>(model.state)
            assertEquals(true, composing.eventComposeOpen)
            assertEquals("e1", composing.editingEventId)
            assertEquals("Dentist", composing.editingEventTitle)
            model.updateEditingEventTitle("Orthodontist")
            model.updateEditingEventLocation("Ortho")
            model.saveEvent()
            val updated = assertIs<FamilyUiModel.State.Ready>(model.state)
            assertEquals(false, updated.eventComposeOpen)
            assertNull(updated.editingEventId)
            assertEquals("Orthodontist", updated.calendarItems.first().title)
            assertEquals("Ortho", updated.calendarItems.first().location)
        }

    @Test
    fun leavingCalendarClosesEventCompose() =
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
                                    """{"id":"c1","name":"House","role":"CAREGIVER","members":[{"adultId":"2","email":"other@example.com","displayName":"Jordan","role":"CAREGIVER"}],"kids":[{"id":"k1","displayName":"Sam"}],"places":[]}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/calendar" &&
                            request.method == HttpMethod.Get ->
                            respond(
                                content = "[]",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        else -> error("Unexpected ${request.method} ${request.url.encodedPath}")
                    }
                }
            val model = familyUiModel(mockEngine, token = "tok")
            model.load()
            model.openCreateEventCompose()
            model.updateNewEventTitle("Draft")
            assertEquals(true, assertIs<FamilyUiModel.State.Ready>(model.state).eventComposeOpen)
            model.selectShellTab(FamilyUiModel.ShellTab.FAMILY)
            val after = assertIs<FamilyUiModel.State.Ready>(model.state)
            assertEquals(FamilyUiModel.ShellTab.FAMILY, after.shellTab)
            assertEquals(false, after.eventComposeOpen)
            assertEquals("", after.newEventTitle)
        }

    @Test
    fun cancelEventComposeDiscardsDraftWithoutApiCall() =
        runTest {
            var putCalled = false
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
                                    """{"id":"c1","name":"House","role":"CAREGIVER","members":[{"adultId":"2","email":"other@example.com","displayName":"Jordan","role":"CAREGIVER"}],"kids":[{"id":"k1","displayName":"Sam"}],"places":[]}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/calendar" &&
                            request.method == HttpMethod.Get ->
                            respond(
                                content =
                                    """[{"id":"e1","source":"MANUAL","title":"Dentist","startsAt":"2030-08-15T17:00:00Z","endsAt":"2030-08-15T18:00:00Z","location":"Clinic","kidIds":["k1"]}]""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/events/e1" &&
                            request.method == HttpMethod.Put -> {
                            putCalled = true
                            respond(
                                content =
                                    """{"id":"e1","title":"Orthodontist","startsAt":"2030-08-15T17:00:00Z","endsAt":"2030-08-15T18:00:00Z","location":"Clinic","kidIds":["k1"]}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        }
                        else -> error("Unexpected ${request.method} ${request.url.encodedPath}")
                    }
                }
            val model = familyUiModel(mockEngine, token = "tok")
            model.load()
            val ready = assertIs<FamilyUiModel.State.Ready>(model.state)
            model.beginEditEvent(ready.calendarItems.first())
            model.updateEditingEventTitle("Should discard")
            model.closeEventCompose()
            val after = assertIs<FamilyUiModel.State.Ready>(model.state)
            assertEquals(false, after.eventComposeOpen)
            assertNull(after.editingEventId)
            assertEquals("", after.editingEventTitle)
            assertEquals("Dentist", after.calendarItems.first().title)
            assertFalse(putCalled)
        }

    @Test
    fun agendaFiltersByKidAndKeepsFeedRowsReadOnly() =
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
                                    """{"id":"c1","name":"House","role":"CAREGIVER","members":[{"adultId":"2","email":"other@example.com","displayName":"Jordan","role":"CAREGIVER"}],"kids":[{"id":"k1","displayName":"Sam"},{"id":"k2","displayName":"Riley"}],"places":[]}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/calendar" &&
                            request.method == HttpMethod.Get ->
                            respond(
                                content =
                                    """[{"id":"e1","source":"MANUAL","title":"Dentist","startsAt":"2030-08-15T17:00:00Z","kidIds":["k1"]},{"id":"f1","source":"FEED","title":"Practice","startsAt":"2030-08-16T17:00:00Z","location":"Field","kidIds":["k2"],"feedId":"feed1","feedName":"Soccer"}]""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        else -> error("Unexpected ${request.method} ${request.url.encodedPath}")
                    }
                }
            val model = familyUiModel(mockEngine, token = "tok")
            model.load()
            val ready = assertIs<FamilyUiModel.State.Ready>(model.state)
            assertEquals(2, ready.calendarItems.size)
            model.beginEditEvent(ready.calendarItems.first { it.source == CalendarItemSource.FEED })
            val afterFeed = assertIs<FamilyUiModel.State.Ready>(model.state)
            assertNull(afterFeed.editingEventId)
            assertEquals(false, afterFeed.eventComposeOpen)
            model.beginEditEvent(ready.calendarItems.first { it.source == CalendarItemSource.MANUAL })
            val afterManual = assertIs<FamilyUiModel.State.Ready>(model.state)
            assertEquals("e1", afterManual.editingEventId)
            assertEquals(true, afterManual.eventComposeOpen)
            model.closeEventCompose()
            assertEquals(false, assertIs<FamilyUiModel.State.Ready>(model.state).eventComposeOpen)
            model.setAgendaKidFilter("k2")
            val filtered = assertIs<FamilyUiModel.State.Ready>(model.state)
            assertEquals("k2", filtered.agendaKidFilter)
            val visible =
                filtered.calendarItems.filter { filtered.agendaKidFilter in it.kidIds }
            assertEquals(listOf("Practice"), visible.map { it.title })
        }

    @Test
    fun addEventRejectsEndBeforeStartWithoutCallingApi() =
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
                                    """{"id":"c1","name":"House","role":"CAREGIVER","members":[{"adultId":"2","email":"other@example.com","displayName":"Jordan","role":"CAREGIVER"}],"kids":[{"id":"k1","displayName":"Sam"}],"places":[]}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/calendar" &&
                            request.method == HttpMethod.Get ->
                            respond(
                                content = "[]",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        else -> error("Unexpected ${request.method} ${request.url.encodedPath}")
                    }
                }
            val model = familyUiModel(mockEngine, token = "tok")
            model.load()
            assertIs<FamilyUiModel.State.Ready>(model.state)
            model.updateNewEventTitle("Dentist")
            model.updateNewEventStartsAt("2030-08-15T18:00:00Z")
            model.updateNewEventEndsAt("2030-08-15T17:00:00Z")
            model.toggleNewEventKid("k1")
            model.addEvent()
            val ready = assertIs<FamilyUiModel.State.Ready>(model.state)
            assertEquals("End must be on or after start", ready.error)
            assertTrue(ready.calendarItems.isEmpty())
        }

    @Test
    fun locatePlaceUpdatesCoordinates() =
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
                                content =
                                    """{"id":"c1","name":"House","role":"ORGANIZER","members":[{"adultId":"1","email":"parent@example.com","displayName":"Alex","role":"ORGANIZER"}],"kids":[],"places":[{"id":"p1","name":"School","address":"1 Rd","latitude":null,"longitude":null}]}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/invite" &&
                            request.method == HttpMethod.Get ->
                            respond(
                                content = """{"code":"AB12CD34"}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/places/p1/locate" &&
                            request.method == HttpMethod.Post ->
                            respond(
                                content =
                                    """{"id":"p1","name":"School","address":"1 Rd","latitude":40.5,"longitude":-74.1}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/calendar" &&
                            request.method == HttpMethod.Get ->
                            respond(
                                content = "[]",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        else -> error("Unexpected ${request.method} ${request.url.encodedPath}")
                    }
                }
            val model = familyUiModel(mockEngine, token = "tok")
            model.load()
            val ready = assertIs<FamilyUiModel.State.Ready>(model.state)
            assertTrue(!ready.circle.places.first().isLocated())

            model.locatePlace("p1")
            val located = assertIs<FamilyUiModel.State.Ready>(model.state)
            assertTrue(located.circle.places.first().isLocated())
            assertEquals(40.5, located.circle.places.first().latitude)
        }

    @Test
    fun organizerCanAddSyncAndRemoveFeedWhileCaregiverDoesNotLoadFeeds() =
        runTest {
            val organizerEngine =
                MockEngine { request ->
                    val feed =
                        """{"id":"f1","name":"Soccer","sourceUrl":"https://example.com/team.ics","kidIds":["k1"],"lastSyncedAt":null,"lastSyncError":null,"eventCount":0}"""
                    when {
                        request.url.encodedPath == "/api/auth/me" ->
                            respond(
                                content = """{"id":"1","email":"parent@example.com","displayName":"Alex"}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle" ->
                            respond(
                                content =
                                    """{"id":"c1","name":"House","role":"ORGANIZER","members":[],"kids":[{"id":"k1","displayName":"Sam"}],"places":[]}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/invite" ->
                            respond(
                                content = """{"code":"AB12CD34"}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/feeds" &&
                            request.method == HttpMethod.Get ->
                            respond(
                                content = "[]",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/feeds" &&
                            request.method == HttpMethod.Post ->
                            respond(
                                content = feed,
                                status = HttpStatusCode.Created,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/feeds/f1/sync" ->
                            respond(
                                content =
                                    feed.replace(
                                        "\"lastSyncedAt\":null",
                                        "\"lastSyncedAt\":\"2026-08-10T12:00:00Z\"",
                                    ).replace("\"eventCount\":0", "\"eventCount\":2"),
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/feeds/f1" &&
                            request.method == HttpMethod.Delete ->
                            respond(content = "", status = HttpStatusCode.NoContent)
                        request.url.encodedPath == "/api/family/circle/calendar" &&
                            request.method == HttpMethod.Get ->
                            respond(
                                content = "[]",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        else -> error("Unexpected ${request.method} ${request.url.encodedPath}")
                    }
                }
            val organizer = familyUiModel(organizerEngine, token = "tok")
            organizer.load()
            organizer.updateNewFeedName("Soccer")
            organizer.updateNewFeedUrl("https://example.com/team.ics")
            organizer.toggleNewFeedKid("k1")
            organizer.addFeed()
            organizer.syncFeed("f1")
            val synced = assertIs<FamilyUiModel.State.Ready>(organizer.state)
            assertEquals("Synced · 2 events", synced.feeds.single().syncStatusLabel())
            assertEquals(
                "Sam · Synced · 2 events",
                synced.feeds.single().listStatusLabel(synced.circle.kids),
            )
            organizer.removeFeed("f1")
            assertTrue(assertIs<FamilyUiModel.State.Ready>(organizer.state).feeds.isEmpty())

            val caregiverEngine =
                MockEngine { request ->
                    when (request.url.encodedPath) {
                        "/api/auth/me" ->
                            respond(
                                content = """{"id":"2","email":"caregiver@example.com","displayName":"Jordan"}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        "/api/family/circle" ->
                            respond(
                                content =
                                    """{"id":"c1","name":"House","role":"CAREGIVER","members":[],"kids":[],"places":[]}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        else -> error("Caregiver must not request ${request.url.encodedPath}")
                    }
                }
            val caregiver = familyUiModel(caregiverEngine, token = "tok")
            caregiver.load()
            assertTrue(assertIs<FamilyUiModel.State.Ready>(caregiver.state).feeds.isEmpty())
        }

    @Test
    fun syncFeedReloadsCalendarItems() =
        runTest {
            var calendarJson =
                """[{"id":"e1","source":"FEED","title":"Practice","startsAt":"2026-09-05T08:00:00Z","endsAt":"2026-09-05T08:50:00Z","location":null,"kidIds":["k1"],"feedId":"f1","feedName":"Soccer"}]"""
            val engine =
                MockEngine { request ->
                    when {
                        request.url.encodedPath == "/api/auth/me" ->
                            respond(
                                content = """{"id":"1","email":"parent@example.com","displayName":"Alex"}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle" ->
                            respond(
                                content =
                                    """{"id":"c1","name":"House","role":"ORGANIZER","members":[],"kids":[{"id":"k1","displayName":"Sam"}],"places":[]}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/invite" ->
                            respond(
                                content = """{"code":"AB12CD34"}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/feeds" &&
                            request.method == HttpMethod.Get ->
                            respond(
                                content =
                                    """[{"id":"f1","name":"Soccer","sourceUrl":"https://example.com/team.ics","kidIds":["k1"],"lastSyncedAt":"2026-08-10T12:00:00Z","lastSyncError":null,"eventCount":1}]""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/feeds/f1/sync" -> {
                            calendarJson =
                                """[{"id":"e1","source":"FEED","title":"Practice","startsAt":"2026-09-05T12:00:00Z","endsAt":"2026-09-05T12:50:00Z","location":null,"kidIds":["k1"],"feedId":"f1","feedName":"Soccer"}]"""
                            respond(
                                content =
                                    """{"id":"f1","name":"Soccer","sourceUrl":"https://example.com/team.ics","kidIds":["k1"],"lastSyncedAt":"2026-08-10T12:30:00Z","lastSyncError":null,"eventCount":1}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        }
                        request.url.encodedPath == "/api/family/circle/calendar" &&
                            request.method == HttpMethod.Get ->
                            respond(
                                content = calendarJson,
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        else -> error("Unexpected ${request.method} ${request.url.encodedPath}")
                    }
                }
            val model = familyUiModel(engine, token = "tok")
            model.load()
            val before = assertIs<FamilyUiModel.State.Ready>(model.state)
            assertEquals("2026-09-05T08:00:00Z", before.calendarItems.single().startsAt)

            model.syncFeed("f1")
            val after = assertIs<FamilyUiModel.State.Ready>(model.state)
            assertEquals("2026-09-05T12:00:00Z", after.calendarItems.single().startsAt)
        }

    @Test
    fun loadMoreCalendarAppendsNextPage() =
        runTest {
            var calendarCalls = 0
            val engine =
                MockEngine { request ->
                    when {
                        request.url.encodedPath == "/api/auth/me" ->
                            respond(
                                content = """{"id":"1","email":"parent@example.com","displayName":"Alex"}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle" ->
                            respond(
                                content =
                                    """{"id":"c1","name":"House","role":"ORGANIZER","members":[],"kids":[{"id":"k1","displayName":"Sam"}],"places":[]}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/invite" ->
                            respond(
                                content = """{"code":"AB12CD34"}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/feeds" &&
                            request.method == HttpMethod.Get ->
                            respond(
                                content = "[]",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/calendar" &&
                            request.method == HttpMethod.Get -> {
                            calendarCalls++
                            val body =
                                if (calendarCalls == 1) {
                                    """[{"id":"e1","source":"MANUAL","title":"Near","startsAt":"2030-08-15T17:00:00Z","kidIds":["k1"]}]"""
                                } else {
                                    """[{"id":"e2","source":"MANUAL","title":"Later","startsAt":"2030-09-20T17:00:00Z","kidIds":["k1"]}]"""
                                }
                            respond(
                                content = body,
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        }
                        else -> error("Unexpected ${request.method} ${request.url.encodedPath}")
                    }
                }
            val model = familyUiModel(engine, token = "tok")
            model.load()
            val before = assertIs<FamilyUiModel.State.Ready>(model.state)
            assertEquals(listOf("Near"), before.calendarItems.map { it.title })
            model.loadMoreCalendar()
            val after = assertIs<FamilyUiModel.State.Ready>(model.state)
            assertEquals(listOf("Near", "Later"), after.calendarItems.map { it.title })
            assertEquals(2, calendarCalls)
        }

    @Test
    fun loadMoreCalendarNotifiesListenerWhileLoading() =
        runTest {
            var calendarCalls = 0
            var sawLoadingTrue = false
            val engine =
                MockEngine { request ->
                    when {
                        request.url.encodedPath == "/api/auth/me" ->
                            respond(
                                content = """{"id":"1","email":"parent@example.com","displayName":"Alex"}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle" ->
                            respond(
                                content =
                                    """{"id":"c1","name":"House","role":"ORGANIZER","members":[],"kids":[{"id":"k1","displayName":"Sam"}],"places":[]}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/invite" ->
                            respond(
                                content = """{"code":"AB12CD34"}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/feeds" &&
                            request.method == HttpMethod.Get ->
                            respond(
                                content = "[]",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/calendar" &&
                            request.method == HttpMethod.Get -> {
                            calendarCalls++
                            respond(
                                content =
                                    if (calendarCalls == 1) {
                                        """[{"id":"e1","source":"MANUAL","title":"Near","startsAt":"2030-08-15T17:00:00Z","kidIds":["k1"]}]"""
                                    } else {
                                        "[]"
                                    },
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        }
                        else -> error("Unexpected ${request.method} ${request.url.encodedPath}")
                    }
                }
            val model = familyUiModel(engine, token = "tok")
            model.load()
            assertIs<FamilyUiModel.State.Ready>(model.state)
            model.stateListener = {
                val ready = model.state as? FamilyUiModel.State.Ready
                if (ready?.loading == true) {
                    sawLoadingTrue = true
                }
            }
            model.loadMoreCalendar()
            assertTrue(sawLoadingTrue, "UI must observe loading=true mid Load more")
            assertFalse(assertIs<FamilyUiModel.State.Ready>(model.state).loading)
        }

    @Test
    fun refreshFeedsReloadsListWithoutSync() =
        runTest {
            var listCalls = 0
            val engine =
                MockEngine { request ->
                    when {
                        request.url.encodedPath == "/api/auth/me" ->
                            respond(
                                content = """{"id":"1","email":"parent@example.com","displayName":"Alex"}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle" ->
                            respond(
                                content =
                                    """{"id":"c1","name":"House","role":"ORGANIZER","members":[],"kids":[],"places":[]}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/invite" ->
                            respond(
                                content = """{"code":"AB12CD34"}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/feeds" &&
                            request.method == HttpMethod.Get -> {
                            listCalls++
                            val body =
                                if (listCalls == 1) {
                                    """[{"id":"f1","name":"Soccer","sourceUrl":"https://example.com/team.ics","kidIds":[],"lastSyncedAt":"2026-08-10T12:00:00Z","lastSyncError":null,"eventCount":2}]"""
                                } else {
                                    """[{"id":"f1","name":"Soccer","sourceUrl":"https://example.com/team.ics","kidIds":[],"lastSyncedAt":"2026-08-10T12:30:00Z","lastSyncError":null,"eventCount":5}]"""
                                }
                            respond(
                                content = body,
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        }
                        request.url.encodedPath == "/api/family/circle/calendar" &&
                            request.method == HttpMethod.Get ->
                            respond(
                                content = "[]",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        else -> error("Unexpected ${request.method} ${request.url.encodedPath}")
                    }
                }
            val model = familyUiModel(engine, token = "tok")
            model.load()
            val loaded = assertIs<FamilyUiModel.State.Ready>(model.state)
            assertEquals(2, loaded.feeds.single().eventCount)

            model.refreshFeeds()
            val refreshed = assertIs<FamilyUiModel.State.Ready>(model.state)
            assertEquals(5, refreshed.feeds.single().eventCount)
            assertEquals("Synced · 5 events", refreshed.feeds.single().syncStatusLabel())
            assertEquals(2, listCalls)
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
                        request.url.encodedPath == "/api/family/circle/calendar" &&
                            request.method == HttpMethod.Get ->
                            respond(
                                content = "[]",
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
                        request.url.encodedPath == "/api/family/circle/calendar" &&
                            request.method == HttpMethod.Get ->
                            respond(
                                content = "[]",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
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

    @Test
    fun readyShellDefaultsToCalendarAndNavigatesTabs() =
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
                                content =
                                    """{"id":"c1","name":"House","role":"ORGANIZER","members":[{"adultId":"1","email":"parent@example.com","displayName":"Alex","role":"ORGANIZER"}],"kids":[],"places":[]}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/invite" ->
                            respond(
                                content = """{"code":"AB12CD34"}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/feeds" ->
                            respond(
                                content = "[]",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/calendar" ->
                            respond(
                                content = "[]",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        else -> error("Unexpected ${request.method} ${request.url.encodedPath}")
                    }
                }
            val model = familyUiModel(mockEngine, token = "tok")
            model.load()
            val ready = assertIs<FamilyUiModel.State.Ready>(model.state)
            assertEquals(FamilyUiModel.ShellTab.CALENDAR, ready.shellTab)
            assertEquals(FamilyUiModel.MoreScreen.LIST, ready.moreScreen)
            assertEquals(AppShell.primaryTabs, listOf("Calendar", "Carpool", "Family", "More"))
            assertEquals(AppShell.CARPOOL_HAVE_A_CODE, "Have a code?")

            model.selectShellTab(FamilyUiModel.ShellTab.CARPOOL)
            assertEquals(
                FamilyUiModel.ShellTab.CARPOOL,
                assertIs<FamilyUiModel.State.Ready>(model.state).shellTab,
            )

            model.openMorePlaces()
            val places = assertIs<FamilyUiModel.State.Ready>(model.state)
            assertEquals(FamilyUiModel.ShellTab.MORE, places.shellTab)
            assertEquals(FamilyUiModel.MoreScreen.PLACES, places.moreScreen)
            assertEquals(listOf("Places", "Feeds"), AppShell.moreGeneralRows(isOrganizer = true))

            model.openMoreFeeds()
            val feeds = assertIs<FamilyUiModel.State.Ready>(model.state)
            assertEquals(FamilyUiModel.MoreScreen.FEEDS, feeds.moreScreen)

            model.selectShellTab(FamilyUiModel.ShellTab.MORE)
            assertEquals(
                FamilyUiModel.MoreScreen.LIST,
                assertIs<FamilyUiModel.State.Ready>(model.state).moreScreen,
            )
        }

    @Test
    fun caregiverCannotOpenMoreFeeds() =
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
                                    """{"id":"c1","name":"House","role":"CAREGIVER","members":[{"adultId":"1","email":"parent@example.com","displayName":"Alex","role":"ORGANIZER"},{"adultId":"2","email":"other@example.com","displayName":"Jordan","role":"CAREGIVER"}],"kids":[],"places":[]}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/calendar" ->
                            respond(
                                content = "[]",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        else -> error("Unexpected ${request.method} ${request.url.encodedPath}")
                    }
                }
            val model = familyUiModel(mockEngine, token = "tok")
            model.load()
            assertIs<FamilyUiModel.State.Ready>(model.state)
            model.openMoreFeeds()
            val ready = assertIs<FamilyUiModel.State.Ready>(model.state)
            assertEquals(FamilyUiModel.ShellTab.CALENDAR, ready.shellTab)
            assertEquals(FamilyUiModel.MoreScreen.LIST, ready.moreScreen)
            assertEquals(listOf("Places"), AppShell.moreGeneralRows(isOrganizer = false))
            assertFalse(AppShell.showsFeedsRow(isOrganizer = false))
            model.selectShellTab(FamilyUiModel.ShellTab.CARPOOL)
            assertEquals(
                FamilyUiModel.ShellTab.CARPOOL,
                assertIs<FamilyUiModel.State.Ready>(model.state).shellTab,
            )
            model.openMorePlaces()
            assertEquals(
                FamilyUiModel.MoreScreen.PLACES,
                assertIs<FamilyUiModel.State.Ready>(model.state).moreScreen,
            )
        }

    @Test
    fun organizerEnablesCarpoolAndCaregiverOmitsEnable() =
        runTest {
            var enabled = false
            val noneSummary =
                """{"circleRole":"ORGANIZER","feeds":[{"feedId":"f1","feedName":"Soccer","status":"NONE","spaceId":null,"spaceName":null}],"spaces":[]}"""
            val ownerSummary =
                """{"circleRole":"ORGANIZER","feeds":[{"feedId":"f1","feedName":"Soccer","status":"OWNER","spaceId":"s1","spaceName":"Soccer"}],"spaces":[{"id":"s1","name":"Soccer","membership":"OWNER","inviteCode":"AB12CD34","callerFeedId":"f1","members":[{"circleId":"c1","circleName":"House A","membership":"OWNER"}],"pendingRequests":[]}]}"""
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
                                content =
                                    """{"id":"c1","name":"House","role":"ORGANIZER","members":[{"adultId":"1","email":"parent@example.com","displayName":"Alex","role":"ORGANIZER"}],"kids":[],"places":[]}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/calendar" ->
                            respond(
                                content = "[]",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/carpool" &&
                            request.method == HttpMethod.Get ->
                            respond(
                                content = if (enabled) ownerSummary else noneSummary,
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/carpool/enable" &&
                            request.method == HttpMethod.Post -> {
                            enabled = true
                            respond(
                                content =
                                    """{"id":"s1","name":"Soccer","membership":"OWNER","inviteCode":"AB12CD34","callerFeedId":"f1","members":[{"circleId":"c1","circleName":"House A","membership":"OWNER"}],"pendingRequests":[]}""",
                                status = HttpStatusCode.Created,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        }
                        else -> error("Unexpected ${request.method} ${request.url.encodedPath}")
                    }
                }
            val model = familyUiModel(mockEngine, token = "tok")
            model.load()
            assertIs<FamilyUiModel.State.Ready>(model.state)
            model.loadCarpoolSummary()
            val before = assertIs<FamilyUiModel.State.Ready>(model.state)
            val noneFeed = before.carpoolSummary?.feeds?.single()
            assertEquals(CarpoolFeedStatusKind.NONE, noneFeed?.status)
            assertEquals(
                CarpoolPrimaryAction.ENABLE,
                noneFeed?.primaryAction(before.circle.role),
            )
            model.enableCarpool("f1")
            val after = assertIs<FamilyUiModel.State.Ready>(model.state)
            assertEquals(CarpoolFeedStatusKind.OWNER, after.carpoolSummary?.feeds?.single()?.status)
            assertEquals("AB12CD34", after.carpoolSummary?.spaces?.single()?.inviteCode)
        }

    @Test
    fun joinCarpoolReloadsFeedsAndCalendar() =
        runTest {
            var joined = false
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
                                content =
                                    """{"id":"c1","name":"House","role":"ORGANIZER","members":[{"adultId":"1","email":"parent@example.com","displayName":"Alex","role":"ORGANIZER"}],"kids":[],"places":[]}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/invite" ->
                            respond(
                                content = """{"code":"ZZ99YY88"}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/feeds" &&
                            request.method == HttpMethod.Get ->
                            respond(
                                content =
                                    if (joined) {
                                        """[{"id":"f1","name":"Soccer","sourceUrl":"https://example.com/team.ics","kidIds":[],"lastSyncedAt":"2026-08-10T12:00:00Z","lastSyncError":null,"eventCount":3}]"""
                                    } else {
                                        "[]"
                                    },
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/calendar" &&
                            request.method == HttpMethod.Get ->
                            respond(
                                content =
                                    if (joined) {
                                        """[{"id":"e1","source":"FEED","title":"Practice","startsAt":"2026-08-20T16:00:00Z","endsAt":null,"location":null,"kidIds":[],"feedId":"f1","feedName":"Soccer"}]"""
                                    } else {
                                        "[]"
                                    },
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/carpool" &&
                            request.method == HttpMethod.Get ->
                            respond(
                                content =
                                    if (joined) {
                                        """{"circleRole":"ORGANIZER","feeds":[{"feedId":"f1","feedName":"Soccer","status":"MEMBER","spaceId":"s1","spaceName":"Soccer"}],"spaces":[{"id":"s1","name":"Soccer","membership":"MEMBER","inviteCode":"AB12CD34","callerFeedId":"f1","members":[{"circleId":"c1","circleName":"House","membership":"MEMBER"}],"pendingRequests":[]}]}"""
                                    } else {
                                        """{"circleRole":"ORGANIZER","feeds":[],"spaces":[]}"""
                                    },
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/carpool/join" &&
                            request.method == HttpMethod.Post -> {
                            joined = true
                            respond(
                                content =
                                    """{"id":"s1","name":"Soccer","membership":"MEMBER","inviteCode":"AB12CD34","callerFeedId":"f1","members":[{"circleId":"c1","circleName":"House","membership":"MEMBER"}],"pendingRequests":[]}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        }
                        else -> error("Unexpected ${request.method} ${request.url.encodedPath}")
                    }
                }
            val model = familyUiModel(mockEngine, token = "tok")
            model.load()
            val before = assertIs<FamilyUiModel.State.Ready>(model.state)
            assertTrue(before.feeds.isEmpty())
            assertTrue(before.calendarItems.isEmpty())
            model.updateCarpoolCodeInput("AB12CD34")
            model.joinCarpool()
            val after = assertIs<FamilyUiModel.State.Ready>(model.state)
            assertEquals("Soccer", after.feeds.single().name)
            assertEquals("Practice", after.calendarItems.single().title)
            assertEquals(CarpoolSpaceMembership.MEMBER, after.carpoolSummary?.spaces?.single()?.membership)
            assertEquals("", after.carpoolCodeInput)
            assertFalse(after.carpoolShowCodeForm)
        }

    @Test
    fun caregiverJoinCarpoolReloadsCalendarWithoutListingFeeds() =
        runTest {
            var joined = false
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
                                    """{"id":"c1","name":"House","role":"CAREGIVER","members":[{"adultId":"1","email":"parent@example.com","displayName":"Alex","role":"ORGANIZER"},{"adultId":"2","email":"other@example.com","displayName":"Jordan","role":"CAREGIVER"}],"kids":[],"places":[]}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/feeds" ->
                            error("Caregiver must not list feeds")
                        request.url.encodedPath == "/api/family/circle/calendar" &&
                            request.method == HttpMethod.Get ->
                            respond(
                                content =
                                    if (joined) {
                                        """[{"id":"e1","source":"FEED","title":"Practice","startsAt":"2026-08-20T16:00:00Z","endsAt":null,"location":null,"kidIds":[],"feedId":"f1","feedName":"Soccer"}]"""
                                    } else {
                                        "[]"
                                    },
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/carpool" &&
                            request.method == HttpMethod.Get ->
                            respond(
                                content =
                                    if (joined) {
                                        """{"circleRole":"CAREGIVER","feeds":[],"spaces":[{"id":"s1","name":"Soccer","membership":"MEMBER","inviteCode":"AB12CD34","callerFeedId":"f1","members":[{"circleId":"c1","circleName":"House","membership":"MEMBER"}],"pendingRequests":[]}]}"""
                                    } else {
                                        """{"circleRole":"CAREGIVER","feeds":[],"spaces":[]}"""
                                    },
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/carpool/join" &&
                            request.method == HttpMethod.Post -> {
                            joined = true
                            respond(
                                content =
                                    """{"id":"s1","name":"Soccer","membership":"MEMBER","inviteCode":"AB12CD34","callerFeedId":"f1","members":[{"circleId":"c1","circleName":"House","membership":"MEMBER"}],"pendingRequests":[]}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        }
                        else -> error("Unexpected ${request.method} ${request.url.encodedPath}")
                    }
                }
            val model = familyUiModel(mockEngine, token = "tok")
            model.load()
            assertTrue(assertIs<FamilyUiModel.State.Ready>(model.state).calendarItems.isEmpty())
            model.updateCarpoolCodeInput("AB12CD34")
            model.joinCarpool()
            val after = assertIs<FamilyUiModel.State.Ready>(model.state)
            assertEquals("Practice", after.calendarItems.single().title)
            assertTrue(after.feeds.isEmpty())
        }

    @Test
    fun caregiverCarpoolEmptyHintDoesNotMentionFeedsAndEnableIsIgnored() =
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
                                    """{"id":"c1","name":"House","role":"CAREGIVER","members":[{"adultId":"1","email":"parent@example.com","displayName":"Alex","role":"ORGANIZER"},{"adultId":"2","email":"other@example.com","displayName":"Jordan","role":"CAREGIVER"}],"kids":[],"places":[]}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/calendar" ->
                            respond(
                                content = "[]",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/carpool" &&
                            request.method == HttpMethod.Get ->
                            respond(
                                content = """{"circleRole":"CAREGIVER","feeds":[],"spaces":[]}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/carpool/enable" ->
                            error("Caregiver must not call enable")
                        else -> error("Unexpected ${request.method} ${request.url.encodedPath}")
                    }
                }
            val model = familyUiModel(mockEngine, token = "tok")
            model.load()
            model.loadCarpoolSummary()
            val ready = assertIs<FamilyUiModel.State.Ready>(model.state)
            val summary = ready.carpoolSummary
            assertNotNull(summary)
            assertTrue(summary.hasNoCarpools())
            assertFalse(summary.emptyHint().contains("Feeds"))
            model.enableCarpool("f1")
            val after = assertIs<FamilyUiModel.State.Ready>(model.state)
            assertTrue(after.carpoolSummary?.hasNoCarpools() == true)
        }

    @Test
    fun setCalendarLeaveFromUpdatesMatchingAgendaRow() =
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
                                content =
                                    """{"id":"c1","name":"House","role":"ORGANIZER","members":[{"adultId":"1","email":"parent@example.com","displayName":"Alex","role":"ORGANIZER"}],"kids":[{"id":"k1","displayName":"Sam"}],"places":[{"id":"p1","name":"Mom's house","address":"1 Main","latitude":40.1,"longitude":-74.1},{"id":"p2","name":"Dad's house","address":"2 Main","latitude":40.2,"longitude":-74.2}]}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/invite" ->
                            respond(
                                content = """{"code":"AB12CD34"}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/feeds" ->
                            respond(
                                content = "[]",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/calendar" &&
                            request.method == HttpMethod.Get ->
                            respond(
                                content =
                                    """[{"id":"e1","source":"MANUAL","title":"Practice","startsAt":"2030-08-15T17:00:00Z","location":"Rink","kidIds":["k1"],"leaveFromPlaceId":"p1","leaveFromPlaceName":"Mom's house","leaveByAt":"2030-08-15T16:30:00Z","leaveByStatus":"OK","leaveByReason":null}]""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath ==
                            "/api/family/circle/calendar/MANUAL/e1/leave-from" &&
                            request.method == HttpMethod.Put ->
                            respond(
                                content =
                                    """{"id":"e1","source":"MANUAL","title":"Practice","startsAt":"2030-08-15T17:00:00Z","location":"Rink","kidIds":["k1"],"leaveFromPlaceId":"p2","leaveFromPlaceName":"Dad's house","leaveByAt":"2030-08-15T16:20:00Z","leaveByStatus":"OK","leaveByReason":null}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        else -> error("Unexpected ${request.method} ${request.url.encodedPath}")
                    }
                }
            val model = familyUiModel(mockEngine, token = "tok")
            model.load()
            val ready = assertIs<FamilyUiModel.State.Ready>(model.state)
            val item = ready.calendarItems.first()
            assertEquals("p1", item.leaveFromPlaceId)
            assertEquals(LeaveByStatus.OK, item.leaveByStatus)
            assertTrue(leaveByAgendaLine(item).endsWith(" · estimate"))

            model.setCalendarLeaveFrom(item, "p2")
            val updated = assertIs<FamilyUiModel.State.Ready>(model.state)
            assertEquals("p2", updated.calendarItems.first().leaveFromPlaceId)
            assertEquals("Dad's house", updated.calendarItems.first().leaveFromPlaceName)
            assertNull(updated.error)
        }

    @Test
    fun setCalendarRsvpUpdatesMatchingAgendaRow() =
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
                                content =
                                    """{"id":"c1","name":"House","role":"ORGANIZER","members":[{"adultId":"1","email":"parent@example.com","displayName":"Alex","role":"ORGANIZER"}],"kids":[{"id":"k1","displayName":"Sam"}],"places":[]}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/invite" ->
                            respond(
                                content = """{"code":"AB12CD34"}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/feeds" ->
                            respond(
                                content = "[]",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/calendar" &&
                            request.method == HttpMethod.Get ->
                            respond(
                                content =
                                    """[{"id":"e1","source":"MANUAL","title":"Practice","startsAt":"2030-08-15T17:00:00Z","location":"Rink","kidIds":["k1"],"leaveByStatus":"UNAVAILABLE","coverages":[],"uncoveredKidIds":["k1"],"conflicts":[],"rsvps":[{"kidId":"k1","status":"NO_RESPONSE"}]}]""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath ==
                            "/api/family/circle/calendar/MANUAL/e1/rsvps/k1" &&
                            request.method == HttpMethod.Put ->
                            respond(
                                content =
                                    """{"id":"e1","source":"MANUAL","title":"Practice","startsAt":"2030-08-15T17:00:00Z","location":"Rink","kidIds":["k1"],"leaveByStatus":"UNAVAILABLE","coverages":[],"uncoveredKidIds":[],"conflicts":[],"rsvps":[{"kidId":"k1","status":"NO"}]}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        else -> error("Unexpected ${request.method} ${request.url.encodedPath}")
                    }
                }
            val model = familyUiModel(mockEngine, token = "tok")
            model.load()
            val ready = assertIs<FamilyUiModel.State.Ready>(model.state)
            val item = ready.calendarItems.first()
            assertEquals(RsvpStatus.NO_RESPONSE, item.rsvps.single().status)

            model.setCalendarRsvp(item, "k1", RsvpStatus.NO)
            val updated = assertIs<FamilyUiModel.State.Ready>(model.state)
            assertEquals(RsvpStatus.NO, updated.calendarItems.first().rsvps.single().status)
            assertEquals(emptyList(), updated.calendarItems.first().uncoveredKidIds)
            assertNull(updated.error)
        }

    @Test
    fun calendarLoadsCoverageAndUncoveredKids() =
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
                                content =
                                    """{"id":"c1","name":"House","role":"ORGANIZER","members":[{"adultId":"1","email":"parent@example.com","displayName":"Alex","role":"ORGANIZER"},{"adultId":"2","email":"sam@example.com","displayName":"Sam","role":"CAREGIVER"}],"kids":[{"id":"k1","displayName":"Alex"},{"id":"k2","displayName":"Jordan"}],"places":[]}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/invite" ->
                            respond(
                                content = """{"code":"AB12CD34"}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/feeds" ->
                            respond(
                                content = "[]",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/calendar" &&
                            request.method == HttpMethod.Get ->
                            respond(
                                content =
                                    """[{"id":"e1","source":"MANUAL","title":"Practice","startsAt":"2030-08-15T17:00:00Z","kidIds":["k1","k2"],"coverages":[{"id":"a1","coveringAdultId":"2","coveringAdultDisplayName":"Sam","assignedByAdultId":"1","kidIds":["k1"],"status":"CONFIRMED"}],"uncoveredKidIds":["k2"]}]""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        else -> error("Unexpected ${request.method} ${request.url.encodedPath}")
                    }
                }
            val model = familyUiModel(mockEngine, token = "tok")
            model.load()
            val ready = assertIs<FamilyUiModel.State.Ready>(model.state)
            val item = ready.calendarItems.single()
            assertEquals(1, activeCoverages(item).size)
            assertEquals(CoverageStatus.CONFIRMED, activeCoverages(item).single().status)
            assertEquals(listOf("k2"), item.uncoveredKidIds)
            assertEquals("Sam", coverageAdultLabel(activeCoverages(item).single(), ready.circle.members))
        }

    @Test
    fun assignCoverageUpdatesAgendaRow() =
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
                                content =
                                    """{"id":"c1","name":"House","role":"ORGANIZER","members":[{"adultId":"1","email":"parent@example.com","displayName":"Alex","role":"ORGANIZER"},{"adultId":"2","email":"sam@example.com","displayName":"Sam","role":"CAREGIVER"}],"kids":[{"id":"k1","displayName":"Alex"}],"places":[]}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/invite" ->
                            respond(
                                content = """{"code":"AB12CD34"}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/feeds" ->
                            respond(
                                content = "[]",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/calendar" &&
                            request.method == HttpMethod.Get ->
                            respond(
                                content =
                                    """[{"id":"e1","source":"MANUAL","title":"Practice","startsAt":"2030-08-15T17:00:00Z","kidIds":["k1"],"coverages":[],"uncoveredKidIds":["k1"]}]""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath ==
                            "/api/family/circle/calendar/MANUAL/e1/coverages" &&
                            request.method == HttpMethod.Post ->
                            respond(
                                content =
                                    """{"id":"e1","source":"MANUAL","title":"Practice","startsAt":"2030-08-15T17:00:00Z","kidIds":["k1"],"coverages":[{"id":"a1","coveringAdultId":"2","coveringAdultDisplayName":"Sam","assignedByAdultId":"1","kidIds":["k1"],"status":"PENDING"}],"uncoveredKidIds":[]}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        else -> error("Unexpected ${request.method} ${request.url.encodedPath}")
                    }
                }
            val model = familyUiModel(mockEngine, token = "tok")
            model.load()
            val item = assertIs<FamilyUiModel.State.Ready>(model.state).calendarItems.single()
            assertTrue(item.uncoveredKidIds.isNotEmpty())

            model.assignCoverage(item, "2", listOf("k1"))
            val updated = assertIs<FamilyUiModel.State.Ready>(model.state)
            val row = updated.calendarItems.single()
            assertEquals(CoverageStatus.PENDING, activeCoverages(row).single().status)
            assertTrue(row.uncoveredKidIds.isEmpty())
            assertNull(updated.error)
        }

    @Test
    fun confirmCoverageWhenPendingAssignee() =
        runTest {
            val mockEngine =
                MockEngine { request ->
                    when {
                        request.url.encodedPath == "/api/auth/me" ->
                            respond(
                                content =
                                    """{"id":"2","email":"sam@example.com","displayName":"Sam"}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle" &&
                            request.method == HttpMethod.Get ->
                            respond(
                                content =
                                    """{"id":"c1","name":"House","role":"CAREGIVER","members":[{"adultId":"1","email":"parent@example.com","displayName":"Alex","role":"ORGANIZER"},{"adultId":"2","email":"sam@example.com","displayName":"Sam","role":"CAREGIVER"}],"kids":[{"id":"k1","displayName":"Alex"}],"places":[]}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/calendar" &&
                            request.method == HttpMethod.Get ->
                            respond(
                                content =
                                    """[{"id":"e1","source":"MANUAL","title":"Practice","startsAt":"2030-08-15T17:00:00Z","kidIds":["k1"],"coverages":[{"id":"a1","coveringAdultId":"2","coveringAdultDisplayName":"Sam","assignedByAdultId":"1","kidIds":["k1"],"status":"PENDING"}],"uncoveredKidIds":[]}]""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath ==
                            "/api/family/circle/calendar/coverages/a1/confirm" &&
                            request.method == HttpMethod.Post ->
                            respond(
                                content =
                                    """{"id":"e1","source":"MANUAL","title":"Practice","startsAt":"2030-08-15T17:00:00Z","kidIds":["k1"],"coverages":[{"id":"a1","coveringAdultId":"2","coveringAdultDisplayName":"Sam","assignedByAdultId":"1","kidIds":["k1"],"status":"CONFIRMED"}],"uncoveredKidIds":[]}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        else -> error("Unexpected ${request.method} ${request.url.encodedPath}")
                    }
                }
            val model = familyUiModel(mockEngine, token = "tok")
            model.load()
            val ready = assertIs<FamilyUiModel.State.Ready>(model.state)
            val item = ready.calendarItems.single()
            assertNotNull(pendingCoverageForAdult(item, ready.adultId))

            model.confirmCoverage("a1")
            val updated = assertIs<FamilyUiModel.State.Ready>(model.state)
            assertEquals(
                CoverageStatus.CONFIRMED,
                activeCoverages(updated.calendarItems.single()).single().status,
            )
            assertNull(updated.error)
        }

    @Test
    fun confirmCoverageMapsOverlappingDoubleConfirmed409() =
        runTest {
            val mockEngine =
                MockEngine { request ->
                    when {
                        request.url.encodedPath == "/api/auth/me" ->
                            respond(
                                content =
                                    """{"id":"2","email":"sam@example.com","displayName":"Sam"}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle" &&
                            request.method == HttpMethod.Get ->
                            respond(
                                content =
                                    """{"id":"c1","name":"House","role":"CAREGIVER","members":[{"adultId":"1","email":"parent@example.com","displayName":"Alex","role":"ORGANIZER"},{"adultId":"2","email":"sam@example.com","displayName":"Sam","role":"CAREGIVER"}],"kids":[{"id":"k1","displayName":"Alex"}],"places":[]}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/calendar" &&
                            request.method == HttpMethod.Get ->
                            respond(
                                content =
                                    """[{"id":"e1","source":"MANUAL","title":"Practice","startsAt":"2030-08-15T17:00:00Z","kidIds":["k1"],"coverages":[{"id":"a1","coveringAdultId":"2","coveringAdultDisplayName":"Sam","assignedByAdultId":"1","kidIds":["k1"],"status":"PENDING"}],"uncoveredKidIds":[],"conflicts":[]}]""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath ==
                            "/api/family/circle/calendar/coverages/a1/confirm" &&
                            request.method == HttpMethod.Post ->
                            respond(
                                content =
                                    """{"message":"Adult is already confirmed on an overlapping calendar item"}""",
                                status = HttpStatusCode.Conflict,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        else -> error("Unexpected ${request.method} ${request.url.encodedPath}")
                    }
                }
            val model = familyUiModel(mockEngine, token = "tok")
            model.load()
            model.confirmCoverage("a1")
            val updated = assertIs<FamilyUiModel.State.Ready>(model.state)
            assertEquals(
                "Already confirmed on an overlapping event — decline or reassign first.",
                updated.coverageActionErrors["MANUAL-e1"],
            )
            assertEquals(null, updated.error)
            assertEquals(
                CoverageStatus.PENDING,
                updated.calendarItems.single().coverages.single().status,
            )
        }

    @Test
    fun setDefaultLeaveFromUpdatesCircle() =
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
                                content =
                                    """{"id":"c1","name":"House","role":"ORGANIZER","members":[{"adultId":"1","email":"parent@example.com","displayName":"Alex","role":"ORGANIZER"}],"kids":[],"places":[{"id":"p1","name":"Mom's house","address":"1 Main","latitude":40.1,"longitude":-74.1},{"id":"p2","name":"Dad's house","address":"2 Main","latitude":40.2,"longitude":-74.2}]}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/invite" ->
                            respond(
                                content = """{"code":"AB12CD34"}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/feeds" ->
                            respond(
                                content = "[]",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/calendar" &&
                            request.method == HttpMethod.Get ->
                            respond(
                                content = "[]",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/default-leave-from" &&
                            request.method == HttpMethod.Patch ->
                            respond(
                                content =
                                    """{"id":"c1","name":"House","role":"ORGANIZER","members":[{"adultId":"1","email":"parent@example.com","displayName":"Alex","role":"ORGANIZER"}],"kids":[],"places":[{"id":"p1","name":"Mom's house","address":"1 Main","latitude":40.1,"longitude":-74.1},{"id":"p2","name":"Dad's house","address":"2 Main","latitude":40.2,"longitude":-74.2}],"defaultLeaveFromPlaceId":"p2","defaultLeaveFromPlaceName":"Dad's house"}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        else -> error("Unexpected ${request.method} ${request.url.encodedPath}")
                    }
                }
            val model = familyUiModel(mockEngine, token = "tok")
            model.load()
            val ready = assertIs<FamilyUiModel.State.Ready>(model.state)
            assertNull(ready.circle.defaultLeaveFromPlaceId)

            model.setDefaultLeaveFrom("p2")
            val updated = assertIs<FamilyUiModel.State.Ready>(model.state)
            assertEquals("p2", updated.circle.defaultLeaveFromPlaceId)
            assertEquals("Dad's house", updated.circle.defaultLeaveFromPlaceName)
            assertNull(updated.error)
        }

    @Test
    fun paintsCachedAgendaBeforeRevalidateCompletes() =
        runTest {
            val cache = InMemoryCalendarCacheStore()
            val window = defaultCalendarWindow()
            cache.save(
                CalendarCacheSnapshot(
                    adultId = "1",
                    circleId = "c1",
                    from = window.from,
                    to = window.to,
                    items =
                        listOf(
                            CalendarItem(
                                id = "e1",
                                source = CalendarItemSource.MANUAL,
                                title = "Cached Practice",
                                startsAt = "2030-08-15T17:00:00Z",
                                kidIds = listOf("k1"),
                            ),
                        ),
                    fetchedAt = nowEpochMillis(),
                ),
            )
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
                                content =
                                    """{"id":"c1","name":"House","role":"ORGANIZER","members":[{"adultId":"1","email":"parent@example.com","displayName":"Alex","role":"ORGANIZER"}],"kids":[{"id":"k1","displayName":"Sam"}],"places":[]}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/invite" ->
                            respond(
                                content = """{"code":"AB12CD34"}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/feeds" ->
                            respond(
                                content = "[]",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/calendar" ->
                            respond(
                                content =
                                    """[{"id":"e1","source":"MANUAL","title":"Fresh Practice","startsAt":"2030-08-15T17:00:00Z","kidIds":["k1"]}]""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        else -> error("Unexpected ${request.method} ${request.url.encodedPath}")
                    }
                }
            val model = familyUiModel(mockEngine, token = "tok", calendarCache = cache)
            val snapshots = mutableListOf<Pair<String?, Boolean>>()
            model.stateListener = {
                val ready = model.state as? FamilyUiModel.State.Ready
                if (ready != null) {
                    snapshots.add(ready.calendarItems.firstOrNull()?.title to ready.calendarRevalidating)
                }
            }
            model.load()
            assertTrue(
                snapshots.any { it.first == "Cached Practice" && it.second },
                "expected cached paint while revalidating, saw $snapshots",
            )
            val ready = assertIs<FamilyUiModel.State.Ready>(model.state)
            assertEquals("Fresh Practice", ready.calendarItems.single().title)
            assertFalse(ready.calendarRevalidating)
            assertEquals("Fresh Practice", cache.load("1", "c1")!!.items.single().title)
        }

    @Test
    fun paintsCachedAgendaBeforeInviteReturns() =
        runTest {
            val cache = InMemoryCalendarCacheStore()
            val window = defaultCalendarWindow()
            cache.save(
                CalendarCacheSnapshot(
                    adultId = "1",
                    circleId = "c1",
                    from = window.from,
                    to = window.to,
                    items =
                        listOf(
                            CalendarItem(
                                id = "e1",
                                source = CalendarItemSource.MANUAL,
                                title = "Cached Practice",
                                startsAt = "2030-08-15T17:00:00Z",
                                kidIds = listOf("k1"),
                            ),
                        ),
                    fetchedAt = nowEpochMillis(),
                ),
            )
            val inviteGate = kotlinx.coroutines.CompletableDeferred<Unit>()
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
                                content =
                                    """{"id":"c1","name":"House","role":"ORGANIZER","members":[{"adultId":"1","email":"parent@example.com","displayName":"Alex","role":"ORGANIZER"}],"kids":[{"id":"k1","displayName":"Sam"}],"places":[]}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/invite" -> {
                            inviteGate.await()
                            respond(
                                content = """{"code":"AB12CD34"}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        }
                        request.url.encodedPath == "/api/family/circle/feeds" ->
                            respond(
                                content = "[]",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/calendar" ->
                            respond(
                                content =
                                    """[{"id":"e1","source":"MANUAL","title":"Fresh Practice","startsAt":"2030-08-15T17:00:00Z","kidIds":["k1"]}]""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        else -> error("Unexpected ${request.method} ${request.url.encodedPath}")
                    }
                }
            val model = familyUiModel(mockEngine, token = "tok", calendarCache = cache)
            var sawCachedReadyWhileInvitePending = false
            model.stateListener = {
                when (val ready = model.state) {
                    is FamilyUiModel.State.Ready -> {
                        if (
                            ready.calendarItems.any { it.title == "Cached Practice" } &&
                                ready.calendarRevalidating &&
                                ready.inviteCode == null &&
                                !inviteGate.isCompleted
                        ) {
                            sawCachedReadyWhileInvitePending = true
                            inviteGate.complete(Unit)
                        }
                    }
                    else -> Unit
                }
            }
            model.load()
            assertTrue(
                sawCachedReadyWhileInvitePending,
                "Ready+cache must paint before invite returns (otherwise Loading spinner sticks)",
            )
            val ready = assertIs<FamilyUiModel.State.Ready>(model.state)
            assertEquals("AB12CD34", ready.inviteCode)
            assertEquals("Fresh Practice", ready.calendarItems.single().title)
        }

    @Test
    fun leavesFullScreenLoadingAsSoonAsCircleReturnsWithoutCache() =
        runTest {
            val calendarGate = kotlinx.coroutines.CompletableDeferred<Unit>()
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
                                content =
                                    """{"id":"c1","name":"House","role":"ORGANIZER","members":[{"adultId":"1","email":"parent@example.com","displayName":"Alex","role":"ORGANIZER"}],"kids":[],"places":[]}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/invite" ->
                            respond(
                                content = """{"code":"AB12CD34"}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/feeds" ->
                            respond(
                                content = "[]",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/calendar" -> {
                            calendarGate.await()
                            respond(
                                content = "[]",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        }
                        else -> error("Unexpected ${request.method} ${request.url.encodedPath}")
                    }
                }
            val model = familyUiModel(mockEngine, token = "tok")
            var sawReadyShellBeforeCalendar = false
            model.stateListener = {
                when (val ready = model.state) {
                    is FamilyUiModel.State.Ready -> {
                        if (ready.calendarItems.isEmpty() && !calendarGate.isCompleted) {
                            sawReadyShellBeforeCalendar = true
                            calendarGate.complete(Unit)
                        }
                    }
                    else -> Unit
                }
            }
            model.load()
            assertTrue(
                sawReadyShellBeforeCalendar,
                "login must show Ready shell after getCircle with no spinner flags",
            )
            val ready = assertIs<FamilyUiModel.State.Ready>(model.state)
            assertFalse(ready.loading)
            assertFalse(ready.calendarRevalidating)
        }

    @Test
    fun paintsBootstrapShellBeforeGetCircleReturns() =
        runTest {
            val bootstrap = InMemoryFamilyBootstrapCache()
            val calendarCache = InMemoryCalendarCacheStore()
            val window = defaultCalendarWindow()
            bootstrap.save(
                FamilyBootstrapSnapshot(
                    adultId = "1",
                    email = "parent@example.com",
                    adultDisplayName = "Alex",
                    circle =
                        FamilyCircle(
                            id = "c1",
                            name = "House",
                            role = FamilyRole.ORGANIZER,
                            members =
                                listOf(
                                    FamilyMember(
                                        adultId = "1",
                                        email = "parent@example.com",
                                        displayName = "Alex",
                                        role = FamilyRole.ORGANIZER,
                                    ),
                                ),
                            kids = listOf(Kid(id = "k1", displayName = "Sam")),
                        ),
                    inviteCode = "AB12CD34",
                ),
            )
            calendarCache.save(
                CalendarCacheSnapshot(
                    adultId = "1",
                    circleId = "c1",
                    from = window.from,
                    to = window.to,
                    items =
                        listOf(
                            CalendarItem(
                                id = "e1",
                                source = CalendarItemSource.MANUAL,
                                title = "Bootstrapped Practice",
                                startsAt = "2030-08-15T17:00:00Z",
                                kidIds = listOf("k1"),
                            ),
                        ),
                    fetchedAt = nowEpochMillis(),
                ),
            )
            val circleGate = kotlinx.coroutines.CompletableDeferred<Unit>()
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
                            request.method == HttpMethod.Get -> {
                            circleGate.await()
                            respond(
                                content =
                                    """{"id":"c1","name":"House","role":"ORGANIZER","members":[{"adultId":"1","email":"parent@example.com","displayName":"Alex","role":"ORGANIZER"}],"kids":[{"id":"k1","displayName":"Sam"}],"places":[]}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        }
                        request.url.encodedPath == "/api/family/circle/invite" ->
                            respond(
                                content = """{"code":"AB12CD34"}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/feeds" ->
                            respond(
                                content = "[]",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/calendar" ->
                            respond(
                                content =
                                    """[{"id":"e1","source":"MANUAL","title":"Fresh","startsAt":"2030-08-15T17:00:00Z","kidIds":["k1"]}]""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        else -> error("Unexpected ${request.method} ${request.url.encodedPath}")
                    }
                }
            val model =
                familyUiModel(
                    mockEngine,
                    token = "tok",
                    calendarCache = calendarCache,
                    bootstrapCache = bootstrap,
                )
            var sawBootstrapBeforeCircle = false
            model.stateListener = {
                when (val ready = model.state) {
                    is FamilyUiModel.State.Ready -> {
                        if (
                            ready.calendarItems.any { it.title == "Bootstrapped Practice" } &&
                                !circleGate.isCompleted
                        ) {
                            sawBootstrapBeforeCircle = true
                            circleGate.complete(Unit)
                        }
                    }
                    is FamilyUiModel.State.Loading -> Unit
                    else -> Unit
                }
            }
            model.load()
            assertTrue(
                sawBootstrapBeforeCircle,
                "must paint bootstrap Agenda before getCircle returns",
            )
            assertEquals("Fresh", assertIs<FamilyUiModel.State.Ready>(model.state).calendarItems.single().title)
            assertEquals("House", bootstrap.load("1")!!.circle.name)
        }

    @Test
    fun keepsCachedAgendaWhenRevalidateFails() =
        runTest {
            val cache = InMemoryCalendarCacheStore()
            val window = defaultCalendarWindow()
            cache.save(
                CalendarCacheSnapshot(
                    adultId = "1",
                    circleId = "c1",
                    from = window.from,
                    to = window.to,
                    items =
                        listOf(
                            CalendarItem(
                                id = "e1",
                                source = CalendarItemSource.MANUAL,
                                title = "Cached Practice",
                                startsAt = "2030-08-15T17:00:00Z",
                                kidIds = listOf("k1"),
                            ),
                        ),
                    fetchedAt = nowEpochMillis(),
                ),
            )
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
                                content =
                                    """{"id":"c1","name":"House","role":"CAREGIVER","members":[{"adultId":"1","email":"parent@example.com","displayName":"Alex","role":"CAREGIVER"}],"kids":[{"id":"k1","displayName":"Sam"}],"places":[]}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/calendar" ->
                            respond(
                                content = """{"message":"network down"}""",
                                status = HttpStatusCode.BadGateway,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        else -> error("Unexpected ${request.method} ${request.url.encodedPath}")
                    }
                }
            val model = familyUiModel(mockEngine, token = "tok", calendarCache = cache)
            model.load()
            val ready = assertIs<FamilyUiModel.State.Ready>(model.state)
            assertEquals("Cached Practice", ready.calendarItems.single().title)
            assertNotNull(ready.error)
            assertEquals("Cached Practice", cache.load("1", "c1")!!.items.single().title)
        }

    @Test
    fun patchesPersistedCacheOnCoverageMutation() =
        runTest {
            val cache = InMemoryCalendarCacheStore()
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
                                content =
                                    """{"id":"c1","name":"House","role":"ORGANIZER","members":[{"adultId":"1","email":"parent@example.com","displayName":"Alex","role":"ORGANIZER"},{"adultId":"2","email":"other@example.com","displayName":"Jordan","role":"CAREGIVER"}],"kids":[{"id":"k1","displayName":"Sam"}],"places":[]}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/invite" ->
                            respond(
                                content = """{"code":"AB12CD34"}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/feeds" ->
                            respond(
                                content = "[]",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/calendar" &&
                            request.method == HttpMethod.Get ->
                            respond(
                                content =
                                    """[{"id":"e1","source":"MANUAL","title":"Game","startsAt":"2030-08-15T17:00:00Z","kidIds":["k1"],"coverages":[{"id":"cov1","coveringAdultId":"1","coveringAdultDisplayName":"Alex","assignedByAdultId":"2","kidIds":["k1"],"status":"PENDING"}],"uncoveredKidIds":[]}]""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath ==
                            "/api/family/circle/calendar/coverages/cov1/confirm" ->
                            respond(
                                content =
                                    """{"id":"e1","source":"MANUAL","title":"Game","startsAt":"2030-08-15T17:00:00Z","kidIds":["k1"],"coverages":[{"id":"cov1","coveringAdultId":"1","coveringAdultDisplayName":"Alex","assignedByAdultId":"2","kidIds":["k1"],"status":"CONFIRMED"}],"uncoveredKidIds":[]}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        else -> error("Unexpected ${request.method} ${request.url.encodedPath}")
                    }
                }
            val model = familyUiModel(mockEngine, token = "tok", calendarCache = cache)
            model.load()
            assertIs<FamilyUiModel.State.Ready>(model.state)
            assertEquals(CoverageStatus.PENDING, cache.load("1", "c1")!!.items.single().coverages.single().status)

            model.confirmCoverage("cov1")
            assertEquals(
                CoverageStatus.CONFIRMED,
                cache.load("1", "c1")!!.items.single().coverages.single().status,
            )
            // Sign-out hook must not be required to wipe cache; leave-circle clears the key.
            assertNotNull(cache.load("1", "c1"))
        }

    @Test
    fun paintsCachedAgendaAfterSimulatedReSignIn() =
        runTest {
            val cache = InMemoryCalendarCacheStore()
            val window = defaultCalendarWindow()
            cache.save(
                CalendarCacheSnapshot(
                    adultId = "1",
                    circleId = "c1",
                    from = window.from,
                    to = window.to,
                    items =
                        listOf(
                            CalendarItem(
                                id = "e1",
                                source = CalendarItemSource.MANUAL,
                                title = "Cached After Login",
                                startsAt = "2030-08-15T17:00:00Z",
                                kidIds = listOf("k1"),
                            ),
                        ),
                    fetchedAt = nowEpochMillis(),
                ),
            )
            val calendarGate = kotlinx.coroutines.CompletableDeferred<Unit>()
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
                                content =
                                    """{"id":"c1","name":"House","role":"ORGANIZER","members":[{"adultId":"1","email":"parent@example.com","displayName":"Alex","role":"ORGANIZER"}],"kids":[{"id":"k1","displayName":"Sam"}],"places":[]}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/invite" ->
                            respond(
                                content = """{"code":"AB12CD34"}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/feeds" ->
                            respond(
                                content = "[]",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/calendar" -> {
                            calendarGate.await()
                            respond(
                                content =
                                    """[{"id":"e1","source":"MANUAL","title":"Fresh","startsAt":"2030-08-15T17:00:00Z","kidIds":["k1"]}]""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        }
                        else -> error("Unexpected ${request.method} ${request.url.encodedPath}")
                    }
                }
            val model = familyUiModel(mockEngine, token = "tok", calendarCache = cache)
            var sawCachedTitle = false
            model.stateListener = {
                when (val ready = model.state) {
                    is FamilyUiModel.State.Ready -> {
                        if (
                            ready.calendarItems.any { it.title == "Cached After Login" } &&
                                ready.calendarRevalidating &&
                                !calendarGate.isCompleted
                        ) {
                            sawCachedTitle = true
                            calendarGate.complete(Unit)
                        }
                    }
                    else -> Unit
                }
            }
            model.load()
            assertTrue(sawCachedTitle, "re-sign-in must paint cached Agenda before calendar GET")
            assertEquals("Fresh", assertIs<FamilyUiModel.State.Ready>(model.state).calendarItems.single().title)
        }

    @Test
    fun revalidateCalendarIfStaleFetchesOnlyWhenPastSoftTtl() =
        runTest {
            var now = 10_000_000L
            var calendarGets = 0
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
                                content =
                                    """{"id":"c1","name":"House","role":"ORGANIZER","members":[{"adultId":"1","email":"parent@example.com","displayName":"Alex","role":"ORGANIZER"}],"kids":[],"places":[]}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/invite" ->
                            respond(
                                content = """{"code":"AB12CD34"}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/feeds" ->
                            respond(
                                content = "[]",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/calendar" -> {
                            calendarGets++
                            respond(
                                content = "[]",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        }
                        else -> error("Unexpected ${request.method} ${request.url.encodedPath}")
                    }
                }
            val model = familyUiModel(mockEngine, token = "tok", nowMs = { now })
            model.load()
            assertIs<FamilyUiModel.State.Ready>(model.state)
            val afterLoad = calendarGets
            assertTrue(afterLoad >= 1)

            model.selectShellTab(FamilyUiModel.ShellTab.FAMILY)
            model.selectShellTab(FamilyUiModel.ShellTab.CALENDAR)
            model.revalidateCalendarIfStale()
            assertEquals(afterLoad, calendarGets, "fresh cache must not revalidate on tab return")

            now += CALENDAR_CACHE_SOFT_TTL_MS + 1
            model.revalidateCalendarIfStale()
            assertEquals(afterLoad + 1, calendarGets, "stale cache must revalidate on Calendar focus")
        }

    @Test
    fun loadMorePersistsExtendedWindowInCalendarCache() =
        runTest {
            val cache = InMemoryCalendarCacheStore()
            var calendarJson =
                """[{"id":"e1","source":"MANUAL","title":"Near","startsAt":"2030-08-15T17:00:00Z","kidIds":["k1"]}]"""
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
                                content =
                                    """{"id":"c1","name":"House","role":"ORGANIZER","members":[{"adultId":"1","email":"parent@example.com","displayName":"Alex","role":"ORGANIZER"}],"kids":[{"id":"k1","displayName":"Sam"}],"places":[]}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/invite" ->
                            respond(
                                content = """{"code":"AB12CD34"}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/feeds" ->
                            respond(
                                content = "[]",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/calendar" ->
                            respond(
                                content = calendarJson,
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        else -> error("Unexpected ${request.method} ${request.url.encodedPath}")
                    }
                }
            val model = familyUiModel(mockEngine, token = "tok", calendarCache = cache)
            model.load()
            val ready = assertIs<FamilyUiModel.State.Ready>(model.state)
            val beforeTo = ready.calendarLoadedTo
            calendarJson =
                """[{"id":"e2","source":"MANUAL","title":"Later","startsAt":"2030-09-20T17:00:00Z","kidIds":["k1"]}]"""
            model.loadMoreCalendar()
            val after = assertIs<FamilyUiModel.State.Ready>(model.state)
            assertTrue(after.calendarLoadedTo > beforeTo)
            val snap = cache.load("1", "c1")!!
            assertEquals(after.calendarLoadedTo, snap.to)
            assertTrue(snap.items.any { it.title == "Near" })
            assertTrue(snap.items.any { it.title == "Later" })
        }

    @Test
    fun paintsAgendaFromCheapListBeforeLeaveByFillInCompletes() =
        runTest {
            val fillGate = kotlinx.coroutines.CompletableDeferred<Unit>()
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
                                content =
                                    """{"id":"c1","name":"House","role":"ORGANIZER","members":[{"adultId":"1","email":"parent@example.com","displayName":"Alex","role":"ORGANIZER"}],"kids":[{"id":"k1","displayName":"Sam"}],"places":[{"id":"p1","name":"Mom's house","address":"1 Main","latitude":40.1,"longitude":-74.1},{"id":"p2","name":"Dad's house","address":"2 Main","latitude":40.2,"longitude":-74.2}]}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/invite" ->
                            respond(
                                content = """{"code":"AB12CD34"}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/feeds" ->
                            respond(
                                content = "[]",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/calendar" &&
                            request.method == HttpMethod.Get ->
                            respond(
                                content =
                                    """[{"id":"e1","source":"MANUAL","title":"Practice","startsAt":"2030-08-15T17:00:00Z","location":"Rink","kidIds":["k1"],"leaveFromPlaceId":"p1","leaveFromPlaceName":"Mom's house","leaveByStatus":"PENDING","leaveByReason":null}]""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/calendar/leave-by" -> {
                            fillGate.await()
                            respond(
                                content =
                                    """[{"id":"e1","source":"MANUAL","leaveFromPlaceId":"p1","leaveFromPlaceName":"Mom's house","leaveByAt":"2030-08-15T16:30:00Z","leaveByStatus":"OK","leaveByReason":null}]""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        }
                        else -> error("Unexpected ${request.method} ${request.url.encodedPath}")
                    }
                }
            val model = familyUiModel(mockEngine, token = "tok")
            var sawPending = false
            model.stateListener = {
                val ready = model.state as? FamilyUiModel.State.Ready
                val item = ready?.calendarItems?.singleOrNull()
                if (item != null &&
                    item.title == "Practice" &&
                    item.leaveByStatus == LeaveByStatus.PENDING &&
                    !fillGate.isCompleted
                ) {
                    sawPending = true
                    assertEquals(LEAVE_BY_PENDING_LABEL, leaveByAgendaLine(item))
                    fillGate.complete(Unit)
                }
            }
            model.load()
            assertTrue(sawPending, "Agenda rows must be visible while leave-by fill-in is in flight")
            val ready = assertIs<FamilyUiModel.State.Ready>(model.state)
            assertEquals(LeaveByStatus.OK, ready.calendarItems.single().leaveByStatus)
            assertTrue(leaveByAgendaLine(ready.calendarItems.single()).startsWith("Leave by ~"))
        }

    @Test
    fun requestsNearTermLeaveByBeforeLaterLoadedWindow() =
        runTest {
            val leaveByCalls = mutableListOf<Pair<String, String>>()
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
                                content =
                                    """{"id":"c1","name":"House","role":"CAREGIVER","members":[{"adultId":"1","email":"parent@example.com","displayName":"Alex","role":"CAREGIVER"}],"kids":[{"id":"k1","displayName":"Sam"}],"places":[]}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/calendar" &&
                            request.method == HttpMethod.Get ->
                            respond(
                                content =
                                    """[{"id":"e1","source":"MANUAL","title":"Practice","startsAt":"2030-08-15T17:00:00Z","kidIds":["k1"],"leaveByStatus":"PENDING"}]""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/calendar/leave-by" -> {
                            leaveByCalls +=
                                (request.url.parameters["from"]!! to request.url.parameters["to"]!!)
                            respond(
                                content = "[]",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        }
                        else -> error("Unexpected ${request.method} ${request.url.encodedPath}")
                    }
                }
            val model = familyUiModel(mockEngine, token = "tok")
            model.load()
            val loaded = defaultCalendarWindow()
            val near = nearTermLeaveByWindow(loaded.from, loaded.to)!!
            val rest = remainderAfterNearTermLeaveByWindow(loaded.from, loaded.to)!!
            assertTrue(leaveByCalls.size >= 2)
            assertEquals(near.from, leaveByCalls[0].first)
            assertEquals(near.to, leaveByCalls[0].second)
            assertEquals(rest.from, leaveByCalls[1].first)
            assertEquals(rest.to, leaveByCalls[1].second)
        }

    @Test
    fun cheapPendingKeepsCachedOkForSameOriginUntilFillIn() =
        runTest {
            val window = defaultCalendarWindow()
            val cache = InMemoryCalendarCacheStore()
            val bootstrap = InMemoryFamilyBootstrapCache()
            val circle =
                FamilyCircle(
                    id = "c1",
                    name = "House",
                    role = FamilyRole.ORGANIZER,
                    members =
                        listOf(
                            FamilyMember(
                                adultId = "1",
                                email = "parent@example.com",
                                displayName = "Alex",
                                role = FamilyRole.ORGANIZER,
                            ),
                        ),
                    kids = listOf(Kid("k1", "Sam")),
                )
            bootstrap.save(
                FamilyBootstrapSnapshot(
                    adultId = "1",
                    email = "parent@example.com",
                    adultDisplayName = "Alex",
                    circle = circle,
                    inviteCode = "AB12CD34",
                    feeds = emptyList(),
                ),
            )
            cache.save(
                CalendarCacheSnapshot(
                    adultId = "1",
                    circleId = "c1",
                    from = window.from,
                    to = window.to,
                    items =
                        listOf(
                            CalendarItem(
                                id = "e1",
                                source = CalendarItemSource.MANUAL,
                                title = "Practice",
                                startsAt = "2030-08-15T17:00:00Z",
                                kidIds = listOf("k1"),
                                leaveFromPlaceId = "p1",
                                leaveFromPlaceName = "Home",
                                leaveByAt = "2030-08-15T16:30:00Z",
                                leaveByStatus = LeaveByStatus.OK,
                            ),
                        ),
                    fetchedAt = nowEpochMillis(),
                ),
            )
            val fillGate = kotlinx.coroutines.CompletableDeferred<Unit>()
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
                                content =
                                    """{"id":"c1","name":"House","role":"ORGANIZER","members":[{"adultId":"1","email":"parent@example.com","displayName":"Alex","role":"ORGANIZER"}],"kids":[{"id":"k1","displayName":"Sam"}],"places":[]}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/invite" ->
                            respond(
                                content = """{"code":"AB12CD34"}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/feeds" ->
                            respond(
                                content = "[]",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/calendar" &&
                            request.method == HttpMethod.Get ->
                            respond(
                                content =
                                    """[{"id":"e1","source":"MANUAL","title":"Practice","startsAt":"2030-08-15T17:00:00Z","kidIds":["k1"],"leaveFromPlaceId":"p1","leaveFromPlaceName":"Home","leaveByStatus":"PENDING"}]""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/calendar/leave-by" -> {
                            fillGate.await()
                            respond(
                                content =
                                    """[{"id":"e1","source":"MANUAL","leaveFromPlaceId":"p1","leaveFromPlaceName":"Home","leaveByAt":"2030-08-15T16:10:00Z","leaveByStatus":"OK","leaveByReason":null}]""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        }
                        else -> error("Unexpected ${request.method} ${request.url.encodedPath}")
                    }
                }
            val model =
                familyUiModel(
                    mockEngine,
                    token = "tok",
                    calendarCache = cache,
                    bootstrapCache = bootstrap,
                )
            var keptCachedOk = false
            model.stateListener = {
                val ready = model.state as? FamilyUiModel.State.Ready
                val item = ready?.calendarItems?.singleOrNull()
                if (ready != null &&
                    item != null &&
                    item.leaveByStatus == LeaveByStatus.OK &&
                    item.leaveByAt == "2030-08-15T16:30:00Z" &&
                    !fillGate.isCompleted &&
                    !ready.calendarRevalidating
                ) {
                    keptCachedOk = true
                    fillGate.complete(Unit)
                }
            }
            model.load()
            assertTrue(keptCachedOk, "cheap PENDING must not clobber cached OK for the same origin")
            assertEquals(
                "2030-08-15T16:10:00Z",
                assertIs<FamilyUiModel.State.Ready>(model.state).calendarItems.single().leaveByAt,
            )
        }

    @Test
    fun originChangeOnCheapListDropsCachedOkToPending() =
        runTest {
            val window = defaultCalendarWindow()
            val cache = InMemoryCalendarCacheStore()
            val bootstrap = InMemoryFamilyBootstrapCache()
            val circle =
                FamilyCircle(
                    id = "c1",
                    name = "House",
                    role = FamilyRole.CAREGIVER,
                    members =
                        listOf(
                            FamilyMember(
                                adultId = "1",
                                email = "parent@example.com",
                                displayName = "Alex",
                                role = FamilyRole.CAREGIVER,
                            ),
                        ),
                    kids = listOf(Kid("k1", "Sam")),
                )
            bootstrap.save(
                FamilyBootstrapSnapshot(
                    adultId = "1",
                    email = "parent@example.com",
                    adultDisplayName = "Alex",
                    circle = circle,
                    inviteCode = null,
                    feeds = emptyList(),
                ),
            )
            cache.save(
                CalendarCacheSnapshot(
                    adultId = "1",
                    circleId = "c1",
                    from = window.from,
                    to = window.to,
                    items =
                        listOf(
                            CalendarItem(
                                id = "e1",
                                source = CalendarItemSource.MANUAL,
                                title = "Practice",
                                startsAt = "2030-08-15T17:00:00Z",
                                kidIds = listOf("k1"),
                                leaveFromPlaceId = "p1",
                                leaveFromPlaceName = "Home",
                                leaveByAt = "2030-08-15T16:30:00Z",
                                leaveByStatus = LeaveByStatus.OK,
                            ),
                        ),
                    fetchedAt = nowEpochMillis(),
                ),
            )
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
                                content =
                                    """{"id":"c1","name":"House","role":"CAREGIVER","members":[{"adultId":"1","email":"parent@example.com","displayName":"Alex","role":"CAREGIVER"}],"kids":[{"id":"k1","displayName":"Sam"}],"places":[]}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/calendar" &&
                            request.method == HttpMethod.Get ->
                            respond(
                                content =
                                    """[{"id":"e1","source":"MANUAL","title":"Practice","startsAt":"2030-08-15T17:00:00Z","kidIds":["k1"],"leaveFromPlaceId":"p2","leaveFromPlaceName":"Dad's house","leaveByStatus":"PENDING"}]""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        else -> error("Unexpected ${request.method} ${request.url.encodedPath}")
                    }
                }
            val model =
                familyUiModel(
                    mockEngine,
                    token = "tok",
                    calendarCache = cache,
                    bootstrapCache = bootstrap,
                )
            model.load()
            val item = assertIs<FamilyUiModel.State.Ready>(model.state).calendarItems.single()
            assertEquals(LeaveByStatus.PENDING, item.leaveByStatus)
            assertEquals("p2", item.leaveFromPlaceId)
            assertEquals(LEAVE_BY_PENDING_LABEL, leaveByAgendaLine(item))
        }

    @Test
    fun fillInFailureKeepsAgendaRows() =
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
                                content =
                                    """{"id":"c1","name":"House","role":"CAREGIVER","members":[{"adultId":"1","email":"parent@example.com","displayName":"Alex","role":"CAREGIVER"}],"kids":[{"id":"k1","displayName":"Sam"}],"places":[]}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/calendar" &&
                            request.method == HttpMethod.Get ->
                            respond(
                                content =
                                    """[{"id":"e1","source":"MANUAL","title":"Practice","startsAt":"2030-08-15T17:00:00Z","kidIds":["k1"],"leaveByStatus":"PENDING"}]""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/calendar/leave-by" ->
                            respond(
                                content = """{"message":"leave-by down"}""",
                                status = HttpStatusCode.InternalServerError,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        else -> error("Unexpected ${request.method} ${request.url.encodedPath}")
                    }
                }
            val model = familyUiModel(mockEngine, token = "tok")
            model.load()
            val ready = assertIs<FamilyUiModel.State.Ready>(model.state)
            assertEquals("Practice", ready.calendarItems.single().title)
            assertEquals(LeaveByStatus.PENDING, ready.calendarItems.single().leaveByStatus)
            assertNull(ready.error)
        }

    @Test
    fun loadMoreFillsLeaveByForAppendedPageAfterNearTerm() =
        runTest {
            var calendarJson =
                """[{"id":"e1","source":"MANUAL","title":"Near","startsAt":"2030-08-15T17:00:00Z","kidIds":["k1"],"leaveByStatus":"PENDING"}]"""
            val leaveByCalls = mutableListOf<Pair<String, String>>()
            val calendarWindows = mutableListOf<Pair<String, String>>()
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
                                content =
                                    """{"id":"c1","name":"House","role":"CAREGIVER","members":[{"adultId":"1","email":"parent@example.com","displayName":"Alex","role":"CAREGIVER"}],"kids":[{"id":"k1","displayName":"Sam"}],"places":[]}""",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        request.url.encodedPath == "/api/family/circle/calendar" &&
                            request.method == HttpMethod.Get -> {
                            calendarWindows +=
                                (request.url.parameters["from"]!! to request.url.parameters["to"]!!)
                            respond(
                                content = calendarJson,
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        }
                        request.url.encodedPath == "/api/family/circle/calendar/leave-by" -> {
                            leaveByCalls +=
                                (request.url.parameters["from"]!! to request.url.parameters["to"]!!)
                            respond(
                                content = "[]",
                                status = HttpStatusCode.OK,
                                headers = headersOf(HttpHeaders.ContentType, "application/json"),
                            )
                        }
                        else -> error("Unexpected ${request.method} ${request.url.encodedPath}")
                    }
                }
            val model = familyUiModel(mockEngine, token = "tok")
            model.load()
            assertEquals(2, leaveByCalls.size)
            calendarJson =
                """[{"id":"e2","source":"MANUAL","title":"Later","startsAt":"2030-09-20T17:00:00Z","kidIds":["k1"],"leaveByStatus":"PENDING"}]"""
            model.loadMoreCalendar()
            assertEquals(3, leaveByCalls.size)
            assertEquals(calendarWindows[1], leaveByCalls[2])
            assertEquals(
                "Later",
                assertIs<FamilyUiModel.State.Ready>(model.state).calendarItems.last().title,
            )
        }
}

private fun familyUiModel(
    mockEngine: MockEngine,
    token: String,
    calendarCache: CalendarCacheStore = InMemoryCalendarCacheStore(),
    bootstrapCache: FamilyBootstrapCache = InMemoryFamilyBootstrapCache(),
    nowMs: () -> Long = { nowEpochMillis() },
): FamilyUiModel {
    val engine =
        MockEngine { request ->
            if (request.url.encodedPath == "/api/family/circle/calendar/leave-by") {
                val inner = mockEngine.config.requestHandlers.first()
                val handled = runCatching { inner(this, request) }
                if (handled.isSuccess) {
                    handled.getOrThrow()
                } else {
                    respond(
                        content = "[]",
                        status = HttpStatusCode.OK,
                        headers = headersOf(HttpHeaders.ContentType, "application/json"),
                    )
                }
            } else {
                mockEngine.config.requestHandlers.first()(this, request)
            }
        }
    val httpClient =
        HttpClient(engine) {
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
        calendarCache = calendarCache,
        bootstrapCache = bootstrapCache,
        nowMs = nowMs,
        carpoolClient = CarpoolClient("http://localhost:8080", httpClient),
    )
}
