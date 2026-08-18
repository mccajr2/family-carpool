import type { CarpoolFeedStatus, CarpoolFeedStatusKind, FamilyRole } from "@/api/types"
import {
  carpoolFeedStatusLabel,
  enableCarpoolConfirmMessage,
} from "@/components/carpoolDisplay"
import { Button } from "@/components/ui/button"

const feedPrimaryButtonClass =
  "rounded-[var(--fc-radius-md)] bg-[var(--fc-accent)] px-[var(--fc-space-feed-action-pad-x)] py-[var(--fc-space-feed-action-pad-y)] text-[length:var(--fc-font-feed-action-size)] leading-[var(--fc-font-feed-action-line)] font-[number:var(--fc-font-feed-action-weight)] text-[var(--fc-accent-on)] disabled:cursor-not-allowed disabled:opacity-50"

function carpoolChipToneClass(status: CarpoolFeedStatusKind): string {
  switch (status) {
    case "OWNER":
    case "MEMBER":
      return "text-[var(--fc-success)] bg-[color-mix(in_srgb,var(--fc-success)_16%,transparent)]"
    case "AVAILABLE":
      return "text-[var(--fc-accent)] bg-[color-mix(in_srgb,var(--fc-accent)_16%,transparent)]"
    case "REQUESTED":
      return "text-[var(--fc-danger)] bg-[color-mix(in_srgb,var(--fc-danger)_14%,transparent)]"
    case "NONE":
      return "text-[var(--fc-text-secondary)] bg-[color-mix(in_srgb,var(--fc-text-secondary)_14%,transparent)]"
  }
}

export function CarpoolFeedStatusChip({ status }: { status: CarpoolFeedStatusKind }) {
  return (
    <span
      className={`shrink-0 rounded-full px-[var(--fc-space-feed-chip-pad-x)] py-[var(--fc-space-feed-chip-pad-y)] text-[length:var(--fc-font-feed-chip-size)] leading-[var(--fc-font-feed-chip-line)] font-[number:var(--fc-font-feed-chip-weight)] uppercase ${carpoolChipToneClass(status)}`}
    >
      {carpoolFeedStatusLabel(status)}
    </span>
  )
}

type CarpoolFeedActionsProps = {
  feed: CarpoolFeedStatus
  circleRole: FamilyRole
  disabled?: boolean
  layout?: "default" | "feeds"
  onEnable: (feedId: string) => void
  onRequest: (spaceId: string) => void
  onOpen: (spaceId: string) => void
}

export function CarpoolFeedActions({
  feed,
  circleRole,
  disabled = false,
  layout = "default",
  onEnable,
  onRequest,
  onOpen,
}: CarpoolFeedActionsProps) {
  const isOrganizer = circleRole === "ORGANIZER"
  const feedsLayout = layout === "feeds"
  const enableLabel = feedsLayout ? "Enable carpool" : "Enable"
  const openLabel = feedsLayout ? "Open carpool" : "Open"

  function handleEnable() {
    if (!window.confirm(enableCarpoolConfirmMessage(feed.feedName))) {
      return
    }
    onEnable(feed.feedId)
  }

  const primary =
    feed.status === "NONE" && isOrganizer ? (
      feedsLayout ? (
        <button type="button" className={feedPrimaryButtonClass} disabled={disabled} onClick={handleEnable}>
          {enableLabel}
        </button>
      ) : (
        <Button type="button" size="sm" disabled={disabled} onClick={handleEnable}>
          {enableLabel}
        </Button>
      )
    ) : feed.status === "AVAILABLE" && feed.spaceId ? (
      feedsLayout ? (
        <button
          type="button"
          className={feedPrimaryButtonClass}
          disabled={disabled}
          onClick={() => onRequest(feed.spaceId!)}
        >
          Request
        </button>
      ) : (
        <Button
          type="button"
          size="sm"
          disabled={disabled}
          onClick={() => onRequest(feed.spaceId!)}
        >
          Request
        </Button>
      )
    ) : feed.status === "MEMBER" || feed.status === "OWNER" ? (
      feed.spaceId ? (
        feedsLayout ? (
          <button
            type="button"
            className={feedPrimaryButtonClass}
            disabled={disabled}
            onClick={() => onOpen(feed.spaceId!)}
          >
            {openLabel}
          </button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={() => onOpen(feed.spaceId!)}
          >
            {openLabel}
          </Button>
        )
      ) : null
    ) : null

  if (feedsLayout) {
    return primary
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground">{carpoolFeedStatusLabel(feed.status)}</span>
      {primary}
    </div>
  )
}
