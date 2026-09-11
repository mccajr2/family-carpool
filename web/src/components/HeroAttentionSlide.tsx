import { useMemo, useState } from "react"
import type {
  CalendarItem,
  CarpoolRideEvent,
  FamilyCircle,
  SetCalendarLeaveFromRequest,
} from "@/api/types"
import type { QueueItem } from "@/components/coverageQueue"
import { DriverPicker } from "@/components/DriverPicker"
import { EventLocationLine } from "@/components/EventLocationLine"
import { HeroAttentionDaysRing } from "@/components/HeroAttentionDaysRing"
import { pendingCoverageForAdult } from "@/components/coverageDisplay"
import {
  CONFIRM_COVERAGE,
  DECLINE_COVERAGE,
  HERO_MOST_URGENT,
  HERO_ON_INVERSE,
  HERO_UP_NEXT,
  heroQueueCountLabel,
  kidAlreadyGoingSuffix,
  kidNeedsRideTitle,
} from "@/components/coverageCopy"
import { formatCompactEventWhen } from "@/components/eventTimes"
import { LeaveFromControls } from "@/components/LeaveFromControls"
import {
  type LeaveFromFields,
  resolvedLeaveFromLabel,
} from "@/components/leaveFromDisplay"
import { AgendaStatusChip } from "@/components/agendaStatusChip"
import { PickupLine } from "@/components/PickupLine"
import {
  heroKidFirstName,
  heroRequestTitle,
  heroVenueLine,
} from "@/components/heroAttentionCopy"
import { inboundAskLegChips } from "@/components/rideStatusChip"

export type HeroAttentionSlideProps = {
  item: QueueItem
  index: number
  queueLength: number
  calendarItem: CalendarItem
  circle: FamilyCircle
  currentAdultId: string
  loading?: boolean
  rideEvent?: CarpoolRideEvent | null
  assignDraft: { adultId: string; kidIds: string[] }
  onUpdateAssignDraft: (patch: Partial<{ adultId: string; kidIds: string[] }>) => void
  onAssignCoverage: (adultId: string, kidIds: string[]) => void
  onAskTeam: () => void
  onConfirmCoverage?: (assignmentId: string) => void
  onDeclineCoverage?: (assignmentId: string) => void
  onAcceptRide?: (rideId: string) => void
  onPassRide?: (rideId: string) => void
  /** Leave-from fields (draft before Assign/Confirm, or live after covering). */
  leaveFromValue?: LeaveFromFields
  onSetLeaveFrom?: (body: SetCalendarLeaveFromRequest) => void
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
  rideEvent = null,
  assignDraft,
  onUpdateAssignDraft,
  onAssignCoverage,
  onAskTeam,
  onConfirmCoverage,
  onDeclineCoverage,
  onAcceptRide,
  onPassRide,
  leaveFromValue,
  onSetLeaveFrom,
  now = new Date(),
}: HeroAttentionSlideProps) {
  const [confirmOriginLabel, setConfirmOriginLabel] = useState("")
  const whenLabel = formatCompactEventWhen(calendarItem.startsAt, calendarItem.endsAt)
  const venue = heroVenueLine(calendarItem)
  const kidFirstName = heroKidFirstName(item.game.kidId, circle.kids)
  const pendingForSelf = pendingCoverageForAdult(calendarItem, currentAdultId)
  const leaveFromFields: LeaveFromFields = leaveFromValue ?? {
    leaveFromPlaceId: calendarItem.leaveFromPlaceId,
    leaveFromPlaceName: calendarItem.leaveFromPlaceName,
    leaveFromAddress: calendarItem.leaveFromAddress,
  }
  const showLeaveFrom = item.kind === "ownRide" && onSetLeaveFrom != null
  const originForConfirm =
    confirmOriginLabel || resolvedLeaveFromLabel(leaveFromFields, circle)

  const leaveFromSlot =
    showLeaveFrom && !pendingForSelf ? (
      <div
        style={{ color: "var(--fc-hero-on-secondary)" }}
        data-testid="hero-attention-leave-from"
      >
        <LeaveFromControls
          variant="subtle"
          value={leaveFromFields}
          circle={circle}
          loading={loading}
          ariaLabel={`Leave from for ${calendarItem.title}`}
          onChange={onSetLeaveFrom!}
          onConfirmOriginLabelChange={setConfirmOriginLabel}
          testIdPrefix={`hero-leave-from-${calendarItem.source}-${calendarItem.id}`}
        />
      </div>
    ) : null

  const requestAccept = useMemo(() => {
    if (item.kind !== "request") {
      return null
    }
    const ride = requestRideForSlide(rideEvent, item.request.id)
    if (ride == null || ride.status !== "PENDING" || ride.passedByMe) {
      return null
    }
    return ride
  }, [item, rideEvent])
  const inboundLegChips =
    requestAccept != null ? inboundAskLegChips(requestAccept) : []

  return (
    <div
      data-testid="hero-attention-slide"
      data-slide-kind={item.kind}
      className="relative h-full min-w-0 overflow-hidden rounded-2xl p-[var(--fc-space-hero-slide-pad)] text-[var(--fc-hero-on)]"
      style={{ background: "var(--fc-hero-glow)" }}
    >
      <div className="flex min-w-0 items-start justify-between gap-[var(--fc-space-lg)]">
        <div className="min-w-0 flex-1">
          <div className="mb-[var(--fc-space-sm)] flex flex-wrap items-center gap-[var(--fc-space-sm)] text-xs font-semibold uppercase tracking-widest">
            {index === 0 ? (
              <>
                <span
                  className="rounded-full px-2 py-0.5"
                  style={{ background: "var(--fc-hero-most-urgent-badge)" }}
                >
                  {HERO_MOST_URGENT}
                </span>
                {queueLength > 1 ? (
                  <span style={{ color: "var(--fc-hero-on-secondary)" }}>
                    {heroQueueCountLabel(queueLength)}
                  </span>
                ) : null}
              </>
            ) : (
              <span style={{ color: "var(--fc-hero-on-secondary)" }}>{HERO_UP_NEXT}</span>
            )}
          </div>

          {item.kind === "ownRide" ? (
            <>
              <h2
                className="fc-display mb-[var(--fc-space-sm)] text-[length:var(--fc-font-focus-title-size)] leading-[var(--fc-font-focus-title-line)] font-[number:var(--fc-font-focus-title-weight)]"
                data-testid="hero-attention-slide-title"
              >
                {kidNeedsRideTitle(kidFirstName)}
              </h2>
              <p
                data-testid="hero-attention-when"
                className="text-[length:var(--fc-font-focus-when-size)] leading-[var(--fc-font-focus-when-line)] font-[number:var(--fc-font-focus-when-weight)]"
                style={{ color: "var(--fc-hero-on-secondary)" }}
              >
                {whenLabel}
              </p>
              <EventLocationLine
                location={venue}
                color="var(--fc-hero-on-secondary)"
                className="mt-1"
                data-testid="hero-attention-where"
              />
              {pendingForSelf && onConfirmCoverage && onDeclineCoverage ? (
                <div
                  className="mt-[var(--fc-space-xl)] flex min-w-0 max-w-full flex-col gap-[var(--fc-space-md)] border-t pt-[var(--fc-space-md)]"
                  style={{ borderColor: "rgba(255,255,255,0.14)" }}
                >
                  {showLeaveFrom ? (
                    <div
                      style={{ color: "var(--fc-hero-on-secondary)" }}
                      data-testid="hero-attention-leave-from"
                    >
                      <LeaveFromControls
                        variant="subtle"
                        value={leaveFromFields}
                        circle={circle}
                        loading={loading}
                        ariaLabel={`Leave from for ${calendarItem.title}`}
                        onChange={onSetLeaveFrom!}
                        testIdPrefix={`hero-leave-from-${calendarItem.source}-${calendarItem.id}`}
                      />
                    </div>
                  ) : null}
                  <div className="flex min-w-0 max-w-full flex-wrap gap-[var(--fc-space-md)]">
                    <button
                      type="button"
                      data-testid="hero-attention-confirm-coverage"
                      className="rounded-lg px-4 py-2 text-sm font-semibold"
                      style={{ backgroundColor: "var(--fc-hero-on)", color: HERO_ON_INVERSE }}
                      disabled={loading}
                      onClick={() => onConfirmCoverage(pendingForSelf.id)}
                    >
                      {CONFIRM_COVERAGE}
                    </button>
                    <button
                      type="button"
                      data-testid="hero-attention-decline-coverage"
                      className="rounded-lg px-4 py-2 text-sm font-semibold text-[var(--fc-hero-on)]"
                      style={{ backgroundColor: "var(--fc-hero-decline-bg)" }}
                      disabled={loading}
                      onClick={() => onDeclineCoverage(pendingForSelf.id)}
                    >
                      {DECLINE_COVERAGE}
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className="mt-[var(--fc-space-xl)] min-w-0 max-w-full border-t pt-[var(--fc-space-md)] [&_button]:text-sm"
                  style={{ borderColor: "rgba(255,255,255,0.14)" }}
                >
                  <DriverPicker
                    members={circle.members}
                    currentAdultId={currentAdultId}
                    selectedAdultId={assignDraft.adultId}
                    onSelectedAdultChange={(adultId) => onUpdateAssignDraft({ adultId })}
                    kidIds={assignDraft.kidIds}
                    loading={loading}
                    hero
                    showTeamSection={rideEvent != null}
                    leaveFromSlot={leaveFromSlot}
                    leaveFromLabel={originForConfirm}
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
                data-testid="hero-attention-when"
                className="text-[length:var(--fc-font-focus-when-size)] leading-[var(--fc-font-focus-when-line)] font-[number:var(--fc-font-focus-when-weight)]"
                style={{ color: "var(--fc-hero-on-secondary)" }}
              >
                {whenLabel}
              </p>
              <EventLocationLine
                location={venue}
                color="var(--fc-hero-on-secondary)"
                className="mt-1"
                data-testid="hero-attention-where"
              />
              <p
                className="mt-1 text-sm"
                style={{ color: "var(--fc-hero-on-secondary)" }}
              >
                {kidAlreadyGoingSuffix(kidFirstName)}
              </p>
              <PickupLine
                data-testid="hero-attention-pickup-summary"
                pickupTown={item.request.pickupTown}
                detourMinutes={item.request.detourMinutes}
                variant="hero"
              />
              {inboundLegChips.length > 0 ? (
                <div
                  data-testid="hero-attention-incoming-leg-chips"
                  className="mt-[var(--fc-space-md)] flex min-w-0 max-w-full flex-wrap gap-[var(--fc-space-xs)]"
                >
                  {inboundLegChips.map((chip) => (
                    <AgendaStatusChip
                      key={chip.label}
                      label={chip.label}
                      tone={chip.tone}
                      variant="hero"
                    />
                  ))}
                </div>
              ) : null}
              {requestAccept && onAcceptRide && onPassRide ? (
                <div className="mt-[var(--fc-space-xl)] flex min-w-0 max-w-full flex-wrap gap-[var(--fc-space-md)]">
                  <button
                    type="button"
                    className="rounded-xl px-5 py-3 font-semibold"
                    style={{ backgroundColor: "var(--fc-hero-on)", color: HERO_ON_INVERSE }}
                    disabled={loading}
                    onClick={() => onAcceptRide(requestAccept.id)}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    className="rounded-xl px-5 py-3 font-semibold text-[var(--fc-hero-on)]"
                    style={{ backgroundColor: "var(--fc-hero-decline-bg)" }}
                    disabled={loading}
                    onClick={() => onPassRide(requestAccept.id)}
                  >
                    Decline
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
        <HeroAttentionDaysRing startsAt={item.game.startsAt} now={now} />
      </div>
    </div>
  )
}
