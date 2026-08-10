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
            assertIs<FamilyUiModel.State.Ready>(model.state)
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

            model.removeEvent("e1")
            val withoutEvent = assertIs<FamilyUiModel.State.Ready>(model.state)
            assertTrue(withoutEvent.calendarItems.isEmpty())
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
            assertNull(assertIs<FamilyUiModel.State.Ready>(model.state).editingEventId)
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
            assertEquals(AppShell.CARPOOL_PLACEHOLDER, "Coming soon")

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
