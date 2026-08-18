export type AgendaStatusChipTone = "mint" | "amber" | "route" | "muted"

export type AgendaStatusChipVariant = "default" | "hero"

/** Shared tag/chip tones for collapsed AgendaRow tags and Focus header chips. */
export function agendaStatusChipToneClass(
  tone: AgendaStatusChipTone,
  variant: AgendaStatusChipVariant = "default",
): string {
  if (variant === "hero") {
    if (tone === "amber") {
      return "text-[var(--fc-hero-danger)] bg-[color-mix(in_srgb,var(--fc-hero-danger)_16%,transparent)]"
    }
    if (tone === "mint") {
      return "text-[var(--fc-hero-success)] bg-[color-mix(in_srgb,var(--fc-hero-success)_16%,transparent)]"
    }
    if (tone === "route") {
      return "text-[var(--fc-hero-accent)] bg-[color-mix(in_srgb,var(--fc-hero-accent)_16%,transparent)]"
    }
    return "text-[var(--fc-hero-on-secondary)] bg-[color-mix(in_srgb,var(--fc-hero-on)_12%,transparent)]"
  }

  if (tone === "amber") {
    return "text-[var(--fc-danger)] bg-[color-mix(in_srgb,var(--fc-danger)_14%,transparent)]"
  }
  if (tone === "mint") {
    return "text-[var(--fc-success)] bg-[color-mix(in_srgb,var(--fc-success)_14%,transparent)]"
  }
  if (tone === "route") {
    return "text-[var(--fc-accent)] bg-[color-mix(in_srgb,var(--fc-accent)_14%,transparent)]"
  }
  return "text-[var(--fc-text-secondary)] bg-[var(--fc-surface)]"
}

type AgendaStatusChipProps = {
  label: string
  tone: AgendaStatusChipTone
  variant?: AgendaStatusChipVariant
}

export function AgendaStatusChip({ label, tone, variant = "default" }: AgendaStatusChipProps) {
  return (
    <span
      className={`rounded-full px-[var(--fc-space-md)] py-[2px] text-[length:var(--fc-font-status-chip-size)] font-bold uppercase leading-[var(--fc-font-status-chip-line)] tracking-wide ${agendaStatusChipToneClass(tone, variant)}`}
      style={{ fontWeight: "var(--fc-font-status-chip-weight)" }}
    >
      {label}
    </span>
  )
}
