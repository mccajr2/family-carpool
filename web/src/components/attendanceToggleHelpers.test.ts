import { describe, expect, it } from "vitest"

import {
  markAsGoingAgainLabel,
  markAsNotGoingLabel,
  markedNotGoingMessage,
  rsvpWriteForAttendanceAction,
} from "@/components/AttendanceToggle"
import { mapRsvpToAttendance } from "@/components/coverageQueue"

describe("attendance toggle helpers", () => {
  it("maps going / not_going UI actions to YES / NO writes", () => {
    expect(rsvpWriteForAttendanceAction("not_going")).toBe("NO")
    expect(rsvpWriteForAttendanceAction("going")).toBe("YES")
  })

  it("uses locked going / not going copy (never make it or drive)", () => {
    expect(markAsNotGoingLabel("Sam")).toBe("Mark Sam as not going")
    expect(markedNotGoingMessage("Sam")).toBe("Sam is marked not going.")
    expect(markAsGoingAgainLabel()).toBe("Mark as going again")
    expect(markAsNotGoingLabel("Sam")).not.toMatch(/make it|drive/i)
    expect(markedNotGoingMessage("Sam")).not.toMatch(/make it|drive/i)
    expect(markAsGoingAgainLabel()).not.toMatch(/make it|drive/i)
  })

  it("relies on mapRsvpToAttendance as the single read mapper", () => {
    expect(mapRsvpToAttendance("YES")).toBe("going")
    expect(mapRsvpToAttendance("NO_RESPONSE")).toBe("going")
    expect(mapRsvpToAttendance("NO")).toBe("not_going")
  })
})
