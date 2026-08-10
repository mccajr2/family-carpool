import type { LucideIcon } from "lucide-react"
import { ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"

export function ShellNavButton({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      className={cn(
        "w-full rounded-md px-3 py-2 text-left text-sm font-medium transition-colors",
        active
          ? "bg-accent text-accent-foreground"
          : "text-foreground hover:bg-accent/60",
      )}
    >
      {label}
    </button>
  )
}

export function SettingsRow({
  label,
  icon: Icon,
  onClick,
  chevron = true,
  danger = false,
  active = false,
}: {
  label: string
  icon: LucideIcon
  onClick?: () => void
  chevron?: boolean
  danger?: boolean
  active?: boolean
}) {
  const className = cn(
    "flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors",
    danger
      ? "text-destructive hover:bg-destructive/10"
      : active
        ? "bg-accent text-accent-foreground"
        : "hover:bg-accent/60",
  )
  const content = (
    <>
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg",
          danger
            ? "bg-destructive/15 text-destructive"
            : "bg-primary/10 text-primary",
        )}
      >
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">{label}</span>
      {chevron ? (
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
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
  icon: Icon,
}: {
  email: string
  role: string
  icon: LucideIcon
}) {
  return (
    <div className="flex items-center gap-3 rounded-md px-2 py-2 text-sm">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate">{email}</span>
        <span className="block text-xs text-muted-foreground">{role}</span>
      </span>
    </div>
  )
}
