import type { ReactNode } from "react"

import { LEG_COMING_BACK, LEG_GETTING_THERE } from "@/components/coverageCopy"

const labelClass =
  "uppercase tracking-wide text-[length:var(--fc-font-list-row-team-size)] leading-[var(--fc-font-list-row-team-line)] font-[number:var(--fc-font-list-row-team-weight)] text-[var(--fc-text-secondary)]"

const valueClass =
  "mt-[var(--fc-space-xs)] text-[length:var(--fc-font-list-row-meta-size)] leading-[var(--fc-font-list-row-meta-line)] font-[number:var(--fc-font-list-row-title-weight)] text-[var(--fc-text-primary)]"

function LegBox({
  label,
  detail,
  action,
  testId,
}: {
  label: string
  detail: string
  action?: ReactNode
  testId: string
}) {
  return (
    <div
      data-testid={testId}
      className="min-w-0 rounded-[var(--fc-radius-lg)] border border-[var(--fc-border)] px-[var(--fc-space-md)] py-[var(--fc-space-md)]"
    >
      <div className={labelClass}>{label}</div>
      <div className={valueClass}>{detail}</div>
      {action}
    </div>
  )
}

/**
 * The same Getting there / Coming back pair used on an expanded single card.
 */
export function AgendaLegPair({
  thereDetail,
  backDetail,
  thereAction,
  backAction,
  testId = "agenda-leg-pair",
}: {
  thereDetail: string
  backDetail: string
  thereAction?: ReactNode
  backAction?: ReactNode
  testId?: string
}) {
  return (
    <div
      data-testid={testId}
      className="grid grid-cols-2 gap-[var(--fc-space-md)]"
    >
      <LegBox
        label={LEG_GETTING_THERE}
        detail={thereDetail}
        action={thereAction}
        testId={`${testId}-there`}
      />
      <LegBox
        label={LEG_COMING_BACK}
        detail={backDetail}
        action={backAction}
        testId={`${testId}-back`}
      />
    </div>
  )
}
