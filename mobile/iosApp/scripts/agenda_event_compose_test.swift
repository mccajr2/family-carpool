import Foundation

@main
struct AgendaEventComposeTestMain {
    static func main() {
        func expect(_ condition: Bool, _ message: String) {
            if !condition {
                fputs("FAIL: \(message)\n", stderr)
                exit(1)
            }
        }

        var compose = AgendaEventComposeState()
        expect(!compose.isOpen, "defaults closed")
        expect(compose.editingEventId == nil, "defaults with no edit target")

        compose.openCreate()
        expect(compose.isOpen, "openCreate opens compose")
        expect(!compose.isEditing, "openCreate is not editing")
        expect(compose.editingEventId == nil, "openCreate clears edit id")

        compose.openEdit(eventId: "e1")
        expect(compose.isOpen, "openEdit keeps compose open")
        expect(compose.isEditing, "openEdit marks editing")
        expect(compose.editingEventId == "e1", "openEdit stores event id")

        compose.close()
        expect(!compose.isOpen, "close dismisses compose")
        expect(compose.editingEventId == nil, "close clears edit id")

        compose.openCreate()
        compose.onSelectTab(from: .calendar, to: .family)
        expect(!compose.isOpen, "leaving calendar closes compose")

        compose.openEdit(eventId: "e2")
        compose.onSelectTab(from: .calendar, to: .calendar)
        expect(compose.isOpen && compose.editingEventId == "e2", "staying on calendar keeps compose")

        compose.onSelectTab(from: .calendar, to: .carpool)
        expect(!compose.isOpen, "leaving calendar for carpool closes compose")

        // Inline Agenda create labels must stay removed from ContentView.
        let contentViewURL = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appendingPathComponent("iosApp/ContentView.swift")
        let content = try! String(contentsOf: contentViewURL, encoding: .utf8)
        expect(!content.contains("New event title"), "Agenda no longer hosts New event title field")
        expect(!content.contains("Button(\"Add event\")"), "Agenda no longer hosts Add event submit")
        expect(content.contains("accessibilityLabel(\"Add event\")"), "Calendar chrome still has Add event")
        expect(content.contains("eventComposeDestination"), "compose sheet content is present")
        expect(content.contains("\"Saving…\""), "compose Save shows Saving… while busy")
        expect(!content.contains("Working…"), "compose busy must not hijack Sign out")

        print("AgendaEventCompose tests passed")
    }
}
