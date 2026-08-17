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
            heroAccent: "#5E6DFF"
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
            heroAccent: "#5E6DFF"
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
