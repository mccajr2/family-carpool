import type { CombinedKidRow } from "@/components/combinedEventLayout"
import { AgendaLegPair } from "@/components/AgendaLegPair"
import {
  AGENDA_QUIET_LINK_CLASS,
  VIEW_ROUTE_LABEL,
} from "@/components/AgendaQuietActions"

export type AgendaLegsTableViewRoute = {
  /** Which kid-row key hosts this View route control. */
  rowKey: string
  onClick: () => void
  testId: string
}

function ViewRouteButton({
  route,
  loading,
}: {
  route: AgendaLegsTableViewRoute
  loading: boolean
}) {
  return (
    <button
      type="button"
      disabled={loading}
      data-testid={route.testId}
      className={`mt-[var(--fc-space-sm)] ${AGENDA_QUIET_LINK_CLASS}`}
      onClick={route.onClick}
    >
      {VIEW_ROUTE_LABEL}
    </button>
  )
}

/**
 * Read-only expanded Legs table shared by AgendaRow and AgendaBlockCard:
 * kid identity + Getting there / Coming back. Optional per-leg View route
 * (combined card keeps TO on the earliest row and FROM on the latest).
 */
export function AgendaLegsTable({
  rows,
  toViewRoute = null,
  fromViewRoute = null,
  loading = false,
  testId = "agenda-legs-table",
  rowTestId,
  legPairTestId,
}: {
  rows: readonly CombinedKidRow[]
  toViewRoute?: AgendaLegsTableViewRoute | null
  fromViewRoute?: AgendaLegsTableViewRoute | null
  loading?: boolean
  testId?: string
  rowTestId?: (row: CombinedKidRow) => string
  legPairTestId?: (row: CombinedKidRow) => string
}) {
  if (rows.length === 0) {
    return null
  }

  return (
    <div
      data-testid={testId}
      className="flex flex-col gap-[var(--fc-space-md)]"
    >
      {rows.map((row) => (
        <div
          key={row.key}
          data-testid={rowTestId?.(row) ?? `agenda-legs-row-${row.key}`}
          className="flex flex-col gap-[var(--fc-space-sm)]"
        >
          <div className="flex min-w-0 items-center gap-[var(--fc-space-sm)]">
            <span
              aria-hidden
              className="flex shrink-0 items-center justify-center rounded-full bg-[var(--fc-accent)] text-[var(--fc-accent-on)]"
              style={{
                width: "var(--fc-space-list-row-kid-avatar)",
                height: "var(--fc-space-list-row-kid-avatar)",
                fontSize: "var(--fc-font-list-row-avatar-label-size)",
                lineHeight: "var(--fc-font-list-row-avatar-label-line)",
                fontWeight: "var(--fc-font-list-row-avatar-label-weight)",
              }}
            >
              {row.initial}
            </span>
            <span className="min-w-0">
              <span className="block text-[length:var(--fc-font-list-row-meta-size)] leading-[var(--fc-font-list-row-meta-line)] font-[number:var(--fc-font-list-row-title-weight)] text-[var(--fc-text-primary)]">
                {row.firstName}
              </span>
              <span className="block text-[length:var(--fc-font-list-row-meta-size)] leading-[var(--fc-font-list-row-meta-line)] text-[var(--fc-text-secondary)]">
                {row.eventLabel} · {row.timeLabel}
              </span>
            </span>
          </div>
          <AgendaLegPair
            testId={legPairTestId?.(row) ?? `agenda-legs-pair-${row.key}`}
            thereDetail={row.there.detail}
            backDetail={row.back.detail}
            thereAction={
              toViewRoute != null && row.key === toViewRoute.rowKey ? (
                <ViewRouteButton route={toViewRoute} loading={loading} />
              ) : undefined
            }
            backAction={
              fromViewRoute != null && row.key === fromViewRoute.rowKey ? (
                <ViewRouteButton route={fromViewRoute} loading={loading} />
              ) : undefined
            }
          />
        </div>
      ))}
    </div>
  )
}
