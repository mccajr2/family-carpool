package org.example.project

import kotlin.test.Test
import kotlin.test.assertEquals

class SharedLogicIOSTest {

    @Test
    fun apiBaseUrlPointsAtLocalhost() {
        assertEquals("http://localhost:8080", apiBaseUrl())
    }
}