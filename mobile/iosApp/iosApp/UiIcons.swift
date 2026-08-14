import Foundation

/// Maps semantic icon token names to SF Symbols (iOS).
/// See docs/ui-system.md — no shared cross-platform asset pack.
enum UiIcons {
    static func systemName(_ semanticName: String) -> String {
        switch semanticName {
        case UiTokens.Icon.calendar: return "calendar"
        case UiTokens.Icon.carpool: return "car"
        case UiTokens.Icon.family: return "person.3"
        case UiTokens.Icon.more: return "ellipsis.circle"
        case UiTokens.Icon.places: return "mappin.and.ellipse"
        case "icon.garage": return "door.garage.closed"
        case UiTokens.Icon.feeds: return "dot.radiowaves.up.forward"
        case UiTokens.Icon.signout: return "rectangle.portrait.and.arrow.right"
        case UiTokens.Icon.add: return "plus"
        case UiTokens.Icon.chevron: return "chevron.right"
        default:
            preconditionFailure("Unknown semantic icon: \(semanticName)")
        }
    }
}
