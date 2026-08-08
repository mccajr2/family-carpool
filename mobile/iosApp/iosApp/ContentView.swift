import SharedLogic
import SwiftUI

struct ContentView: View {
    @StateObject private var model = AuthViewModel()

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            switch model.phase {
            case .signedIn:
                Text("Signed in")
                    .font(.title2.bold())
                Text(model.signedInEmail.isEmpty ? "…" : model.signedInEmail)
                if let errorMessage = model.errorMessage {
                    Text(errorMessage)
                        .foregroundStyle(.red)
                        .font(.footnote)
                }
                Button(model.isLoading ? "Signing out…" : "Sign out") {
                    model.signOut()
                }
                .disabled(model.isLoading)
            case .signedOut, .codeSent:
                Text("Sign in")
                    .font(.title2.bold())
                Text("Email one-time code")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)

                TextField("Email", text: $model.email)
                    .textInputAutocapitalization(.never)
                    .keyboardType(.emailAddress)
                    .textContentType(.emailAddress)
                    .autocorrectionDisabled()
                    .disabled(model.isLoading)
                    .textFieldStyle(.roundedBorder)

                if model.phase == .codeSent {
                    TextField("One-time code", text: $model.code)
                        .keyboardType(.numberPad)
                        .textContentType(.oneTimeCode)
                        .disabled(model.isLoading)
                        .textFieldStyle(.roundedBorder)
                    if let devHint = model.devHint {
                        Text("Dev code echo: \(devHint)")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Button(model.isLoading ? "Verifying…" : "Verify code") {
                        model.verifyCode()
                    }
                    .disabled(model.isLoading || model.code.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                } else {
                    Button(model.isLoading ? "Sending…" : "Send code") {
                        model.sendCode()
                    }
                    .disabled(model.isLoading || model.email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }

                if model.isLoading {
                    ProgressView()
                }
                if let errorMessage = model.errorMessage {
                    Text(errorMessage)
                        .foregroundStyle(.red)
                        .font(.footnote)
                }
            }
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
    }
}

struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
    }
}
