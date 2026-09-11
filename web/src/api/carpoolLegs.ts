import type { CarpoolLegKind, CarpoolLegPhase, CarpoolRideLeg } from "@/api/types"

const blankAssignee = {
  assigneeAdultId: null as string | null,
  assigneeDisplayName: null as string | null,
  assigneeCircleId: null as string | null,
  assigneeCircleName: null as string | null,
}

/** One leg slot (test + mapping helpers). */
export function carpoolLeg(
  kind: CarpoolLegKind,
  phase: CarpoolLegPhase,
  partial: Partial<Omit<CarpoolRideLeg, "kind" | "phase">> = {},
): CarpoolRideLeg {
  return { kind, phase, ...blankAssignee, ...partial }
}

/** TO then FROM legs with the same phase and no assignee (test + mapping helpers). */
export function carpoolLegsBoth(
  phase: CarpoolLegPhase,
  partial: Partial<Omit<CarpoolRideLeg, "kind" | "phase">> = {},
): [CarpoolRideLeg, CarpoolRideLeg] {
  return [carpoolLeg("TO", phase, partial), carpoolLeg("FROM", phase, partial)]
}
