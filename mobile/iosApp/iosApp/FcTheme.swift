import SwiftUI

/// Token-driven colors that follow the system light/dark appearance.
enum FcTheme {
    static func roles(for scheme: ColorScheme) -> UiTokens.ColorRoles {
        scheme == .dark ? UiTokens.Color.dark : UiTokens.Color.light
    }

    static func color(_ hex: String) -> Color {
        UiTokens.swiftUIColor(hex: hex)
    }

    static func accent(_ scheme: ColorScheme) -> Color {
        color(roles(for: scheme).accent)
    }

    static func accentOn(_ scheme: ColorScheme) -> Color {
        color(roles(for: scheme).accentOn)
    }

    static func danger(_ scheme: ColorScheme) -> Color {
        color(roles(for: scheme).danger)
    }

    static func surface(_ scheme: ColorScheme) -> Color {
        color(roles(for: scheme).surface)
    }

    static func surfaceRaised(_ scheme: ColorScheme) -> Color {
        color(roles(for: scheme).surfaceRaised)
    }

    static func border(_ scheme: ColorScheme) -> Color {
        color(roles(for: scheme).border)
    }

    static func textPrimary(_ scheme: ColorScheme) -> Color {
        color(roles(for: scheme).textPrimary)
    }

    static func textSecondary(_ scheme: ColorScheme) -> Color {
        color(roles(for: scheme).textSecondary)
    }
}
