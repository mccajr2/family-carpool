package org.example.project.ui

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.path
import androidx.compose.ui.unit.dp

/**
 * Maps semantic icon token names to Material-style vector icons (inlined paths).
 * JetBrains `material-icons-*` artifacts are not published for this CMP version,
 * so paths follow Material Icons shapes without a shared asset pack.
 * See docs/ui-system.md.
 */
object UiIcons {
    fun imageVector(semanticName: String): ImageVector =
        when (semanticName) {
            UiTokens.Icon.calendar -> MaterialVectors.dateRange
            UiTokens.Icon.carpool -> MaterialVectors.directionsCar
            UiTokens.Icon.family -> MaterialVectors.people
            UiTokens.Icon.more -> MaterialVectors.moreHoriz
            UiTokens.Icon.places -> MaterialVectors.place
            UiTokens.Icon.feeds -> MaterialVectors.rssFeed
            UiTokens.Icon.signout -> MaterialVectors.exitToApp
            UiTokens.Icon.add -> MaterialVectors.add
            UiTokens.Icon.chevron -> MaterialVectors.chevronRight
            else -> error("Unknown semantic icon: $semanticName")
        }

    /** Documented Material Icons name for each semantic token (parity with ui-system.md). */
    fun materialIconName(semanticName: String): String =
        when (semanticName) {
            UiTokens.Icon.calendar -> "DateRange"
            UiTokens.Icon.carpool -> "DirectionsCar"
            UiTokens.Icon.family -> "People"
            UiTokens.Icon.more -> "MoreHoriz"
            UiTokens.Icon.places -> "Place"
            UiTokens.Icon.feeds -> "RssFeed"
            UiTokens.Icon.signout -> "ExitToApp"
            UiTokens.Icon.add -> "Add"
            UiTokens.Icon.chevron -> "KeyboardArrowRight"
            else -> error("Unknown semantic icon: $semanticName")
        }
}

private object MaterialVectors {
    val place: ImageVector by lazy {
        materialIcon("Place") {
            path(fill = SolidColor(Color.Black)) {
                moveTo(12f, 2f)
                curveTo(8.13f, 2f, 5f, 5.13f, 5f, 9f)
                curveToRelative(0f, 5.25f, 7f, 13f, 7f, 13f)
                reflectiveCurveToRelative(7f, -7.75f, 7f, -13f)
                curveToRelative(0f, -3.87f, -3.13f, -7f, -7f, -7f)
                close()
                moveTo(12f, 11.5f)
                curveToRelative(-1.38f, 0f, -2.5f, -1.12f, -2.5f, -2.5f)
                reflectiveCurveToRelative(1.12f, -2.5f, 2.5f, -2.5f)
                reflectiveCurveToRelative(2.5f, 1.12f, 2.5f, 2.5f)
                reflectiveCurveToRelative(-1.12f, 2.5f, -2.5f, 2.5f)
                close()
            }
        }
    }

    val rssFeed: ImageVector by lazy {
        materialIcon("RssFeed") {
            path(fill = SolidColor(Color.Black)) {
                moveTo(6.18f, 15.64f)
                arcToRelative(2.18f, 2.18f, 0f, true, true, 0f, 4.36f)
                arcToRelative(2.18f, 2.18f, 0f, true, true, 0f, -4.36f)
                close()
                moveTo(4f, 4.44f)
                verticalLineToRelative(2.83f)
                curveToRelative(7.03f, 0f, 12.73f, 5.7f, 12.73f, 12.73f)
                horizontalLineToRelative(2.83f)
                curveToRelative(0f, -8.59f, -6.97f, -15.56f, -15.56f, -15.56f)
                close()
                moveTo(4f, 10.1f)
                verticalLineToRelative(2.83f)
                curveToRelative(3.9f, 0f, 7.07f, 3.17f, 7.07f, 7.07f)
                horizontalLineToRelative(2.83f)
                curveToRelative(0f, -5.47f, -4.43f, -9.9f, -9.9f, -9.9f)
                close()
            }
        }
    }

    val exitToApp: ImageVector by lazy {
        materialIcon("ExitToApp") {
            path(fill = SolidColor(Color.Black)) {
                moveTo(10.09f, 15.59f)
                lineTo(11.5f, 17f)
                lineToRelative(5f, -5f)
                lineToRelative(-5f, -5f)
                lineToRelative(-1.41f, 1.41f)
                lineTo(12.67f, 11f)
                horizontalLineTo(3f)
                verticalLineToRelative(2f)
                horizontalLineToRelative(9.67f)
                lineToRelative(-2.58f, 2.59f)
                close()
                moveTo(19f, 3f)
                horizontalLineTo(5f)
                curveToRelative(-1.11f, 0f, -2f, 0.9f, -2f, 2f)
                verticalLineToRelative(4f)
                horizontalLineToRelative(2f)
                verticalLineTo(5f)
                horizontalLineToRelative(14f)
                verticalLineToRelative(14f)
                horizontalLineTo(5f)
                verticalLineToRelative(-4f)
                horizontalLineTo(3f)
                verticalLineToRelative(4f)
                curveToRelative(0f, 1.1f, 0.89f, 2f, 2f, 2f)
                horizontalLineToRelative(14f)
                curveToRelative(1.1f, 0f, 2f, -0.9f, 2f, -2f)
                verticalLineTo(5f)
                curveToRelative(0f, -1.1f, -0.9f, -2f, -2f, -2f)
                close()
            }
        }
    }

    val people: ImageVector by lazy {
        materialIcon("People") {
            path(fill = SolidColor(Color.Black)) {
                moveTo(16f, 11f)
                curveToRelative(1.66f, 0f, 2.99f, -1.34f, 2.99f, -3f)
                reflectiveCurveTo(17.66f, 5f, 16f, 5f)
                curveToRelative(-1.66f, 0f, -3f, 1.34f, -3f, 3f)
                reflectiveCurveToRelative(1.34f, 3f, 3f, 3f)
                close()
                moveTo(8f, 11f)
                curveToRelative(1.66f, 0f, 2.99f, -1.34f, 2.99f, -3f)
                reflectiveCurveTo(9.66f, 5f, 8f, 5f)
                curveTo(6.34f, 5f, 5f, 6.34f, 5f, 8f)
                reflectiveCurveToRelative(1.34f, 3f, 3f, 3f)
                close()
                moveTo(8f, 13f)
                curveToRelative(-2.33f, 0f, -7f, 1.17f, -7f, 3.5f)
                verticalLineTo(19f)
                horizontalLineToRelative(14f)
                verticalLineToRelative(-2.5f)
                curveToRelative(0f, -2.33f, -4.67f, -3.5f, -7f, -3.5f)
                close()
                moveTo(16f, 13f)
                curveToRelative(-0.29f, 0f, -0.62f, 0.02f, -0.97f, 0.05f)
                curveToRelative(1.16f, 0.84f, 1.97f, 1.97f, 1.97f, 3.45f)
                verticalLineTo(19f)
                horizontalLineToRelative(6f)
                verticalLineToRelative(-2.5f)
                curveToRelative(0f, -2.33f, -4.67f, -3.5f, -7f, -3.5f)
                close()
            }
        }
    }

    val chevronRight: ImageVector by lazy {
        materialIcon("ChevronRight") {
            path(fill = SolidColor(Color.Black)) {
                moveTo(10f, 6f)
                lineTo(8.59f, 7.41f)
                lineTo(13.17f, 12f)
                lineToRelative(-4.58f, 4.59f)
                lineTo(10f, 18f)
                lineToRelative(6f, -6f)
                close()
            }
        }
    }

    val add: ImageVector by lazy {
        materialIcon("Add") {
            path(fill = SolidColor(Color.Black)) {
                moveTo(19f, 13f)
                horizontalLineToRelative(-6f)
                verticalLineToRelative(6f)
                horizontalLineToRelative(-2f)
                verticalLineToRelative(-6f)
                horizontalLineTo(5f)
                verticalLineToRelative(-2f)
                horizontalLineToRelative(6f)
                verticalLineTo(5f)
                horizontalLineToRelative(2f)
                verticalLineToRelative(6f)
                horizontalLineToRelative(6f)
                verticalLineToRelative(2f)
                close()
            }
        }
    }

    val dateRange: ImageVector by lazy {
        materialIcon("DateRange") {
            path(fill = SolidColor(Color.Black)) {
                moveTo(9f, 11f)
                horizontalLineTo(7f)
                verticalLineToRelative(2f)
                horizontalLineToRelative(2f)
                verticalLineToRelative(-2f)
                close()
                moveTo(13f, 11f)
                horizontalLineToRelative(-2f)
                verticalLineToRelative(2f)
                horizontalLineToRelative(2f)
                verticalLineToRelative(-2f)
                close()
                moveTo(17f, 11f)
                horizontalLineToRelative(-2f)
                verticalLineToRelative(2f)
                horizontalLineToRelative(2f)
                verticalLineToRelative(-2f)
                close()
                moveTo(19f, 4f)
                horizontalLineToRelative(-1f)
                verticalLineTo(2f)
                horizontalLineToRelative(-2f)
                verticalLineToRelative(2f)
                horizontalLineTo(8f)
                verticalLineTo(2f)
                horizontalLineTo(6f)
                verticalLineToRelative(2f)
                horizontalLineTo(5f)
                curveToRelative(-1.11f, 0f, -1.99f, 0.9f, -1.99f, 2f)
                lineTo(3f, 20f)
                curveToRelative(0f, 1.1f, 0.89f, 2f, 2f, 2f)
                horizontalLineToRelative(14f)
                curveToRelative(1.1f, 0f, 2f, -0.9f, 2f, -2f)
                verticalLineTo(6f)
                curveToRelative(0f, -1.1f, -0.9f, -2f, -2f, -2f)
                close()
                moveTo(19f, 20f)
                horizontalLineTo(5f)
                verticalLineTo(9f)
                horizontalLineToRelative(14f)
                verticalLineToRelative(11f)
                close()
            }
        }
    }

    val directionsCar: ImageVector by lazy {
        materialIcon("DirectionsCar") {
            path(fill = SolidColor(Color.Black)) {
                moveTo(18.92f, 6.01f)
                curveTo(18.72f, 5.42f, 18.16f, 5f, 17.5f, 5f)
                horizontalLineToRelative(-11f)
                curveToRelative(-0.66f, 0f, -1.21f, 0.42f, -1.42f, 1.01f)
                lineTo(3f, 12f)
                verticalLineToRelative(8f)
                curveToRelative(0f, 0.55f, 0.45f, 1f, 1f, 1f)
                horizontalLineToRelative(1f)
                curveToRelative(0.55f, 0f, 1f, -0.45f, 1f, -1f)
                verticalLineToRelative(-1f)
                horizontalLineToRelative(12f)
                verticalLineToRelative(1f)
                curveToRelative(0f, 0.55f, 0.45f, 1f, 1f, 1f)
                horizontalLineToRelative(1f)
                curveToRelative(0.55f, 0f, 1f, -0.45f, 1f, -1f)
                verticalLineToRelative(-8f)
                lineToRelative(-2.08f, -5.99f)
                close()
                moveTo(6.5f, 16f)
                curveToRelative(-0.83f, 0f, -1.5f, -0.67f, -1.5f, -1.5f)
                reflectiveCurveTo(5.67f, 13f, 6.5f, 13f)
                reflectiveCurveToRelative(1.5f, 0.67f, 1.5f, 1.5f)
                reflectiveCurveTo(7.33f, 16f, 6.5f, 16f)
                close()
                moveTo(17.5f, 16f)
                curveToRelative(-0.83f, 0f, -1.5f, -0.67f, -1.5f, -1.5f)
                reflectiveCurveToRelative(0.67f, -1.5f, 1.5f, -1.5f)
                reflectiveCurveToRelative(1.5f, 0.67f, 1.5f, 1.5f)
                reflectiveCurveToRelative(-0.67f, 1.5f, -1.5f, 1.5f)
                close()
                moveTo(5f, 11f)
                lineToRelative(1.5f, -4.5f)
                horizontalLineToRelative(11f)
                lineTo(19f, 11f)
                horizontalLineTo(5f)
                close()
            }
        }
    }

    val moreHoriz: ImageVector by lazy {
        materialIcon("MoreHoriz") {
            path(fill = SolidColor(Color.Black)) {
                moveTo(6f, 10f)
                curveToRelative(-1.1f, 0f, -2f, 0.9f, -2f, 2f)
                reflectiveCurveToRelative(0.9f, 2f, 2f, 2f)
                reflectiveCurveToRelative(2f, -0.9f, 2f, -2f)
                reflectiveCurveToRelative(-0.9f, -2f, -2f, -2f)
                close()
                moveTo(18f, 10f)
                curveToRelative(-1.1f, 0f, -2f, 0.9f, -2f, 2f)
                reflectiveCurveToRelative(0.9f, 2f, 2f, 2f)
                reflectiveCurveToRelative(2f, -0.9f, 2f, -2f)
                reflectiveCurveToRelative(-0.9f, -2f, -2f, -2f)
                close()
                moveTo(12f, 10f)
                curveToRelative(-1.1f, 0f, -2f, 0.9f, -2f, 2f)
                reflectiveCurveToRelative(0.9f, 2f, 2f, 2f)
                reflectiveCurveToRelative(2f, -0.9f, 2f, -2f)
                reflectiveCurveToRelative(-0.9f, -2f, -2f, -2f)
                close()
            }
        }
    }
}

private fun materialIcon(
    name: String,
    block: ImageVector.Builder.() -> Unit,
): ImageVector =
    ImageVector.Builder(
        defaultWidth = 24.dp,
        defaultHeight = 24.dp,
        viewportWidth = 24f,
        viewportHeight = 24f,
        name = name,
    ).apply(block).build()
