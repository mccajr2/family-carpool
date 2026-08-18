type AgendaKidFilterChipProps = {
  label: string
  selected: boolean
  disabled?: boolean
  onClick: () => void
}

/** Calendar mock `.chip` / `.chip.active` — kid filter pill, not shadcn Button. */
export function AgendaKidFilterChip({
  label,
  selected,
  disabled = false,
  onClick,
}: AgendaKidFilterChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-full border px-[var(--fc-space-filter-chip-pad-x)] py-[var(--fc-space-filter-chip-pad-y)] text-[length:var(--fc-font-filter-chip-size)] leading-[var(--fc-font-filter-chip-line)] font-[number:var(--fc-font-filter-chip-weight)] transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        selected
          ? "border-[var(--fc-text-primary)] bg-[var(--fc-text-primary)] text-[var(--fc-accent-on)]"
          : "border-[var(--fc-border)] bg-[var(--fc-surface-raised)] text-[var(--fc-text-secondary)] hover:border-[color-mix(in_srgb,var(--fc-text-secondary)_35%,var(--fc-border))]"
      }`}
    >
      {label}
    </button>
  )
}
