import type { OwnRideStatus } from "@/components/coverageQueue"
import { revertOwnRideLabel } from "@/components/revertRideCopy"

export type RevertRideLinkProps = {
  ownRide: OwnRideStatus
  /** True when confirmed ownRide comes from an ACCEPTED ownRequest (teammate). */
  teammateRide?: boolean
  onCantMakeIt: () => void
  disabled?: boolean
}

/**
 * One-click own-ride revert (no dialog). Mutually exclusive with DriverPicker
 * on the same kid row — returns null when ownRide is unresolved.
 */
export function RevertRideLink({
  ownRide,
  teammateRide = false,
  onCantMakeIt,
  disabled = false,
}: RevertRideLinkProps) {
  const label = revertOwnRideLabel(ownRide, { teammateRide })
  if (label == null) {
    return null
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onCantMakeIt}
      className="mt-2 text-left text-xs underline underline-offset-2 text-[var(--fc-text-secondary)] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {label}
    </button>
  )
}
