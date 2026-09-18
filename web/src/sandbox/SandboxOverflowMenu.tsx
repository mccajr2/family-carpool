import { useId, useState, type ReactNode } from "react"

export type SandboxOverflowItem = {
  key: string
  label: string
  testId?: string
}

type SandboxOverflowMenuProps = {
  label: string
  items: SandboxOverflowItem[]
  testId?: string
  /** Optional trailing note under the menu (e.g. “sandbox — not writing”). */
  footer?: ReactNode
}

/**
 * Lightweight overflow for the UX sandbox only — no Radix/DropdownMenu yet.
 * Uses native details/summary so Proposed columns stay dependency-free.
 */
export function SandboxOverflowMenu({
  label,
  items,
  testId = "sandbox-overflow",
  footer,
}: SandboxOverflowMenuProps) {
  const listId = useId()
  const [open, setOpen] = useState(false)

  if (items.length === 0) {
    return null
  }

  return (
    <details
      data-testid={testId}
      className="relative inline-block"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary
        aria-controls={listId}
        className="cursor-pointer list-none text-xs font-medium text-[var(--fc-text-secondary)] underline underline-offset-2 marker:content-none [&::-webkit-details-marker]:hidden"
      >
        {label}
      </summary>
      <div
        id={listId}
        role="menu"
        className="absolute left-0 z-10 mt-[var(--fc-space-xs)] min-w-[12rem] rounded-[var(--fc-radius-md)] border border-[var(--fc-border)] bg-[var(--fc-surface-raised)] py-[var(--fc-space-xs)] shadow-sm"
      >
        <ul className="flex flex-col">
          {items.map((item) => (
            <li key={item.key}>
              <button
                type="button"
                role="menuitem"
                data-testid={item.testId ?? `${testId}-item-${item.key}`}
                className="w-full px-[var(--fc-space-md)] py-[var(--fc-space-sm)] text-left text-xs text-[var(--fc-text-primary)] hover:bg-[var(--fc-surface)]"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
        {footer != null ? (
          <p className="border-t border-[var(--fc-border)] px-[var(--fc-space-md)] py-[var(--fc-space-xs)] text-[length:var(--fc-font-caption-size)] text-[var(--fc-text-secondary)]">
            {footer}
          </p>
        ) : null}
      </div>
    </details>
  )
}
