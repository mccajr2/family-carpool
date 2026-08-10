import { useEffect, useState } from "react"

import type { AuthClient } from "@/api/authClient"
import type { AuthSessionHolder } from "@/api/authSession"
import { FamilyClient } from "@/api/familyClient"
import { isPlaceLocated, type ActivityFeed, type Adult, type CalendarItem, type FamilyCircle, type FamilyMember, type Kid, type Place, feedSyncStatusLabel } from "@/api/types"
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
  calendarSourceLabel,
  coerceEndsAfterStart,
  defaultCalendarWindow,
  formatEventWhen,
  validateManualEventTimes,
} from "@/components/eventTimes"

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

  async function reloadCalendar(token: string) {
    const window = defaultCalendarWindow()
    setCalendarItems(await familyClient.listCalendar(token, window.from, window.to))
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
            }
          } catch {
            if (!cancelled) {
              setCalendarItems([])
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
      const endsAt = newEventEndsAt.trim()
        ? fromDatetimeLocalValue(newEventEndsAt.trim())
        : null
      await familyClient.createEvent(
        token,
        newEventTitle.trim(),
        fromDatetimeLocalValue(newEventStartsAt.trim()),
        newEventKidIds,
        endsAt,
        newEventLocation.trim() ? newEventLocation.trim() : null,
      )
      await reloadCalendar(token)
      setNewEventTitle("")
      setNewEventStartsAt(defaultNewEventStartsLocal())
      setNewEventEndsAt("")
      setNewEventLocation("")
      setNewEventKidIds([])
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
      const endsAt = editingEventEndsAt.trim()
        ? fromDatetimeLocalValue(editingEventEndsAt.trim())
        : null
      await familyClient.updateEvent(
        token,
        eventId,
        editingEventTitle.trim(),
        fromDatetimeLocalValue(editingEventStartsAt.trim()),
        editingEventKidIds,
        endsAt,
        editingEventLocation.trim() ? editingEventLocation.trim() : null,
      )
      await reloadCalendar(token)
      setEditingEventId(null)
      setEditingEventTitle("")
      setEditingEventStartsAt("")
      setEditingEventEndsAt("")
      setEditingEventLocation("")
      setEditingEventKidIds([])
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>{circleTitle(circle)}</CardTitle>
        <CardDescription>
          {adult?.displayName ? `${adult.displayName} · ` : null}
          {adult?.email} · {circle.role}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
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

        <section aria-label="Agenda" className="flex flex-col gap-3">
          <p className="text-sm font-medium">Agenda</p>
          {status.kind === "error" ? (
            <p role="alert" className="text-sm text-destructive">
              {status.message}
            </p>
          ) : null}
          {circle.kids.length > 0 ? (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter agenda by kid">
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
            <p className="text-sm text-muted-foreground">Nothing coming up in the next 30 days.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {visibleCalendarItems.map((item) => {
                const kidsLabel = eventKidNames(item, circle.kids)
                const sourceLabel = calendarSourceLabel(item.source, item.feedName)
                const isManual = item.source === "MANUAL"
                return (
                  <li key={`${item.source}-${item.id}`} className="flex flex-col gap-2">
                    {isManual && editingEventId === item.id ? (
                      <>
                        <Input
                          aria-label={`Edit title for ${item.title}`}
                          value={editingEventTitle}
                          onChange={(e) => setEditingEventTitle(e.target.value)}
                          disabled={status.kind === "loading"}
                        />
                        <Input
                          type="datetime-local"
                          aria-label={`Edit start for ${item.title}`}
                          value={editingEventStartsAt}
                          min={datetimeMin}
                          onChange={(e) => {
                            const next = e.target.value
                            setEditingEventStartsAt(next)
                            setEditingEventEndsAt((ends) =>
                              coerceEndsAfterStart(next, ends),
                            )
                          }}
                          disabled={status.kind === "loading"}
                        />
                        <Input
                          type="datetime-local"
                          aria-label={`Edit end for ${item.title}`}
                          value={editingEventEndsAt}
                          min={editingEventEndsMin}
                          onChange={(e) => setEditingEventEndsAt(e.target.value)}
                          disabled={status.kind === "loading"}
                        />
                        <Input
                          aria-label={`Edit location for ${item.title}`}
                          value={editingEventLocation}
                          onChange={(e) => setEditingEventLocation(e.target.value)}
                          placeholder="Location (optional)"
                          disabled={status.kind === "loading"}
                        />
                        {circle.kids.length > 0 ? (
                          <fieldset className="flex flex-col gap-1">
                            <legend className="text-xs text-muted-foreground">Kids</legend>
                            {circle.kids.map((kid) => (
                              <label
                                key={kid.id}
                                className="flex items-center gap-2 text-sm"
                              >
                                <input
                                  type="checkbox"
                                  aria-label={`Assign ${kid.displayName} to ${item.title}`}
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
                        ) : null}
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => void onSaveEvent(item.id)}
                            disabled={
                              status.kind === "loading" ||
                              !editingEventTitle.trim() ||
                              !editingEventStartsAt.trim() ||
                              editingEventKidIds.length === 0
                            }
                          >
                            Save
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
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
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <span className="flex-1 text-sm">
                          {item.title}
                          <span className="block text-muted-foreground">
                            {formatEventWhen(item.startsAt, item.endsAt)}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {sourceLabel}
                          </span>
                          {item.location ? (
                            <span className="block text-xs text-muted-foreground">
                              {item.location}
                            </span>
                          ) : null}
                          {kidsLabel ? (
                            <span className="block text-xs text-muted-foreground">
                              {kidsLabel}
                            </span>
                          ) : null}
                        </span>
                        {isManual ? (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingEventId(item.id)
                                setEditingEventTitle(item.title)
                                setEditingEventStartsAt(toDatetimeLocalValue(item.startsAt))
                                setEditingEventEndsAt(
                                  item.endsAt ? toDatetimeLocalValue(item.endsAt) : "",
                                )
                                setEditingEventLocation(item.location ?? "")
                                setEditingEventKidIds([...item.kidIds])
                              }}
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
                          </>
                        ) : null}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <div className="flex flex-col gap-2">
          <Input
            aria-label="New event title"
            value={newEventTitle}
            onChange={(e) => setNewEventTitle(e.target.value)}
            placeholder="Event title"
            disabled={status.kind === "loading"}
          />
          <Input
            type="datetime-local"
            aria-label="New event start"
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
            aria-label="New event end"
            value={newEventEndsAt}
            min={newEventEndsMin}
            onChange={(e) => setNewEventEndsAt(e.target.value)}
            disabled={status.kind === "loading"}
          />
          <Input
            aria-label="New event location"
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
                    aria-label={`Assign ${kid.displayName} to new event`}
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
            Add event
          </Button>
        </div>

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

        {status.kind === "error" ? (
          <p role="alert" className="text-sm text-destructive">
            {status.message}
          </p>
        ) : null}

        <Button
          type="button"
          variant="outline"
          onClick={() => void onLeaveCircle()}
          disabled={status.kind === "loading"}
        >
          Leave family
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={() => void onSignOut()}
          disabled={status.kind === "loading"}
        >
          {status.kind === "loading" ? "Working…" : "Sign out"}
        </Button>
      </CardContent>
    </Card>
  )
}
