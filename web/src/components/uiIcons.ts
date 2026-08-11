import type { LucideIcon } from "lucide-react"
import {
  Calendar,
  Car,
  ChevronRight,
  CircleEllipsis,
  LogOut,
  MapPin,
  Plus,
  Rss,
  Users,
} from "lucide-react"

/** Semantic icon names from design-tokens → Lucide (web). */
export const semanticIcons = {
  "icon.calendar": Calendar,
  "icon.carpool": Car,
  "icon.family": Users,
  "icon.more": CircleEllipsis,
  "icon.places": MapPin,
  "icon.feeds": Rss,
  "icon.signout": LogOut,
  "icon.add": Plus,
  "icon.chevron": ChevronRight,
} as const

export type SemanticIconName = keyof typeof semanticIcons

export function resolveSemanticIcon(name: SemanticIconName): LucideIcon {
  return semanticIcons[name]
}
