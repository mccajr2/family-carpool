import Foundation
import SharedLogic
import SwiftUI

struct FamilyKidItem: Identifiable, Equatable {
    let id: String
    var displayName: String
}

struct FamilyPlaceItem: Identifiable, Equatable {
    let id: String
    var name: String
    var address: String
    var isLocated: Bool
}

struct FamilyFeedItem: Identifiable, Equatable {
    let id: String
    var name: String
    var sourceUrl: String
    var kidIds: [String]
    var lastSyncedAt: String?
    var lastSyncError: String?
    var eventCount: Int

    var syncStatusLabel: String {
        if let lastSyncError, !lastSyncError.isEmpty {
            return "Sync failed: \(lastSyncError)"
        }
        if lastSyncedAt != nil {
            return "Synced · \(eventCount) events"
        }
        return "Not synced"
    }

    func listStatusLabel(kids: [FamilyKidItem]) -> String {
        let namesById = Dictionary(uniqueKeysWithValues: kids.map { ($0.id, $0.displayName) })
        let kidNames = kidIds.compactMap { id -> String? in
            let name = namesById[id]?.trimmingCharacters(in: .whitespacesAndNewlines)
            return (name?.isEmpty == false) ? name : nil
        }.joined(separator: ", ")
        let status = syncStatusLabel
        return kidNames.isEmpty ? status : "\(kidNames) · \(status)"
    }
}

extension FamilyCalendarItem {
    var leaveByAgendaLine: String {
        LeaveByDisplay.leaveByAgendaLine(
            leaveByStatus: leaveByStatus,
            leaveByAt: leaveByAt,
            leaveByReason: leaveByReason
        )
    }

    var whenLabel: String {
        let start = ManualEventDateCodec.displayString(fromIso: startsAt) ?? startsAt
        if let endsAt, !endsAt.isEmpty {
            let end = ManualEventDateCodec.displayString(fromIso: endsAt) ?? endsAt
            return "\(start) → \(end)"
        }
        return start
    }

    var sourceLabel: String {
        if source == "FEED" {
            let name = feedName?.trimmingCharacters(in: .whitespacesAndNewlines)
            return (name?.isEmpty == false) ? name! : "Feed"
        }
        return "Manual"
    }

    func kidNamesLabel(kids: [FamilyKidItem]) -> String {
        let namesById = Dictionary(uniqueKeysWithValues: kids.map { ($0.id, $0.displayName) })
        return kidIds.compactMap { id -> String? in
            let name = namesById[id]?.trimmingCharacters(in: .whitespacesAndNewlines)
            return (name?.isEmpty == false) ? name : nil
        }.joined(separator: ", ")
    }
}

struct FamilyMemberItem: Identifiable, Equatable {
    var id: String { adultId }
    let adultId: String
    let email: String
    let displayName: String
    var role: String

    var label: String {
        let trimmed = displayName.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? email : trimmed
    }
}

@MainActor
final class AuthViewModel: ObservableObject {
    enum Phase {
        case signedOut
        case codeSent
        case signedIn
    }

    enum FamilyPhase {
        case loading
        /// Circle load failed — whether a circle exists is unknown. Distinct from
        /// [choose] so we do not offer Create family after a transport/server error.
        case loadFailed
        case choose
        case create
        case join
        case ready
    }

    @Published var email: String = ""
    @Published var code: String = ""
    @Published var phase: Phase = .signedOut
    @Published var signedInEmail: String = ""
    @Published var currentAdultId: String = ""
    @Published var hasDisplayName: Bool = false
    @Published var adultDisplayName: String = ""
    @Published var circleNameInput: String = ""
    @Published var inviteCodeInput: String = ""
    @Published var inviteCode: String = ""
    @Published var familyTitle: String = "Your family"
    @Published var familyRole: String = ""
    @Published var members: [FamilyMemberItem] = []
    @Published var kids: [FamilyKidItem] = []
    @Published var newKidName: String = ""
    @Published var places: [FamilyPlaceItem] = []
    @Published var newPlaceName: String = ""
    @Published var newPlaceAddress: String = ""
    @Published var feeds: [FamilyFeedItem] = []
    @Published var newFeedName: String = ""
    @Published var newFeedUrl: String = ""
    @Published var newFeedKidIds: [String] = []
    @Published var calendarItems: [FamilyCalendarItem] = []
    @Published var calendarLoadedTo: String = ManualEventDateCodec.defaultCalendarWindow().to
    @Published var calendarFetchedAtMs: Int64?
    @Published var calendarRevalidating = false
    @Published var agendaKidFilter: String?
    @Published var defaultLeaveFromPlaceId: String?
    @Published var defaultLeaveFromPlaceName: String?
    @Published var newEventTitle: String = ""
    @Published var newEventStartsAtDate: Date = Date().addingTimeInterval(15 * 60)
    @Published var newEventEndsAtDate: Date = Date().addingTimeInterval(75 * 60)
    @Published var newEventHasEndsAt: Bool = false
    @Published var newEventLocation: String = ""
    @Published var newEventKidIds: [String] = []
    @Published var editingEventTitle: String = ""
    @Published var editingEventStartsAtDate: Date = Date()
    @Published var editingEventEndsAtDate: Date = Date()
    @Published var editingEventHasEndsAt: Bool = false
    @Published var editingEventLocation: String = ""
    @Published var editingEventKidIds: [String] = []
    @Published var eventCompose = AgendaEventComposeState()
    @Published var familyPhase: FamilyPhase = .loading
    @Published var editingKidId: String?
    @Published var editingKidName: String = ""
    @Published var editingPlaceId: String?
    @Published var editingPlaceName: String = ""
    @Published var editingPlaceAddress: String = ""
    @Published var editingFeedId: String?
    @Published var editingFeedName: String = ""
    @Published var editingFeedUrl: String = ""
    @Published var editingFeedKidIds: [String] = []
    @Published var shell = AppShellNavigationState()
    @Published var devHint: String?
    @Published var errorMessage: String?
    /// Confirm/Assign failures keyed by `source-id` — shown on the Agenda item CTAs.
    @Published var coverageActionErrors: [String: String] = [:]
    @Published var isLoading: Bool = false
    @Published var carpoolSummary: CarpoolSummaryView?
    @Published var carpoolLoading: Bool = false
    @Published var carpoolError: String?
    @Published var carpoolCodeInput: String = ""
    @Published var showCarpoolCodeForm: Bool = false
    @Published var pendingEnableFeed: CarpoolFeedStatusView?

    private let bridge: AuthBridge
    private var leaveByFillGen = 0
    private var nearTermDone = true
    private var nearTermContinuation: CheckedContinuation<Void, Never>?

    var isOrganizer: Bool { familyRole == "ORGANIZER" }

    private static func coverageItemKey(source: String, id: String) -> String {
        "\(source)-\(id)"
    }

    private func coverageItemKey(for item: FamilyCalendarItem) -> String {
        Self.coverageItemKey(source: item.source, id: item.id)
    }

    private func coverageItemKey(forAssignmentId assignmentId: String) -> String? {
        guard let item = calendarItems.first(where: { row in
            row.coverages.contains(where: { $0.id == assignmentId })
        }) else {
            return nil
        }
        return coverageItemKey(for: item)
    }

    var visibleCalendarItems: [FamilyCalendarItem] {
        guard let agendaKidFilter else { return calendarItems }
        return calendarItems.filter { $0.kidIds.contains(agendaKidFilter) }
    }

    func selectShellTab(_ tab: AppShellTab) {
        var compose = eventCompose
        compose.onSelectTab(from: shell.tab, to: tab)
        if !compose.isOpen, eventCompose.isOpen {
            clearEventComposeFields()
        }
        eventCompose = compose
        var next = shell
        next.selectTab(tab)
        shell = next
        if tab == .calendar {
            revalidateCalendarIfStale()
        }
        if tab == .carpool {
            loadCarpoolSummary()
        }
    }

    func openCreateEventCompose() {
        clearEditingEventFields()
        var compose = eventCompose
        compose.openCreate()
        eventCompose = compose
        errorMessage = nil
    }

    func closeEventCompose() {
        var compose = eventCompose
        compose.close()
        eventCompose = compose
        clearEventComposeFields()
        errorMessage = nil
    }

    func openMorePlaces() {
        var next = shell
        next.openPlaces()
        shell = next
    }

    func openMoreFeeds() {
        var next = shell
        next.openFeeds(isOrganizer: isOrganizer)
        shell = next
        if next.morePath.contains(.feeds) {
            loadCarpoolSummary()
        }
    }

    init(bridge: AuthBridge = AuthBridge()) {
        self.bridge = bridge
        if bridge.isSignedIn() {
            phase = .signedIn
            refreshCurrentEmail()
            loadFamily()
        }
    }

    func sendCode() {
        let trimmed = email.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        isLoading = true
        errorMessage = nil
        bridge.requestCode(
            email: trimmed,
            onSuccess: { [weak self] devCode in
                Task { @MainActor in
                    guard let self else { return }
                    self.isLoading = false
                    self.phase = .codeSent
                    self.devHint = devCode
                    if let devCode, self.code.isEmpty {
                        self.code = devCode
                    }
                }
            },
            onError: { [weak self] message in
                Task { @MainActor in
                    self?.isLoading = false
                    self?.errorMessage = message
                }
            }
        )
    }

    func verifyCode() {
        let trimmedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedCode = code.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedEmail.isEmpty, !trimmedCode.isEmpty else { return }
        isLoading = true
        errorMessage = nil
        bridge.verifyCode(
            email: trimmedEmail,
            code: trimmedCode,
            onSuccess: { [weak self] adultEmail in
                Task { @MainActor in
                    guard let self else { return }
                    self.isLoading = false
                    self.signedInEmail = adultEmail
                    self.phase = .signedIn
                    self.devHint = nil
                    self.loadFamily()
                }
            },
            onError: { [weak self] message in
                Task { @MainActor in
                    self?.isLoading = false
                    self?.errorMessage = message
                }
            }
        )
    }

    func signOut() {
        isLoading = true
        errorMessage = nil
        bridge.logout(
            onSuccess: { [weak self] in
                Task { @MainActor in
                    self?.finishSignedOut()
                }
            },
            onError: { [weak self] message in
                Task { @MainActor in
                    // Token is cleared in AuthSession.logout even when the server call fails.
                    // Staying signed-in would leave a signed-in screen with no token.
                    guard let self else { return }
                    self.finishSignedOut(error: message)
                }
            }
        )
    }

    func loadFamily() {
        let paintedBootstrap = bridge.paintBootstrapIfPresent {
            [self] title, email, adultId, displayName, role, inviteCode, memberAdultIds, memberEmails,
            memberNames, memberRoles, kidIds, kidNames, placeIds, placeNames, placeAddresses,
            placeLocated, defaultLeaveFromPlaceId, defaultLeaveFromPlaceName in
            // Synchronous: must paint before loadFamily's network launch races ahead.
            self.applyReady(
                title: title,
                email: email,
                adultId: adultId,
                displayName: displayName,
                role: role,
                inviteCode: inviteCode,
                memberAdultIds: memberAdultIds,
                memberEmails: memberEmails,
                memberNames: memberNames,
                memberRoles: memberRoles,
                kidIds: kidIds,
                kidNames: kidNames,
                placeIds: placeIds,
                placeNames: placeNames,
                placeAddresses: placeAddresses,
                placeLocated: placeLocated,
                defaultLeaveFromPlaceId: defaultLeaveFromPlaceId,
                defaultLeaveFromPlaceName: defaultLeaveFromPlaceName,
                deferNetworkLoads: true
            )
            self.paintBootstrapFeeds()
        }
        if !paintedBootstrap {
            familyPhase = .loading
        }
        errorMessage = nil
        bridge.loadFamily(
            onNeedsCreate: { [weak self] email, hasDisplayName in
                Task { @MainActor in
                    guard let self else { return }
                    self.signedInEmail = email
                    self.hasDisplayName = hasDisplayName.boolValue
                    self.familyPhase = .choose
                }
            },
            onReady: { [weak self] title, email, adultId, displayName, role, inviteCode, memberAdultIds, memberEmails, memberNames, memberRoles, kidIds, kidNames, placeIds, placeNames, placeAddresses, placeLocated, defaultLeaveFromPlaceId, defaultLeaveFromPlaceName in
                Task { @MainActor in
                    self?.applyReady(
                        title: title,
                        email: email,
                        adultId: adultId,
                        displayName: displayName,
                        role: role,
                        inviteCode: inviteCode,
                        memberAdultIds: memberAdultIds,
                        memberEmails: memberEmails,
                        memberNames: memberNames,
                        memberRoles: memberRoles,
                        kidIds: kidIds,
                        kidNames: kidNames,
                        placeIds: placeIds,
                        placeNames: placeNames,
                        placeAddresses: placeAddresses,
                        placeLocated: placeLocated,
                        defaultLeaveFromPlaceId: defaultLeaveFromPlaceId,
                        defaultLeaveFromPlaceName: defaultLeaveFromPlaceName,
                        deferNetworkLoads: false
                    )
                }
            },
            onError: { [weak self] message in
                Task { @MainActor in
                    guard let self else { return }
                    if self.familyPhase != .ready {
                        self.familyPhase = .loadFailed
                        self.errorMessage = message
                    } else {
                        self.errorMessage = message
                        self.calendarRevalidating = false
                    }
                }
            }
        )
    }

    func showCreate() {
        familyPhase = .create
        errorMessage = nil
    }

    func showJoin() {
        familyPhase = .join
        errorMessage = nil
    }

    func showChoose() {
        familyPhase = .choose
        errorMessage = nil
    }

    func createFamily() {
        let display = adultDisplayName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !display.isEmpty else { return }
        isLoading = true
        errorMessage = nil
        let optionalName = circleNameInput.trimmingCharacters(in: .whitespacesAndNewlines)
        bridge.createFamilyCircle(
            adultDisplayName: display,
            circleName: optionalName.isEmpty ? nil : optionalName,
            onSuccess: { [weak self] title, email, adultId, displayName, role, inviteCode, memberAdultIds, memberEmails, memberNames, memberRoles, kidIds, kidNames, placeIds, placeNames, placeAddresses, placeLocated, defaultLeaveFromPlaceId, defaultLeaveFromPlaceName in
                Task { @MainActor in
                    guard let self else { return }
                    self.isLoading = false
                    self.applyReady(
                        title: title,
                        email: email,
                        adultId: adultId,
                        displayName: displayName,
                        role: role,
                        inviteCode: inviteCode,
                        memberAdultIds: memberAdultIds,
                        memberEmails: memberEmails,
                        memberNames: memberNames,
                        memberRoles: memberRoles,
                        kidIds: kidIds,
                        kidNames: kidNames,
                        placeIds: placeIds,
                        placeNames: placeNames,
                        placeAddresses: placeAddresses,
                        placeLocated: placeLocated,
                        defaultLeaveFromPlaceId: defaultLeaveFromPlaceId,
                        defaultLeaveFromPlaceName: defaultLeaveFromPlaceName
                    )
                }
            },
            onError: { [weak self] message in
                Task { @MainActor in
                    self?.isLoading = false
                    self?.errorMessage = message
                }
            }
        )
    }

    func joinFamily() {
        let code = inviteCodeInput.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !code.isEmpty else { return }
        let display = adultDisplayName.trimmingCharacters(in: .whitespacesAndNewlines)
        if !hasDisplayName && display.isEmpty { return }
        isLoading = true
        errorMessage = nil
        bridge.joinFamilyCircle(
            code: code,
            adultDisplayName: hasDisplayName ? nil : display,
            onSuccess: { [weak self] title, email, adultId, displayName, role, inviteCode, memberAdultIds, memberEmails, memberNames, memberRoles, kidIds, kidNames, placeIds, placeNames, placeAddresses, placeLocated, defaultLeaveFromPlaceId, defaultLeaveFromPlaceName in
                Task { @MainActor in
                    guard let self else { return }
                    self.isLoading = false
                    self.applyReady(
                        title: title,
                        email: email,
                        adultId: adultId,
                        displayName: displayName,
                        role: role,
                        inviteCode: inviteCode,
                        memberAdultIds: memberAdultIds,
                        memberEmails: memberEmails,
                        memberNames: memberNames,
                        memberRoles: memberRoles,
                        kidIds: kidIds,
                        kidNames: kidNames,
                        placeIds: placeIds,
                        placeNames: placeNames,
                        placeAddresses: placeAddresses,
                        placeLocated: placeLocated,
                        defaultLeaveFromPlaceId: defaultLeaveFromPlaceId,
                        defaultLeaveFromPlaceName: defaultLeaveFromPlaceName
                    )
                }
            },
            onError: { [weak self] message in
                Task { @MainActor in
                    self?.isLoading = false
                    self?.errorMessage = message
                }
            }
        )
    }

    func regenerateInvite() {
        isLoading = true
        errorMessage = nil
        bridge.regenerateInvite(
            onSuccess: { [weak self] code in
                Task { @MainActor in
                    self?.isLoading = false
                    self?.inviteCode = code
                }
            },
            onError: { [weak self] message in
                Task { @MainActor in
                    self?.isLoading = false
                    self?.errorMessage = message
                }
            }
        )
    }

    func leaveFamily() {
        isLoading = true
        errorMessage = nil
        bridge.leaveFamily(
            onSuccess: { [weak self] email, hasDisplayName in
                Task { @MainActor in
                    guard let self else { return }
                    self.isLoading = false
                    self.signedInEmail = email
                    self.hasDisplayName = hasDisplayName.boolValue
                    self.kids = []
                    self.members = []
                    self.inviteCode = ""
                    self.places = []
                    self.feeds = []
                    self.calendarItems = []
                    self.calendarLoadedTo = ManualEventDateCodec.defaultCalendarWindow().to
                    self.calendarFetchedAtMs = nil
                    self.calendarRevalidating = false
                    self.cancelLeaveByFill()
                    self.agendaKidFilter = nil
                    self.defaultLeaveFromPlaceId = nil
                    self.defaultLeaveFromPlaceName = nil
                    self.shell.resetToCalendar()
                    self.familyPhase = .choose
                }
            },
            onError: { [weak self] message in
                Task { @MainActor in
                    self?.isLoading = false
                    self?.errorMessage = message
                }
            }
        )
    }

    func promote(_ member: FamilyMemberItem) {
        updateRole(member, role: "ORGANIZER")
    }

    func demote(_ member: FamilyMemberItem) {
        updateRole(member, role: "CAREGIVER")
    }

    func removeMember(_ member: FamilyMemberItem) {
        isLoading = true
        errorMessage = nil
        bridge.removeMember(
            adultId: member.adultId,
            onSuccess: { [weak self] in
                Task { @MainActor in
                    guard let self else { return }
                    self.isLoading = false
                    self.members.removeAll { $0.adultId == member.adultId }
                }
            },
            onError: { [weak self] message in
                Task { @MainActor in
                    self?.isLoading = false
                    self?.errorMessage = message
                }
            }
        )
    }

    func addKid() {
        let name = newKidName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else { return }
        isLoading = true
        errorMessage = nil
        bridge.addKid(
            displayName: name,
            onSuccess: { [weak self] id, kidName in
                Task { @MainActor in
                    guard let self else { return }
                    self.isLoading = false
                    self.kids.append(FamilyKidItem(id: id, displayName: kidName))
                    self.newKidName = ""
                }
            },
            onError: { [weak self] message in
                Task { @MainActor in
                    self?.isLoading = false
                    self?.errorMessage = message
                }
            }
        )
    }

    func beginRename(_ kid: FamilyKidItem) {
        editingKidId = kid.id
        editingKidName = kid.displayName
    }

    func cancelRename() {
        editingKidId = nil
        editingKidName = ""
    }

    func saveRename() {
        guard let kidId = editingKidId else { return }
        let name = editingKidName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else { return }
        isLoading = true
        errorMessage = nil
        bridge.renameKid(
            kidId: kidId,
            displayName: name,
            onSuccess: { [weak self] id, kidName in
                Task { @MainActor in
                    guard let self else { return }
                    self.isLoading = false
                    if let index = self.kids.firstIndex(where: { $0.id == id }) {
                        self.kids[index].displayName = kidName
                    }
                    self.cancelRename()
                }
            },
            onError: { [weak self] message in
                Task { @MainActor in
                    self?.isLoading = false
                    self?.errorMessage = message
                }
            }
        )
    }

    func removeKid(_ kidId: String) {
        isLoading = true
        errorMessage = nil
        bridge.removeKid(
            kidId: kidId,
            onSuccess: { [weak self] in
                Task { @MainActor in
                    guard let self else { return }
                    self.isLoading = false
                    self.kids.removeAll { $0.id == kidId }
                }
            },
            onError: { [weak self] message in
                Task { @MainActor in
                    self?.isLoading = false
                    self?.errorMessage = message
                }
            }
        )
    }

    private func updateRole(_ member: FamilyMemberItem, role: String) {
        isLoading = true
        errorMessage = nil
        bridge.updateMemberRole(
            adultId: member.adultId,
            role: role,
            onSuccess: { [weak self] title, email, adultId, displayName, familyRole, inviteCode, memberAdultIds, memberEmails, memberNames, memberRoles, kidIds, kidNames, placeIds, placeNames, placeAddresses, placeLocated, defaultLeaveFromPlaceId, defaultLeaveFromPlaceName in
                Task { @MainActor in
                    guard let self else { return }
                    self.isLoading = false
                    self.applyReady(
                        title: title,
                        email: email,
                        adultId: adultId,
                        displayName: displayName,
                        role: familyRole,
                        inviteCode: inviteCode,
                        memberAdultIds: memberAdultIds,
                        memberEmails: memberEmails,
                        memberNames: memberNames,
                        memberRoles: memberRoles,
                        kidIds: kidIds,
                        kidNames: kidNames,
                        placeIds: placeIds,
                        placeNames: placeNames,
                        placeAddresses: placeAddresses,
                        placeLocated: placeLocated,
                        defaultLeaveFromPlaceId: defaultLeaveFromPlaceId,
                        defaultLeaveFromPlaceName: defaultLeaveFromPlaceName
                    )
                }
            },
            onError: { [weak self] message in
                Task { @MainActor in
                    self?.isLoading = false
                    self?.errorMessage = message
                }
            }
        )
    }


    func addPlace() {
        let name = newPlaceName.trimmingCharacters(in: .whitespacesAndNewlines)
        let address = newPlaceAddress.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty, !address.isEmpty else { return }
        isLoading = true
        errorMessage = nil
        bridge.addPlace(
            name: name,
            address: address,
            onSuccess: { [weak self] id, placeName, placeAddress, located in
                Task { @MainActor in
                    guard let self else { return }
                    self.isLoading = false
                    self.places.append(
                        FamilyPlaceItem(
                            id: id,
                            name: placeName,
                            address: placeAddress,
                            isLocated: located == "true"
                        )
                    )
                    self.newPlaceName = ""
                    self.newPlaceAddress = ""
                }
            },
            onError: { [weak self] message in
                Task { @MainActor in
                    self?.isLoading = false
                    self?.errorMessage = message
                }
            }
        )
    }

    func beginEditPlace(_ place: FamilyPlaceItem) {
        editingPlaceId = place.id
        editingPlaceName = place.name
        editingPlaceAddress = place.address
    }

    func cancelEditPlace() {
        editingPlaceId = nil
        editingPlaceName = ""
        editingPlaceAddress = ""
    }

    func savePlace() {
        guard let placeId = editingPlaceId else { return }
        let name = editingPlaceName.trimmingCharacters(in: .whitespacesAndNewlines)
        let address = editingPlaceAddress.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty, !address.isEmpty else { return }
        isLoading = true
        errorMessage = nil
        bridge.updatePlace(
            placeId: placeId,
            name: name,
            address: address,
            onSuccess: { [weak self] id, placeName, placeAddress, located in
                Task { @MainActor in
                    guard let self else { return }
                    self.isLoading = false
                    if let index = self.places.firstIndex(where: { $0.id == id }) {
                        self.places[index].name = placeName
                        self.places[index].address = placeAddress
                        self.places[index].isLocated = located == "true"
                    }
                    self.cancelEditPlace()
                }
            },
            onError: { [weak self] message in
                Task { @MainActor in
                    self?.isLoading = false
                    self?.errorMessage = message
                }
            }
        )
    }

    func removePlace(_ placeId: String) {
        isLoading = true
        errorMessage = nil
        bridge.removePlace(
            placeId: placeId,
            onSuccess: { [weak self] in
                Task { @MainActor in
                    guard let self else { return }
                    self.isLoading = false
                    self.places.removeAll { $0.id == placeId }
                }
            },
            onError: { [weak self] message in
                Task { @MainActor in
                    self?.isLoading = false
                    self?.errorMessage = message
                }
            }
        )
    }

    func locatePlace(_ placeId: String) {
        isLoading = true
        errorMessage = nil
        bridge.locatePlace(
            placeId: placeId,
            onSuccess: { [weak self] id, placeName, placeAddress, located in
                Task { @MainActor in
                    guard let self else { return }
                    self.isLoading = false
                    if let index = self.places.firstIndex(where: { $0.id == id }) {
                        self.places[index].name = placeName
                        self.places[index].address = placeAddress
                        self.places[index].isLocated = located == "true"
                    }
                }
            },
            onError: { [weak self] message in
                Task { @MainActor in
                    self?.isLoading = false
                    self?.errorMessage = message
                }
            }
        )
    }

    /// Loads feeds without owning global busy state.
    /// Ready bootstraps `loadFeeds()` in parallel with `loadCalendar()`; clearing
    /// `isLoading` here would hide Agenda's Loading… while calendar is still in flight.
    func loadFeeds(clearLoadingWhenDone: Bool = false) {
        guard isOrganizer else {
            feeds = []
            return
        }
        bridge.listFeeds(
            onSuccess: { [weak self] ids, names, sourceUrls, kidIdsJoined, lastSyncedAts, lastSyncErrors, eventCounts in
                Task { @MainActor in
                    guard let self else { return }
                    var next: [FamilyFeedItem] = []
                    next.reserveCapacity(ids.count)
                    for index in 0..<ids.count {
                        let kids = Self.splitJoinedIds(kidIdsJoined[index])
                        next.append(
                            self.makeFeedItem(
                                id: ids[index],
                                name: names[index],
                                sourceUrl: sourceUrls[index],
                                kidIds: kids,
                                lastSyncedAt: lastSyncedAts[index],
                                lastSyncError: lastSyncErrors[index],
                                eventCount: eventCounts[index]
                            )
                        )
                    }
                    self.feeds = next
                    if clearLoadingWhenDone {
                        self.isLoading = false
                    }
                }
            },
            onError: { [weak self] message in
                Task { @MainActor in
                    if clearLoadingWhenDone {
                        self?.isLoading = false
                    }
                    self?.errorMessage = message
                }
            }
        )
    }

    /// Re-GET feeds list only — does not trigger Sync now.
    func refreshFeeds() {
        guard isOrganizer else { return }
        isLoading = true
        errorMessage = nil
        loadFeeds(clearLoadingWhenDone: true)
    }

    func loadCarpoolSummary() {
        carpoolLoading = true
        carpoolError = nil
        bridge.getCarpoolSummary(
            onSuccess: { [weak self] json in
                Task { @MainActor in
                    self?.applyCarpoolSummary(json)
                }
            },
            onError: { [weak self] message in
                Task { @MainActor in
                    self?.carpoolLoading = false
                    self?.carpoolError = message
                }
            }
        )
    }

    func enableCarpool(feedId: String) {
        runCarpoolMutation { bridge, onSuccess, onError in
            bridge.enableCarpool(feedId: feedId, onSuccess: onSuccess, onError: onError)
        }
    }

    func joinCarpool() {
        let code = carpoolCodeInput.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !code.isEmpty else { return }
        carpoolLoading = true
        carpoolError = nil
        bridge.joinCarpool(
            code: code,
            onSuccess: { [weak self] json in
                Task { @MainActor in
                    guard let self else { return }
                    self.applyCarpoolSummary(json)
                    self.carpoolCodeInput = ""
                    self.showCarpoolCodeForm = false
                    // Join may create+sync a feed; refresh like addFeed so Agenda/Feeds
                    // are not stuck on the empty bootstrap cache until Refresh / Load more.
                    self.loadFeeds()
                    self.loadCalendar()
                }
            },
            onError: { [weak self] message in
                Task { @MainActor in
                    self?.carpoolLoading = false
                    self?.carpoolError = message
                }
            }
        )
    }

    func requestCarpool(spaceId: String) {
        runCarpoolMutation { bridge, onSuccess, onError in
            bridge.requestCarpool(spaceId: spaceId, onSuccess: onSuccess, onError: onError)
        }
    }

    func admitCarpoolRequest(spaceId: String, requestId: String) {
        runCarpoolMutation { bridge, onSuccess, onError in
            bridge.admitCarpoolRequest(spaceId: spaceId, requestId: requestId, onSuccess: onSuccess, onError: onError)
        }
    }

    func declineCarpoolRequest(spaceId: String, requestId: String) {
        runCarpoolMutation { bridge, onSuccess, onError in
            bridge.declineCarpoolRequest(spaceId: spaceId, requestId: requestId, onSuccess: onSuccess, onError: onError)
        }
    }

    func regenerateCarpoolInvite(spaceId: String) {
        runCarpoolMutation { bridge, onSuccess, onError in
            bridge.regenerateCarpoolInvite(spaceId: spaceId, onSuccess: onSuccess, onError: onError)
        }
    }

    func leaveCarpool(spaceId: String) {
        runCarpoolMutation { bridge, onSuccess, onError in
            bridge.leaveCarpool(spaceId: spaceId, onSuccess: onSuccess, onError: onError)
        }
    }

    private func applyCarpoolSummary(_ json: String) {
        carpoolSummary = CarpoolSummaryView.decode(json)
        carpoolLoading = false
        carpoolError = nil
    }

    private func runCarpoolMutation(
        _ call: (AuthBridge, @escaping (String) -> Void, @escaping (String) -> Void) -> Void
    ) {
        carpoolLoading = true
        carpoolError = nil
        call(
            bridge,
            { [weak self] json in
                Task { @MainActor in
                    self?.applyCarpoolSummary(json)
                    self?.carpoolCodeInput = ""
                    self?.showCarpoolCodeForm = false
                    self?.pendingEnableFeed = nil
                }
            },
            { [weak self] message in
                Task { @MainActor in
                    self?.carpoolLoading = false
                    self?.carpoolError = message
                }
            }
        )
    }

    func toggleNewFeedKid(_ kidId: String) {
        if let index = newFeedKidIds.firstIndex(of: kidId) {
            newFeedKidIds.remove(at: index)
        } else {
            newFeedKidIds.append(kidId)
        }
    }

    func toggleEditingFeedKid(_ kidId: String) {
        if let index = editingFeedKidIds.firstIndex(of: kidId) {
            editingFeedKidIds.remove(at: index)
        } else {
            editingFeedKidIds.append(kidId)
        }
    }

    func addFeed() {
        let name = newFeedName.trimmingCharacters(in: .whitespacesAndNewlines)
        let sourceUrl = newFeedUrl.trimmingCharacters(in: .whitespacesAndNewlines)
        guard isOrganizer, !name.isEmpty, !sourceUrl.isEmpty else { return }
        isLoading = true
        errorMessage = nil
        bridge.createFeed(
            name: name,
            sourceUrl: sourceUrl,
            kidIds: newFeedKidIds,
            onSuccess: { [weak self] id, name, sourceUrl, kidIds, lastSyncedAt, lastSyncError, eventCount in
                Task { @MainActor in
                    guard let self else { return }
                    self.isLoading = false
                    self.feeds.append(
                        self.makeFeedItem(
                            id: id,
                            name: name,
                            sourceUrl: sourceUrl,
                            kidIds: kidIds,
                            lastSyncedAt: lastSyncedAt,
                            lastSyncError: lastSyncError,
                            eventCount: eventCount
                        )
                    )
                    self.newFeedName = ""
                    self.newFeedUrl = ""
                    self.newFeedKidIds = []
                    self.loadCalendar()
                }
            },
            onError: feedError
        )
    }

    func beginEditFeed(_ feed: FamilyFeedItem) {
        editingFeedId = feed.id
        editingFeedName = feed.name
        editingFeedUrl = feed.sourceUrl
        editingFeedKidIds = feed.kidIds
    }

    func cancelEditFeed() {
        editingFeedId = nil
        editingFeedName = ""
        editingFeedUrl = ""
        editingFeedKidIds = []
    }

    func saveFeed() {
        guard let feedId = editingFeedId else { return }
        let name = editingFeedName.trimmingCharacters(in: .whitespacesAndNewlines)
        let sourceUrl = editingFeedUrl.trimmingCharacters(in: .whitespacesAndNewlines)
        guard isOrganizer, !name.isEmpty, !sourceUrl.isEmpty else { return }
        isLoading = true
        errorMessage = nil
        bridge.updateFeed(
            feedId: feedId, name: name, sourceUrl: sourceUrl, kidIds: editingFeedKidIds,
            onSuccess: { [weak self] id, name, sourceUrl, kidIds, lastSyncedAt, lastSyncError, eventCount in
                Task { @MainActor in
                    guard let self else { return }
                    self.isLoading = false
                    let item = self.makeFeedItem(
                        id: id,
                        name: name,
                        sourceUrl: sourceUrl,
                        kidIds: kidIds,
                        lastSyncedAt: lastSyncedAt,
                        lastSyncError: lastSyncError,
                        eventCount: eventCount
                    )
                    if let index = self.feeds.firstIndex(where: { $0.id == id }) {
                        self.feeds[index] = item
                    }
                    self.cancelEditFeed()
                    self.loadCalendar()
                }
            },
            onError: feedError
        )
    }

    func removeFeed(_ feedId: String) {
        guard isOrganizer else { return }
        isLoading = true
        errorMessage = nil
        bridge.deleteFeed(
            feedId: feedId,
            onSuccess: { [weak self] in
                Task { @MainActor in
                    guard let self else { return }
                    self.feeds.removeAll { $0.id == feedId }
                    self.loadCalendar()
                }
            },
            onError: feedError
        )
    }

    func syncFeed(_ feedId: String) {
        guard isOrganizer else { return }
        isLoading = true
        errorMessage = nil
        bridge.syncFeed(
            feedId: feedId,
            onSuccess: { [weak self] id, name, sourceUrl, kidIds, lastSyncedAt, lastSyncError, eventCount in
                Task { @MainActor in
                    guard let self else { return }
                    let item = self.makeFeedItem(
                        id: id,
                        name: name,
                        sourceUrl: sourceUrl,
                        kidIds: kidIds,
                        lastSyncedAt: lastSyncedAt,
                        lastSyncError: lastSyncError,
                        eventCount: eventCount
                    )
                    if let index = self.feeds.firstIndex(where: { $0.id == id }) {
                        self.feeds[index] = item
                    }
                    self.loadCalendar()
                }
            },
            onError: feedError
        )
    }

    func loadCalendar(through loadedTo: String? = nil, backgroundRevalidate: Bool = false) {
        if backgroundRevalidate {
            calendarRevalidating = true
        }
        // Never set isLoading for Agenda bootstrap/revalidate — keeps Load more free of spinners.
        // Load more / mutations still set isLoading themselves.
        errorMessage = nil
        let today = ManualEventDateCodec.defaultCalendarWindow()
        let end = loadedTo ?? calendarLoadedTo
        let to = maxIsoInstant(today.to, end)
        let window = ManualEventDateCodec.calendarWindowThrough(loadedToIso: to)
        bridge.listCalendar(
            from: window.from,
            to: window.to,
            onSuccess: { [weak self]
                ids, sources, titles, startsAts, endsAts, locations, kidIdsJoined, feedIds, feedNames,
                leaveFromPlaceIds, leaveFromPlaceNames, leaveByAts, leaveByStatuses, leaveByReasons,
                coveragesJson, uncoveredKidIdsJoined, conflictsJson, rsvpsJson in
                Task { @MainActor in
                    guard let self else { return }
                    self.isLoading = false
                    self.calendarRevalidating = false
                    self.calendarLoadedTo = to
                    let fetchedAt = Self.nowEpochMillis()
                    self.calendarFetchedAtMs = fetchedAt
                    let incoming = Self.mapCalendarItems(
                        ids: ids,
                        sources: sources,
                        titles: titles,
                        startsAts: startsAts,
                        endsAts: endsAts,
                        locations: locations,
                        kidIdsJoined: kidIdsJoined,
                        feedIds: feedIds,
                        feedNames: feedNames,
                        leaveFromPlaceIds: leaveFromPlaceIds,
                        leaveFromPlaceNames: leaveFromPlaceNames,
                        leaveByAts: leaveByAts,
                        leaveByStatuses: leaveByStatuses,
                        leaveByReasons: leaveByReasons,
                        coveragesJson: coveragesJson,
                        uncoveredKidIdsJoined: uncoveredKidIdsJoined,
                        conflictsJson: conflictsJson,
                    rsvpsJson: rsvpsJson
                    )
                    self.calendarItems = CalendarLeaveByMerge.mergeCheapCalendarItems(
                        incoming: incoming,
                        cached: self.calendarItems
                    )
                    self.persistCalendarSnapshot(from: window.from, to: window.to, fetchedAt: fetchedAt)
                    self.fillLeaveByForWindow(from: window.from, to: window.to)
                }
            },
            onError: { [weak self] message in
                Task { @MainActor in
                    guard let self else { return }
                    self.isLoading = false
                    self.calendarRevalidating = false
                    self.errorMessage = message
                    if !self.calendarItems.isEmpty {
                        let shown = ManualEventDateCodec.calendarWindowThrough(
                            loadedToIso: self.calendarLoadedTo
                        )
                        self.fillLeaveByForWindow(from: shown.from, to: shown.to)
                    }
                }
            }
        )
    }

    /// Soft-TTL revalidate when returning to Calendar.
    func revalidateCalendarIfStale() {
        guard shell.tab == .calendar else { return }
        guard let fetchedAt = calendarFetchedAtMs else { return }
        guard !calendarRevalidating else { return }
        let nowMs = Self.nowEpochMillis()
        guard bridge.isCalendarCacheStale(fetchedAt: fetchedAt, nowMs: nowMs) else { return }
        loadCalendar(through: calendarLoadedTo, backgroundRevalidate: !calendarItems.isEmpty)
    }

    func loadMoreCalendar() {
        isLoading = true
        errorMessage = nil
        let page = ManualEventDateCodec.advanceCalendarWindow(fromIso: calendarLoadedTo)
        bridge.listCalendar(
            from: page.from,
            to: page.to,
            onSuccess: { [weak self]
                ids, sources, titles, startsAts, endsAts, locations, kidIdsJoined, feedIds, feedNames,
                leaveFromPlaceIds, leaveFromPlaceNames, leaveByAts, leaveByStatuses, leaveByReasons,
                coveragesJson, uncoveredKidIdsJoined, conflictsJson, rsvpsJson in
                Task { @MainActor in
                    guard let self else { return }
                    self.isLoading = false
                    let more = Self.mapCalendarItems(
                        ids: ids,
                        sources: sources,
                        titles: titles,
                        startsAts: startsAts,
                        endsAts: endsAts,
                        locations: locations,
                        kidIdsJoined: kidIdsJoined,
                        feedIds: feedIds,
                        feedNames: feedNames,
                        leaveFromPlaceIds: leaveFromPlaceIds,
                        leaveFromPlaceNames: leaveFromPlaceNames,
                        leaveByAts: leaveByAts,
                        leaveByStatuses: leaveByStatuses,
                        leaveByReasons: leaveByReasons,
                        coveragesJson: coveragesJson,
                        uncoveredKidIdsJoined: uncoveredKidIdsJoined,
                        conflictsJson: conflictsJson,
                    rsvpsJson: rsvpsJson
                    )
                    var seen = Set(self.calendarItems.map { "\($0.source):\($0.id)" })
                    for item in more where !seen.contains("\(item.source):\(item.id)") {
                        seen.insert("\(item.source):\(item.id)")
                        self.calendarItems.append(item)
                    }
                    self.calendarItems.sort {
                        if $0.startsAt == $1.startsAt {
                            return "\($0.source):\($0.id)" < "\($1.source):\($1.id)"
                        }
                        return $0.startsAt < $1.startsAt
                    }
                    self.calendarLoadedTo = page.to
                    let window = ManualEventDateCodec.calendarWindowThrough(loadedToIso: page.to)
                    let fetchedAt = Self.nowEpochMillis()
                    self.calendarFetchedAtMs = fetchedAt
                    self.persistCalendarSnapshot(from: window.from, to: page.to, fetchedAt: fetchedAt)
                    let gen = self.leaveByFillGen
                    Task { @MainActor in
                        await self.waitForNearTermFill()
                        await self.fetchAndApplyLeaveBy(from: page.from, to: page.to, gen: gen)
                    }
                }
            },
            onError: eventError
        )
    }

    func setCalendarLeaveFrom(item: FamilyCalendarItem, placeId: String) {
        guard item.leaveFromPlaceId != placeId else { return }
        isLoading = true
        errorMessage = nil
        bridge.setCalendarLeaveFrom(
            source: item.source,
            itemId: item.id,
            placeId: placeId,
            onSuccess: { [weak self]
                id, source, title, startsAt, endsAt, location, kidIdsJoined, feedId, feedName,
                leaveFromPlaceId, leaveFromPlaceName, leaveByAt, leaveByStatus, leaveByReason,
                coveragesJson, uncoveredKidIdsJoined, conflictsJson, rsvpsJson in
                Task { @MainActor in
                    guard let self else { return }
                    self.isLoading = false
                    self.replaceCalendarItem(
                        Self.calendarItem(
                            id: id,
                            source: source,
                            title: title,
                            startsAt: startsAt,
                            endsAt: endsAt,
                            location: location,
                            kidIdsJoined: kidIdsJoined,
                            feedId: feedId,
                            feedName: feedName,
                            leaveFromPlaceId: leaveFromPlaceId,
                            leaveFromPlaceName: leaveFromPlaceName,
                            leaveByAt: leaveByAt,
                            leaveByStatus: leaveByStatus,
                            leaveByReason: leaveByReason,
                            coveragesJson: coveragesJson,
                            uncoveredKidIdsJoined: uncoveredKidIdsJoined,
                            conflictsJson: conflictsJson,
                        rsvpsJson: rsvpsJson
                        )
                    )
                }
            },
            onError: eventError
        )
    }

    func setCalendarRsvp(item: FamilyCalendarItem, kidId: String, status: String) {
        guard RsvpDisplay.statusForKid(item: item, kidId: kidId) != status else { return }
        isLoading = true
        errorMessage = nil
        bridge.setCalendarRsvp(
            source: item.source,
            itemId: item.id,
            kidId: kidId,
            status: status,
            onSuccess: { [weak self]
                id, source, title, startsAt, endsAt, location, kidIdsJoined, feedId, feedName,
                leaveFromPlaceId, leaveFromPlaceName, leaveByAt, leaveByStatus, leaveByReason,
                coveragesJson, uncoveredKidIdsJoined, conflictsJson, rsvpsJson in
                Task { @MainActor in
                    guard let self else { return }
                    self.isLoading = false
                    self.replaceCalendarItem(
                        Self.calendarItem(
                            id: id,
                            source: source,
                            title: title,
                            startsAt: startsAt,
                            endsAt: endsAt,
                            location: location,
                            kidIdsJoined: kidIdsJoined,
                            feedId: feedId,
                            feedName: feedName,
                            leaveFromPlaceId: leaveFromPlaceId,
                            leaveFromPlaceName: leaveFromPlaceName,
                            leaveByAt: leaveByAt,
                            leaveByStatus: leaveByStatus,
                            leaveByReason: leaveByReason,
                            coveragesJson: coveragesJson,
                            uncoveredKidIdsJoined: uncoveredKidIdsJoined,
                            conflictsJson: conflictsJson,
                            rsvpsJson: rsvpsJson
                        )
                    )
                }
            },
            onError: eventError
        )
    }

    func setDefaultLeaveFrom(placeId: String?) {
        if defaultLeaveFromPlaceId == placeId { return }
        isLoading = true
        errorMessage = nil
        bridge.setDefaultLeaveFrom(
            placeId: placeId,
            onSuccess: { [weak self] id, name in
                Task { @MainActor in
                    guard let self else { return }
                    self.isLoading = false
                    self.defaultLeaveFromPlaceId = id.isEmpty ? nil : id
                    self.defaultLeaveFromPlaceName = name.isEmpty ? nil : name
                }
            },
            onError: eventError
        )
    }

    func assignCoverage(item: FamilyCalendarItem, coveringAdultId: String, kidIds: [String]) {
        guard !coveringAdultId.isEmpty, !kidIds.isEmpty else { return }
        let itemKey = coverageItemKey(for: item)
        isLoading = true
        errorMessage = nil
        coverageActionErrors.removeValue(forKey: itemKey)
        bridge.assignCalendarCoverage(
            source: item.source,
            itemId: item.id,
            coveringAdultId: coveringAdultId.trimmingCharacters(in: .whitespacesAndNewlines),
            kidIds: kidIds.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty },
            onSuccess: { [weak self]
                id, source, title, startsAt, endsAt, location, kidIdsJoined, feedId, feedName,
                leaveFromPlaceId, leaveFromPlaceName, leaveByAt, leaveByStatus, leaveByReason,
                coveragesJson, uncoveredKidIdsJoined, conflictsJson, rsvpsJson in
                Task { @MainActor in
                    guard let self else { return }
                    self.isLoading = false
                    self.coverageActionErrors.removeValue(forKey: itemKey)
                    self.replaceCalendarItem(
                        Self.calendarItem(
                            id: id,
                            source: source,
                            title: title,
                            startsAt: startsAt,
                            endsAt: endsAt,
                            location: location,
                            kidIdsJoined: kidIdsJoined,
                            feedId: feedId,
                            feedName: feedName,
                            leaveFromPlaceId: leaveFromPlaceId,
                            leaveFromPlaceName: leaveFromPlaceName,
                            leaveByAt: leaveByAt,
                            leaveByStatus: leaveByStatus,
                            leaveByReason: leaveByReason,
                            coveragesJson: coveragesJson,
                            uncoveredKidIdsJoined: uncoveredKidIdsJoined,
                            conflictsJson: conflictsJson,
                        rsvpsJson: rsvpsJson
                        )
                    )
                }
            },
            onError: { [weak self] message in
            Task { @MainActor in
                guard let self else { return }
                self.isLoading = false
                self.coverageActionErrors[itemKey] =
                    ConflictDisplay.coverageDoubleBookMessage(message)
            }
        }
        )
    }

    func confirmCoverage(assignmentId: String) {
        let itemKey = coverageItemKey(forAssignmentId: assignmentId)
        isLoading = true
        errorMessage = nil
        if let itemKey {
            coverageActionErrors.removeValue(forKey: itemKey)
        }
        bridge.confirmCalendarCoverage(
            assignmentId: assignmentId,
            onSuccess: { [weak self]
                id, source, title, startsAt, endsAt, location, kidIdsJoined, feedId, feedName,
                leaveFromPlaceId, leaveFromPlaceName, leaveByAt, leaveByStatus, leaveByReason,
                coveragesJson, uncoveredKidIdsJoined, conflictsJson, rsvpsJson in
                Task { @MainActor in
                    guard let self else { return }
                    self.isLoading = false
                    if let itemKey {
                        self.coverageActionErrors.removeValue(forKey: itemKey)
                    }
                    self.replaceCalendarItem(
                        Self.calendarItem(
                            id: id,
                            source: source,
                            title: title,
                            startsAt: startsAt,
                            endsAt: endsAt,
                            location: location,
                            kidIdsJoined: kidIdsJoined,
                            feedId: feedId,
                            feedName: feedName,
                            leaveFromPlaceId: leaveFromPlaceId,
                            leaveFromPlaceName: leaveFromPlaceName,
                            leaveByAt: leaveByAt,
                            leaveByStatus: leaveByStatus,
                            leaveByReason: leaveByReason,
                            coveragesJson: coveragesJson,
                            uncoveredKidIdsJoined: uncoveredKidIdsJoined,
                            conflictsJson: conflictsJson,
                        rsvpsJson: rsvpsJson
                        )
                    )
                }
            },
            onError: { [weak self] message in
            Task { @MainActor in
                guard let self else { return }
                self.isLoading = false
                let mapped = ConflictDisplay.coverageDoubleBookMessage(message)
                if let itemKey {
                    self.coverageActionErrors[itemKey] = mapped
                } else {
                    self.errorMessage = mapped
                }
            }
        }
        )
    }

    func declineCoverage(assignmentId: String) {
        isLoading = true
        errorMessage = nil
        bridge.declineCalendarCoverage(
            assignmentId: assignmentId,
            onSuccess: { [weak self]
                id, source, title, startsAt, endsAt, location, kidIdsJoined, feedId, feedName,
                leaveFromPlaceId, leaveFromPlaceName, leaveByAt, leaveByStatus, leaveByReason,
                coveragesJson, uncoveredKidIdsJoined, conflictsJson, rsvpsJson in
                Task { @MainActor in
                    guard let self else { return }
                    self.isLoading = false
                    self.replaceCalendarItem(
                        Self.calendarItem(
                            id: id,
                            source: source,
                            title: title,
                            startsAt: startsAt,
                            endsAt: endsAt,
                            location: location,
                            kidIdsJoined: kidIdsJoined,
                            feedId: feedId,
                            feedName: feedName,
                            leaveFromPlaceId: leaveFromPlaceId,
                            leaveFromPlaceName: leaveFromPlaceName,
                            leaveByAt: leaveByAt,
                            leaveByStatus: leaveByStatus,
                            leaveByReason: leaveByReason,
                            coveragesJson: coveragesJson,
                            uncoveredKidIdsJoined: uncoveredKidIdsJoined,
                            conflictsJson: conflictsJson,
                        rsvpsJson: rsvpsJson
                        )
                    )
                }
            },
            onError: eventError
        )
    }

    func removeCoverage(assignmentId: String) {
        isLoading = true
        errorMessage = nil
        bridge.removeCalendarCoverage(
            assignmentId: assignmentId,
            onSuccess: { [weak self]
                id, source, title, startsAt, endsAt, location, kidIdsJoined, feedId, feedName,
                leaveFromPlaceId, leaveFromPlaceName, leaveByAt, leaveByStatus, leaveByReason,
                coveragesJson, uncoveredKidIdsJoined, conflictsJson, rsvpsJson in
                Task { @MainActor in
                    guard let self else { return }
                    self.isLoading = false
                    self.replaceCalendarItem(
                        Self.calendarItem(
                            id: id,
                            source: source,
                            title: title,
                            startsAt: startsAt,
                            endsAt: endsAt,
                            location: location,
                            kidIdsJoined: kidIdsJoined,
                            feedId: feedId,
                            feedName: feedName,
                            leaveFromPlaceId: leaveFromPlaceId,
                            leaveFromPlaceName: leaveFromPlaceName,
                            leaveByAt: leaveByAt,
                            leaveByStatus: leaveByStatus,
                            leaveByReason: leaveByReason,
                            coveragesJson: coveragesJson,
                            uncoveredKidIdsJoined: uncoveredKidIdsJoined,
                            conflictsJson: conflictsJson,
                        rsvpsJson: rsvpsJson
                        )
                    )
                }
            },
            onError: eventError
        )
    }

    func toggleNewEventKid(_ kidId: String) {
        if let index = newEventKidIds.firstIndex(of: kidId) {
            newEventKidIds.remove(at: index)
        } else {
            newEventKidIds.append(kidId)
        }
    }

    func toggleEditingEventKid(_ kidId: String) {
        if let index = editingEventKidIds.firstIndex(of: kidId) {
            editingEventKidIds.remove(at: index)
        } else {
            editingEventKidIds.append(kidId)
        }
    }

    func addEvent() {
        let title = newEventTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty, !newEventKidIds.isEmpty else { return }
        if let message = ManualEventDateCodec.validationMessage(
            startsAt: newEventStartsAtDate,
            endsAt: newEventHasEndsAt ? newEventEndsAtDate : nil
        ) {
            errorMessage = message
            return
        }
        let startsAt = ManualEventDateCodec.isoString(from: newEventStartsAtDate)
        let startsDate = newEventStartsAtDate
        let endsAt = newEventHasEndsAt ? ManualEventDateCodec.isoString(from: newEventEndsAtDate) : ""
        isLoading = true
        errorMessage = nil
        bridge.createEvent(
            title: title,
            startsAt: startsAt,
            endsAt: endsAt,
            location: newEventLocation.trimmingCharacters(in: .whitespacesAndNewlines),
            kidIds: newEventKidIds,
            onSuccess: { [weak self] _, _, _, _, _, _ in
                Task { @MainActor in
                    guard let self else { return }
                    self.closeEventCompose()
                    let nextTo = ManualEventDateCodec.ensureCalendarWindowCovers(
                        loadedToIso: self.calendarLoadedTo,
                        instant: startsDate
                    )
                    self.loadCalendar(through: nextTo)
                }
            },
            onError: eventError
        )
    }

    func beginEditEvent(_ item: FamilyCalendarItem) {
        guard item.isManual else { return }
        editingEventTitle = item.title
        editingEventStartsAtDate = ManualEventDateCodec.date(fromIso: item.startsAt) ?? Date()
        if let endsAt = item.endsAt, let endsDate = ManualEventDateCodec.date(fromIso: endsAt) {
            editingEventEndsAtDate = endsDate
            editingEventHasEndsAt = true
        } else {
            editingEventEndsAtDate = editingEventStartsAtDate.addingTimeInterval(3600)
            editingEventHasEndsAt = false
        }
        editingEventLocation = item.location ?? ""
        editingEventKidIds = item.kidIds
        var compose = eventCompose
        compose.openEdit(eventId: item.id)
        eventCompose = compose
        errorMessage = nil
    }

    func cancelEditEvent() {
        closeEventCompose()
    }

    func saveEvent() {
        guard let eventId = eventCompose.editingEventId else { return }
        let title = editingEventTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty, !editingEventKidIds.isEmpty else { return }
        if let message = ManualEventDateCodec.validationMessage(
            startsAt: editingEventStartsAtDate,
            endsAt: editingEventHasEndsAt ? editingEventEndsAtDate : nil
        ) {
            errorMessage = message
            return
        }
        let startsAt = ManualEventDateCodec.isoString(from: editingEventStartsAtDate)
        let startsDate = editingEventStartsAtDate
        let endsAt = editingEventHasEndsAt ? ManualEventDateCodec.isoString(from: editingEventEndsAtDate) : ""
        isLoading = true
        errorMessage = nil
        bridge.updateEvent(
            eventId: eventId,
            title: title,
            startsAt: startsAt,
            endsAt: endsAt,
            location: editingEventLocation.trimmingCharacters(in: .whitespacesAndNewlines),
            kidIds: editingEventKidIds,
            onSuccess: { [weak self] _, _, _, _, _, _ in
                Task { @MainActor in
                    guard let self else { return }
                    self.closeEventCompose()
                    let nextTo = ManualEventDateCodec.ensureCalendarWindowCovers(
                        loadedToIso: self.calendarLoadedTo,
                        instant: startsDate
                    )
                    self.loadCalendar(through: nextTo)
                }
            },
            onError: eventError
        )
    }

    func removeEvent(_ eventId: String) {
        isLoading = true
        errorMessage = nil
        bridge.removeEvent(
            eventId: eventId,
            onSuccess: { [weak self] in
                Task { @MainActor in
                    self?.loadCalendar()
                }
            },
            onError: eventError
        )
    }

    private func clearEditingEventFields() {
        editingEventTitle = ""
        editingEventStartsAtDate = Date()
        editingEventEndsAtDate = Date()
        editingEventHasEndsAt = false
        editingEventLocation = ""
        editingEventKidIds = []
    }

    private func clearNewEventFields() {
        newEventTitle = ""
        newEventStartsAtDate = Date().addingTimeInterval(15 * 60)
        newEventEndsAtDate = Date().addingTimeInterval(75 * 60)
        newEventHasEndsAt = false
        newEventLocation = ""
        newEventKidIds = []
    }

    private func clearEventComposeFields() {
        clearNewEventFields()
        clearEditingEventFields()
    }

    private func makeFeedItem(
        id: String,
        name: String,
        sourceUrl: String,
        kidIds: [String],
        lastSyncedAt: String,
        lastSyncError: String,
        eventCount: String
    ) -> FamilyFeedItem {
        FamilyFeedItem(
            id: id,
            name: name,
            sourceUrl: sourceUrl,
            kidIds: kidIds,
            lastSyncedAt: lastSyncedAt.isEmpty ? nil : lastSyncedAt,
            lastSyncError: lastSyncError.isEmpty ? nil : lastSyncError,
            eventCount: Int(eventCount) ?? 0
        )
    }

    private static func mapCalendarItems(
        ids: [String],
        sources: [String],
        titles: [String],
        startsAts: [String],
        endsAts: [String],
        locations: [String],
        kidIdsJoined: [String],
        feedIds: [String],
        feedNames: [String],
        leaveFromPlaceIds: [String],
        leaveFromPlaceNames: [String],
        leaveByAts: [String],
        leaveByStatuses: [String],
        leaveByReasons: [String],
        coveragesJson: [String],
        uncoveredKidIdsJoined: [String],
        conflictsJson: [String],
        rsvpsJson: [String]
    ) -> [FamilyCalendarItem] {
        (0..<ids.count).map { index in
            calendarItem(
                id: ids[index],
                source: sources[index],
                title: titles[index],
                startsAt: startsAts[index],
                endsAt: endsAts[index],
                location: locations[index],
                kidIdsJoined: kidIdsJoined[index],
                feedId: feedIds[index],
                feedName: feedNames[index],
                leaveFromPlaceId: leaveFromPlaceIds[index],
                leaveFromPlaceName: leaveFromPlaceNames[index],
                leaveByAt: leaveByAts[index],
                leaveByStatus: leaveByStatuses[index],
                leaveByReason: leaveByReasons[index],
                coveragesJson: coveragesJson[index],
                uncoveredKidIdsJoined: uncoveredKidIdsJoined[index],
                conflictsJson: conflictsJson[index],
            rsvpsJson: rsvpsJson[index]
            )
        }
    }

    private static func calendarItem(
        id: String,
        source: String,
        title: String,
        startsAt: String,
        endsAt: String,
        location: String,
        kidIdsJoined: String,
        feedId: String,
        feedName: String,
        leaveFromPlaceId: String,
        leaveFromPlaceName: String,
        leaveByAt: String,
        leaveByStatus: String,
        leaveByReason: String,
        coveragesJson: String,
        uncoveredKidIdsJoined: String,
        conflictsJson: String,
        rsvpsJson: String
    ) -> FamilyCalendarItem {
        FamilyCalendarItem(
            id: id,
            source: source,
            title: title,
            startsAt: startsAt,
            endsAt: endsAt.isEmpty ? nil : endsAt,
            location: location.isEmpty ? nil : location,
            kidIds: splitJoinedIds(kidIdsJoined),
            feedId: feedId.isEmpty ? nil : feedId,
            feedName: feedName.isEmpty ? nil : feedName,
            leaveFromPlaceId: leaveFromPlaceId.isEmpty ? nil : leaveFromPlaceId,
            leaveFromPlaceName: leaveFromPlaceName.isEmpty ? nil : leaveFromPlaceName,
            leaveByAt: leaveByAt.isEmpty ? nil : leaveByAt,
            leaveByStatus: leaveByStatus,
            leaveByReason: leaveByReason.isEmpty ? nil : leaveByReason,
            coverages: parseCoveragesJson(coveragesJson),
            uncoveredKidIds: splitJoinedIds(uncoveredKidIdsJoined),
            conflicts: parseConflictsJson(conflictsJson),
            rsvps: parseRsvpsJson(rsvpsJson)
        )
    }

    private func persistCalendarSnapshot(from: String, to: String, fetchedAt: Int64) {
        bridge.saveCalendarCache(
            from: from,
            to: to,
            fetchedAt: fetchedAt,
            ids: calendarItems.map(\.id),
            sources: calendarItems.map(\.source),
            titles: calendarItems.map(\.title),
            startsAts: calendarItems.map(\.startsAt),
            endsAts: calendarItems.map { $0.endsAt ?? "" },
            locations: calendarItems.map { $0.location ?? "" },
            kidIdsJoined: calendarItems.map { $0.kidIds.joined(separator: ",") },
            feedIds: calendarItems.map { $0.feedId ?? "" },
            feedNames: calendarItems.map { $0.feedName ?? "" },
            leaveFromPlaceIds: calendarItems.map { $0.leaveFromPlaceId ?? "" },
            leaveFromPlaceNames: calendarItems.map { $0.leaveFromPlaceName ?? "" },
            leaveByAts: calendarItems.map { $0.leaveByAt ?? "" },
            leaveByStatuses: calendarItems.map(\.leaveByStatus),
            leaveByReasons: calendarItems.map { $0.leaveByReason ?? "" },
            coveragesJson: calendarItems.map { Self.encodeCoveragesJson($0.coverages) },
            uncoveredKidIdsJoined: calendarItems.map {
                $0.uncoveredKidIds.joined(separator: ",")
            },
            conflictsJson: calendarItems.map { Self.encodeConflictsJson($0.conflicts) },
            rsvpsJson: calendarItems.map { Self.encodeRsvpsJson($0.rsvps) }
        )
    }

    private func persistFilledCalendarItems() {
        let window = ManualEventDateCodec.calendarWindowThrough(loadedToIso: calendarLoadedTo)
        let fetchedAt = calendarFetchedAtMs ?? Self.nowEpochMillis()
        persistCalendarSnapshot(from: window.from, to: window.to, fetchedAt: fetchedAt)
    }

    private func cancelLeaveByFill() {
        leaveByFillGen += 1
        resolveNearTermGate()
    }

    private func armNearTermGate() {
        guard nearTermDone else { return }
        nearTermDone = false
    }

    private func resolveNearTermGate() {
        guard !nearTermDone else { return }
        nearTermDone = true
        nearTermContinuation?.resume()
        nearTermContinuation = nil
    }

    private func waitForNearTermFill() async {
        if nearTermDone { return }
        await withCheckedContinuation { continuation in
            if nearTermDone {
                continuation.resume()
            } else {
                nearTermContinuation = continuation
            }
        }
    }

    private func fillLeaveByForWindow(from loadedFrom: String, to loadedTo: String) {
        leaveByFillGen += 1
        let gen = leaveByFillGen
        armNearTermGate()
        Task { @MainActor in
            if let near = ManualEventDateCodec.nearTermLeaveByWindow(
                loadedFromIso: loadedFrom,
                loadedToIso: loadedTo
            ) {
                await self.fetchAndApplyLeaveBy(from: near.from, to: near.to, gen: gen)
            }
            if gen == self.leaveByFillGen {
                self.resolveNearTermGate()
            }
            guard gen == self.leaveByFillGen else { return }
            if let rest = ManualEventDateCodec.remainderAfterNearTermLeaveByWindow(
                loadedFromIso: loadedFrom,
                loadedToIso: loadedTo
            ) {
                await self.fetchAndApplyLeaveBy(from: rest.from, to: rest.to, gen: gen)
            }
        }
    }

    private func fetchAndApplyLeaveBy(from: String, to: String, gen: Int) async {
        let rows = await listCalendarLeaveBy(from: from, to: to)
        guard gen == leaveByFillGen else { return }
        guard let rows else { return }
        calendarItems = CalendarLeaveByMerge.applyLeaveByFillIn(items: calendarItems, rows: rows)
        persistFilledCalendarItems()
    }

    private func listCalendarLeaveBy(from: String, to: String) async -> [FamilyCalendarLeaveBy]? {
        await withCheckedContinuation { continuation in
            bridge.listCalendarLeaveBy(
                from: from,
                to: to,
                onSuccess: { ids, sources, leaveFromPlaceIds, leaveFromPlaceNames, leaveByAts,
                    leaveByStatuses, leaveByReasons in
                    let rows = (0..<ids.count).map { index in
                        FamilyCalendarLeaveBy(
                            id: ids[index],
                            source: sources[index],
                            leaveFromPlaceId: leaveFromPlaceIds[index].isEmpty
                                ? nil : leaveFromPlaceIds[index],
                            leaveFromPlaceName: leaveFromPlaceNames[index].isEmpty
                                ? nil : leaveFromPlaceNames[index],
                            leaveByAt: leaveByAts[index].isEmpty ? nil : leaveByAts[index],
                            leaveByStatus: leaveByStatuses[index],
                            leaveByReason: leaveByReasons[index].isEmpty
                                ? nil : leaveByReasons[index]
                        )
                    }
                    continuation.resume(returning: rows)
                },
                onError: { _ in
                    // Keep last known leave-by; do not wipe Agenda.
                    continuation.resume(returning: nil)
                }
            )
        }
    }

    private func replaceCalendarItem(_ updated: FamilyCalendarItem) {
        if let index = calendarItems.firstIndex(where: {
            $0.source == updated.source && $0.id == updated.id
        }) {
            calendarItems[index] = updated
        }
        bridge.patchCalendarCacheItem(
            id: updated.id,
            source: updated.source,
            title: updated.title,
            startsAt: updated.startsAt,
            endsAt: updated.endsAt ?? "",
            location: updated.location ?? "",
            kidIdsJoined: updated.kidIds.joined(separator: ","),
            feedId: updated.feedId ?? "",
            feedName: updated.feedName ?? "",
            leaveFromPlaceId: updated.leaveFromPlaceId ?? "",
            leaveFromPlaceName: updated.leaveFromPlaceName ?? "",
            leaveByAt: updated.leaveByAt ?? "",
            leaveByStatus: updated.leaveByStatus,
            leaveByReason: updated.leaveByReason ?? "",
            coveragesJson: Self.encodeCoveragesJson(updated.coverages),
            uncoveredKidIdsJoined: updated.uncoveredKidIds.joined(separator: ","),
            conflictsJson: Self.encodeConflictsJson(updated.conflicts),
            rsvpsJson: Self.encodeRsvpsJson(updated.rsvps)
        )
    }

    private static func encodeCoveragesJson(_ coverages: [FamilyCoverageAssignment]) -> String {
        guard let data = try? JSONEncoder().encode(coverages),
              let json = String(data: data, encoding: .utf8)
        else { return "[]" }
        return json
    }

    private static func encodeConflictsJson(_ conflicts: [FamilyCalendarConflict]) -> String {
        guard let data = try? JSONEncoder().encode(conflicts),
              let json = String(data: data, encoding: .utf8)
        else { return "[]" }
        return json
    }

    private static func nowEpochMillis() -> Int64 {
        Int64(Date().timeIntervalSince1970 * 1000)
    }

    private func maxIsoInstant(_ a: String, _ b: String) -> String {
        a >= b ? a : b
    }

    private static func parseCoveragesJson(_ json: String) -> [FamilyCoverageAssignment] {
        let trimmed = json.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, let data = trimmed.data(using: .utf8) else { return [] }
        return (try? JSONDecoder().decode([FamilyCoverageAssignment].self, from: data)) ?? []
    }

    private static func parseConflictsJson(_ json: String) -> [FamilyCalendarConflict] {
        let trimmed = json.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, let data = trimmed.data(using: .utf8) else { return [] }
        return (try? JSONDecoder().decode([FamilyCalendarConflict].self, from: data)) ?? []
    }

    private static func parseRsvpsJson(_ json: String) -> [FamilyCalendarRsvp] {
        guard let data = json.data(using: .utf8),
              let decoded = try? JSONDecoder().decode([FamilyCalendarRsvp].self, from: data)
        else {
            return []
        }
        return decoded
    }

    private static func encodeRsvpsJson(_ rsvps: [FamilyCalendarRsvp]) -> String {
        guard let data = try? JSONEncoder().encode(rsvps),
              let json = String(data: data, encoding: .utf8)
        else {
            return "[]"
        }
        return json
    }

    private static func splitJoinedIds(_ joined: String) -> [String] {
        joined
            .split(separator: ",", omittingEmptySubsequences: true)
            .map(String.init)
    }

    private var feedError: (String) -> Void {
        { [weak self] message in
            Task { @MainActor in
                self?.isLoading = false
                self?.errorMessage = message
            }
        }
    }


    private var eventError: (String) -> Void {
        { [weak self] message in
            Task { @MainActor in
                self?.isLoading = false
                self?.errorMessage = message
            }
        }
    }

    private func applyReady(
        title: String,
        email: String,
        adultId: String,
        displayName: String?,
        role: String,
        inviteCode: String?,
        memberAdultIds: [String],
        memberEmails: [String],
        memberNames: [String],
        memberRoles: [String],
        kidIds: [String],
        kidNames: [String],
        placeIds: [String],
        placeNames: [String],
        placeAddresses: [String],
        placeLocated: [String],
        defaultLeaveFromPlaceId: String,
        defaultLeaveFromPlaceName: String,
        deferNetworkLoads: Bool = false
    ) {
        familyTitle = title
        signedInEmail = email
        currentAdultId = adultId
        adultDisplayName = displayName ?? ""
        hasDisplayName = !(displayName ?? "").isEmpty
        familyRole = role
        if let inviteCode, !inviteCode.isEmpty {
            self.inviteCode = inviteCode
        } else if !deferNetworkLoads {
            self.inviteCode = inviteCode ?? ""
        }
        members = (0..<memberAdultIds.count).map { index in
            FamilyMemberItem(
                adultId: memberAdultIds[index],
                email: memberEmails[index],
                displayName: memberNames[index],
                role: memberRoles[index]
            )
        }
        kids = zip(kidIds, kidNames).map { FamilyKidItem(id: $0.0, displayName: $0.1) }
        places = (0..<placeIds.count).map { index in
            FamilyPlaceItem(
                id: placeIds[index],
                name: placeNames[index],
                address: placeAddresses[index],
                isLocated: placeLocated[index] == "true"
            )
        }
        self.defaultLeaveFromPlaceId =
            defaultLeaveFromPlaceId.isEmpty ? nil : defaultLeaveFromPlaceId
        self.defaultLeaveFromPlaceName =
            defaultLeaveFromPlaceName.isEmpty ? nil : defaultLeaveFromPlaceName
        agendaKidFilter = nil
        familyPhase = .ready
        shell.resetToCalendar()
        let cacheHit = bridge.peekCalendarCache { [self]
            from, to, fetchedAt, ids, sources, titles, startsAts, endsAts, locations, kidIdsJoined,
            feedIds, feedNames, leaveFromPlaceIds, leaveFromPlaceNames, leaveByAts, leaveByStatuses,
            leaveByReasons, coveragesJson, uncoveredKidIdsJoined, conflictsJson, rsvpsJson in
            _ = from
            self.calendarLoadedTo = to
            // Callback Long parameters are boxed as KotlinLong (unlike BridgeHit int64 properties).
            self.calendarFetchedAtMs = fetchedAt.int64Value
            self.calendarItems = Self.mapCalendarItems(
                ids: ids,
                sources: sources,
                titles: titles,
                startsAts: startsAts,
                endsAts: endsAts,
                locations: locations,
                kidIdsJoined: kidIdsJoined,
                feedIds: feedIds,
                feedNames: feedNames,
                leaveFromPlaceIds: leaveFromPlaceIds,
                leaveFromPlaceNames: leaveFromPlaceNames,
                leaveByAts: leaveByAts,
                leaveByStatuses: leaveByStatuses,
                leaveByReasons: leaveByReasons,
                coveragesJson: coveragesJson,
                uncoveredKidIdsJoined: uncoveredKidIdsJoined,
                conflictsJson: conflictsJson,
            rsvpsJson: rsvpsJson
            )
        }
        let paintedFromCache = cacheHit && !calendarItems.isEmpty
        if paintedFromCache {
            calendarRevalidating = true
            armNearTermGate()
        } else if calendarItems.isEmpty {
            calendarLoadedTo = ManualEventDateCodec.defaultCalendarWindow().to
            calendarFetchedAtMs = nil
            calendarRevalidating = false
        } else {
            calendarRevalidating = true
        }
        if deferNetworkLoads {
            return
        }
        if isOrganizer {
            bridge.loadInvite(
                onSuccess: { [weak self] code in
                    Task { @MainActor in
                        self?.inviteCode = code
                    }
                },
                onError: { _ in }
            )
        }
        loadFeeds()
        loadCalendar(
            through: calendarLoadedTo,
            backgroundRevalidate: !calendarItems.isEmpty
        )
    }

    private func paintBootstrapFeeds() {
        _ = bridge.peekBootstrapFeeds { [self]
            ids, names, sourceUrls, kidIdsJoined, lastSyncedAts, lastSyncErrors, eventCounts in
            var next: [FamilyFeedItem] = []
            next.reserveCapacity(ids.count)
            for index in 0..<ids.count {
                next.append(
                    self.makeFeedItem(
                        id: ids[index],
                        name: names[index],
                        sourceUrl: sourceUrls[index],
                        kidIds: Self.splitJoinedIds(kidIdsJoined[index]),
                        lastSyncedAt: lastSyncedAts[index],
                        lastSyncError: lastSyncErrors[index],
                        eventCount: eventCounts[index]
                    )
                )
            }
            self.feeds = next
        }
    }

    private func finishSignedOut(error: String? = nil) {
        isLoading = false
        phase = .signedOut
        resetFamilyFields()
        code = ""
        devHint = nil
        errorMessage = error
    }

    private func resetFamilyFields() {
        signedInEmail = ""
        currentAdultId = ""
        adultDisplayName = ""
        circleNameInput = ""
        inviteCodeInput = ""
        inviteCode = ""
        kids = []
        places = []
        feeds = []
        calendarItems = []
        calendarLoadedTo = ManualEventDateCodec.defaultCalendarWindow().to
        calendarFetchedAtMs = nil
        calendarRevalidating = false
        cancelLeaveByFill()
        agendaKidFilter = nil
        defaultLeaveFromPlaceId = nil
        defaultLeaveFromPlaceName = nil
        newFeedName = ""
        newFeedUrl = ""
        newFeedKidIds = []
        newEventTitle = ""
        newEventStartsAtDate = Date().addingTimeInterval(15 * 60)
        newEventEndsAtDate = Date().addingTimeInterval(75 * 60)
        newEventHasEndsAt = false
        newEventLocation = ""
        newEventKidIds = []
        cancelEditFeed()
        cancelEditEvent()
        members = []
        familyPhase = .loading
        hasDisplayName = false
        shell.resetToCalendar()
    }

    private func refreshCurrentEmail() {
        bridge.currentEmail(
            onSuccess: { [weak self] adultEmail in
                Task { @MainActor in
                    self?.signedInEmail = adultEmail
                }
            },
            onError: { [weak self] message in
                Task { @MainActor in
                    self?.phase = .signedOut
                    self?.errorMessage = message
                }
            }
        )
    }
}
