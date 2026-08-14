import type { CarpoolFeedStatusKind } from "@/api/types"

export function circleDisplayName(name: string | null | undefined): string {
  const trimmed = name?.trim()
  return trimmed ? trimmed : "Your family"
}

export function carpoolFeedStatusLabel(status: CarpoolFeedStatusKind): string {
  switch (status) {
    case "NONE":
      return "No carpool"
    case "AVAILABLE":
      return "Carpool available"
    case "REQUESTED":
      return "Requested"
    case "MEMBER":
      return "Member"
    case "OWNER":
      return "Owned"
  }
}

export function enableCarpoolConfirmMessage(feedName: string): string {
  return `This family will own the carpool for ${feedName} and will admit or decline join requests. Enable carpool?`
}
