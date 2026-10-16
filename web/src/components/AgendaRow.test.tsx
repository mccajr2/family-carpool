import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ComponentProps } from "react"
import { describe, expect, it, vi } from "vitest"

import type { CalendarItem, FamilyCircle } from "@/api/types"
import { AgendaRow } from "@/components/AgendaRow"
import { ASKED_THE_TEAM, ATTENDANCE_NOT_GOING_CHIP, RIDE_CONFLICT_CHIP, RIDE_NEEDED, alsoDrivingKidLabel } from "@/components/coverageCopy"
import { carpoolLeg, carpoolLegsBoth } from "@/api/carpoolLegs"

function item(
  partial: Pick<CalendarItem, "id" | "title"> & Partial<CalendarItem>,
): CalendarItem {
  const kidIds = partial.kidIds ?? ["k1"]
  return {
    source: "MANUAL",
    startsAt: "2030-08-15T17:00:00.000Z",
    endsAt: null,
    location: "Rink",
    kidIds,
    feedId: null,
    feedName: null,
    eventKey: null,
    leaveFromPlaceId: "p1",
    leaveFromPlaceName: "Mom's house",
    leaveFromAddress: null,
    leaveByAt: "2030-08-15T16:30:00.000Z",
    leaveByStatus: "OK",
    leaveByReason: null,
    coverages: [],
    uncoveredKidIds: [],
    conflicts: [],
    rsvps: kidIds.map((kidId) => ({ kidId, status: "YES" as const })),
    driveBlockLinks: [],
    ...partial,
  }
}

const circle: FamilyCircle = {
  id: "c1",
  name: "Test",
  role: "ORGANIZER",
  members: [
    { adultId: "a1", email: "a@example.com", displayName: "Alex", role: "ORGANIZER" },
  ],
  kids: [{ id: "k1", displayName: "Sam" }],
  places: [
    { id: "p1", name: "Mom's house", address: "1 Main", latitude: 40, longitude: -74 },
  ],
  defaultLeaveFromPlaceId: "p1",
  defaultLeaveFromPlaceName: "Mom's house",
}

const noopHandlers = {
  onUpdateAssignDraft: vi.fn(),
  onAssignCoverage: vi.fn(),
  onConfirmCoverage: vi.fn(),
  onDeclineCoverage: vi.fn(),
  onRemoveCoverage: vi.fn(),
  onSetLeaveFrom: vi.fn(),
  onSetCoverageLeaveFrom: vi.fn(),
  onSetRsvp: vi.fn(),
  onOpenPlaces: vi.fn(),
  onEdit: vi.fn(),
  onRemoveEvent: vi.fn(),
}

function renderRow(
  calendarItem: CalendarItem,
  overrides: Partial<ComponentProps<typeof AgendaRow>> = {},
) {
  return render(
    <AgendaRow
      item={calendarItem}
      circle={circle}
      currentAdultId="a1"
      loading={false}
      assignDraft={{
        adultId: "a1",
        kidIds: calendarItem.uncoveredKidIds,
        soleAdult: true,
        soleKid: calendarItem.uncoveredKidIds.length <= 1,
      }}
      {...noopHandlers}
      {...overrides}
    />,
  )
}

describe("AgendaRow", () => {
  it("renders GameCard hierarchy with list-row tokens and no title truncate", () => {
    renderRow(
      item({
        id: "a",
        title: "Birthday Party — Maya at the Community Center",
        location: "450 Huron Ave, Cambridge",
      }),
    )
    const row = screen.getByTestId("agenda-row-MANUAL-a")
    expect(row.className).toMatch(/--fc-radius-xl/)
    expect(row.className).toMatch(/--fc-surface-raised/)
    expect(within(row).queryByTestId("agenda-row-team")).not.toBeInTheDocument()
    const title = within(row).getByTestId("agenda-row-title")
    expect(title).toHaveTextContent("Birthday Party — Maya at the Community Center")
    expect(title.className).toMatch(/--fc-font-list-row-title-size/)
    expect(title.className).not.toMatch(/truncate/)
    expect(title.className).not.toMatch(/whitespace-nowrap/)
    const when = within(row).getByTestId("agenda-row-when")
    expect(when.className).toMatch(/--fc-font-list-row-meta-size/)
    expect(when.className).not.toMatch(/truncate/)
    const where = within(row).getByTestId("agenda-row-where")
    expect(where).toHaveTextContent("450 Huron Ave, Cambridge")
    expect(where.className).not.toMatch(/truncate/)
  })

  it("shows feed name as uppercase team label and focuses with ring tokens", () => {
    render(
      <AgendaRow
        item={item({
          id: "feed",
          source: "FEED",
          title: "vs Hawks",
          feedName: "U12 Soccer",
          location: "Field 2",
        })}
        isFocused
        circle={circle}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: [], soleAdult: true, soleKid: true }}
        {...noopHandlers}
      />,
    )
    const row = screen.getByTestId("agenda-row-FEED-feed")
    expect(row).toHaveAttribute("data-focused", "true")
    expect(row.className).toMatch(/--fc-list-row-focus-border/)
    expect(row.style.boxShadow).toContain("--fc-list-row-focus-halo")
    const team = within(row).getByTestId("agenda-row-team")
    expect(team).toHaveTextContent("U12 Soccer")
    expect(team.className).toMatch(/uppercase/)
    expect(team.className).toMatch(/--fc-font-list-row-team-size/)
    expect(within(row).getByTestId("agenda-row-title")).toHaveTextContent("vs Hawks")
  })

  it("renders an out-of-play item muted with only a Not going tag and no coverage/travel when expanded", async () => {
    const user = userEvent.setup()
    renderRow(
      item({
        id: "skip",
        title: "Skip practice",
        rsvps: [{ kidId: "k1", status: "NO" }],
      }),
    )

    const row = screen.getByTestId("agenda-row-MANUAL-skip")
    expect(row).toHaveClass("opacity-60")
    expect(within(row).getByText(ATTENDANCE_NOT_GOING_CHIP)).toBeInTheDocument()
    expect(within(row).getByText(ATTENDANCE_NOT_GOING_CHIP).className).toMatch(/uppercase/)
    expect(within(row).getByText(ATTENDANCE_NOT_GOING_CHIP).className).toMatch(/--fc-font-feed-chip-size/)
    expect(within(row).queryByTestId("agenda-status-pill-dot")).not.toBeInTheDocument()
    expect(within(row).queryByTestId("agenda-row-covering-avatars")).not.toBeInTheDocument()
    expect(within(row).queryByText("Needs coverage")).not.toBeInTheDocument()
    expect(within(row).queryByTestId("agenda-band-travel")).not.toBeInTheDocument()
    expect(within(row).queryByTestId("agenda-band-coverage")).not.toBeInTheDocument()

    await user.click(within(row).getByRole("button", { expanded: false }))
    const attendance = within(row).getByTestId("rsvp-MANUAL-skip-k1")
    expect(attendance).toHaveAttribute("data-attendance", "not_going")
    expect(attendance).toHaveTextContent("Sam is marked not going.")
    expect(
      within(row).getByRole("button", { name: "Mark as going again" }),
    ).toBeInTheDocument()
    expect(within(row).queryByRole("combobox")).not.toBeInTheDocument()
    expect(within(row).queryByTestId("agenda-band-travel")).not.toBeInTheDocument()
    expect(within(row).queryByTestId("agenda-band-coverage")).not.toBeInTheDocument()
    expect(within(row).getByTestId("agenda-band-kids")).toBeInTheDocument()
    expect(within(row).queryByText("Leave from")).not.toBeInTheDocument()
    expect(within(row).queryByRole("button", { name: "Assign coverage" })).not.toBeInTheDocument()
    expect(within(row).queryByTestId("driver-picker")).not.toBeInTheDocument()
    expect(
      within(row).queryByRole("button", { name: /can't drive anymore/i }),
    ).not.toBeInTheDocument()
  })

  it("shows coverage leave-from and hides item chooser when the signed-in adult is covering", async () => {
    const user = userEvent.setup()
    const onSetCoverageLeaveFrom = vi.fn()
    renderRow(
      item({
        id: "cov-leave",
        title: "Practice",
        uncoveredKidIds: [],
        leaveFromPlaceId: null,
        leaveFromPlaceName: "Mom's house",
        coverages: [
          {
            id: "cov1",
            coveringAdultId: "a1",
            coveringAdultDisplayName: "Alex",
            assignedByAdultId: "a1",
            kidIds: ["k1"],
            status: "CONFIRMED",
            leaveFromPlaceId: null,
            leaveFromPlaceName: "Mom's house",
            leaveFromAddress: null,
            leaveByAt: "2030-08-15T16:20:00.000Z",
            leaveByStatus: "OK",
            leaveByReason: null,
          },
        ],
      }),
      { onSetCoverageLeaveFrom },
    )

    const row = screen.getByTestId("agenda-row-MANUAL-cov-leave")
    await user.click(within(row).getByRole("button", { expanded: false }))
    expect(within(row).getByTestId("agenda-coverage-leave-cov1")).toBeInTheDocument()
    expect(within(row).getByTestId("coverage-leave-from-cov1-helper").textContent).toMatch(
      /^Leave by ~/,
    )
    expect(within(row).queryByTestId("leave-from-MANUAL-cov-leave-field-row")).not.toBeInTheDocument()
    await user.selectOptions(
      within(row).getByTestId("coverage-leave-from-cov1-place-select"),
      "__one_time__",
    )
    await user.type(
      within(row).getByTestId("coverage-leave-from-cov1-one-time-input"),
      "Playground",
    )
    await user.tab()
    expect(onSetCoverageLeaveFrom).toHaveBeenCalledWith("cov1", {
      leaveFromPlaceId: null,
      leaveFromAddress: "Playground",
    })
  })

  it("shows only the covering adult's leave-from when the viewer is not covering", async () => {
    const user = userEvent.setup()
    const onSetCoverageLeaveFrom = vi.fn()
    const withSchool: FamilyCircle = {
      ...circle,
      places: [
        ...circle.places,
        { id: "p2", name: "School", address: "2 School", latitude: 40.1, longitude: -74.1 },
      ],
      members: [
        ...circle.members,
        {
          adultId: "a2",
          email: "jordan@example.com",
          displayName: "Jordan",
          role: "CAREGIVER",
        },
      ],
    }
    renderRow(
      item({
        id: "item-leave",
        title: "Practice",
        uncoveredKidIds: [],
        leaveFromPlaceId: "p1",
        leaveFromPlaceName: "Mom's house",
        leaveFromAddress: null,
        coverages: [
          {
            id: "cov-other",
            coveringAdultId: "a2",
            coveringAdultDisplayName: "Jordan",
            assignedByAdultId: "a1",
            kidIds: ["k1"],
            status: "CONFIRMED",
            leaveFromPlaceId: "p2",
            leaveFromPlaceName: "School",
            leaveFromAddress: null,
            leaveByAt: "2030-08-15T16:10:00.000Z",
            leaveByStatus: "OK",
            leaveByReason: null,
          },
        ],
      }),
      { onSetCoverageLeaveFrom, circle: withSchool },
    )

    const row = screen.getByTestId("agenda-row-MANUAL-item-leave")
    await user.click(within(row).getByRole("button", { expanded: false }))
    expect(within(row).queryByTestId("leave-from-MANUAL-item-leave-field-row")).not.toBeInTheDocument()
    expect(within(row).getAllByText("Leave from")).toHaveLength(1)
    expect(within(row).getByTestId("coverage-leave-from-cov-other-place-select")).toHaveValue("p2")
    await user.selectOptions(
      within(row).getByTestId("coverage-leave-from-cov-other-place-select"),
      "__one_time__",
    )
    await user.type(
      within(row).getByTestId("coverage-leave-from-cov-other-one-time-input"),
      "Jack's house",
    )
    await user.tab()
    expect(onSetCoverageLeaveFrom).toHaveBeenCalledWith("cov-other", {
      leaveFromPlaceId: null,
      leaveFromAddress: "Jack's house",
    })
  })

  it("shows Cancel request + Mark not going when waiting on another household driver", async () => {
    const user = userEvent.setup()
    const onRemoveCoverage = vi.fn()
    const twoAdultCircle: FamilyCircle = {
      ...circle,
      places: [
        ...circle.places,
        { id: "p2", name: "Haggerty", address: "9 Haggerty", latitude: 40.2, longitude: -74.2 },
      ],
      members: [
        { adultId: "a1", email: "a@example.com", displayName: "Alex", role: "ORGANIZER" },
        { adultId: "a2", email: "j@example.com", displayName: "Jordan", role: "CAREGIVER" },
      ],
    }
    renderRow(
      item({
        id: "waiting-leave",
        title: "Game",
        uncoveredKidIds: [],
        leaveFromPlaceId: "p1",
        leaveFromPlaceName: "Mom's house",
        leaveByAt: "2030-08-15T21:43:00.000Z",
        leaveByStatus: "OK",
        coverages: [
          {
            id: "cov-pending",
            coveringAdultId: "a2",
            coveringAdultDisplayName: "Jordan",
            assignedByAdultId: "a1",
            kidIds: ["k1"],
            status: "PENDING",
            leaveFromPlaceId: "p2",
            leaveFromPlaceName: "Haggerty",
            leaveFromAddress: null,
            leaveByAt: "2030-08-15T21:41:00.000Z",
            leaveByStatus: "OK",
            leaveByReason: null,
          },
        ],
      }),
      { onRemoveCoverage, circle: twoAdultCircle },
    )

    const row = screen.getByTestId("agenda-row-MANUAL-waiting-leave")
    expect(within(row).getByText("Waiting on Jordan")).toBeInTheDocument()
    await user.click(within(row).getByRole("button", { expanded: false }))

    expect(within(row).getAllByText("Leave from")).toHaveLength(1)
    expect(within(row).getByTestId("coverage-leave-from-cov-pending-place-select")).toHaveValue("p2")
    expect(within(row).queryByTestId("leave-from-MANUAL-waiting-leave-field-row")).not.toBeInTheDocument()

    expect(
      within(row).getByRole("button", { name: "Cancel request to Jordan" }),
    ).toBeInTheDocument()
    expect(
      within(row).getByRole("button", { name: "Mark Sam as not going" }),
    ).toBeInTheDocument()
    await user.click(within(row).getByTestId("agenda-cancel-request-link"))
    expect(onRemoveCoverage).toHaveBeenCalledWith("cov-pending")
  })

  it("shows distinct leave-from on each active coverage band", async () => {
    const user = userEvent.setup()
    const twoKids: FamilyCircle = {
      ...circle,
      kids: [
        { id: "k1", displayName: "Sam" },
        { id: "k2", displayName: "Riley" },
      ],
      members: [
        ...circle.members,
        {
          adultId: "a2",
          email: "jordan@example.com",
          displayName: "Jordan",
          role: "CAREGIVER",
        },
      ],
    }
    render(
      <AgendaRow
        item={item({
          id: "two-cov",
          title: "Game",
          kidIds: ["k1", "k2"],
          uncoveredKidIds: [],
          coverages: [
            {
              id: "cov-a",
              coveringAdultId: "a1",
              coveringAdultDisplayName: "Alex",
              assignedByAdultId: "a1",
              kidIds: ["k1"],
              status: "CONFIRMED",
              leaveFromPlaceId: null,
              leaveFromPlaceName: "Mom's house",
              leaveFromAddress: null,
              leaveByAt: "2030-08-15T16:20:00.000Z",
              leaveByStatus: "OK",
              leaveByReason: null,
            },
            {
              id: "cov-b",
              coveringAdultId: "a2",
              coveringAdultDisplayName: "Jordan",
              assignedByAdultId: "a1",
              kidIds: ["k2"],
              status: "CONFIRMED",
              leaveFromPlaceId: null,
              leaveFromPlaceName: null,
              leaveFromAddress: "Playground lot",
              leaveByAt: "2030-08-15T16:05:00.000Z",
              leaveByStatus: "OK",
              leaveByReason: null,
            },
          ],
        })}
        circle={twoKids}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: [], soleAdult: false, soleKid: false }}
        {...noopHandlers}
      />,
    )

    const row = screen.getByTestId("agenda-row-MANUAL-two-cov")
    await user.click(within(row).getByRole("button", { expanded: false }))
    expect(within(row).getByTestId("coverage-leave-from-cov-a-place-select")).toHaveValue("p1")
    expect(within(row).getByTestId("coverage-leave-from-cov-b-place-select")).toHaveValue(
      "__one_time__",
    )
    expect(within(row).getByTestId("coverage-leave-from-cov-b-one-time-input")).toHaveValue(
      "Playground lot",
    )
    expect(within(row).getByTestId("coverage-leave-from-cov-a-helper").textContent).toMatch(/^Leave by ~/)
    expect(within(row).getByTestId("coverage-leave-from-cov-b-helper").textContent).toMatch(/^Leave by ~/)
    expect(within(row).queryByTestId("leave-from-MANUAL-two-cov-field-row")).not.toBeInTheDocument()
  })

  it("shows Mark as not going under the kid band and writes NO via onSetRsvp", async () => {
    const user = userEvent.setup()
    const onSetRsvp = vi.fn()
    render(
      <AgendaRow
        item={item({ id: "going", title: "Game" })}
        circle={circle}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: [], soleAdult: true, soleKid: true }}
        {...noopHandlers}
        onSetRsvp={onSetRsvp}
      />,
    )
    const row = screen.getByTestId("agenda-row-MANUAL-going")
    await user.click(within(row).getByRole("button", { expanded: false }))
    const toggle = within(row).getByTestId("rsvp-MANUAL-going-k1")
    expect(toggle).toHaveAttribute("data-attendance", "going")
    expect(toggle).toHaveTextContent("Mark Sam as not going")
    expect(toggle.tagName).toBe("BUTTON")
    expect(within(row).queryByText("No response")).not.toBeInTheDocument()
    await user.click(toggle)
    expect(onSetRsvp).toHaveBeenCalledWith("k1", "NO")
  })

  it("hides per-kid driver/coverage chrome for not-going kids on mixed multi-kid items", async () => {
    const user = userEvent.setup()
    const twoKids: FamilyCircle = {
      ...circle,
      kids: [
        { id: "k1", displayName: "Sam" },
        { id: "k2", displayName: "Riley" },
      ],
    }
    render(
      <AgendaRow
        item={item({
          id: "mixed",
          title: "Game",
          kidIds: ["k1", "k2"],
          uncoveredKidIds: ["k2"],
          rsvps: [
            { kidId: "k1", status: "NO" },
            { kidId: "k2", status: "YES" },
          ],
        })}
        circle={twoKids}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: ["k2"], soleAdult: true, soleKid: true }}
        {...noopHandlers}
      />,
    )

    const row = screen.getByTestId("agenda-row-MANUAL-mixed")
    await user.click(within(row).getByRole("button", { expanded: false }))

    const samRow = within(row).getByTestId("agenda-kid-row-k1")
    expect(within(samRow).getByTestId("rsvp-MANUAL-mixed-k1")).toHaveAttribute(
      "data-attendance",
      "not_going",
    )
    expect(within(samRow).queryByTestId("driver-picker")).not.toBeInTheDocument()
    expect(within(samRow).queryByRole("button", { name: "Confirm coverage" })).not.toBeInTheDocument()
    expect(
      within(samRow).queryByRole("button", { name: /can't drive anymore/i }),
    ).not.toBeInTheDocument()
    expect(within(samRow).queryByText("Sam")).not.toBeInTheDocument()

    const rileyRow = within(row).getByTestId("agenda-kid-row-k2")
    expect(within(rileyRow).queryByTestId("driver-picker")).not.toBeInTheDocument()
    expect(within(row).getByTestId("driver-picker")).toBeInTheDocument()
    expect(within(rileyRow).getByTestId("rsvp-MANUAL-mixed-k2")).toHaveAttribute(
      "data-attendance",
      "going",
    )
    expect(within(row).getByText("Needs coverage: Riley")).toBeInTheDocument()
    expect(within(row).queryByText(/Needs coverage:.*Sam/)).not.toBeInTheDocument()
  })

  it("treats NO_RESPONSE RSVP as going in the attendance toggle", async () => {
    const user = userEvent.setup()
    renderRow(
      item({
        id: "default-going",
        title: "Practice",
        rsvps: [{ kidId: "k1", status: "NO_RESPONSE" }],
      }),
    )
    const row = screen.getByTestId("agenda-row-MANUAL-default-going")
    await user.click(within(row).getByRole("button", { expanded: false }))
    const toggle = within(row).getByTestId("rsvp-MANUAL-default-going-k1")
    expect(toggle).toHaveAttribute("data-attendance", "going")
    expect(toggle).toHaveTextContent("Mark Sam as not going")
    expect(toggle.tagName).toBe("BUTTON")
    expect(within(row).queryByText("No response")).not.toBeInTheDocument()
  })

  it("shows Ride needed and Ask the team for linked MANUAL with NO_RESPONSE", async () => {
    const user = userEvent.setup()
    const onCreateRide = vi.fn()
    const linked = item({
      id: "banquet",
      title: "Banquet",
      feedId: "f1",
      feedName: "U12",
      eventKey: "CAL:MANUAL:banquet",
      kidIds: ["k1"],
      uncoveredKidIds: ["k1"],
      rsvps: [{ kidId: "k1", status: "NO_RESPONSE" }],
    })
    const rideEvent = {
      eventKey: "CAL:MANUAL:banquet",
      title: "Banquet",
      startsAt: linked.startsAt,
      endsAt: null,
      defaultKidIds: ["k1"],
      ownLegs: carpoolLegsBoth("NEEDS_RIDE"),
      ownRequest: null,
      ownRequests: [],
      otherRequests: [],
    }

    render(
      <AgendaRow
        item={linked}
        circle={circle}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: ["k1"], soleAdult: true, soleKid: true }}
        rideEvent={rideEvent}
        onCreateRide={onCreateRide}
        onCancelRide={vi.fn()}
        {...noopHandlers}
      />,
    )

    const row = screen.getByTestId("agenda-row-MANUAL-banquet")
    expect(within(row).getByText(RIDE_NEEDED)).toBeInTheDocument()
    expect(within(row).queryByText(ATTENDANCE_NOT_GOING_CHIP)).not.toBeInTheDocument()
    await user.click(within(row).getByRole("button", { expanded: false }))
    await user.click(within(row).getByRole("button", { name: "Ask the team" }))
    await user.click(within(row).getByRole("button", { name: "Post to team — round trip" }))
    expect(onCreateRide).toHaveBeenCalledWith("CAL:MANUAL:banquet", ["k1"])
  })

  it("hides Ask the team on standalone MANUAL even when onCreateRide is provided", async () => {
    const user = userEvent.setup()
    render(
      <AgendaRow
        item={item({
          id: "dentist",
          title: "Dentist",
          feedId: null,
          eventKey: null,
          uncoveredKidIds: ["k1"],
          rsvps: [{ kidId: "k1", status: "NO_RESPONSE" }],
        })}
        circle={circle}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: ["k1"], soleAdult: true, soleKid: true }}
        rideEvent={null}
        onCreateRide={vi.fn()}
        onCancelRide={vi.fn()}
        {...noopHandlers}
      />,
    )

    const row = screen.getByTestId("agenda-row-MANUAL-dentist")
    expect(within(row).getByText(RIDE_NEEDED)).toBeInTheDocument()
    await user.click(within(row).getByRole("button", { expanded: false }))
    expect(within(row).queryByRole("button", { name: "Ask the team" })).not.toBeInTheDocument()
  })

  it("shows Confirm you'll drive tag when pending for the signed-in adult", () => {
    renderRow(
      item({
        id: "pending",
        title: "Practice",
        coverages: [
          {
            id: "cov1",
            coveringAdultId: "a1",
            coveringAdultDisplayName: "Alex",
            assignedByAdultId: "a2",
            kidIds: ["k1"],
            status: "PENDING",
          leaveFromPlaceId: null,
          leaveFromPlaceName: null,
          leaveFromAddress: null,
          leaveByAt: null,
          leaveByStatus: null,
          leaveByReason: null,
          },
        ],
      }),
    )
    const row = screen.getByTestId("agenda-row-MANUAL-pending")
    expect(within(row).getByText("Confirm you'll drive")).toBeInTheDocument()
    expect(within(row).getByText("Confirm you'll drive").className).toMatch(/uppercase/)
    expect(within(row).getByText("Confirm you'll drive").className).toMatch(/--fc-font-feed-chip-size/)
    expect(within(row).queryByTestId("agenda-status-pill-dot")).not.toBeInTheDocument()
    expect(within(row).queryByTestId("agenda-row-covering-avatars")).not.toBeInTheDocument()
    expect(within(row).queryByText("You're driving")).not.toBeInTheDocument()
    expect(within(row).queryByText(RIDE_NEEDED)).not.toBeInTheDocument()
  })

  it("shows Waiting on tag when pending for someone else", () => {
    const twoAdultCircle: FamilyCircle = {
      ...circle,
      members: [
        { adultId: "a1", email: "a@example.com", displayName: "Alex", role: "ORGANIZER" },
        { adultId: "a2", email: "j@example.com", displayName: "Jordan", role: "CAREGIVER" },
      ],
    }
    render(
      <AgendaRow
        item={item({
          id: "waiting",
          title: "Game",
          coverages: [
            {
              id: "cov1",
              coveringAdultId: "a2",
              coveringAdultDisplayName: "Jordan",
              assignedByAdultId: "a1",
              kidIds: ["k1"],
              status: "PENDING",
            leaveFromPlaceId: null,
            leaveFromPlaceName: null,
            leaveFromAddress: null,
            leaveByAt: null,
            leaveByStatus: null,
            leaveByReason: null,
            },
          ],
        })}
        circle={twoAdultCircle}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: [], soleAdult: false, soleKid: true }}
        {...noopHandlers}
      />,
    )
    const row = screen.getByTestId("agenda-row-MANUAL-waiting")
    expect(within(row).getByText("Waiting on Jordan")).toBeInTheDocument()
    expect(within(row).queryByTestId("agenda-row-covering-avatars")).not.toBeInTheDocument()
    expect(within(row).queryByText("You're driving")).not.toBeInTheDocument()
  })

  it("shows kid rows and keeps the accepted-rider suffix when driving with passengers", () => {
    render(
      <AgendaRow
        item={item({
          id: "route-row",
          title: "Practice",
          coverages: [
            {
              id: "cov1",
              coveringAdultId: "a1",
              coveringAdultDisplayName: "Alex",
              assignedByAdultId: "a1",
              kidIds: ["k1"],
              status: "CONFIRMED",
            leaveFromPlaceId: null,
            leaveFromPlaceName: null,
            leaveFromAddress: null,
            leaveByAt: null,
            leaveByStatus: null,
            leaveByReason: null,
            },
          ],
        })}
        circle={circle}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: [], soleAdult: true, soleKid: true }}
        rideEvent={{
          eventKey: "UID:game",
          title: "Practice",
          startsAt: "2030-08-15T17:00:00.000Z",
          endsAt: null,
          defaultKidIds: [],
          ownLegs: carpoolLegsBoth("NEEDS_RIDE"),
          ownRequest: null,
          ownRequests: [],
          otherRequests: [
            {
              id: "accepted-1",
              spaceId: "s1",
              eventKey: "UID:game",
              requestingCircleId: "c2",
              requestingCircleName: "House B",
              requestedByAdultId: "a2",
              kidIds: ["k2"],
              kidFirstNames: ["Mia"],
              seats: 1,
              pickupPlaceName: "Home",
              pickupAddress: "1 Main",
              pickupTown: null,
              detourMinutes: null,
              status: "ACCEPTED" as const,
              passedByMe: false,
              passedByAdultNames: [],
              acceptedByAdultId: "a1",
              acceptingCircleId: "c1",
              acceptingCircleName: null,
              legs: carpoolLegsBoth("CONFIRMED", {
                assigneeAdultId: "a1",
                assigneeDisplayName: "Alex",
              }),
            },
          ],
        }}
        {...noopHandlers}
      />,
    )
    const row = screen.getByTestId("agenda-row-MANUAL-route-row")
    const drivingChip = within(row).getByText("You're driving · +1")
    expect(drivingChip.className).toMatch(/--fc-accent/)
    expect(within(row).queryByText("You're driving")).not.toBeInTheDocument()
    expect(within(row).queryByTestId("agenda-row-rider-chips")).not.toBeInTheDocument()
    expect(within(row).getByTestId("agenda-row-kid-MANUAL-route-row-k1")).toHaveTextContent(
      "Sam",
    )
    expect(within(row).getByTestId("agenda-row-kid-MANUAL-route-row-k2")).toHaveTextContent(
      "Mia",
    )
    expect(
      within(row).getByTestId("agenda-row-kid-assignment-MANUAL-route-row-k1"),
    ).toHaveTextContent("There You · Back You")
  })

  it("shows status chips and a chevron on confirmed in-play rows, without covering avatars or a status dot", () => {
    renderRow(
      item({
        id: "covered",
        title: "Practice",
        coverages: [
          {
            id: "cov1",
            coveringAdultId: "a1",
            coveringAdultDisplayName: "Alex",
            assignedByAdultId: "a1",
            kidIds: ["k1"],
            status: "CONFIRMED",
          leaveFromPlaceId: null,
          leaveFromPlaceName: null,
          leaveFromAddress: null,
          leaveByAt: null,
          leaveByStatus: null,
          leaveByReason: null,
          },
        ],
      }),
    )
    const row = screen.getByTestId("agenda-row-MANUAL-covered")
    expect(within(row).getByText("You're driving")).toBeInTheDocument()
    expect(within(row).queryByTestId("agenda-row-covering-avatars")).not.toBeInTheDocument()
    expect(within(row).getByTestId("agenda-row-chevron")).toBeInTheDocument()
    expect(row.querySelector("[class*='h-[9px]']")).toBeNull()
  })

  it("does not render covering avatars when multiple adults are confirmed", () => {
    const twoAdultCircle: FamilyCircle = {
      ...circle,
      members: [
        { adultId: "a1", email: "a@example.com", displayName: "Alex", role: "ORGANIZER" },
        { adultId: "a2", email: "j@example.com", displayName: "Jordan Lee", role: "CAREGIVER" },
      ],
    }
    render(
      <AgendaRow
        item={item({
          id: "shared",
          title: "Game",
          kidIds: ["k1"],
          coverages: [
            {
              id: "cov1",
              coveringAdultId: "a1",
              coveringAdultDisplayName: "Alex",
              assignedByAdultId: "a1",
              kidIds: ["k1"],
              status: "CONFIRMED",
            leaveFromPlaceId: null,
            leaveFromPlaceName: null,
            leaveFromAddress: null,
            leaveByAt: null,
            leaveByStatus: null,
            leaveByReason: null,
            },
            {
              id: "cov2",
              coveringAdultId: "a2",
              coveringAdultDisplayName: "Jordan Lee",
              assignedByAdultId: "a1",
              kidIds: ["k1"],
              status: "CONFIRMED",
            leaveFromPlaceId: null,
            leaveFromPlaceName: null,
            leaveFromAddress: null,
            leaveByAt: null,
            leaveByStatus: null,
            leaveByReason: null,
            },
          ],
        })}
        circle={twoAdultCircle}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: [], soleAdult: false, soleKid: true }}
        {...noopHandlers}
      />,
    )
    expect(screen.queryByLabelText("Covering: Alex, Jordan Lee")).not.toBeInTheDocument()
    expect(screen.queryByTestId("agenda-row-covering-avatars")).not.toBeInTheDocument()
    expect(screen.getByText("You're driving")).toBeInTheDocument()
  })

  it("toggles expand/collapse per row without affecting other rows", async () => {
    const user = userEvent.setup()
    render(
      <>
        <AgendaRow
          item={item({ id: "a", title: "Practice" })}
          circle={circle}
          currentAdultId="a1"
          loading={false}
          assignDraft={{ adultId: "a1", kidIds: [], soleAdult: true, soleKid: true }}
          {...noopHandlers}
        />
        <AgendaRow
          item={item({ id: "b", title: "Game" })}
          circle={circle}
          currentAdultId="a1"
          loading={false}
          assignDraft={{ adultId: "a1", kidIds: [], soleAdult: true, soleKid: true }}
          {...noopHandlers}
        />
      </>,
    )

    const rowA = screen.getByTestId("agenda-row-MANUAL-a")
    const rowB = screen.getByTestId("agenda-row-MANUAL-b")
    expect(within(rowA).queryByTestId("agenda-band-travel")).not.toBeInTheDocument()
    expect(within(rowB).queryByTestId("agenda-band-travel")).not.toBeInTheDocument()

    await user.click(within(rowA).getByRole("button", { expanded: false }))
    expect(within(rowA).getByTestId("agenda-band-travel")).toBeInTheDocument()
    expect(within(rowB).queryByTestId("agenda-band-travel")).not.toBeInTheDocument()

    await user.click(within(rowA).getByRole("button", { expanded: true }))
    await user.click(within(rowB).getByRole("button", { expanded: false }))
    expect(within(rowA).queryByTestId("agenda-band-travel")).not.toBeInTheDocument()
    expect(within(rowB).getByTestId("agenda-band-travel")).toBeInTheDocument()
  })

  it("shows Asked the team chip collapsed and Request/Cancel when expanded for a ride event", async () => {
    const user = userEvent.setup()
    const onCreateRide = vi.fn()
    const onCancelRide = vi.fn()
    const feedItem = item({
      id: "feed-1",
      source: "FEED",
      title: "Practice",
      feedId: "f1",
      feedName: "Soccer",
      kidIds: ["k1", "k2"],
      uncoveredKidIds: ["k1", "k2"],
      rsvps: [
        { kidId: "k1", status: "YES" },
        { kidId: "k2", status: "YES" },
      ],
    })
    const twoKids: FamilyCircle = {
      ...circle,
      kids: [
        { id: "k1", displayName: "Sam" },
        { id: "k2", displayName: "Riley" },
      ],
    }
    const rideEvent = {
      eventKey: "UID:practice",
      title: "Practice",
      startsAt: feedItem.startsAt,
      endsAt: null,
      defaultKidIds: ["k1", "k2"],
      ownLegs: carpoolLegsBoth("NEEDS_RIDE"),

      ownRequest: null,
      ownRequests: [],
      otherRequests: [],
    }

    const { rerender } = render(
      <AgendaRow
        item={feedItem}
        circle={twoKids}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: ["k1", "k2"], soleAdult: true, soleKid: false }}
        rideEvent={rideEvent}
        onCreateRide={onCreateRide}
        onCancelRide={onCancelRide}
        {...noopHandlers}
      />,
    )

    const row = screen.getByTestId("agenda-row-FEED-feed-1")
    expect(within(row).queryByText(ASKED_THE_TEAM)).not.toBeInTheDocument()
    expect(within(row).queryByTestId("agenda-band-carpool")).not.toBeInTheDocument()

    await user.click(within(row).getByRole("button", { expanded: false }))
    expect(within(row).queryByTestId("agenda-band-carpool")).not.toBeInTheDocument()
    await user.click(within(row).getByRole("button", { name: "Ask the team" }))
    await user.click(within(row).getByRole("button", { name: "Post to team — round trip" }))
    expect(onCreateRide).toHaveBeenCalledWith("UID:practice", ["k1", "k2"])

    const requestedEvent = {
      ...rideEvent,
      defaultKidIds: [],
      ownLegs: carpoolLegsBoth("ASKED_TEAM"),
      ownRequest: {
        id: "ride-1",
        spaceId: "s1",
        eventKey: "UID:practice",
        requestingCircleId: "c1",
        requestingCircleName: "Test",
        requestedByAdultId: "a1",
        kidIds: ["k1", "k2"],
        kidFirstNames: ["Sam", "Riley"],
        seats: 2,
        pickupPlaceName: "Home",
        pickupAddress: "1 Main",
    pickupTown: null,
    detourMinutes: null,
        status: "PENDING" as const,
        passedByMe: false,
        passedByAdultNames: [],
        acceptedByAdultId: null,
        acceptingCircleId: null,
        acceptingCircleName: null,
    legs: carpoolLegsBoth("ASKED_TEAM"),
      },
    }
    const askedItem = { ...feedItem, uncoveredKidIds: [] as string[] }
    rerender(
      <AgendaRow
        item={askedItem}
        circle={twoKids}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: [], soleAdult: true, soleKid: true }}
        rideEvent={requestedEvent}
        onCreateRide={onCreateRide}
        onCancelRide={onCancelRide}
        {...noopHandlers}
      />,
    )
    expect(within(row).getByTestId("agenda-row-chip-strip")).toHaveTextContent(
      /Asked team/i,
    )
    // Dual-chip labels (Focus) stay off the Agenda row; Legs table uses plain faces.
    expect(within(row).queryByText(/Getting there:/)).not.toBeInTheDocument()
    expect(within(row).queryByText(/Coming back:/)).not.toBeInTheDocument()
    expect(within(row).getByTestId("agenda-row-own-ride")).toHaveTextContent(
      "Requested · Sam, Riley · 2 seats · Home, 1 Main",
    )
    await user.click(
      within(row).getByRole("button", {
        name: "No longer need a ride? Cancel this ask",
      }),
    )
    expect(onCancelRide).toHaveBeenCalledWith("ride-1")

    rerender(
      <AgendaRow
        item={askedItem}
        circle={twoKids}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: [], soleAdult: true, soleKid: true }}
        rideEvent={{
          ...requestedEvent,
          ownRequest: {
            ...requestedEvent.ownRequest!,
            passedByAdultNames: ["Sam"],
          },
        }}
        onCreateRide={onCreateRide}
        onCancelRide={onCancelRide}
        {...noopHandlers}
      />,
    )
    expect(within(row).getByText(/Passed by Sam/)).toBeInTheDocument()
    expect(within(row).getByTestId("agenda-row-own-ride")).toHaveTextContent(
      "Passed by Sam · Sam, Riley · 2 seats · Home, 1 Main",
    )
    expect(within(row).queryByTestId("agenda-band-carpool")).not.toBeInTheDocument()
    expect(within(row).getByTestId("agenda-row-own-ride")).not.toHaveTextContent(
      /^Requested/,
    )

    rerender(
      <AgendaRow
        item={askedItem}
        circle={twoKids}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: [], soleAdult: true, soleKid: true }}
        rideEvent={{
          ...requestedEvent,
          ownRequest: {
            ...requestedEvent.ownRequest!,
            status: "ACCEPTED",
            acceptingCircleName: "House B",
            legs: carpoolLegsBoth("CONFIRMED"),
          },
        }}
        onCreateRide={onCreateRide}
        onCancelRide={onCancelRide}
        {...noopHandlers}
      />,
    )
    expect(within(row).getByText("House B confirmed")).toBeInTheDocument()
    expect(within(row).queryByText(/Getting there:/)).not.toBeInTheDocument()
    expect(within(row).queryByText(/Coming back:/)).not.toBeInTheDocument()
    expect(within(row).getByTestId("agenda-row-own-ride")).toHaveTextContent(
      "Riding with House B · Sam, Riley · 2 seats · Home, 1 Main",
    )
    expect(within(row).queryByText(/Accepted ·|Accepted:/)).not.toBeInTheDocument()
  })

  it("clears Needs coverage / Assign when ACCEPTED ride covers all uncovered kids", async () => {
    const user = userEvent.setup()
    const feedItem = item({
      id: "feed-accepted",
      source: "FEED",
      title: "Practice",
      feedId: "f1",
      feedName: "Soccer",
      uncoveredKidIds: ["k1"],
    })
    const rideEvent = {
      eventKey: "UID:accepted",
      title: "Practice",
      startsAt: feedItem.startsAt,
      endsAt: null,
      defaultKidIds: [],
      ownLegs: carpoolLegsBoth("NEEDS_RIDE"),
      ownRequest: {
        id: "ride-1",
        spaceId: "s1",
        eventKey: "UID:accepted",
        requestingCircleId: "c1",
        requestingCircleName: "Test",
        requestedByAdultId: "a1",
        kidIds: ["k1"],
        kidFirstNames: ["Sam"],
        seats: 1,
        pickupPlaceName: "Home",
        pickupAddress: "1 Main",
    pickupTown: null,
    detourMinutes: null,
        status: "ACCEPTED" as const,
        passedByMe: false,
        passedByAdultNames: [],
        acceptedByAdultId: "a2",
        acceptingCircleId: "c2",
        acceptingCircleName: "Sharks Family",
    legs: carpoolLegsBoth("CONFIRMED"),
      },
      ownRequests: [],
      otherRequests: [],
    }

    render(
      <AgendaRow
        item={feedItem}
        circle={circle}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: ["k1"], soleAdult: true, soleKid: true }}
        rideEvent={rideEvent}
        onCreateRide={vi.fn()}
        onCancelRide={vi.fn()}
        {...noopHandlers}
      />,
    )

    const row = screen.getByTestId("agenda-row-FEED-feed-accepted")
    expect(within(row).getAllByText("Sharks Family confirmed").length).toBeGreaterThan(0)
    expect(within(row).queryByText(/Getting there:/)).not.toBeInTheDocument()
    expect(within(row).queryByText(/Coming back:/)).not.toBeInTheDocument()
    expect(within(row).queryByText("Needs coverage")).not.toBeInTheDocument()
    expect(within(row).queryByText(/Accepted ·|Accepted:/)).not.toBeInTheDocument()

    await user.click(within(row).getByRole("button", { expanded: false }))
    expect(within(row).queryByRole("button", { name: "Assign coverage" })).not.toBeInTheDocument()
    expect(within(row).queryByTestId("driver-picker")).not.toBeInTheDocument()
    expect(within(row).getAllByText("Sharks Family confirmed").length).toBeGreaterThan(0)
    expect(
      within(row).getByRole("button", {
        name: "Sharks Family can't drive anymore? Find a new ride",
      }),
    ).toBeInTheDocument()
    expect(within(row).queryByRole("button", { name: "Remove coverage" })).not.toBeInTheDocument()
  })

  it("keeps Ride needed chip and Assign for remaining gap kids after a teammate ride", async () => {
    const user = userEvent.setup()
    const twoKids: FamilyCircle = {
      ...circle,
      kids: [
        { id: "k1", displayName: "Sam" },
        { id: "k2", displayName: "Riley" },
      ],
    }
    const feedItem = item({
      id: "feed-mixed",
      source: "FEED",
      title: "Practice",
      feedId: "f1",
      feedName: "Soccer",
      kidIds: ["k1", "k2"],
      uncoveredKidIds: ["k1", "k2"],
      rsvps: [
        { kidId: "k1", status: "YES" },
        { kidId: "k2", status: "YES" },
      ],
    })
    const rideEvent = {
      eventKey: "UID:mixed",
      title: "Practice",
      startsAt: feedItem.startsAt,
      endsAt: null,
      defaultKidIds: [],
      ownLegs: carpoolLegsBoth("NEEDS_RIDE"),
      ownRequest: {
        id: "ride-1",
        spaceId: "s1",
        eventKey: "UID:mixed",
        requestingCircleId: "c1",
        requestingCircleName: "Test",
        requestedByAdultId: "a1",
        kidIds: ["k1"],
        kidFirstNames: ["Sam"],
        seats: 1,
        pickupPlaceName: "Home",
        pickupAddress: "1 Main",
    pickupTown: null,
    detourMinutes: null,
        status: "ACCEPTED" as const,
        passedByMe: false,
        passedByAdultNames: [],
        acceptedByAdultId: "a2",
        acceptingCircleId: "c2",
        acceptingCircleName: "House B",
    legs: carpoolLegsBoth("CONFIRMED"),
      },
      ownRequests: [],
      otherRequests: [],
    }

    render(
      <AgendaRow
        item={feedItem}
        circle={twoKids}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: ["k2"], soleAdult: true, soleKid: true }}
        rideEvent={rideEvent}
        onCreateRide={vi.fn()}
        onCancelRide={vi.fn()}
        {...noopHandlers}
      />,
    )

    const row = screen.getByTestId("agenda-row-FEED-feed-mixed")
    expect(within(row).getByText(RIDE_NEEDED)).toBeInTheDocument()
    expect(within(row).queryByText("Riding with House B")).not.toBeInTheDocument()

    await user.click(within(row).getByRole("button", { expanded: false }))
    expect(within(row).getByText("Needs coverage: Riley")).toBeInTheDocument()
    expect(within(row).queryByText(/Needs coverage:.*Sam/)).not.toBeInTheDocument()
    expect(within(row).getByTestId("driver-picker")).toBeInTheDocument()
    expect(within(row).getByTestId("driver-picker-confirm")).toBeInTheDocument()
    expect(within(row).queryByTestId("agenda-kid-row-k1")).not.toBeInTheDocument()
    expect(within(row).queryByTestId("agenda-kid-row-k2")).not.toBeInTheDocument()
    expect(
      within(row).getByRole("button", {
        name: "House B can't drive anymore? Find a new ride",
      }),
    ).toBeInTheDocument()
  })

  it("shows Cancel ask without Assign while own ride is PENDING", async () => {
    const user = userEvent.setup()
    const feedItem = item({
      id: "feed-pending",
      source: "FEED",
      title: "Practice",
      feedId: "f1",
      feedName: "Soccer",
      uncoveredKidIds: ["k1"],
    })
    const rideEvent = {
      eventKey: "UID:pending",
      title: "Practice",
      startsAt: feedItem.startsAt,
      endsAt: null,
      defaultKidIds: [],
      ownLegs: carpoolLegsBoth("NEEDS_RIDE"),
      ownRequest: {
        id: "ride-1",
        spaceId: "s1",
        eventKey: "UID:pending",
        requestingCircleId: "c1",
        requestingCircleName: "Test",
        requestedByAdultId: "a1",
        kidIds: ["k1"],
        kidFirstNames: ["Sam"],
        seats: 1,
        pickupPlaceName: "Home",
        pickupAddress: "1 Main",
    pickupTown: null,
    detourMinutes: null,
        status: "PENDING" as const,
        passedByMe: false,
        passedByAdultNames: [],
        acceptedByAdultId: null,
        acceptingCircleId: null,
        acceptingCircleName: null,
    legs: carpoolLegsBoth("ASKED_TEAM"),
      },
      ownRequests: [],
      otherRequests: [],
    }

    render(
      <AgendaRow
        item={feedItem}
        circle={circle}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: ["k1"], soleAdult: true, soleKid: true }}
        rideEvent={rideEvent}
        onCreateRide={vi.fn()}
        onCancelRide={vi.fn()}
        {...noopHandlers}
      />,
    )

    const row = screen.getByTestId("agenda-row-FEED-feed-pending")
    expect(within(row).getByText("Asked team")).toBeInTheDocument()
    expect(within(row).queryByText(/Getting there:/)).not.toBeInTheDocument()
    expect(within(row).queryByText(/Coming back:/)).not.toBeInTheDocument()
    expect(within(row).queryByText(RIDE_NEEDED)).not.toBeInTheDocument()

    await user.click(within(row).getByRole("button", { expanded: false }))
    // Fully asked PENDING covers the kid — no Assign; Cancel ask stays.
    expect(within(row).queryByTestId("driver-picker")).not.toBeInTheDocument()
    expect(within(row).queryByText("Needs coverage: Sam")).not.toBeInTheDocument()
    expect(
      within(row).getByRole("button", {
        name: "No longer need a ride? Cancel this ask",
      }),
    ).toBeInTheDocument()
  })

  it("shows DriverPicker when there is a coverage gap", async () => {
    const user = userEvent.setup()
    const onCreateRide = vi.fn()
    const onAssignCoverage = vi.fn()
    const feedItem = item({
      id: "feed-gap",
      source: "FEED",
      title: "Practice",
      feedId: "f1",
      feedName: "Soccer",
      kidIds: ["k1"],
      uncoveredKidIds: ["k1"],
      rsvps: [{ kidId: "k1", status: "YES" }],
    })
    const rideEvent = {
      eventKey: "UID:gap",
      title: "Practice",
      startsAt: feedItem.startsAt,
      endsAt: null,
      defaultKidIds: ["k1"],
      ownLegs: carpoolLegsBoth("NEEDS_RIDE"),

      ownRequest: null,
      ownRequests: [],
      otherRequests: [],
    }

    render(
      <AgendaRow
        item={feedItem}
        circle={circle}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: ["k1"], soleAdult: true, soleKid: true }}
        rideEvent={rideEvent}
        onCreateRide={onCreateRide}
        onCancelRide={vi.fn()}
        {...noopHandlers}
        onAssignCoverage={onAssignCoverage}
      />,
    )

    const row = screen.getByTestId("agenda-row-FEED-feed-gap")
    await user.click(within(row).getByRole("button", { expanded: false }))
    const picker = within(row).getByTestId("driver-picker")
    expect(picker).toHaveAttribute("data-mode", "simple")
    const household = within(row).getByTestId("driver-picker-household-section")
    const leaveFrom = within(household).getByTestId("leave-from-FEED-feed-gap-field-row")
    const confirm = within(household).getByTestId("driver-picker-confirm")
    expect(confirm.className).toMatch(/--fc-font-focus-action-size/)
    expect(confirm.className).toMatch(/--fc-accent/)
    expect(confirm.className).toMatch(/--fc-space-focus-action-min-height/)
    expect(confirm.className).not.toMatch(/\btext-sm\b/)
    expect(
      leaveFrom.compareDocumentPosition(confirm) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(confirm).toHaveTextContent("Confirm — You'll drive round trip from Mom's house")
    await user.selectOptions(
      within(household).getByTestId("leave-from-FEED-feed-gap-place-select"),
      "__one_time__",
    )
    const oneTime = within(household).getByTestId("leave-from-FEED-feed-gap-one-time-input")
    await user.clear(oneTime)
    await user.type(oneTime, "Side gate")
    expect(confirm).toHaveTextContent("Confirm — You'll drive round trip from Side gate")
    expect(within(row).queryByRole("button", { name: "Request" })).not.toBeInTheDocument()
    await user.click(within(row).getByRole("button", { name: "Ask the team" }))
    await user.click(within(row).getByRole("button", { name: "Post to team — round trip" }))
    expect(onCreateRide).toHaveBeenCalledWith("UID:gap", ["k1"])
    await user.click(within(row).getByRole("button", { name: "You" }))
    await user.click(within(household).getByTestId("driver-picker-confirm"))
    expect(onAssignCoverage).toHaveBeenCalledWith("a1", ["k1"])
  })

  it("asks the team from DriverPicker for No-response defaults without RSVP Yes first", async () => {
    const user = userEvent.setup()
    const onCreateRide = vi.fn()
    const feedItem = item({
      id: "feed-nr",
      source: "FEED",
      title: "Practice",
      feedId: "f1",
      feedName: "Soccer",
      kidIds: ["k1"],
      uncoveredKidIds: ["k1"],
      rsvps: [{ kidId: "k1", status: "NO_RESPONSE" }],
    })
    const rideEvent = {
      eventKey: "UID:practice-nr",
      title: "Practice",
      startsAt: feedItem.startsAt,
      endsAt: null,
      defaultKidIds: ["k1"],
      ownLegs: carpoolLegsBoth("NEEDS_RIDE"),

      ownRequest: null,
      ownRequests: [],
      otherRequests: [],
    }

    render(
      <AgendaRow
        item={feedItem}
        circle={circle}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: ["k1"], soleAdult: true, soleKid: true }}
        rideEvent={rideEvent}
        onCreateRide={onCreateRide}
        onCancelRide={vi.fn()}
        {...noopHandlers}
      />,
    )

    const row = screen.getByTestId("agenda-row-FEED-feed-nr")
    expect(
      within(row).queryByText("Mark who's going on Calendar to request a ride."),
    ).not.toBeInTheDocument()
    await user.click(within(row).getByRole("button", { expanded: false }))
    expect(within(row).queryByTestId("agenda-band-carpool")).not.toBeInTheDocument()
    await user.click(within(row).getByRole("button", { name: "Ask the team" }))
    await user.click(within(row).getByRole("button", { name: "Post to team — round trip" }))
    expect(onCreateRide).toHaveBeenCalledWith("UID:practice-nr", ["k1"])
  })

  it("hides Ask the team when onCreateRide is omitted (no carpool space)", async () => {
    const user = userEvent.setup()
    const feedItem = item({
      id: "feed-no-space",
      source: "FEED",
      title: "Practice",
      feedId: "f1",
      feedName: "Soccer",
      eventKey: "UID:practice-ns",
      kidIds: ["k1"],
      uncoveredKidIds: ["k1"],
      rsvps: [{ kidId: "k1", status: "YES" }],
    })

    render(
      <AgendaRow
        item={feedItem}
        circle={circle}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: ["k1"], soleAdult: true, soleKid: true }}
        {...noopHandlers}
      />,
    )

    const row = screen.getByTestId("agenda-row-FEED-feed-no-space")
    await user.click(within(row).getByRole("button", { expanded: false }))
    expect(within(row).getByTestId("driver-picker")).toBeInTheDocument()
    expect(within(row).queryByRole("button", { name: "Ask the team" })).not.toBeInTheDocument()
    expect(within(row).queryByTestId("driver-picker-ask-team-chip")).not.toBeInTheDocument()
  })

  it("shows accepted-by-us ride density and Can't take them anymore when expanded", async () => {
    const user = userEvent.setup()
    const onWithdrawRide = vi.fn()
    const feedItem = item({
      id: "feed-withdraw",
      source: "FEED",
      title: "Practice",
      feedId: "f1",
      feedName: "Soccer",
      eventKey: "UID:practice-w",
    })
    const rideEvent = {
      eventKey: "UID:practice-w",
      title: "Practice",
      startsAt: feedItem.startsAt,
      endsAt: null,
      defaultKidIds: [],
      ownLegs: carpoolLegsBoth("NEEDS_RIDE"),
      ownRequest: null,
      ownRequests: [],
      otherRequests: [
        {
          id: "ask-accepted",
          spaceId: "s1",
          eventKey: "UID:practice-w",
          requestingCircleId: "c2",
          requestingCircleName: "House B",
          requestedByAdultId: "a2",
          kidIds: ["k2"],
          kidFirstNames: ["Mia"],
          seats: 1,
          pickupPlaceName: "Home",
          pickupAddress: "1 Main",
    pickupTown: null,
    detourMinutes: null,
          status: "ACCEPTED" as const,
          passedByMe: false,
          passedByAdultNames: [],
          acceptedByAdultId: "a1",
          acceptingCircleId: "c1",
          acceptingCircleName: "Test",
    legs: carpoolLegsBoth("ASKED_TEAM"),
        },
      ],
    }

    render(
      <AgendaRow
        item={feedItem}
        circle={circle}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: [], soleAdult: true, soleKid: true }}
        rideEvent={rideEvent}
        onWithdrawRide={onWithdrawRide}
        {...noopHandlers}
      />,
    )

    const row = screen.getByTestId("agenda-row-FEED-feed-withdraw")
    expect(within(row).queryByTestId("agenda-band-carpool")).not.toBeInTheDocument()
    await user.click(within(row).getByRole("button", { expanded: false }))
    const inbound = within(row).getByTestId("agenda-band-inbound-requests")
    expect(within(inbound).getByTestId("agenda-inbound-request-ask-accepted")).toHaveTextContent(
      "House B · Mia · 1 seat · Home, 1 Main",
    )
    expect(within(inbound).queryByRole("button", { name: "Accept" })).not.toBeInTheDocument()
    expect(within(inbound).queryByRole("button", { name: "Pass" })).not.toBeInTheDocument()
    await user.click(
      within(inbound).getByRole("button", { name: "Can't take them anymore" }),
    )
    expect(onWithdrawRide).toHaveBeenCalledWith("ask-accepted", undefined)
  })

  it("shows Accept and Pass for pending inbound asks outside the hero queue", async () => {
    const user = userEvent.setup()
    const onAcceptRide = vi.fn()
    const onPassRide = vi.fn()
    const feedItem = item({
      id: "feed-accept",
      source: "FEED",
      title: "Practice",
      feedId: "f1",
      feedName: "Soccer",
      eventKey: "UID:practice-accept",
    })

    render(
      <AgendaRow
        item={feedItem}
        circle={circle}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: [], soleAdult: true, soleKid: true }}
        rideEvent={{
          eventKey: "UID:practice-accept",
          title: "Practice",
          startsAt: feedItem.startsAt,
          endsAt: null,
          defaultKidIds: ["k1"],
          ownLegs: carpoolLegsBoth("NEEDS_RIDE"),
          ownRequest: null,
          ownRequests: [],
          otherRequests: [
            {
              id: "pending-other",
              spaceId: "s1",
              eventKey: "UID:practice-accept",
              requestingCircleId: "c2",
              requestingCircleName: "House B",
              requestedByAdultId: "a2",
              kidIds: ["k2"],
              kidFirstNames: ["Mia"],
              seats: 1,
              pickupPlaceName: "Home",
              pickupAddress: "1 Main",
    pickupTown: null,
    detourMinutes: null,
              status: "PENDING",
              passedByMe: false,
              passedByAdultNames: [],
              acceptedByAdultId: null,
              acceptingCircleId: null,
              acceptingCircleName: null,
    legs: carpoolLegsBoth("ASKED_TEAM"),
            },
          ],
        }}
        onAcceptRide={onAcceptRide}
        onPassRide={onPassRide}
        onCreateRide={vi.fn()}
        onCancelRide={vi.fn()}
        onWithdrawRide={vi.fn()}
        {...noopHandlers}
      />,
    )

    const row = screen.getByTestId("agenda-row-FEED-feed-accept")
    await user.click(within(row).getByRole("button", { expanded: false }))
    const inbound = within(row).getByTestId("agenda-band-inbound-requests")
    await user.click(within(inbound).getByRole("button", { name: "Accept" }))
    expect(onAcceptRide).toHaveBeenCalledWith("pending-other")
    await user.click(within(inbound).getByRole("button", { name: "Pass" }))
    expect(onPassRide).toHaveBeenCalledWith("pending-other")
  })

  it("auto-declines pending inbound when own ride is requested", async () => {
    const user = userEvent.setup()
    const feedItem = item({
      id: "feed-auto-decline",
      source: "FEED",
      title: "Practice",
      feedId: "f1",
      feedName: "Soccer",
      eventKey: "UID:practice-auto",
      uncoveredKidIds: [],
    })

    render(
      <AgendaRow
        item={feedItem}
        circle={circle}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: [], soleAdult: true, soleKid: true }}
        rideEvent={{
          eventKey: "UID:practice-auto",
          title: "Practice",
          startsAt: feedItem.startsAt,
          endsAt: null,
          defaultKidIds: ["k1"],
          ownLegs: carpoolLegsBoth("NEEDS_RIDE"),
          ownRequest: {
            id: "own-ask",
            spaceId: "s1",
            eventKey: "UID:practice-auto",
            requestingCircleId: "c1",
            requestingCircleName: "Test",
            requestedByAdultId: "a1",
            kidIds: ["k1"],
            kidFirstNames: ["Sam"],
            seats: 1,
            pickupPlaceName: "Home",
            pickupAddress: "1 Main",
    pickupTown: null,
    detourMinutes: null,
            status: "PENDING",
            passedByMe: false,
            passedByAdultNames: [],
            acceptedByAdultId: null,
            acceptingCircleId: null,
            acceptingCircleName: null,
    legs: carpoolLegsBoth("ASKED_TEAM"),
          },
          ownRequests: [],
          otherRequests: [
            {
              id: "inbound-ask",
              spaceId: "s1",
              eventKey: "UID:practice-auto",
              requestingCircleId: "c2",
              requestingCircleName: "House B",
              requestedByAdultId: "a2",
              kidIds: ["k2"],
              kidFirstNames: ["Mia"],
              seats: 1,
              pickupPlaceName: "Home",
              pickupAddress: "1 Main",
    pickupTown: null,
    detourMinutes: null,
              status: "PENDING",
              passedByMe: false,
              passedByAdultNames: [],
              acceptedByAdultId: null,
              acceptingCircleId: null,
              acceptingCircleName: null,
    legs: carpoolLegsBoth("ASKED_TEAM"),
            },
          ],
        }}
        onAcceptRide={vi.fn()}
        onPassRide={vi.fn()}
        onCancelRide={vi.fn()}
        {...noopHandlers}
      />,
    )

    const row = screen.getByTestId("agenda-row-FEED-feed-auto-decline")
    expect(within(row).queryByText("1 carpool ask")).not.toBeInTheDocument()
    await user.click(within(row).getByRole("button", { expanded: false }))
    const inbound = within(row).getByTestId("agenda-band-inbound-requests")
    expect(within(inbound).getByText("Declined — you needed a ride too")).toBeInTheDocument()
    expect(within(inbound).queryByRole("button", { name: "Accept" })).not.toBeInTheDocument()
    expect(within(inbound).queryByRole("button", { name: "Pass" })).not.toBeInTheDocument()
  })

  it("does not auto-decline inbound when own ride is unassigned", async () => {
    const user = userEvent.setup()
    const feedItem = item({
      id: "feed-no-auto-unassigned",
      source: "FEED",
      title: "Practice",
      feedId: "f1",
      feedName: "Soccer",
      eventKey: "UID:no-auto-u",
      uncoveredKidIds: ["k1"],
    })

    render(
      <AgendaRow
        item={feedItem}
        circle={circle}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: ["k1"], soleAdult: true, soleKid: true }}
        rideEvent={{
          eventKey: "UID:no-auto-u",
          title: "Practice",
          startsAt: feedItem.startsAt,
          endsAt: null,
          defaultKidIds: ["k1"],
          ownLegs: carpoolLegsBoth("NEEDS_RIDE"),
          ownRequest: null,
          ownRequests: [],
          otherRequests: [
            {
              id: "still-pending",
              spaceId: "s1",
              eventKey: "UID:no-auto-u",
              requestingCircleId: "c2",
              requestingCircleName: "House B",
              requestedByAdultId: "a2",
              kidIds: ["k2"],
              kidFirstNames: ["Mia"],
              seats: 1,
              pickupPlaceName: "Home",
              pickupAddress: "1 Main",
    pickupTown: null,
    detourMinutes: null,
              status: "PENDING",
              passedByMe: false,
              passedByAdultNames: [],
              acceptedByAdultId: null,
              acceptingCircleId: null,
              acceptingCircleName: null,
    legs: carpoolLegsBoth("ASKED_TEAM"),
            },
          ],
        }}
        onAcceptRide={vi.fn()}
        onPassRide={vi.fn()}
        onCreateRide={vi.fn()}
        {...noopHandlers}
      />,
    )

    const row = screen.getByTestId("agenda-row-FEED-feed-no-auto-unassigned")
    expect(within(row).getByText("1 carpool ask")).toBeInTheDocument()
    await user.click(within(row).getByRole("button", { expanded: false }))
    const inbound = within(row).getByTestId("agenda-band-inbound-requests")
    expect(within(inbound).queryByText("Declined — you needed a ride too")).not.toBeInTheDocument()
    expect(within(inbound).getByRole("button", { name: "Accept" })).toBeInTheDocument()
  })

  it("does not auto-decline inbound when own ride is pending household confirm", async () => {
    const user = userEvent.setup()
    const feedItem = item({
      id: "feed-no-auto-confirm",
      source: "FEED",
      title: "Practice",
      feedId: "f1",
      feedName: "Soccer",
      eventKey: "UID:no-auto-c",
      uncoveredKidIds: [],
      coverages: [
        {
          id: "cov-pending",
          coveringAdultId: "a1",
          coveringAdultDisplayName: "Alex",
          assignedByAdultId: "a2",
          kidIds: ["k1"],
          status: "PENDING",
        leaveFromPlaceId: null,
        leaveFromPlaceName: null,
        leaveFromAddress: null,
        leaveByAt: null,
        leaveByStatus: null,
        leaveByReason: null,
        },
      ],
    })

    render(
      <AgendaRow
        item={feedItem}
        circle={circle}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: [], soleAdult: true, soleKid: true }}
        rideEvent={{
          eventKey: "UID:no-auto-c",
          title: "Practice",
          startsAt: feedItem.startsAt,
          endsAt: null,
          defaultKidIds: ["k1"],
          ownLegs: carpoolLegsBoth("NEEDS_RIDE"),
          ownRequest: null,
          ownRequests: [],
          otherRequests: [
            {
              id: "still-pending",
              spaceId: "s1",
              eventKey: "UID:no-auto-c",
              requestingCircleId: "c2",
              requestingCircleName: "House B",
              requestedByAdultId: "a2",
              kidIds: ["k2"],
              kidFirstNames: ["Mia"],
              seats: 1,
              pickupPlaceName: "Home",
              pickupAddress: "1 Main",
    pickupTown: null,
    detourMinutes: null,
              status: "PENDING",
              passedByMe: false,
              passedByAdultNames: [],
              acceptedByAdultId: null,
              acceptingCircleId: null,
              acceptingCircleName: null,
    legs: carpoolLegsBoth("ASKED_TEAM"),
            },
          ],
        }}
        onAcceptRide={vi.fn()}
        onPassRide={vi.fn()}
        {...noopHandlers}
      />,
    )

    const row = screen.getByTestId("agenda-row-FEED-feed-no-auto-confirm")
    expect(within(row).getByText("1 carpool ask")).toBeInTheDocument()
    await user.click(within(row).getByRole("button", { expanded: false }))
    const inbound = within(row).getByTestId("agenda-band-inbound-requests")
    expect(within(inbound).queryByText("Declined — you needed a ride too")).not.toBeInTheDocument()
    expect(within(inbound).getByRole("button", { name: "Accept" })).toBeInTheDocument()
  })

  it("keeps auto-declined inbound sticky via session ids after own ask ends", async () => {
    const user = userEvent.setup()
    const feedItem = item({
      id: "feed-sticky-decline",
      source: "FEED",
      title: "Practice",
      feedId: "f1",
      feedName: "Soccer",
      eventKey: "UID:practice-sticky",
      uncoveredKidIds: ["k1"],
    })

    render(
      <AgendaRow
        item={feedItem}
        circle={circle}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: ["k1"], soleAdult: true, soleKid: true }}
        autoDeclinedRideIds={new Set(["sticky-ask"])}
        rideEvent={{
          eventKey: "UID:practice-sticky",
          title: "Practice",
          startsAt: feedItem.startsAt,
          endsAt: null,
          defaultKidIds: ["k1"],
          ownLegs: carpoolLegsBoth("NEEDS_RIDE"),
          ownRequest: null,
          ownRequests: [],
          otherRequests: [
            {
              id: "sticky-ask",
              spaceId: "s1",
              eventKey: "UID:practice-sticky",
              requestingCircleId: "c2",
              requestingCircleName: "House B",
              requestedByAdultId: "a2",
              kidIds: ["k2"],
              kidFirstNames: ["Mia"],
              seats: 1,
              pickupPlaceName: "Home",
              pickupAddress: "1 Main",
    pickupTown: null,
    detourMinutes: null,
              status: "PENDING",
              passedByMe: false,
              passedByAdultNames: [],
              acceptedByAdultId: null,
              acceptingCircleId: null,
              acceptingCircleName: null,
    legs: carpoolLegsBoth("ASKED_TEAM"),
            },
          ],
        }}
        onAcceptRide={vi.fn()}
        onPassRide={vi.fn()}
        onCreateRide={vi.fn()}
        {...noopHandlers}
      />,
    )

    const row = screen.getByTestId("agenda-row-FEED-feed-sticky-decline")
    expect(within(row).queryByText("1 carpool ask")).not.toBeInTheDocument()
    await user.click(within(row).getByRole("button", { expanded: false }))
    const inbound = within(row).getByTestId("agenda-band-inbound-requests")
    expect(within(inbound).getByText("Declined — you needed a ride too")).toBeInTheDocument()
    expect(within(inbound).queryByRole("button", { name: "Accept" })).not.toBeInTheDocument()
  })

  it("hides Accept and Pass when the ask is active in the hero queue", async () => {
    const user = userEvent.setup()
    const feedItem = item({
      id: "feed-queued",
      source: "FEED",
      title: "Practice",
      feedId: "f1",
      feedName: "Soccer",
      eventKey: "UID:practice-queued",
    })

    render(
      <AgendaRow
        item={feedItem}
        circle={circle}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: [], soleAdult: true, soleKid: true }}
        heroQueuedRequestIds={new Set(["pending-other"])}
        rideEvent={{
          eventKey: "UID:practice-queued",
          title: "Practice",
          startsAt: feedItem.startsAt,
          endsAt: null,
          defaultKidIds: ["k1"],
          ownLegs: carpoolLegsBoth("NEEDS_RIDE"),
          ownRequest: null,
          ownRequests: [],
          otherRequests: [
            {
              id: "pending-other",
              spaceId: "s1",
              eventKey: "UID:practice-queued",
              requestingCircleId: "c2",
              requestingCircleName: "House B",
              requestedByAdultId: "a2",
              kidIds: ["k2"],
              kidFirstNames: ["Mia"],
              seats: 1,
              pickupPlaceName: "Home",
              pickupAddress: "1 Main",
    pickupTown: null,
    detourMinutes: null,
              status: "PENDING",
              passedByMe: false,
              passedByAdultNames: [],
              acceptedByAdultId: null,
              acceptingCircleId: null,
              acceptingCircleName: null,
    legs: carpoolLegsBoth("ASKED_TEAM"),
            },
          ],
        }}
        onAcceptRide={vi.fn()}
        onPassRide={vi.fn()}
        onCreateRide={vi.fn()}
        onCancelRide={vi.fn()}
        onWithdrawRide={vi.fn()}
        {...noopHandlers}
      />,
    )

    const row = screen.getByTestId("agenda-row-FEED-feed-queued")
    await user.click(within(row).getByRole("button", { expanded: false }))
    const inbound = within(row).getByTestId("agenda-band-inbound-requests")
    expect(within(inbound).getByText("Handle in Needs your attention above")).toBeInTheDocument()
    expect(within(inbound).queryByRole("button", { name: "Accept" })).not.toBeInTheDocument()
    expect(within(inbound).queryByRole("button", { name: "Pass" })).not.toBeInTheDocument()
  })

  it("hides Request when transport is settled and keeps Cancel for own pending ask", async () => {
    const user = userEvent.setup()
    const feedItem = item({
      id: "feed-no-accept",
      source: "FEED",
      title: "Practice",
      feedId: "f1",
      feedName: "Soccer",
      eventKey: "UID:practice-na",
      uncoveredKidIds: [],
    })
    render(
      <AgendaRow
        item={feedItem}
        circle={circle}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: [], soleAdult: true, soleKid: true }}
        rideEvent={{
          eventKey: "UID:practice-na",
          title: "Practice",
          startsAt: feedItem.startsAt,
          endsAt: null,
          defaultKidIds: ["k1"],
          ownLegs: carpoolLegsBoth("CONFIRMED", {
            assigneeAdultId: "a1",
            assigneeDisplayName: "Alex",
          }),
          ownRequest: null,
          ownRequests: [],
          otherRequests: [],
        }}
        onCreateRide={vi.fn()}
        onCancelRide={vi.fn()}
        onWithdrawRide={vi.fn()}
        {...noopHandlers}
      />,
    )

    const row = screen.getByTestId("agenda-row-FEED-feed-no-accept")
    await user.click(within(row).getByRole("button", { expanded: false }))
    expect(within(row).queryByTestId("agenda-band-carpool")).not.toBeInTheDocument()
    expect(within(row).queryByRole("button", { name: "Request" })).not.toBeInTheDocument()
    expect(within(row).queryByTestId("agenda-band-inbound-requests")).not.toBeInTheDocument()
  })

  it("shows per-kid RevertRideLink for confirmed coverage and removes Remove coverage", async () => {
    const user = userEvent.setup()
    const onRemoveCoverage = vi.fn()
    const feedItem = item({
      id: "feed-confirmed",
      source: "FEED",
      title: "Practice",
      feedId: "f1",
      feedName: "Soccer",
      uncoveredKidIds: [],
      coverages: [
        {
          id: "cov1",
          coveringAdultId: "a1",
          coveringAdultDisplayName: "Alex",
          assignedByAdultId: "a1",
          kidIds: ["k1"],
          status: "CONFIRMED",
        leaveFromPlaceId: null,
        leaveFromPlaceName: null,
        leaveFromAddress: null,
        leaveByAt: null,
        leaveByStatus: null,
        leaveByReason: null,
        },
      ],
    })

    render(
      <AgendaRow
        item={feedItem}
        circle={circle}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: [], soleAdult: true, soleKid: true }}
        {...noopHandlers}
        onRemoveCoverage={onRemoveCoverage}
      />,
    )

    const row = screen.getByTestId("agenda-row-FEED-feed-confirmed")
    await user.click(within(row).getByRole("button", { expanded: false }))
    expect(within(row).getByTestId("agenda-override-links")).toBeInTheDocument()
    expect(within(row).queryByRole("button", { name: "Remove coverage" })).not.toBeInTheDocument()
    expect(within(row).queryByTestId("driver-picker")).not.toBeInTheDocument()
    await user.click(within(row).getByTestId("agenda-reassign-link"))
    expect(onRemoveCoverage).toHaveBeenCalledWith("cov1")
  })

  it("hides RevertRideLink for unassigned and pending household confirm", async () => {
    const user = userEvent.setup()
    const gapItem = item({
      id: "gap",
      title: "Practice",
      uncoveredKidIds: ["k1"],
    })
    render(
      <AgendaRow
        item={gapItem}
        circle={circle}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: ["k1"], soleAdult: true, soleKid: true }}
        {...noopHandlers}
      />,
    )
    const gapRow = screen.getByTestId("agenda-row-MANUAL-gap")
    await user.click(within(gapRow).getByRole("button", { expanded: false }))
    expect(within(gapRow).getByTestId("driver-picker")).toBeInTheDocument()
    expect(
      within(gapRow).queryByRole("button", { name: /can't drive anymore|cancel this ask/i }),
    ).not.toBeInTheDocument()
  })

  it("hides RevertRideLink when pending household confirm for viewer", async () => {
    const user = userEvent.setup()
    render(
      <AgendaRow
        item={item({
          id: "pending-self",
          title: "Practice",
          coverages: [
            {
              id: "cov1",
              coveringAdultId: "a1",
              coveringAdultDisplayName: "Alex",
              assignedByAdultId: "a2",
              kidIds: ["k1"],
              status: "PENDING",
            leaveFromPlaceId: null,
            leaveFromPlaceName: null,
            leaveFromAddress: null,
            leaveByAt: null,
            leaveByStatus: null,
            leaveByReason: null,
            },
          ],
        })}
        circle={circle}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: [], soleAdult: true, soleKid: true }}
        {...noopHandlers}
      />,
    )
    const pendingRow = screen.getByTestId("agenda-row-MANUAL-pending-self")
    await user.click(within(pendingRow).getByRole("button", { expanded: false }))
    expect(within(pendingRow).getByRole("button", { name: "Confirm coverage" })).toBeInTheDocument()
    expect(
      within(pendingRow).queryByRole("button", { name: /can't drive anymore|cancel this ask/i }),
    ).not.toBeInTheDocument()
  })

  it("names other household driver on RevertRideLink", async () => {
    const user = userEvent.setup()
    const twoAdults: FamilyCircle = {
      ...circle,
      members: [
        { adultId: "a1", email: "a@example.com", displayName: "Alex", role: "ORGANIZER" },
        { adultId: "a2", email: "j@example.com", displayName: "Jordan", role: "CAREGIVER" },
      ],
    }
    render(
      <AgendaRow
        item={item({
          id: "other-driver",
          title: "Practice",
          uncoveredKidIds: [],
          coverages: [
            {
              id: "cov1",
              coveringAdultId: "a2",
              coveringAdultDisplayName: "Jordan",
              assignedByAdultId: "a1",
              kidIds: ["k1"],
              status: "CONFIRMED",
            leaveFromPlaceId: null,
            leaveFromPlaceName: null,
            leaveFromAddress: null,
            leaveByAt: null,
            leaveByStatus: null,
            leaveByReason: null,
            },
          ],
        })}
        circle={twoAdults}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: [], soleAdult: false, soleKid: true }}
        {...noopHandlers}
      />,
    )
    const row = screen.getByTestId("agenda-row-MANUAL-other-driver")
    await user.click(within(row).getByRole("button", { expanded: false }))
    expect(
      within(row).getByRole("button", {
        name: "Jordan can't drive anymore? Reassign the ride",
      }),
    ).toBeInTheDocument()
  })

  it("matches AgendaBlockCard chip-strip + chevron roles (token classes; no new urgent outline)", () => {
    renderRow(
      item({
        id: "chip-parity",
        title: "Practice",
        uncoveredKidIds: ["k1"],
      }),
    )
    const row = screen.getByTestId("agenda-row-MANUAL-chip-parity")
    const strip = within(row).getByTestId("agenda-row-chip-strip")
    expect(strip.className).toMatch(/shrink-0/)
    expect(strip.className).toMatch(/--fc-space-list-row-tag-gap/)
    expect(strip.className).toMatch(/flex-wrap/)
    expect(strip.className).not.toMatch(/max-\[390px\]:w-full/)
    expect(within(row).getByTestId("agenda-row-header")).toHaveAttribute(
      "aria-expanded",
      "false",
    )
    const chevron = within(row).getByTestId("agenda-row-chevron")
    expect(chevron).toHaveAttribute("aria-label", "Expand Practice")
    expect(chevron.style.minWidth).toBe("var(--fc-space-focus-action-min-height)")
    expect(chevron.style.minHeight).toBe("var(--fc-space-focus-action-min-height)")
    expect(within(row).getByText(RIDE_NEEDED)).toBeInTheDocument()
    // Urgent chip only — no new amber card outline system beyond existing focus ring.
    expect(row.className).not.toMatch(/--fc-danger/)
    expect(row.style.borderColor ?? "").not.toMatch(/danger/)
  })

  it("keeps the existing list-row focus outline when focused", () => {
    render(
      <AgendaRow
        item={item({ id: "focus-outline", title: "Practice", uncoveredKidIds: ["k1"] })}
        circle={circle}
        currentAdultId="a1"
        loading={false}
        isFocused
        assignDraft={{ adultId: "a1", kidIds: ["k1"], soleAdult: true, soleKid: true }}
        {...noopHandlers}
      />,
    )
    const row = screen.getByTestId("agenda-row-MANUAL-focus-outline")
    expect(row).toHaveAttribute("data-focused", "true")
    expect(row.className).toMatch(/--fc-list-row-focus-border/)
    expect(row.style.boxShadow).toContain("--fc-list-row-focus-halo")
  })

  it("wraps collapsed chip tags with the shared strip flex-wrap role", () => {
    render(
      <div style={{ width: "390px" }}>
        <AgendaRow
          item={item({
            id: "narrow-chips",
            title: "Practice",
            uncoveredKidIds: ["k1"],
            conflicts: [
              {
                type: "KID_TIME_OVERLAP",
                kidId: "k1",
                otherKidId: null,
                adultId: null,
                adultDisplayName: null,
                otherSource: "MANUAL",
                otherItemId: "other",
                otherTitle: "Other game",
                otherStartsAt: "2030-08-15T18:00:00.000Z",
              },
            ],
          })}
          circle={circle}
          currentAdultId="a1"
          loading={false}
          assignDraft={{
            adultId: "a1",
            kidIds: ["k1"],
            soleAdult: true,
            soleKid: true,
          }}
          {...noopHandlers}
        />
      </div>,
    )

    const strip = screen.getByTestId("agenda-row-chip-strip")
    expect(strip.className).toMatch(/flex-wrap/)
    expect(strip.className).toMatch(/shrink-0/)
    expect(within(screen.getByTestId("agenda-row-MANUAL-narrow-chips")).getByText("Overlaps")).toBeInTheDocument()
    expect(within(screen.getByTestId("agenda-row-MANUAL-narrow-chips")).getByText(RIDE_NEEDED)).toBeInTheDocument()
  })

  it("renders quieter family conflict lines with conflictFamily tokens", async () => {
    const user = userEvent.setup()
    const familyCircle: FamilyCircle = {
      ...circle,
      kids: [
        { id: "k1", displayName: "Sam" },
        { id: "k2", displayName: "Alex" },
      ],
    }
    render(
      <AgendaRow
        item={item({
          id: "family-conflict",
          title: "Soccer",
          conflicts: [
            {
              type: "FAMILY_TIME_OVERLAP",
              kidId: "k1",
              otherKidId: "k2",
              adultId: null,
              adultDisplayName: null,
              otherSource: "MANUAL",
              otherItemId: "dance",
              otherTitle: "Dance",
              otherStartsAt: "2030-08-15T17:30:00.000Z",
            },
          ],
        })}
        circle={familyCircle}
        currentAdultId="a1"
        loading={false}
        assignDraft={{
          adultId: "a1",
          kidIds: ["k1"],
          soleAdult: true,
          soleKid: true,
        }}
        {...noopHandlers}
      />,
    )

    const row = screen.getByTestId("agenda-row-MANUAL-family-conflict")
    const overlaps = within(row).getByText("Overlaps")
    expect(overlaps.className).toMatch(/--fc-conflict-family/)

    await user.click(within(row).getByRole("button", { expanded: false }))
    const line = within(row).getByText("Sam overlaps Alex's Dance")
    expect(line.className).toMatch(/--fc-conflict-family/)
    expect(line.className).not.toMatch(/--fc-danger/)
  })

  it("shows kid rows on teammate rides and ride-needed gaps (Frame A who line)", () => {
    const feedItem = item({
      id: "feed-accepted",
      source: "FEED",
      title: "Practice",
      feedId: "f1",
      feedName: "Soccer",
      uncoveredKidIds: ["k1"],
    })
    const rideEvent = {
      eventKey: "UID:accepted",
      title: "Practice",
      startsAt: feedItem.startsAt,
      endsAt: null,
      defaultKidIds: [],
      ownLegs: carpoolLegsBoth("NEEDS_RIDE"),
      ownRequest: {
        id: "ride-1",
        spaceId: "s1",
        eventKey: "UID:accepted",
        requestingCircleId: "c1",
        requestingCircleName: "Test",
        requestedByAdultId: "a1",
        kidIds: ["k1"],
        kidFirstNames: ["Sam"],
        seats: 1,
        pickupPlaceName: "Home",
        pickupAddress: "1 Main",
        pickupTown: null,
        detourMinutes: null,
        status: "ACCEPTED" as const,
        passedByMe: false,
        passedByAdultNames: [],
        acceptedByAdultId: "a2",
        acceptingCircleId: "c2",
        acceptingCircleName: "Sharks",
        legs: carpoolLegsBoth("CONFIRMED", {
          assigneeCircleId: "c2",
          assigneeCircleName: "Sharks",
        }),
      },
      ownRequests: [],
      otherRequests: [],
    }

    const { rerender } = render(
      <AgendaRow
        item={feedItem}
        circle={circle}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: [], soleAdult: true, soleKid: true }}
        rideEvent={rideEvent}
        {...noopHandlers}
      />,
    )
    const row = screen.getByTestId("agenda-row-FEED-feed-accepted")
    expect(within(row).queryByTestId("agenda-row-rider-chips")).not.toBeInTheDocument()
    expect(within(row).getByTestId("agenda-row-kid-FEED-feed-accepted-k1")).toHaveTextContent(
      "Sam",
    )
    expect(
      within(row).getByTestId("agenda-row-kid-assignment-FEED-feed-accepted-k1"),
    ).toHaveTextContent("There Sharks · Back Sharks")

    rerender(
      <AgendaRow
        item={item({ id: "gap", title: "Practice", uncoveredKidIds: ["k1"] })}
        circle={circle}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: ["k1"], soleAdult: true, soleKid: true }}
        {...noopHandlers}
      />,
    )
    const gapRow = screen.getByTestId("agenda-row-MANUAL-gap")
    expect(within(gapRow).getByText("Ride needed")).toBeInTheDocument()
    expect(within(gapRow).queryByTestId("agenda-row-rider-chips")).not.toBeInTheDocument()
    expect(within(gapRow).getByTestId("agenda-row-kid-MANUAL-gap-k1")).toHaveTextContent("Sam")
    expect(
      within(gapRow).getByTestId("agenda-row-kid-assignment-MANUAL-gap-k1"),
    ).toHaveTextContent("There Needs ride · Back Needs ride")
  })

  it("uses collapsed kid rows below the header for confirmed drivers", () => {
    renderRow(
      item({
        id: "covered",
        title: "Practice",
        coverages: [
          {
            id: "cov1",
            coveringAdultId: "a1",
            coveringAdultDisplayName: "Alex",
            assignedByAdultId: "a1",
            kidIds: ["k1"],
            status: "CONFIRMED",
          leaveFromPlaceId: null,
          leaveFromPlaceName: null,
          leaveFromAddress: null,
          leaveByAt: null,
          leaveByStatus: null,
          leaveByReason: null,
          },
        ],
      }),
    )
    const row = screen.getByTestId("agenda-row-MANUAL-covered")
    expect(within(row).queryByTestId("agenda-row-rider-chips")).not.toBeInTheDocument()
    const kidRow = within(row).getByTestId("agenda-row-kid-MANUAL-covered-k1")
    expect(within(kidRow).getByText("S")).toBeInTheDocument()
    expect(kidRow).toHaveTextContent("Sam")
    expect(
      within(row).getByTestId("agenda-row-kid-assignment-MANUAL-covered-k1"),
    ).toHaveTextContent("There You · Back You")
  })

  it("lists both circle kids on a collapsed row when they share a confirmed driver", () => {
    const twoKids: FamilyCircle = {
      ...circle,
      kids: [
        { id: "k1", displayName: "Sam" },
        { id: "k2", displayName: "Riley" },
      ],
    }
    render(
      <AgendaRow
        item={item({
          id: "shared-driver",
          title: "Practice",
          kidIds: ["k1", "k2"],
          uncoveredKidIds: [],
          coverages: [
            {
              id: "cov1",
              coveringAdultId: "a1",
              coveringAdultDisplayName: "Alex",
              assignedByAdultId: "a1",
              kidIds: ["k1", "k2"],
              status: "CONFIRMED",
            leaveFromPlaceId: null,
            leaveFromPlaceName: null,
            leaveFromAddress: null,
            leaveByAt: null,
            leaveByStatus: null,
            leaveByReason: null,
            },
          ],
        })}
        circle={twoKids}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: [], soleAdult: true, soleKid: false }}
        {...noopHandlers}
      />,
    )
    const row = screen.getByTestId("agenda-row-MANUAL-shared-driver")
    expect(within(row).queryByTestId("agenda-row-rider-chips")).not.toBeInTheDocument()
    expect(within(row).getByTestId("agenda-row-kid-rows").children).toHaveLength(2)
    expect(within(row).getByTestId("agenda-row-kid-MANUAL-shared-driver-k1")).toHaveTextContent(
      "Sam",
    )
    expect(within(row).getByTestId("agenda-row-kid-MANUAL-shared-driver-k2")).toHaveTextContent(
      "Riley",
    )
  })

  it("shows kid-row who lines for asked-team and pending; omits rows when not going", () => {
    const twoKids: FamilyCircle = {
      ...circle,
      kids: [
        { id: "k1", displayName: "Sam" },
        { id: "k2", displayName: "Riley" },
      ],
    }
    const feedItem = item({
      id: "feed-asked",
      source: "FEED",
      title: "Practice",
      feedId: "f1",
      feedName: "Soccer",
      kidIds: ["k1"],
      uncoveredKidIds: ["k1"],
    })
    const askedEvent = {
      eventKey: "UID:asked",
      title: "Practice",
      startsAt: feedItem.startsAt,
      endsAt: null,
      defaultKidIds: ["k1"],
      ownLegs: carpoolLegsBoth("NEEDS_RIDE"),
      ownRequest: {
        id: "ride-1",
        spaceId: "s1",
        eventKey: "UID:asked",
        requestingCircleId: "c1",
        requestingCircleName: "Test",
        requestedByAdultId: "a1",
        kidIds: ["k1"],
        kidFirstNames: ["Sam"],
        seats: 1,
        pickupPlaceName: "Home",
        pickupAddress: "1 Main",
        pickupTown: null,
        detourMinutes: null,
        status: "PENDING" as const,
        passedByMe: false,
        passedByAdultNames: [],
        acceptedByAdultId: null,
        acceptingCircleId: null,
        acceptingCircleName: null,
        legs: carpoolLegsBoth("ASKED_TEAM"),
      },
      ownRequests: [],
      otherRequests: [],
    }

    const { rerender } = render(
      <AgendaRow
        item={feedItem}
        circle={twoKids}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: ["k1"], soleAdult: true, soleKid: true }}
        rideEvent={askedEvent}
        onCreateRide={vi.fn()}
        {...noopHandlers}
      />,
    )
    const askedRow = screen.getByTestId("agenda-row-FEED-feed-asked")
    expect(within(askedRow).getByText("Asked team")).toBeInTheDocument()
    expect(within(askedRow).queryByText(/Getting there:/)).not.toBeInTheDocument()
    expect(within(askedRow).queryByText(/Coming back:/)).not.toBeInTheDocument()
    expect(within(askedRow).queryByTestId("agenda-row-rider-chips")).not.toBeInTheDocument()
    expect(
      within(askedRow).getByTestId("agenda-row-kid-assignment-FEED-feed-asked-k1"),
    ).toHaveTextContent("There Asked team · Back Asked team")

    rerender(
      <AgendaRow
        item={item({
          id: "pending",
          title: "Practice",
          coverages: [
            {
              id: "cov1",
              coveringAdultId: "a1",
              coveringAdultDisplayName: "Alex",
              assignedByAdultId: "a2",
              kidIds: ["k1"],
              status: "PENDING",
            leaveFromPlaceId: null,
            leaveFromPlaceName: null,
            leaveFromAddress: null,
            leaveByAt: null,
            leaveByStatus: null,
            leaveByReason: null,
            },
          ],
        })}
        circle={twoKids}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: [], soleAdult: true, soleKid: true }}
        {...noopHandlers}
      />,
    )
    const pendingRow = screen.getByTestId("agenda-row-MANUAL-pending")
    expect(within(pendingRow).getByText("Confirm you'll drive")).toBeInTheDocument()
    expect(within(pendingRow).queryByTestId("agenda-row-rider-chips")).not.toBeInTheDocument()
    expect(
      within(pendingRow).getByTestId("agenda-row-kid-assignment-MANUAL-pending-k1"),
    ).toHaveTextContent("There You · Back You")

    rerender(
      <AgendaRow
        item={item({
          id: "skip",
          title: "Skip practice",
          rsvps: [{ kidId: "k1", status: "NO" }],
        })}
        circle={twoKids}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: [], soleAdult: true, soleKid: true }}
        {...noopHandlers}
      />,
    )
    const outRow = screen.getByTestId("agenda-row-MANUAL-skip")
    expect(within(outRow).getByText("Not going")).toBeInTheDocument()
    expect(within(outRow).queryByTestId("agenda-row-rider-chips")).not.toBeInTheDocument()
    expect(within(outRow).queryByTestId("agenda-row-kid-rows")).not.toBeInTheDocument()
  })

  it("shows Type A ride-commitment callout above kid and inbound bands when expanded", async () => {
    const user = userEvent.setup()
    const onWithdrawRide = vi.fn()
    const feedItem = item({
      id: "feed-type-a",
      source: "FEED",
      title: "Practice",
      feedId: "f1",
      feedName: "Soccer",
      eventKey: "UID:type-a",
      uncoveredKidIds: ["k1"],
      conflicts: [
        {
          type: "KID_TIME_OVERLAP",
          kidId: "k1",
          otherKidId: null,
          adultId: null,
          adultDisplayName: null,
          otherSource: "MANUAL",
          otherItemId: "other",
          otherTitle: "Other",
          otherStartsAt: "2030-08-15T18:00:00.000Z",
        },
      ],
    })
    const rideEvent = {
      eventKey: "UID:type-a",
      title: "Practice",
      startsAt: feedItem.startsAt,
      endsAt: null,
      defaultKidIds: ["k1"],
      ownLegs: carpoolLegsBoth("NEEDS_RIDE"),
      ownRequest: null,
      ownRequests: [],
      otherRequests: [
        {
          id: "ask-accepted",
          spaceId: "s1",
          eventKey: "UID:type-a",
          requestingCircleId: "c2",
          requestingCircleName: "House B",
          requestedByAdultId: "a2",
          kidIds: ["k-them"],
          kidFirstNames: ["Mia"],
          seats: 1,
          pickupPlaceName: "Home",
          pickupAddress: "1 Main",
          pickupTown: null,
          detourMinutes: null,
          status: "ACCEPTED" as const,
          passedByMe: false,
          passedByAdultNames: [],
          acceptedByAdultId: "a1",
          acceptingCircleId: "c1",
          acceptingCircleName: "Test",
    legs: carpoolLegsBoth("ASKED_TEAM"),
        },
      ],
    }

    render(
      <AgendaRow
        item={feedItem}
        circle={circle}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: ["k1"], soleAdult: true, soleKid: true }}
        rideEvent={rideEvent}
        onWithdrawRide={onWithdrawRide}
        {...noopHandlers}
      />,
    )

    const row = screen.getByTestId("agenda-row-FEED-feed-type-a")
    const chipStrip = within(row).getByTestId("agenda-row-chip-strip")
    const chipLabels = within(chipStrip)
      .getAllByText(/Overlaps|Also driving Mia|Ride needed/)
      .map((node) => node.textContent)
    expect(chipLabels).toEqual(["Overlaps", alsoDrivingKidLabel("Mia"), RIDE_NEEDED])
    expect(within(row).queryByTestId("agenda-ride-conflict-FEED-feed-type-a")).not.toBeInTheDocument()
    await user.click(within(row).getByRole("button", { expanded: false }))
    expect(within(row).getByTestId("agenda-ride-conflict-FEED-feed-type-a")).toHaveTextContent(
      "You're driving Mia but Sam still need a ride.",
    )
    expect(within(row).getByTestId("agenda-band-kids")).toBeInTheDocument()
    const inbound = within(row).getByTestId("agenda-band-inbound-requests")
    expect(
      within(inbound).getByRole("button", { name: "Can't take them anymore" }),
    ).toBeInTheDocument()
  })

  it("shows Type B mutual-swap callout when expanded", async () => {
    const user = userEvent.setup()
    const feedItem = item({
      id: "feed-type-b",
      source: "FEED",
      title: "Practice",
      feedId: "f1",
      feedName: "Soccer",
      eventKey: "UID:type-b",
      uncoveredKidIds: [],
    })
    const rideEvent = {
      eventKey: "UID:type-b",
      title: "Practice",
      startsAt: feedItem.startsAt,
      endsAt: null,
      defaultKidIds: [],
      ownLegs: carpoolLegsBoth("NEEDS_RIDE"),
      ownRequest: {
        id: "own-accepted",
        spaceId: "s1",
        eventKey: "UID:type-b",
        requestingCircleId: "c1",
        requestingCircleName: "Test",
        requestedByAdultId: "a1",
        kidIds: ["k1"],
        kidFirstNames: ["Sam"],
        seats: 1,
        pickupPlaceName: "Home",
        pickupAddress: "1 Main",
        pickupTown: null,
        detourMinutes: null,
        status: "ACCEPTED" as const,
        passedByMe: false,
        passedByAdultNames: [],
        acceptedByAdultId: "a2",
        acceptingCircleId: "c2",
        acceptingCircleName: "House B",
    legs: carpoolLegsBoth("CONFIRMED"),
      },
      ownRequests: [],
      otherRequests: [
        {
          id: "ask-accepted",
          spaceId: "s1",
          eventKey: "UID:type-b",
          requestingCircleId: "c2",
          requestingCircleName: "House B",
          requestedByAdultId: "a2",
          kidIds: ["k-them"],
          kidFirstNames: ["Mia"],
          seats: 1,
          pickupPlaceName: "Home",
          pickupAddress: "1 Main",
          pickupTown: null,
          detourMinutes: null,
          status: "ACCEPTED" as const,
          passedByMe: false,
          passedByAdultNames: [],
          acceptedByAdultId: "a1",
          acceptingCircleId: "c1",
          acceptingCircleName: "Test",
    legs: carpoolLegsBoth("ASKED_TEAM"),
        },
      ],
    }

    render(
      <AgendaRow
        item={feedItem}
        circle={circle}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: [], soleAdult: true, soleKid: true }}
        rideEvent={rideEvent}
        onWithdrawRide={vi.fn()}
        onCancelRide={vi.fn()}
        {...noopHandlers}
      />,
    )

    const row = screen.getByTestId("agenda-row-FEED-feed-type-b")
    const chipStrip = within(row).getByTestId("agenda-row-chip-strip")
    expect(within(chipStrip).getByText(RIDE_CONFLICT_CHIP)).toBeInTheDocument()
    expect(within(chipStrip).getByText("House B confirmed")).toBeInTheDocument()
    expect(within(chipStrip).queryByText(/Getting there:/)).not.toBeInTheDocument()
    expect(within(chipStrip).queryByText(/Coming back:/)).not.toBeInTheDocument()
    await user.click(within(row).getByRole("button", { expanded: false }))
    expect(within(row).getByTestId("agenda-ride-conflict-FEED-feed-type-b")).toHaveTextContent(
      "You're driving Mia and Sam rides with them — pick one plan.",
    )
    expect(
      within(row).getByRole("button", { name: "Can't take them anymore" }),
    ).toBeInTheDocument()
  })

  it("shows route affordances only when canRoute and onOpenRide is provided", async () => {
    const user = userEvent.setup()
    const onOpenRide = vi.fn()
    const confirmedItem = item({
      id: "routable",
      title: "Game",
      coverages: [
        {
          id: "cov1",
          coveringAdultId: "a1",
          coveringAdultDisplayName: "Alex",
          assignedByAdultId: "a1",
          kidIds: ["k1"],
          status: "CONFIRMED",
        leaveFromPlaceId: null,
        leaveFromPlaceName: null,
        leaveFromAddress: null,
        leaveByAt: null,
        leaveByStatus: null,
        leaveByReason: null,
        },
      ],
    })

    render(
      <AgendaRow
        item={confirmedItem}
        circle={circle}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: [], soleAdult: true, soleKid: true }}
        onOpenRide={onOpenRide}
        {...noopHandlers}
      />,
    )

    const row = screen.getByTestId("agenda-row-MANUAL-routable")
    const collapsed = within(row).getByTestId("agenda-row-open-ride")
    expect(collapsed).toHaveAttribute("aria-label", "Route for this ride")
    await user.click(collapsed)
    expect(onOpenRide).toHaveBeenCalledTimes(1)
    // Collapsed control must not toggle expand.
    expect(within(row).queryByTestId("agenda-row-open-ride-cta")).not.toBeInTheDocument()

    await user.click(within(row).getByRole("button", { expanded: false }))
    const cta = within(row).getByTestId("agenda-row-open-ride-cta")
    expect(cta).toHaveTextContent("View route")
    expect(cta.className).toMatch(/--fc-font-list-row-meta-size/)
    expect(cta.className).not.toMatch(/--fc-accent/)
    await user.click(cta)
    expect(onOpenRide).toHaveBeenCalledTimes(2)
  })

  it("hides route affordances for unassigned, not-going, and missing onOpenRide", async () => {
    const user = userEvent.setup()
    const onOpenRide = vi.fn()

    const { unmount } = render(
      <AgendaRow
        item={item({
          id: "gap",
          title: "Practice",
          uncoveredKidIds: ["k1"],
        })}
        circle={circle}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: ["k1"], soleAdult: true, soleKid: true }}
        rideEvent={{
          eventKey: "UID:gap",
          title: "Practice",
          startsAt: "2030-08-15T17:00:00.000Z",
          endsAt: null,
          defaultKidIds: ["k1"],
          ownLegs: carpoolLegsBoth("NEEDS_RIDE"),

          ownRequest: null,
          ownRequests: [],
          otherRequests: [],
        }}
        onOpenRide={onOpenRide}
        {...noopHandlers}
      />,
    )
    const gapRow = screen.getByTestId("agenda-row-MANUAL-gap")
    expect(within(gapRow).queryByTestId("agenda-row-open-ride")).not.toBeInTheDocument()
    await user.click(within(gapRow).getByRole("button", { expanded: false }))
    expect(within(gapRow).queryByTestId("agenda-row-open-ride-cta")).not.toBeInTheDocument()
    unmount()

    const { unmount: unmountSkip } = render(
      <AgendaRow
        item={item({
          id: "skip",
          title: "Game",
          coverages: [
            {
              id: "cov1",
              coveringAdultId: "a1",
              coveringAdultDisplayName: "Alex",
              assignedByAdultId: "a1",
              kidIds: ["k1"],
              status: "CONFIRMED",
            leaveFromPlaceId: null,
            leaveFromPlaceName: null,
            leaveFromAddress: null,
            leaveByAt: null,
            leaveByStatus: null,
            leaveByReason: null,
            },
          ],
          rsvps: [{ kidId: "k1", status: "NO" }],
        })}
        circle={circle}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: [], soleAdult: true, soleKid: true }}
        onOpenRide={onOpenRide}
        {...noopHandlers}
      />,
    )
    expect(
      within(screen.getByTestId("agenda-row-MANUAL-skip")).queryByTestId(
        "agenda-row-open-ride",
      ),
    ).not.toBeInTheDocument()
    unmountSkip()

    render(
      <AgendaRow
        item={item({
          id: "routable",
          title: "Game",
          coverages: [
            {
              id: "cov1",
              coveringAdultId: "a1",
              coveringAdultDisplayName: "Alex",
              assignedByAdultId: "a1",
              kidIds: ["k1"],
              status: "CONFIRMED",
            leaveFromPlaceId: null,
            leaveFromPlaceName: null,
            leaveFromAddress: null,
            leaveByAt: null,
            leaveByStatus: null,
            leaveByReason: null,
            },
          ],
        })}
        circle={circle}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: [], soleAdult: true, soleKid: true }}
        {...noopHandlers}
      />,
    )
    expect(
      within(screen.getByTestId("agenda-row-MANUAL-routable")).queryByTestId(
        "agenda-row-open-ride",
      ),
    ).not.toBeInTheDocument()
  })

  it("shows route affordances when a teammate ACCEPTED own-request covers the kid", async () => {
    const user = userEvent.setup()
    const onOpenRide = vi.fn()
    render(
      <AgendaRow
        item={item({ id: "teammate", title: "Game" })}
        circle={circle}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: [], soleAdult: true, soleKid: true }}
        rideEvent={{
          eventKey: "UID:game",
          title: "Game",
          startsAt: "2030-08-15T17:00:00.000Z",
          endsAt: null,
          defaultKidIds: ["k1"],
          ownLegs: carpoolLegsBoth("NEEDS_RIDE"),
          ownRequest: {
            id: "own",
            spaceId: "s1",
            eventKey: "UID:game",
            requestingCircleId: "c1",
            requestingCircleName: "Ours",
            requestedByAdultId: "a1",
            kidIds: ["k1"],
            kidFirstNames: ["Sam"],
            seats: 1,
            pickupPlaceName: "Home",
            pickupAddress: "1 Main",
            pickupTown: null,
            detourMinutes: null,
            status: "ACCEPTED",
            passedByMe: false,
            passedByAdultNames: [],
            acceptedByAdultId: "a9",
            acceptingCircleId: "c9",
            acceptingCircleName: "The Patels",
    legs: carpoolLegsBoth("ASKED_TEAM"),
          },
          ownRequests: [],
          otherRequests: [],
        }}
        onOpenRide={onOpenRide}
        {...noopHandlers}
      />,
    )
    const row = screen.getByTestId("agenda-row-MANUAL-teammate")
    expect(within(row).getByTestId("agenda-row-open-ride")).toBeInTheDocument()
    await user.click(within(row).getByRole("button", { expanded: false }))
    expect(within(row).getByTestId("agenda-row-open-ride-cta")).toBeInTheDocument()
  })

  it("shows Different plans for each kid on expanded uncovered DriverPicker", async () => {
    const user = userEvent.setup()
    const onSaveKidPlans = vi.fn()
    const twoKidCircle: FamilyCircle = {
      ...circle,
      kids: [
        { id: "k1", displayName: "Sam" },
        { id: "k2", displayName: "Mia" },
      ],
    }
    const feedItem = item({
      id: "feed-kid-split",
      source: "FEED",
      title: "Practice",
      feedId: "f1",
      feedName: "Soccer",
      kidIds: ["k1", "k2"],
      uncoveredKidIds: ["k1", "k2"],
      rsvps: [
        { kidId: "k1", status: "YES" },
        { kidId: "k2", status: "YES" },
      ],
    })
    const rideEvent = {
      eventKey: "UID:kid-split",
      title: "Practice",
      startsAt: feedItem.startsAt,
      endsAt: null,
      defaultKidIds: ["k1", "k2"],
      ownLegs: carpoolLegsBoth("NEEDS_RIDE"),
      ownRequest: null,
      ownRequests: [],
      otherRequests: [],
    }

    render(
      <AgendaRow
        item={feedItem}
        circle={twoKidCircle}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: ["k1", "k2"], soleAdult: true, soleKid: false }}
        rideEvent={rideEvent}
        onCreateRide={vi.fn()}
        onCancelRide={vi.fn()}
        onSaveKidPlans={onSaveKidPlans}
        {...noopHandlers}
      />,
    )

    const row = screen.getByTestId("agenda-row-FEED-feed-kid-split")
    await user.click(within(row).getByRole("button", { expanded: false }))
    expect(within(row).getByTestId("driver-picker-different-plans-kid")).toBeInTheDocument()
    // One shared picker for the event — not one per kid row.
    expect(within(row).getAllByTestId("driver-picker")).toHaveLength(1)
    await user.click(within(row).getByTestId("driver-picker-different-plans-kid"))
    expect(within(row).getByTestId("driver-picker")).toHaveAttribute("data-mode", "kid-split")
    expect(within(row).getByTestId("driver-picker-kid-header-k1")).toHaveTextContent("Sam")
    expect(within(row).getByTestId("driver-picker-kid-header-k2")).toHaveTextContent("Mia")
  })

  it("Confirms shared round-trip for all going kids with one click", async () => {
    const user = userEvent.setup()
    const onAssignCoverage = vi.fn()
    const twoKidCircle: FamilyCircle = {
      ...circle,
      kids: [
        { id: "k1", displayName: "Sam" },
        { id: "k2", displayName: "Mia" },
      ],
    }
    const feedItem = item({
      id: "feed-shared-confirm",
      source: "FEED",
      title: "Practice",
      feedId: "f1",
      feedName: "Soccer",
      kidIds: ["k1", "k2"],
      uncoveredKidIds: ["k1", "k2"],
      rsvps: [
        { kidId: "k1", status: "YES" },
        { kidId: "k2", status: "YES" },
      ],
    })

    render(
      <AgendaRow
        item={feedItem}
        circle={twoKidCircle}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: ["k1", "k2"], soleAdult: true, soleKid: false }}
        rideEvent={{
          eventKey: "UID:shared",
          title: "Practice",
          startsAt: feedItem.startsAt,
          endsAt: null,
          defaultKidIds: ["k1", "k2"],
          ownLegs: carpoolLegsBoth("NEEDS_RIDE"),
          ownRequest: null,
          ownRequests: [],
          otherRequests: [],
        }}
        onCreateRide={vi.fn()}
        {...noopHandlers}
        onAssignCoverage={onAssignCoverage}
      />,
    )

    const row = screen.getByTestId("agenda-row-FEED-feed-shared-confirm")
    await user.click(within(row).getByRole("button", { expanded: false }))
    await user.click(within(row).getByTestId("driver-picker-confirm"))
    expect(onAssignCoverage).toHaveBeenCalledWith("a1", ["k1", "k2"])
  })

  it("marks every going kid not attending with one click", async () => {
    const user = userEvent.setup()
    const onSetNotGoing = vi.fn()
    const twoKidCircle: FamilyCircle = {
      ...circle,
      kids: [
        { id: "k1", displayName: "Graham" },
        { id: "k2", displayName: "Luke" },
      ],
    }
    const feedItem = item({
      id: "feed-not-going-all",
      source: "FEED",
      title: "Practice",
      feedId: "f1",
      feedName: "Soccer",
      kidIds: ["k1", "k2"],
      uncoveredKidIds: ["k1", "k2"],
      rsvps: [
        { kidId: "k1", status: "YES" },
        { kidId: "k2", status: "YES" },
      ],
    })

    render(
      <AgendaRow
        item={feedItem}
        circle={twoKidCircle}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: ["k1", "k2"], soleAdult: true, soleKid: false }}
        {...noopHandlers}
        onSetNotGoing={onSetNotGoing}
      />,
    )

    const row = screen.getByTestId("agenda-row-FEED-feed-not-going-all")
    await user.click(within(row).getByRole("button", { expanded: false }))
    expect(within(row).queryByRole("button", { name: "Mark Graham as not going" })).not.toBeInTheDocument()
    expect(within(row).queryByRole("button", { name: "Mark Luke as not going" })).not.toBeInTheDocument()
    await user.click(within(row).getByRole("button", { name: "Mark Graham and Luke as not going" }))
    expect(onSetNotGoing).toHaveBeenCalledWith(["k1", "k2"])
  })

  it("marks every covered twin not attending from override links", async () => {
    const user = userEvent.setup()
    const onSetNotGoing = vi.fn()
    const twoKidCircle: FamilyCircle = {
      ...circle,
      kids: [
        { id: "k1", displayName: "Graham" },
        { id: "k2", displayName: "Luke" },
      ],
    }
    const feedItem = item({
      id: "feed-covered-twins",
      source: "FEED",
      title: "Practice",
      feedId: "f1",
      feedName: "Soccer",
      kidIds: ["k1", "k2"],
      uncoveredKidIds: [],
      rsvps: [
        { kidId: "k1", status: "YES" },
        { kidId: "k2", status: "YES" },
      ],
      coverages: [
        {
          id: "cov1",
          coveringAdultId: "a1",
          coveringAdultDisplayName: "Alex",
          assignedByAdultId: "a1",
          kidIds: ["k1", "k2"],
          status: "CONFIRMED",
          leaveFromPlaceId: null,
          leaveFromPlaceName: null,
          leaveFromAddress: null,
          leaveByAt: null,
          leaveByStatus: null,
          leaveByReason: null,
        },
      ],
    })

    render(
      <AgendaRow
        item={feedItem}
        circle={twoKidCircle}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: ["k1", "k2"], soleAdult: true, soleKid: false }}
        {...noopHandlers}
        onSetNotGoing={onSetNotGoing}
      />,
    )

    const row = screen.getByTestId("agenda-row-FEED-feed-covered-twins")
    await user.click(within(row).getByRole("button", { expanded: false }))
    expect(within(row).getByTestId("agenda-override-links")).toBeInTheDocument()
    expect(within(row).queryByRole("button", { name: "Mark Graham as not going" })).not.toBeInTheDocument()
    expect(within(row).queryByRole("button", { name: "Mark Luke as not going" })).not.toBeInTheDocument()
    await user.click(within(row).getByRole("button", { name: "Mark Graham and Luke as not going" }))
    expect(onSetNotGoing).toHaveBeenCalledWith(["k1", "k2"])
  })

  it("shows Combine these on AgendaRow for non-combined driveBlockLinks only", async () => {
    const user = userEvent.setup()
    const onDriveBlockLink = vi.fn()
    const feedItem = item({
      id: "drive-a",
      source: "FEED",
      title: "Practice A",
      feedId: "f1",
      feedName: "U12",
      eventKey: "UID:a",
      driveBlockLinks: [
        {
          leg: "TO",
          otherSource: "FEED",
          otherId: "drive-b",
          otherTitle: "Practice B",
          otherStartsAt: "2030-08-15T18:00:00.000Z",
          combined: true,
          overrideAction: null,
        },
        {
          leg: "TO",
          otherSource: "FEED",
          otherId: "drive-c",
          otherTitle: "Earlier skate",
          otherStartsAt: "2030-08-15T16:00:00.000Z",
          combined: false,
          overrideAction: "FORCE_SPLIT",
        },
      ],
    })

    render(
      <AgendaRow
        item={feedItem}
        circle={circle}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: [], soleAdult: true, soleKid: true }}
        onDriveBlockLink={onDriveBlockLink}
        {...noopHandlers}
      />,
    )

    const row = screen.getByTestId("agenda-row-FEED-drive-a")
    await user.click(within(row).getByRole("button", { expanded: false }))
    const links = within(row).getByTestId("agenda-drive-block-links")
    expect(
      within(links).queryByRole("button", { name: /Split this out/ }),
    ).not.toBeInTheDocument()
    const combine = within(links).getByRole("button", { name: /Combine these/ })
    expect(combine).toHaveAttribute(
      "data-testid",
      "agenda-drive-block-link-TO-drive-c",
    )
    await user.click(combine)
    expect(onDriveBlockLink).toHaveBeenCalledWith(
      expect.objectContaining({
        otherId: "drive-c",
        combined: false,
        overrideAction: "FORCE_SPLIT",
      }),
    )
  })

  it("does not render combined drive-block split links on AgendaRow", async () => {
    const user = userEvent.setup()
    const feedItem = item({
      id: "drive-a",
      source: "FEED",
      title: "Practice A",
      feedId: "f1",
      feedName: "U12",
      eventKey: "UID:a",
      driveBlockLinks: [
        {
          leg: "TO",
          otherSource: "FEED",
          otherId: "drive-b",
          otherTitle: "Practice B",
          otherStartsAt: "2030-08-15T18:00:00.000Z",
          combined: true,
          overrideAction: null,
        },
      ],
    })

    render(
      <AgendaRow
        item={feedItem}
        circle={circle}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: [], soleAdult: true, soleKid: true }}
        onDriveBlockLink={vi.fn()}
        {...noopHandlers}
      />,
    )

    const row = screen.getByTestId("agenda-row-FEED-drive-a")
    await user.click(within(row).getByRole("button", { expanded: false }))
    expect(within(row).queryByTestId("agenda-drive-block-links")).not.toBeInTheDocument()
    expect(
      within(row).queryByRole("button", { name: /Split this out|Combine these/ }),
    ).not.toBeInTheDocument()
  })

  it("offers Lock checkbox on DriverPicker when eligible FEED has a gap", async () => {
    const user = userEvent.setup()
    const onAssignCoverage = vi.fn()
    const feedItem = item({
      id: "eligible",
      source: "FEED",
      title: "Practice",
      feedId: "f1",
      feedName: "U12",
      eventKey: "UID:eligible",
      standingLockEligible: true,
      uncoveredKidIds: ["k1"],
      kidIds: ["k1"],
    })

    renderRow(feedItem, {
      onAssignCoverage,
      onCreateRide: vi.fn(),
      rideEvent: {
        eventKey: "UID:eligible",
        title: "Practice",
        startsAt: feedItem.startsAt,
        endsAt: null,
        defaultKidIds: ["k1"],
        ownRequest: null,
        ownRequests: [],
        ownLegs: carpoolLegsBoth("NEEDS_RIDE"),
        otherRequests: [],
      },
    })

    const row = screen.getByTestId("agenda-row-FEED-eligible")
    await user.click(within(row).getByRole("button", { expanded: false }))
    expect(
      within(row).queryByTestId("agenda-row-lock-standing"),
    ).not.toBeInTheDocument()
    expect(
      within(row).queryByText("Lock this plan"),
    ).not.toBeInTheDocument()
    const checkbox = within(row).getByTestId("driver-picker-lock-standing-checkbox")
    expect(checkbox).not.toBeChecked()
    expect(
      within(row).getByRole("button", {
        name: /Confirm — You'll drive round trip/,
      }),
    ).toBeInTheDocument()
    await user.click(checkbox)
    expect(
      within(row).getByRole("button", { name: /Confirm and lock for/ }),
    ).toBeInTheDocument()
    await user.click(
      within(row).getByRole("button", { name: /Confirm and lock for/ }),
    )
    expect(onAssignCoverage).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Array),
      { lockStanding: true },
    )
  })

  it("hides Lock checkbox when not standingLockEligible", async () => {
    const user = userEvent.setup()
    renderRow(
      item({
        id: "one-off",
        source: "FEED",
        title: "Practice",
        feedId: "f1",
        feedName: "U12",
        eventKey: "UID:one-off",
        standingLockEligible: false,
        uncoveredKidIds: ["k1"],
        kidIds: ["k1"],
      }),
      {
        onCreateRide: vi.fn(),
        rideEvent: {
          eventKey: "UID:one-off",
          title: "Practice",
          startsAt: "2030-08-15T17:00:00.000Z",
          endsAt: null,
          defaultKidIds: ["k1"],
          ownRequest: null,
          ownRequests: [],
          ownLegs: carpoolLegsBoth("NEEDS_RIDE"),
          otherRequests: [],
        },
      },
    )

    const row = screen.getByTestId("agenda-row-FEED-one-off")
    await user.click(within(row).getByRole("button", { expanded: false }))
    expect(
      within(row).queryByTestId("driver-picker-lock-standing"),
    ).not.toBeInTheDocument()
  })

  it("shows locked summary; Edit reveals Different plans without calling Remove", async () => {
    const user = userEvent.setup()
    const onRemoveStandingBlock = vi.fn()
    const onSetNotGoing = vi.fn()
    const onSaveRidePlan = vi.fn()
    renderRow(
      item({
        id: "locked",
        source: "FEED",
        title: "Practice",
        feedId: "f1",
        feedName: "U12",
        eventKey: "UID:locked",
        standingLocked: true,
        standingBlockTemplateId: "tmpl-9",
        uncoveredKidIds: [],
        coverages: [
          {
            id: "cov1",
            coveringAdultId: "a1",
            coveringAdultDisplayName: "Alex",
            assignedByAdultId: "a1",
            kidIds: ["k1"],
            status: "CONFIRMED",
            leaveFromPlaceId: null,
            leaveFromPlaceName: null,
            leaveFromAddress: null,
            leaveByAt: null,
            leaveByStatus: null,
            leaveByReason: null,
          },
        ],
      }),
      {
        onRemoveStandingBlock,
        onSetNotGoing,
        onSaveRidePlan,
        rideEvent: {
          eventKey: "UID:locked",
          title: "Practice",
          startsAt: "2030-08-15T17:00:00.000Z",
          endsAt: null,
          defaultKidIds: ["k1"],
          ownRequest: null,
          ownRequests: [],
          ownLegs: carpoolLegsBoth("CONFIRMED", {
            assigneeAdultId: "a1",
            assigneeDisplayName: "Alex",
          }),
          otherRequests: [],
        },
      },
    )

    const row = screen.getByTestId("agenda-row-FEED-locked")
    expect(
      within(row).queryByTestId("agenda-row-lock-standing"),
    ).not.toBeInTheDocument()
    expect(
      within(row).queryByTestId("agenda-row-standing-locked-title"),
    ).not.toBeInTheDocument()
    expect(within(row).getByTestId("agenda-row-recurrence")).toHaveTextContent(
      /Every/,
    )
    expect(
      within(row).getByTestId("agenda-row-kid-assignment-FEED-locked-k1"),
    ).toHaveTextContent(/There You · Back You/)
    expect(
      within(row).queryByText("Different plans for each leg."),
    ).not.toBeInTheDocument()

    await user.click(within(row).getByRole("button", { expanded: false }))
    expect(within(row).queryByTestId("agenda-row-recurrence")).not.toBeInTheDocument()
    expect(
      within(row).getByTestId("agenda-row-standing-locked-title"),
    ).toHaveTextContent(/Plan locked/)
    expect(within(row).getByTestId("agenda-row-legs-k1")).toHaveTextContent(
      /Getting there/,
    )
    expect(within(row).getByTestId("agenda-row-legs-k1")).toHaveTextContent(
      /Coming back/,
    )

    await user.click(within(row).getByTestId("agenda-row-standing-locked-edit"))
    expect(onRemoveStandingBlock).not.toHaveBeenCalled()
    expect(
      within(row).getByTestId("agenda-row-standing-locked-title"),
    ).toHaveTextContent(/Plan locked/)
    expect(
      within(row).getByTestId("agenda-row-standing-locked-remove"),
    ).toBeInTheDocument()
    expect(
      within(row).getByTestId("agenda-row-standing-locked-done-editing"),
    ).toBeInTheDocument()
    expect(
      within(row).getByTestId("driver-picker"),
    ).toBeInTheDocument()
    expect(within(row).getByTestId("driver-picker")).toHaveAttribute(
      "data-mode",
      "simple",
    )
    expect(
      within(row).getByRole("button", { name: "Save ride plan" }),
    ).toBeInTheDocument()
    expect(
      within(row).getByRole("button", { name: /not going this week/ }),
    ).toBeInTheDocument()
    expect(
      within(row).getByText("Different plans for each leg."),
    ).toBeInTheDocument()

    await user.click(within(row).getByRole("button", { name: "Save ride plan" }))
    expect(onSaveRidePlan).toHaveBeenCalled()

    await user.click(within(row).getByText("Different plans for each leg."))
    expect(
      within(row).getByTestId("agenda-row-standing-locked-title"),
    ).toHaveTextContent(/Plan locked/)
    expect(
      within(row).getByTestId("agenda-row-standing-locked-remove"),
    ).toBeInTheDocument()

    await user.click(within(row).getByTestId("agenda-row-standing-locked-remove"))
    expect(onRemoveStandingBlock).toHaveBeenCalledWith("tmpl-9", "2030-08-15T17:00:00.000Z")
  })

  it("keeps locked Remove visible for split-leg confirmed plans", async () => {
    const user = userEvent.setup()
    const onRemoveStandingBlock = vi.fn()
    renderRow(
      item({
        id: "locked-split",
        source: "FEED",
        title: "Practice",
        feedId: "f1",
        feedName: "U12",
        eventKey: "UID:locked-split",
        standingLocked: true,
        standingBlockTemplateId: "tmpl-split",
        uncoveredKidIds: [],
        coverages: [
          {
            id: "cov1",
            coveringAdultId: "a1",
            coveringAdultDisplayName: "Alex",
            assignedByAdultId: "a1",
            kidIds: ["k1"],
            status: "CONFIRMED",
            leaveFromPlaceId: null,
            leaveFromPlaceName: null,
            leaveFromAddress: null,
            leaveByAt: null,
            leaveByStatus: null,
            leaveByReason: null,
          },
        ],
      }),
      {
        onRemoveStandingBlock,
        rideEvent: {
          eventKey: "UID:locked-split",
          title: "Practice",
          startsAt: "2030-08-15T17:00:00.000Z",
          endsAt: null,
          defaultKidIds: ["k1"],
          ownRequest: null,
          ownRequests: [],
          ownLegs: [
            carpoolLeg("TO", "CONFIRMED", {
              assigneeAdultId: "a1",
              assigneeDisplayName: "Alex",
            }),
            carpoolLeg("FROM", "CONFIRMED", {
              assigneeAdultId: "a2",
              assigneeDisplayName: "Jordan",
            }),
          ],
          otherRequests: [],
        },
      },
    )

    const row = screen.getByTestId("agenda-row-FEED-locked-split")
    expect(
      within(row).queryByTestId("agenda-row-standing-locked-title"),
    ).not.toBeInTheDocument()
    await user.click(within(row).getByRole("button", { expanded: false }))
    expect(
      within(row).getByTestId("agenda-row-standing-locked-title"),
    ).toHaveTextContent(/Plan locked/)
    await user.click(within(row).getByTestId("agenda-row-standing-locked-remove"))
    expect(onRemoveStandingBlock).toHaveBeenCalledWith("tmpl-split", "2030-08-15T17:00:00.000Z")
  })

  it("keeps Remove wired when locked without expanding, and shows action errors", async () => {
    const user = userEvent.setup()
    const onRemoveStandingBlock = vi.fn()
    renderRow(
      item({
        id: "locked-err",
        source: "FEED",
        title: "Practice",
        feedId: "f1",
        feedName: "U12",
        eventKey: "UID:locked-err",
        standingLocked: true,
        standingBlockTemplateId: "tmpl-err",
        uncoveredKidIds: [],
        coverages: [
          {
            id: "cov1",
            coveringAdultId: "a1",
            coveringAdultDisplayName: "Alex",
            assignedByAdultId: "a1",
            kidIds: ["k1"],
            status: "CONFIRMED",
            leaveFromPlaceId: null,
            leaveFromPlaceName: null,
            leaveFromAddress: null,
            leaveByAt: null,
            leaveByStatus: null,
            leaveByReason: null,
          },
        ],
      }),
      {
        onRemoveStandingBlock,
        coverageActionError: "Remove standing block failed",
        rideEvent: {
          eventKey: "UID:locked-err",
          title: "Practice",
          startsAt: "2030-08-15T17:00:00.000Z",
          endsAt: null,
          defaultKidIds: ["k1"],
          ownRequest: null,
          ownRequests: [],
          ownLegs: carpoolLegsBoth("CONFIRMED", {
            assigneeAdultId: "a1",
            assigneeDisplayName: "Alex",
          }),
          otherRequests: [],
        },
      },
    )

    const row = screen.getByTestId("agenda-row-FEED-locked-err")
    expect(
      within(row).queryByTestId("agenda-row-standing-locked-error"),
    ).not.toBeInTheDocument()
    await user.click(within(row).getByRole("button", { expanded: false }))
    expect(
      within(row).getByTestId("agenda-row-standing-locked-error"),
    ).toHaveTextContent(/Remove standing block failed/)
    await user.click(within(row).getByTestId("agenda-row-standing-locked-remove"))
    expect(onRemoveStandingBlock).toHaveBeenCalledWith("tmpl-err", "2030-08-15T17:00:00.000Z")
  })

  it("Frame A: single kid ride-needed kid row + amber Ride needed chip, no RiderChips", () => {
    renderRow(item({ id: "frame-a", title: "Practice", uncoveredKidIds: ["k1"] }))

    const row = screen.getByTestId("agenda-row-MANUAL-frame-a")
    expect(within(row).queryByTestId("agenda-row-rider-chips")).not.toBeInTheDocument()
    expect(within(row).getByTestId("agenda-row-kid-rows").children).toHaveLength(1)
    expect(within(row).getByTestId("agenda-row-kid-MANUAL-frame-a-k1")).toHaveTextContent("Sam")
    expect(
      within(row).getByTestId("agenda-row-kid-assignment-MANUAL-frame-a-k1"),
    ).toHaveTextContent("There Needs ride · Back Needs ride")
    const rideNeeded = within(row).getByText(RIDE_NEEDED)
    expect(rideNeeded.className).toMatch(/--fc-danger/)
  })

  it("Frame D: standing + open Back who line without RiderChips or card-level ↻", () => {
    const openBackLegs = [
      carpoolLeg("TO", "CONFIRMED", {
        assigneeAdultId: "a1",
        assigneeDisplayName: "Alex",
      }),
      carpoolLeg("FROM", "NEEDS_RIDE"),
    ] as const
    const ownPlan = {
      id: "own-frame-d",
      spaceId: "s1",
      eventKey: "UID:frame-d",
      requestingCircleId: "c1",
      requestingCircleName: "Test",
      requestedByAdultId: "a1",
      kidIds: ["k1"],
      kidFirstNames: ["Sam"],
      seats: 1,
      pickupPlaceName: "Home",
      pickupAddress: "1 Main",
      pickupTown: null,
      detourMinutes: null,
      status: "PENDING" as const,
      legs: [...openBackLegs],
      passedByMe: false,
      passedByAdultNames: [],
      acceptedByAdultId: null,
      acceptingCircleId: null,
      acceptingCircleName: null,
    }
    renderRow(
      item({
        id: "frame-d",
        source: "FEED",
        title: "Practice",
        feedId: "f1",
        feedName: "U12",
        eventKey: "UID:frame-d",
        standingLocked: true,
        standingBlockTemplateId: "tmpl-frame-d",
        uncoveredKidIds: ["k1"],
      }),
      {
        rideEvent: {
          eventKey: "UID:frame-d",
          title: "Practice",
          startsAt: "2030-08-15T17:00:00.000Z",
          endsAt: null,
          defaultKidIds: ["k1"],
          ownRequest: ownPlan,
          ownRequests: [ownPlan],
          ownLegs: [...openBackLegs],
          otherRequests: [],
        },
      },
    )

    const row = screen.getByTestId("agenda-row-FEED-frame-d")
    expect(within(row).queryByTestId("agenda-row-rider-chips")).not.toBeInTheDocument()
    expect(within(row).getByTestId("agenda-row-recurrence")).toHaveTextContent(
      /Every/,
    )
    expect(
      within(row).getByTestId("agenda-row-kid-assignment-FEED-frame-d-k1"),
    ).toHaveTextContent("There You · Back Needs ride")
    // Open Back → urgent amber chip (rollup Ride needed or dual-leg Coming back: Needs ride).
    const strip = within(row).getByTestId("agenda-row-chip-strip")
    expect(strip.textContent).toMatch(/Needs ride/i)
    const openLegChip =
      within(strip).queryByText(RIDE_NEEDED) ??
      within(strip).getByText(/Coming back: Needs ride/i)
    expect(openLegChip.className).toMatch(/--fc-danger/)
  })

  it("keeps End standing Ask and standing series hints when expanded", async () => {
    const user = userEvent.setup()
    const onEndStandingRide = vi.fn()
    renderRow(
      item({
        id: "standing-series",
        source: "FEED",
        title: "Practice",
        feedId: "f1",
        feedName: "U12",
        eventKey: "UID:standing-series",
      }),
      {
        standingRideSeries: {
          arrangementId: "arr-1",
          weekdaySingular: "Thursday",
          weekdayPlural: "Thursdays",
          inboundOpen: true,
          ownOpen: true,
          ownActive: false,
          primaryActive: false,
        },
        onEndStandingRide,
      },
    )

    const row = screen.getByTestId("agenda-row-FEED-standing-series")
    expect(
      within(row).getByTestId("agenda-row-standing-ride-inbound"),
    ).toHaveTextContent(/Standing Ask every Thursday/)
    expect(
      within(row).getByTestId("agenda-row-standing-ride-own-open"),
    ).toHaveTextContent(/Standing Ask open — every Thursday/)
    await user.click(within(row).getByRole("button", { expanded: false }))
    expect(
      within(row).getByTestId("agenda-row-standing-ride-series"),
    ).toBeInTheDocument()
    await user.click(
      within(row).getByRole("button", { name: "End standing Ask for Thursdays" }),
    )
    expect(onEndStandingRide).toHaveBeenCalledWith(
      "arr-1",
      "2030-08-15T17:00:00.000Z",
    )
  })

  it("pending self Confirm/Decline call onConfirmCoverage/onDeclineCoverage", async () => {
    const user = userEvent.setup()
    const onConfirmCoverage = vi.fn()
    const onDeclineCoverage = vi.fn()
    renderRow(
      item({
        id: "pending-confirm",
        title: "Practice",
        coverages: [
          {
            id: "cov-pending",
            coveringAdultId: "a1",
            coveringAdultDisplayName: "Alex",
            assignedByAdultId: "a2",
            kidIds: ["k1"],
            status: "PENDING",
            leaveFromPlaceId: null,
            leaveFromPlaceName: null,
            leaveFromAddress: null,
            leaveByAt: null,
            leaveByStatus: null,
            leaveByReason: null,
          },
        ],
      }),
      { onConfirmCoverage, onDeclineCoverage },
    )

    const row = screen.getByTestId("agenda-row-MANUAL-pending-confirm")
    await user.click(within(row).getByRole("button", { expanded: false }))
    await user.click(within(row).getByRole("button", { name: "Confirm coverage" }))
    expect(onConfirmCoverage).toHaveBeenCalledWith("cov-pending")
    await user.click(within(row).getByRole("button", { name: "Decline coverage" }))
    expect(onDeclineCoverage).toHaveBeenCalledWith("cov-pending")
  })

  it("household-plan Confirm/Decline call onConfirmHouseholdPlan/onDeclineHouseholdPlan", async () => {
    const user = userEvent.setup()
    const onConfirmHouseholdPlan = vi.fn()
    const onDeclineHouseholdPlan = vi.fn()
    renderRow(
      item({
        id: "hh-plan",
        source: "FEED",
        title: "Practice",
        feedId: "f1",
        feedName: "U12",
        eventKey: "UID:hh-plan",
        uncoveredKidIds: [],
      }),
      {
        onConfirmHouseholdPlan,
        onDeclineHouseholdPlan,
        rideEvent: {
          eventKey: "UID:hh-plan",
          title: "Practice",
          startsAt: "2030-08-15T17:00:00.000Z",
          endsAt: null,
          defaultKidIds: ["k1"],
          ownRequest: null,
          ownRequests: [],
          ownLegs: carpoolLegsBoth("WAITING_HOUSEHOLD", {
            assigneeAdultId: "a1",
            assigneeDisplayName: "Alex",
          }),
          otherRequests: [],
        },
      },
    )

    const row = screen.getByTestId("agenda-row-FEED-hh-plan")
    await user.click(within(row).getByRole("button", { expanded: false }))
    await user.click(within(row).getByRole("button", { name: "Confirm coverage" }))
    expect(onConfirmHouseholdPlan).toHaveBeenCalledTimes(1)
    await user.click(within(row).getByRole("button", { name: "Decline coverage" }))
    expect(onDeclineHouseholdPlan).toHaveBeenCalledTimes(1)
  })

  it("Reconsider and Undo call onAcceptRide", async () => {
    const user = userEvent.setup()
    const onAcceptRide = vi.fn()
    const confirmedCoverage = {
      id: "cov-confirmed",
      coveringAdultId: "a1",
      coveringAdultDisplayName: "Alex",
      assignedByAdultId: "a1",
      kidIds: ["k1"],
      status: "CONFIRMED" as const,
      leaveFromPlaceId: null,
      leaveFromPlaceName: null,
      leaveFromAddress: null,
      leaveByAt: null,
      leaveByStatus: null,
      leaveByReason: null,
    }
    const inboundAsk = {
      id: "inbound-ask",
      spaceId: "s1",
      eventKey: "UID:reconsider",
      requestingCircleId: "c2",
      requestingCircleName: "House B",
      requestedByAdultId: "a2",
      kidIds: ["k2"],
      kidFirstNames: ["Mia"],
      seats: 1,
      pickupPlaceName: "Home",
      pickupAddress: "1 Main",
      pickupTown: null,
      detourMinutes: null,
      status: "PENDING" as const,
      passedByMe: false,
      passedByAdultNames: [],
      acceptedByAdultId: null,
      acceptingCircleId: null,
      acceptingCircleName: null,
      legs: carpoolLegsBoth("ASKED_TEAM"),
    }
    const baseItem = item({
      id: "reconsider",
      source: "FEED",
      title: "Practice",
      feedId: "f1",
      feedName: "U12",
      eventKey: "UID:reconsider",
      uncoveredKidIds: [],
      coverages: [confirmedCoverage],
    })
    const rideEvent = {
      eventKey: "UID:reconsider",
      title: "Practice",
      startsAt: baseItem.startsAt,
      endsAt: null,
      defaultKidIds: [],
      ownRequest: null,
      ownRequests: [],
      ownLegs: carpoolLegsBoth("CONFIRMED", {
        assigneeAdultId: "a1",
        assigneeDisplayName: "Alex",
      }),
      otherRequests: [inboundAsk],
    }

    const { rerender } = render(
      <AgendaRow
        item={baseItem}
        circle={circle}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: [], soleAdult: true, soleKid: true }}
        autoDeclinedRideIds={new Set(["inbound-ask"])}
        rideEvent={rideEvent}
        onAcceptRide={onAcceptRide}
        onPassRide={vi.fn()}
        {...noopHandlers}
      />,
    )

    const row = screen.getByTestId("agenda-row-FEED-reconsider")
    await user.click(within(row).getByRole("button", { expanded: false }))
    await user.click(within(row).getByRole("button", { name: "Reconsider" }))
    expect(onAcceptRide).toHaveBeenCalledWith("inbound-ask")

    onAcceptRide.mockClear()
    rerender(
      <AgendaRow
        item={baseItem}
        circle={circle}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: [], soleAdult: true, soleKid: true }}
        recentlyWithdrawnRideIds={new Set(["inbound-ask"])}
        rideEvent={rideEvent}
        onAcceptRide={onAcceptRide}
        onPassRide={vi.fn()}
        {...noopHandlers}
      />,
    )
    await user.click(within(row).getByRole("button", { name: "Undo" }))
    expect(onAcceptRide).toHaveBeenCalledWith("inbound-ask")
  })

  it("Open Places renders for NO_ORIGIN", async () => {
    const user = userEvent.setup()
    const onOpenPlaces = vi.fn()
    renderRow(
      item({
        id: "no-origin",
        title: "Practice",
        uncoveredKidIds: [],
        leaveByStatus: "UNAVAILABLE",
        leaveByReason: "NO_ORIGIN",
        leaveFromPlaceId: null,
        leaveFromPlaceName: null,
      }),
      { onOpenPlaces },
    )

    const row = screen.getByTestId("agenda-row-MANUAL-no-origin")
    await user.click(within(row).getByRole("button", { expanded: false }))
    await user.click(within(row).getByRole("button", { name: "Open Places" }))
    expect(onOpenPlaces).toHaveBeenCalledTimes(1)
  })

  it("manual Edit and Remove event stay in quiet actions", async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    const onRemoveEvent = vi.fn()
    renderRow(item({ id: "manual-actions", title: "Birthday" }), {
      onEdit,
      onRemoveEvent,
    })

    const row = screen.getByTestId("agenda-row-MANUAL-manual-actions")
    await user.click(within(row).getByRole("button", { expanded: false }))
    expect(within(row).getByTestId("agenda-quiet-actions")).toBeInTheDocument()
    const actions = within(row).getByTestId("agenda-band-manual-actions")
    const edit = within(actions).getByRole("button", { name: "Edit" })
    const remove = within(actions).getByRole("button", { name: "Remove event" })
    expect(edit.className).toMatch(/--fc-text-secondary/)
    expect(remove.className).toMatch(/--fc-danger/)
    await user.click(edit)
    expect(onEdit).toHaveBeenCalledTimes(1)
    await user.click(remove)
    expect(onRemoveEvent).toHaveBeenCalledTimes(1)
  })

  it("Confirm and lock label when Lock checked", async () => {
    const user = userEvent.setup()
    renderRow(
      item({
        id: "lock-label",
        source: "FEED",
        title: "Practice",
        feedId: "f1",
        feedName: "U12",
        eventKey: "UID:lock-label",
        standingLockEligible: true,
        uncoveredKidIds: ["k1"],
      }),
      {
        onCreateRide: vi.fn(),
        rideEvent: {
          eventKey: "UID:lock-label",
          title: "Practice",
          startsAt: "2030-08-15T17:00:00.000Z",
          endsAt: null,
          defaultKidIds: ["k1"],
          ownRequest: null,
          ownRequests: [],
          ownLegs: carpoolLegsBoth("NEEDS_RIDE"),
          otherRequests: [],
        },
      },
    )

    const row = screen.getByTestId("agenda-row-FEED-lock-label")
    await user.click(within(row).getByRole("button", { expanded: false }))
    expect(
      within(row).getByRole("button", {
        name: /Confirm — You'll drive round trip/,
      }),
    ).toBeInTheDocument()
    await user.click(within(row).getByTestId("driver-picker-lock-standing-checkbox"))
    expect(
      within(row).getByRole("button", { name: /Confirm and lock for/ }),
    ).toBeInTheDocument()
  })

  it("expanded order is Legs → decision → Plan locked → quiet → caption", async () => {
    const user = userEvent.setup()
    renderRow(
      item({
        id: "expanded-order",
        source: "FEED",
        title: "Practice",
        feedId: "f1",
        feedName: "U12",
        eventKey: "UID:expanded-order",
        standingLocked: true,
        standingBlockTemplateId: "tmpl-order",
        uncoveredKidIds: [],
        coverages: [
          {
            id: "cov-order",
            coveringAdultId: "a1",
            coveringAdultDisplayName: "Alex",
            assignedByAdultId: "a1",
            kidIds: ["k1"],
            status: "CONFIRMED",
            leaveFromPlaceId: "p1",
            leaveFromPlaceName: "Home",
            leaveFromAddress: null,
            leaveByAt: null,
            leaveByStatus: null,
            leaveByReason: null,
          },
        ],
      }),
      {
        rideEvent: {
          eventKey: "UID:expanded-order",
          title: "Practice",
          startsAt: "2030-08-15T17:00:00.000Z",
          endsAt: null,
          defaultKidIds: ["k1"],
          ownRequest: null,
          ownRequests: [],
          ownLegs: carpoolLegsBoth("CONFIRMED", {
            assigneeAdultId: "a1",
            assigneeDisplayName: "Alex",
          }),
          otherRequests: [
            {
              id: "inbound-order",
              spaceId: "s1",
              eventKey: "UID:expanded-order",
              requestingCircleId: "c2",
              requestingCircleName: "Other",
              requestedByAdultId: "a9",
              kidIds: ["k9"],
              kidFirstNames: ["Pat"],
              seats: 1,
              pickupPlaceName: "Park",
              pickupAddress: "2 Oak",
              pickupTown: null,
              detourMinutes: null,
              status: "PENDING",
              legs: carpoolLegsBoth("ASKED_TEAM"),
              passedByMe: false,
              passedByAdultNames: [],
              acceptedByAdultId: null,
              acceptingCircleId: null,
              acceptingCircleName: null,
            },
          ],
        },
      },
    )

    const row = screen.getByTestId("agenda-row-FEED-expanded-order")
    await user.click(within(row).getByRole("button", { expanded: false }))
    // Settled locked hides the picker until Edit — open the editor for decision.
    await user.click(within(row).getByTestId("agenda-row-standing-locked-edit"))

    const expanded = within(row).getByTestId("agenda-row-expanded")
    const legs = within(expanded).getByTestId("agenda-row-legs-table")
    const travel = within(expanded).getByTestId("agenda-band-travel")
    const decision = within(expanded).getByTestId("agenda-band-decision")
    const locked = within(expanded).getByTestId("agenda-row-standing-locked")
    const quiet = within(expanded).getByTestId("agenda-band-kids")
    const caption = within(expanded).getByTestId("agenda-row-standing-locked-caption")
    const inbound = within(expanded).getByTestId("agenda-band-inbound-requests")

    expect(
      legs.compareDocumentPosition(travel) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      travel.compareDocumentPosition(decision) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      decision.compareDocumentPosition(locked) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      locked.compareDocumentPosition(quiet) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      quiet.compareDocumentPosition(caption) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      caption.compareDocumentPosition(inbound) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(within(decision).getByTestId("driver-picker")).toBeInTheDocument()
    expect(
      within(locked).queryByTestId("agenda-row-standing-locked-caption"),
    ).not.toBeInTheDocument()
  })

  it("coverage leave-from editor survives next to Legs table", async () => {
    const user = userEvent.setup()
    renderRow(
      item({
        id: "legs-leave",
        source: "FEED",
        title: "Practice",
        feedId: "f1",
        feedName: "U12",
        eventKey: "UID:legs-leave",
        standingLocked: true,
        standingBlockTemplateId: "tmpl-legs",
        uncoveredKidIds: [],
        coverages: [
          {
            id: "cov-legs",
            coveringAdultId: "a1",
            coveringAdultDisplayName: "Alex",
            assignedByAdultId: "a1",
            kidIds: ["k1"],
            status: "CONFIRMED",
            leaveFromPlaceId: "p1",
            leaveFromPlaceName: "Mom's house",
            leaveFromAddress: null,
            leaveByAt: "2030-08-15T16:30:00.000Z",
            leaveByStatus: "OK",
            leaveByReason: null,
          },
        ],
      }),
      {
        rideEvent: {
          eventKey: "UID:legs-leave",
          title: "Practice",
          startsAt: "2030-08-15T17:00:00.000Z",
          endsAt: null,
          defaultKidIds: ["k1"],
          ownRequest: null,
          ownRequests: [],
          ownLegs: carpoolLegsBoth("CONFIRMED", {
            assigneeAdultId: "a1",
            assigneeDisplayName: "Alex",
          }),
          otherRequests: [],
        },
      },
    )

    const row = screen.getByTestId("agenda-row-FEED-legs-leave")
    await user.click(within(row).getByRole("button", { expanded: false }))
    expect(within(row).getByTestId("agenda-row-legs-k1")).toBeInTheDocument()
    expect(
      within(row).getByTestId("coverage-leave-from-cov-legs-place-select"),
    ).toBeInTheDocument()
  })

  it("item-level leave-from renders when no coverage and no picker", async () => {
    const user = userEvent.setup()
    renderRow(
      item({
        id: "item-leave",
        title: "Practice",
        uncoveredKidIds: [],
      }),
    )

    const row = screen.getByTestId("agenda-row-MANUAL-item-leave")
    await user.click(within(row).getByRole("button", { expanded: false }))
    expect(within(row).queryByTestId("driver-picker")).not.toBeInTheDocument()
    expect(
      within(row).getByTestId("leave-from-MANUAL-item-leave-field-row"),
    ).toBeInTheDocument()
  })

  it("Request band renders when picker not mounted and gap exists", async () => {
    const user = userEvent.setup()
    const onCreateRide = vi.fn()
    renderRow(
      item({
        id: "request-band",
        source: "FEED",
        title: "Practice",
        feedId: "f1",
        feedName: "U12",
        eventKey: "UID:request-band",
        uncoveredKidIds: ["k1"],
        coverages: [
          {
            id: "cov-pending-gap",
            coveringAdultId: "a1",
            coveringAdultDisplayName: "Alex",
            assignedByAdultId: "a2",
            kidIds: ["k1"],
            status: "PENDING",
            leaveFromPlaceId: null,
            leaveFromPlaceName: null,
            leaveFromAddress: null,
            leaveByAt: null,
            leaveByStatus: null,
            leaveByReason: null,
          },
        ],
      }),
      {
        onCreateRide,
        rideEvent: {
          eventKey: "UID:request-band",
          title: "Practice",
          startsAt: "2030-08-15T17:00:00.000Z",
          endsAt: null,
          defaultKidIds: ["k1"],
          ownRequest: null,
          ownRequests: [],
          ownLegs: carpoolLegsBoth("NEEDS_RIDE"),
          otherRequests: [],
        },
      },
    )

    const row = screen.getByTestId("agenda-row-FEED-request-band")
    await user.click(within(row).getByRole("button", { expanded: false }))
    expect(within(row).queryByTestId("driver-picker")).not.toBeInTheDocument()
    expect(within(row).getByTestId("agenda-band-carpool")).toBeInTheDocument()
    await user.click(within(row).getByRole("button", { name: "Request" }))
    expect(onCreateRide).toHaveBeenCalledWith("UID:request-band", undefined)
  })

  it("collapsed locked card shows Every {weekday}", () => {
    renderRow(
      item({
        id: "collapsed-locked",
        source: "FEED",
        title: "Practice",
        feedId: "f1",
        feedName: "U12",
        eventKey: "UID:collapsed-locked",
        standingLocked: true,
        standingBlockTemplateId: "tmpl-collapsed",
        uncoveredKidIds: [],
        coverages: [
          {
            id: "cov-collapsed",
            coveringAdultId: "a1",
            coveringAdultDisplayName: "Alex",
            assignedByAdultId: "a1",
            kidIds: ["k1"],
            status: "CONFIRMED",
            leaveFromPlaceId: null,
            leaveFromPlaceName: null,
            leaveFromAddress: null,
            leaveByAt: null,
            leaveByStatus: null,
            leaveByReason: null,
          },
        ],
      }),
      {
        rideEvent: {
          eventKey: "UID:collapsed-locked",
          title: "Practice",
          startsAt: "2030-08-15T17:00:00.000Z",
          endsAt: null,
          defaultKidIds: ["k1"],
          ownRequest: null,
          ownRequests: [],
          ownLegs: carpoolLegsBoth("CONFIRMED", {
            assigneeAdultId: "a1",
            assigneeDisplayName: "Alex",
          }),
          otherRequests: [],
        },
      },
    )

    const row = screen.getByTestId("agenda-row-FEED-collapsed-locked")
    expect(within(row).getByRole("button", { expanded: false })).toBeInTheDocument()
    expect(within(row).getByTestId("agenda-row-recurrence")).toHaveTextContent(
      /^↻ Every /,
    )
    expect(
      within(row).queryByTestId("agenda-row-standing-locked-title"),
    ).not.toBeInTheDocument()
  })

  it("every callback prop is reachable in some rendered state", async () => {
    const user = userEvent.setup()
    const reached = new Set<string>()
    const track = (name: string) => vi.fn((..._args: unknown[]) => {
      reached.add(name)
    })

    // Deprecated; AgendaRow voids it and never mounts a consumer.
    const intentionalExceptions = ["onLockStandingBlock"] as const

    const handlers = {
      onUpdateAssignDraft: track("onUpdateAssignDraft"),
      onAssignCoverage: track("onAssignCoverage"),
      onConfirmCoverage: track("onConfirmCoverage"),
      onDeclineCoverage: track("onDeclineCoverage"),
      onConfirmHouseholdPlan: track("onConfirmHouseholdPlan"),
      onDeclineHouseholdPlan: track("onDeclineHouseholdPlan"),
      onRemoveCoverage: track("onRemoveCoverage"),
      onSetLeaveFrom: track("onSetLeaveFrom"),
      onSetCoverageLeaveFrom: track("onSetCoverageLeaveFrom"),
      onSetRsvp: track("onSetRsvp"),
      onSetNotGoing: track("onSetNotGoing"),
      onOpenPlaces: track("onOpenPlaces"),
      onOpenRide: track("onOpenRide"),
      onEdit: track("onEdit"),
      onRemoveEvent: track("onRemoveEvent"),
      onCreateRide: track("onCreateRide"),
      onSaveRidePlan: track("onSaveRidePlan"),
      onSaveKidPlans: track("onSaveKidPlans"),
      onCancelRide: track("onCancelRide"),
      onWithdrawRide: track("onWithdrawRide"),
      onAcceptRide: track("onAcceptRide"),
      onPassRide: track("onPassRide"),
      onCantMakeIt: track("onCantMakeIt"),
      onRevertDecidedAssignee: track("onRevertDecidedAssignee"),
      onDriveBlockLink: track("onDriveBlockLink"),
      onRemoveStandingBlock: track("onRemoveStandingBlock"),
      onEndStandingRide: track("onEndStandingRide"),
    }

    const baseProps = {
      circle,
      currentAdultId: "a1" as const,
      loading: false,
      ...handlers,
    }

    // 1) Gap picker: draft update, assign, create ride, kid-split save, not-going.
    const twoKids: FamilyCircle = {
      ...circle,
      kids: [
        { id: "k1", displayName: "Sam" },
        { id: "k2", displayName: "Mia" },
      ],
      members: [
        { adultId: "a1", email: "a@example.com", displayName: "Alex", role: "ORGANIZER" },
        { adultId: "a2", email: "j@example.com", displayName: "Jordan", role: "CAREGIVER" },
      ],
    }
    const gapItem = item({
      id: "cb-gap",
      source: "FEED",
      title: "Practice",
      feedId: "f1",
      feedName: "U12",
      eventKey: "UID:cb-gap",
      uncoveredKidIds: ["k1", "k2"],
      kidIds: ["k1", "k2"],
      rsvps: [
        { kidId: "k1", status: "YES" },
        { kidId: "k2", status: "YES" },
      ],
    })
    let view = render(
      <AgendaRow
        {...baseProps}
        circle={twoKids}
        item={gapItem}
        assignDraft={{
          adultId: "a1",
          kidIds: ["k1", "k2"],
          soleAdult: false,
          soleKid: false,
        }}
        rideEvent={{
          eventKey: "UID:cb-gap",
          title: "Practice",
          startsAt: gapItem.startsAt,
          endsAt: null,
          defaultKidIds: ["k1", "k2"],
          ownRequest: null,
          ownRequests: [],
          ownLegs: carpoolLegsBoth("NEEDS_RIDE"),
          otherRequests: [],
        }}
      />,
    )
    let row = screen.getByTestId("agenda-row-FEED-cb-gap")
    await user.click(within(row).getByRole("button", { expanded: false }))
    await user.click(within(row).getByTestId("driver-picker-chip-a2"))
    await user.click(
      within(row).getByRole("button", { name: /Confirm — Jordan'll drive|Confirm —/ }),
    )
    await user.click(within(row).getByTestId("driver-picker-different-plans-kid"))
    const kidSave =
      within(row).queryByRole("button", { name: /Save ride plan/ }) ??
      within(row).queryByRole("button", { name: /Post to team/ })
    if (kidSave != null) {
      await user.click(kidSave)
    }
    await user.click(within(row).getByTestId("rsvp-FEED-cb-gap-all"))
    view.unmount()

    // 1a) Ask + Post with onSaveRidePlan wired → onSaveRidePlan (not onCreateRide).
    view = render(
      <AgendaRow
        {...baseProps}
        circle={twoKids}
        item={gapItem}
        assignDraft={{
          adultId: "a1",
          kidIds: ["k1", "k2"],
          soleAdult: false,
          soleKid: false,
        }}
        rideEvent={{
          eventKey: "UID:cb-gap",
          title: "Practice",
          startsAt: gapItem.startsAt,
          endsAt: null,
          defaultKidIds: ["k1", "k2"],
          ownRequest: null,
          ownRequests: [],
          ownLegs: carpoolLegsBoth("NEEDS_RIDE"),
          otherRequests: [],
        }}
      />,
    )
    row = screen.getByTestId("agenda-row-FEED-cb-gap")
    await user.click(within(row).getByRole("button", { expanded: false }))
    await user.click(within(row).getByRole("button", { name: "Ask the team" }))
    await user.click(
      within(row).getByRole("button", { name: "Post to team — round trip" }),
    )
    view.unmount()

    // 1b) Post to team → onCreateRide (omit onSaveRidePlan so Post uses onAskTeam).
    view = render(
      <AgendaRow
        {...baseProps}
        onSaveRidePlan={undefined}
        onSaveKidPlans={undefined}
        circle={twoKids}
        item={gapItem}
        assignDraft={{
          adultId: "a1",
          kidIds: ["k1", "k2"],
          soleAdult: false,
          soleKid: false,
        }}
        rideEvent={{
          eventKey: "UID:cb-gap",
          title: "Practice",
          startsAt: gapItem.startsAt,
          endsAt: null,
          defaultKidIds: ["k1", "k2"],
          ownRequest: null,
          ownRequests: [],
          ownLegs: carpoolLegsBoth("NEEDS_RIDE"),
          otherRequests: [],
        }}
      />,
    )
    row = screen.getByTestId("agenda-row-FEED-cb-gap")
    await user.click(within(row).getByRole("button", { expanded: false }))
    await user.click(within(row).getByRole("button", { name: "Ask the team" }))
    await user.click(
      within(row).getByRole("button", { name: "Post to team — round trip" }),
    )
    view.unmount()

    // 2) Pending self confirm/decline.
    view = render(
      <AgendaRow
        {...baseProps}
        item={item({
          id: "cb-pending",
          title: "Practice",
          coverages: [
            {
              id: "cov-cb",
              coveringAdultId: "a1",
              coveringAdultDisplayName: "Alex",
              assignedByAdultId: "a2",
              kidIds: ["k1"],
              status: "PENDING",
              leaveFromPlaceId: null,
              leaveFromPlaceName: null,
              leaveFromAddress: null,
              leaveByAt: null,
              leaveByStatus: null,
              leaveByReason: null,
            },
          ],
        })}
        assignDraft={{ adultId: "a1", kidIds: [], soleAdult: true, soleKid: true }}
      />,
    )
    row = screen.getByTestId("agenda-row-MANUAL-cb-pending")
    await user.click(within(row).getByRole("button", { expanded: false }))
    await user.click(within(row).getByRole("button", { name: "Confirm coverage" }))
    await user.click(within(row).getByRole("button", { name: "Decline coverage" }))
    view.unmount()

    // 3) Household-plan confirm/decline.
    view = render(
      <AgendaRow
        {...baseProps}
        item={item({
          id: "cb-hh",
          source: "FEED",
          title: "Practice",
          feedId: "f1",
          feedName: "U12",
          eventKey: "UID:cb-hh",
          uncoveredKidIds: [],
        })}
        assignDraft={{ adultId: "a1", kidIds: [], soleAdult: true, soleKid: true }}
        rideEvent={{
          eventKey: "UID:cb-hh",
          title: "Practice",
          startsAt: "2030-08-15T17:00:00.000Z",
          endsAt: null,
          defaultKidIds: ["k1"],
          ownRequest: null,
          ownRequests: [],
          ownLegs: carpoolLegsBoth("WAITING_HOUSEHOLD", {
            assigneeAdultId: "a1",
            assigneeDisplayName: "Alex",
          }),
          otherRequests: [],
        }}
      />,
    )
    row = screen.getByTestId("agenda-row-FEED-cb-hh")
    await user.click(within(row).getByRole("button", { expanded: false }))
    await user.click(within(row).getByRole("button", { name: "Confirm coverage" }))
    await user.click(within(row).getByRole("button", { name: "Decline coverage" }))
    view.unmount()

    // 4) Confirmed: reassign, coverage leave-from, Open Places, route, edit/remove, rsvp.
    const multiPlace: FamilyCircle = {
      ...circle,
      places: [
        ...circle.places,
        { id: "p2", name: "Dad's", address: "2 Oak", latitude: 40, longitude: -74 },
      ],
    }
    view = render(
      <AgendaRow
        {...baseProps}
        circle={multiPlace}
        item={item({
          id: "cb-confirmed",
          title: "Practice",
          uncoveredKidIds: [],
          leaveByStatus: "UNAVAILABLE",
          leaveByReason: "NO_ORIGIN",
          coverages: [
            {
              id: "cov-ok",
              coveringAdultId: "a1",
              coveringAdultDisplayName: "Alex",
              assignedByAdultId: "a1",
              kidIds: ["k1"],
              status: "CONFIRMED",
              leaveFromPlaceId: "p1",
              leaveFromPlaceName: "Mom's house",
              leaveFromAddress: null,
              leaveByAt: "2030-08-15T16:30:00.000Z",
              leaveByStatus: "OK",
              leaveByReason: null,
            },
          ],
        })}
        assignDraft={{ adultId: "a1", kidIds: [], soleAdult: true, soleKid: true }}
        rideEvent={{
          eventKey: "UID:cb-confirmed",
          title: "Practice",
          startsAt: "2030-08-15T17:00:00.000Z",
          endsAt: null,
          defaultKidIds: [],
          ownRequest: null,
          ownRequests: [],
          ownLegs: carpoolLegsBoth("CONFIRMED", {
            assigneeAdultId: "a1",
            assigneeDisplayName: "Alex",
          }),
          otherRequests: [],
        }}
      />,
    )
    row = screen.getByTestId("agenda-row-MANUAL-cb-confirmed")
    await user.click(within(row).getByRole("button", { expanded: false }))
    await user.click(within(row).getByTestId("agenda-reassign-link"))
    await user.selectOptions(
      within(row).getByTestId("coverage-leave-from-cov-ok-place-select"),
      "p2",
    )
    await user.click(within(row).getByRole("button", { name: "Open Places" }))
    await user.click(within(row).getByTestId("agenda-row-open-ride-cta"))
    await user.click(within(row).getByRole("button", { name: "Edit" }))
    await user.click(within(row).getByRole("button", { name: "Remove event" }))
    await user.click(
      within(row).getByRole("button", { name: "Mark Sam as not going" }),
    )
    view.unmount()

    // 5a) onCantMakeIt when onRevertDecidedAssignee is omitted.
    view = render(
      <AgendaRow
        {...baseProps}
        onRevertDecidedAssignee={undefined}
        item={item({
          id: "cb-cant",
          title: "Practice",
          uncoveredKidIds: [],
          coverages: [
            {
              id: "cov-cant",
              coveringAdultId: "a1",
              coveringAdultDisplayName: "Alex",
              assignedByAdultId: "a1",
              kidIds: ["k1"],
              status: "CONFIRMED",
              leaveFromPlaceId: null,
              leaveFromPlaceName: null,
              leaveFromAddress: null,
              leaveByAt: null,
              leaveByStatus: null,
              leaveByReason: null,
            },
          ],
        })}
        assignDraft={{ adultId: "a1", kidIds: [], soleAdult: true, soleKid: true }}
        rideEvent={{
          eventKey: "UID:cb-cant",
          title: "Practice",
          startsAt: "2030-08-15T17:00:00.000Z",
          endsAt: null,
          defaultKidIds: [],
          ownRequest: null,
          ownRequests: [],
          ownLegs: carpoolLegsBoth("CONFIRMED", {
            assigneeAdultId: "a1",
            assigneeDisplayName: "Alex",
          }),
          otherRequests: [],
        }}
      />,
    )
    row = screen.getByTestId("agenda-row-MANUAL-cb-cant")
    await user.click(within(row).getByRole("button", { expanded: false }))
    await user.click(within(row).getByTestId("agenda-reassign-link"))
    view.unmount()

    // 5b) onRemoveCoverage when both revert helpers are omitted.
    view = render(
      <AgendaRow
        {...baseProps}
        onRevertDecidedAssignee={undefined}
        onCantMakeIt={undefined}
        item={item({
          id: "cb-remove",
          title: "Practice",
          uncoveredKidIds: [],
          coverages: [
            {
              id: "cov-remove",
              coveringAdultId: "a1",
              coveringAdultDisplayName: "Alex",
              assignedByAdultId: "a1",
              kidIds: ["k1"],
              status: "CONFIRMED",
              leaveFromPlaceId: null,
              leaveFromPlaceName: null,
              leaveFromAddress: null,
              leaveByAt: null,
              leaveByStatus: null,
              leaveByReason: null,
            },
          ],
        })}
        assignDraft={{ adultId: "a1", kidIds: [], soleAdult: true, soleKid: true }}
        rideEvent={{
          eventKey: "UID:cb-remove",
          title: "Practice",
          startsAt: "2030-08-15T17:00:00.000Z",
          endsAt: null,
          defaultKidIds: [],
          ownRequest: null,
          ownRequests: [],
          ownLegs: carpoolLegsBoth("CONFIRMED", {
            assigneeAdultId: "a1",
            assigneeDisplayName: "Alex",
          }),
          otherRequests: [],
        }}
      />,
    )
    row = screen.getByTestId("agenda-row-MANUAL-cb-remove")
    await user.click(within(row).getByRole("button", { expanded: false }))
    await user.click(within(row).getByTestId("agenda-reassign-link"))
    view.unmount()

    // 6) Inbound accept/pass/withdraw + cancel ask.
    const ownAsk = {
      id: "own-ask-cb",
      spaceId: "s1",
      eventKey: "UID:cb-inbound",
      requestingCircleId: "c1",
      requestingCircleName: "Test",
      requestedByAdultId: "a1",
      kidIds: ["k1"],
      kidFirstNames: ["Sam"],
      seats: 1,
      pickupPlaceName: "Home",
      pickupAddress: "1 Main",
      pickupTown: null,
      detourMinutes: null,
      status: "PENDING" as const,
      passedByMe: false,
      passedByAdultNames: [],
      acceptedByAdultId: null,
      acceptingCircleId: null,
      acceptingCircleName: null,
      legs: carpoolLegsBoth("ASKED_TEAM"),
    }
    view = render(
      <AgendaRow
        {...baseProps}
        item={item({
          id: "cb-inbound",
          source: "FEED",
          title: "Practice",
          feedId: "f1",
          feedName: "U12",
          eventKey: "UID:cb-inbound",
          uncoveredKidIds: [],
        })}
        assignDraft={{ adultId: "a1", kidIds: [], soleAdult: true, soleKid: true }}
        rideEvent={{
          eventKey: "UID:cb-inbound",
          title: "Practice",
          startsAt: "2030-08-15T17:00:00.000Z",
          endsAt: null,
          defaultKidIds: [],
          ownRequest: ownAsk,
          ownRequests: [ownAsk],
          ownLegs: carpoolLegsBoth("ASKED_TEAM"),
          otherRequests: [],
        }}
      />,
    )
    row = screen.getByTestId("agenda-row-FEED-cb-inbound")
    await user.click(within(row).getByRole("button", { expanded: false }))
    await user.click(
      within(row).getByRole("button", {
        name: "No longer need a ride? Cancel this ask",
      }),
    )
    view.unmount()

    view = render(
      <AgendaRow
        {...baseProps}
        item={item({
          id: "cb-accept",
          source: "FEED",
          title: "Practice",
          feedId: "f1",
          feedName: "U12",
          eventKey: "UID:cb-accept",
          uncoveredKidIds: [],
          coverages: [
            {
              id: "cov-accept",
              coveringAdultId: "a1",
              coveringAdultDisplayName: "Alex",
              assignedByAdultId: "a1",
              kidIds: ["k1"],
              status: "CONFIRMED",
              leaveFromPlaceId: null,
              leaveFromPlaceName: null,
              leaveFromAddress: null,
              leaveByAt: null,
              leaveByStatus: null,
              leaveByReason: null,
            },
          ],
        })}
        assignDraft={{ adultId: "a1", kidIds: [], soleAdult: true, soleKid: true }}
        rideEvent={{
          eventKey: "UID:cb-accept",
          title: "Practice",
          startsAt: "2030-08-15T17:00:00.000Z",
          endsAt: null,
          defaultKidIds: [],
          ownRequest: null,
          ownRequests: [],
          ownLegs: carpoolLegsBoth("CONFIRMED", {
            assigneeAdultId: "a1",
            assigneeDisplayName: "Alex",
          }),
          otherRequests: [
            {
              id: "pending-accept",
              spaceId: "s1",
              eventKey: "UID:cb-accept",
              requestingCircleId: "c2",
              requestingCircleName: "House B",
              requestedByAdultId: "a2",
              kidIds: ["k2"],
              kidFirstNames: ["Mia"],
              seats: 1,
              pickupPlaceName: "Home",
              pickupAddress: "1 Main",
              pickupTown: null,
              detourMinutes: null,
              status: "PENDING",
              passedByMe: false,
              passedByAdultNames: [],
              acceptedByAdultId: null,
              acceptingCircleId: null,
              acceptingCircleName: null,
              legs: carpoolLegsBoth("ASKED_TEAM"),
            },
            {
              id: "accepted-withdraw",
              spaceId: "s1",
              eventKey: "UID:cb-accept",
              requestingCircleId: "c2",
              requestingCircleName: "House B",
              requestedByAdultId: "a2",
              kidIds: ["k3"],
              kidFirstNames: ["Leo"],
              seats: 1,
              pickupPlaceName: "Home",
              pickupAddress: "1 Main",
              pickupTown: null,
              detourMinutes: null,
              status: "ACCEPTED",
              passedByMe: false,
              passedByAdultNames: [],
              acceptedByAdultId: "a1",
              acceptingCircleId: "c1",
              acceptingCircleName: "Test",
              legs: carpoolLegsBoth("ASKED_TEAM"),
            },
          ],
        }}
      />,
    )
    row = screen.getByTestId("agenda-row-FEED-cb-accept")
    await user.click(within(row).getByRole("button", { expanded: false }))
    await user.click(within(row).getByRole("button", { name: "Accept" }))
    await user.click(within(row).getByRole("button", { name: "Pass" }))
    await user.click(
      within(row).getByRole("button", { name: "Can't take them anymore" }),
    )
    view.unmount()

    // 7) Drive-block combine, standing end, locked remove, Save ride plan.
    view = render(
      <AgendaRow
        {...baseProps}
        item={item({
          id: "cb-locked",
          source: "FEED",
          title: "Practice",
          feedId: "f1",
          feedName: "U12",
          eventKey: "UID:cb-locked",
          standingLocked: true,
          standingBlockTemplateId: "tmpl-cb",
          uncoveredKidIds: [],
          coverages: [
            {
              id: "cov-locked",
              coveringAdultId: "a1",
              coveringAdultDisplayName: "Alex",
              assignedByAdultId: "a1",
              kidIds: ["k1"],
              status: "CONFIRMED",
              leaveFromPlaceId: null,
              leaveFromPlaceName: null,
              leaveFromAddress: null,
              leaveByAt: null,
              leaveByStatus: null,
              leaveByReason: null,
            },
          ],
          driveBlockLinks: [
            {
              leg: "TO",
              otherSource: "FEED",
              otherId: "other-cb",
              otherTitle: "Earlier",
              otherStartsAt: "2030-08-15T16:00:00.000Z",
              combined: false,
              overrideAction: "FORCE_SPLIT",
            },
          ],
        })}
        assignDraft={{ adultId: "a1", kidIds: ["k1"], soleAdult: true, soleKid: true }}
        standingRideSeries={{
          arrangementId: "arr-cb",
          weekdaySingular: "Thursday",
          weekdayPlural: "Thursdays",
          inboundOpen: false,
          ownOpen: true,
          ownActive: false,
          primaryActive: false,
        }}
        rideEvent={{
          eventKey: "UID:cb-locked",
          title: "Practice",
          startsAt: "2030-08-15T17:00:00.000Z",
          endsAt: null,
          defaultKidIds: ["k1"],
          ownRequest: null,
          ownRequests: [],
          ownLegs: carpoolLegsBoth("CONFIRMED", {
            assigneeAdultId: "a1",
            assigneeDisplayName: "Alex",
          }),
          otherRequests: [],
        }}
      />,
    )
    row = screen.getByTestId("agenda-row-FEED-cb-locked")
    await user.click(
      within(row).getByRole("button", { name: "End standing Ask for Thursdays" }),
    )
    await user.click(within(row).getByRole("button", { expanded: false }))
    await user.click(within(row).getByRole("button", { name: /Combine these/ }))
    await user.click(within(row).getByTestId("agenda-row-standing-locked-edit"))
    const saveBtn =
      within(row).queryByRole("button", { name: /Save ride plan/ }) ??
      within(row).getByRole("button", { name: /Confirm — You'll drive/ })
    await user.click(saveBtn)
    await user.click(within(row).getByTestId("agenda-row-standing-locked-remove"))
    view.unmount()

    // 8) Item-level leave-from.
    view = render(
      <AgendaRow
        {...baseProps}
        circle={multiPlace}
        item={item({
          id: "cb-leave",
          title: "Practice",
          uncoveredKidIds: [],
        })}
        assignDraft={{ adultId: "a1", kidIds: [], soleAdult: true, soleKid: true }}
      />,
    )
    row = screen.getByTestId("agenda-row-MANUAL-cb-leave")
    await user.click(within(row).getByRole("button", { expanded: false }))
    await user.selectOptions(
      within(row).getByTestId("leave-from-MANUAL-cb-leave-place-select"),
      "p2",
    )
    view.unmount()

    // Kid-split save: force onSaveKidPlans via completing kid-split Ask post if still missing.
    if (!reached.has("onSaveKidPlans") || !reached.has("onSaveRidePlan")) {
      view = render(
        <AgendaRow
          {...baseProps}
          circle={twoKids}
          item={gapItem}
          assignDraft={{
            adultId: "a1",
            kidIds: ["k1", "k2"],
            soleAdult: false,
            soleKid: false,
          }}
          rideEvent={{
            eventKey: "UID:cb-gap",
            title: "Practice",
            startsAt: gapItem.startsAt,
            endsAt: null,
            defaultKidIds: ["k1", "k2"],
            ownRequest: null,
            ownRequests: [],
            ownLegs: carpoolLegsBoth("NEEDS_RIDE"),
            otherRequests: [],
          }}
        />,
      )
      row = screen.getByTestId("agenda-row-FEED-cb-gap")
      await user.click(within(row).getByRole("button", { expanded: false }))
      if (!reached.has("onSaveKidPlans")) {
        await user.click(within(row).getByTestId("driver-picker-different-plans-kid"))
        // In kid-split, confirm household for both kids if Save/Post is enabled.
        const saveKid = within(row).queryByRole("button", { name: /Save ride plan/ })
        if (saveKid != null && !saveKid.hasAttribute("disabled")) {
          await user.click(saveKid)
        }
      }
      view.unmount()
    }

    const requiredCallbacks = [
      "onUpdateAssignDraft",
      "onAssignCoverage",
      "onConfirmCoverage",
      "onDeclineCoverage",
      "onConfirmHouseholdPlan",
      "onDeclineHouseholdPlan",
      "onRemoveCoverage",
      "onSetLeaveFrom",
      "onSetCoverageLeaveFrom",
      "onSetRsvp",
      "onSetNotGoing",
      "onOpenPlaces",
      "onOpenRide",
      "onEdit",
      "onRemoveEvent",
      "onCreateRide",
      "onCancelRide",
      "onWithdrawRide",
      "onAcceptRide",
      "onPassRide",
      "onCantMakeIt",
      "onRevertDecidedAssignee",
      "onDriveBlockLink",
      "onRemoveStandingBlock",
      "onEndStandingRide",
      "onSaveRidePlan",
      "onSaveKidPlans",
    ] as const

    const missing = requiredCallbacks.filter((name) => !reached.has(name))
    expect(
      missing,
      `unreachable callbacks (exceptions ok: ${intentionalExceptions.join(", ")}): ${missing.join(", ")}; reached: ${[...reached].sort().join(", ")}`,
    ).toEqual([])
  })
})
