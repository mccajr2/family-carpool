import Foundation

/// Pure compose open/mode state for Calendar Add / Edit (testable without UIKit).
struct AgendaEventComposeState: Equatable {
    enum Mode: Equatable {
        case create
        case edit(eventId: String)
    }

    private(set) var mode: Mode? = nil

    var isOpen: Bool { mode != nil }

    var editingEventId: String? {
        if case let .edit(eventId) = mode { return eventId }
        return nil
    }

    var isEditing: Bool { editingEventId != nil }

    mutating func openCreate() {
        mode = .create
    }

    mutating func openEdit(eventId: String) {
        mode = .edit(eventId: eventId)
    }

    mutating func close() {
        mode = nil
    }

    /// Dismiss compose when leaving the Calendar tab.
    mutating func onSelectTab(from: AppShellTab, to: AppShellTab) {
        if from == .calendar, to != .calendar {
            close()
        }
    }
}
