import { useCallback, useEffect, useMemo, useState } from "react"

import type { AuthSessionHolder } from "@/api/authSession"
import { CarpoolClient } from "@/api/carpoolClient"
import { FamilyClient } from "@/api/familyClient"
import type {
  CalendarItem,
  CarpoolRideEvent,
  CarpoolSummary,
  FamilyCircle,
} from "@/api/types"
import {
  circleLocalEventKey,
  feedSpaceIdsFromSummary,
  matchCalendarItemToRideEvent,
  ridesBySpaceRecordToMap,
} from "@/components/calendarRideJoin"
import { calendarItemKey } from "@/components/coverageDisplay"
import {
  applyAutoDeclinedViewModel,
  filterQueueWithinHorizon,
  getQueue,
  mapCalendarItemToCoverageGames,
  mapCalendarItemsToCoverageGames,
  type QueueItem,
} from "@/components/coverageQueue"
import { groupAgendaListSections } from "@/components/agendaDayGroups"
import {
  calendarWindowThrough,
  defaultCalendarWindow,
  filterCalendarItemsInWindow,
} from "@/components/eventTimes"
import { goingKidIdsForItem } from "@/components/rsvpDisplay"
import { rideCommitmentConflict } from "@/components/rideCommitmentConflict"

export type SandboxCalendarData = {
  status: "loading" | "ready" | "error" | "empty"
  error: string | null
  circle: FamilyCircle | null
  currentAdultId: string
  calendarItems: CalendarItem[]
  agendaWindowItems: CalendarItem[]
  agendaSections: ReturnType<typeof groupAgendaListSections>["sections"]
  attentionQueue: QueueItem[]
  calendarRideByItemKey: Map<string, CarpoolRideEvent>
  calendarCarpoolSummary: CarpoolSummary | null
  now: Date
  reload: () => void
  assignDraftFor: (item: CalendarItem) => {
    adultId: string
    kidIds: string[]
    soleAdult: boolean
    soleKid: boolean
  }
}

type UseSandboxCalendarDataArgs = {
  session: AuthSessionHolder
  familyClient?: FamilyClient
  carpoolClient?: CarpoolClient
  now?: Date
}

export function useSandboxCalendarData({
  session,
  familyClient: familyClientProp,
  carpoolClient: carpoolClientProp,
  now: nowProp,
}: UseSandboxCalendarDataArgs): SandboxCalendarData {
  const [familyClient] = useState(() => familyClientProp ?? new FamilyClient())
  const [carpoolClient] = useState(() => carpoolClientProp ?? new CarpoolClient())
  const [defaultNow] = useState(() => new Date())
  const now = nowProp ?? defaultNow
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "empty">(
    "loading",
  )
  const [error, setError] = useState<string | null>(null)
  const [circle, setCircle] = useState<FamilyCircle | null>(null)
  const [calendarItems, setCalendarItems] = useState<CalendarItem[]>([])
  const [calendarLoadedTo, setCalendarLoadedTo] = useState(
    () => defaultCalendarWindow(now).to,
  )
  const [calendarCarpoolSummary, setCalendarCarpoolSummary] =
    useState<CarpoolSummary | null>(null)
  const [calendarRidesBySpace, setCalendarRidesBySpace] = useState<
    Record<string, CarpoolRideEvent[]>
  >({})
  const [calendarCirclePlans, setCalendarCirclePlans] = useState<
    CarpoolRideEvent[]
  >([])

  const adult = session.getAdult()
  const currentAdultId = adult?.id ?? ""

  const reload = useCallback(() => {
    setLoadAttempt((attempt) => attempt + 1)
  }, [])

  useEffect(() => {
    const token = session.getAccessToken()
    if (!token) {
      return
    }
    let cancelled = false
    void (async () => {
      setStatus("loading")
      setError(null)
      try {
        const loadedCircle = await familyClient.getCircle(token)
        if (cancelled) {
          return
        }
        if (loadedCircle == null) {
          setCircle(null)
          setCalendarItems([])
          setStatus("empty")
          return
        }
        setCircle(loadedCircle)
        const window = defaultCalendarWindow(now)
        const [items, summary, circlePlans] = await Promise.all([
          familyClient.listCalendar(token, window.from, window.to),
          carpoolClient.getSummary(token).catch(() => null),
          carpoolClient.listCircleRidePlans(token).catch(() => [] as CarpoolRideEvent[]),
        ])
        if (cancelled) {
          return
        }
        setCalendarItems(items)
        setCalendarLoadedTo(window.to)
        setCalendarCirclePlans(circlePlans)
        if (summary == null) {
          setCalendarCarpoolSummary(null)
          setCalendarRidesBySpace({})
        } else {
          setCalendarCarpoolSummary(summary)
          const rideLists = await Promise.all(
            summary.spaces.map((space) =>
              carpoolClient
                .listRides(token, space.id, window.from, window.to)
                .catch(() => [] as CarpoolRideEvent[]),
            ),
          )
          if (cancelled) {
            return
          }
          const nextRides: Record<string, CarpoolRideEvent[]> = {}
          summary.spaces.forEach((space, index) => {
            nextRides[space.id] = rideLists[index] ?? []
          })
          setCalendarRidesBySpace(nextRides)
        }
        setStatus("ready")
      } catch (err: unknown) {
        if (cancelled) {
          return
        }
        setStatus("error")
        setError(err instanceof Error ? err.message : "Something went wrong")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [session, familyClient, carpoolClient, now, loadAttempt])

  const calendarRideByItemKey = useMemo(() => {
    const map = new Map<string, CarpoolRideEvent>()
    const spaceIdByFeedId =
      calendarCarpoolSummary == null
        ? new Map<string, string>()
        : feedSpaceIdsFromSummary(calendarCarpoolSummary)
    const ridesMap = ridesBySpaceRecordToMap(calendarRidesBySpace)
    for (const item of calendarItems) {
      const matched =
        calendarCarpoolSummary == null
          ? null
          : matchCalendarItemToRideEvent(item, spaceIdByFeedId, ridesMap)
      if (matched != null) {
        map.set(calendarItemKey(item), matched)
        continue
      }
      const localKey = circleLocalEventKey(item)
      if (localKey == null) {
        continue
      }
      const local = calendarCirclePlans.find((plan) => plan.eventKey === localKey)
      if (local != null) {
        map.set(calendarItemKey(item), local)
      }
    }
    return map
  }, [
    calendarCarpoolSummary,
    calendarRidesBySpace,
    calendarCirclePlans,
    calendarItems,
  ])

  const agendaLoadedWindow = calendarWindowThrough(calendarLoadedTo, now)
  const agendaWindowItems = filterCalendarItemsInWindow(
    calendarItems,
    agendaLoadedWindow.from,
    agendaLoadedWindow.to,
  )

  const remappedCoverageGames = mapCalendarItemsToCoverageGames(
    agendaWindowItems,
    (item) => calendarRideByItemKey.get(calendarItemKey(item)) ?? null,
    {
      currentAdultId,
      members: circle?.members ?? [],
    },
  )
  const { games: coverageGames } = applyAutoDeclinedViewModel(
    remappedCoverageGames,
    new Set(),
  )
  const attentionQueue = filterQueueWithinHorizon(getQueue(coverageGames), now)

  const { sections: agendaSections } = groupAgendaListSections(agendaWindowItems, {
    now,
    currentAdultId,
    queueHasItems: attentionQueue.length > 0,
    ownRequestFor: (item) =>
      calendarRideByItemKey.get(calendarItemKey(item))?.ownRequest ?? null,
    rideCommitmentConflictFor: (item) => {
      if (circle == null) {
        return false
      }
      const rideEvent = calendarRideByItemKey.get(calendarItemKey(item)) ?? null
      const games = mapCalendarItemToCoverageGames(item, rideEvent, {
        currentAdultId,
        members: circle.members,
      })
      return rideCommitmentConflict(rideEvent, item, games, circle.id) != null
    },
  })

  function assignDraftFor(item: CalendarItem) {
    const goingKidIds = goingKidIdsForItem(item)
    const soleAdult = (circle?.members.length ?? 0) === 1
    const soleKid = goingKidIds.length === 1
    const defaultAdultId =
      currentAdultId &&
      circle?.members.some((member) => member.adultId === currentAdultId)
        ? currentAdultId
        : (circle?.members[0]?.adultId ?? "")
    const adultId = soleAdult
      ? (circle?.members[0]?.adultId ?? "")
      : defaultAdultId
    return {
      adultId,
      kidIds: goingKidIds.length > 0 ? goingKidIds : [...item.uncoveredKidIds],
      soleAdult,
      soleKid,
    }
  }

  return {
    status: session.getAccessToken() == null ? "error" : status,
    error: session.getAccessToken() == null ? "Not signed in" : error,
    circle,
    currentAdultId,
    calendarItems,
    agendaWindowItems,
    agendaSections,
    attentionQueue,
    calendarRideByItemKey,
    calendarCarpoolSummary,
    now,
    reload,
    assignDraftFor,
  }
}
