import { useState } from "react"

import type { CarpoolRide, CarpoolRideEvent, Kid } from "@/api/types"
import {
  circleDisplayName,
  incomingRideAskSummary,
  isAcceptedByCircle,
  kidDisplayName,
  ownRideDetailLine,
  ownRideStatusLine,
} from "@/components/carpoolDisplay"
import { formatIsoForDisplay } from "@/components/eventTimes"
import { PickupLine } from "@/components/PickupLine"
import { inboundAskLegChips, rideLegStatusChips } from "@/components/rideStatusChip"
import { Button } from "@/components/ui/button"

type CarpoolSpaceRidesProps = {
  events: CarpoolRideEvent[]
  circleId: string
  kids: Kid[]
  busy: boolean
  onCreateRide: (eventKey: string, kidIds?: string[]) => void
  onAcceptRide: (rideId: string) => void
  onPassRide: (rideId: string) => void
  onCancelRide: (rideId: string) => void
  onWithdrawRide: (rideId: string) => void
}

export function CarpoolSpaceRides({
  events,
  circleId,
  kids,
  busy,
  onCreateRide,
  onAcceptRide,
  onPassRide,
  onCancelRide,
  onWithdrawRide,
}: CarpoolSpaceRidesProps) {
  const [kidSelection, setKidSelection] = useState<Record<string, string[]>>({})

  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No upcoming events.</p>
    )
  }

  return (
    <ul className="flex flex-col gap-3" aria-label="Upcoming rides">
      {events.map((event) => {
        const selectedKids = kidSelection[event.eventKey] ?? event.defaultKidIds
        return (
          <li key={event.eventKey} className="flex flex-col gap-1">
            <span className="text-sm font-medium">{event.title}</span>
            <span className="text-xs text-muted-foreground">
              {formatIsoForDisplay(event.startsAt)}
            </span>
            {event.ownRequest ? (
              <OwnRideStatus
                ride={event.ownRequest}
                busy={busy}
                onCancel={() => onCancelRide(event.ownRequest!.id)}
              />
            ) : event.defaultKidIds.length > 0 ? (
              <RequestRideControls
                event={event}
                kids={kids}
                selectedKids={selectedKids}
                busy={busy}
                onToggleKid={(kidId, checked) => {
                  const current = kidSelection[event.eventKey] ?? event.defaultKidIds
                  const next = checked
                    ? [...current, kidId]
                    : current.filter((id) => id !== kidId)
                  setKidSelection((prev) => ({ ...prev, [event.eventKey]: next }))
                }}
                onRequest={() => {
                  const allDefault =
                    selectedKids.length === event.defaultKidIds.length &&
                    selectedKids.every((id) => event.defaultKidIds.includes(id))
                  onCreateRide(event.eventKey, allDefault ? undefined : selectedKids)
                }}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                No kids need a ride for this event.
              </p>
            )}
            {event.otherRequests.map((request) => (
              <OtherRideRequest
                key={request.id}
                request={request}
                circleId={circleId}
                busy={busy}
                onAccept={() => onAcceptRide(request.id)}
                onPass={() => onPassRide(request.id)}
                onWithdraw={() => onWithdrawRide(request.id)}
              />
            ))}
          </li>
        )
      })}
    </ul>
  )
}

function OwnRideStatus({
  ride,
  busy,
  onCancel,
}: {
  ride: CarpoolRide
  busy: boolean
  onCancel: () => void
}) {
  const statusLabel =
    ride.status === "ACCEPTED"
      ? `Accepted${
          ride.acceptingCircleName
            ? ` by ${circleDisplayName(ride.acceptingCircleName)}`
            : ""
        }`
      : ownRideStatusLine(ride)
  const legLabels = rideLegStatusChips(ride.legs)
    .map((chip) => chip.label)
    .join(" · ")
  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm text-muted-foreground">{ownRideDetailLine(ride, statusLabel)}</p>
      {legLabels ? (
        <p className="text-xs text-muted-foreground" data-testid={`own-ride-legs-${ride.id}`}>
          {legLabels}
        </p>
      ) : null}
      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onCancel}>
        Cancel
      </Button>
    </div>
  )
}

function RequestRideControls({
  event,
  kids,
  selectedKids,
  busy,
  onToggleKid,
  onRequest,
}: {
  event: CarpoolRideEvent
  kids: Kid[]
  selectedKids: string[]
  busy: boolean
  onToggleKid: (kidId: string, checked: boolean) => void
  onRequest: () => void
}) {
  return (
    <div className="flex flex-col gap-1">
      {event.defaultKidIds.length > 1
        ? event.defaultKidIds.map((kidId) => {
            const name = kidDisplayName(kids, kidId)
            return (
              <label key={kidId} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  aria-label={name}
                  checked={selectedKids.includes(kidId)}
                  disabled={busy}
                  onChange={(change) => onToggleKid(kidId, change.target.checked)}
                />
                {name}
              </label>
            )
          })
        : null}
      <Button
        type="button"
        size="sm"
        disabled={busy || selectedKids.length === 0}
        onClick={onRequest}
      >
        Request
      </Button>
    </div>
  )
}

function OtherRideRequest({
  request,
  circleId,
  busy,
  onAccept,
  onPass,
  onWithdraw,
}: {
  request: CarpoolRide
  circleId: string
  busy: boolean
  onAccept: () => void
  onPass: () => void
  onWithdraw: () => void
}) {
  const acceptedByUs = isAcceptedByCircle(request, circleId)
  const canAccept = request.status === "PENDING"
  // Pass: PENDING + not yet passedByMe.
  const canPass = request.status === "PENDING" && !request.passedByMe
  const status =
    request.status === "ACCEPTED"
      ? `Accepted${
          request.acceptingCircleName
            ? ` by ${circleDisplayName(request.acceptingCircleName)}`
            : ""
        }`
      : request.passedByMe
        ? "Passed"
        : inboundAskLegChips(request)
            .map((chip) => chip.label)
            .join(" · ")

  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm">{incomingRideAskSummary(request)}</p>
      <p className="text-xs text-muted-foreground">{status}</p>
      {canAccept || canPass ? (
        <PickupLine
          pickupTown={request.pickupTown}
          detourMinutes={request.detourMinutes}
        />
      ) : null}
      {canAccept ? (
        <Button type="button" size="sm" disabled={busy} onClick={onAccept}>
          Accept
        </Button>
      ) : null}
      {canPass ? (
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onPass}>
          Pass
        </Button>
      ) : null}
      {acceptedByUs ? (
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onWithdraw}>
          Withdraw
        </Button>
      ) : null}
    </div>
  )
}
