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
        val heroAccent: String,
        val railSurface: String,
        val railOn: String,
        val railOnSecondary: String,
        val railActive: String,
        val railAccent: String,
        val railDanger: String
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
            heroAccent = "#5E6DFF",
            railSurface = "#16181A",
            railOn = "#FFFFFF",
            railOnSecondary = "#9AA0A8",
            railActive = "#242832",
            railAccent = "#5E6DFF",
            railDanger = "#F2994A"
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
            heroAccent = "#5E6DFF",
            railSurface = "#16181A",
            railOn = "#FFFFFF",
            railOnSecondary = "#9AA0A8",
            railActive = "#242832",
            railAccent = "#5E6DFF",
            railDanger = "#F2994A"
        )
    }

    object Space {
        const val xs: Int = 4
        const val sm: Int = 8
        const val md: Int = 12
        const val lg: Int = 16
        const val xl: Int = 24
        const val _2xl: Int = 32
        const val header: Int = 26
        const val mainY: Int = 36
        const val mainX: Int = 44
        const val railY: Int = 28
        const val railX: Int = 20
        const val focusRing: Int = 88
        const val focusRingStroke: Int = 6
        const val focusRingCoveringGap: Int = 10
        const val focusTitleGap: Int = 6
        const val focusStatusDot: Int = 6
        const val focusStatusPillY: Int = 6
        const val focusCoveringPadY: Int = 7
        const val focusActionsGap: Int = 18
        const val filterChipGap: Int = 8
        const val filterChipPadY: Int = 9
        const val filterChipPadX: Int = 16
        const val filterChipMarginBottom: Int = 28
        const val listRowGap: Int = 16
        const val listRowTagGap: Int = 6
        const val listRowAvatar: Int = 26
        const val listRowAvatarBorder: Int = 2
        const val listRowAvatarOverlap: Int = 8
        const val feedCardPadY: Int = 18
        const val feedCardPadX: Int = 20
        const val feedListGap: Int = 12
        const val feedListMarginBottom: Int = 28
        const val feedMetaGap: Int = 3
        const val feedMetaDot: Int = 6
        const val feedChipPadY: Int = 4
        const val feedChipPadX: Int = 10
        const val feedActionsPadTop: Int = 14
        const val feedActionsGap: Int = 16
        const val feedCtaGap: Int = 10
        const val feedQuietGap: Int = 8
        const val feedActionPadY: Int = 10
        const val feedActionPadX: Int = 16
        const val feedSectionGap: Int = 14
        const val feedFormPad: Int = 22
        const val feedFieldLabelGap: Int = 6
        const val feedInputPadY: Int = 11
        const val feedInputPadX: Int = 14
        const val feedKidChipPadY: Int = 9
        const val feedKidChipPadX: Int = 14
        const val feedKidChipGap: Int = 7
        const val feedKidChipsGap: Int = 8
        const val feedSubmitPadY: Int = 13
        const val feedSubmitMarginTop: Int = 6
        const val weekGlancePadX: Int = 28
        const val weekItemPadY: Int = 10
        const val weekDayWidth: Int = 38
        const val weekFlag: Int = 7
    }

    object Radius {
        const val sm: Int = 4
        const val md: Int = 8
        const val lg: Int = 12
        const val xl: Int = 20
    }

    data class TypeScale(val size: Float, val lineHeight: Float, val weight: String)

    object Type {
        val caption = TypeScale(size = 12f, lineHeight = 16f, weight = "400")
        val body = TypeScale(size = 15f, lineHeight = 22f, weight = "400")
        val title = TypeScale(size = 17f, lineHeight = 24f, weight = "600")
        val headline = TypeScale(size = 22f, lineHeight = 28f, weight = "700")
        val hero = TypeScale(size = 26f, lineHeight = 32f, weight = "700")
        val focusWhen = TypeScale(size = 15f, lineHeight = 20f, weight = "600")
        val focusTitle = TypeScale(size = 30f, lineHeight = 36f, weight = "700")
        val focusRingLabel = TypeScale(size = 16f, lineHeight = 20f, weight = "700")
        val focusRingUnit = TypeScale(size = 9.5f, lineHeight = 12f, weight = "600")
        val focusStatusPill = TypeScale(size = 12.5f, lineHeight = 16f, weight = "600")
        val focusCovering = TypeScale(size = 12.5f, lineHeight = 16f, weight = "600")
        val focusAction = TypeScale(size = 13.5f, lineHeight = 18f, weight = "700")
        val focusActionGhost = TypeScale(size = 13.5f, lineHeight = 18f, weight = "600")
        val statusChip = TypeScale(size = 11f, lineHeight = 14f, weight = "700")
        val filterChip = TypeScale(size = 13.5f, lineHeight = 18f, weight = "600")
        val listRowAvatarLabel = TypeScale(size = 10.5f, lineHeight = 14f, weight = "700")
        val listRowChevron = TypeScale(size = 18f, lineHeight = 18f, weight = "400")
        val page = TypeScale(size = 34f, lineHeight = 40f, weight = "700")
        val subtitle = TypeScale(size = 14f, lineHeight = 20f, weight = "500")
        val feedName = TypeScale(size = 16.5f, lineHeight = 22f, weight = "700")
        val feedMeta = TypeScale(size = 12.5f, lineHeight = 16f, weight = "400")
        val feedSectionLabel = TypeScale(size = 12f, lineHeight = 16f, weight = "700")
        val feedChip = TypeScale(size = 11f, lineHeight = 14f, weight = "700")
        val feedAction = TypeScale(size = 13.5f, lineHeight = 18f, weight = "700")
        val feedFieldLabel = TypeScale(size = 12.5f, lineHeight = 16f, weight = "600")
        val feedInput = TypeScale(size = 14f, lineHeight = 20f, weight = "400")
        val feedKidChip = TypeScale(size = 13.5f, lineHeight = 18f, weight = "600")
        val feedSubmit = TypeScale(size = 14.5f, lineHeight = 20f, weight = "700")
        val weekGlanceTitle = TypeScale(size = 16f, lineHeight = 20f, weight = "700")
        val weekDay = TypeScale(size = 12f, lineHeight = 16f, weight = "700")
        val weekCount = TypeScale(size = 13f, lineHeight = 18f, weight = "600")
        val weekCountCalm = TypeScale(size = 13f, lineHeight = 18f, weight = "500")
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
