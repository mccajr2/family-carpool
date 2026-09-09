import {
  DEFAULT_RIDE_NEEDED_LEGS,
  RIDE_NEEDED_LEGS_LABEL,
  RIDE_NEEDED_LEGS_OPTIONS,
  type RideNeededLegsChoice,
} from "@/components/rideNeededLegs"

export type RideNeededLegsControlProps = {
  value?: RideNeededLegsChoice
  onChange: (value: RideNeededLegsChoice) => void
  disabled?: boolean
  /** Inverse chips for hero Focus surface. */
  hero?: boolean
  id?: string
}

/**
 * Request need selector: To practice / From practice / Round trip (default).
 * Chip styling matches AgendaKidFilterChip / DriverMemberChip.
 */
export function RideNeededLegsControl({
  value = DEFAULT_RIDE_NEEDED_LEGS,
  onChange,
  disabled = false,
  hero = false,
  id,
}: RideNeededLegsControlProps) {
  const groupId = id ?? "ride-needed-legs"
  return (
    <div
      role="group"
      aria-labelledby={`${groupId}-label`}
      data-testid="ride-needed-legs"
      className="flex min-w-0 flex-col gap-[var(--fc-space-sm)]"
    >
      <span
        id={`${groupId}-label`}
        className={`text-xs font-semibold uppercase tracking-wide ${
          hero ? "text-[var(--fc-hero-on-secondary)]" : "text-[var(--fc-text-secondary)]"
        }`}
      >
        {RIDE_NEEDED_LEGS_LABEL}
      </span>
      <div className="flex min-w-0 flex-wrap gap-[var(--fc-space-sm)]">
        {RIDE_NEEDED_LEGS_OPTIONS.map((option) => {
          const selected = value === option.value
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              disabled={disabled}
              onClick={() => onChange(option.value)}
              className={
                hero
                  ? `rounded-full border px-[var(--fc-space-filter-chip-pad-x)] py-[var(--fc-space-filter-chip-pad-y)] text-[length:var(--fc-font-filter-chip-size)] leading-[var(--fc-font-filter-chip-line)] font-[number:var(--fc-font-filter-chip-weight)] transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      selected
                        ? "border-[var(--fc-hero-on)] bg-[var(--fc-hero-on)] text-[var(--fc-hero-surface)]"
                        : "border-[color-mix(in_srgb,var(--fc-hero-on)_35%,transparent)] bg-transparent text-[var(--fc-hero-on)] hover:border-[var(--fc-hero-on)]"
                    }`
                  : `rounded-full border px-[var(--fc-space-filter-chip-pad-x)] py-[var(--fc-space-filter-chip-pad-y)] text-[length:var(--fc-font-filter-chip-size)] leading-[var(--fc-font-filter-chip-line)] font-[number:var(--fc-font-filter-chip-weight)] transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      selected
                        ? "border-[var(--fc-text-primary)] bg-[var(--fc-text-primary)] text-[var(--fc-accent-on)]"
                        : "border-[var(--fc-border)] bg-[var(--fc-surface-raised)] text-[var(--fc-text-secondary)] hover:border-[color-mix(in_srgb,var(--fc-text-secondary)_35%,var(--fc-border))]"
                    }`
              }
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
