import { useEffect, useState, type ReactNode } from "react"
import { Loader2, Plus } from "lucide-react"

import type { AuthClient } from "@/api/authClient"
import type { AuthSessionHolder } from "@/api/authSession"
import { FamilyClient } from "@/api/familyClient"
import {
  isPlaceLocated,
  type ActivityFeed,
  type Adult,
  type CalendarCoverageAssignment,
  type CalendarItem,
  type CoverageStatus,
  type FamilyCircle,
  type FamilyMember,
  type Kid,
  type Place,
  feedSyncStatusLabel,
} from "@/api/types"
import {
  AccountSummaryRow,
  SettingsGroupLabel,
  SettingsRow,
  ShellNavButton,
} from "@/components/shellNav"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  advanceCalendarWindow,
  calendarSourceLabel,
  calendarWindowThrough,
  coerceEndsAfterStart,
  defaultCalendarWindow,
  ensureCalendarWindowCovers,
  formatEventWhen,
  mergeCalendarItems,
  validateManualEventTimes,
} from "@/components/eventTimes"
import {
  formatLeaveByEstimateLine,
  leaveByUnavailableLabel,
} from "@/components/leaveByDisplay"

type ShellDestination = "calendar" | "carpool" | "family" | "places" | "feeds"

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }

type EmptyMode = "choose" | "create" | "join"

type FamilyScreenProps = {
  session: AuthSessionHolder
  authClient?: AuthClient
  familyClient?: FamilyClient
  onSignedOut: () => void
}

function circleTitle(circle: FamilyCircle): string {
  return circle.name?.trim() ? circle.name : "Your family"
}

function memberLabel(member: FamilyMember): string {
  return member.displayName?.trim() ? member.displayName : member.email
}

/** Horizontal single-value field: label leading, control/value trailing. */
function FieldRow({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div
      data-testid="field-row"
      className="flex items-center justify-between gap-3"
    >
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <div className="min-w-0 flex-1 flex justify-end [&_select]:w-full [&_select]:max-w-xs">
        {children}
      </div>
    </div>
  )
}

function feedKidNames(feed: ActivityFeed, kids: Kid[]): string {
  if (feed.kidIds.length === 0) {
    return ""
  }
  const namesById = new Map(kids.map((kid) => [kid.id, kid.displayName]))
  return feed.kidIds
    .map((id) => namesById.get(id))
    .filter((name): name is string => Boolean(name?.trim()))
    .join(", ")
}

function eventKidNames(event: { kidIds: string[] }, kids: Kid[]): string {
  const namesById = new Map(kids.map((kid) => [kid.id, kid.displayName]))
  return event.kidIds
    .map((id) => namesById.get(id))
    .filter((name): name is string => Boolean(name?.trim()))
    .join(", ")
}

function calendarItemKey(item: CalendarItem): string {
  return `${item.source}-${item.id}`
}

function coverageStatusLabel(status: CoverageStatus): string {
  switch (status) {
    case "PENDING":
      return "Pending"
    case "CONFIRMED":
      return "Confirmed"
    case "DECLINED":
      return "Declined"
  }
}

function coverageAdultLabel(
  coverage: CalendarCoverageAssignment,
  members: FamilyMember[],
): string {
  if (coverage.coveringAdultDisplayName?.trim()) {
    return coverage.coveringAdultDisplayName.trim()
  }
  const member = members.find((m) => m.adultId === coverage.coveringAdultId)
  return member ? memberLabel(member) : "Adult"
}

function coverageKidNames(coverage: CalendarCoverageAssignment, kids: Kid[]): string {
  return eventKidNames({ kidIds: coverage.kidIds }, kids)
}

function toDatetimeLocalValue(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return ""
  }
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function fromDatetimeLocalValue(local: string): string {
  return new Date(local).toISOString()
}

function defaultNewEventStartsLocal(): string {
  return toDatetimeLocalValue(new Date(Date.now() + 15 * 60 * 1000).toISOString())
}

export function FamilyScreen({
  session,
  authClient,
  familyClient: familyClientProp,
  onSignedOut,
}: FamilyScreenProps) {
  // Default param `new FamilyClient()` would be a new instance every render and
  // retrigger the load effect forever (frozen "Loading…" / create form).
  const [familyClient] = useState(() => familyClientProp ?? new FamilyClient())
  const [status, setStatus] = useState<Status>({ kind: "loading" })
  const [circle, setCircle] = useState<FamilyCircle | null>(null)
  const [adult, setAdult] = useState<Adult | null>(() => session.getAdult())
  const [emptyMode, setEmptyMode] = useState<EmptyMode>("choose")
  const [adultDisplayName, setAdultDisplayName] = useState("")
  const [circleName, setCircleName] = useState("")
  const [inviteCodeInput, setInviteCodeInput] = useState("")
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [newKidName, setNewKidName] = useState("")
  const [editingKidId, setEditingKidId] = useState<string | null>(null)
  const [editingKidName, setEditingKidName] = useState("")
  const [newPlaceName, setNewPlaceName] = useState("")
  const [newPlaceAddress, setNewPlaceAddress] = useState("")
  const [editingPlaceId, setEditingPlaceId] = useState<string | null>(null)
  const [editingPlaceName, setEditingPlaceName] = useState("")
  const [editingPlaceAddress, setEditingPlaceAddress] = useState("")
  const [feeds, setFeeds] = useState<ActivityFeed[]>([])
  const [newFeedName, setNewFeedName] = useState("")
  const [newFeedUrl, setNewFeedUrl] = useState("")
  const [newFeedKidIds, setNewFeedKidIds] = useState<string[]>([])
  const [editingFeedId, setEditingFeedId] = useState<string | null>(null)
  const [editingFeedName, setEditingFeedName] = useState("")
  const [editingFeedUrl, setEditingFeedUrl] = useState("")
  const [editingFeedKidIds, setEditingFeedKidIds] = useState<string[]>([])
  const [calendarItems, setCalendarItems] = useState<CalendarItem[]>([])
  const [calendarLoadedTo, setCalendarLoadedTo] = useState(
    () => defaultCalendarWindow().to,
  )
  const [agendaKidFilter, setAgendaKidFilter] = useState<string | null>(null)
  const [newEventTitle, setNewEventTitle] = useState("")
  const [newEventStartsAt, setNewEventStartsAt] = useState(defaultNewEventStartsLocal)
  const [newEventEndsAt, setNewEventEndsAt] = useState("")
  const [newEventLocation, setNewEventLocation] = useState("")
  const [newEventKidIds, setNewEventKidIds] = useState<string[]>([])
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const [editingEventTitle, setEditingEventTitle] = useState("")
  const [editingEventStartsAt, setEditingEventStartsAt] = useState("")
  const [editingEventEndsAt, setEditingEventEndsAt] = useState("")
  const [editingEventLocation, setEditingEventLocation] = useState("")
  const [editingEventKidIds, setEditingEventKidIds] = useState<string[]>([])
  const [destination, setDestination] = useState<ShellDestination>("calendar")
  const [eventComposeOpen, setEventComposeOpen] = useState(false)
  const [assignCoverageDrafts, setAssignCoverageDrafts] = useState<
    Record<string, { adultId: string; kidIds: string[] }>
  >({})

  useEffect(() => {
    if (circle?.id) {
      setDestination("calendar")
    }
  }, [circle?.id])

  useEffect(() => {
    if (destination === "feeds" && circle?.role !== "ORGANIZER") {
      setDestination("calendar")
    }
  }, [destination, circle?.role])

  useEffect(() => {
    if (destination !== "calendar") {
      setEventComposeOpen(false)
    }
  }, [destination])

  async function reloadCalendar(token: string, loadedTo: string = calendarLoadedTo) {
    const window = calendarWindowThrough(loadedTo)
    setCalendarItems(await familyClient.listCalendar(token, window.from, window.to))
  }

  async function loadMoreCalendar() {
    setStatus({ kind: "loading" })
    try {
      const token = await requireToken()
      const page = advanceCalendarWindow(calendarLoadedTo)
      const more = await familyClient.listCalendar(token, page.from, page.to)
      setCalendarItems((current) => mergeCalendarItems(current, more))
      setCalendarLoadedTo(page.to)
      setStatus({ kind: "idle" })
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong",
      })
    }
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      const token = session.getAccessToken()
      if (!token) {
        setStatus({ kind: "error", message: "Not signed in" })
        return
      }
      setStatus({ kind: "loading" })
      try {
        const loaded = await familyClient.getCircle(token)
        if (cancelled) {
          return
        }
        setCircle(loaded)
        if (loaded) {
          try {
            const window = defaultCalendarWindow()
            const items = await familyClient.listCalendar(token, window.from, window.to)
            if (!cancelled) {
              setCalendarItems(items)
              setCalendarLoadedTo(window.to)
            }
          } catch {
            if (!cancelled) {
              setCalendarItems([])
              setCalendarLoadedTo(defaultCalendarWindow().to)
            }
          }
        } else {
          setCalendarItems([])
        }
        if (loaded?.role === "ORGANIZER") {
          try {
            const invite = await familyClient.getInvite(token)
            if (!cancelled) {
              setInviteCode(invite.code)
            }
          } catch {
            if (!cancelled) {
              setInviteCode(null)
            }
          }
          try {
            const loadedFeeds = await familyClient.listFeeds(token)
            if (!cancelled) {
              setFeeds(loadedFeeds)
            }
          } catch {
            if (!cancelled) {
              setFeeds([])
            }
          }
        } else {
          setInviteCode(null)
          setFeeds([])
        }
        setStatus({ kind: "idle" })
      } catch (error) {
        if (cancelled) {
          return
        }
        setStatus({
          kind: "error",
          message: error instanceof Error ? error.message : "Something went wrong",
        })
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [familyClient, session])

  async function requireToken(): Promise<string> {
    const token = session.getAccessToken()
    if (!token) {
      throw new Error("Not signed in")
    }
    return token
  }

  async function refreshAdult(token: string) {
    if (!authClient) {
      return
    }
    const me = await authClient.getMe(token)
    session.setSession(token, me)
    setAdult(me)
  }

  async function onCreateCircle() {
    setStatus({ kind: "loading" })
    try {
      const token = await requireToken()
      const created = await familyClient.createCircle(token, {
        adultDisplayName: adultDisplayName.trim(),
        name: circleName.trim() ? circleName.trim() : null,
      })
      setCircle(created)
      setFeeds([])
      setCalendarItems([])
      setCalendarLoadedTo(defaultCalendarWindow().to)
      const invite = await familyClient.getInvite(token)
      setInviteCode(invite.code)
      await refreshAdult(token)
      setStatus({ kind: "idle" })
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong",
      })
    }
  }

  async function onJoinCircle() {
    setStatus({ kind: "loading" })
    try {
      const token = await requireToken()
      const joined = await familyClient.joinCircle(token, {
        code: inviteCodeInput.trim(),
        adultDisplayName: adultDisplayName.trim() ? adultDisplayName.trim() : null,
      })
      setCircle(joined)
      setInviteCode(null)
      setFeeds([])
      setCalendarItems([])
      setCalendarLoadedTo(defaultCalendarWindow().to)
      await refreshAdult(token)
      setStatus({ kind: "idle" })
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong",
      })
    }
  }

  async function onRegenerateInvite() {
    setStatus({ kind: "loading" })
    try {
      const token = await requireToken()
      const invite = await familyClient.regenerateInvite(token)
      setInviteCode(invite.code)
      setStatus({ kind: "idle" })
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong",
      })
    }
  }

  async function onLeaveCircle() {
    setStatus({ kind: "loading" })
    try {
      const token = await requireToken()
      await familyClient.leaveCircle(token)
      setCircle(null)
      setInviteCode(null)
      setFeeds([])
      setEmptyMode("choose")
      setStatus({ kind: "idle" })
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong",
      })
    }
  }

  async function onUpdateMemberRole(member: FamilyMember, role: "ORGANIZER" | "CAREGIVER") {
    setStatus({ kind: "loading" })
    try {
      const token = await requireToken()
      const updated = await familyClient.updateMemberRole(token, member.adultId, role)
      setCircle(updated)
      setStatus({ kind: "idle" })
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong",
      })
    }
  }

  async function onRemoveMember(member: FamilyMember) {
    setStatus({ kind: "loading" })
    try {
      const token = await requireToken()
      await familyClient.removeMember(token, member.adultId)
      setCircle((current) =>
        current
          ? {
              ...current,
              members: current.members.filter((item) => item.adultId !== member.adultId),
            }
          : current,
      )
      setStatus({ kind: "idle" })
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong",
      })
    }
  }

  async function onAddKid() {
    setStatus({ kind: "loading" })
    try {
      const token = await requireToken()
      const kid = await familyClient.addKid(token, newKidName.trim())
      setCircle((current) =>
        current ? { ...current, kids: [...current.kids, kid] } : current,
      )
      setNewKidName("")
      setStatus({ kind: "idle" })
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong",
      })
    }
  }

  async function onSaveKid(kid: Kid) {
    setStatus({ kind: "loading" })
    try {
      const token = await requireToken()
      const updated = await familyClient.updateKid(token, kid.id, editingKidName.trim())
      setCircle((current) =>
        current
          ? {
              ...current,
              kids: current.kids.map((item) => (item.id === kid.id ? updated : item)),
            }
          : current,
      )
      setEditingKidId(null)
      setEditingKidName("")
      setStatus({ kind: "idle" })
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong",
      })
    }
  }

  async function onRemoveKid(kidId: string) {
    setStatus({ kind: "loading" })
    try {
      const token = await requireToken()
      await familyClient.deleteKid(token, kidId)
      setCircle((current) =>
        current
          ? { ...current, kids: current.kids.filter((kid) => kid.id !== kidId) }
          : current,
      )
      setStatus({ kind: "idle" })
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong",
      })
    }
  }

  async function onAddPlace() {
    setStatus({ kind: "loading" })
    try {
      const token = await requireToken()
      const place = await familyClient.addPlace(
        token,
        newPlaceName.trim(),
        newPlaceAddress.trim(),
      )
      setCircle((current) =>
        current ? { ...current, places: [...current.places, place] } : current,
      )
      setNewPlaceName("")
      setNewPlaceAddress("")
      setStatus({ kind: "idle" })
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong",
      })
    }
  }

  async function onSavePlace(place: Place) {
    setStatus({ kind: "loading" })
    try {
      const token = await requireToken()
      const updated = await familyClient.updatePlace(
        token,
        place.id,
        editingPlaceName.trim(),
        editingPlaceAddress.trim(),
      )
      setCircle((current) =>
        current
          ? {
              ...current,
              places: current.places.map((item) =>
                item.id === place.id ? updated : item,
              ),
            }
          : current,
      )
      setEditingPlaceId(null)
      setEditingPlaceName("")
      setEditingPlaceAddress("")
      setStatus({ kind: "idle" })
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong",
      })
    }
  }

  async function onRemovePlace(placeId: string) {
    setStatus({ kind: "loading" })
    try {
      const token = await requireToken()
      await familyClient.deletePlace(token, placeId)
      setCircle((current) =>
        current
          ? {
              ...current,
              places: current.places.filter((place) => place.id !== placeId),
            }
          : current,
      )
      setStatus({ kind: "idle" })
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong",
      })
    }
  }

  async function onLocatePlace(placeId: string) {
    setStatus({ kind: "loading" })
    try {
      const token = await requireToken()
      const updated = await familyClient.locatePlace(token, placeId)
      setCircle((current) =>
        current
          ? {
              ...current,
              places: current.places.map((place) =>
                place.id === placeId ? updated : place,
              ),
            }
          : current,
      )
      setStatus({ kind: "idle" })
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong",
      })
    }
  }

  function toggleKidId(
    kidId: string,
    selected: string[],
    setSelected: (next: string[]) => void,
  ) {
    setSelected(
      selected.includes(kidId)
        ? selected.filter((id) => id !== kidId)
        : [...selected, kidId],
    )
  }

  async function onAddFeed() {
    setStatus({ kind: "loading" })
    try {
      const token = await requireToken()
      const feed = await familyClient.createFeed(
        token,
        newFeedName.trim(),
        newFeedUrl.trim(),
        newFeedKidIds,
      )
      setFeeds((current) => [...current, feed])
      setNewFeedName("")
      setNewFeedUrl("")
      setNewFeedKidIds([])
      await reloadCalendar(token)
      setStatus({ kind: "idle" })
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong",
      })
    }
  }

  async function onSaveFeed(feed: ActivityFeed) {
    setStatus({ kind: "loading" })
    try {
      const token = await requireToken()
      const updated = await familyClient.updateFeed(
        token,
        feed.id,
        editingFeedName.trim(),
        editingFeedUrl.trim(),
        editingFeedKidIds,
      )
      setFeeds((current) =>
        current.map((item) => (item.id === feed.id ? updated : item)),
      )
      setEditingFeedId(null)
      setEditingFeedName("")
      setEditingFeedUrl("")
      setEditingFeedKidIds([])
      await reloadCalendar(token)
      setStatus({ kind: "idle" })
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong",
      })
    }
  }

  async function onRemoveFeed(feedId: string) {
    setStatus({ kind: "loading" })
    try {
      const token = await requireToken()
      await familyClient.deleteFeed(token, feedId)
      setFeeds((current) => current.filter((feed) => feed.id !== feedId))
      await reloadCalendar(token)
      setStatus({ kind: "idle" })
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong",
      })
    }
  }

  async function onSyncFeed(feedId: string) {
    setStatus({ kind: "loading" })
    try {
      const token = await requireToken()
      const updated = await familyClient.syncFeed(token, feedId)
      setFeeds((current) =>
        current.map((feed) => (feed.id === feedId ? updated : feed)),
      )
      await reloadCalendar(token)
      setStatus({ kind: "idle" })
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong",
      })
    }
  }

  async function onRefreshFeeds() {
    setStatus({ kind: "loading" })
    try {
      const token = await requireToken()
      const loadedFeeds = await familyClient.listFeeds(token)
      setFeeds(loadedFeeds)
      setStatus({ kind: "idle" })
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong",
      })
    }
  }

  async function onAddEvent() {
    const validation = validateManualEventTimes(newEventStartsAt, newEventEndsAt)
    if (validation) {
      setStatus({ kind: "error", message: validation })
      return
    }
    setStatus({ kind: "loading" })
    try {
      const token = await requireToken()
      const startsAt = fromDatetimeLocalValue(newEventStartsAt.trim())
      const endsAt = newEventEndsAt.trim()
        ? fromDatetimeLocalValue(newEventEndsAt.trim())
        : null
      await familyClient.createEvent(
        token,
        newEventTitle.trim(),
        startsAt,
        newEventKidIds,
        endsAt,
        newEventLocation.trim() ? newEventLocation.trim() : null,
      )
      const nextTo = ensureCalendarWindowCovers(calendarLoadedTo, startsAt)
      setCalendarLoadedTo(nextTo)
      await reloadCalendar(token, nextTo)
      setNewEventTitle("")
      setNewEventStartsAt(defaultNewEventStartsLocal())
      setNewEventEndsAt("")
      setNewEventLocation("")
      setNewEventKidIds([])
      setEventComposeOpen(false)
      setStatus({ kind: "idle" })
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong",
      })
    }
  }

  async function onSaveEvent(eventId: string) {
    const validation = validateManualEventTimes(editingEventStartsAt, editingEventEndsAt)
    if (validation) {
      setStatus({ kind: "error", message: validation })
      return
    }
    setStatus({ kind: "loading" })
    try {
      const token = await requireToken()
      const startsAt = fromDatetimeLocalValue(editingEventStartsAt.trim())
      const endsAt = editingEventEndsAt.trim()
        ? fromDatetimeLocalValue(editingEventEndsAt.trim())
        : null
      await familyClient.updateEvent(
        token,
        eventId,
        editingEventTitle.trim(),
        startsAt,
        editingEventKidIds,
        endsAt,
        editingEventLocation.trim() ? editingEventLocation.trim() : null,
      )
      const nextTo = ensureCalendarWindowCovers(calendarLoadedTo, startsAt)
      setCalendarLoadedTo(nextTo)
      await reloadCalendar(token, nextTo)
      setEditingEventId(null)
      setEditingEventTitle("")
      setEditingEventStartsAt("")
      setEditingEventEndsAt("")
      setEditingEventLocation("")
      setEditingEventKidIds([])
      setEventComposeOpen(false)
      setStatus({ kind: "idle" })
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong",
      })
    }
  }

  async function onRemoveEvent(eventId: string) {
    setStatus({ kind: "loading" })
    try {
      const token = await requireToken()
      await familyClient.deleteEvent(token, eventId)
      await reloadCalendar(token)
      setStatus({ kind: "idle" })
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong",
      })
    }
  }

  function replaceCalendarItem(updated: CalendarItem) {
    setCalendarItems((current) =>
      current.map((row) =>
        row.source === updated.source && row.id === updated.id ? updated : row,
      ),
    )
  }

  function updateAssignCoverageDraft(
    itemKey: string,
    patch: Partial<{ adultId: string; kidIds: string[] }>,
  ) {
    setAssignCoverageDrafts((current) => {
      const existing = current[itemKey] ?? { adultId: "", kidIds: [] as string[] }
      return { ...current, [itemKey]: { ...existing, ...patch } }
    })
  }

  function coverageAssignState(
    item: CalendarItem,
    itemKey: string,
  ): { adultId: string; kidIds: string[]; soleAdult: boolean; soleKid: boolean } {
    const soleAdult = circle!.members.length === 1
    const soleKid = item.uncoveredKidIds.length === 1
    const stored = assignCoverageDrafts[itemKey]
    const defaultAdultId =
      adult?.id && circle!.members.some((member) => member.adultId === adult.id)
        ? adult.id
        : (circle!.members[0]?.adultId ?? "")
    const adultId = soleAdult
      ? circle!.members[0]!.adultId
      : stored?.adultId || defaultAdultId
    const kidIds = soleKid
      ? item.uncoveredKidIds
      : (stored?.kidIds ?? [])
    return { adultId, kidIds, soleAdult, soleKid }
  }

  async function onSetDefaultLeaveFrom(placeId: string | null) {
    if (circle?.defaultLeaveFromPlaceId === placeId) {
      return
    }
    setStatus({ kind: "loading" })
    try {
      const token = await requireToken()
      const updated = await familyClient.setDefaultLeaveFrom(token, { placeId })
      setCircle(updated)
      setStatus({ kind: "idle" })
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong",
      })
    }
  }

  async function onAssignCoverage(
    item: CalendarItem,
    coveringAdultId: string,
    kidIds: string[],
  ) {
    setStatus({ kind: "loading" })
    try {
      const token = await requireToken()
      const updated = await familyClient.assignCalendarCoverage(
        token,
        item.source,
        item.id,
        { coveringAdultId, kidIds },
      )
      replaceCalendarItem(updated)
      setAssignCoverageDrafts((current) => {
        const next = { ...current }
        delete next[calendarItemKey(item)]
        return next
      })
      setStatus({ kind: "idle" })
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong",
      })
    }
  }

  async function onConfirmCoverage(assignmentId: string) {
    setStatus({ kind: "loading" })
    try {
      const token = await requireToken()
      const updated = await familyClient.confirmCalendarCoverage(token, assignmentId)
      replaceCalendarItem(updated)
      setStatus({ kind: "idle" })
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong",
      })
    }
  }

  async function onDeclineCoverage(assignmentId: string) {
    setStatus({ kind: "loading" })
    try {
      const token = await requireToken()
      const updated = await familyClient.declineCalendarCoverage(token, assignmentId)
      replaceCalendarItem(updated)
      setStatus({ kind: "idle" })
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong",
      })
    }
  }

  async function onRemoveCoverage(assignmentId: string) {
    setStatus({ kind: "loading" })
    try {
      const token = await requireToken()
      const updated = await familyClient.removeCalendarCoverage(token, assignmentId)
      replaceCalendarItem(updated)
      setStatus({ kind: "idle" })
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong",
      })
    }
  }

  async function onSetCalendarLeaveFrom(item: CalendarItem, placeId: string) {
    if (item.leaveFromPlaceId === placeId) {
      return
    }
    setStatus({ kind: "loading" })
    try {
      const token = await requireToken()
      const updated = await familyClient.setCalendarLeaveFrom(token, item.source, item.id, {
        leaveFromPlaceId: placeId,
      })
      setCalendarItems((current) =>
        current.map((row) =>
          row.source === item.source && row.id === item.id ? updated : row,
        ),
      )
      setStatus({ kind: "idle" })
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong",
      })
    }
  }

  function openEditEvent(item: CalendarItem) {
    setEditingEventId(item.id)
    setEditingEventTitle(item.title)
    setEditingEventStartsAt(toDatetimeLocalValue(item.startsAt))
    setEditingEventEndsAt(item.endsAt ? toDatetimeLocalValue(item.endsAt) : "")
    setEditingEventLocation(item.location ?? "")
    setEditingEventKidIds([...item.kidIds])
    setEventComposeOpen(true)
  }

  async function onSignOut() {
    setStatus({ kind: "loading" })
    const token = session.getAccessToken()
    try {
      if (token && authClient) {
        await authClient.logout(token)
      }
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong",
      })
      return
    }
    session.clear()
    onSignedOut()
  }

  if (!circle && status.kind === "loading") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your family</CardTitle>
          <CardDescription>Loading…</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (!circle) {
    const needsName = !adult?.displayName
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            {emptyMode === "join"
              ? "Join a family"
              : emptyMode === "create"
                ? "Create your family"
                : "Your family"}
          </CardTitle>
          <CardDescription>
            Signed in as {adult?.email ?? "unknown"}. Create a circle or join with
            an invite code.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {emptyMode === "choose" ? (
            <>
              <Button
                type="button"
                onClick={() => {
                  setEmptyMode("create")
                  setStatus({ kind: "idle" })
                }}
                disabled={status.kind === "loading"}
              >
                Create family
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEmptyMode("join")
                  setStatus({ kind: "idle" })
                }}
                disabled={status.kind === "loading"}
              >
                Have an invite code?
              </Button>
            </>
          ) : null}

          {emptyMode === "create" ? (
            <>
              <Input
                aria-label="Your name"
                value={adultDisplayName}
                onChange={(event) => setAdultDisplayName(event.target.value)}
                placeholder="Your name"
                disabled={status.kind === "loading"}
              />
              <Input
                aria-label="Your family (optional)"
                value={circleName}
                onChange={(event) => setCircleName(event.target.value)}
                placeholder="Your family"
                disabled={status.kind === "loading"}
              />
              <Button
                type="button"
                onClick={() => void onCreateCircle()}
                disabled={status.kind === "loading" || !adultDisplayName.trim()}
              >
                {status.kind === "loading" ? "Creating…" : "Create family"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEmptyMode("choose")}
                disabled={status.kind === "loading"}
              >
                Back
              </Button>
            </>
          ) : null}

          {emptyMode === "join" ? (
            <>
              <Input
                aria-label="Invite code"
                value={inviteCodeInput}
                onChange={(event) => setInviteCodeInput(event.target.value)}
                placeholder="Invite code"
                disabled={status.kind === "loading"}
              />
              {needsName ? (
                <Input
                  aria-label="Your name"
                  value={adultDisplayName}
                  onChange={(event) => setAdultDisplayName(event.target.value)}
                  placeholder="Your name"
                  disabled={status.kind === "loading"}
                />
              ) : null}
              <Button
                type="button"
                onClick={() => void onJoinCircle()}
                disabled={
                  status.kind === "loading" ||
                  !inviteCodeInput.trim() ||
                  (needsName && !adultDisplayName.trim())
                }
              >
                {status.kind === "loading" ? "Joining…" : "Join family"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEmptyMode("choose")}
                disabled={status.kind === "loading"}
              >
                Back
              </Button>
            </>
          ) : null}

          {status.kind === "error" ? (
            <p role="alert" className="text-sm text-destructive">
              {status.message}
            </p>
          ) : null}

          <Button
            type="button"
            variant="outline"
            onClick={() => void onSignOut()}
            disabled={status.kind === "loading"}
          >
            Sign out
          </Button>
        </CardContent>
      </Card>
    )
  }

  const isOrganizer = circle.role === "ORGANIZER"
  const datetimeMin = toDatetimeLocalValue(new Date().toISOString())
  const newEventEndsMin =
    newEventStartsAt.trim() && newEventStartsAt > datetimeMin
      ? newEventStartsAt
      : datetimeMin
  const editingEventEndsMin =
    editingEventStartsAt.trim() && editingEventStartsAt > datetimeMin
      ? editingEventStartsAt
      : datetimeMin
  const visibleCalendarItems =
    agendaKidFilter == null
      ? calendarItems
      : calendarItems.filter((item) => item.kidIds.includes(agendaKidFilter))
  const locatedPlaces = circle.places.filter(isPlaceLocated)

  const contentTitle =
    destination === "calendar"
      ? "Calendar"
      : destination === "carpool"
        ? "Carpool"
        : destination === "family"
          ? circleTitle(circle)
          : destination === "places"
            ? "Places"
            : "Feeds"

  return (
    <div className="flex w-full flex-col gap-4 md:flex-row md:items-start">
      <aside
        aria-label="App navigation"
        className="flex w-full shrink-0 flex-col gap-[var(--fc-space-lg)] rounded-[var(--fc-radius-lg)] border border-[var(--fc-border)] bg-[var(--fc-surface-raised)] p-[var(--fc-space-md)] md:w-56"
      >
        <nav aria-label="Primary" className="flex flex-col gap-[var(--fc-space-xs)]">
          <ShellNavButton
            label="Calendar"
            active={destination === "calendar"}
            onClick={() => setDestination("calendar")}
          />
          <ShellNavButton
            label="Carpool"
            active={destination === "carpool"}
            onClick={() => setDestination("carpool")}
          />
          <ShellNavButton
            label="Family"
            active={destination === "family"}
            onClick={() => setDestination("family")}
          />
        </nav>

        <section
          aria-label="Settings"
          className="fc-more flex flex-col gap-[var(--fc-space-md)] border-t border-[var(--fc-border)] pt-[var(--fc-space-md)]"
        >
          <SettingsGroupLabel>Settings</SettingsGroupLabel>
          <div aria-label="General" className="flex flex-col gap-[var(--fc-space-xs)]">
            <SettingsGroupLabel>General</SettingsGroupLabel>
            <SettingsRow
              label="Places"
              icon="icon.places"
              active={destination === "places"}
              onClick={() => setDestination("places")}
            />
            {isOrganizer ? (
              <SettingsRow
                label="Feeds"
                icon="icon.feeds"
                active={destination === "feeds"}
                onClick={() => setDestination("feeds")}
              />
            ) : null}
          </div>
          <div aria-label="Account" className="flex flex-col gap-[var(--fc-space-xs)]">
            <SettingsGroupLabel>Account</SettingsGroupLabel>
            <AccountSummaryRow
              email={adult?.email ?? ""}
              role={circle.role}
              icon="icon.family"
            />
            <SettingsRow
              label="Sign out"
              icon="icon.signout"
              onClick={() => void onSignOut()}
              chevron={false}
              danger
            />
          </div>
        </section>
      </aside>

      <Card className="min-w-0 flex-1">
        <CardHeader
          className={
            destination === "calendar"
              ? "flex flex-row items-start justify-between gap-3 space-y-0"
              : undefined
          }
        >
          <div className="flex min-w-0 flex-col gap-1.5">
            <CardTitle>{contentTitle}</CardTitle>
            {destination === "family" ? (
              <CardDescription>
                {adult?.displayName ? `${adult.displayName} · ` : null}
                {adult?.email} · {circle.role}
              </CardDescription>
            ) : null}
          </div>
          {destination === "calendar" ? (
            <Button
              type="button"
              size="sm"
              aria-label="Add event"
              onClick={() => {
                setEditingEventId(null)
                setEditingEventTitle("")
                setEditingEventStartsAt("")
                setEditingEventEndsAt("")
                setEditingEventLocation("")
                setEditingEventKidIds([])
                setNewEventTitle("")
                setNewEventStartsAt(defaultNewEventStartsLocal())
                setNewEventEndsAt("")
                setNewEventLocation("")
                setNewEventKidIds([])
                setEventComposeOpen(true)
              }}
              disabled={status.kind === "loading"}
            >
              <Plus className="size-4" aria-hidden />
              Add
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {destination === "family" ? (
            <>
{isOrganizer && inviteCode ? (
          <section aria-label="Invite code" className="flex flex-col gap-2">
            <p className="text-sm">
              Invite code: <span className="font-mono">{inviteCode}</span>
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void onRegenerateInvite()}
              disabled={status.kind === "loading"}
            >
              Regenerate code
            </Button>
          </section>
        ) : null}

        <section aria-label="Members" className="flex flex-col gap-3">
          <p className="text-sm font-medium">Members</p>
          <ul className="flex flex-col gap-2">
            {circle.members.map((member) => {
              const isSelf = member.adultId === adult?.id
              return (
                <li
                  key={member.adultId}
                  className="flex flex-col gap-2 sm:flex-row sm:items-center"
                >
                  <span className="flex-1 text-sm">
                    {memberLabel(member)} · {member.role}
                    {isSelf ? " (you)" : ""}
                  </span>
                  {isOrganizer && !isSelf ? (
                    <>
                      {member.role === "CAREGIVER" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void onUpdateMemberRole(member, "ORGANIZER")}
                          disabled={status.kind === "loading"}
                        >
                          Promote
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void onUpdateMemberRole(member, "CAREGIVER")}
                          disabled={status.kind === "loading"}
                        >
                          Demote
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void onRemoveMember(member)}
                        disabled={status.kind === "loading"}
                      >
                        Remove
                      </Button>
                    </>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </section>

        <section aria-label="Kids" className="flex flex-col gap-3">
          {circle.kids.length === 0 ? (
            <p className="text-sm text-muted-foreground">No kids yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {circle.kids.map((kid) => (
                <li key={kid.id} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  {isOrganizer && editingKidId === kid.id ? (
                    <>
                      <Input
                        aria-label={`Rename ${kid.displayName}`}
                        value={editingKidName}
                        onChange={(event) => setEditingKidName(event.target.value)}
                        disabled={status.kind === "loading"}
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => void onSaveKid(kid)}
                        disabled={status.kind === "loading" || !editingKidName.trim()}
                      >
                        Save
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingKidId(null)
                          setEditingKidName("")
                        }}
                        disabled={status.kind === "loading"}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm">{kid.displayName}</span>
                      {isOrganizer ? (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingKidId(kid.id)
                              setEditingKidName(kid.displayName)
                            }}
                            disabled={status.kind === "loading"}
                          >
                            Rename
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => void onRemoveKid(kid.id)}
                            disabled={status.kind === "loading"}
                          >
                            Remove
                          </Button>
                        </>
                      ) : null}
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {isOrganizer ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              aria-label="New kid name"
              value={newKidName}
              onChange={(event) => setNewKidName(event.target.value)}
              placeholder="Kid display name"
              disabled={status.kind === "loading"}
            />
            <Button
              type="button"
              onClick={() => void onAddKid()}
              disabled={status.kind === "loading" || !newKidName.trim()}
            >
              Add kid
            </Button>
          </div>
        ) : null}

                      <Button
                type="button"
                variant="outline"
                onClick={() => void onLeaveCircle()}
                disabled={status.kind === "loading"}
              >
                Leave family
              </Button>
            </>
          ) : null}

          {destination === "places" ? (
            <>
<section aria-label="Places" className="flex flex-col gap-3">
          <p className="text-sm font-medium">Places</p>
          {circle.places.length === 0 ? (
            <p className="text-sm text-muted-foreground">No places yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {circle.places.map((place) => (
                <li key={place.id} className="flex flex-col gap-2">
                  {editingPlaceId === place.id ? (
                    <>
                      <Input
                        aria-label={`Rename place ${place.name}`}
                        value={editingPlaceName}
                        onChange={(event) => setEditingPlaceName(event.target.value)}
                        disabled={status.kind === "loading"}
                      />
                      <Input
                        aria-label={`Edit address for ${place.name}`}
                        value={editingPlaceAddress}
                        onChange={(event) => setEditingPlaceAddress(event.target.value)}
                        disabled={status.kind === "loading"}
                      />
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => void onSavePlace(place)}
                          disabled={
                            status.kind === "loading" ||
                            !editingPlaceName.trim() ||
                            !editingPlaceAddress.trim()
                          }
                        >
                          Save
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingPlaceId(null)
                            setEditingPlaceName("")
                            setEditingPlaceAddress("")
                          }}
                          disabled={status.kind === "loading"}
                        >
                          Cancel
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <span className="flex-1 text-sm">
                        {place.name}
                        <span className="block text-muted-foreground">{place.address}</span>
                        <span className="block text-xs text-muted-foreground">
                          {isPlaceLocated(place) ? "Located" : "Not located"}
                        </span>
                      </span>
                      {!isPlaceLocated(place) ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void onLocatePlace(place.id)}
                          disabled={status.kind === "loading"}
                        >
                          Retry locate
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingPlaceId(place.id)
                          setEditingPlaceName(place.name)
                          setEditingPlaceAddress(place.address)
                        }}
                        disabled={status.kind === "loading"}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void onRemovePlace(place.id)}
                        disabled={status.kind === "loading"}
                      >
                        Remove place
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label="Default leave-from" className="flex flex-col gap-2">
          <FieldRow label="My default leave-from">
            <select
              aria-label="My default leave-from"
              className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
              value={circle.defaultLeaveFromPlaceId ?? ""}
              onChange={(event) => {
                const placeId = event.target.value ? event.target.value : null
                void onSetDefaultLeaveFrom(placeId)
              }}
              disabled={status.kind === "loading"}
            >
              <option value="">None</option>
              {locatedPlaces.length === 0 ? (
                <option value="" disabled>
                  No located places yet
                </option>
              ) : (
                locatedPlaces.map((place) => (
                  <option key={place.id} value={place.id}>
                    {place.name}
                  </option>
                ))
              )}
            </select>
          </FieldRow>
        </section>

        <div className="flex flex-col gap-2">
          <Input
            aria-label="New place name"
            value={newPlaceName}
            onChange={(event) => setNewPlaceName(event.target.value)}
            placeholder="Place name (e.g. Mom's house)"
            disabled={status.kind === "loading"}
          />
          <Input
            aria-label="New place address"
            value={newPlaceAddress}
            onChange={(event) => setNewPlaceAddress(event.target.value)}
            placeholder="Address"
            disabled={status.kind === "loading"}
          />
          <Button
            type="button"
            onClick={() => void onAddPlace()}
            disabled={
              status.kind === "loading" ||
              !newPlaceName.trim() ||
              !newPlaceAddress.trim()
            }
          >
            Add place
          </Button>
        </div>

                    </>
          ) : null}

          {destination === "calendar" ? (
            <>
<section aria-label="Agenda" className="flex flex-col gap-[var(--fc-space-xl)]">
          <p className="text-sm font-medium">Agenda</p>
          {status.kind === "error" ? (
            <p role="alert" className="text-sm text-destructive">
              {status.message}
            </p>
          ) : null}
          {circle.kids.length > 0 ? (
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label="Filter agenda by kid"
              data-testid="agenda-kid-filter"
            >
              <Button
                type="button"
                size="sm"
                variant={agendaKidFilter == null ? "default" : "outline"}
                onClick={() => setAgendaKidFilter(null)}
                disabled={status.kind === "loading"}
              >
                All kids
              </Button>
              {circle.kids.map((kid) => (
                <Button
                  key={kid.id}
                  type="button"
                  size="sm"
                  variant={agendaKidFilter === kid.id ? "default" : "outline"}
                  onClick={() => setAgendaKidFilter(kid.id)}
                  disabled={status.kind === "loading"}
                >
                  {kid.displayName}
                </Button>
              ))}
            </div>
          ) : null}
          {visibleCalendarItems.length === 0 ? (
            // While calendar list is busy, do not claim the window is empty —
            // busy feedback lives on Load more → Loading….
            status.kind === "loading" && !eventComposeOpen ? null : (
              <p className="text-sm text-muted-foreground">
                No events in the loaded window.
              </p>
            )
          ) : (
            <ul
              data-testid="agenda-list"
              className="mt-[var(--fc-space-md)] flex flex-col gap-[var(--fc-space-2xl)]"
            >
              {visibleCalendarItems.map((item) => {
                const kidsLabel = eventKidNames(item, circle.kids)
                const sourceLabel = calendarSourceLabel(item.source, item.feedName)
                const isManual = item.source === "MANUAL"
                const leaveByLine =
                  item.leaveByStatus === "OK" && item.leaveByAt
                    ? formatLeaveByEstimateLine(item.leaveByAt)
                    : leaveByUnavailableLabel(item.leaveByReason)
                const needsOrigin =
                  item.leaveByStatus === "UNAVAILABLE" &&
                  item.leaveByReason === "NO_ORIGIN"
                const itemKey = calendarItemKey(item)
                const activeCoverages = item.coverages.filter(
                  (coverage) =>
                    coverage.status === "PENDING" || coverage.status === "CONFIRMED",
                )
                const pendingForSelf = activeCoverages.find(
                  (coverage) =>
                    coverage.status === "PENDING" && coverage.coveringAdultId === adult?.id,
                )
                const assignDraft = coverageAssignState(item, itemKey)
                const locatedForItem = circle.places.filter(isPlaceLocated)
                const uncoveredKidNames = eventKidNames(
                  { kidIds: item.uncoveredKidIds },
                  circle.kids,
                )
                return (
                  <li
                    key={`${item.source}-${item.id}`}
                    data-testid={`agenda-item-${item.source}-${item.id}`}
                    className="flex flex-col gap-3 border-b border-[var(--fc-border)] pb-[var(--fc-space-xl)] last:border-b-0 last:pb-0"
                  >
                    {/* Primary — title / when / location */}
                    <div
                      data-testid="agenda-band-primary"
                      className="flex flex-col gap-1"
                    >
                      <span className="text-sm font-medium text-foreground">
                        {item.title}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {formatEventWhen(item.startsAt, item.endsAt)}
                      </span>
                      {item.location ? (
                        <span className="text-xs text-muted-foreground">
                          {item.location}
                        </span>
                      ) : null}
                    </div>

                    {/* Travel / origin — leave-by + Leave from (+ Open Places) */}
                    <div
                      data-testid="agenda-band-travel"
                      className="flex flex-col gap-2"
                    >
                      <span
                        className="text-xs text-muted-foreground"
                        data-testid={`leave-by-${item.source}-${item.id}`}
                      >
                        {leaveByLine}
                      </span>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <div className="flex-1">
                          <FieldRow label="Leave from">
                            {locatedForItem.length <= 1 ? (
                              <span
                                className="flex h-9 max-w-xs items-center justify-end px-1 text-sm text-foreground"
                                data-testid={`leave-from-label-${item.source}-${item.id}`}
                              >
                                {item.leaveFromPlaceName ??
                                  locatedForItem[0]?.name ??
                                  (circle.places.length === 0
                                    ? "No places yet"
                                    : "No located places yet")}
                              </span>
                            ) : (
                              <select
                                aria-label={`Leave from for ${item.title}`}
                                className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
                                value={item.leaveFromPlaceId ?? ""}
                                onChange={(event) => {
                                  const placeId = event.target.value
                                  if (placeId) {
                                    void onSetCalendarLeaveFrom(item, placeId)
                                  }
                                }}
                                disabled={
                                  status.kind === "loading" || circle.places.length === 0
                                }
                              >
                                {!item.leaveFromPlaceId ? (
                                  <option value="">Choose a located place</option>
                                ) : null}
                                {circle.places.map((place) => (
                                  <option
                                    key={place.id}
                                    value={place.id}
                                    disabled={!isPlaceLocated(place)}
                                  >
                                    {isPlaceLocated(place)
                                      ? place.name
                                      : `${place.name} (not located)`}
                                  </option>
                                ))}
                              </select>
                            )}
                          </FieldRow>
                        </div>
                        {needsOrigin ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setDestination("places")}
                          >
                            Open Places
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    {/* People / source */}
                    <div
                      data-testid="agenda-band-people"
                      className="flex flex-col gap-1"
                    >
                      <span className="text-xs text-muted-foreground">
                        {sourceLabel}
                      </span>
                      {kidsLabel ? (
                        <span className="text-xs text-muted-foreground">
                          {kidsLabel}
                        </span>
                      ) : null}
                    </div>

                    {/* Coverage / actions — spacing group; one situational primary CTA */}
                    <div
                      data-testid="agenda-band-coverage"
                      className="flex flex-col gap-2"
                    >
                      {activeCoverages.length > 0 ? (
                        <ul className="flex flex-col gap-2">
                          {activeCoverages.map((coverage) => (
                            <li
                              key={coverage.id}
                              className="flex flex-col gap-2 sm:flex-row sm:items-center"
                            >
                              <span className="flex-1 text-xs text-muted-foreground">
                                {coverageAdultLabel(coverage, circle.members)} ·{" "}
                                {coverageKidNames(coverage, circle.kids)} ·{" "}
                                {coverageStatusLabel(coverage.status)}
                              </span>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => void onRemoveCoverage(coverage.id)}
                                disabled={status.kind === "loading"}
                              >
                                Remove coverage
                              </Button>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {item.uncoveredKidIds.length > 0 ? (
                        <p className="text-xs text-destructive">
                          Needs coverage
                          {item.uncoveredKidIds.length > 0 && uncoveredKidNames
                            ? `: ${uncoveredKidNames}`
                            : ""}
                        </p>
                      ) : null}
                      {pendingForSelf ? (
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Button
                            type="button"
                            size="sm"
                            data-testid="agenda-cta-primary"
                            onClick={() => void onConfirmCoverage(pendingForSelf.id)}
                            disabled={status.kind === "loading"}
                          >
                            Confirm coverage
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => void onDeclineCoverage(pendingForSelf.id)}
                            disabled={status.kind === "loading"}
                          >
                            Decline coverage
                          </Button>
                        </div>
                      ) : null}
                      {item.uncoveredKidIds.length > 0 &&
                      circle.members.length > 0 ? (
                        <div className="flex flex-col gap-2">
                          {assignDraft.soleAdult ? null : (
                            <FieldRow label="Covering adult">
                              <select
                                aria-label={`Covering adult for ${item.title}`}
                                className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
                                value={assignDraft.adultId}
                                onChange={(event) =>
                                  updateAssignCoverageDraft(itemKey, {
                                    adultId: event.target.value,
                                  })
                                }
                                disabled={status.kind === "loading"}
                              >
                                {circle.members.map((member) => (
                                  <option key={member.adultId} value={member.adultId}>
                                    {memberLabel(member)}
                                  </option>
                                ))}
                              </select>
                            </FieldRow>
                          )}
                          {assignDraft.soleKid ? null : (
                            <fieldset className="flex flex-col gap-1">
                              <legend className="text-xs text-muted-foreground">
                                Uncovered kids
                              </legend>
                              {item.uncoveredKidIds.map((kidId) => {
                                const kid = circle.kids.find((entry) => entry.id === kidId)
                                if (!kid) {
                                  return null
                                }
                                return (
                                  <label
                                    key={kidId}
                                    className="flex items-center gap-2 text-sm"
                                  >
                                    <input
                                      type="checkbox"
                                      aria-label={`Cover ${kid.displayName} for ${item.title}`}
                                      checked={assignDraft.kidIds.includes(kidId)}
                                      onChange={() =>
                                        updateAssignCoverageDraft(itemKey, {
                                          kidIds: assignDraft.kidIds.includes(kidId)
                                            ? assignDraft.kidIds.filter((id) => id !== kidId)
                                            : [...assignDraft.kidIds, kidId],
                                        })
                                      }
                                      disabled={status.kind === "loading"}
                                    />
                                    {kid.displayName}
                                  </label>
                                )
                              })}
                            </fieldset>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant={pendingForSelf ? "outline" : "default"}
                            data-testid={
                              pendingForSelf ? undefined : "agenda-cta-primary"
                            }
                            onClick={() =>
                              void onAssignCoverage(
                                item,
                                assignDraft.adultId,
                                assignDraft.kidIds,
                              )
                            }
                            disabled={
                              status.kind === "loading" ||
                              !assignDraft.adultId ||
                              assignDraft.kidIds.length === 0
                            }
                          >
                            Assign coverage
                          </Button>
                        </div>
                      ) : null}
                      {isManual ? (
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => openEditEvent(item)}
                            disabled={status.kind === "loading"}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => void onRemoveEvent(item.id)}
                            disabled={status.kind === "loading"}
                          >
                            Remove event
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => void loadMoreCalendar()}
            disabled={status.kind === "loading"}
          >
            {status.kind === "loading" && !eventComposeOpen ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Loading…
              </>
            ) : (
              "Load more"
            )}
          </Button>
        </section>

        {eventComposeOpen ? (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-4 sm:items-center"
            role="presentation"
            onClick={() => {
              setEventComposeOpen(false)
              setEditingEventId(null)
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-busy={status.kind === "loading"}
              aria-label={editingEventId ? "Edit event" : "Add event"}
              className="flex max-h-[90vh] w-full max-w-lg flex-col gap-3 overflow-y-auto rounded-lg border border-border bg-card p-4 shadow-lg"
              onClick={(event) => event.stopPropagation()}
            >
              <p className="text-sm font-medium">
                {editingEventId ? "Edit event" : "Add event"}
              </p>
              {editingEventId ? (
                <>
                  <Input
                    aria-label="Event title"
                    value={editingEventTitle}
                    onChange={(e) => setEditingEventTitle(e.target.value)}
                    disabled={status.kind === "loading"}
                  />
                  <Input
                    type="datetime-local"
                    aria-label="Event start"
                    value={editingEventStartsAt}
                    min={datetimeMin}
                    onChange={(e) => {
                      const next = e.target.value
                      setEditingEventStartsAt(next)
                      setEditingEventEndsAt((ends) => coerceEndsAfterStart(next, ends))
                    }}
                    disabled={status.kind === "loading"}
                  />
                  <Input
                    type="datetime-local"
                    aria-label="Event end"
                    value={editingEventEndsAt}
                    min={editingEventEndsMin}
                    onChange={(e) => setEditingEventEndsAt(e.target.value)}
                    disabled={status.kind === "loading"}
                  />
                  <Input
                    aria-label="Event location"
                    value={editingEventLocation}
                    onChange={(e) => setEditingEventLocation(e.target.value)}
                    placeholder="Location (optional)"
                    disabled={status.kind === "loading"}
                  />
                  {circle.kids.length > 0 ? (
                    <fieldset className="flex flex-col gap-1">
                      <legend className="text-xs text-muted-foreground">Kids on event</legend>
                      {circle.kids.map((kid) => (
                        <label key={kid.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            aria-label={`Assign ${kid.displayName} to event`}
                            checked={editingEventKidIds.includes(kid.id)}
                            onChange={() =>
                              toggleKidId(
                                kid.id,
                                editingEventKidIds,
                                setEditingEventKidIds,
                              )
                            }
                            disabled={status.kind === "loading"}
                          />
                          {kid.displayName}
                        </label>
                      ))}
                    </fieldset>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Add a kid before creating a manual event.
                    </p>
                  )}
                  {status.kind === "error" ? (
                    <p role="alert" className="text-sm text-destructive">
                      {status.message}
                    </p>
                  ) : null}
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      type="button"
                      onClick={() => void onSaveEvent(editingEventId)}
                      disabled={
                        status.kind === "loading" ||
                        !editingEventTitle.trim() ||
                        !editingEventStartsAt.trim() ||
                        editingEventKidIds.length === 0
                      }
                    >
                      {status.kind === "loading" ? (
                        <>
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                          Saving…
                        </>
                      ) : (
                        "Save"
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setEventComposeOpen(false)
                        setEditingEventId(null)
                        setEditingEventTitle("")
                        setEditingEventStartsAt("")
                        setEditingEventEndsAt("")
                        setEditingEventLocation("")
                        setEditingEventKidIds([])
                      }}
                      disabled={status.kind === "loading"}
                    >
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <Input
                    aria-label="Event title"
                    value={newEventTitle}
                    onChange={(e) => setNewEventTitle(e.target.value)}
                    placeholder="Event title"
                    disabled={status.kind === "loading"}
                  />
                  <Input
                    type="datetime-local"
                    aria-label="Event start"
                    value={newEventStartsAt}
                    min={datetimeMin}
                    onChange={(e) => {
                      const next = e.target.value
                      setNewEventStartsAt(next)
                      setNewEventEndsAt((ends) => coerceEndsAfterStart(next, ends))
                    }}
                    disabled={status.kind === "loading"}
                  />
                  <Input
                    type="datetime-local"
                    aria-label="Event end"
                    value={newEventEndsAt}
                    min={newEventEndsMin}
                    onChange={(e) => setNewEventEndsAt(e.target.value)}
                    disabled={status.kind === "loading"}
                  />
                  <Input
                    aria-label="Event location"
                    value={newEventLocation}
                    onChange={(e) => setNewEventLocation(e.target.value)}
                    placeholder="Location (optional)"
                    disabled={status.kind === "loading"}
                  />
                  {circle.kids.length > 0 ? (
                    <fieldset className="flex flex-col gap-1">
                      <legend className="text-xs text-muted-foreground">Kids on event</legend>
                      {circle.kids.map((kid) => (
                        <label key={kid.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            aria-label={`Assign ${kid.displayName} to event`}
                            checked={newEventKidIds.includes(kid.id)}
                            onChange={() =>
                              toggleKidId(kid.id, newEventKidIds, setNewEventKidIds)
                            }
                            disabled={status.kind === "loading"}
                          />
                          {kid.displayName}
                        </label>
                      ))}
                    </fieldset>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Add a kid before creating a manual event.
                    </p>
                  )}
                  {status.kind === "error" ? (
                    <p role="alert" className="text-sm text-destructive">
                      {status.message}
                    </p>
                  ) : null}
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      type="button"
                      onClick={() => void onAddEvent()}
                      disabled={
                        status.kind === "loading" ||
                        !newEventTitle.trim() ||
                        !newEventStartsAt.trim() ||
                        newEventKidIds.length === 0
                      }
                    >
                      {status.kind === "loading" ? (
                        <>
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                          Saving…
                        </>
                      ) : (
                        "Save"
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setEventComposeOpen(false)
                        setNewEventTitle("")
                        setNewEventStartsAt(defaultNewEventStartsLocal())
                        setNewEventEndsAt("")
                        setNewEventLocation("")
                        setNewEventKidIds([])
                      }}
                      disabled={status.kind === "loading"}
                    >
                      Cancel
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : null}

                    </>
          ) : null}

          {destination === "carpool" ? (
            <section aria-label="Carpool" className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">Coming soon</p>
            </section>
          ) : null}

          {destination === "feeds" ? (
            <>
{isOrganizer ? (
          <section aria-label="Activity feeds" className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">Activity feeds</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void onRefreshFeeds()}
                disabled={status.kind === "loading"}
              >
                Refresh
              </Button>
            </div>
            {feeds.length === 0 ? (
              <p className="text-sm text-muted-foreground">No feeds yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {feeds.map((feed) => {
                  const kidsLabel = feedKidNames(feed, circle.kids)
                  const statusLabel = kidsLabel
                    ? `${kidsLabel} · ${feedSyncStatusLabel(feed)}`
                    : feedSyncStatusLabel(feed)
                  return (
                  <li key={feed.id} className="flex flex-col gap-2">
                    {editingFeedId === feed.id ? (
                      <>
                        <Input
                          aria-label={`Rename feed ${feed.name}`}
                          value={editingFeedName}
                          onChange={(event) => setEditingFeedName(event.target.value)}
                          disabled={status.kind === "loading"}
                        />
                        <Input
                          aria-label={`Edit URL for ${feed.name}`}
                          value={editingFeedUrl}
                          onChange={(event) => setEditingFeedUrl(event.target.value)}
                          disabled={status.kind === "loading"}
                        />
                        {circle.kids.length > 0 ? (
                          <fieldset className="flex flex-col gap-1">
                            <legend className="text-xs text-muted-foreground">Kids on feed</legend>
                            {circle.kids.map((kid) => (
                              <label
                                key={kid.id}
                                className="flex items-center gap-2 text-sm"
                              >
                                <input
                                  type="checkbox"
                                  aria-label={`Assign ${kid.displayName} to ${feed.name}`}
                                  checked={editingFeedKidIds.includes(kid.id)}
                                  onChange={() =>
                                    toggleKidId(
                                      kid.id,
                                      editingFeedKidIds,
                                      setEditingFeedKidIds,
                                    )
                                  }
                                  disabled={status.kind === "loading"}
                                />
                                {kid.displayName}
                              </label>
                            ))}
                          </fieldset>
                        ) : null}
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => void onSaveFeed(feed)}
                            disabled={
                              status.kind === "loading" ||
                              !editingFeedName.trim() ||
                              !editingFeedUrl.trim()
                            }
                          >
                            Save
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingFeedId(null)
                              setEditingFeedName("")
                              setEditingFeedUrl("")
                              setEditingFeedKidIds([])
                            }}
                            disabled={status.kind === "loading"}
                          >
                            Cancel
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div className="flex min-w-0 flex-col gap-2">
                        <span className="min-w-0 text-sm">
                          <span className="block truncate font-medium">{feed.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {statusLabel}
                          </span>
                        </span>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => void onSyncFeed(feed.id)}
                            disabled={status.kind === "loading"}
                          >
                            Sync now
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingFeedId(feed.id)
                              setEditingFeedName(feed.name)
                              setEditingFeedUrl(feed.sourceUrl)
                              setEditingFeedKidIds([...feed.kidIds])
                            }}
                            disabled={status.kind === "loading"}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => void onRemoveFeed(feed.id)}
                            disabled={status.kind === "loading"}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    )}
                  </li>
                  )
                })}
              </ul>
            )}

            <div className="flex flex-col gap-2">
              <Input
                aria-label="New feed name"
                value={newFeedName}
                onChange={(event) => setNewFeedName(event.target.value)}
                placeholder="Feed name (e.g. U12 Travel)"
                disabled={status.kind === "loading"}
              />
              <Input
                aria-label="New feed URL"
                value={newFeedUrl}
                onChange={(event) => setNewFeedUrl(event.target.value)}
                placeholder="iCal or webcal URL"
                disabled={status.kind === "loading"}
              />
              {circle.kids.length > 0 ? (
                <fieldset className="flex flex-col gap-1">
                  <legend className="text-xs text-muted-foreground">Kids on feed</legend>
                  {circle.kids.map((kid) => (
                    <label key={kid.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        aria-label={`Assign ${kid.displayName} to new feed`}
                        checked={newFeedKidIds.includes(kid.id)}
                        onChange={() =>
                          toggleKidId(kid.id, newFeedKidIds, setNewFeedKidIds)
                        }
                        disabled={status.kind === "loading"}
                      />
                      {kid.displayName}
                    </label>
                  ))}
                </fieldset>
              ) : null}
              <Button
                type="button"
                onClick={() => void onAddFeed()}
                disabled={
                  status.kind === "loading" ||
                  !newFeedName.trim() ||
                  !newFeedUrl.trim()
                }
              >
                Add feed
              </Button>
            </div>
          </section>
        ) : null}
            </>
          ) : null}

          {status.kind === "error" ? (
            <p role="alert" className="text-sm text-destructive">
              {status.message}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
