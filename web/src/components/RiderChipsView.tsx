import { riderChipsAriaLabel, type RiderDescriptor } from "@/components/riderChips"

export type RiderChipsProps = {
  riders: readonly RiderDescriptor[]
  /**
   * `inline` — GameCard expanded kid row: circle + first name per rider.
   * `compact` — collapsed Agenda row: overlapping circles + comma-separated names.
   */
  variant?: "inline" | "compact"
  className?: string
  "data-testid"?: string
}

const avatarCircleClass =
  "flex shrink-0 items-center justify-center rounded-full bg-[var(--fc-accent)] text-[var(--fc-accent-on)]"

export function RiderChips({
  riders,
  variant = "inline",
  className,
  "data-testid": testId = "rider-chips",
}: RiderChipsProps) {
  if (riders.length === 0) {
    return null
  }

  const ariaLabel = riderChipsAriaLabel(riders)
  const initialsStyle = {
    fontSize: "var(--fc-font-list-row-avatar-label-size)",
    lineHeight: "var(--fc-font-list-row-avatar-label-line)",
    fontWeight: "var(--fc-font-list-row-avatar-label-weight)",
  } as const

  if (variant === "compact") {
    return (
      <div
        data-testid={testId}
        aria-label={ariaLabel}
        className={[
          "flex flex-wrap items-center gap-[var(--fc-space-sm)]",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div data-testid={`${testId}-avatar-stack`} className="flex items-center">
          {riders.map((rider, index) => (
            <span
              key={`${rider.firstName}-${index}`}
              aria-hidden
              className={`${avatarCircleClass} border-[var(--fc-surface-raised)]`}
              style={{
                ...initialsStyle,
                width: "var(--fc-space-list-row-avatar)",
                height: "var(--fc-space-list-row-avatar)",
                borderWidth: "var(--fc-space-list-row-avatar-border)",
                marginLeft:
                  index > 0
                    ? "calc(-1 * var(--fc-space-list-row-avatar-overlap))"
                    : undefined,
                zIndex: riders.length - index,
              }}
            >
              {rider.initial}
            </span>
          ))}
        </div>
        <span
          data-testid={`${testId}-names`}
          className="text-[length:var(--fc-font-list-row-meta-size)] leading-[var(--fc-font-list-row-meta-line)] font-[number:var(--fc-font-list-row-meta-weight)] text-[var(--fc-text-secondary)]"
        >
          {riders.map((rider) => rider.firstName).join(", ")}
        </span>
      </div>
    )
  }

  return (
    <div
      data-testid={testId}
      aria-label={ariaLabel}
      className={[
        "flex flex-wrap items-center gap-x-[var(--fc-space-list-row-gap)] gap-y-[var(--fc-space-sm)]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {riders.map((rider, index) => (
        <span
          key={`${rider.firstName}-${index}`}
          className="flex min-w-0 items-center gap-[var(--fc-space-sm)] text-[length:var(--fc-font-list-row-meta-size)] leading-[var(--fc-font-list-row-meta-line)] font-[number:var(--fc-font-list-row-meta-weight)] text-[var(--fc-text-primary)]"
        >
          <span
            aria-hidden
            className={avatarCircleClass}
            style={{
              ...initialsStyle,
              width: "var(--fc-space-list-row-kid-avatar)",
              height: "var(--fc-space-list-row-kid-avatar)",
            }}
          >
            {rider.initial}
          </span>
          <span data-testid={`${testId}-name`}>{rider.firstName}</span>
        </span>
      ))}
    </div>
  )
}
