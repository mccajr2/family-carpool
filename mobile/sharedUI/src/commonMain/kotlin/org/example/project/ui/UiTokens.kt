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
        val textSecondary: String,
        val heroSurface: String,
        val heroOn: String,
        val heroOnSecondary: String,
        val heroDanger: String,
        val heroSuccess: String,
        val heroAccent: String
    )

    object Color {
        val light = ColorRoles(
            accent = "#3547E0",
            accentOn = "#FFFFFF",
            danger = "#A9590C",
            dangerOn = "#FFFFFF",
            success = "#187D58",
            successOn = "#FFFFFF",
            surface = "#F6F5F2",
            surfaceRaised = "#FFFFFF",
            border = "#E7E5DF",
            textPrimary = "#16181A",
            textSecondary = "#686F79",
            heroSurface = "#16181A",
            heroOn = "#FFFFFF",
            heroOnSecondary = "#9AA0A8",
            heroDanger = "#F2994A",
            heroSuccess = "#3DCF8E",
            heroAccent = "#5E6DFF"
        )
        val dark = ColorRoles(
            accent = "#5E6DFF",
            accentOn = "#0A0C1A",
            danger = "#F2994A",
            dangerOn = "#1A1206",
            success = "#3DCF8E",
            successOn = "#08170F",
            surface = "#15171A",
            surfaceRaised = "#1E2124",
            border = "#2C3033",
            textPrimary = "#EDEEF0",
            textSecondary = "#9AA0A8",
            heroSurface = "#242832",
            heroOn = "#FFFFFF",
            heroOnSecondary = "#9AA0A8",
            heroDanger = "#F2994A",
            heroSuccess = "#3DCF8E",
            heroAccent = "#5E6DFF"
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
        const val xl: Int = 20
    }

    data class TypeScale(val size: Int, val lineHeight: Int, val weight: String)

    object Type {
        val caption = TypeScale(size = 12, lineHeight = 16, weight = "400")
        val body = TypeScale(size = 15, lineHeight = 22, weight = "400")
        val title = TypeScale(size = 17, lineHeight = 24, weight = "600")
        val headline = TypeScale(size = 22, lineHeight = 28, weight = "700")
        val hero = TypeScale(size = 26, lineHeight = 32, weight = "700")
        const val fontFamily: String = "Plus Jakarta Sans"
    }

    /** Semantic icon names — map to Material Icons / Symbols in UI code. */
    object Icon {
        const val calendar: String = "icon.calendar"
        const val carpool: String = "icon.carpool"
        const val family: String = "icon.family"
        const val more: String = "icon.more"
        const val places: String = "icon.places"
        const val garage: String = "icon.garage"
        const val feeds: String = "icon.feeds"
        const val signout: String = "icon.signout"
        const val add: String = "icon.add"
        const val chevron: String = "icon.chevron"
    }
}
