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

        print("AgendaEventCompose tests passed")
    }
}
