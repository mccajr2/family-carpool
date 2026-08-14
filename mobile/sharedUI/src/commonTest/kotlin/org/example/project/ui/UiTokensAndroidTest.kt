package org.example.project.ui

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class UiTokensAndroidTest {
    @Test
    fun parsesHexColorsFromTokens() {
        val accent = fcColor(UiTokens.Color.light.accent)
        assertEquals(0x0D / 255f, accent.red, absoluteTolerance = 0.001f)
        assertEquals(0x6E / 255f, accent.green, absoluteTolerance = 0.001f)
        assertEquals(0x6E / 255f, accent.blue, absoluteTolerance = 0.001f)
    }

    @Test
    fun mapsSemanticIconsToMaterialStyleVectors() {
        assertEquals("Place", UiIcons.materialIconName(UiTokens.Icon.places))
        assertEquals("RssFeed", UiIcons.materialIconName(UiTokens.Icon.feeds))
        assertEquals("ExitToApp", UiIcons.materialIconName(UiTokens.Icon.signout))
        assertEquals("Place", UiIcons.imageVector(UiTokens.Icon.places).name)
        assertEquals("RssFeed", UiIcons.imageVector(UiTokens.Icon.feeds).name)
        // Shell tabs map through the same semantic → Material vector table.
        assertEquals("DateRange", UiIcons.imageVector(UiTokens.Icon.calendar).name)
        assertEquals("DirectionsCar", UiIcons.imageVector(UiTokens.Icon.carpool).name)
        assertEquals("People", UiIcons.imageVector(UiTokens.Icon.family).name)
        assertEquals("DirectionsCar", UiIcons.materialIconName("icon.garage"))
        assertEquals("DirectionsCar", UiIcons.imageVector("icon.garage").name)
    }

    @Test
    fun rejectsUnknownSemanticIcon() {
        assertFailsWith<IllegalStateException> {
            UiIcons.imageVector("icon.unknown")
        }
    }

    @Test
    fun lightAndDarkSchemesUseTokenRoles() {
        val light = UiTokens.Color.light.toLightScheme()
        val dark = UiTokens.Color.dark.toDarkScheme()
        assertEquals(fcColor(UiTokens.Color.light.accent), light.primary)
        assertEquals(fcColor(UiTokens.Color.dark.accent), dark.primary)
        assertEquals(fcColor(UiTokens.Color.light.danger), light.error)
        assertEquals(fcColor(UiTokens.Color.dark.textPrimary), dark.onSurface)
    }
}
