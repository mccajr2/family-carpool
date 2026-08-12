package org.example.project

import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.plugins.pluginOrNull
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

class SharedLogicAndroidHostTest {

    @Test
    fun apiBaseUrlPointsAtAdbReverseLoopback() {
        assertEquals("http://127.0.0.1:8080", apiBaseUrl())
    }

    @Test
    fun createHttpClientUsesExtendedTimeoutsForCalendarEnrichment() {
        // OkHttp defaults (~10s) abort Agenda while leave-by enrichment still runs.
        assertEquals(120_000L, ApiHttpTimeouts.REQUEST_MS)
        assertEquals(120_000L, ApiHttpTimeouts.SOCKET_MS)
        val client = createHttpClient()
        assertNotNull(client.pluginOrNull(HttpTimeout))
    }

    @Test
    fun connectivityMessageMentionsAdbReverse() {
        val message = connectivityMessage("http://127.0.0.1:8080", RuntimeException("Connect timeout"))
        assertTrue(message.contains("adb reverse tcp:8080 tcp:8080"))
        assertTrue(message.contains("http://127.0.0.1:8080"))
    }
}
