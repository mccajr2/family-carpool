import type { CarpoolLeg, CarpoolNeededLeg, CarpoolRideEvent } from "@/api/types"

/** Selection for the Request To / From / Round trip control. */
export type RideNeededLegsChoice = CarpoolLeg

export const DEFAULT_RIDE_NEEDED_LEGS: RideNeededLegsChoice = "BOTH"

export const RIDE_NEEDED_LEGS_LABEL = "Ride needed" as const

export const RIDE_NEEDED_LEGS_OPTIONS: ReadonlyArray<{
  value: RideNeededLegsChoice
  label: string
}> = [
  { value: "TO", label: "To practice" },
  { value: "FROM", label: "From practice" },
  { value: "BOTH", label: "Round trip" },
]

export function legsNeededFromChoice(choice: RideNeededLegsChoice): CarpoolNeededLeg[] {
  if (choice === "BOTH") {
    return ["TO", "FROM"]
  }
  return [choice]
}

export function choiceFromLegsNeeded(
  legs: readonly CarpoolNeededLeg[],
): RideNeededLegsChoice {
  const hasTo = legs.includes("TO")
  const hasFrom = legs.includes("FROM")
  if (hasTo && hasFrom) {
    return "BOTH"
  }
  if (hasFrom && !hasTo) {
    return "FROM"
  }
  return "TO"
}

/** Default kids who do not yet have a per-kid carpool need on this event. */
export function defaultKidsNeedingCarpoolRequest(event: CarpoolRideEvent): string[] {
  const claimed = new Set((event.ownRequests ?? []).map((request) => request.kidId))
  return (event.defaultKidIds ?? []).filter((kidId) => !claimed.has(kidId))
}
