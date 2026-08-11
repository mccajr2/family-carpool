package org.example.project.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

fun fcColor(hex: String): Color {
    val cleaned = hex.removePrefix("#")
    require(cleaned.length == 6) { "Expected RRGGBB hex, got $hex" }
    val value = cleaned.toLong(16)
    return Color(
        red = ((value shr 16) and 0xFF) / 255f,
        green = ((value shr 8) and 0xFF) / 255f,
        blue = (value and 0xFF) / 255f,
        alpha = 1f,
    )
}

fun UiTokens.ColorRoles.toLightScheme() =
    lightColorScheme(
        primary = fcColor(accent),
        onPrimary = fcColor(accentOn),
        secondary = fcColor(accent).copy(alpha = 0.7f),
        onSecondary = fcColor(accentOn),
        error = fcColor(danger),
        onError = fcColor(dangerOn),
        background = fcColor(surface),
        onBackground = fcColor(textPrimary),
        surface = fcColor(surfaceRaised),
        onSurface = fcColor(textPrimary),
        onSurfaceVariant = fcColor(textSecondary),
        outline = fcColor(border),
    )

fun UiTokens.ColorRoles.toDarkScheme() =
    darkColorScheme(
        primary = fcColor(accent),
        onPrimary = fcColor(accentOn),
        secondary = fcColor(accent).copy(alpha = 0.85f),
        onSecondary = fcColor(accentOn),
        error = fcColor(danger),
        onError = fcColor(dangerOn),
        background = fcColor(surface),
        onBackground = fcColor(textPrimary),
        surface = fcColor(surfaceRaised),
        onSurface = fcColor(textPrimary),
        onSurfaceVariant = fcColor(textSecondary),
        outline = fcColor(border),
    )

val FcSpaceXs = UiTokens.Space.xs.dp
val FcSpaceSm = UiTokens.Space.sm.dp
val FcSpaceMd = UiTokens.Space.md.dp
val FcSpaceLg = UiTokens.Space.lg.dp
val FcRadiusMd = UiTokens.Radius.md.dp
val FcRadiusLg = UiTokens.Radius.lg.dp

private val fcTypography =
    Typography(
        headlineSmall =
            TextStyle(
                fontSize = UiTokens.Type.headline.size.sp,
                lineHeight = UiTokens.Type.headline.lineHeight.sp,
                fontWeight = FontWeight.Bold,
            ),
        titleSmall =
            TextStyle(
                fontSize = UiTokens.Type.title.size.sp,
                lineHeight = UiTokens.Type.title.lineHeight.sp,
                fontWeight = FontWeight.SemiBold,
            ),
        bodyLarge =
            TextStyle(
                fontSize = UiTokens.Type.body.size.sp,
                lineHeight = UiTokens.Type.body.lineHeight.sp,
                fontWeight = FontWeight.Normal,
            ),
        bodyMedium =
            TextStyle(
                fontSize = UiTokens.Type.body.size.sp,
                lineHeight = UiTokens.Type.body.lineHeight.sp,
                fontWeight = FontWeight.Normal,
            ),
        labelLarge =
            TextStyle(
                fontSize = UiTokens.Type.caption.size.sp,
                lineHeight = UiTokens.Type.caption.lineHeight.sp,
                fontWeight = FontWeight.SemiBold,
            ),
    )

/** Material3 theme driven by shared design tokens (More reference surface). */
@Composable
fun FcTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    val roles = if (darkTheme) UiTokens.Color.dark else UiTokens.Color.light
    MaterialTheme(
        colorScheme = if (darkTheme) roles.toDarkScheme() else roles.toLightScheme(),
        typography = fcTypography,
        content = content,
    )
}
