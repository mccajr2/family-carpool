package org.example.project

import java.io.File
import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/** Source-level lock for Garage UI (mirrors iosApp/scripts/garage_display_test.swift). */
class GarageContractTest {
    @Test
    fun familyScreenGarageHasNoVinAndOwnerOnlyEdit() {
        val source = familyScreenSource()
        val garage =
            source.substringAfter("private fun GarageDestination").substringBefore("\nprivate fun ")
        assertFalse(garage.contains("VIN"), "Garage destination has no VIN field")
        assertTrue(source.contains("I don’t drive"), "Garage has don't-drive toggle")
        assertTrue(source.contains("Add vehicle"), "Garage has Add vehicle")
        assertTrue(source.contains("Who can drive this?"), "Garage has who-can-drive")
        assertTrue(source.contains("Seats (including driver)"), "Garage seats include driver")
        assertTrue(source.contains("if (drives && draft == null)"), "don't-drive hides Add vehicle")
        assertTrue(
            source.contains("if (owned && draft == null)"),
            "edit/delete only when signed-in adult owns the vehicle",
        )
        assertTrue(source.contains("ROW_GARAGE"), "More has Garage row")
    }

    private fun familyScreenSource(): String {
        val startDir = File(System.getProperty("user.dir") ?: error("user.dir is not set"))
        val sharedUiRoot =
            generateSequence(startDir) { it.parentFile }
                .first {
                    File(it, "src/commonMain/kotlin/org/example/project/FamilyScreen.kt").isFile
                }
        return File(sharedUiRoot, "src/commonMain/kotlin/org/example/project/FamilyScreen.kt")
            .readText()
    }
}
