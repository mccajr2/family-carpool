export type AgendaStatusChipTone = "mint" | "amber" | "route" | "muted"

export type AgendaStatusChipVariant = "default" | "hero"

/** `tag` = collapsed AgendaRow (uppercase). `pill` = Focus (Title Case + leading dot). */
export type AgendaStatusChipAppearance = "tag" | "pill"

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

function agendaStatusChipBorderClass(
  tone: AgendaStatusChipTone,
  variant: AgendaStatusChipVariant,
): string {
  if (variant === "hero") {
    if (tone === "amber") {
      return "border-[color-mix(in_srgb,var(--fc-hero-danger)_35%,transparent)]"
    }
    if (tone === "mint") {
      return "border-[color-mix(in_srgb,var(--fc-hero-success)_35%,transparent)]"
    }
    if (tone === "route") {
      return "border-[color-mix(in_srgb,var(--fc-hero-accent)_35%,transparent)]"
    }
    return "border-[color-mix(in_srgb,var(--fc-hero-on)_20%,transparent)]"
  }
  if (tone === "amber") {
    return "border-[color-mix(in_srgb,var(--fc-danger)_35%,transparent)]"
  }
  if (tone === "mint") {
    return "border-[color-mix(in_srgb,var(--fc-success)_35%,transparent)]"
  }
  if (tone === "route") {
    return "border-[color-mix(in_srgb,var(--fc-accent)_35%,transparent)]"
  }
  return "border-[var(--fc-border)]"
}

type AgendaStatusChipProps = {
  label: string
  tone: AgendaStatusChipTone
  variant?: AgendaStatusChipVariant
  appearance?: AgendaStatusChipAppearance
}

export function AgendaStatusChip({
  label,
  tone,
  variant = "default",
  appearance = "tag",
}: AgendaStatusChipProps) {
  const toneClass = agendaStatusChipToneClass(tone, variant)

  if (appearance === "pill") {
    return (
      <span
        className={`inline-flex items-center gap-[var(--fc-space-focus-status-dot)] rounded-full border px-[var(--fc-space-md)] py-[var(--fc-space-focus-status-pill-y)] text-[length:var(--fc-font-focus-status-pill-size)] leading-[var(--fc-font-focus-status-pill-line)] font-[number:var(--fc-font-focus-status-pill-weight)] ${toneClass} ${agendaStatusChipBorderClass(tone, variant)}`}
      >
        <span
          aria-hidden
          data-testid="agenda-status-pill-dot"
          className="inline-block shrink-0 rounded-full bg-current"
          style={{
            width: "var(--fc-space-focus-status-dot)",
            height: "var(--fc-space-focus-status-dot)",
          }}
        />
        {label}
      </span>
    )
  }

  return (
    <span
      className={`rounded-full px-[var(--fc-space-md)] py-[2px] text-[length:var(--fc-font-status-chip-size)] uppercase leading-[var(--fc-font-status-chip-line)] tracking-wide font-[number:var(--fc-font-status-chip-weight)] ${toneClass}`}
    >
      {label}
    </span>
  )
}
