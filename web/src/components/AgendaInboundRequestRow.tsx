import { useState } from "react"
import { Car } from "lucide-react"

import type { CarpoolRide, CarpoolRideEvent, Garage } from "@/api/types"
import { AgendaStatusChip, type AgendaStatusChipTone } from "@/components/agendaStatusChip"
import {
  callerDrives,
  circleDisplayName,
  eligibleVehiclesForAccept,
  incomingRideAskSummary,
  isAcceptedByCircle,
} from "@/components/carpoolDisplay"
import { Button } from "@/components/ui/button"

export type AgendaInboundRequestRowProps = {
  request: CarpoolRide
  circleId: string
  currentAdultId: string
  garage: Garage | null
  rideEvent: CarpoolRideEvent
  loading?: boolean
  inHeroQueue?: boolean
  onAcceptRide?: (rideId: string, vehicleId: string) => void
  onPassRide?: (rideId: string) => void
  onWithdrawRide?: (rideId: string) => void
}

export function inboundRequestStatusChip(
  request: CarpoolRide,
  circleId: string,
): { label: string; tone: AgendaStatusChipTone } {
  if (isAcceptedByCircle(request, circleId)) {
    return { label: "Accepted", tone: "mint" }
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
 * Accept/Pass when actionable and not duplicated in the hero carousel).
 */
export function AgendaInboundRequestRow({
  request,
  circleId,
  currentAdultId,
  garage,
  rideEvent,
  loading = false,
  inHeroQueue = false,
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
  const canAccept =
    !inHeroQueue &&
    request.status === "PENDING" &&
    !request.passedByMe &&
    eligible.length > 0 &&
    onAcceptRide != null
  const canPass =
    !inHeroQueue &&
    request.status === "PENDING" &&
    !request.passedByMe &&
    onPassRide != null
  const vehicleId =
    eligible.length === 1 ? eligible[0]!.id : selectedVehicleId || eligible[0]?.id || ""
  const statusChip = inboundRequestStatusChip(request, circleId)
  const showHeroHandoff =
    inHeroQueue &&
    request.status === "PENDING" &&
    !request.passedByMe

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

      {!showHeroHandoff && canAccept && eligible.length > 1 ? (
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
          <Button
            type="button"
            size="sm"
            disabled={loading || !vehicleId}
            onClick={() => onAcceptRide?.(request.id, vehicleId)}
          >
            Accept
          </Button>
        </div>
      ) : null}

      {!showHeroHandoff && (canAccept || canPass || acceptedByUs) ? (
        <div className="mt-[var(--fc-space-sm)] flex flex-wrap gap-[var(--fc-space-sm)]">
          {canAccept && eligible.length === 1 ? (
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
          {acceptedByUs && onWithdrawRide != null ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              data-testid="agenda-row-accepted-by-us-withdraw"
              disabled={loading}
              onClick={() => onWithdrawRide(request.id)}
            >
              Withdraw
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
