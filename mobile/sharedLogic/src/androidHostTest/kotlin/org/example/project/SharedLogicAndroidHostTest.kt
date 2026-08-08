package org.example.project

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class SharedLogicAndroidHostTest {

    @Test
    fun apiBaseUrlPointsAtAdbReverseLoopback() {
        assertEquals("http://127.0.0.1:8080", apiBaseUrl())
    }

    @Test
    fun connectivityMessageMentionsAdbReverse() {
        val message = connectivityMessage("http://127.0.0.1:8080", RuntimeException("Connect timeout"))
        assertTrue(message.contains("adb reverse tcp:8080 tcp:8080"))
        assertTrue(message.contains("http://127.0.0.1:8080"))
    }
}
