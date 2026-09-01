import {
  isConfirmedDriver,
  isPendingHouseholdConfirm,
  isUnassigned,
  type OwnRideStatus,
} from "@/components/coverageQueue"
import {
  REVERT_CANCEL_TEAM_ASK,
  REVERT_REASSIGN_YOU,
  revertOtherDriverLabel,
  revertTeammateDriverLabel,
} from "@/components/coverageCopy"

export {
  REVERT_INBOUND_CANT_TAKE_THEM,
  REVERT_INBOUND_RECONSIDER,
  REVERT_INBOUND_UNDO,
} from "@/components/coverageCopy"

/**
 * Underlined own-ride revert copy (drive vocabulary — never “make it” / “going”).
 * Returns null when DriverPicker should show instead (unassigned / pending confirm).
 */
export function revertOwnRideLabel(
  ownRide: OwnRideStatus,
  options: { teammateRide?: boolean } = {},
): string | null {
  if (ownRide === "requested") {
    return REVERT_CANCEL_TEAM_ASK
  }
  if (isUnassigned(ownRide) || isPendingHouseholdConfirm(ownRide)) {
    return null
  }
  if (!isConfirmedDriver(ownRide)) {
    return null
  }
  if (options.teammateRide) {
    return revertTeammateDriverLabel(ownRide.driver)
  }
  if (ownRide.driver === "You") {
    return REVERT_REASSIGN_YOU
  }
  return revertOtherDriverLabel(ownRide.driver)
}
