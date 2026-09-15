import type {
  CarpoolLegKind,
  CarpoolLegPhase,
  CarpoolMeetSide,
  CarpoolRideLeg,
} from "@/api/types"

const blankAssignee = {
  assigneeAdultId: null as string | null,
  assigneeDisplayName: null as string | null,
  assigneeCircleId: null as string | null,
  assigneeCircleName: null as string | null,
  placeId: null as string | null,
  placeName: null as string | null,
  placeAddress: null as string | null,
  meetSide: "REQUESTER" as CarpoolMeetSide,
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
