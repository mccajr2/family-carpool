import type { CarpoolFeedStatus, FamilyRole } from "@/api/types"
import {
  carpoolFeedStatusLabel,
  enableCarpoolConfirmMessage,
} from "@/components/carpoolDisplay"
import { Button } from "@/components/ui/button"

type CarpoolFeedActionsProps = {
  feed: CarpoolFeedStatus
  circleRole: FamilyRole
  disabled?: boolean
  onEnable: (feedId: string) => void
  onRequest: (spaceId: string) => void
  onOpen: (spaceId: string) => void
}

export function CarpoolFeedActions({
  feed,
  circleRole,
  disabled = false,
  onEnable,
  onRequest,
  onOpen,
}: CarpoolFeedActionsProps) {
  const isOrganizer = circleRole === "ORGANIZER"

  function handleEnable() {
    if (!window.confirm(enableCarpoolConfirmMessage(feed.feedName))) {
      return
    }
    onEnable(feed.feedId)
  }

  const primary =
    feed.status === "NONE" && isOrganizer ? (
      <Button type="button" size="sm" disabled={disabled} onClick={handleEnable}>
        Enable
      </Button>
    ) : feed.status === "AVAILABLE" && feed.spaceId ? (
      <Button
        type="button"
        size="sm"
        disabled={disabled}
        onClick={() => onRequest(feed.spaceId!)}
      >
        Request
      </Button>
    ) : feed.status === "MEMBER" || feed.status === "OWNER" ? (
      feed.spaceId ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => onOpen(feed.spaceId!)}
        >
          Open
        </Button>
      ) : null
    ) : null

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground">{carpoolFeedStatusLabel(feed.status)}</span>
      {primary}
    </div>
  )
}
