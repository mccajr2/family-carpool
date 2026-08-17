import type { LucideIcon } from "lucide-react"

import {
  resolveSemanticIcon,
  type SemanticIconName,
} from "@/components/uiIcons"
import { cn } from "@/lib/utils"

export function ShellNavButton({
  label,
  icon,
  active,
  onClick,
}: {
  label: string
  icon: SemanticIconName
  active: boolean
  onClick: () => void
}) {
  const Icon = resolveSemanticIcon(icon)
  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-[var(--fc-space-md)] rounded-[var(--fc-radius-md)] px-[var(--fc-space-md)] py-[var(--fc-space-sm)] text-left font-[family-name:var(--fc-font-family)] text-[length:var(--fc-font-body-size)] font-[number:var(--fc-font-title-weight)] leading-[var(--fc-font-body-line)] transition-colors",
        active
          ? "bg-[var(--fc-accent)] text-[var(--fc-accent-on)]"
          : "text-[var(--fc-text-primary)] hover:bg-[color-mix(in_srgb,var(--fc-accent)_12%,transparent)]",
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      {label}
    </button>
  )
}

export function SettingsRow({
  label,
  icon,
  onClick,
  chevron = true,
  danger = false,
  active = false,
}: {
  label: string
  icon: SemanticIconName
  onClick?: () => void
  chevron?: boolean
  danger?: boolean
  active?: boolean
}) {
  const Icon: LucideIcon = resolveSemanticIcon(icon)
  const Chevron = resolveSemanticIcon("icon.chevron")
  const className = cn(
    "flex w-full items-center gap-[var(--fc-space-md)] rounded-[var(--fc-radius-md)] px-[var(--fc-space-sm)] py-[var(--fc-space-sm)] text-left font-[family-name:var(--fc-font-family)] text-[length:var(--fc-font-body-size)] leading-[var(--fc-font-body-line)] transition-colors",
    danger
      ? "text-[var(--fc-danger)] hover:bg-[color-mix(in_srgb,var(--fc-danger)_12%,transparent)]"
      : active
        ? "bg-[var(--fc-accent)] text-[var(--fc-accent-on)]"
        : "text-[var(--fc-text-primary)] hover:bg-[color-mix(in_srgb,var(--fc-accent)_10%,transparent)]",
  )
  const content = (
    <>
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-[var(--fc-radius-md)]",
          danger
            ? "bg-[color-mix(in_srgb,var(--fc-danger)_15%,transparent)] text-[var(--fc-danger)]"
            : active
              ? "bg-[color-mix(in_srgb,var(--fc-accent-on)_18%,transparent)] text-[var(--fc-accent-on)]"
              : "bg-[color-mix(in_srgb,var(--fc-accent)_12%,transparent)] text-[var(--fc-accent)]",
        )}
      >
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1 font-[number:var(--fc-font-body-weight)]">
        {label}
      </span>
      {chevron ? (
        <Chevron
          className={cn(
            "size-4 shrink-0",
            active
              ? "text-[var(--fc-accent-on)]"
              : "text-[var(--fc-text-secondary)]",
          )}
          aria-hidden
        />
      ) : null}
    </>
  )
  if (!onClick) {
    return <div className={className}>{content}</div>
  }
  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      className={className}
    >
      {content}
    </button>
  )
}

export function AccountSummaryRow({
  email,
  role,
  icon,
}: {
  email: string
  role: string
  icon: SemanticIconName
}) {
  const Icon = resolveSemanticIcon(icon)
  return (
    <div className="flex items-center gap-[var(--fc-space-md)] rounded-[var(--fc-radius-md)] px-[var(--fc-space-sm)] py-[var(--fc-space-sm)] font-[family-name:var(--fc-font-family)] text-[length:var(--fc-font-body-size)] leading-[var(--fc-font-body-line)] text-[var(--fc-text-primary)]">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-[var(--fc-radius-md)] bg-[color-mix(in_srgb,var(--fc-accent)_12%,transparent)] text-[var(--fc-accent)]">
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-[number:var(--fc-font-body-weight)]">
          {email}
        </span>
        <span className="block text-[length:var(--fc-font-caption-size)] leading-[var(--fc-font-caption-line)] text-[var(--fc-text-secondary)]">
          {role}
        </span>
      </span>
    </div>
  )
}

export function SettingsGroupLabel({ children }: { children: string }) {
  return (
    <p className="px-[var(--fc-space-sm)] font-[family-name:var(--fc-font-family)] text-[length:var(--fc-font-caption-size)] font-[number:var(--fc-font-title-weight)] leading-[var(--fc-font-caption-line)] tracking-wide text-[var(--fc-text-secondary)] uppercase">
      {children}
    </p>
  )
}
