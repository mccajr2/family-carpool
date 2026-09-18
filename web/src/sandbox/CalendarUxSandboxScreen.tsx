import { useMemo } from "react"

import type { AuthSessionHolder } from "@/api/authSession"
import type { CarpoolClient } from "@/api/carpoolClient"
import type { FamilyClient } from "@/api/familyClient"
import {
  agendaDriveBlockEntryKey,
  groupAgendaItemsByDriveBlock,
} from "@/components/agendaDriveBlockGroups"
import { buildAgendaBlockSections } from "@/components/agendaBlockSections"
import { AgendaBlockCard } from "@/components/AgendaBlockCard"
import { AgendaRow } from "@/components/AgendaRow"
import { calendarItemKey } from "@/components/coverageDisplay"
import {
  coverageGameEventKey,
  isOwnRideGap,
  mapCalendarItemToCoverageGames,
  type QueueItem,
} from "@/components/coverageQueue"
import { feedHasCarpoolSpace } from "@/components/calendarRideJoin"
import { feedSectionLabelClass } from "@/components/FeedCard"
import { HeroAttentionCarousel } from "@/components/HeroAttentionCarousel"
import type { HeroAttentionSlideProps } from "@/components/HeroAttentionSlide"
import { heroBlockSupportingContext } from "@/components/heroBlockSupportingContext"
import { Button } from "@/components/ui/button"
import { ProposedAgendaBlockCard } from "@/sandbox/ProposedAgendaBlockCard"
import { ProposedAgendaRow } from "@/sandbox/ProposedAgendaRow"
import { ProposedHeroAttentionSlide } from "@/sandbox/ProposedHeroAttentionSlide"
import { sandboxNoop, sandboxNoopPatch } from "@/sandbox/noopHandlers"
import { useSandboxCalendarData } from "@/sandbox/useSandboxCalendarData"

export type CalendarUxSandboxScreenProps = {
  session: AuthSessionHolder
  familyClient?: FamilyClient
  carpoolClient?: CarpoolClient
  now?: Date
  onExit: () => void
  onSignedOut: () => void
}

function ProposedNotes() {
  return (
    <aside
      data-testid="sandbox-proposed-notes"
      className="sticky top-0 z-[1] rounded-[var(--fc-radius-md)] border border-[var(--fc-border)] bg-[var(--fc-surface)] px-[var(--fc-space-md)] py-[var(--fc-space-sm)] text-xs text-[var(--fc-text-secondary)]"
    >
      <p className="font-semibold uppercase tracking-wide text-[var(--fc-text-primary)]">
        Proposed rules
      </p>
      <ul className="mt-[var(--fc-space-xs)] list-disc space-y-1 pl-4">
        <li>Hero supporting copy demoted to location-line size</li>
        <li>Secondary hero/row actions moved into More overflow</li>
        <li>Block RunSection headings use list-row-title size</li>
        <li>Muted band uses uppercase caption; Adjust plans overflow</li>
        <li>Read-only — CTAs do not write</li>
      </ul>
    </aside>
  )
}

export function CalendarUxSandboxScreen({
  session,
  familyClient,
  carpoolClient,
  now: nowProp,
  onExit,
  onSignedOut,
}: CalendarUxSandboxScreenProps) {
  const data = useSandboxCalendarData({
    session,
    familyClient,
    carpoolClient,
    now: nowProp,
  })
  const {
    status,
    error,
    circle,
    currentAdultId,
    agendaWindowItems,
    agendaSections,
    attentionQueue,
    calendarRideByItemKey,
    calendarCarpoolSummary,
    now,
    reload,
    assignDraftFor,
  } = data

  const focusedCalendarItemKey =
    attentionQueue[0] != null
      ? coverageGameEventKey(attentionQueue[0].game.id)
      : null

  const heroQueuedRequestIds = useMemo(
    () =>
      new Set(
        attentionQueue
          .filter(
            (queueItem): queueItem is Extract<QueueItem, { kind: "request" }> =>
              queueItem.kind === "request",
          )
          .map((queueItem) => queueItem.request.id),
      ),
    [attentionQueue],
  )

  function slidePropsForQueueItem(
    queueItem: QueueItem,
    index: number,
  ): HeroAttentionSlideProps {
    if (circle == null) {
      throw new Error("Circle required for hero slide props")
    }
    const itemKey = coverageGameEventKey(queueItem.game.id)
    const calendarItemForSlide = agendaWindowItems.find(
      (row) => calendarItemKey(row) === itemKey,
    )
    if (calendarItemForSlide == null) {
      throw new Error(`Missing calendar item for queue game ${queueItem.game.id}`)
    }
    const peerItemKey =
      queueItem.kind === "playerConflict"
        ? coverageGameEventKey(queueItem.peerGame.id)
        : null
    const peerCalendarItem =
      peerItemKey != null
        ? agendaWindowItems.find((row) => calendarItemKey(row) === peerItemKey)
        : undefined
    const rideEvent = calendarRideByItemKey.get(itemKey) ?? null
    const baseAssign = assignDraftFor(calendarItemForSlide)
    const slideGames = mapCalendarItemToCoverageGames(
      calendarItemForSlide,
      rideEvent,
      { currentAdultId, members: circle.members },
    )
    const goingKidIds = slideGames
      .filter((game) => game.attendance !== "not_going")
      .map((game) => game.kidId)
    const gapKidIds = slideGames
      .filter((game) => game.attendance !== "not_going" && isOwnRideGap(game))
      .map((game) => game.kidId)
    const assignKidIds =
      queueItem.kind === "playerConflict"
        ? [...queueItem.kidIds]
        : goingKidIds.length > 0
          ? goingKidIds
          : gapKidIds
    const combinedIds = new Set(
      calendarItemForSlide.driveBlockLinks
        .filter((link) => link.combined)
        .map((link) => `${link.otherSource}-${link.otherId}`),
    )
    const blockMembers =
      combinedIds.size === 0
        ? [calendarItemForSlide]
        : (() => {
            combinedIds.add(itemKey)
            return agendaWindowItems.filter((row) =>
              combinedIds.has(calendarItemKey(row)),
            )
          })()
    const mutedLines =
      blockMembers.length >= 2
        ? (buildAgendaBlockSections({
            items: blockMembers,
            currentAdultId,
            circleId: circle.id,
            kids: circle.kids,
            members: circle.members,
            rideEventFor: (row) =>
              calendarRideByItemKey.get(calendarItemKey(row)) ?? null,
          }).mutedBand?.lines ?? [])
        : []
    const blockSupportingContext = heroBlockSupportingContext(calendarItemForSlide, {
      mutedLines,
    })

    return {
      item: queueItem,
      index,
      queueLength: attentionQueue.length,
      calendarItem: calendarItemForSlide,
      peerCalendarItem,
      circle,
      currentAdultId,
      loading: false,
      rideEvent,
      assignDraft: { adultId: baseAssign.adultId, kidIds: assignKidIds },
      blockSupportingContext,
      onUpdateAssignDraft: sandboxNoopPatch,
      onAssignCoverage: sandboxNoop,
      onConfirmCoverage: sandboxNoop,
      onDeclineCoverage: sandboxNoop,
      onConfirmHouseholdPlan: sandboxNoop,
      onDeclineHouseholdPlan: sandboxNoop,
      onAskTeam: feedHasCarpoolSpace(calendarCarpoolSummary, calendarItemForSlide.feedId)
        ? sandboxNoop
        : undefined,
      onSaveRidePlan: sandboxNoop,
      onSaveKidPlans: sandboxNoop,
      onAcceptRide: sandboxNoop,
      onPassRide: sandboxNoop,
      onSetRsvp: sandboxNoop,
      onSetNotGoing: sandboxNoop,
      onResolvePlayerConflict: sandboxNoop,
      onSetLeaveFrom: sandboxNoop,
      hasPickupPlace: circle.places.some((place) => place.address.trim().length > 0),
      now,
    }
  }

  function renderAgendaColumn(mode: "current" | "proposed") {
    if (circle == null) {
      return null
    }
    if (agendaWindowItems.length === 0) {
      return (
        <p className="text-sm text-[var(--fc-text-secondary)]">
          No events in the loaded window.
        </p>
      )
    }
    return (
      <div className="flex flex-col gap-[var(--fc-space-2xl)]">
        {mode === "current" ? (
          <HeroAttentionCarousel
            queue={attentionQueue}
            slidePropsForItem={slidePropsForQueueItem}
          />
        ) : (
          <section data-testid="proposed-hero-carousel" aria-label="Proposed needs attention">
            <h2 className={`${feedSectionLabelClass} !mb-[var(--fc-space-md)] font-semibold tracking-widest`}>
              Needs your attention
            </h2>
            {attentionQueue.length === 0 ? (
              <p className="text-sm text-[var(--fc-text-secondary)]">Nothing needs you right now.</p>
            ) : (
              <div className="flex flex-col gap-[var(--fc-space-md)]">
                {attentionQueue.map((item, index) => (
                  <ProposedHeroAttentionSlide
                    key={coverageGameEventKey(item.game.id) + item.kind}
                    {...slidePropsForQueueItem(item, index)}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {agendaSections.map((group) => (
          <section
            key={`${mode}-${group.label}`}
            aria-label={
              group.dateLabel ? `${group.label}, ${group.dateLabel}` : group.label
            }
            className="flex flex-col gap-[var(--fc-space-lg)]"
          >
            <header className="flex items-baseline gap-[var(--fc-space-sm)]">
              <h3 className={`${feedSectionLabelClass} mb-0`}>{group.label}</h3>
              {group.dateLabel ? (
                <span className="text-xs text-[var(--fc-text-secondary)]">
                  {group.dateLabel}
                </span>
              ) : null}
            </header>
            <ul className="flex flex-col gap-[var(--fc-space-list-row-gap)]">
              {groupAgendaItemsByDriveBlock(group.items).map((entry) => {
                if (entry.kind === "block") {
                  const blockKey = agendaDriveBlockEntryKey(entry.items)
                  const blockFocused = entry.items.some(
                    (member) => calendarItemKey(member) === focusedCalendarItemKey,
                  )
                  return (
                    <li key={`${mode}-block-${blockKey}`}>
                      {mode === "current" ? (
                        <AgendaBlockCard
                          items={entry.items}
                          circle={circle}
                          currentAdultId={currentAdultId}
                          now={now}
                          rideEventFor={(member) =>
                            calendarRideByItemKey.get(calendarItemKey(member)) ?? null
                          }
                          isFocused={blockFocused}
                          loading={false}
                          onDriveBlockLink={sandboxNoop}
                          onOpenRide={sandboxNoop}
                          onRevertDecidedAssignee={sandboxNoop}
                          onCantMakeIt={sandboxNoop}
                          onRemoveCoverage={sandboxNoop}
                          onSetNotGoing={sandboxNoop}
                          onSetLeaveFrom={sandboxNoop}
                          onWithdrawRide={sandboxNoop}
                        />
                      ) : (
                        <ProposedAgendaBlockCard
                          items={entry.items}
                          circle={circle}
                          currentAdultId={currentAdultId}
                          now={now}
                          rideEventFor={(member) =>
                            calendarRideByItemKey.get(calendarItemKey(member)) ?? null
                          }
                          isFocused={blockFocused}
                        />
                      )}
                    </li>
                  )
                }
                const item = entry.item
                const itemKey = calendarItemKey(item)
                return (
                  <li key={`${mode}-item-${itemKey}`}>
                    {mode === "current" ? (
                      <AgendaRow
                        item={item}
                        isFocused={itemKey === focusedCalendarItemKey}
                        circle={circle}
                        currentAdultId={currentAdultId}
                        loading={false}
                        assignDraft={assignDraftFor(item)}
                        rideEvent={calendarRideByItemKey.get(itemKey) ?? null}
                        heroQueuedRequestIds={heroQueuedRequestIds}
                        onUpdateAssignDraft={sandboxNoopPatch}
                        onAssignCoverage={sandboxNoop}
                        onConfirmCoverage={sandboxNoop}
                        onDeclineCoverage={sandboxNoop}
                        onConfirmHouseholdPlan={sandboxNoop}
                        onDeclineHouseholdPlan={sandboxNoop}
                        onRemoveCoverage={sandboxNoop}
                        onSetLeaveFrom={sandboxNoop}
                        onSetCoverageLeaveFrom={sandboxNoop}
                        onSetRsvp={sandboxNoop}
                        onSetNotGoing={sandboxNoop}
                        onOpenPlaces={sandboxNoop}
                        onOpenRide={sandboxNoop}
                        onCreateRide={
                          feedHasCarpoolSpace(calendarCarpoolSummary, item.feedId)
                            ? sandboxNoop
                            : undefined
                        }
                        onSaveRidePlan={sandboxNoop}
                        onSaveKidPlans={sandboxNoop}
                        onCancelRide={sandboxNoop}
                        onWithdrawRide={sandboxNoop}
                        onAcceptRide={sandboxNoop}
                        onPassRide={sandboxNoop}
                        onCantMakeIt={sandboxNoop}
                        onRevertDecidedAssignee={sandboxNoop}
                        onDriveBlockLink={sandboxNoop}
                        onEdit={sandboxNoop}
                        onRemoveEvent={sandboxNoop}
                      />
                    ) : (
                      <ProposedAgendaRow
                        item={item}
                        circle={circle}
                        currentAdultId={currentAdultId}
                        rideEvent={calendarRideByItemKey.get(itemKey) ?? null}
                        isFocused={itemKey === focusedCalendarItemKey}
                        defaultOpen={itemKey === focusedCalendarItemKey}
                      />
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
    )
  }

  return (
    <div
      data-testid="calendar-ux-sandbox"
      className="min-h-svh bg-[var(--fc-surface)] text-[var(--fc-text-primary)]"
    >
      <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-[var(--fc-space-md)] border-b border-[var(--fc-border)] bg-[var(--fc-surface-raised)] px-[var(--fc-space-lg)] py-[var(--fc-space-md)]">
        <div>
          <h1 className="text-lg font-semibold text-[var(--fc-text-primary)]">
            Calendar UX sandbox
          </h1>
          <p className="text-xs text-[var(--fc-text-secondary)]">
            Read-only · live data · Current vs Proposed
          </p>
        </div>
        <div className="flex flex-wrap gap-[var(--fc-space-sm)]">
          <Button type="button" variant="outline" onClick={reload}>
            Reload
          </Button>
          <Button type="button" variant="outline" onClick={onExit}>
            Exit sandbox
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              session.clear()
              onSignedOut()
            }}
          >
            Sign out
          </Button>
        </div>
      </header>

      {status === "loading" ? (
        <p className="p-[var(--fc-space-lg)] text-sm text-[var(--fc-text-secondary)]">
          Loading calendar…
        </p>
      ) : null}

      {status === "error" ? (
        <div className="flex flex-col gap-[var(--fc-space-md)] p-[var(--fc-space-lg)]">
          <p role="alert" className="text-sm text-[var(--fc-danger)]">
            {error ?? "Could not load calendar"}
          </p>
          <Button type="button" onClick={reload}>
            Retry
          </Button>
        </div>
      ) : null}

      {status === "empty" ? (
        <p className="p-[var(--fc-space-lg)] text-sm text-[var(--fc-text-secondary)]">
          No family circle yet — create one in the product app, then reopen the sandbox.
        </p>
      ) : null}

      {status === "ready" && circle != null ? (
        <div className="grid gap-[var(--fc-space-xl)] p-[var(--fc-space-lg)] lg:grid-cols-2">
          <section
            data-testid="sandbox-current-column"
            aria-label="Current calendar"
            className="min-w-0"
          >
            <h2 className="mb-[var(--fc-space-md)] text-sm font-semibold uppercase tracking-wide text-[var(--fc-text-secondary)]">
              Current
            </h2>
            {renderAgendaColumn("current")}
          </section>
          <section
            data-testid="sandbox-proposed-column"
            aria-label="Proposed calendar"
            className="min-w-0"
          >
            <h2 className="mb-[var(--fc-space-md)] text-sm font-semibold uppercase tracking-wide text-[var(--fc-text-secondary)]">
              Proposed
            </h2>
            <div className="mb-[var(--fc-space-md)]">
              <ProposedNotes />
            </div>
            {renderAgendaColumn("proposed")}
          </section>
        </div>
      ) : null}
    </div>
  )
}
