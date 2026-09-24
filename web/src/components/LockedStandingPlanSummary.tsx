import {
  EDIT_LOCKED_PLAN,
  REMOVE_RECURRING_COVERAGE,
  lockedPlanScopeCaption,
  lockedPlanTitle,
  markAsNotGoingThisWeekLabel,
  markKidsAsNotGoingThisWeekLabel,
  type StandingWeekdayNames,
} from "@/components/standingBlockChrome"

export type LockedStandingNotGoingAction = {
  key: string
  kidIds: string[]
  firstNames: string[]
  testId: string
}

export type LockedStandingPlanSummaryProps = {
  weekdays: StandingWeekdayNames
  /** One-line leg / who-drives summary from existing block chrome. */
  planSummaryLine: string | null
  loading?: boolean
  /** When true, primary action is Done editing (plan editor is open below). */
  editing?: boolean
  onEditPlan: () => void
  /** When omitted, Remove is hidden (locked stamp without template id). */
  onRemoveRecurring?: () => void
  /** Remove / unlock failures — settled locked view has no DriverPicker error slot. */
  actionError?: string | null
  notGoingActions?: LockedStandingNotGoingAction[]
  onNotGoing?: (kidIds: string[]) => void
  testIdPrefix?: string
}

/**
 * Compact locked standing-plan chrome: summary + Edit / Remove + scope caption.
 * Edit must not call Remove; not-going is occurrence-only (RSVP).
 * Stays visible while the week editor is open so Remove/unlock never disappears
 * in round-trip, split-leg, or combined-block modes.
 */
export function LockedStandingPlanSummary({
  weekdays,
  planSummaryLine,
  loading = false,
  editing = false,
  onEditPlan,
  onRemoveRecurring,
  actionError = null,
  notGoingActions = [],
  onNotGoing,
  testIdPrefix = "standing-locked",
}: LockedStandingPlanSummaryProps) {
  const linkClass =
    "text-xs underline underline-offset-2 text-[var(--fc-text-secondary)] disabled:cursor-not-allowed disabled:opacity-50 text-left"

  return (
    <div
      data-testid={testIdPrefix}
      className="flex flex-col gap-[var(--fc-space-sm)]"
    >
      <div
        data-testid={`${testIdPrefix}-summary`}
        className="flex items-start gap-[var(--fc-space-sm)]"
      >
        <span
          aria-hidden
          data-testid={`${testIdPrefix}-icon`}
          className="mt-0.5 inline-flex h-4 w-4 shrink-0 text-[var(--fc-text-secondary)]"
        >
          <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4" aria-hidden>
            <path d="M8 1a3 3 0 0 0-3 3v2H4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-1V4a3 3 0 0 0-3-3Zm1 5V4a1 1 0 1 0-2 0v2h2Z" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <p
            data-testid={`${testIdPrefix}-title`}
            className="text-[length:var(--fc-font-list-row-meta-size)] leading-[var(--fc-font-list-row-meta-line)] font-[number:var(--fc-font-list-row-title-weight)] text-[var(--fc-text-primary)]"
          >
            {lockedPlanTitle(weekdays.singular)}
          </p>
          {planSummaryLine != null && planSummaryLine.length > 0 ? (
            <p
              data-testid={`${testIdPrefix}-plan-line`}
              className="mt-[var(--fc-space-xs)] text-[length:var(--fc-font-list-row-meta-size)] leading-[var(--fc-font-list-row-meta-line)] text-[var(--fc-text-secondary)]"
            >
              {planSummaryLine}
            </p>
          ) : null}
        </div>
      </div>

      <div
        data-testid={`${testIdPrefix}-actions`}
        className="flex flex-wrap items-center gap-x-[var(--fc-space-lg)] gap-y-[var(--fc-space-sm)]"
      >
        <button
          type="button"
          disabled={loading}
          className={linkClass}
          data-testid={editing ? `${testIdPrefix}-done-editing` : `${testIdPrefix}-edit`}
          onClick={onEditPlan}
        >
          {editing ? "Done editing this week" : EDIT_LOCKED_PLAN}
        </button>
        {onRemoveRecurring != null ? (
          <button
            type="button"
            disabled={loading}
            className={linkClass}
            data-testid={`${testIdPrefix}-remove`}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onRemoveRecurring()
            }}
          >
            {REMOVE_RECURRING_COVERAGE}
          </button>
        ) : null}
      </div>

      {actionError != null && actionError.length > 0 ? (
        <p
          role="alert"
          data-testid={`${testIdPrefix}-error`}
          className="text-sm text-[var(--fc-danger)]"
        >
          {actionError}
        </p>
      ) : null}

      <p
        data-testid={`${testIdPrefix}-caption`}
        className="text-[length:var(--fc-font-list-row-meta-size)] leading-[var(--fc-font-list-row-meta-line)] text-[var(--fc-text-secondary)]"
      >
        {lockedPlanScopeCaption(weekdays.plural)}
      </p>

      {!editing && onNotGoing != null && notGoingActions.length > 0 ? (
        <div
          data-testid={`${testIdPrefix}-not-going`}
          className="flex flex-wrap items-center gap-x-[var(--fc-space-lg)] gap-y-[var(--fc-space-sm)]"
        >
          {notGoingActions.map((action) => (
            <button
              key={action.key}
              type="button"
              disabled={loading}
              className={linkClass}
              data-testid={action.testId}
              onClick={() => onNotGoing(action.kidIds)}
            >
              {action.firstNames.length >= 2
                ? markKidsAsNotGoingThisWeekLabel(action.firstNames)
                : markAsNotGoingThisWeekLabel(action.firstNames[0] ?? "kid")}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
