// Generated from design-tokens/tokens.json — do not edit by hand. Run: node design-tokens/generate.mjs
import Foundation
import CoreGraphics
#if canImport(SwiftUI)
import SwiftUI
#endif

enum UiTokens {
    struct ColorRoles: Equatable {
        let accent: String
        let accentOn: String
        let danger: String
        let dangerOn: String
        let success: String
        let successOn: String
        let surface: String
        let surfaceRaised: String
        let border: String
        let textPrimary: String
        let textSecondary: String
        let heroSurface: String
        let heroOn: String
        let heroOnSecondary: String
        let heroDanger: String
        let heroSuccess: String
        let heroAccent: String
        let heroGlow: String
        let heroRing: String
        let heroMostUrgentBadge: String
        let heroCarouselDotInactive: String
        let heroCarouselControlBg: String
        let heroDeclineBg: String
        let listRowFocusBorder: String
        let listRowFocusHalo: String
        let railSurface: String
        let railOn: String
        let railOnSecondary: String
        let railActive: String
        let railAccent: String
        let railDanger: String
    }

    enum Color {
        static let light = ColorRoles(
            accent: "#3547E0",
            accentOn: "#FFFFFF",
            danger: "#A9590C",
            dangerOn: "#FFFFFF",
            success: "#187D58",
            successOn: "#FFFFFF",
            surface: "#F6F5F2",
            surfaceRaised: "#FFFFFF",
            border: "#E7E5DF",
            textPrimary: "#16181A",
            textSecondary: "#686F79",
            heroSurface: "#16181A",
            heroOn: "#FFFFFF",
            heroOnSecondary: "#9AA0A8",
            heroDanger: "#F2994A",
            heroSuccess: "#3DCF8E",
            heroAccent: "#5E6DFF",
            heroGlow: "radial-gradient(120% 140% at 85% 0%, #2A2E63 0%, #11131C 55%)",
            heroRing: "#E3A15B",
            heroMostUrgentBadge: "rgba(227,161,91,0.18)",
            heroCarouselDotInactive: "#C9C6BC",
            heroCarouselControlBg: "#ECEBE6",
            heroDeclineBg: "rgba(255,255,255,0.12)",
            listRowFocusBorder: "#E3A15B",
            listRowFocusHalo: "#F4E6D2",
            railSurface: "#16181A",
            railOn: "#FFFFFF",
            railOnSecondary: "#9AA0A8",
            railActive: "#242832",
            railAccent: "#5E6DFF",
            railDanger: "#F2994A"
        )
        static let dark = ColorRoles(
            accent: "#5E6DFF",
            accentOn: "#0A0C1A",
            danger: "#F2994A",
            dangerOn: "#1A1206",
            success: "#3DCF8E",
            successOn: "#08170F",
            surface: "#15171A",
            surfaceRaised: "#1E2124",
            border: "#2C3033",
            textPrimary: "#EDEEF0",
            textSecondary: "#9AA0A8",
            heroSurface: "#242832",
            heroOn: "#FFFFFF",
            heroOnSecondary: "#9AA0A8",
            heroDanger: "#F2994A",
            heroSuccess: "#3DCF8E",
            heroAccent: "#5E6DFF",
            heroGlow: "radial-gradient(120% 140% at 85% 0%, #2A2E63 0%, #11131C 55%)",
            heroRing: "#E3A15B",
            heroMostUrgentBadge: "rgba(227,161,91,0.18)",
            heroCarouselDotInactive: "#C9C6BC",
            heroCarouselControlBg: "#ECEBE6",
            heroDeclineBg: "rgba(255,255,255,0.12)",
            listRowFocusBorder: "#E3A15B",
            listRowFocusHalo: "#F4E6D2",
            railSurface: "#16181A",
            railOn: "#FFFFFF",
            railOnSecondary: "#9AA0A8",
            railActive: "#242832",
            railAccent: "#5E6DFF",
            railDanger: "#F2994A"
        )
    }

    enum Space {
        static let xs: CGFloat = 4
        static let sm: CGFloat = 8
        static let md: CGFloat = 12
        static let lg: CGFloat = 16
        static let xl: CGFloat = 24
        static let _2xl: CGFloat = 32
        static let header: CGFloat = 26
        static let mainY: CGFloat = 36
        static let mainX: CGFloat = 44
        static let railY: CGFloat = 28
        static let railX: CGFloat = 20
        static let focusRing: CGFloat = 88
        static let focusRingStroke: CGFloat = 6
        static let focusRingCoveringGap: CGFloat = 10
        static let focusTitleGap: CGFloat = 6
        static let focusStatusDot: CGFloat = 6
        static let focusStatusPillY: CGFloat = 6
        static let focusCoveringPadY: CGFloat = 7
        static let focusActionsGap: CGFloat = 18
        static let filterChipGap: CGFloat = 8
        static let filterChipPadY: CGFloat = 9
        static let filterChipPadX: CGFloat = 16
        static let filterChipMarginBottom: CGFloat = 28
        static let listRowGap: CGFloat = 12
        static let listRowPadX: CGFloat = 24
        static let listRowPadY: CGFloat = 20
        static let listRowKidAvatar: CGFloat = 28
        static let listRowFocusHaloSpread: CGFloat = 3
        static let listRowTagGap: CGFloat = 6
        static let listRowAvatar: CGFloat = 26
        static let listRowAvatarBorder: CGFloat = 2
        static let listRowAvatarOverlap: CGFloat = 8
        static let feedCardPadY: CGFloat = 18
        static let feedCardPadX: CGFloat = 20
        static let feedListGap: CGFloat = 12
        static let feedListMarginBottom: CGFloat = 28
        static let feedMetaGap: CGFloat = 3
        static let feedMetaDot: CGFloat = 6
        static let feedChipPadY: CGFloat = 4
        static let feedChipPadX: CGFloat = 10
        static let feedActionsPadTop: CGFloat = 14
        static let feedActionsGap: CGFloat = 16
        static let feedCtaGap: CGFloat = 10
        static let feedQuietGap: CGFloat = 8
        static let feedActionPadY: CGFloat = 10
        static let feedActionPadX: CGFloat = 16
        static let feedSectionGap: CGFloat = 14
        static let feedFormPad: CGFloat = 22
        static let feedFieldLabelGap: CGFloat = 6
        static let feedInputPadY: CGFloat = 11
        static let feedInputPadX: CGFloat = 14
        static let feedKidChipPadY: CGFloat = 9
        static let feedKidChipPadX: CGFloat = 14
        static let feedKidChipGap: CGFloat = 7
        static let feedKidChipsGap: CGFloat = 8
        static let feedSubmitPadY: CGFloat = 13
        static let feedSubmitMarginTop: CGFloat = 6
        static let weekGlancePadX: CGFloat = 28
        static let weekItemPadY: CGFloat = 10
        static let weekDayWidth: CGFloat = 38
        static let weekFlag: CGFloat = 7
        static let heroCarouselGap: CGFloat = 16
        static let heroCarouselSlideMax: CGFloat = 640
        static let heroCarouselSlideVw: CGFloat = 84
        static let heroSlidePad: CGFloat = 28
        static let heroEmptyPad: CGFloat = 32
        static let heroCarouselDotActiveW: CGFloat = 18
        static let heroCarouselDotH: CGFloat = 7
    }

    enum Radius {
        static let sm: CGFloat = 4
        static let md: CGFloat = 8
        static let lg: CGFloat = 12
        static let xl: CGFloat = 20
    }

    struct TypeScale: Equatable {
        let size: CGFloat
        let lineHeight: CGFloat
        let weight: String
    }

    enum Typography {
        static let caption = TypeScale(size: 12, lineHeight: 16, weight: "400")
        static let body = TypeScale(size: 15, lineHeight: 22, weight: "400")
        static let title = TypeScale(size: 17, lineHeight: 24, weight: "600")
        static let headline = TypeScale(size: 22, lineHeight: 28, weight: "700")
        static let hero = TypeScale(size: 26, lineHeight: 32, weight: "700")
        static let focusWhen = TypeScale(size: 15, lineHeight: 20, weight: "600")
        static let focusTitle = TypeScale(size: 30, lineHeight: 36, weight: "700")
        static let focusRingLabel = TypeScale(size: 16, lineHeight: 20, weight: "700")
        static let focusRingUnit = TypeScale(size: 9.5, lineHeight: 12, weight: "600")
        static let focusStatusPill = TypeScale(size: 12.5, lineHeight: 16, weight: "600")
        static let focusCovering = TypeScale(size: 12.5, lineHeight: 16, weight: "600")
        static let focusAction = TypeScale(size: 13.5, lineHeight: 18, weight: "700")
        static let focusActionGhost = TypeScale(size: 13.5, lineHeight: 18, weight: "600")
        static let statusChip = TypeScale(size: 11, lineHeight: 14, weight: "700")
        static let filterChip = TypeScale(size: 13.5, lineHeight: 18, weight: "600")
        static let listRowAvatarLabel = TypeScale(size: 10.5, lineHeight: 14, weight: "700")
        static let listRowChevron = TypeScale(size: 18, lineHeight: 18, weight: "400")
        static let listRowTeam = TypeScale(size: 12, lineHeight: 16, weight: "700")
        static let listRowTitle = TypeScale(size: 18, lineHeight: 22, weight: "700")
        static let listRowMeta = TypeScale(size: 14, lineHeight: 20, weight: "400")
        static let page = TypeScale(size: 34, lineHeight: 40, weight: "700")
        static let subtitle = TypeScale(size: 14, lineHeight: 20, weight: "500")
        static let feedName = TypeScale(size: 16.5, lineHeight: 22, weight: "700")
        static let feedMeta = TypeScale(size: 12.5, lineHeight: 16, weight: "400")
        static let feedSectionLabel = TypeScale(size: 12, lineHeight: 16, weight: "700")
        static let feedChip = TypeScale(size: 11, lineHeight: 14, weight: "700")
        static let feedAction = TypeScale(size: 13.5, lineHeight: 18, weight: "700")
        static let feedFieldLabel = TypeScale(size: 12.5, lineHeight: 16, weight: "600")
        static let feedInput = TypeScale(size: 14, lineHeight: 20, weight: "400")
        static let feedKidChip = TypeScale(size: 13.5, lineHeight: 18, weight: "600")
        static let feedSubmit = TypeScale(size: 14.5, lineHeight: 20, weight: "700")
        static let weekGlanceTitle = TypeScale(size: 16, lineHeight: 20, weight: "700")
        static let weekDay = TypeScale(size: 12, lineHeight: 16, weight: "700")
        static let weekCount = TypeScale(size: 13, lineHeight: 18, weight: "600")
        static let weekCountCalm = TypeScale(size: 13, lineHeight: 18, weight: "500")
        static let fontFamily: String = "Plus Jakarta Sans"
    }

    /// Semantic icon names — map to SF Symbols in UI code.
    enum Icon {
        static let calendar: String = "icon.calendar"
        static let carpool: String = "icon.carpool"
        static let family: String = "icon.family"
        static let more: String = "icon.more"
        static let places: String = "icon.places"
        static let garage: String = "icon.garage"
        static let feeds: String = "icon.feeds"
        static let signout: String = "icon.signout"
        static let add: String = "icon.add"
        static let chevron: String = "icon.chevron"
    }
}

#if canImport(SwiftUI)
extension UiTokens {
    static func swiftUIColor(hex: String) -> SwiftUI.Color {
        let cleaned = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        var value: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&value)
        let r = Double((value >> 16) & 0xFF) / 255.0
        let g = Double((value >> 8) & 0xFF) / 255.0
        let b = Double(value & 0xFF) / 255.0
        return SwiftUI.Color(red: r, green: g, blue: b)
    }
}
#endif
