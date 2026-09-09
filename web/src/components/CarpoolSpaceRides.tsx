import { useState } from "react"

import type {
  CarpoolLeg,
  CarpoolRequest,
  CarpoolRideEvent,
  Garage,
  Kid,
  Vehicle,
} from "@/api/types"
import {
  callerDrives,
  circleDisplayName,
  kidDisplayName,
} from "@/components/carpoolDisplay"
import { formatIsoForDisplay } from "@/components/eventTimes"
import { PickupLine } from "@/components/PickupLine"
import {
  DEFAULT_RIDE_NEEDED_LEGS,
  defaultKidsNeedingCarpoolRequest,
  type RideNeededLegsChoice,
} from "@/components/rideNeededLegs"
import { RideNeededLegsControl } from "@/components/RideNeededLegsControl"
import { Button } from "@/components/ui/button"

type CarpoolSpaceRidesProps = {
  events: CarpoolRideEvent[]
  circleId: string
  adultId: string
  kids: Kid[]
  garage: Garage | null
  busy: boolean
  onCreateRide: (eventKey: string, kidIds?: string[], legs?: CarpoolLeg) => void
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
  const [legsSelection, setLegsSelection] = useState<Record<string, RideNeededLegsChoice>>(
    {},
  )
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
        const kidsNeedingAsk = defaultKidsNeedingCarpoolRequest(event)
        const selectedKids = kidSelection[event.eventKey] ?? kidsNeedingAsk
        const legs = legsSelection[event.eventKey] ?? DEFAULT_RIDE_NEEDED_LEGS
        return (
          <li key={event.eventKey} className="flex flex-col gap-1">
            <span className="text-sm font-medium">{event.title}</span>
            <span className="text-xs text-muted-foreground">
              {formatIsoForDisplay(event.startsAt)}
            </span>
            {event.ownRequests.map((request) => (
              <OwnRideStatus
                key={request.id}
                request={request}
                busy={busy}
                onCancel={() => onCancelRide(request.id)}
              />
            ))}
            {kidsNeedingAsk.length > 0 ? (
              <RequestRideControls
                eventKey={event.eventKey}
                kids={kids}
                defaultKidIds={kidsNeedingAsk}
                selectedKids={selectedKids}
                legs={legs}
                busy={busy}
                onToggleKid={(kidId, checked) => {
                  const current = kidSelection[event.eventKey] ?? kidsNeedingAsk
                  const next = checked
                    ? [...current, kidId]
                    : current.filter((id) => id !== kidId)
                  setKidSelection((prev) => ({ ...prev, [event.eventKey]: next }))
                }}
                onLegsChange={(next) =>
                  setLegsSelection((prev) => ({ ...prev, [event.eventKey]: next }))
                }
                onRequest={() => {
                  onCreateRide(event.eventKey, selectedKids, legs)
                }}
              />
            ) : event.ownRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No kids need a ride for this event.
              </p>
            ) : null}
            {event.otherRequests.map((request) => (
              <OtherRideRequest
                key={request.id}
                request={request}
                circleId={circleId}
                busy={busy}
                eligible={eligibleVehiclesForOpenRequest({
                  drives,
                  adultId,
                  vehicles,
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
  request,
  busy,
  onCancel,
}: {
  request: CarpoolRequest
  busy: boolean
  onCancel: () => void
}) {
  const statusLabel =
    request.status === "FULLY_COVERED"
      ? "Covered"
      : request.status === "PARTIAL"
        ? "Partially covered"
        : request.passedByAdultNames.length > 0
          ? `Passed by ${request.passedByAdultNames.join(", ")}`
          : "Asked the team"
  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm text-muted-foreground">
        {request.kidFirstName}: {statusLabel}
      </p>
      {request.status === "UNCOVERED" || request.status === "PARTIAL" ? (
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
      ) : null}
    </div>
  )
}

/** Interim seat-free eligibility until carpoolDisplay maps per-leg rides. */
function eligibleVehiclesForOpenRequest(options: {
  drives: boolean
  adultId: string
  vehicles: Vehicle[]
  request: CarpoolRequest
}): { id: string; label: string }[] {
  if (
    !options.drives ||
    (options.request.status !== "UNCOVERED" && options.request.status !== "PARTIAL")
  ) {
    return []
  }
  return options.vehicles
    .filter((vehicle) => vehicle.driverAdultIds.includes(options.adultId))
    .map((vehicle) => ({
      id: vehicle.id,
      label: vehicle.label?.trim() || "Vehicle",
    }))
}

function RequestRideControls({
  eventKey,
  kids,
  defaultKidIds,
  selectedKids,
  legs,
  busy,
  onToggleKid,
  onLegsChange,
  onRequest,
}: {
  eventKey: string
  kids: Kid[]
  defaultKidIds: string[]
  selectedKids: string[]
  legs: RideNeededLegsChoice
  busy: boolean
  onToggleKid: (kidId: string, checked: boolean) => void
  onLegsChange: (legs: RideNeededLegsChoice) => void
  onRequest: () => void
}) {
  return (
    <div className="flex flex-col gap-1">
      {defaultKidIds.length > 1
        ? defaultKidIds.map((kidId) => {
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
      <RideNeededLegsControl
        id={`carpool-request-legs-${eventKey}`}
        value={legs}
        onChange={onLegsChange}
        disabled={busy}
      />
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
  request: CarpoolRequest
  circleId: string
  busy: boolean
  eligible: { id: string; label: string }[]
  selectedVehicleId: string
  onSelectVehicle: (vehicleId: string) => void
  onAccept: (vehicleId: string) => void
  onPass: () => void
  onWithdraw: () => void
}) {
  const openNeed = request.status === "UNCOVERED" || request.status === "PARTIAL"
  const acceptedByUs =
    request.status === "FULLY_COVERED" && request.acceptingCircleId === circleId
  const canAccept = openNeed && eligible.length > 0
  const canPass = openNeed && !request.passedByMe
  const status =
    request.status === "FULLY_COVERED"
      ? `Accepted${
          request.acceptingCircleName
            ? ` by ${circleDisplayName(request.acceptingCircleName)}`
            : ""
        }`
      : request.passedByMe
        ? "Passed"
        : "Needs a ride"
  const vehicleId = eligible.length === 1 ? eligible[0]!.id : selectedVehicleId
  const askSummary = `${circleDisplayName(request.requestingCircleName)} · ${request.kidFirstName}`

  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm">{askSummary}</p>
      <p className="text-xs text-muted-foreground">{status}</p>
      {canAccept || canPass ? (
        <PickupLine
          pickupTown={request.pickupTown}
          detourMinutes={request.detourMinutes}
        />
      ) : null}
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
