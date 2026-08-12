package org.example.project

import kotlin.test.Test
import kotlin.test.assertEquals

class FieldRowContractTest {
    @Test
    fun fieldRowLabelsMatchCoverageContract() {
        assertEquals("Leave from", FieldRowLabels.LEAVE_FROM)
        assertEquals("Covering adult", FieldRowLabels.COVERING_ADULT)
        assertEquals("My default leave-from", FieldRowLabels.DEFAULT_LEAVE_FROM)
    }
}
