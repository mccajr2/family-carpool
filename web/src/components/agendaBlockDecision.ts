import type { CalendarItem, CarpoolRideEvent } from "@/api/types"
import type {
  DriverPickerConfirmOptions,
  DriverPickerKidPlan,
  DriverPickerSavePlanLegs,
} from "@/components/DriverPicker"

/** Shared adult draft for a combined Agenda block (one picker adult for the shell). */
export type AgendaBlockAssignDraft = {
  adultId: string
  kidIds: string[]
  soleAdult: boolean
  soleKid: boolean
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
