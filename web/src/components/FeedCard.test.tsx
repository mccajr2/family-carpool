import type { ComponentProps } from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import type { ActivityFeed, Kid } from "@/api/types"
import { FeedCard, feedMetaLabel } from "@/components/FeedCard"

const kids: Kid[] = [{ id: "k1", displayName: "Sam" }]

const feed: ActivityFeed = {
  id: "f1",
  name: "U12 Travel",
  sourceUrl: "https://very-long.example.com/path/to/calendar/subscribe.ics",
  kidIds: ["k1"],
  lastSyncedAt: "2026-08-10T12:00:00Z",
  lastSyncError: null,
  eventCount: 4,
}

function renderCard(override: Partial<ComponentProps<typeof FeedCard>> = {}) {
  const props = {
    feed,
    kids,
    editing: false,
    editingName: feed.name,
    editingUrl: feed.sourceUrl,
    editingKidIds: [...feed.kidIds],
    loading: false,
    onEditingNameChange: vi.fn(),
    onEditingUrlChange: vi.fn(),
    onToggleEditingKid: vi.fn(),
    onSync: vi.fn(),
    onStartEdit: vi.fn(),
    onCancelEdit: vi.fn(),
    onSave: vi.fn(),
    onRemove: vi.fn(),
    ...override,
  }
  return { ...render(<FeedCard {...props} />), props }
}

describe("feedMetaLabel", () => {
  it("joins eventKidNames with feedSyncStatusLabel", () => {
    expect(feedMetaLabel(feed, kids)).toBe("Sam · Synced · 4 events")
  })

  it("omits kids when none are attached", () => {
    expect(feedMetaLabel({ ...feed, kidIds: [] }, kids)).toBe("Synced · 4 events")
  })
})

describe("FeedCard", () => {
  it("renders a raised card with mock feed tokens and wrapping title", () => {
    renderCard()
    const card = screen.getByTestId("feed-card")
    expect(card.className).toMatch(/--fc-space-feed-card-pad-x/)
    expect(card.className).toMatch(/--fc-space-feed-card-pad-y/)
    expect(card.className).toMatch(/--fc-surface-raised/)
    const title = screen.getByRole("heading", { name: "U12 Travel" })
    expect(title.className).toMatch(/--fc-font-feed-name-size/)
    expect(title.className).not.toMatch(/truncate/)
    expect(screen.getByText("Sam · Synced · 4 events")).toBeInTheDocument()
    expect(
      screen.queryByText("https://very-long.example.com/path/to/calendar/subscribe.ics"),
    ).not.toBeInTheDocument()
  })

  it("keeps Sync now and Edit quieter than Remove-as-text", () => {
    renderCard()
    const sync = screen.getByRole("button", { name: "Sync now" })
    const edit = screen.getByRole("button", { name: "Edit" })
    const remove = screen.getByRole("button", { name: "Remove" })
    expect(sync.className).toMatch(/--fc-font-feed-action-size/)
    expect(sync.className).toMatch(/--fc-space-feed-action-pad-x/)
    expect(edit.className).toMatch(/--fc-font-feed-action-size/)
    expect(remove.className).toMatch(/--fc-font-feed-action-size/)
    expect(remove.className).toMatch(/--fc-text-secondary/)
    expect(remove.className).not.toMatch(/--fc-border/)
  })

  it("calls sync, edit, and remove handlers", async () => {
    const user = userEvent.setup()
    const { props } = renderCard()
    await user.click(screen.getByRole("button", { name: "Sync now" }))
    await user.click(screen.getByRole("button", { name: "Edit" }))
    await user.click(screen.getByRole("button", { name: "Remove" }))
    expect(props.onSync).toHaveBeenCalledOnce()
    expect(props.onStartEdit).toHaveBeenCalledOnce()
    expect(props.onRemove).toHaveBeenCalledOnce()
  })

  it("places the status chip opposite the title and the carpool CTA with Remove", () => {
    renderCard({
      carpoolStatus: <span>Owned</span>,
      carpoolCta: <button type="button">Open carpool</button>,
    })
    const card = screen.getByTestId("feed-card")
    expect(card.textContent).toMatch(/U12 Travel[\s\S]*Owned[\s\S]*Remove/)
    expect(screen.getByRole("button", { name: "Open carpool" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Remove" }).className).toMatch(
      /--fc-text-secondary/,
    )
  })

  it("shows the source URL only while editing", async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    renderCard({
      editing: true,
      onSave,
    })
    expect(
      screen.getByDisplayValue(
        "https://very-long.example.com/path/to/calendar/subscribe.ics",
      ),
    ).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Save" }))
    expect(onSave).toHaveBeenCalledOnce()
  })
})
