import Foundation
import SharedLogic
import SwiftUI

struct FamilyKidItem: Identifiable, Equatable {
    let id: String
    var displayName: String
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
    @Published var familyPhase: FamilyPhase = .loading
    @Published var editingKidId: String?
    @Published var editingKidName: String = ""
    @Published var devHint: String?
    @Published var errorMessage: String?
    @Published var isLoading: Bool = false

    private let bridge: AuthBridge

    var isOrganizer: Bool { familyRole == "ORGANIZER" }

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
                    guard let self else { return }
                    self.isLoading = false
                    self.phase = .signedOut
                    self.resetFamilyFields()
                    self.code = ""
                    self.devHint = nil
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

    func loadFamily() {
        familyPhase = .loading
        errorMessage = nil
        bridge.loadFamily(
            onNeedsCreate: { [weak self] email, hasDisplayName in
                Task { @MainActor in
                    guard let self else { return }
                    self.signedInEmail = email
                    self.hasDisplayName = hasDisplayName
                    self.familyPhase = .choose
                }
            },
            onReady: { [weak self] title, email, adultId, displayName, role, inviteCode, memberAdultIds, memberEmails, memberNames, memberRoles, kidIds, kidNames in
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
                        kidNames: kidNames
                    )
                }
            },
            onError: { [weak self] message in
                Task { @MainActor in
                    self?.familyPhase = .choose
                    self?.errorMessage = message
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
            onSuccess: { [weak self] title, email, adultId, displayName, role, inviteCode, memberAdultIds, memberEmails, memberNames, memberRoles, kidIds, kidNames in
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
                        kidNames: kidNames
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
            onSuccess: { [weak self] title, email, adultId, displayName, role, inviteCode, memberAdultIds, memberEmails, memberNames, memberRoles, kidIds, kidNames in
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
                        kidNames: kidNames
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
                    self.hasDisplayName = hasDisplayName
                    self.kids = []
                    self.members = []
                    self.inviteCode = ""
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
            onSuccess: { [weak self] title, email, adultId, displayName, familyRole, inviteCode, memberAdultIds, memberEmails, memberNames, memberRoles, kidIds, kidNames in
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
                        kidNames: kidNames
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
        kidNames: [String]
    ) {
        familyTitle = title
        signedInEmail = email
        currentAdultId = adultId
        adultDisplayName = displayName ?? ""
        hasDisplayName = !(displayName ?? "").isEmpty
        familyRole = role
        self.inviteCode = inviteCode ?? ""
        members = (0..<memberAdultIds.count).map { index in
            FamilyMemberItem(
                adultId: memberAdultIds[index],
                email: memberEmails[index],
                displayName: memberNames[index],
                role: memberRoles[index]
            )
        }
        kids = zip(kidIds, kidNames).map { FamilyKidItem(id: $0.0, displayName: $0.1) }
        familyPhase = .ready
    }

    private func resetFamilyFields() {
        signedInEmail = ""
        currentAdultId = ""
        adultDisplayName = ""
        circleNameInput = ""
        inviteCodeInput = ""
        inviteCode = ""
        kids = []
        members = []
        familyPhase = .loading
        hasDisplayName = false
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
