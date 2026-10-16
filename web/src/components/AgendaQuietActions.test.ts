import { describe, expect, it } from "vitest"

import {
  AGENDA_QUIET_DANGER_LINK_CLASS,
  AGENDA_QUIET_LINK_CLASS,
  VIEW_ROUTE_LABEL,
} from "@/components/AgendaQuietActions"

describe("AgendaQuietActions chrome", () => {
  it("uses list-row meta size for quiet links, smaller than focusAction primary", () => {
    expect(AGENDA_QUIET_LINK_CLASS).toMatch(/--fc-font-list-row-meta-size/)
    expect(AGENDA_QUIET_LINK_CLASS).toMatch(/--fc-text-secondary/)
    expect(AGENDA_QUIET_LINK_CLASS).not.toMatch(/--fc-font-focus-action/)
    expect(AGENDA_QUIET_LINK_CLASS).not.toMatch(/--fc-accent/)
    expect(AGENDA_QUIET_LINK_CLASS).not.toMatch(/\bunderline\b/)
  })

  it("marks danger quiet links with danger color and title weight", () => {
    expect(AGENDA_QUIET_DANGER_LINK_CLASS).toMatch(/--fc-danger/)
    expect(AGENDA_QUIET_DANGER_LINK_CLASS).toMatch(/--fc-font-list-row-title-weight/)
    expect(AGENDA_QUIET_DANGER_LINK_CLASS).toMatch(/--fc-font-list-row-meta-size/)
  })

  it("exports View route label for both shells", () => {
    expect(VIEW_ROUTE_LABEL).toBe("View route")
  })
})
