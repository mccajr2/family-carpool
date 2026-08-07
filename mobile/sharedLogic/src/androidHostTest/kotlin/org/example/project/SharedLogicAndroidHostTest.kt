package org.example.project

import kotlin.test.Test
import kotlin.test.assertEquals

class SharedLogicAndroidHostTest {

    @Test
    fun apiBaseUrlPointsAtEmulatorHostLoopback() {
        assertEquals("http://10.0.2.2:8080", apiBaseUrl())
    }
}