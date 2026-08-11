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
    }

    enum Color {
        static let light = ColorRoles(
            accent: "#0D6E6E",
            accentOn: "#FFFFFF",
            danger: "#B42318",
            dangerOn: "#FFFFFF",
            success: "#1B7A4E",
            successOn: "#FFFFFF",
            surface: "#F4F7F6",
            surfaceRaised: "#FFFFFF",
            border: "#D5DEDA",
            textPrimary: "#1A2421",
            textSecondary: "#5A6B66"
        )
        static let dark = ColorRoles(
            accent: "#3DB8B0",
            accentOn: "#0A1A18",
            danger: "#F97066",
            dangerOn: "#1A0A08",
            success: "#3DCF8E",
            successOn: "#0A1A12",
            surface: "#121A18",
            surfaceRaised: "#1C2623",
            border: "#2E3B37",
            textPrimary: "#E8EFEC",
            textSecondary: "#9AABA5"
        )
    }

    enum Space {
        static let xs: CGFloat = 4
        static let sm: CGFloat = 8
        static let md: CGFloat = 12
        static let lg: CGFloat = 16
        static let xl: CGFloat = 24
        static let _2xl: CGFloat = 32
    }

    enum Radius {
        static let sm: CGFloat = 4
        static let md: CGFloat = 8
        static let lg: CGFloat = 12
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
        static let fontFamily: String = "system-ui"
    }

    /// Semantic icon names — map to SF Symbols in UI code.
    enum Icon {
        static let calendar: String = "icon.calendar"
        static let carpool: String = "icon.carpool"
        static let family: String = "icon.family"
        static let more: String = "icon.more"
        static let places: String = "icon.places"
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
