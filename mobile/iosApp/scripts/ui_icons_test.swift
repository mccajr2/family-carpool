import Foundation

@main
struct UiIconsTestMain {
    static func main() {
        func expect(_ condition: Bool, _ message: String) {
            if !condition {
                fputs("FAIL: \(message)\n", stderr)
                exit(1)
            }
        }

        expect(
            UiIcons.systemName(UiTokens.Icon.garage) == "door.garage.closed",
            "garage maps to SF Symbol"
        )
        expect(
            UiIcons.systemName(UiTokens.Icon.feeds) == "dot.radiowaves.up.forward",
            "feeds maps to SF Symbol"
        )
        expect(
            UiIcons.systemName(UiTokens.Icon.signout) == "rectangle.portrait.and.arrow.right",
            "signout maps to SF Symbol"
        )
        expect(
            UiIcons.systemName(UiTokens.Icon.chevron) == "chevron.right",
            "chevron maps to SF Symbol"
        )
        expect(
            AppShellTab.calendar.systemImage == UiIcons.systemName(UiTokens.Icon.calendar),
            "tab icons go through semantic mapping"
        )

        expect(UiTokens.Color.light.accent == "#0D6E6E", "light accent from tokens")
        expect(UiTokens.Color.dark.accent == "#3DB8B0", "dark accent from tokens")
        expect(UiTokens.Space.md == 12, "spacing token")

        // ContentView More list should use semantic icons, not hard-coded SF names in rows.
        let contentURL = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appendingPathComponent("iosApp/ContentView.swift")
        let content = try! String(contentsOf: contentURL, encoding: .utf8)
        expect(content.contains("UiTokens.Icon.places"), "More Places uses semantic icon")
        expect(content.contains("UiTokens.Icon.garage"), "More Garage uses semantic icon")
        expect(content.contains("UiTokens.Icon.feeds"), "More Feeds uses semantic icon")
        expect(content.contains("UiTokens.Icon.signout"), "More Sign out uses semantic icon")
        expect(content.contains("FcTheme."), "More uses FcTheme token colors")
        expect(content.contains("colorScheme"), "More honors system color scheme")

        print("UiIcons / FcTheme iOS tests passed")
    }
}
