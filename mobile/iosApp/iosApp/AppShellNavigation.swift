import Foundation

enum AppShellTab: String, Hashable, CaseIterable {
    case calendar
    case carpool
    case family
    case more

    var title: String {
        switch self {
        case .calendar: return "Calendar"
        case .carpool: return "Carpool"
        case .family: return "Family"
        case .more: return "More"
        }
    }

    var systemImage: String {
        switch self {
        case .calendar: return "calendar"
        case .carpool: return "car"
        case .family: return "person.3"
        case .more: return "ellipsis.circle"
        }
    }
}

enum MoreDestination: String, Hashable {
    case places
    case feeds

    var title: String {
        switch self {
        case .places: return "Places"
        case .feeds: return "Feeds"
        }
    }
}

/// Pure shell navigation state shared by ContentView / AuthViewModel (testable without UI).
struct AppShellNavigationState: Equatable {
    var tab: AppShellTab = .calendar
    var morePath: [MoreDestination] = []

    mutating func selectTab(_ tab: AppShellTab) {
        self.tab = tab
        if tab == .more {
            morePath = []
        }
    }

    mutating func openPlaces() {
        tab = .more
        morePath = [.places]
    }

    mutating func openFeeds(isOrganizer: Bool) {
        guard isOrganizer else { return }
        tab = .more
        morePath = [.feeds]
    }

    mutating func resetToCalendar() {
        tab = .calendar
        morePath = []
    }

    static func showsFeedsRow(isOrganizer: Bool) -> Bool {
        isOrganizer
    }
}
