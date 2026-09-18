import type { HeroAttentionSlideProps } from "@/components/HeroAttentionSlide"
import {
  heroAdultFirstName,
  heroKidFirstName,
  heroOwnRideTitle,
  heroPlayerConflictTitle,
  heroRequestTitle,
  heroVenueLine,
} from "@/components/heroAttentionCopy"
import { formatCompactEventWhen } from "@/components/eventTimes"
import { EventLocationLine } from "@/components/EventLocationLine"
import { HeroAttentionDaysRing } from "@/components/HeroAttentionDaysRing"
import { AgendaStatusChip } from "@/components/agendaStatusChip"
import { Button } from "@/components/ui/button"
import {
  CONFIRM_COVERAGE,
  DECLINE_COVERAGE,
  HERO_MOST_URGENT,
  HERO_UP_NEXT,
  heroQueueCountLabel,
} from "@/components/coverageCopy"
import { pendingCoverageForAdult } from "@/components/coverageDisplay"
import {
  hasWaitingHouseholdForAdult,
  isOwnRideGap,
  mapCalendarItemToCoverageGames,
} from "@/components/coverageQueue"
import {
  heroBlockSupportingContextHasContent,
} from "@/components/heroBlockSupportingContext"
import { inboundAskLegChips } from "@/components/rideStatusChip"
import { allOwnPlanLegs } from "@/components/transportPlan"
import {
  SandboxOverflowMenu,
  type SandboxOverflowItem,
} from "@/sandbox/SandboxOverflowMenu"

/**
 * Audit-proposed hero slide: demoted supporting copy + secondary actions in More.
 * Read-only — primary buttons are visual only (no writes).
 */
export function ProposedHeroAttentionSlide(props: HeroAttentionSlideProps) {
  const {
    item,
    index,
    queueLength,
    calendarItem,
    circle,
    currentAdultId,
    rideEvent,
    blockSupportingContext,
  } = props

  const coverageGames = mapCalendarItemToCoverageGames(calendarItem, rideEvent, {
    currentAdultId,
    members: circle.members,
  })
  const gapKidFirstNames = coverageGames
    .filter((game) => game.attendance !== "not_going" && isOwnRideGap(game))
    .map((game) => heroKidFirstName(game.kidId, circle.kids))
  const titleKidFirstNames =
    gapKidFirstNames.length > 0
      ? gapKidFirstNames
      : item.kind === "playerConflict"
        ? item.kidIds.map((kidId) => heroKidFirstName(kidId, circle.kids))
        : [heroKidFirstName(item.game.kidId, circle.kids)]

  const pendingForSelf = pendingCoverageForAdult(calendarItem, currentAdultId)
  const pendingHouseholdPlan =
    pendingForSelf == null &&
    hasWaitingHouseholdForAdult(allOwnPlanLegs(rideEvent), currentAdultId)
  const showConfirm = pendingForSelf != null || pendingHouseholdPlan
  const assignerFirstName = showConfirm
    ? heroAdultFirstName(
        pendingForSelf?.assignedByAdultId ?? rideEvent?.requestedByAdultId,
        circle.members,
        rideEvent?.requestedByDisplayName,
      )
    : null

  const title =
    item.kind === "request"
      ? heroRequestTitle(item.request)
      : item.kind === "playerConflict"
        ? heroPlayerConflictTitle(titleKidFirstNames)
        : heroOwnRideTitle({
            kidFirstNames: titleKidFirstNames,
            pendingConfirm: showConfirm,
            assignerFirstName,
          })

  const whenLabel = formatCompactEventWhen(calendarItem.startsAt, calendarItem.endsAt)
  const venue = heroVenueLine(calendarItem)
  const badge = index === 0 ? HERO_MOST_URGENT : HERO_UP_NEXT
  const requestRide =
    item.kind === "request"
      ? rideEvent?.otherRequests.find((ride) => ride.id === item.request.id) ?? null
      : null
  const showAcceptPass =
    requestRide != null && requestRide.status === "PENDING" && !requestRide.passedByMe
  const inboundChips = requestRide != null ? inboundAskLegChips(requestRide) : []
  const showBlockContext = heroBlockSupportingContextHasContent(blockSupportingContext)

  const moreItems: SandboxOverflowItem[] = []
  if (item.kind === "ownRide") {
    moreItems.push(
      { key: "cancel", label: "Cancel ride" },
      { key: "withdraw", label: "Withdraw ask" },
      { key: "remove-coverage", label: "Remove coverage" },
      { key: "open-places", label: "Open Places" },
      { key: "edit", label: "Edit event" },
      { key: "not-going", label: "Mark as not going" },
    )
  } else if (item.kind === "request") {
    moreItems.push({ key: "pass-later", label: "Pass for now" })
  } else {
    moreItems.push(
      { key: "neither", label: "Neither event" },
      { key: "open-places", label: "Open Places" },
    )
  }

  return (
    <article
      data-testid="proposed-hero-attention-slide"
      className="flex min-h-[12rem] flex-col justify-between overflow-hidden rounded-[var(--fc-radius-xl)] bg-[var(--fc-hero-surface)] px-[var(--fc-space-lg)] py-[var(--fc-space-lg)] text-[var(--fc-hero-on)]"
    >
      <div className="flex items-start justify-between gap-[var(--fc-space-md)]">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-[var(--fc-space-sm)]">
            <span
              data-testid="proposed-hero-badge"
              className="text-[length:var(--fc-font-caption-size)] font-semibold uppercase tracking-widest text-[var(--fc-hero-on-secondary)]"
            >
              {badge}
            </span>
            {index === 0 ? (
              <span className="text-[length:var(--fc-font-caption-size)] text-[var(--fc-hero-on-secondary)]">
                {heroQueueCountLabel(queueLength)}
              </span>
            ) : null}
          </div>
          <h3
            data-testid="proposed-hero-title"
            className="mt-[var(--fc-space-sm)] text-[length:var(--fc-font-focus-title-size)] leading-[var(--fc-font-focus-title-line)] font-[number:var(--fc-font-focus-title-weight)] text-[var(--fc-hero-on)]"
          >
            {title}
          </h3>
          <p
            data-testid="proposed-hero-when"
            className="mt-[var(--fc-space-xs)] text-[length:var(--fc-font-focus-when-size)] leading-[var(--fc-font-focus-when-line)] font-[number:var(--fc-font-focus-when-weight)] text-[var(--fc-hero-on-secondary)]"
          >
            {whenLabel}
          </p>
          {venue ? (
            <EventLocationLine
              location={venue}
              data-testid="proposed-hero-where"
              className="mt-[var(--fc-space-xs)]"
              color="var(--fc-hero-on-secondary)"
            />
          ) : null}
          {inboundChips.length > 0 ? (
            <div className="mt-[var(--fc-space-sm)] flex flex-wrap gap-[var(--fc-space-xs)]">
              {inboundChips.map((chip) => (
                <AgendaStatusChip key={chip.label} label={chip.label} tone={chip.tone} />
              ))}
            </div>
          ) : null}
        </div>
        <HeroAttentionDaysRing startsAt={calendarItem.startsAt} />
      </div>

      {showBlockContext && blockSupportingContext != null ? (
        <div
          data-testid="proposed-hero-block-context"
          className="mt-[var(--fc-space-md)] flex flex-col gap-[var(--fc-space-xs)]"
        >
          {blockSupportingContext.siblingLines.map((line) => (
            <p
              key={line}
              data-testid="proposed-hero-block-sibling"
              className="text-[length:var(--fc-font-location-line-size)] leading-[var(--fc-font-location-line-line)] text-[var(--fc-hero-on-secondary)]"
            >
              {line}
            </p>
          ))}
          {blockSupportingContext.mutedHeading != null &&
          blockSupportingContext.mutedLines.length > 0 ? (
            <div
              data-testid="proposed-hero-block-muted"
              className="rounded-[var(--fc-radius-lg)] px-[var(--fc-space-md)] py-[var(--fc-space-sm)]"
              style={{
                background: "color-mix(in srgb, var(--fc-hero-on) 8%, transparent)",
              }}
            >
              <div className="text-xs font-semibold uppercase tracking-wide text-[var(--fc-hero-on-secondary)]">
                {blockSupportingContext.mutedHeading}
              </div>
              <ul className="mt-[var(--fc-space-xs)] flex flex-col gap-[var(--fc-space-xs)]">
                {blockSupportingContext.mutedLines.map((line) => (
                  <li
                    key={line}
                    className="text-[length:var(--fc-font-location-line-size)] leading-[var(--fc-font-location-line-line)] text-[var(--fc-hero-on-secondary)]"
                  >
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-[var(--fc-space-lg)] flex flex-wrap items-center gap-[var(--fc-space-sm)]">
        {showConfirm ? (
          <>
            <Button type="button" data-testid="proposed-hero-confirm">
              {CONFIRM_COVERAGE}
            </Button>
            <Button type="button" variant="outline" data-testid="proposed-hero-decline">
              {DECLINE_COVERAGE}
            </Button>
          </>
        ) : null}
        {showAcceptPass ? (
          <>
            <Button type="button" data-testid="proposed-hero-accept">
              Accept
            </Button>
            <Button type="button" variant="outline" data-testid="proposed-hero-pass">
              Pass
            </Button>
          </>
        ) : null}
        {!showConfirm && !showAcceptPass ? (
          <Button type="button" data-testid="proposed-hero-primary-placeholder">
            Primary action
          </Button>
        ) : null}
        <SandboxOverflowMenu
          label="More"
          testId="proposed-hero-more"
          items={moreItems}
          footer="Sandbox — not writing"
        />
      </div>
    </article>
  )
}
