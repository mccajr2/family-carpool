import Foundation
import SharedLogic
import SwiftUI

@MainActor
final class AuthViewModel: ObservableObject {
    enum Phase {
        case signedOut
        case codeSent
        case signedIn
    }

    @Published var email: String = ""
    @Published var code: String = ""
    @Published var phase: Phase = .signedOut
    @Published var signedInEmail: String = ""
    @Published var devHint: String?
    @Published var errorMessage: String?
    @Published var isLoading: Bool = false

    private let bridge: AuthBridge

    init(bridge: AuthBridge = AuthBridge()) {
        self.bridge = bridge
        if bridge.isSignedIn() {
            phase = .signedIn
            refreshCurrentEmail()
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
                    self.signedInEmail = ""
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
