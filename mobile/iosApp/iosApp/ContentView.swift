import SwiftUI
import SharedLogic

struct ContentView: View {
    @State private var showContent = false
    @State private var greetingText: String?
    @State private var errorText: String?

    private var greetingDisplayText: String {
        if let errorText {
            return "SwiftUI: Error: \(errorText)"
        }
        if let greetingText {
            return "SwiftUI: \(greetingText)"
        }
        return "SwiftUI: Loading..."
    }

    var body: some View {
        VStack {
            Button("Click me!") {
                withAnimation {
                    showContent.toggle()
                    if !showContent {
                        greetingText = nil
                        errorText = nil
                    }
                }
            }

            if showContent {
                VStack(spacing: 16) {
                    Image(systemName: "swift")
                        .font(.system(size: 200))
                        .foregroundColor(.accentColor)
                    Text(greetingDisplayText)
                }
                .transition(.move(edge: .top).combined(with: .opacity))
                .onAppear {
                    guard greetingText == nil, errorText == nil else { return }
                    GreetingBridge().fetchGreeting(
                        onSuccess: { greetingText = $0 },
                        onError: { errorText = $0 }
                    )
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .padding()
    }
}

struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
    }
}
