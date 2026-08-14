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
        case .calendar: return UiIcons.systemName(UiTokens.Icon.calendar)
        case .carpool: return UiIcons.systemName(UiTokens.Icon.carpool)
        case .family: return UiIcons.systemName(UiTokens.Icon.family)
        case .more: return UiIcons.systemName(UiTokens.Icon.more)
        }
    }
}

enum MoreDestination: String, Hashable {
    case places
    case garage
    case feeds

    var title: String {
        switch self {
        case .places: return "Places"
        case .garage: return "Garage"
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

    mutating func openGarage() {
        tab = .more
        morePath = [.garage]
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
