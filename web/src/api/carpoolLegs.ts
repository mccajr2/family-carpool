import type { CarpoolLegPhase, CarpoolRideLeg } from "@/api/types"

/** TO then FROM legs with the same phase and no assignee (test + mapping helpers). */
export function carpoolLegsBoth(
  phase: CarpoolLegPhase,
): [CarpoolRideLeg, CarpoolRideLeg] {
  const blank = {
    assigneeAdultId: null,
    assigneeDisplayName: null,
    assigneeCircleId: null,
    assigneeCircleName: null,
  }
  return [
    { kind: "TO", phase, ...blank },
    { kind: "FROM", phase, ...blank },
  ]
}
