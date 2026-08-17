import { accountInitials, humanizeCircleRole } from "@/components/accountInitials"
import {
  resolveSemanticIcon,
  type SemanticIconName,
} from "@/components/uiIcons"
import { cn } from "@/lib/utils"

function railRowClassName({
  active,
  danger,
}: {
  active: boolean
  danger: boolean
}) {
  return cn(
    "flex w-full items-center gap-[var(--fc-space-md)] rounded-[var(--fc-radius-md)] px-[var(--fc-space-md)] py-[var(--fc-space-sm)] text-left font-[family-name:var(--fc-font-family)] text-[length:var(--fc-font-body-size)] leading-[var(--fc-font-body-line)] transition-colors",
    danger
      ? "font-[number:var(--fc-font-body-weight)] text-[var(--fc-rail-danger)] hover:bg-[color-mix(in_srgb,var(--fc-rail-on)_8%,transparent)]"
      : cn(
          "font-[number:var(--fc-font-title-weight)]",
          active
            ? "bg-[var(--fc-rail-active)] text-[var(--fc-rail-on)]"
            : "text-[var(--fc-rail-on-secondary)] hover:bg-[color-mix(in_srgb,var(--fc-rail-on)_8%,transparent)]",
        ),
  )
}

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
      className={railRowClassName({ active, danger: false })}
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
  danger = false,
  active = false,
}: {
  label: string
  icon: SemanticIconName
  onClick?: () => void
  danger?: boolean
  active?: boolean
}) {
  const Icon = resolveSemanticIcon(icon)
  const className = railRowClassName({ active, danger })
  const content = (
    <>
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1">{label}</span>
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
  displayName,
}: {
  email: string
  role: string
  displayName?: string | null
}) {
  const initials = accountInitials(displayName, email)
  return (
    <div className="flex items-center gap-[var(--fc-space-md)] rounded-[var(--fc-radius-md)] px-[var(--fc-space-md)] py-[var(--fc-space-sm)] font-[family-name:var(--fc-font-family)] text-[length:var(--fc-font-body-size)] leading-[var(--fc-font-body-line)] text-[var(--fc-rail-on)]">
      <span
        aria-hidden
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--fc-rail-active)] text-[length:var(--fc-font-caption-size)] font-[number:var(--fc-font-title-weight)] text-[var(--fc-rail-on)]"
      >
        {initials}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-[number:var(--fc-font-body-weight)]">
          {email}
        </span>
        <span className="block text-[length:var(--fc-font-caption-size)] leading-[var(--fc-font-caption-line)] text-[var(--fc-rail-on-secondary)]">
          {humanizeCircleRole(role)}
        </span>
      </span>
    </div>
  )
}

export function SettingsGroupLabel({ children }: { children: string }) {
  return (
    <p className="px-[var(--fc-space-sm)] font-[family-name:var(--fc-font-family)] text-[length:var(--fc-font-caption-size)] font-[number:var(--fc-font-title-weight)] leading-[var(--fc-font-caption-line)] tracking-wide text-[var(--fc-rail-on-secondary)] uppercase">
      {children}
    </p>
  )
}
