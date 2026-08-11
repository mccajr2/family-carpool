// Generated from design-tokens/tokens.json — do not edit by hand. Run: node design-tokens/generate.mjs
package org.example.project.ui

/** Shared design tokens (light / dark color roles, spacing, radius, type, icons). */
object UiTokens {
    data class ColorRoles(
        val accent: String,
        val accentOn: String,
        val danger: String,
        val dangerOn: String,
        val success: String,
        val successOn: String,
        val surface: String,
        val surfaceRaised: String,
        val border: String,
        val textPrimary: String,
        val textSecondary: String
    )

    object Color {
        val light = ColorRoles(
            accent = "#0D6E6E",
            accentOn = "#FFFFFF",
            danger = "#B42318",
            dangerOn = "#FFFFFF",
            success = "#1B7A4E",
            successOn = "#FFFFFF",
            surface = "#F4F7F6",
            surfaceRaised = "#FFFFFF",
            border = "#D5DEDA",
            textPrimary = "#1A2421",
            textSecondary = "#5A6B66"
        )
        val dark = ColorRoles(
            accent = "#3DB8B0",
            accentOn = "#0A1A18",
            danger = "#F97066",
            dangerOn = "#1A0A08",
            success = "#3DCF8E",
            successOn = "#0A1A12",
            surface = "#121A18",
            surfaceRaised = "#1C2623",
            border = "#2E3B37",
            textPrimary = "#E8EFEC",
            textSecondary = "#9AABA5"
        )
    }

    object Space {
        const val xs: Int = 4
        const val sm: Int = 8
        const val md: Int = 12
        const val lg: Int = 16
        const val xl: Int = 24
        const val _2xl: Int = 32
    }

    object Radius {
        const val sm: Int = 4
        const val md: Int = 8
        const val lg: Int = 12
    }

    data class TypeScale(val size: Int, val lineHeight: Int, val weight: String)

    object Type {
        val caption = TypeScale(size = 12, lineHeight = 16, weight = "400")
        val body = TypeScale(size = 15, lineHeight = 22, weight = "400")
        val title = TypeScale(size = 17, lineHeight = 24, weight = "600")
        val headline = TypeScale(size = 22, lineHeight = 28, weight = "700")
        const val fontFamily: String = "system-ui"
    }

    /** Semantic icon names — map to Material Icons / Symbols in UI code. */
    object Icon {
        const val calendar: String = "icon.calendar"
        const val carpool: String = "icon.carpool"
        const val family: String = "icon.family"
        const val more: String = "icon.more"
        const val places: String = "icon.places"
        const val feeds: String = "icon.feeds"
        const val signout: String = "icon.signout"
        const val add: String = "icon.add"
        const val chevron: String = "icon.chevron"
    }
}
