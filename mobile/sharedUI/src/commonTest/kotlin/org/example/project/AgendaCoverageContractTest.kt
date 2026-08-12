package org.example.project

import java.io.File
import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue
import org.example.project.ui.FcSpace2xl
import org.example.project.ui.FcSpaceMd
import org.example.project.ui.FcSpaceXl
import org.example.project.ui.UiTokens

/**
 * Source-level lock for Android Agenda parity with
 * docs/agenda-coverage-web-contract.md (mirrors iOS coverage_display_test.swift).
 */
class AgendaCoverageContractTest {
    @Test
    fun busyLabelsMatchContractCopy() {
        assertTrue(AppShell.BUSY_SAVING == "Saving…")
        assertTrue(AppShell.BUSY_LOADING == "Loading…")
        assertTrue(AppShell.ROW_SIGN_OUT == "Sign out")
    }

    @Test
    fun agendaSpacingTokensMatchWebContract() {
        assertTrue(UiTokens.Space.xl == 24)
        assertTrue(UiTokens.Space._2xl == 32)
        assertTrue(UiTokens.Space.md == 12)
        // Compose aliases must resolve (compile-time used by FamilyScreen).
        assertTrue(FcSpaceXl.value > 0f)
        assertTrue(FcSpace2xl.value > 0f)
        assertTrue(FcSpaceMd.value > 0f)
    }

    @Test
    fun familyScreenMatchesAgendaCoverageContract() {
        val source = familyScreenSource()
        assertTrue(source.contains("agendaListBusy"), "empty Agenda copy suppressed while busy")
        assertTrue(
            source.contains("No events in the loaded window."),
            "idle empty-window copy kept",
        )
        assertTrue(source.contains("FcSpaceXl"), "Agenda section uses xl spacing")
        assertTrue(source.contains("FcSpace2xl"), "Agenda items use 2xl list gap")
        assertTrue(source.contains("FcSpaceMd"), "Agenda list has md top padding")
        assertTrue(source.contains("AppShell.BUSY_SAVING"), "compose Save uses Saving…")
        assertTrue(source.contains("AppShell.BUSY_LOADING"), "Load more uses Loading…")
        assertTrue(
            source.contains("stateListener"),
            "FamilyScreen must observe mid-request loading via stateListener",
        )
        assertTrue(
            source.contains("AppShell.ROW_SIGN_OUT"),
            "More Sign out stays Sign out",
        )
        assertFalse(source.contains("Working…"), "Sign out must never become Working…")
        assertFalse(
            source.contains("Edit location"),
            "manual rows must not show Edit location",
        )
        assertTrue(
            source.contains("Toggling kids must not clear the covering-adult default"),
            "kid toggle preserves covering adult default",
        )
        assertTrue(source.contains("FieldRowLabels.LEAVE_FROM"), "Leave from field row")
        assertTrue(source.contains("FieldRowLabels.COVERING_ADULT"), "Covering adult field row")
        assertTrue(
            source.contains("FieldRowLabels.DEFAULT_LEAVE_FROM"),
            "default leave-from field row",
        )
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
