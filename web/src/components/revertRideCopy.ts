import {
  isConfirmedDriver,
  isPendingHouseholdConfirm,
  isUnassigned,
  type OwnRideStatus,
} from "@/components/coverageQueue"

/** Inbound ACCEPTED-by-us → withdraw (mock RequestRow). */
export const REVERT_INBOUND_CANT_TAKE_THEM = "Can't take them anymore"

/** Declined inbound → re-accept when canOffer. */
export const REVERT_INBOUND_RECONSIDER = "Reconsider"

/** Session-local after withdraw → re-accept when canOffer. */
export const REVERT_INBOUND_UNDO = "Undo"

/**
 * Underlined own-ride revert copy (drive vocabulary — never “make it” / “going”).
 * Returns null when DriverPicker should show instead (unassigned / pending confirm).
 */
export function revertOwnRideLabel(
  ownRide: OwnRideStatus,
  options: { teammateRide?: boolean } = {},
): string | null {
  if (ownRide === "requested") {
    return "No longer need a ride? Cancel this ask"
  }
  if (isUnassigned(ownRide) || isPendingHouseholdConfirm(ownRide)) {
    return null
  }
  if (!isConfirmedDriver(ownRide)) {
    return null
  }
  if (options.teammateRide) {
    return `${ownRide.driver} can't drive anymore? Find a new ride`
  }
  if (ownRide.driver === "You") {
    return "Can't drive anymore? Reassign the ride"
  }
  return `${ownRide.driver} can't drive anymore? Reassign the ride`
}
