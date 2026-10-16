import type { ReactNode } from "react"

/**
 * Shared quiet-action chrome for AgendaRow and AgendaBlockCard.
 * Smaller than focusAction / primary Confirm; same weight on both shells.
 */

/** Secondary quiet link (Edit plan, View route, Combine/Split, reverses). */
export const AGENDA_QUIET_LINK_CLASS =
  "text-[length:var(--fc-font-list-row-meta-size)] leading-[var(--fc-font-list-row-meta-line)] text-[var(--fc-text-secondary)] disabled:cursor-not-allowed disabled:opacity-50 text-left"

/** Danger quiet link (Remove recurring, Remove event) — quieter than Edit, danger color. */
export const AGENDA_QUIET_DANGER_LINK_CLASS =
  "text-[length:var(--fc-font-list-row-meta-size)] leading-[var(--fc-font-list-row-meta-line)] font-[number:var(--fc-font-list-row-title-weight)] text-[var(--fc-danger)] disabled:cursor-not-allowed disabled:opacity-50 text-left"

/** Flex wrap row for a cluster of quiet links. */
export const AGENDA_QUIET_ACTIONS_ROW_CLASS =
  "flex flex-wrap items-center gap-x-[var(--fc-space-lg)] gap-y-[var(--fc-space-sm)]"

/** Stack of quiet clusters (overrides, combine, view route, manual). */
export const AGENDA_QUIET_ACTIONS_STACK_CLASS =
  "flex flex-col gap-[var(--fc-space-sm)]"

export const VIEW_ROUTE_LABEL = "View route" as const

/**
 * Shared expanded quiet-actions stack for AgendaRow and AgendaBlockCard.
 * Children are existing controls (overrides, combine/split, View route, manual).
 */
export function AgendaQuietActions({
  children,
  testId = "agenda-quiet-actions",
}: {
  children: ReactNode
  testId?: string
}) {
  return (
    <div data-testid={testId} className={AGENDA_QUIET_ACTIONS_STACK_CLASS}>
      {children}
    </div>
  )
}
