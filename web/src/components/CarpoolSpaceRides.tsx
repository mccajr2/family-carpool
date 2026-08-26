import { useState } from "react"

import type { CarpoolRide, CarpoolRideEvent, Garage, Kid } from "@/api/types"
import {
  callerDrives,
  circleDisplayName,
  eligibleVehiclesForAccept,
  isAcceptedByCircle,
  kidDisplayName,
  ownRideStatusLine,
  rideSeatsLabel,
} from "@/components/carpoolDisplay"
import { formatIsoForDisplay } from "@/components/eventTimes"
import { Button } from "@/components/ui/button"

type CarpoolSpaceRidesProps = {
  events: CarpoolRideEvent[]
  circleId: string
  adultId: string
  kids: Kid[]
  garage: Garage | null
  busy: boolean
  onCreateRide: (eventKey: string, kidIds?: string[]) => void
  onAcceptRide: (rideId: string, vehicleId: string) => void
  onPassRide: (rideId: string) => void
  onCancelRide: (rideId: string) => void
  onWithdrawRide: (rideId: string) => void
}

export function CarpoolSpaceRides({
  events,
  circleId,
  adultId,
  kids,
  garage,
  busy,
  onCreateRide,
  onAcceptRide,
  onPassRide,
  onCancelRide,
  onWithdrawRide,
}: CarpoolSpaceRidesProps) {
  const [kidSelection, setKidSelection] = useState<Record<string, string[]>>({})
  const [vehicleSelection, setVehicleSelection] = useState<Record<string, string>>({})
  const drives = callerDrives(garage, adultId)
  const vehicles = garage?.vehicles ?? []

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
                eligible={eligibleVehiclesForAccept({
                  drives,
                  adultId,
                  vehicles,
                  event,
                  request,
                })}
                selectedVehicleId={vehicleSelection[request.id] ?? ""}
                onSelectVehicle={(vehicleId) =>
                  setVehicleSelection((prev) => ({ ...prev, [request.id]: vehicleId }))
                }
                onAccept={(vehicleId) => onAcceptRide(request.id, vehicleId)}
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
  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm text-muted-foreground">
        {statusLabel}
        {" · "}
        {ride.kidFirstNames.join(", ")}
        {" · "}
        {rideSeatsLabel(ride.seats)}
        {" · "}
        {ride.pickupPlaceName}, {ride.pickupAddress}
      </p>
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
  eligible,
  selectedVehicleId,
  onSelectVehicle,
  onAccept,
  onPass,
  onWithdraw,
}: {
  request: CarpoolRide
  circleId: string
  busy: boolean
  eligible: { id: string; label: string }[]
  selectedVehicleId: string
  onSelectVehicle: (vehicleId: string) => void
  onAccept: (vehicleId: string) => void
  onPass: () => void
  onWithdraw: () => void
}) {
  const acceptedByUs = isAcceptedByCircle(request, circleId)
  const canAccept = request.status === "PENDING" && eligible.length > 0
  // Pass: PENDING + not yet passedByMe. drives / vehicle not required (Focus
  // Accept eligibility does not gate Pass on the tab).
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
        : "Needs a ride"
  const vehicleId = eligible.length === 1 ? eligible[0]!.id : selectedVehicleId

  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm">
        {circleDisplayName(request.requestingCircleName)} · {request.kidFirstNames.join(", ")} ·{" "}
        {rideSeatsLabel(request.seats)} · {request.pickupPlaceName}, {request.pickupAddress}
      </p>
      <p className="text-xs text-muted-foreground">{status}</p>
      {canAccept && eligible.length === 1 ? (
        <Button
          type="button"
          size="sm"
          disabled={busy}
          onClick={() => onAccept(eligible[0]!.id)}
        >
          Accept
        </Button>
      ) : null}
      {canAccept && eligible.length > 1 ? (
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Vehicle"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={selectedVehicleId}
            disabled={busy}
            onChange={(change) => onSelectVehicle(change.target.value)}
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
            disabled={busy || !vehicleId}
            onClick={() => onAccept(vehicleId)}
          >
            Accept
          </Button>
        </div>
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
