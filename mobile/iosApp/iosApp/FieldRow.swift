import SwiftUI

/// Settings-style single-value field: label leading, value trailing.
/// Used for Leave from, Covering adult, My default leave-from (see
/// docs/agenda-coverage-web-contract.md Field rows).
struct FieldValueRow: View {
    let label: String
    let valueText: String

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: UiTokens.Space.md) {
            Text(label)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)
            Text(valueText)
                .font(.subheadline)
                .multilineTextAlignment(.trailing)
                .frame(maxWidth: .infinity, alignment: .trailing)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(label), \(valueText)")
    }
}

/// Interactive field row: label leading, Menu value + chevron trailing.
struct FieldMenuRow<MenuContent: View>: View {
    let label: String
    let valueText: String
    var disabled: Bool = false
    @ViewBuilder var menuContent: () -> MenuContent

    var body: some View {
        HStack(alignment: .center, spacing: UiTokens.Space.md) {
            Text(label)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)
            Menu {
                menuContent()
            } label: {
                HStack(spacing: UiTokens.Space.xs) {
                    Text(valueText)
                        .font(.subheadline)
                        .multilineTextAlignment(.trailing)
                        .lineLimit(2)
                    Image(systemName: "chevron.down")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, alignment: .trailing)
                .contentShape(Rectangle())
            }
            .disabled(disabled)
            .accessibilityLabel("\(label), \(valueText)")
        }
    }
}
