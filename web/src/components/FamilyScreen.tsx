import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Loader2, Plus } from "lucide-react"

import type { AuthClient } from "@/api/authClient"
import type { AuthSessionHolder } from "@/api/authSession"
import {
  CalendarCacheStore,
  maxIsoInstant,
} from "@/api/calendarCacheStore"
import { applyLeaveByFillIn, mergeCalendarWindowRefresh } from "@/api/calendarLeaveBy"
import { CarpoolClient } from "@/api/carpoolClient"
import { FamilyBootstrapStore } from "@/api/familyBootstrapStore"
import { FamilyClient } from "@/api/familyClient"
import {
  isPlaceLocated,
  type ActivityFeed,
  type Adult,
  type CalendarItem,
  type CarpoolFeedStatus,
  type CarpoolRideEvent,
  type CarpoolSummary,
  type FamilyCircle,
  type FamilyMember,
  type Garage,
  type Kid,
  type Place,
  type RsvpStatus,
} from "@/api/types"
import { CarpoolFeedActions, CarpoolFeedStatusChip } from "@/components/CarpoolFeedActions"
import { CarpoolPanel } from "@/components/CarpoolPanel"
import { CenteredColumn } from "@/components/CenteredColumn"
import {
  FeedCard,
  feedFieldLabelClass,
  feedFormCardClass,
  feedInputClass,
  feedKidChipClass,
  feedQuietButtonClass,
  feedSectionLabelClass,
  feedSubmitClass,
} from "@/components/FeedCard"
import { GaragePanel } from "@/components/GaragePanel"
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
import { HeroAttentionCarousel } from "@/components/HeroAttentionCarousel"
import type { HeroAttentionSlideProps } from "@/components/HeroAttentionSlide"
import { AgendaKidFilterChip } from "@/components/AgendaKidFilterChip"
import { AgendaRow } from "@/components/AgendaRow"
import { AgendaWeekGlance } from "@/components/AgendaWeekGlance"
import { groupAgendaListSections } from "@/components/agendaDayGroups"
import {
  activeCoverages,
  calendarItemKey,
  memberLabel,
  remainingCoverageGapKidIds,
} from "@/components/coverageDisplay"
import {
  coverageGameEventKey,
  getQueue,
  filterQueueWithinHorizon,
  isConfirmedDriver,
  mapCalendarItemsToCoverageGames,
  type CoverageGameEvent,
  type QueueItem,
} from "@/components/coverageQueue"
import {
  feedSpaceIdsFromSummary,
  matchCalendarItemToRideEvent,
  ridesBySpaceRecordToMap,
} from "@/components/calendarRideJoin"
import {
  advanceCalendarWindow,
  calendarWindowThrough,
  coerceEndsAfterStart,
  defaultCalendarWindow,
  ensureCalendarWindowCovers,
  filterCalendarItemsInWindow,
  formatLocalTodayLabel,
  mergeCalendarItems,
  nearTermLeaveByWindow,
  remainderAfterNearTermLeaveByWindow,
  validateManualEventTimes,
} from "@/components/eventTimes"
import { coverageDoubleBookMessage } from "@/components/conflictDisplay"
import {
  isAgendaItemOutOfPlay,
  kidHasActiveCoverage,
  rsvpCoverageReleaseMessage,
  rsvpStatusForKid,
} from "@/components/rsvpDisplay"

type ShellDestination = "calendar" | "carpool" | "family" | "places" | "garage" | "feeds"

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }

type EmptyMode = "choose" | "create" | "join"

type FamilyScreenProps = {
  session: AuthSessionHolder
  authClient?: AuthClient
  familyClient?: FamilyClient
  carpoolClient?: CarpoolClient
  calendarCacheStore?: CalendarCacheStore
  bootstrapCacheStore?: FamilyBootstrapStore
  /** Test hook — local "today" for agenda grouping and carousel horizon. */
  now?: Date
  onSignedOut: () => void
}

function circleTitle(circle: FamilyCircle): string {
  return circle.name?.trim() ? circle.name : "Your family"
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

function carpoolFeedRow(summary: CarpoolSummary, feed: ActivityFeed): CarpoolFeedStatus {
  return (
    summary.feeds.find((row) => row.feedId === feed.id) ?? {
      feedId: feed.id,
      feedName: feed.name,
      status: "NONE",
      spaceId: null,
      spaceName: null,
    }
  )
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
  carpoolClient: carpoolClientProp,
  calendarCacheStore: calendarCacheStoreProp,
  bootstrapCacheStore: bootstrapCacheStoreProp,
  now: nowProp,
  onSignedOut,
}: FamilyScreenProps) {
  // Stable when `now` is omitted (AuthScreen). A fresh Date each render would
  // retrigger load/revalidate effects and freeze "Updating…" / reset Load more.
  const [defaultNow] = useState(() => new Date())
  const now = nowProp ?? defaultNow
  // Default param `new FamilyClient()` would be a new instance every render and
  // retrigger the load effect forever (frozen "Loading…" / create form).
  const [familyClient] = useState(() => familyClientProp ?? new FamilyClient())
  const [carpoolClient] = useState(() => carpoolClientProp ?? new CarpoolClient())
  const [calendarCache] = useState(
    () => calendarCacheStoreProp ?? new CalendarCacheStore(),
  )
  const [bootstrapCache] = useState(
    () => bootstrapCacheStoreProp ?? new FamilyBootstrapStore(),
  )
  const initialAdultId = session.getAdult()?.id
  const initialBootstrap = initialAdultId
    ? bootstrapCache.load(initialAdultId)
    : null
  const initialCalendar =
    initialAdultId && initialBootstrap
      ? calendarCache.load(initialAdultId, initialBootstrap.circle.id)
      : null
  const [status, setStatus] = useState<Status>({ kind: "idle" })
  const [circle, setCircle] = useState<FamilyCircle | null>(
    () => initialBootstrap?.circle ?? null,
  )
  // Kept apart from `circle === null` (which means "no circle yet"): after a failed load we do
  // not know whether one exists, and offering Create family invites a duplicate circle.
  const [loadFailed, setLoadFailed] = useState<string | null>(null)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [adult, setAdult] = useState<Adult | null>(() => session.getAdult())
  const [emptyMode, setEmptyMode] = useState<EmptyMode>("choose")
  const [adultDisplayName, setAdultDisplayName] = useState("")
  const [circleName, setCircleName] = useState("")
  const [inviteCodeInput, setInviteCodeInput] = useState("")
  const [inviteCode, setInviteCode] = useState<string | null>(
    () => initialBootstrap?.inviteCode ?? null,
  )
  const [newKidName, setNewKidName] = useState("")
  const [editingKidId, setEditingKidId] = useState<string | null>(null)
  const [editingKidName, setEditingKidName] = useState("")
  const [newPlaceName, setNewPlaceName] = useState("")
  const [newPlaceAddress, setNewPlaceAddress] = useState("")
  const [editingPlaceId, setEditingPlaceId] = useState<string | null>(null)
  const [editingPlaceName, setEditingPlaceName] = useState("")
  const [editingPlaceAddress, setEditingPlaceAddress] = useState("")
  const [feeds, setFeeds] = useState<ActivityFeed[]>(
    () => initialBootstrap?.feeds ?? [],
  )
  const [newFeedName, setNewFeedName] = useState("")
  const [newFeedUrl, setNewFeedUrl] = useState("")
  const [newFeedKidIds, setNewFeedKidIds] = useState<string[]>([])
  const [editingFeedId, setEditingFeedId] = useState<string | null>(null)
  const [editingFeedName, setEditingFeedName] = useState("")
  const [editingFeedUrl, setEditingFeedUrl] = useState("")
  const [editingFeedKidIds, setEditingFeedKidIds] = useState<string[]>([])
  const [calendarItems, setCalendarItems] = useState<CalendarItem[]>(
    () => initialCalendar?.items ?? [],
  )
  const [calendarLoadedTo, setCalendarLoadedTo] = useState(
    () => initialCalendar?.to ?? defaultCalendarWindow(nowProp).to,
  )
  const [calendarFetchedAt, setCalendarFetchedAt] = useState<number | null>(
    () => initialCalendar?.fetchedAt ?? null,
  )
  const [calendarLoadingMore, setCalendarLoadingMore] = useState(false)
  const [calendarRevalidating, setCalendarRevalidating] = useState(
    () => initialCalendar != null,
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
  const [editingEventLeaveFromPlaceId, setEditingEventLeaveFromPlaceId] = useState("")
  const [destination, setDestination] = useState<ShellDestination>("calendar")
  const [feedsCarpoolSummary, setFeedsCarpoolSummary] = useState<CarpoolSummary | null>(
    null,
  )
  const [feedsCarpoolError, setFeedsCarpoolError] = useState<string | null>(null)
  const [feedsCarpoolBusy, setFeedsCarpoolBusy] = useState(false)
  const [calendarCarpoolSummary, setCalendarCarpoolSummary] =
    useState<CarpoolSummary | null>(null)
  const [calendarRidesBySpace, setCalendarRidesBySpace] = useState<
    Record<string, CarpoolRideEvent[]>
  >({})
  const [calendarGarage, setCalendarGarage] = useState<Garage | null>(null)
  const [calendarCarpoolError, setCalendarCarpoolError] = useState<string | null>(null)
  const [eventComposeOpen, setEventComposeOpen] = useState(false)
  const [assignCoverageDrafts, setAssignCoverageDrafts] = useState<
    Record<string, { adultId: string; kidIds?: string[] }>
  >({})
  /** Confirm/Assign failures — keyed by agenda item so the alert sits on the control. */
  const [coverageActionErrors, setCoverageActionErrors] = useState<
    Record<string, string>
  >({})
  /** Session-local Undo after withdraw; survives API reload until accept or remount. */
  const [recentlyWithdrawnRideIds, setRecentlyWithdrawnRideIds] = useState<
    ReadonlySet<string>
  >(() => new Set())
  const circleRef = useRef(circle)
  circleRef.current = circle
  const adultRef = useRef(adult)
  adultRef.current = adult
  const leaveByFillGenRef = useRef(0)
  const nearTermGatePendingRef = useRef(false)
  const nearTermGateRef = useRef<{ promise: Promise<void>; resolve: () => void }>({
    promise: Promise.resolve(),
    resolve: () => {},
  })

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

  const feedIdsKey = feeds.map((feed) => feed.id).join(",")
  useEffect(() => {
    if (destination !== "feeds") {
      return
    }
    const token = session.getAccessToken()
    if (!token) {
      return
    }
    let cancelled = false
    setFeedsCarpoolBusy(true)
    void carpoolClient
      .getSummary(token)
      .then((next) => {
        if (cancelled) {
          return
        }
        setFeedsCarpoolSummary(next)
        setFeedsCarpoolError(null)
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return
        }
        setFeedsCarpoolError(
          error instanceof Error ? error.message : "Something went wrong",
        )
      })
      .finally(() => {
        if (!cancelled) {
          setFeedsCarpoolBusy(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [destination, carpoolClient, feedIdsKey, session])

  const reloadCalendarCarpoolRides = useCallback(
    async (token: string) => {
      try {
        const summary = await carpoolClient.getSummary(token)
        const window = defaultCalendarWindow()
        const nextRides: Record<string, CarpoolRideEvent[]> = {}
        let nextGarage: Garage | null = null
        if (summary.spaces.length > 0) {
          const [garageNext, rideLists] = await Promise.all([
            familyClient.getGarage(token),
            Promise.all(
              summary.spaces.map((space) =>
                carpoolClient.listRides(token, space.id, window.from, window.to),
              ),
            ),
          ])
          nextGarage = garageNext
          summary.spaces.forEach((space, index) => {
            nextRides[space.id] = rideLists[index] ?? []
          })
        }
        setCalendarCarpoolSummary(summary)
        setCalendarRidesBySpace(nextRides)
        setCalendarGarage(nextGarage)
        setCalendarCarpoolError(null)
      } catch (error: unknown) {
        setCalendarCarpoolError(
          error instanceof Error ? error.message : "Something went wrong",
        )
      }
    },
    [carpoolClient, familyClient],
  )

  useEffect(() => {
    if (destination !== "calendar" || circle == null) {
      return
    }
    const token = session.getAccessToken()
    if (!token) {
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const summary = await carpoolClient.getSummary(token)
        const window = defaultCalendarWindow()
        const nextRides: Record<string, CarpoolRideEvent[]> = {}
        let nextGarage: Garage | null = null
        if (summary.spaces.length > 0) {
          const [garageNext, rideLists] = await Promise.all([
            familyClient.getGarage(token),
            Promise.all(
              summary.spaces.map((space) =>
                carpoolClient.listRides(token, space.id, window.from, window.to),
              ),
            ),
          ])
          nextGarage = garageNext
          summary.spaces.forEach((space, index) => {
            nextRides[space.id] = rideLists[index] ?? []
          })
        }
        if (cancelled) {
          return
        }
        setCalendarCarpoolSummary(summary)
        setCalendarRidesBySpace(nextRides)
        setCalendarGarage(nextGarage)
        setCalendarCarpoolError(null)
      } catch (error: unknown) {
        if (cancelled) {
          return
        }
        setCalendarCarpoolError(
          error instanceof Error ? error.message : "Something went wrong",
        )
      }
    })()
    return () => {
      cancelled = true
    }
  }, [destination, circle, carpoolClient, familyClient, session])

  useEffect(() => {
    if (destination !== "calendar") {
      setEventComposeOpen(false)
    }
  }, [destination])

  const persistCalendarSnapshot = useCallback(
    (
      adultId: string,
      circleId: string,
      from: string,
      to: string,
      items: CalendarItem[],
      fetchedAt: number = Date.now(),
    ) => {
      setCalendarFetchedAt(fetchedAt)
      calendarCache.save({
        adultId,
        circleId,
        from,
        to,
        items,
        fetchedAt,
      })
    },
    [calendarCache],
  )

  const armNearTermGate = useCallback(() => {
    if (nearTermGatePendingRef.current) {
      return
    }
    let resolve!: () => void
    const promise = new Promise<void>((r) => {
      resolve = r
    })
    nearTermGatePendingRef.current = true
    nearTermGateRef.current = { promise, resolve }
  }, [])

  const resolveNearTermGate = useCallback(() => {
    if (!nearTermGatePendingRef.current) {
      return
    }
    nearTermGatePendingRef.current = false
    nearTermGateRef.current.resolve()
  }, [])

  const fetchAndApplyLeaveBy = useCallback(
    async (token: string, from: string, to: string, gen: number) => {
      try {
        const rows = await familyClient.listCalendarLeaveBy(token, from, to)
        if (gen !== leaveByFillGenRef.current) {
          return
        }
        setCalendarItems((current) => {
          const next = applyLeaveByFillIn(current, rows)
          const currentAdult = adultRef.current
          const currentCircle = circleRef.current
          if (currentAdult && currentCircle) {
            const existing = calendarCache.load(currentAdult.id, currentCircle.id)
            if (existing) {
              calendarCache.save({ ...existing, items: next })
            }
          }
          return next
        })
      } catch {
        // Keep last known leave-by; do not wipe Agenda.
      }
    },
    [calendarCache, familyClient],
  )

  const startLeaveByFill = useCallback(
    (token: string, loadedFrom: string, loadedTo: string) => {
      const gen = ++leaveByFillGenRef.current
      armNearTermGate()
      void (async () => {
        try {
          const near = nearTermLeaveByWindow(loadedFrom, loadedTo, now)
          if (near) {
            await fetchAndApplyLeaveBy(token, near.from, near.to, gen)
          }
        } finally {
          resolveNearTermGate()
        }
        if (gen !== leaveByFillGenRef.current) {
          return
        }
        const rest = remainderAfterNearTermLeaveByWindow(loadedFrom, loadedTo, now)
        if (rest) {
          await fetchAndApplyLeaveBy(token, rest.from, rest.to, gen)
        }
      })()
    },
    [armNearTermGate, fetchAndApplyLeaveBy, now, resolveNearTermGate],
  )

  const fetchAndPersistCalendar = useCallback(
    async (
      token: string,
      adultId: string,
      circleId: string,
      loadedTo: string,
    ): Promise<{ items: CalendarItem[]; from: string; to: string }> => {
      const window = calendarWindowThrough(loadedTo, now)
      const items = await familyClient.listCalendar(token, window.from, window.to)
      let merged: CalendarItem[] = items
      setCalendarItems((current) => {
        const previous = current.length > 0 ? current : calendarCache.load(adultId, circleId)?.items ?? []
        merged = mergeCalendarWindowRefresh(items, previous, window)
        return merged
      })
      setCalendarLoadedTo(loadedTo)
      persistCalendarSnapshot(adultId, circleId, window.from, window.to, merged)
      return { items: merged, from: window.from, to: window.to }
    },
    [calendarCache, familyClient, now, persistCalendarSnapshot],
  )

  async function reloadCalendar(token: string, loadedTo: string = calendarLoadedTo) {
    if (!adult || !circle) {
      const window = calendarWindowThrough(loadedTo)
      const items = await familyClient.listCalendar(token, window.from, window.to)
      setCalendarItems(items)
      startLeaveByFill(token, window.from, window.to)
      return
    }
    const painted = await fetchAndPersistCalendar(token, adult.id, circle.id, loadedTo)
    startLeaveByFill(token, painted.from, painted.to)
  }

  async function revalidateCalendarBackground(options?: { force?: boolean }) {
    if (!circle || !adult) {
      return
    }
    if (
      !options?.force &&
      calendarFetchedAt != null &&
      !calendarCache.isStale({ fetchedAt: calendarFetchedAt })
    ) {
      return
    }
    const token = session.getAccessToken()
    if (!token) {
      return
    }
    setCalendarRevalidating(true)
    try {
      const today = defaultCalendarWindow()
      const to = maxIsoInstant(today.to, calendarLoadedTo)
      const painted = await fetchAndPersistCalendar(token, adult.id, circle.id, to)
      startLeaveByFill(token, painted.from, painted.to)
      setStatus({ kind: "idle" })
    } catch (error) {
      resolveNearTermGate()
      if (calendarItems.length > 0) {
        setStatus({
          kind: "error",
          message: error instanceof Error ? error.message : "Something went wrong",
        })
      }
    } finally {
      setCalendarRevalidating(false)
    }
  }

  async function loadMoreCalendar() {
    setCalendarLoadingMore(true)
    try {
      const token = await requireToken()
      const page = advanceCalendarWindow(calendarLoadedTo)
      const more = await familyClient.listCalendar(token, page.from, page.to)
      setCalendarItems((current) => {
        const merged = mergeCalendarItems(current, more)
        if (adult && circle) {
          const window = calendarWindowThrough(page.to)
          persistCalendarSnapshot(adult.id, circle.id, window.from, page.to, merged)
        }
        return merged
      })
      setCalendarLoadedTo(page.to)
      await nearTermGateRef.current.promise
      const gen = leaveByFillGenRef.current
      await fetchAndApplyLeaveBy(token, page.from, page.to, gen)
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong",
      })
    } finally {
      setCalendarLoadingMore(false)
    }
  }

  useEffect(() => {
    if (destination !== "calendar") {
      return
    }
    if (calendarFetchedAt == null) {
      return
    }
    if (!calendarCache.isStale({ fetchedAt: calendarFetchedAt })) {
      return
    }
    void revalidateCalendarBackground({ force: true })
    // Only when navigating back to Calendar (destination flips), not on every fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional soft-TTL trigger
  }, [destination])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const token = session.getAccessToken()
      if (!token) {
        setLoadFailed("Not signed in")
        setStatus({ kind: "idle" })
        return
      }
      const adultId = session.getAdult()?.id
      // Paint bootstrap/calendar before getCircle when present. With no cache,
      // use a quiet Loading shell (no spinner, no create/join) until circle returns.
      const bootstrap = adultId ? bootstrapCache.load(adultId) : null
      if (bootstrap) {
        setCircle(bootstrap.circle)
        circleRef.current = bootstrap.circle
        setInviteCode(bootstrap.inviteCode)
        setFeeds(bootstrap.feeds)
        const cached = calendarCache.load(adultId!, bootstrap.circle.id)
        if (cached) {
          setCalendarItems(cached.items)
          setCalendarLoadedTo(cached.to)
          setCalendarFetchedAt(cached.fetchedAt)
          armNearTermGate()
        }
        setCalendarRevalidating(true)
        setStatus({ kind: "idle" })
      } else {
        setStatus({ kind: "loading" })
      }
      try {
        const loaded = await familyClient.getCircle(token)
        if (cancelled) {
          return
        }
        setLoadFailed(null)
        setCircle(loaded)
        circleRef.current = loaded
        let softCalendarError: string | null = null
        const cached =
          loaded && adultId ? calendarCache.load(adultId, loaded.id) : null
        const hadCache = cached != null

        if (loaded && adultId) {
          const initialTo = defaultCalendarWindow(now).to
          const loadedTo = cached ? maxIsoInstant(initialTo, cached.to) : initialTo
          if (cached) {
            setCalendarItems(cached.items)
            setCalendarLoadedTo(loadedTo)
            setCalendarFetchedAt(cached.fetchedAt)
            armNearTermGate()
            setCalendarRevalidating(true)
            setStatus({ kind: "idle" })
          }

          try {
            const painted = await fetchAndPersistCalendar(token, adultId, loaded.id, loadedTo)
            if (!cancelled) {
              startLeaveByFill(token, painted.from, painted.to)
            } else {
              resolveNearTermGate()
            }
          } catch (error) {
            resolveNearTermGate()
            if (!cancelled) {
              if (!hadCache) {
                setCalendarItems([])
                setCalendarLoadedTo(defaultCalendarWindow().to)
                setCalendarFetchedAt(null)
              } else {
                softCalendarError =
                  error instanceof Error ? error.message : "Something went wrong"
              }
            }
          } finally {
            if (!cancelled) {
              setCalendarRevalidating(false)
            }
          }
        } else {
          if (adultId) {
            bootstrapCache.clear(adultId)
          }
          setCalendarItems([])
          setCalendarFetchedAt(null)
          setCalendarRevalidating(false)
        }
        let nextInvite: string | null = null
        let nextFeeds: ActivityFeed[] = []
        if (loaded?.role === "ORGANIZER") {
          try {
            const invite = await familyClient.getInvite(token)
            if (!cancelled) {
              nextInvite = invite.code
              setInviteCode(invite.code)
            }
          } catch {
            if (!cancelled) {
              nextInvite = null
              setInviteCode(null)
            }
          }
          try {
            const loadedFeeds = await familyClient.listFeeds(token)
            if (!cancelled) {
              nextFeeds = loadedFeeds
              setFeeds(loadedFeeds)
            }
          } catch {
            if (!cancelled) {
              nextFeeds = []
              setFeeds([])
            }
          }
        } else {
          setInviteCode(null)
          setFeeds([])
        }
        if (!cancelled && loaded && adultId) {
          bootstrapCache.save({
            adultId,
            email: session.getAdult()?.email ?? "",
            adultDisplayName: session.getAdult()?.displayName ?? null,
            circle: loaded,
            inviteCode: nextInvite,
            feeds: nextFeeds,
          })
        }
        if (!cancelled) {
          if (softCalendarError) {
            setStatus({ kind: "error", message: softCalendarError })
          } else {
            setStatus({ kind: "idle" })
          }
        }
      } catch (error) {
        if (cancelled) {
          return
        }
        const message =
          error instanceof Error ? error.message : "Something went wrong"
        // Keep bootstrap / in-memory Ready shell; only full LoadFailed when we
        // never had a circle to paint.
        if (circleRef.current) {
          setStatus({ kind: "error", message })
          setCalendarRevalidating(false)
          resolveNearTermGate()
        } else {
          setLoadFailed(message)
          setStatus({ kind: "idle" })
        }
      }
    }
    void load()
    return () => {
      cancelled = true
      leaveByFillGenRef.current += 1
    }
  }, [
    familyClient,
    session,
    loadAttempt,
    calendarCache,
    bootstrapCache,
    persistCalendarSnapshot,
    fetchAndPersistCalendar,
    startLeaveByFill,
    armNearTermGate,
    resolveNearTermGate,
  ])

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
      const createdAdult = session.getAdult()
      if (createdAdult) {
        bootstrapCache.save({
          adultId: createdAdult.id,
          email: createdAdult.email,
          adultDisplayName: createdAdult.displayName,
          circle: created,
          inviteCode: invite.code,
          feeds: [],
        })
      }
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
      const joinedAdult = session.getAdult()
      if (joinedAdult) {
        bootstrapCache.save({
          adultId: joinedAdult.id,
          email: joinedAdult.email,
          adultDisplayName: joinedAdult.displayName,
          circle: joined,
          inviteCode: null,
          feeds: [],
        })
      }
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
      const adultId = session.getAdult()?.id
      if (adultId && circle) {
        const existing = bootstrapCache.load(adultId)
        if (existing) {
          bootstrapCache.save({ ...existing, inviteCode: invite.code })
        }
      }
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
      const previousAdultId = adult?.id
      const previousCircleId = circle?.id
      await familyClient.leaveCircle(token)
      if (previousAdultId && previousCircleId) {
        calendarCache.clear(previousAdultId, previousCircleId)
      }
      if (previousAdultId) {
        bootstrapCache.clear(previousAdultId)
      }
      setCircle(null)
      setInviteCode(null)
      setFeeds([])
      setCalendarItems([])
      setCalendarFetchedAt(null)
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

  async function runFeedsCarpool(action: (token: string) => Promise<void>) {
    const token = session.getAccessToken()
    if (!token) {
      return
    }
    setFeedsCarpoolBusy(true)
    try {
      await action(token)
      setFeedsCarpoolSummary(await carpoolClient.getSummary(token))
      setFeedsCarpoolError(null)
    } catch (error) {
      setFeedsCarpoolError(
        error instanceof Error ? error.message : "Something went wrong",
      )
    } finally {
      setFeedsCarpoolBusy(false)
    }
  }

  /** Join may create+sync a feed; refresh Feeds and Agenda like Add feed does. */
  async function refreshFeedsAndCalendarAfterCarpoolJoin() {
    const token = session.getAccessToken()
    if (!token) {
      return
    }
    if (circle?.role === "ORGANIZER") {
      setFeeds(await familyClient.listFeeds(token))
    }
    await reloadCalendar(token)
    await reloadCalendarCarpoolRides(token)
  }

  async function onCreateAgendaRide(
    item: CalendarItem,
    eventKey: string,
    kidIds?: string[],
  ) {
    if (item.feedId == null || calendarCarpoolSummary == null) {
      return
    }
    const spaceId = feedSpaceIdsFromSummary(calendarCarpoolSummary).get(item.feedId)
    if (spaceId == null) {
      return
    }
    setStatus({ kind: "loading" })
    try {
      const token = await requireToken()
      await carpoolClient.createRide(
        token,
        spaceId,
        kidIds != null ? { eventKey, kidIds } : { eventKey },
      )
      await reloadCalendarCarpoolRides(token)
      setStatus({ kind: "idle" })
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong",
      })
    }
  }

  async function onCancelAgendaRide(item: CalendarItem, rideId: string) {
    if (item.feedId == null || calendarCarpoolSummary == null) {
      return
    }
    const spaceId = feedSpaceIdsFromSummary(calendarCarpoolSummary).get(item.feedId)
    if (spaceId == null) {
      return
    }
    setStatus({ kind: "loading" })
    try {
      const token = await requireToken()
      await carpoolClient.cancelRide(token, spaceId, rideId)
      await reloadCalendarCarpoolRides(token)
      setStatus({ kind: "idle" })
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong",
      })
    }
  }

  async function onCantMakeItAgenda(item: CalendarItem, game: CoverageGameEvent) {
    const rideEvent = calendarRideByItemKey.get(calendarItemKey(item)) ?? null
    const ownRequest = rideEvent?.ownRequest ?? null

    if (game.ownRide === "requested" && ownRequest != null) {
      await onCancelAgendaRide(item, ownRequest.id)
      return
    }

    if (!isConfirmedDriver(game.ownRide)) {
      return
    }

    const teammateRide =
      ownRequest?.status === "ACCEPTED" && ownRequest.kidIds.includes(game.kidId)
    if (teammateRide && ownRequest != null) {
      await onCancelAgendaRide(item, ownRequest.id)
      return
    }

    const coverage = activeCoverages(item).find(
      (row) => row.status === "CONFIRMED" && row.kidIds.includes(game.kidId),
    )
    if (coverage != null) {
      await onRemoveCoverage(coverage.id)
    }
  }

  async function onAcceptAgendaRide(item: CalendarItem, rideId: string, vehicleId: string) {
    if (item.feedId == null || calendarCarpoolSummary == null) {
      return
    }
    const spaceId = feedSpaceIdsFromSummary(calendarCarpoolSummary).get(item.feedId)
    if (spaceId == null) {
      return
    }
    setStatus({ kind: "loading" })
    try {
      const token = await requireToken()
      await carpoolClient.acceptRide(token, spaceId, rideId, { vehicleId })
      setRecentlyWithdrawnRideIds((current) => {
        if (!current.has(rideId)) {
          return current
        }
        const next = new Set(current)
        next.delete(rideId)
        return next
      })
      await reloadCalendarCarpoolRides(token)
      setStatus({ kind: "idle" })
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong",
      })
    }
  }

  async function onPassAgendaRide(item: CalendarItem, rideId: string) {
    if (item.feedId == null || calendarCarpoolSummary == null) {
      return
    }
    const spaceId = feedSpaceIdsFromSummary(calendarCarpoolSummary).get(item.feedId)
    if (spaceId == null) {
      return
    }
    setStatus({ kind: "loading" })
    try {
      const token = await requireToken()
      await carpoolClient.passRide(token, spaceId, rideId)
      await reloadCalendarCarpoolRides(token)
      setStatus({ kind: "idle" })
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong",
      })
    }
  }

  async function onWithdrawAgendaRide(item: CalendarItem, rideId: string) {
    if (item.feedId == null || calendarCarpoolSummary == null) {
      return
    }
    const spaceId = feedSpaceIdsFromSummary(calendarCarpoolSummary).get(item.feedId)
    if (spaceId == null) {
      return
    }
    setStatus({ kind: "loading" })
    try {
      const token = await requireToken()
      await carpoolClient.withdrawRide(token, spaceId, rideId)
      setRecentlyWithdrawnRideIds((current) => {
        const next = new Set(current)
        next.add(rideId)
        return next
      })
      await reloadCalendarCarpoolRides(token)
      setStatus({ kind: "idle" })
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong",
      })
    }
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
      const originalItem = calendarItems.find(
        (row) => row.source === "MANUAL" && row.id === eventId,
      )
      if (
        originalItem &&
        editingEventLeaveFromPlaceId &&
        editingEventLeaveFromPlaceId !== (originalItem.leaveFromPlaceId ?? "")
      ) {
        await familyClient.setCalendarLeaveFrom(token, "MANUAL", eventId, {
          leaveFromPlaceId: editingEventLeaveFromPlaceId,
        })
      }
      const nextTo = ensureCalendarWindowCovers(calendarLoadedTo, startsAt)
      setCalendarLoadedTo(nextTo)
      await reloadCalendar(token, nextTo)
      setEditingEventId(null)
      setEditingEventTitle("")
      setEditingEventStartsAt("")
      setEditingEventEndsAt("")
      setEditingEventLocation("")
      setEditingEventKidIds([])
      setEditingEventLeaveFromPlaceId("")
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
      setEventComposeOpen(false)
      setEditingEventId(null)
      setStatus({ kind: "idle" })
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong",
      })
    }
  }

  function replaceCalendarItem(updated: CalendarItem) {
    setCalendarItems((current) => {
      const next = current.map((row) =>
        row.source === updated.source && row.id === updated.id ? updated : row,
      )
      if (adult && circle) {
        calendarCache.patchItem(adult.id, circle.id, updated)
      }
      return next
    })
  }

  function updateAssignCoverageDraft(
    itemKey: string,
    patch: Partial<{ adultId: string; kidIds: string[] }>,
  ) {
    setAssignCoverageDrafts((current) => {
      // Adult-only patches must not invent kidIds: [] — coverageAssignState falls back to
      // uncovered kids only when kidIds is absent (pre-select all uncovered by default).
      const existing = current[itemKey] ?? { adultId: "" }
      return { ...current, [itemKey]: { ...existing, ...patch } }
    })
  }

  function coverageAssignState(
    item: CalendarItem,
    itemKey: string,
    ownRequest?: CarpoolRideEvent["ownRequest"],
  ): { adultId: string; kidIds: string[]; soleAdult: boolean; soleKid: boolean } {
    const gapKids = remainingCoverageGapKidIds(item.uncoveredKidIds, ownRequest)
    const soleAdult = circle!.members.length === 1
    const soleKid = gapKids.length === 1
    const stored = assignCoverageDrafts[itemKey]
    const defaultAdultId =
      adult?.id && circle!.members.some((member) => member.adultId === adult.id)
        ? adult.id
        : (circle!.members[0]?.adultId ?? "")
    const adultId = soleAdult
      ? circle!.members[0]!.adultId
      : stored?.adultId || defaultAdultId
    const kidIds = soleKid
      ? gapKids
      : (stored?.kidIds ?? [...gapKids])
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

  function clearCoverageActionError(itemKey: string) {
    setCoverageActionErrors((current) => {
      if (!(itemKey in current)) {
        return current
      }
      const next = { ...current }
      delete next[itemKey]
      return next
    })
  }

  function setCoverageActionError(itemKey: string, message: string) {
    setCoverageActionErrors((current) => ({ ...current, [itemKey]: message }))
  }

  async function onAssignCoverage(
    item: CalendarItem,
    coveringAdultId: string,
    kidIds: string[],
  ) {
    const itemKey = calendarItemKey(item)
    clearCoverageActionError(itemKey)
    setStatus({ kind: "loading" })
    try {
      const token = await requireToken()
      let updated = await familyClient.assignCalendarCoverage(
        token,
        item.source,
        item.id,
        { coveringAdultId, kidIds },
      )
      const kidsNeedingRsvpReset = kidIds.filter(
        (kidId) => rsvpStatusForKid(item, kidId) === "NO",
      )
      for (const kidId of kidsNeedingRsvpReset) {
        updated = await familyClient.setCalendarRsvp(
          token,
          updated.source,
          updated.id,
          kidId,
          { status: "YES" },
        )
      }
      replaceCalendarItem(updated)
      setAssignCoverageDrafts((current) => {
        const next = { ...current }
        delete next[itemKey]
        return next
      })
      setStatus({ kind: "idle" })
    } catch (error) {
      setStatus({ kind: "idle" })
      setCoverageActionError(
        itemKey,
        error instanceof Error
          ? coverageDoubleBookMessage(error.message)
          : "Something went wrong",
      )
    }
  }

  async function onConfirmCoverage(item: CalendarItem, assignmentId: string) {
    const itemKey = calendarItemKey(item)
    clearCoverageActionError(itemKey)
    setStatus({ kind: "loading" })
    try {
      const token = await requireToken()
      const updated = await familyClient.confirmCalendarCoverage(token, assignmentId)
      replaceCalendarItem(updated)
      setStatus({ kind: "idle" })
    } catch (error) {
      setStatus({ kind: "idle" })
      setCoverageActionError(
        itemKey,
        error instanceof Error
          ? coverageDoubleBookMessage(error.message)
          : "Something went wrong",
      )
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
      // Auto-withdraw side effect on CONFIRMED remove — refresh inbound asks / chips.
      await reloadCalendarCarpoolRides(token)
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
      replaceCalendarItem(updated)
      setStatus({ kind: "idle" })
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong",
      })
    }
  }

  async function onSetCalendarRsvp(
    item: CalendarItem,
    kidId: string,
    statusValue: RsvpStatus,
  ) {
    // Attendance toggle writes YES (going) or NO (not going) only — never NO_RESPONSE.
    if (statusValue !== "YES" && statusValue !== "NO") {
      return
    }
    if (rsvpStatusForKid(item, kidId) === statusValue) {
      return
    }
    if (statusValue === "NO" && kidHasActiveCoverage(item, kidId)) {
      const kidName =
        circle?.kids.find((kid) => kid.id === kidId)?.displayName?.trim() || "this kid"
      if (!window.confirm(rsvpCoverageReleaseMessage(kidName))) {
        return
      }
    }
    setStatus({ kind: "loading" })
    try {
      const token = await requireToken()
      const updated = await familyClient.setCalendarRsvp(
        token,
        item.source,
        item.id,
        kidId,
        { status: statusValue },
      )
      replaceCalendarItem(updated)
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
    setEditingEventLeaveFromPlaceId(item.leaveFromPlaceId ?? "")
    setEventComposeOpen(true)
  }

  async function onSignOut() {
    setStatus({ kind: "loading" })
    const token = session.getAccessToken()
    try {
      if (token && authClient) {
        await authClient.logout(token)
      }
    } catch {
      // Telling the server is best-effort: dropping the local session must still happen, or
      // Sign out does nothing at all whenever the backend is unreachable.
    }
    // Keep (adultId, circleId) calendar snapshots so the same adult paints Agenda on next
    // sign-in. Leave-circle still clears the active key.
    session.clear()
    onSignedOut()
  }

  const calendarRideByItemKey = useMemo(() => {
    const map = new Map<string, CarpoolRideEvent>()
    if (calendarCarpoolSummary == null) {
      return map
    }
    const spaceIdByFeedId = feedSpaceIdsFromSummary(calendarCarpoolSummary)
    const ridesMap = ridesBySpaceRecordToMap(calendarRidesBySpace)
    for (const item of calendarItems) {
      const matched = matchCalendarItemToRideEvent(item, spaceIdByFeedId, ridesMap)
      if (matched != null) {
        map.set(calendarItemKey(item), matched)
      }
    }
    return map
  }, [calendarCarpoolSummary, calendarRidesBySpace, calendarItems])

  if (!circle && status.kind === "loading") {
    return (
      <CenteredColumn>
      <Card>
        <CardHeader>
          <CardTitle>Your family</CardTitle>
          {/* Quiet wait for getCircle — never a spinner-only page. */}
        </CardHeader>
      </Card>
      </CenteredColumn>
    )
  }

  if (!circle && loadFailed) {
    return (
      <CenteredColumn>
      <Card>
        <CardHeader>
          <CardTitle>Your family</CardTitle>
          <CardDescription>Could not load your family.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p role="alert" className="text-sm text-destructive">
            {loadFailed}
          </p>
          <Button
            type="button"
            onClick={() => setLoadAttempt((attempt) => attempt + 1)}
            disabled={status.kind === "loading"}
          >
            Retry
          </Button>
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
      </CenteredColumn>
    )
  }

  if (!circle) {
    const needsName = !adult?.displayName
    return (
      <CenteredColumn>
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
      </CenteredColumn>
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
  const agendaLoadedWindow = calendarWindowThrough(calendarLoadedTo, now)
  const agendaWindowItems = filterCalendarItemsInWindow(
    visibleCalendarItems,
    agendaLoadedWindow.from,
    agendaLoadedWindow.to,
  )
  const coverageMapOptions = {
    currentAdultId: adult?.id ?? "",
    members: circle.members,
  }
  const coverageGames = mapCalendarItemsToCoverageGames(
    agendaWindowItems,
    (item) => calendarRideByItemKey.get(calendarItemKey(item)) ?? null,
    coverageMapOptions,
  )
  const attentionQueue = filterQueueWithinHorizon(getQueue(coverageGames), now)
  const focusedCalendarItemKey =
    attentionQueue[0] != null
      ? coverageGameEventKey(attentionQueue[0].game.id)
      : null
  const heroQueuedRequestIds = new Set(
    attentionQueue
      .filter((queueItem): queueItem is Extract<typeof queueItem, { kind: "request" }> =>
        queueItem.kind === "request",
      )
      .map((queueItem) => queueItem.request.id),
  )
  const { sections: agendaSections } = groupAgendaListSections(agendaWindowItems, {
    now,
    currentAdultId: adult?.id ?? "",
    queueHasItems: attentionQueue.length > 0,
    ownRequestFor: (item) =>
      calendarRideByItemKey.get(calendarItemKey(item))?.ownRequest ?? null,
  })
  const locatedPlaces = circle.places.filter(isPlaceLocated)
  const editingCalendarItem =
    editingEventId != null
      ? calendarItems.find((row) => row.source === "MANUAL" && row.id === editingEventId)
      : undefined
  const carpoolAccessToken = session.getAccessToken()

  const slidePropsForQueueItem = (queueItem: QueueItem, index: number): HeroAttentionSlideProps => {
    const itemKey = coverageGameEventKey(queueItem.game.id)
    const calendarItemForSlide = agendaWindowItems.find(
      (row) => calendarItemKey(row) === itemKey,
    )
    if (calendarItemForSlide == null) {
      throw new Error(`Missing calendar item for queue game ${queueItem.game.id}`)
    }
    const rideEvent = calendarRideByItemKey.get(itemKey) ?? null
    const baseAssign = coverageAssignState(
      calendarItemForSlide,
      itemKey,
      rideEvent?.ownRequest,
    )
    return {
      item: queueItem,
      index,
      queueLength: attentionQueue.length,
      calendarItem: calendarItemForSlide,
      circle,
      currentAdultId: adult?.id ?? "",
      loading: status.kind === "loading",
      garage: calendarGarage,
      rideEvent,
      assignDraft: { adultId: baseAssign.adultId, kidIds: [queueItem.game.kidId] },
      onUpdateAssignDraft: (patch) => updateAssignCoverageDraft(itemKey, patch),
      onAssignCoverage: (coveringAdultId, kidIds) =>
        void onAssignCoverage(calendarItemForSlide, coveringAdultId, kidIds),
      onConfirmCoverage: (assignmentId) =>
        void onConfirmCoverage(calendarItemForSlide, assignmentId),
      onDeclineCoverage: (assignmentId) => void onDeclineCoverage(assignmentId),
      onAskTeam: () => {
        const eventKey = rideEvent?.eventKey
        if (eventKey) {
          void onCreateAgendaRide(calendarItemForSlide, eventKey, [queueItem.game.kidId])
        }
      },
      onAcceptRide: (rideId, vehicleId) =>
        void onAcceptAgendaRide(calendarItemForSlide, rideId, vehicleId),
      onPassRide: (rideId) => void onPassAgendaRide(calendarItemForSlide, rideId),
    }
  }

  const heroAttentionCarousel = (
    <HeroAttentionCarousel
      queue={attentionQueue}
      slidePropsForItem={slidePropsForQueueItem}
    />
  )

  const contentTitle =
    destination === "calendar"
      ? "Today"
      : destination === "carpool"
        ? "Carpool"
        : destination === "family"
          ? circleTitle(circle)
          : destination === "places"
            ? "Places"
            : destination === "garage"
              ? "Garage"
              : "Feeds"

  // Mock frame: grid 240 | 1fr | 320; this <main> is a block with max-width
  // 820 only. Flex / w-full / min-w-* here, or nowrap in the column, freeze 1fr.
  return (
    <div
      className={
        destination === "calendar"
          ? "grid min-h-svh grid-cols-[15rem_1fr_20rem]"
          : "grid min-h-svh grid-cols-[15rem_1fr]"
      }
    >
      <aside
        aria-label="App navigation"
        className="sticky top-0 flex h-svh w-60 shrink-0 flex-col gap-[var(--fc-space-lg)] bg-[var(--fc-rail-surface)] px-[var(--fc-space-rail-x)] py-[var(--fc-space-rail-y)] text-[var(--fc-rail-on)]"
      >
        <div
          aria-label="Wordmark"
          className="flex shrink-0 items-center gap-[var(--fc-space-sm)]"
        >
          <span
            aria-hidden
            className="size-3 shrink-0 rounded-[var(--fc-radius-sm)] bg-[var(--fc-rail-accent)]"
          />
          <span
            aria-hidden
            className="fc-display text-[length:var(--fc-font-title-size)] leading-[var(--fc-font-title-line)] font-[number:var(--fc-font-headline-weight)] text-[var(--fc-rail-on)]"
          >
            App
          </span>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-[var(--fc-space-lg)] overflow-y-auto">
          <nav aria-label="Primary" className="flex flex-col gap-[var(--fc-space-xs)]">
            <ShellNavButton
              label="Calendar"
              icon="icon.calendar"
              active={destination === "calendar"}
              onClick={() => setDestination("calendar")}
            />
            <ShellNavButton
              label="Carpool"
              icon="icon.carpool"
              active={destination === "carpool"}
              onClick={() => setDestination("carpool")}
            />
            <ShellNavButton
              label="Family"
              icon="icon.family"
              active={destination === "family"}
              onClick={() => setDestination("family")}
            />
          </nav>

          <section
            aria-label="Settings"
            className="flex flex-col gap-[var(--fc-space-xs)]"
          >
            <SettingsGroupLabel>Settings</SettingsGroupLabel>
            <SettingsRow
              label="Places"
              icon="icon.places"
              active={destination === "places"}
              onClick={() => setDestination("places")}
            />
            <SettingsRow
              label="Garage"
              icon="icon.garage"
              active={destination === "garage"}
              onClick={() => setDestination("garage")}
            />
            {isOrganizer ? (
              <SettingsRow
                label="Feeds"
                icon="icon.feeds"
                active={destination === "feeds"}
                onClick={() => setDestination("feeds")}
              />
            ) : null}
          </section>
        </div>

        <section
          aria-label="Account"
          className="flex shrink-0 flex-col gap-[var(--fc-space-xs)] border-t border-[color-mix(in_srgb,var(--fc-rail-on)_12%,transparent)] pt-[var(--fc-space-md)]"
        >
          <SettingsGroupLabel>Account</SettingsGroupLabel>
          <AccountSummaryRow
            email={adult?.email ?? ""}
            role={circle.role}
            displayName={adult?.displayName}
          />
          <SettingsRow
            label="Sign out"
            icon="icon.signout"
            onClick={() => void onSignOut()}
            danger
          />
        </section>
      </aside>

      <main className="max-w-[820px] space-y-4 px-[var(--fc-space-main-x)] py-[var(--fc-space-main-y)] [&>header+*]:!mt-0">
        <header
          className={
            destination === "calendar"
              ? "mb-[var(--fc-space-header)] flex flex-row items-start justify-between gap-[var(--fc-space-md)]"
              : "mb-[var(--fc-space-header)] flex flex-col gap-[var(--fc-space-sm)]"
          }
        >
          <div className="flex min-w-0 flex-col gap-[var(--fc-space-sm)]">
            <h1 className="fc-display text-[length:var(--fc-font-page-size)] leading-[var(--fc-font-page-line)] font-[number:var(--fc-font-page-weight)] text-[var(--fc-text-primary)]">
              {contentTitle}
            </h1>
            {destination === "calendar" ? (
              <p className="text-[length:var(--fc-font-subtitle-size)] leading-[var(--fc-font-subtitle-line)] font-[number:var(--fc-font-subtitle-weight)] text-[var(--fc-text-secondary)]">
                {formatLocalTodayLabel()}
              </p>
            ) : null}
            {destination === "family" ? (
              <p className="text-[length:var(--fc-font-subtitle-size)] leading-[var(--fc-font-subtitle-line)] font-[number:var(--fc-font-subtitle-weight)] text-[var(--fc-text-secondary)]">
                {adult?.displayName ? `${adult.displayName} · ` : null}
                {adult?.email} · {circle.role}
              </p>
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
                setEditingEventLeaveFromPlaceId("")
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
        </header>
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
          {calendarRevalidating ? (
            <p
              data-testid="agenda-revalidating"
              className="flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <Loader2 className="size-3 animate-spin" aria-hidden />
              Updating…
            </p>
          ) : null}
          {calendarCarpoolError ? (
            <p
              data-testid="calendar-carpool-error"
              role="status"
              className="text-xs text-muted-foreground"
            >
              Carpool rides unavailable: {calendarCarpoolError}
            </p>
          ) : null}
          {status.kind === "error" ? (
            <p role="alert" className="text-sm text-destructive">
              {status.message}
            </p>
          ) : null}
          {circle.kids.length > 0 ? (
            <div
              className="mb-[var(--fc-space-filter-chip-margin-bottom)] flex flex-wrap gap-[var(--fc-space-filter-chip-gap)]"
              role="group"
              aria-label="Filter agenda by kid"
              data-testid="agenda-kid-filter"
            >
              <AgendaKidFilterChip
                label="All kids"
                selected={agendaKidFilter == null}
                disabled={status.kind === "loading"}
                onClick={() => setAgendaKidFilter(null)}
              />
              {circle.kids.map((kid) => (
                <AgendaKidFilterChip
                  key={kid.id}
                  label={kid.displayName}
                  selected={agendaKidFilter === kid.id}
                  disabled={status.kind === "loading"}
                  onClick={() => setAgendaKidFilter(kid.id)}
                />
              ))}
            </div>
          ) : null}
          {agendaWindowItems.length === 0 ? (
            // While calendar list is busy, do not claim the window is empty —
            // busy feedback lives on Load more → Loading….
            status.kind === "loading" && !eventComposeOpen ? null : (
              <p className="text-sm text-muted-foreground">
                No events in the loaded window.
              </p>
            )
          ) : (
            <div className="mt-[var(--fc-space-md)] flex flex-col gap-[var(--fc-space-2xl)]">
              {heroAttentionCarousel}
              {agendaSections.length > 0 ? (
            <div
              data-testid="agenda-list"
              className="flex flex-col gap-[var(--fc-space-2xl)]"
            >
              {agendaSections.map((group) => (
                <section
                  key={group.label}
                  aria-label={
                    group.dateLabel
                      ? `${group.label}, ${group.dateLabel}`
                      : group.label
                  }
                  className="flex flex-col gap-[var(--fc-space-lg)]"
                >
                  <header className="flex items-baseline gap-[var(--fc-space-sm)]">
                    <h3 className={`${feedSectionLabelClass} mb-0`}>
                      {group.label}
                    </h3>
                    {group.dateLabel ? (
                      <span className="text-xs text-[var(--fc-text-secondary)]">
                        {group.dateLabel}
                      </span>
                    ) : null}
                  </header>
                  {group.items.length > 0 ? (
                  <ul className="flex flex-col gap-[var(--fc-space-list-row-gap)]">
                    {group.items.map((item) => {
                      const itemKey = calendarItemKey(item)
                      return (
                        <li
                          key={`${item.source}-${item.id}`}
                          data-testid={`agenda-item-${item.source}-${item.id}`}
                          data-carpool-ride-key={
                            calendarRideByItemKey.get(itemKey)?.eventKey
                          }
                          data-out-of-play={
                            isAgendaItemOutOfPlay(item) ? "true" : "false"
                          }
                        >
                          <AgendaRow
                            item={item}
                            isFocused={itemKey === focusedCalendarItemKey}
                            circle={circle}
                            currentAdultId={adult?.id ?? ""}
                            loading={status.kind === "loading"}
                            assignDraft={coverageAssignState(
                              item,
                              itemKey,
                              calendarRideByItemKey.get(itemKey)?.ownRequest,
                            )}
                            coverageActionError={coverageActionErrors[itemKey]}
                            rideEvent={calendarRideByItemKey.get(itemKey) ?? null}
                            garage={calendarGarage}
                            heroQueuedRequestIds={heroQueuedRequestIds}
                            recentlyWithdrawnRideIds={recentlyWithdrawnRideIds}
                            onCreateRide={(eventKey, kidIds) =>
                              void onCreateAgendaRide(item, eventKey, kidIds)
                            }
                            onCancelRide={(rideId) => void onCancelAgendaRide(item, rideId)}
                            onWithdrawRide={(rideId) => void onWithdrawAgendaRide(item, rideId)}
                            onAcceptRide={(rideId, vehicleId) =>
                              void onAcceptAgendaRide(item, rideId, vehicleId)
                            }
                            onPassRide={(rideId) => void onPassAgendaRide(item, rideId)}
                            onCantMakeIt={(game) => void onCantMakeItAgenda(item, game)}
                            onUpdateAssignDraft={(patch) =>
                              updateAssignCoverageDraft(itemKey, patch)
                            }
                            onAssignCoverage={(coveringAdultId, kidIds) =>
                              void onAssignCoverage(item, coveringAdultId, kidIds)
                            }
                            onConfirmCoverage={(assignmentId) =>
                              void onConfirmCoverage(item, assignmentId)
                            }
                            onDeclineCoverage={(assignmentId) =>
                              void onDeclineCoverage(assignmentId)
                            }
                            onRemoveCoverage={(assignmentId) =>
                              void onRemoveCoverage(assignmentId)
                            }
                            onSetLeaveFrom={(placeId) =>
                              void onSetCalendarLeaveFrom(item, placeId)
                            }
                            onSetRsvp={(kidId, rsvpStatus) =>
                              void onSetCalendarRsvp(item, kidId, rsvpStatus)
                            }
                            onOpenPlaces={() => setDestination("places")}
                            onEdit={() => openEditEvent(item)}
                            onRemoveEvent={() => void onRemoveEvent(item.id)}
                          />
                        </li>
                      )
                    })}
                  </ul>
                  ) : null}
                </section>
              ))}
            </div>
              ) : null}
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => void loadMoreCalendar()}
            disabled={calendarLoadingMore}
          >
            {calendarLoadingMore ? (
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
                  <FieldRow label="Leave from">
                    {locatedPlaces.length <= 1 ? (
                      <span className="text-sm font-medium">
                        {editingCalendarItem?.leaveFromPlaceName ??
                          locatedPlaces[0]?.name ??
                          (circle.places.length === 0
                            ? "No places yet"
                            : "No located places yet")}
                      </span>
                    ) : (
                      <select
                        aria-label="Leave from for event"
                        className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                        value={editingEventLeaveFromPlaceId}
                        onChange={(e) => setEditingEventLeaveFromPlaceId(e.target.value)}
                        disabled={status.kind === "loading"}
                      >
                        {!editingEventLeaveFromPlaceId ? (
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
                        setEditingEventLeaveFromPlaceId("")
                      }}
                      disabled={status.kind === "loading"}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void onRemoveEvent(editingEventId)}
                      disabled={status.kind === "loading"}
                    >
                      Remove event
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

          {destination === "garage" ? (
            carpoolAccessToken && adult ? (
              <GaragePanel
                accessToken={carpoolAccessToken}
                adultId={adult.id}
                familyClient={familyClient}
                places={circle.places}
                defaultLeaveFromPlaceId={circle.defaultLeaveFromPlaceId}
              />
            ) : (
              <section aria-label="Garage" className="flex flex-col gap-2">
                <p role="alert" className="text-sm text-destructive">
                  Not signed in
                </p>
              </section>
            )
          ) : null}

          {destination === "carpool" ? (
            carpoolAccessToken && adult ? (
              <CarpoolPanel
                accessToken={carpoolAccessToken}
                carpoolClient={carpoolClient}
                familyClient={familyClient}
                adultId={adult.id}
                circleId={circle.id}
                kids={circle.kids}
                onJoined={() => refreshFeedsAndCalendarAfterCarpoolJoin()}
              />
            ) : (
              <section aria-label="Carpool" className="flex flex-col gap-2">
                <p role="alert" className="text-sm text-destructive">
                  Not signed in
                </p>
              </section>
            )
          ) : null}

          {destination === "feeds" ? (
            <>
              {isOrganizer ? (
          <section aria-label="Activity feeds">
            <div className="mb-[var(--fc-space-feed-section-gap)] flex justify-end">
              <button
                type="button"
                className={feedQuietButtonClass}
                onClick={() => void onRefreshFeeds()}
                disabled={status.kind === "loading"}
              >
                Refresh
              </button>
            </div>
            {feedsCarpoolError ? (
              <p role="alert" className="text-sm text-destructive">
                {feedsCarpoolError}
              </p>
            ) : null}
            {feedsCarpoolSummary == null &&
            feedsCarpoolError == null &&
            feeds.length > 0 ? (
              <p className="mb-[var(--fc-space-feed-section-gap)] text-[length:var(--fc-font-feed-meta-size)] text-[var(--fc-text-secondary)]">
                Loading carpool…
              </p>
            ) : null}
            {feeds.length === 0 ? (
              <p className="mb-[var(--fc-space-feed-list-margin-bottom)] text-[length:var(--fc-font-feed-meta-size)] text-[var(--fc-text-secondary)]">
                No feeds yet.
              </p>
            ) : (
              <ul className="mb-[var(--fc-space-feed-list-margin-bottom)] flex flex-col gap-[var(--fc-space-feed-list-gap)]">
                {feeds.map((feed) => {
                  const carpoolRow =
                    feedsCarpoolSummary != null
                      ? carpoolFeedRow(feedsCarpoolSummary, feed)
                      : null
                  return (
                  <li key={feed.id}>
                    <FeedCard
                      feed={feed}
                      kids={circle.kids}
                      editing={editingFeedId === feed.id}
                      editingName={editingFeedName}
                      editingUrl={editingFeedUrl}
                      editingKidIds={editingFeedKidIds}
                      loading={status.kind === "loading"}
                      carpoolStatus={
                        carpoolRow != null ? (
                          <CarpoolFeedStatusChip status={carpoolRow.status} />
                        ) : null
                      }
                      carpoolCta={
                        carpoolRow != null ? (
                          <CarpoolFeedActions
                            layout="feeds"
                            feed={carpoolRow}
                            circleRole={circle.role}
                            disabled={status.kind === "loading" || feedsCarpoolBusy}
                            onEnable={(feedId) =>
                              void runFeedsCarpool((token) =>
                                carpoolClient.enable(token, feedId).then(() => undefined),
                              )
                            }
                            onRequest={(spaceId) =>
                              void runFeedsCarpool((token) =>
                                carpoolClient
                                  .createRequest(token, spaceId)
                                  .then(() => undefined),
                              )
                            }
                            onOpen={() => setDestination("carpool")}
                          />
                        ) : null
                      }
                      onEditingNameChange={setEditingFeedName}
                      onEditingUrlChange={setEditingFeedUrl}
                      onToggleEditingKid={(kidId) =>
                        toggleKidId(kidId, editingFeedKidIds, setEditingFeedKidIds)
                      }
                      onSync={() => void onSyncFeed(feed.id)}
                      onStartEdit={() => {
                        setEditingFeedId(feed.id)
                        setEditingFeedName(feed.name)
                        setEditingFeedUrl(feed.sourceUrl)
                        setEditingFeedKidIds([...feed.kidIds])
                      }}
                      onCancelEdit={() => {
                        setEditingFeedId(null)
                        setEditingFeedName("")
                        setEditingFeedUrl("")
                        setEditingFeedKidIds([])
                      }}
                      onSave={() => void onSaveFeed(feed)}
                      onRemove={() => void onRemoveFeed(feed.id)}
                    />
                  </li>
                  )
                })}
              </ul>
            )}

            <p className={feedSectionLabelClass}>Add a feed</p>
            <div className={feedFormCardClass}>
              <div className="mb-[var(--fc-space-feed-section-gap)]">
                <label className={feedFieldLabelClass} htmlFor="new-feed-name">
                  Feed name
                </label>
                <input
                  id="new-feed-name"
                  className={feedInputClass}
                  aria-label="New feed name"
                  value={newFeedName}
                  onChange={(event) => setNewFeedName(event.target.value)}
                  placeholder="e.g. U12 Travel"
                  disabled={status.kind === "loading"}
                />
              </div>
              <div className="mb-[var(--fc-space-feed-section-gap)]">
                <label className={feedFieldLabelClass} htmlFor="new-feed-url">
                  iCal or webcal URL
                </label>
                <input
                  id="new-feed-url"
                  className={feedInputClass}
                  aria-label="New feed URL"
                  value={newFeedUrl}
                  onChange={(event) => setNewFeedUrl(event.target.value)}
                  placeholder="https://…"
                  disabled={status.kind === "loading"}
                />
              </div>
              {circle.kids.length > 0 ? (
                <fieldset className="mb-[var(--fc-space-feed-section-gap)]">
                  <legend className={feedFieldLabelClass}>Kids on feed</legend>
                  <div className="flex flex-wrap gap-[var(--fc-space-feed-kid-chips-gap)]">
                    {circle.kids.map((kid) => (
                      <label key={kid.id} className={feedKidChipClass}>
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
                  </div>
                </fieldset>
              ) : null}
              <button
                type="button"
                className={feedSubmitClass}
                onClick={() => void onAddFeed()}
                disabled={
                  status.kind === "loading" ||
                  !newFeedName.trim() ||
                  !newFeedUrl.trim()
                }
              >
                Add feed
              </button>
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
      </main>
      {destination === "calendar" ? (
        <aside
          aria-label="Context"
          className="flex w-80 shrink-0 flex-col border-l border-[var(--fc-border)] px-[var(--fc-space-week-glance-pad-x)] py-[var(--fc-space-main-y)]"
        >
          <AgendaWeekGlance
            items={agendaWindowItems}
            currentAdultId={adult?.id ?? ""}
            now={now}
            ownRequestForItem={(item) =>
              calendarRideByItemKey.get(calendarItemKey(item))?.ownRequest ?? null
            }
          />
        </aside>
      ) : null}
    </div>
  )
}
