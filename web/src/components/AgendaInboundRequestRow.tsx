import { Car, Undo2 } from "lucide-react"

import type { CarpoolRide } from "@/api/types"
import { AgendaStatusChip, type AgendaStatusChipTone } from "@/components/agendaStatusChip"
import { incomingRideAskSummary, isAcceptedByCircle } from "@/components/carpoolDisplay"
import {
  REVERT_INBOUND_CANT_TAKE_THEM,
  REVERT_INBOUND_RECONSIDER,
  REVERT_INBOUND_UNDO,
} from "@/components/revertRideCopy"
import {
  INBOUND_ACCEPTED,
  INBOUND_DECLINED_NEEDED_RIDE,
  INBOUND_HERO_HANDOFF,
  INBOUND_PASSED,
} from "@/components/coverageCopy"
import { PickupLine } from "@/components/PickupLine"
import { inboundAskLegChips } from "@/components/rideStatusChip"
import {
  inboundWithdrawLabel,
  inboundWithdrawLegs,
  ridePlaceLineKind,
} from "@/components/transportPlan"
import { Button } from "@/components/ui/button"

const revertLinkClassName =
  "text-xs underline underline-offset-2 text-[var(--fc-text-secondary)] disabled:cursor-not-allowed disabled:opacity-50"

export type AgendaInboundRequestRowProps = {
  request: CarpoolRide
  circleId: string
  loading?: boolean
  inHeroQueue?: boolean
  /** Confirmed driver on this event row — gates Reconsider / Undo. */
  canOffer?: boolean
  /** Session-local: viewer withdrew this acceptance before reload. */
  recentlyWithdrawn?: boolean
  /**
   * Rank-2 auto-decline flag (not on CarpoolRide yet). When true, show Declined
   * chip + Reconsider when canOffer — no Accept/Pass.
   */
  autoDeclined?: boolean
  onAcceptRide?: (rideId: string) => void
  onPassRide?: (rideId: string) => void
  onWithdrawRide?: (rideId: string, legs?: ("TO" | "FROM")[]) => void
}

export function inboundRequestStatusChip(
  request: CarpoolRide,
  circleId: string,
  options: { autoDeclined?: boolean } = {},
): { label: string; tone: AgendaStatusChipTone } | null {
  if (isAcceptedByCircle(request, circleId)) {
    return { label: INBOUND_ACCEPTED, tone: "mint" }
  }
  if (options.autoDeclined) {
    return { label: INBOUND_DECLINED_NEEDED_RIDE, tone: "muted" }
  }
  if (request.passedByMe) {
    return { label: INBOUND_PASSED, tone: "muted" }
  }
  if (request.status === "PENDING") {
    // Dual Getting there / Coming back chips render separately.
    return null
  }
  if (request.status === "ACCEPTED") {
    return { label: INBOUND_ACCEPTED, tone: "mint" }
  }
  return { label: request.status, tone: "muted" }
}

/**
 * Expanded Agenda row inbound ask — mock RequestRow structure (summary + chip;
 * Accept/Pass when actionable and not duplicated in the hero carousel;
 * reverse links: Can't take them anymore / Reconsider / Undo).
 */
export function AgendaInboundRequestRow({
  request,
  circleId,
  loading = false,
  inHeroQueue = false,
  canOffer = false,
  recentlyWithdrawn = false,
  autoDeclined = false,
  onAcceptRide,
  onPassRide,
  onWithdrawRide,
}: AgendaInboundRequestRowProps) {
  const acceptedByUs = isAcceptedByCircle(request, circleId)

  const showHeroHandoff =
    inHeroQueue &&
    request.status === "PENDING" &&
    !request.passedByMe &&
    !autoDeclined &&
    !recentlyWithdrawn

  // Pass soft-decline: expanded row may still Accept (Focus skips passed asks).
  const canAccept =
    !showHeroHandoff &&
    !autoDeclined &&
    !recentlyWithdrawn &&
    request.status === "PENDING" &&
    onAcceptRide != null
  const canPass =
    !showHeroHandoff &&
    !autoDeclined &&
    !recentlyWithdrawn &&
    request.status === "PENDING" &&
    !request.passedByMe &&
    onPassRide != null

  const canReconsider =
    !showHeroHandoff &&
    autoDeclined &&
    canOffer &&
    request.status === "PENDING" &&
    onAcceptRide != null
  const canUndo =
    !showHeroHandoff &&
    recentlyWithdrawn &&
    canOffer &&
    request.status === "PENDING" &&
    onAcceptRide != null
  const canCantTakeThem =
    !showHeroHandoff && acceptedByUs && onWithdrawRide != null
  const withdrawLegs = acceptedByUs ? inboundWithdrawLegs(request.legs) : undefined
  const withdrawLabel = acceptedByUs
    ? inboundWithdrawLabel(request.legs)
    : REVERT_INBOUND_CANT_TAKE_THEM
  const placeKind = ridePlaceLineKind(
    acceptedByUs
      ? request.legs
      : request.status === "PENDING"
        ? request.legs
        : null,
  )

  const statusChip = inboundRequestStatusChip(request, circleId, { autoDeclined })
  const pendingLegChips =
    request.status === "PENDING" && !autoDeclined && !request.passedByMe
      ? inboundAskLegChips(request)
      : null
  const showPrimaryActions =
    canAccept || canPass || canCantTakeThem || canReconsider || canUndo

  return (
    <div
      data-testid={`agenda-inbound-request-${request.id}`}
      className="rounded-[var(--fc-radius-lg)] bg-[var(--fc-surface)] px-[var(--fc-space-md)] py-[var(--fc-space-sm)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-[var(--fc-space-sm)]">
        <div className="flex min-w-0 items-center gap-[var(--fc-space-sm)] text-[length:var(--fc-font-list-row-meta-size)] leading-[var(--fc-font-list-row-meta-line)] text-[var(--fc-text-primary)]">
          <Car
            aria-hidden
            className="size-[15px] shrink-0 text-[var(--fc-text-secondary)]"
          />
          <span className="min-w-0">{incomingRideAskSummary(request)}</span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-[var(--fc-space-xs)]">
          {pendingLegChips != null
            ? pendingLegChips.map((chip) => (
                <AgendaStatusChip key={chip.label} label={chip.label} tone={chip.tone} />
              ))
            : null}
          {statusChip != null ? (
            <AgendaStatusChip label={statusChip.label} tone={statusChip.tone} />
          ) : null}
        </div>
      </div>

      {!showHeroHandoff ? (
        <PickupLine
          pickupTown={request.pickupTown}
          detourMinutes={request.detourMinutes}
          placeKind={placeKind}
          className="mt-[var(--fc-space-sm)]"
        />
      ) : null}

      {showHeroHandoff ? (
        <p
          data-testid={`agenda-inbound-request-${request.id}-hero-handoff`}
          className="mt-[var(--fc-space-sm)] text-[length:var(--fc-font-subtitle-size)] leading-[var(--fc-font-subtitle-line)] text-[var(--fc-text-secondary)]"
        >
          {INBOUND_HERO_HANDOFF}
        </p>
      ) : null}

      {!showHeroHandoff && showPrimaryActions ? (
        <div className="mt-[var(--fc-space-sm)] flex flex-wrap items-center gap-[var(--fc-space-sm)]">
          {canAccept ? (
            <Button
              type="button"
              size="sm"
              disabled={loading}
              onClick={() => onAcceptRide?.(request.id)}
            >
              Accept
            </Button>
          ) : null}
          {canPass ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={loading}
              onClick={() => onPassRide?.(request.id)}
            >
              Pass
            </Button>
          ) : null}
          {canCantTakeThem ? (
            <button
              type="button"
              data-testid="agenda-row-accepted-by-us-withdraw"
              disabled={loading}
              onClick={() => onWithdrawRide(request.id, withdrawLegs)}
              className={revertLinkClassName}
            >
              {withdrawLabel}
            </button>
          ) : null}
          {canReconsider ? (
            <button
              type="button"
              disabled={loading}
              onClick={() => onAcceptRide?.(request.id)}
              className={revertLinkClassName}
            >
              {REVERT_INBOUND_RECONSIDER}
            </button>
          ) : null}
          {canUndo ? (
            <button
              type="button"
              disabled={loading}
              onClick={() => onAcceptRide?.(request.id)}
              className={`${revertLinkClassName} inline-flex items-center gap-1`}
            >
              <Undo2 aria-hidden size={12} />
              {REVERT_INBOUND_UNDO}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
