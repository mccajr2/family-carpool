import { describe, expect, it } from "vitest"

import {
  REVERT_INBOUND_CANT_TAKE_THEM,
  REVERT_INBOUND_RECONSIDER,
  REVERT_INBOUND_UNDO,
  revertOwnRideLabel,
} from "@/components/revertRideCopy"

const ATTENDANCE_LEAK = /make it|\bgoing\b/i

describe("revertOwnRideLabel", () => {
  it("uses drive vocabulary for You confirmed household driver", () => {
    expect(revertOwnRideLabel({ driver: "You", confirmed: true })).toBe(
      "Can't drive anymore? Reassign the ride",
    )
  })

  it("names other household driver and says Reassign the ride", () => {
    expect(revertOwnRideLabel({ driver: "Jordan", confirmed: true })).toBe(
      "Jordan can't drive anymore? Reassign the ride",
    )
  })

  it("uses Find a new ride for teammate confirmed ride", () => {
    expect(
      revertOwnRideLabel(
        { driver: "the Nguyens", confirmed: true },
        { teammateRide: true },
      ),
    ).toBe("the Nguyens can't drive anymore? Find a new ride")
  })

  it("cancels team ask with drive-side cancel copy", () => {
    expect(revertOwnRideLabel("requested")).toBe(
      "No longer need a ride? Cancel this ask",
    )
  })

  it("returns null for unassigned and pending household confirm", () => {
    expect(revertOwnRideLabel("unassigned")).toBeNull()
    expect(revertOwnRideLabel({ driver: "You", confirmed: false })).toBeNull()
    expect(revertOwnRideLabel({ driver: "Jordan", confirmed: false })).toBeNull()
  })

  it("never uses make it or going on own-ride labels", () => {
    const labels = [
      revertOwnRideLabel({ driver: "You", confirmed: true }),
      revertOwnRideLabel({ driver: "Jordan", confirmed: true }),
      revertOwnRideLabel(
        { driver: "the Nguyens", confirmed: true },
        { teammateRide: true },
      ),
      revertOwnRideLabel("requested"),
    ]
    for (const label of labels) {
      expect(label).toBeTruthy()
      expect(label!).not.toMatch(ATTENDANCE_LEAK)
    }
  })
})

describe("inbound revert copy constants", () => {
  it("locks RequestRow reverse action strings without attendance vocab", () => {
    const inbound = [
      REVERT_INBOUND_CANT_TAKE_THEM,
      REVERT_INBOUND_RECONSIDER,
      REVERT_INBOUND_UNDO,
    ]
    expect(inbound).toEqual([
      "Can't take them anymore",
      "Reconsider",
      "Undo",
    ])
    for (const label of inbound) {
      expect(label).not.toMatch(ATTENDANCE_LEAK)
    }
  })
})
