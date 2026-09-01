import { useMemo, useState } from "react"
import type { CalendarItem, CarpoolRideEvent, FamilyCircle, Garage } from "@/api/types"
import {
  callerDrives,
  eligibleVehiclesForAccept,
} from "@/components/carpoolDisplay"
import { heroDaysUntilEvent } from "@/components/agendaFocusRing"
import type { QueueItem } from "@/components/coverageQueue"
import { DriverPicker } from "@/components/DriverPicker"
import { HeroAttentionDaysRing } from "@/components/HeroAttentionDaysRing"
import { pendingCoverageForAdult } from "@/components/coverageDisplay"
import { PickupLine } from "@/components/PickupLine"
import {
  heroEventContextLine,
  heroKidFirstName,
  heroRequestTitle,
  heroVenueLine,
} from "@/components/heroAttentionCopy"

export type HeroAttentionSlideProps = {
  item: QueueItem
  index: number
  queueLength: number
  calendarItem: CalendarItem
  circle: FamilyCircle
  currentAdultId: string
  loading?: boolean
  garage?: Garage | null
  rideEvent?: CarpoolRideEvent | null
  assignDraft: { adultId: string; kidIds: string[] }
  onUpdateAssignDraft: (patch: Partial<{ adultId: string; kidIds: string[] }>) => void
  onAssignCoverage: (adultId: string, kidIds: string[]) => void
  onAskTeam: () => void
  onConfirmCoverage?: (assignmentId: string) => void
  onDeclineCoverage?: (assignmentId: string) => void
  onAcceptRide?: (rideId: string, vehicleId: string) => void
  onPassRide?: (rideId: string) => void
  now?: Date
}

function requestRideForSlide(
  rideEvent: CarpoolRideEvent | null | undefined,
  requestId: string,
) {
  return rideEvent?.otherRequests.find((ride) => ride.id === requestId) ?? null
}

export function HeroAttentionSlide({
  item,
  index,
  queueLength,
  calendarItem,
  circle,
  currentAdultId,
  loading = false,
  garage = null,
  rideEvent = null,
  assignDraft,
  onUpdateAssignDraft,
  onAssignCoverage,
  onAskTeam,
  onConfirmCoverage,
  onDeclineCoverage,
  onAcceptRide,
  onPassRide,
  now = new Date(),
}: HeroAttentionSlideProps) {
  const [acceptVehicleId, setAcceptVehicleId] = useState("")
  const days = heroDaysUntilEvent(item.game.startsAt, now)
  const contextLine = heroEventContextLine(calendarItem, now)
  const venue = heroVenueLine(calendarItem)
  const kidFirstName = heroKidFirstName(item.game.kidId, circle.kids)
  const pendingForSelf = pendingCoverageForAdult(calendarItem, currentAdultId)

  const requestAccept = useMemo(() => {
    if (item.kind !== "request") {
      return null
    }
    const ride = requestRideForSlide(rideEvent, item.request.id)
    if (ride == null || ride.status !== "PENDING" || ride.passedByMe) {
      return null
    }
    const drives = callerDrives(garage, currentAdultId)
    const vehicles = eligibleVehiclesForAccept({
      drives,
      adultId: currentAdultId,
      vehicles: garage?.vehicles ?? [],
      event: rideEvent!,
      request: ride,
    })
    if (vehicles.length === 0) {
      return null
    }
    return { ride, vehicles }
  }, [currentAdultId, garage, item, rideEvent])

  const acceptVehicle =
    requestAccept?.vehicles.find((vehicle) => vehicle.id === acceptVehicleId)?.id ??
    requestAccept?.vehicles[0]?.id ??
    ""

  return (
    <div
      data-testid="hero-attention-slide"
      data-slide-kind={item.kind}
      className="relative h-full overflow-hidden rounded-2xl p-[var(--fc-space-hero-slide-pad)] text-[var(--fc-hero-on)]"
      style={{ background: "var(--fc-hero-glow)" }}
    >
      <div className="flex items-start justify-between gap-[var(--fc-space-lg)]">
        <div className="min-w-0 flex-1">
          <div className="mb-[var(--fc-space-sm)] flex flex-wrap items-center gap-[var(--fc-space-sm)] text-xs font-semibold uppercase tracking-widest">
            {index === 0 ? (
              <>
                <span
                  className="rounded-full px-2 py-0.5"
                  style={{ background: "var(--fc-hero-most-urgent-badge)" }}
                >
                  Most urgent
                </span>
                {queueLength > 1 ? (
                  <span style={{ color: "var(--fc-hero-on-secondary)" }}>
                    · {queueLength} things need you
                  </span>
                ) : null}
              </>
            ) : (
              <span style={{ color: "var(--fc-hero-on-secondary)" }}>Up next</span>
            )}
          </div>

          {item.kind === "ownRide" ? (
            <>
              <h2
                className="fc-display mb-[var(--fc-space-sm)] text-[length:var(--fc-font-focus-title-size)] leading-[var(--fc-font-focus-title-line)] font-[number:var(--fc-font-focus-title-weight)]"
                data-testid="hero-attention-slide-title"
              >
                {kidFirstName} needs a ride
              </h2>
              <p
                className="text-[length:var(--fc-font-focus-when-size)] leading-[var(--fc-font-focus-when-line)] font-[number:var(--fc-font-focus-when-weight)]"
                style={{ color: "var(--fc-hero-on-secondary)" }}
              >
                {contextLine}
              </p>
              {venue ? (
                <p
                  className="mt-1 text-sm"
                  style={{ color: "var(--fc-hero-on-secondary)" }}
                >
                  {venue}
                </p>
              ) : null}
              {pendingForSelf && onConfirmCoverage && onDeclineCoverage ? (
                <div className="mt-[var(--fc-space-xl)] flex flex-wrap gap-[var(--fc-space-md)]">
                  <button
                    type="button"
                    data-testid="hero-attention-confirm-coverage"
                    className="rounded-lg px-4 py-2 text-sm font-semibold text-[var(--fc-text-primary)]"
                    style={{ background: "var(--fc-hero-on)" }}
                    disabled={loading}
                    onClick={() => onConfirmCoverage(pendingForSelf.id)}
                  >
                    Confirm coverage
                  </button>
                  <button
                    type="button"
                    data-testid="hero-attention-decline-coverage"
                    className="rounded-lg px-4 py-2 text-sm font-semibold text-[var(--fc-hero-on)]"
                    style={{ background: "var(--fc-hero-decline-bg)" }}
                    disabled={loading}
                    onClick={() => onDeclineCoverage(pendingForSelf.id)}
                  >
                    Decline coverage
                  </button>
                </div>
              ) : (
                <div className="mt-[var(--fc-space-xl)] [&_button]:text-sm">
                  <DriverPicker
                    members={circle.members}
                    currentAdultId={currentAdultId}
                    selectedAdultId={assignDraft.adultId}
                    onSelectedAdultChange={(adultId) => onUpdateAssignDraft({ adultId })}
                    kidIds={assignDraft.kidIds}
                    loading={loading}
                    hero
                    showTeamSection={rideEvent != null}
                    onAssignCoverage={onAssignCoverage}
                    onAskTeam={onAskTeam}
                  />
                </div>
              )}
            </>
          ) : (
            <>
              <h2
                className="fc-display mb-[var(--fc-space-sm)] text-[length:var(--fc-font-focus-title-size)] leading-[var(--fc-font-focus-title-line)] font-[number:var(--fc-font-focus-title-weight)]"
                data-testid="hero-attention-slide-title"
              >
                {heroRequestTitle(item.request)}
              </h2>
              <p
                className="text-[length:var(--fc-font-focus-when-size)] leading-[var(--fc-font-focus-when-line)] font-[number:var(--fc-font-focus-when-weight)]"
                style={{ color: "var(--fc-hero-on-secondary)" }}
              >
                {contextLine}
              </p>
              <p
                className="mt-1 text-sm"
                style={{ color: "var(--fc-hero-on-secondary)" }}
              >
                {[venue, `${kidFirstName} is already going`].filter(Boolean).join(" · ")}
              </p>
              <PickupLine
                data-testid="hero-attention-pickup-summary"
                pickupTown={item.request.pickupTown}
                detourMinutes={item.request.detourMinutes}
                variant="hero"
              />
              {requestAccept && onAcceptRide && onPassRide ? (
                <div className="mt-[var(--fc-space-xl)] flex flex-wrap gap-[var(--fc-space-md)]">
                  {requestAccept.vehicles.length > 1 ? (
                    <select
                      aria-label="Vehicle"
                      className="h-9 rounded-md border bg-transparent px-[var(--fc-space-md)] text-sm"
                      style={{
                        borderColor: "rgba(255,255,255,0.12)",
                        color: "var(--fc-hero-on)",
                      }}
                      value={acceptVehicleId || acceptVehicle}
                      disabled={loading}
                      onChange={(event) => setAcceptVehicleId(event.target.value)}
                    >
                      {requestAccept.vehicles.map((vehicle) => (
                        <option key={vehicle.id} value={vehicle.id}>
                          {vehicle.label}
                        </option>
                      ))}
                    </select>
                  ) : null}
                  <button
                    type="button"
                    className="rounded-xl px-5 py-3 font-semibold text-[var(--fc-text-primary)]"
                    style={{ background: "var(--fc-hero-on)" }}
                    disabled={loading || !acceptVehicle}
                    onClick={() => onAcceptRide(requestAccept.ride.id, acceptVehicle)}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    className="rounded-xl px-5 py-3 font-semibold text-[var(--fc-hero-on)]"
                    style={{ background: "var(--fc-hero-decline-bg)" }}
                    disabled={loading}
                    onClick={() => onPassRide(requestAccept.ride.id)}
                  >
                    Decline
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
        <HeroAttentionDaysRing days={days} />
      </div>
    </div>
  )
}
