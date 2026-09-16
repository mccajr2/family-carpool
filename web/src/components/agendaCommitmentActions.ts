/**
 * Agenda commitment actions shared by AgendaRow and AgendaBlockCard.
 *
 * One commitment = one undo/reassign/not-going target (item + assignee or kid).
 * Never collapse distinct commitments that share the same generic label — that
 * hid reassign for the second kid/event when rows were combined into a block.
 */

import type {
  CalendarItem,
  CarpoolLegKind,
  CarpoolRideEvent,
  FamilyCircle,
  FamilyMember,
  Kid,
} from "@/api/types"
import {
  markAsNotGoingLabel,
  markKidsAsNotGoingLabel,
  REVERT_REASSIGN_YOU,
} from "@/components/coverageCopy"
import { activeCoverages, calendarItemKey } from "@/components/coverageDisplay"
import {
  applyAutoDeclinedViewModel,
  isConfirmedDriver,
  isPendingHouseholdConfirm,
  mapCalendarItemToCoverageGames,
  type CoverageGameEvent,
} from "@/components/coverageQueue"
import { heroKidFirstName } from "@/components/heroAttentionCopy"
import {
  decidedAssigneeRevertLabel,
  decidedAssigneesFromOwnPlans,
  inboundWithdrawLabel,
  inboundWithdrawLegs,
  isBlankTransportPlan,
  resolveOwnRidePlans,
  type DecidedAssignee,
} from "@/components/transportPlan"
import { isAgendaItemOutOfPlay } from "@/components/rsvpDisplay"

/** Local copy — avoid importing canRoute (circular with coverageQueue under Vite HMR). */
function isTeammateAcceptedOwnRide(
  game: CoverageGameEvent,
  rideEvent: CarpoolRideEvent | null | undefined,
): boolean {
  const ownRequest = rideEvent?.ownRequest
  return (
    ownRequest?.status === "ACCEPTED" &&
    ownRequest.kidIds.includes(game.kidId)
  )
}

export type AgendaCommitmentAction =
  | {
      kind: "revert"
      key: string
      label: string
      testId: string
      item: CalendarItem
      assignee: DecidedAssignee
    }
  | {
      kind: "cant-make-it"
      key: string
      label: string
      testId: string
      item: CalendarItem
      game: CoverageGameEvent
      rideEvent: CarpoolRideEvent | null
    }
  | {
      kind: "cancel-pending"
      key: string
      label: string
      testId: string
      item: CalendarItem
      game: CoverageGameEvent
    }
  | {
      kind: "not-going"
      key: string
      label: string
      testId: string
      item: CalendarItem
      kidIds: string[]
    }
  | {
      /** Hand back ACCEPTED inbound riders only (ADR-0004 rule 7). */
      kind: "withdraw-inbound"
      key: string
      label: string
      testId: string
      item: CalendarItem
      rideId: string
      legs: CarpoolLegKind[] | undefined
      kidIds: string[]
      kidFirstNames: string[]
    }

export type AgendaCommitmentActionsOptions = {
  item: CalendarItem
  circle: Pick<FamilyCircle, "kids" | "members" | "id">
  currentAdultId: string
  rideEvent: CarpoolRideEvent | null | undefined
  autoDeclinedRideIds?: ReadonlySet<string>
}

function kidFirstName(kidId: string, kids: readonly Kid[]): string {
  return heroKidFirstName(kidId, kids)
}

function goingKidIds(
  games: CoverageGameEvent[],
  kids: readonly Kid[],
): { id: string; firstName: string }[] {
  return games
    .filter((game) => game.attendance === "going")
    .map((game) => ({
      id: game.kidId,
      firstName: kidFirstName(game.kidId, kids),
    }))
}

/**
 * Commitment actions for one calendar item (same surfaces as expanded AgendaRow
 * override links). Distinct commitments keep distinct keys even when labels match.
 */
export function agendaCommitmentActionsForItem(
  options: AgendaCommitmentActionsOptions,
): AgendaCommitmentAction[] {
  const {
    item,
    circle,
    currentAdultId,
    rideEvent,
    autoDeclinedRideIds = new Set(),
  } = options
  if (isAgendaItemOutOfPlay(item)) {
    return []
  }

  const { games: coverageGames } = applyAutoDeclinedViewModel(
    mapCalendarItemToCoverageGames(item, rideEvent, {
      currentAdultId,
      members: circle.members as FamilyMember[],
    }),
    autoDeclinedRideIds,
  )
  const inPlayGames = coverageGames.filter((game) => game.attendance === "going")
  const ownRequest =
    rideEvent?.ownRequest ??
    (resolveOwnRidePlans(rideEvent).length === 1
      ? resolveOwnRidePlans(rideEvent)[0]!
      : null)

  const decidedAssignees = decidedAssigneesFromOwnPlans(rideEvent, {
    currentAdultId,
    teammateCircleId: ownRequest?.acceptingCircleId,
    teammateCircleName: ownRequest?.acceptingCircleName,
  }).filter((assignee) => assignee.kind !== "team_ask")

  const actions: AgendaCommitmentAction[] = []
  const itemKey = calendarItemKey(item)

  if (decidedAssignees.length > 0) {
    for (const assignee of decidedAssignees) {
      actions.push({
        kind: "revert",
        key: `${itemKey}:revert:${assignee.key}`,
        label: decidedAssigneeRevertLabel(assignee),
        testId: assignee.waiting
          ? "agenda-cancel-request-link"
          : "agenda-reassign-link",
        item,
        assignee,
      })
    }
  } else {
    for (const game of inPlayGames) {
      if (
        isPendingHouseholdConfirm(game.ownRide) &&
        game.ownRide.driver !== "You"
      ) {
        actions.push({
          kind: "cancel-pending",
          key: `${itemKey}:cancel-pending:${game.kidId}:${game.ownRide.driver}`,
          label: `Cancel request to ${game.ownRide.driver}`,
          testId: "agenda-cancel-request-link",
          item,
          game,
        })
        continue
      }
      if (!isConfirmedDriver(game.ownRide)) {
        continue
      }
      const driver = game.ownRide.driver
      let label: string
      if (driver === "You") {
        label = REVERT_REASSIGN_YOU
      } else if (isTeammateAcceptedOwnRide(game, rideEvent)) {
        label = `${driver} can't drive anymore? Find a new ride`
      } else {
        label = `${driver} can't drive anymore? Reassign the ride`
      }
      actions.push({
        kind: "cant-make-it",
        key: `${itemKey}:cant-make-it:${game.kidId}`,
        label,
        testId: "agenda-reassign-link",
        item,
        game,
        rideEvent: rideEvent ?? null,
      })
    }
  }

  const going = goingKidIds(coverageGames, circle.kids)
  if (going.length >= 2) {
    actions.push({
      kind: "not-going",
      key: `${itemKey}:not-going:all`,
      label: markKidsAsNotGoingLabel(going.map((kid) => kid.firstName)),
      testId: `rsvp-${item.source}-${item.id}-all`,
      item,
      kidIds: going.map((kid) => kid.id),
    })
  } else if (going.length === 1) {
    const kid = going[0]!
    actions.push({
      kind: "not-going",
      key: `${itemKey}:not-going:${kid.id}`,
      label: markAsNotGoingLabel(kid.firstName),
      testId: `rsvp-${item.source}-${item.id}-${kid.id}`,
      item,
      kidIds: [kid.id],
    })
  }

  // Paired with household reassign: withdraw ACCEPTED inbound riders only
  // (AgendaRow AgendaInboundRequestRow "Can't take them anymore").
  for (const request of rideEvent?.otherRequests ?? []) {
    if (request.status !== "ACCEPTED" || request.acceptingCircleId !== circle.id) {
      continue
    }
    actions.push({
      kind: "withdraw-inbound",
      key: `${itemKey}:withdraw-inbound:${request.id}`,
      label: inboundWithdrawLabel(request.legs, circle.id),
      testId: "agenda-row-accepted-by-us-withdraw",
      item,
      rideId: request.id,
      legs: inboundWithdrawLegs(request.legs, circle.id),
      kidIds: [...request.kidIds],
      kidFirstNames: [...request.kidFirstNames],
    })
  }

  return actions
}

/**
 * When several actions share a generic label, qualify with kid and/or event so
 * each commitment stays distinguishable (block cards especially).
 */
export function qualifyCommitmentActionLabels(
  actions: readonly AgendaCommitmentAction[],
  kids: readonly Kid[],
): AgendaCommitmentAction[] {
  const labelCounts = new Map<string, number>()
  for (const action of actions) {
    labelCounts.set(action.label, (labelCounts.get(action.label) ?? 0) + 1)
  }

  return actions.map((action) => {
    if ((labelCounts.get(action.label) ?? 0) <= 1) {
      return action
    }
    let kidPart: string | null = null
    if (action.kind === "withdraw-inbound") {
      const names = action.kidFirstNames.filter((name) => name.trim() !== "")
      kidPart = names.length > 0 ? names.join(" + ") : null
    } else {
      const kidIds =
        action.kind === "not-going"
          ? action.kidIds
          : action.kind === "cant-make-it" || action.kind === "cancel-pending"
            ? [action.game.kidId]
            : action.kind === "revert"
              ? coverageKidIdsForAssignee(action.item, action.assignee)
              : []
      kidPart =
        kidIds.length > 0
          ? kidIds.map((id) => kidFirstName(id, kids)).join(" + ")
          : null
    }
    const eventPart = action.item.title.trim() || null
    const qualifier =
      kidPart != null && eventPart != null
        ? `${kidPart} · ${eventPart}`
        : (kidPart ?? eventPart)
    if (qualifier == null) {
      return action
    }
    return { ...action, label: `${action.label} (${qualifier})` }
  })
}

function coverageKidIdsForAssignee(
  item: CalendarItem,
  assignee: DecidedAssignee,
): string[] {
  if (assignee.adultId == null) {
    return item.kidIds
  }
  const coverage = activeCoverages(item).find(
    (row) =>
      (row.status === "CONFIRMED" || row.status === "PENDING") &&
      row.coveringAdultId === assignee.adultId,
  )
  return coverage?.kidIds ?? item.kidIds
}

/**
 * Flatten commitment actions across block members. Qualifies colliding labels.
 */
export function agendaCommitmentActionsForItems(
  items: readonly CalendarItem[],
  options: {
    circle: Pick<FamilyCircle, "kids" | "members" | "id">
    currentAdultId: string
    rideEventFor: (item: CalendarItem) => CarpoolRideEvent | null | undefined
    autoDeclinedRideIds?: ReadonlySet<string>
  },
): AgendaCommitmentAction[] {
  const actions = items.flatMap((item) =>
    agendaCommitmentActionsForItem({
      item,
      circle: options.circle,
      currentAdultId: options.currentAdultId,
      rideEvent: options.rideEventFor(item),
      autoDeclinedRideIds: options.autoDeclinedRideIds,
    }),
  )
  return qualifyCommitmentActionLabels(actions, options.circle.kids)
}

/**
 * Calendar item that owns the physical hang departure (earliest viewer-owned
 * TO commitment by leave-by / start). Leave-from on a block card writes here.
 */
export function blockDepartureItem(options: {
  items: readonly CalendarItem[]
  currentAdultId: string
  rideEventFor: (item: CalendarItem) => CarpoolRideEvent | null | undefined
}): CalendarItem | null {
  const { items, currentAdultId, rideEventFor } = options
  type Candidate = { item: CalendarItem; sortKey: string }
  const candidates: Candidate[] = []

  for (const item of items) {
    if (isAgendaItemOutOfPlay(item)) {
      continue
    }
    const rideEvent = rideEventFor(item)
    const plans = resolveOwnRidePlans(rideEvent)
    let ownsTo = false
    const kidsWithNonBlankPlan = new Set<string>()

    for (const plan of plans) {
      if (!isBlankTransportPlan(plan.legs)) {
        for (const kidId of plan.kidIds) {
          kidsWithNonBlankPlan.add(kidId)
        }
      }
      for (const leg of plan.legs) {
        if (
          leg.kind === "TO" &&
          leg.phase === "CONFIRMED" &&
          leg.assigneeAdultId === currentAdultId
        ) {
          ownsTo = true
        }
      }
    }

    if (!ownsTo) {
      for (const coverage of activeCoverages(item)) {
        if (coverage.status !== "CONFIRMED") {
          continue
        }
        if (coverage.coveringAdultId !== currentAdultId) {
          continue
        }
        if (coverage.kidIds.some((kidId) => kidsWithNonBlankPlan.has(kidId))) {
          // Plan owns those kids — only count coverage when it still implies TO
          // for a coverage-only kid on this item.
          const coverageOnly = coverage.kidIds.some(
            (kidId) => !kidsWithNonBlankPlan.has(kidId),
          )
          if (!coverageOnly) {
            continue
          }
        }
        ownsTo = true
        break
      }
    }

    if (!ownsTo) {
      continue
    }
    candidates.push({
      item,
      sortKey: item.startsAt,
    })
  }

  if (candidates.length === 0) {
    return null
  }
  candidates.sort((a, b) => a.sortKey.localeCompare(b.sortKey))
  return candidates[0]!.item
}
