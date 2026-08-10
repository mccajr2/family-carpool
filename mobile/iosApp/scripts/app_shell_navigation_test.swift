import Foundation

@main
struct AppShellNavigationTestMain {
    static func main() {
        func expect(_ condition: Bool, _ message: String) {
            if !condition {
                fputs("FAIL: \(message)\n", stderr)
                exit(1)
            }
        }

        var state = AppShellNavigationState()
        expect(state.tab == .calendar, "defaults to calendar")
        expect(state.morePath.isEmpty, "defaults to empty more path")

        state.selectTab(.carpool)
        expect(state.tab == .carpool, "selects carpool")

        state.openPlaces()
        expect(state.tab == .more && state.morePath == [.places], "opens places under more")

        state.selectTab(.more)
        expect(state.morePath.isEmpty, "selecting more clears push path")

        state.openFeeds(isOrganizer: false)
        expect(state.tab == .more && state.morePath.isEmpty, "caregiver cannot open feeds")
        expect(!AppShellNavigationState.showsFeedsRow(isOrganizer: false), "caregiver feeds row omitted")

        state.openFeeds(isOrganizer: true)
        expect(state.tab == .more && state.morePath == [.feeds], "organizer opens feeds")
        expect(AppShellNavigationState.showsFeedsRow(isOrganizer: true), "organizer sees feeds row")

        state.resetToCalendar()
        expect(state.tab == .calendar && state.morePath.isEmpty, "reset lands on calendar")

        print("AppShellNavigation tests passed")
    }
}
