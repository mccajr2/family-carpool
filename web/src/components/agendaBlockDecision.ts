import type { CalendarItem, CarpoolRide, CarpoolRideEvent } from "@/api/types"
import type { CombinedKidRow } from "@/components/combinedEventLayout"
import {
  blockDecisionPickerTitle,
  postToTeamNamedRoundTrip,
} from "@/components/coverageCopy"
import { calendarItemKey } from "@/components/coverageDisplay"
import type {
  DriverPickerConfirmOptions,
  DriverPickerGoingKid,
  DriverPickerKidPlan,
  DriverPickerSavePlanLegs,
} from "@/components/DriverPicker"
import {
  ownRidePlanForKid,
  resolveOwnRidePlans,
} from "@/components/transportPlan"

/** Shared adult draft for a combined Agenda block (one picker adult for the shell). */
export type AgendaBlockAssignDraft = {
  adultId: string
  kidIds: string[]
  soleAdult: boolean
  soleKid: boolean
}

const NEEDS_RIDE = "Needs ride"
const ASKED_TEAM = "Asked team"

export type AgendaBlockDecisionPickerSection = {
  kind: "picker"
  key: string
  stateKey: string
  kidIds: string[]
  goingKids: DriverPickerGoingKid[]
  /** Member events that still have an open row for these kids. */
  memberItems: CalendarItem[]
  title: string
  postLabel: string
}

export type AgendaBlockDecisionCancelSection = {
  kind: "cancelAsk"
  key: string
  item: CalendarItem
  ride: CarpoolRide
  kidIds: string[]
}

export type AgendaBlockDecisionSection =
  | AgendaBlockDecisionPickerSection
  | AgendaBlockDecisionCancelSection

function isOpenWho(who: string): boolean {
  return who === NEEDS_RIDE || who === ASKED_TEAM
}

/** Combined-card only: open → picker; asked → cancel; assigned → skip. */
export function classifyCombinedKidRow(
  row: Pick<CombinedKidRow, "there" | "back">,
): "open" | "asked" | "assigned" {
  const thereOpen = isOpenWho(row.there.who)
  const backOpen = isOpenWho(row.back.who)
  if (!thereOpen && !backOpen) {
    return "assigned"
  }
  if (row.there.who === NEEDS_RIDE || row.back.who === NEEDS_RIDE) {
    return "open"
  }
  return "asked"
}

export function openStateKey(
  row: Pick<CombinedKidRow, "there" | "back">,
): string {
  return `${row.there.who}|${row.back.who}`
}

/** Kid ids on this member event that are in the picker's selected scope. */
export function kidIdsForMemberEvent(
  item: CalendarItem,
  selectedKidIds: readonly string[],
): string[] {
  const onEvent = new Set(item.kidIds)
  return selectedKidIds.filter((id) => onEvent.has(id))
}

export function eventKeyForMember(
  item: CalendarItem,
  rideEvent: CarpoolRideEvent | null | undefined,
): string | null {
  const key = rideEvent?.eventKey ?? item.eventKey
  return key != null && key.length > 0 ? key : null
}

/**
 * One primary Confirm → one onAssignCoverage per member event that still has
 * kids in scope (same adult / options).
 */
export function fanOutAssignCoverage(
  items: readonly CalendarItem[],
  adultId: string,
  kidIds: readonly string[],
  onAssignCoverage: (
    item: CalendarItem,
    adultId: string,
    kidIds: string[],
    options?: DriverPickerConfirmOptions,
  ) => void,
  options?: DriverPickerConfirmOptions,
): void {
  for (const item of items) {
    const memberKids = kidIdsForMemberEvent(item, kidIds)
    if (memberKids.length === 0) {
      continue
    }
    onAssignCoverage(item, adultId, memberKids, options)
  }
}

/**
 * One primary Post → one onCreateRide per member event with kids in scope.
 */
export function fanOutCreateRide(
  items: readonly CalendarItem[],
  kidIds: readonly string[],
  rideEventFor: (item: CalendarItem) => CarpoolRideEvent | null | undefined,
  onCreateRide: (
    item: CalendarItem,
    eventKey: string,
    kidIds?: string[],
  ) => void,
): void {
  for (const item of items) {
    const memberKids = kidIdsForMemberEvent(item, kidIds)
    if (memberKids.length === 0) {
      continue
    }
    const eventKey = eventKeyForMember(item, rideEventFor(item))
    if (eventKey == null) {
      continue
    }
    onCreateRide(item, eventKey, memberKids)
  }
}

/**
 * One primary Save ride plan → one onSaveRidePlan per member event with kids
 * in scope (same legs / options).
 */
export function fanOutSaveRidePlan(
  items: readonly CalendarItem[],
  legs: DriverPickerSavePlanLegs,
  kidIds: readonly string[],
  onSaveRidePlan: (
    item: CalendarItem,
    legs: DriverPickerSavePlanLegs,
    kidIds?: string[],
    options?: DriverPickerConfirmOptions,
  ) => void,
  options?: DriverPickerConfirmOptions,
): void {
  for (const item of items) {
    const memberKids = kidIdsForMemberEvent(item, kidIds)
    if (memberKids.length === 0) {
      continue
    }
    onSaveRidePlan(item, legs, memberKids, options)
  }
}

/**
 * Kid-split save on a block: route each kid plan to the member event that
 * owns that kid (one call per distinct member that has plans).
 */
export function fanOutSaveKidPlans(
  items: readonly CalendarItem[],
  plans: readonly DriverPickerKidPlan[],
  onSaveKidPlans: (
    item: CalendarItem,
    plans: DriverPickerKidPlan[],
    options?: DriverPickerConfirmOptions,
  ) => void,
  options?: DriverPickerConfirmOptions,
): void {
  for (const item of items) {
    const memberPlans = plans.filter((plan) => item.kidIds.includes(plan.kidId))
    if (memberPlans.length === 0) {
      continue
    }
    onSaveKidPlans(item, memberPlans, options)
  }
}

/**
 * Combined-card decision sections from Legs rows: identical open states share
 * one picker; posted Asked-team legs get status + cancel; assigned kids omit.
 */
export function buildAgendaBlockDecisionSections(options: {
  items: readonly CalendarItem[]
  kidRows: readonly CombinedKidRow[]
  rideEventFor: (item: CalendarItem) => CarpoolRideEvent | null | undefined
}): AgendaBlockDecisionSection[] {
  const itemByKey = new Map(
    options.items.map((item) => [calendarItemKey(item), item] as const),
  )
  const sections: AgendaBlockDecisionSection[] = []
  const pickerByState = new Map<
    string,
    {
      stateKey: string
      kidIds: string[]
      goingKids: DriverPickerGoingKid[]
      memberKeys: string[]
      firstNames: string[]
    }
  >()
  const seenCancelRideIds = new Set<string>()
  const seenOpenKidInState = new Map<string, Set<string>>()

  for (const row of options.kidRows) {
    const kind = classifyCombinedKidRow(row)
    if (kind === "assigned") {
      continue
    }
    if (kind === "open") {
      const stateKey = openStateKey(row)
      let group = pickerByState.get(stateKey)
      if (group == null) {
        group = {
          stateKey,
          kidIds: [],
          goingKids: [],
          memberKeys: [],
          firstNames: [],
        }
        pickerByState.set(stateKey, group)
        seenOpenKidInState.set(stateKey, new Set())
        sections.push({
          kind: "picker",
          key: `picker-${stateKey}`,
          stateKey,
          kidIds: group.kidIds,
          goingKids: group.goingKids,
          memberItems: [],
          title: "",
          postLabel: "",
        })
      }
      const seenKids = seenOpenKidInState.get(stateKey)!
      if (!seenKids.has(row.kidId)) {
        seenKids.add(row.kidId)
        group.kidIds.push(row.kidId)
        group.goingKids.push({ id: row.kidId, firstName: row.firstName })
        group.firstNames.push(row.firstName)
      }
      if (!group.memberKeys.includes(row.itemKey)) {
        group.memberKeys.push(row.itemKey)
      }
      continue
    }

    // asked — status + Cancel this ask for the pending own plan
    const item = itemByKey.get(row.itemKey)
    if (item == null) {
      continue
    }
    const plans = resolveOwnRidePlans(options.rideEventFor(item))
    const plan = ownRidePlanForKid(plans, row.kidId)
    if (plan == null || plan.status !== "PENDING") {
      continue
    }
    if (seenCancelRideIds.has(plan.id)) {
      continue
    }
    seenCancelRideIds.add(plan.id)
    sections.push({
      kind: "cancelAsk",
      key: `cancel-${plan.id}`,
      item,
      ride: plan,
      kidIds: [...plan.kidIds],
    })
  }

  // Resolve picker memberItems + titled labels after the scan (mutable refs).
  for (const section of sections) {
    if (section.kind !== "picker") {
      continue
    }
    const group = pickerByState.get(section.stateKey)
    if (group == null) {
      continue
    }
    section.kidIds = group.kidIds
    section.goingKids = group.goingKids
    section.memberItems = group.memberKeys
      .map((key) => itemByKey.get(key))
      .filter((item): item is CalendarItem => item != null)
    section.title = blockDecisionPickerTitle(group.firstNames)
    section.postLabel = postToTeamNamedRoundTrip(group.firstNames)
    section.key = `picker-${group.kidIds.join("-") || group.stateKey}`
  }

  return sections
}

/**
 * Locked Edit (frames H/I): one simple picker for every going kid on the block,
 * including kids who are already fully assigned. Settled locked view omits
 * pickers; Edit must bring the round-trip editor back with Save ride plan.
 */
export function buildLockedEditDecisionSections(options: {
  items: readonly CalendarItem[]
  kidRows: readonly CombinedKidRow[]
}): AgendaBlockDecisionPickerSection[] {
  if (options.kidRows.length === 0) {
    return []
  }
  const itemByKey = new Map(
    options.items.map((item) => [calendarItemKey(item), item] as const),
  )
  const kidIds: string[] = []
  const goingKids: DriverPickerGoingKid[] = []
  const firstNames: string[] = []
  const memberKeys: string[] = []
  const seenKids = new Set<string>()

  for (const row of options.kidRows) {
    if (!seenKids.has(row.kidId)) {
      seenKids.add(row.kidId)
      kidIds.push(row.kidId)
      goingKids.push({ id: row.kidId, firstName: row.firstName })
      firstNames.push(row.firstName)
    }
    if (!memberKeys.includes(row.itemKey)) {
      memberKeys.push(row.itemKey)
    }
  }

  return [
    {
      kind: "picker",
      key: `picker-locked-edit-${kidIds.join("-")}`,
      stateKey: "locked-edit",
      kidIds,
      goingKids,
      memberItems: memberKeys
        .map((key) => itemByKey.get(key))
        .filter((item): item is CalendarItem => item != null),
      title: blockDecisionPickerTitle(firstNames),
      postLabel: postToTeamNamedRoundTrip(firstNames),
    },
  ]
}
