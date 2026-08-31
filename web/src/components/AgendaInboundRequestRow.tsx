import { useState } from "react"
import { Car, Undo2 } from "lucide-react"

import type { CarpoolRide, CarpoolRideEvent, Garage } from "@/api/types"
import { AgendaStatusChip, type AgendaStatusChipTone } from "@/components/agendaStatusChip"
import {
  callerDrives,
  circleDisplayName,
  eligibleVehiclesForAccept,
  incomingRideAskSummary,
  isAcceptedByCircle,
} from "@/components/carpoolDisplay"
import {
  REVERT_INBOUND_CANT_TAKE_THEM,
  REVERT_INBOUND_RECONSIDER,
  REVERT_INBOUND_UNDO,
} from "@/components/revertRideCopy"
import { Button } from "@/components/ui/button"

const revertLinkClassName =
  "text-xs underline underline-offset-2 text-[var(--fc-text-secondary)] disabled:cursor-not-allowed disabled:opacity-50"

export type AgendaInboundRequestRowProps = {
  request: CarpoolRide
  circleId: string
  currentAdultId: string
  garage: Garage | null
  rideEvent: CarpoolRideEvent
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
  onAcceptRide?: (rideId: string, vehicleId: string) => void
  onPassRide?: (rideId: string) => void
  onWithdrawRide?: (rideId: string) => void
}

export function inboundRequestStatusChip(
  request: CarpoolRide,
  circleId: string,
  options: { autoDeclined?: boolean } = {},
): { label: string; tone: AgendaStatusChipTone } {
  if (isAcceptedByCircle(request, circleId)) {
    return { label: "Accepted", tone: "mint" }
  }
  if (options.autoDeclined) {
    return { label: "Declined — you needed a ride too", tone: "muted" }
  }
  if (request.passedByMe) {
    return { label: "Passed", tone: "muted" }
  }
  if (request.status === "PENDING") {
    return { label: "Needs a ride", tone: "amber" }
  }
  if (request.status === "ACCEPTED") {
    return { label: "Accepted", tone: "mint" }
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
  currentAdultId,
  garage,
  rideEvent,
  loading = false,
  inHeroQueue = false,
  canOffer = false,
  recentlyWithdrawn = false,
  autoDeclined = false,
  onAcceptRide,
  onPassRide,
  onWithdrawRide,
}: AgendaInboundRequestRowProps) {
  const [selectedVehicleId, setSelectedVehicleId] = useState("")
  const acceptedByUs = isAcceptedByCircle(request, circleId)
  const drives = callerDrives(garage, currentAdultId)
  const eligible = eligibleVehiclesForAccept({
    drives,
    adultId: currentAdultId,
    vehicles: garage?.vehicles ?? [],
    event: rideEvent,
    request,
  })
  const vehicleId =
    eligible.length === 1 ? eligible[0]!.id : selectedVehicleId || eligible[0]?.id || ""

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
    eligible.length > 0 &&
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
    eligible.length > 0 &&
    onAcceptRide != null
  const canUndo =
    !showHeroHandoff &&
    recentlyWithdrawn &&
    canOffer &&
    request.status === "PENDING" &&
    eligible.length > 0 &&
    onAcceptRide != null
  const canCantTakeThem =
    !showHeroHandoff && acceptedByUs && onWithdrawRide != null

  const statusChip = inboundRequestStatusChip(request, circleId, { autoDeclined })
  const showVehicleSelect =
    (canAccept || canReconsider || canUndo) && eligible.length > 1
  const showSingleVehicleAccept = canAccept && eligible.length === 1
  const showSingleVehicleReconsider = canReconsider && eligible.length === 1
  const showSingleVehicleUndo = canUndo && eligible.length === 1
  const showPrimaryActions =
    showSingleVehicleAccept ||
    canPass ||
    canCantTakeThem ||
    showSingleVehicleReconsider ||
    showSingleVehicleUndo

  function acceptWithVehicle() {
    if (!vehicleId) {
      return
    }
    onAcceptRide?.(request.id, vehicleId)
  }

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
        <AgendaStatusChip label={statusChip.label} tone={statusChip.tone} />
      </div>

      {showHeroHandoff ? (
        <p
          data-testid={`agenda-inbound-request-${request.id}-hero-handoff`}
          className="mt-[var(--fc-space-sm)] text-[length:var(--fc-font-subtitle-size)] leading-[var(--fc-font-subtitle-line)] text-[var(--fc-text-secondary)]"
        >
          Handle in Needs your attention above
        </p>
      ) : null}

      {!showHeroHandoff && showVehicleSelect ? (
        <div className="mt-[var(--fc-space-sm)] flex flex-wrap items-center gap-[var(--fc-space-sm)]">
          <select
            aria-label={`Vehicle for ${circleDisplayName(request.requestingCircleName)}`}
            className="h-9 rounded-md border border-[var(--fc-border)] bg-transparent px-2 text-sm"
            value={selectedVehicleId}
            disabled={loading}
            onChange={(event) => setSelectedVehicleId(event.target.value)}
          >
            <option value="">Choose a vehicle</option>
            {eligible.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.label}
              </option>
            ))}
          </select>
          {canAccept ? (
            <Button
              type="button"
              size="sm"
              disabled={loading || !vehicleId}
              onClick={acceptWithVehicle}
            >
              Accept
            </Button>
          ) : null}
          {canReconsider ? (
            <button
              type="button"
              disabled={loading || !vehicleId}
              onClick={acceptWithVehicle}
              className={revertLinkClassName}
            >
              {REVERT_INBOUND_RECONSIDER}
            </button>
          ) : null}
          {canUndo ? (
            <button
              type="button"
              disabled={loading || !vehicleId}
              onClick={acceptWithVehicle}
              className={`${revertLinkClassName} inline-flex items-center gap-1`}
            >
              <Undo2 aria-hidden size={12} />
              {REVERT_INBOUND_UNDO}
            </button>
          ) : null}
        </div>
      ) : null}

      {!showHeroHandoff && showPrimaryActions ? (
        <div className="mt-[var(--fc-space-sm)] flex flex-wrap items-center gap-[var(--fc-space-sm)]">
          {showSingleVehicleAccept ? (
            <Button
              type="button"
              size="sm"
              disabled={loading}
              onClick={() => onAcceptRide?.(request.id, eligible[0]!.id)}
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
              onClick={() => onWithdrawRide(request.id)}
              className={revertLinkClassName}
            >
              {REVERT_INBOUND_CANT_TAKE_THEM}
            </button>
          ) : null}
          {showSingleVehicleReconsider ? (
            <button
              type="button"
              disabled={loading}
              onClick={() => onAcceptRide?.(request.id, eligible[0]!.id)}
              className={revertLinkClassName}
            >
              {REVERT_INBOUND_RECONSIDER}
            </button>
          ) : null}
          {showSingleVehicleUndo ? (
            <button
              type="button"
              disabled={loading}
              onClick={() => onAcceptRide?.(request.id, eligible[0]!.id)}
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
