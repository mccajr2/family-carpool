import { authUrl } from "@/api/authClient"
import type {
  ActivityFeed,
  AssignCalendarCoverageRequest,
  CreateFamilyCircleRequest,
  FamilyCircle,
  FamilyInvite,
  FamilyRole,
  JoinFamilyCircleRequest,
  Kid,
  ManualEvent,
  CalendarItem,
  CalendarItemSource,
  CalendarLeaveBy,
  CreateVehicleRequest,
  Garage,
  Place,
  SuggestSeatsRequest,
  SuggestSeatsResponse,
  UpdateVehicleRequest,
  Vehicle,
  VehicleMake,
  VehicleModel,
  SetCalendarLeaveFromRequest,
  SetCalendarRsvpRequest,
  SetDefaultLeaveFromRequest,
} from "@/api/types"
import { apiBaseUrl } from "@/config"

export class FamilyClient {
  private readonly baseUrl: string
  private readonly fetchFn: typeof fetch

  constructor(
    baseUrl: string = apiBaseUrl,
    fetchFn: typeof fetch = globalThis.fetch.bind(globalThis),
  ) {
    this.baseUrl = baseUrl
    this.fetchFn = fetchFn
  }

  async createCircle(
    accessToken: string,
    body: CreateFamilyCircleRequest,
  ): Promise<FamilyCircle> {
    const response = await this.fetchFn(authUrl(this.baseUrl, "/api/family/circle"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "Create family circle failed"))
    }
    return (await response.json()) as FamilyCircle
  }

  async getCircle(accessToken: string): Promise<FamilyCircle | null> {
    const response = await this.fetchFn(authUrl(this.baseUrl, "/api/family/circle"), {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (response.status === 404) {
      return null
    }
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "Get family circle failed"))
    }
    return (await response.json()) as FamilyCircle
  }

  async updateCircleName(
    accessToken: string,
    name: string | null,
  ): Promise<FamilyCircle> {
    const response = await this.fetchFn(authUrl(this.baseUrl, "/api/family/circle"), {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name }),
    })
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "Update family circle failed"))
    }
    return (await response.json()) as FamilyCircle
  }

  async getInvite(accessToken: string): Promise<FamilyInvite> {
    const response = await this.fetchFn(authUrl(this.baseUrl, "/api/family/circle/invite"), {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "Get invite failed"))
    }
    return (await response.json()) as FamilyInvite
  }

  async regenerateInvite(accessToken: string): Promise<FamilyInvite> {
    const response = await this.fetchFn(
      authUrl(this.baseUrl, "/api/family/circle/invite/regenerate"),
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    )
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "Regenerate invite failed"))
    }
    return (await response.json()) as FamilyInvite
  }

  async joinCircle(
    accessToken: string,
    body: JoinFamilyCircleRequest,
  ): Promise<FamilyCircle> {
    const response = await this.fetchFn(authUrl(this.baseUrl, "/api/family/circle/join"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "Join family circle failed"))
    }
    return (await response.json()) as FamilyCircle
  }

  async leaveCircle(accessToken: string): Promise<void> {
    const response = await this.fetchFn(authUrl(this.baseUrl, "/api/family/circle/leave"), {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!response.ok && response.status !== 204) {
      throw new Error(await readErrorMessage(response, "Leave family circle failed"))
    }
  }

  async updateMemberRole(
    accessToken: string,
    adultId: string,
    role: FamilyRole,
  ): Promise<FamilyCircle> {
    const response = await this.fetchFn(
      authUrl(this.baseUrl, `/api/family/circle/members/${adultId}`),
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role }),
      },
    )
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "Update member role failed"))
    }
    return (await response.json()) as FamilyCircle
  }

  async removeMember(accessToken: string, adultId: string): Promise<void> {
    const response = await this.fetchFn(
      authUrl(this.baseUrl, `/api/family/circle/members/${adultId}`),
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    )
    if (!response.ok && response.status !== 204) {
      throw new Error(await readErrorMessage(response, "Remove member failed"))
    }
  }

  async addKid(accessToken: string, displayName: string): Promise<Kid> {
    const response = await this.fetchFn(authUrl(this.baseUrl, "/api/family/circle/kids"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ displayName }),
    })
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "Add kid failed"))
    }
    return (await response.json()) as Kid
  }

  async updateKid(
    accessToken: string,
    kidId: string,
    displayName: string,
  ): Promise<Kid> {
    const response = await this.fetchFn(
      authUrl(this.baseUrl, `/api/family/circle/kids/${kidId}`),
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ displayName }),
      },
    )
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "Update kid failed"))
    }
    return (await response.json()) as Kid
  }

  async deleteKid(accessToken: string, kidId: string): Promise<void> {
    const response = await this.fetchFn(
      authUrl(this.baseUrl, `/api/family/circle/kids/${kidId}`),
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    )
    if (!response.ok && response.status !== 204) {
      throw new Error(await readErrorMessage(response, "Delete kid failed"))
    }
  }

  async addPlace(accessToken: string, name: string, address: string): Promise<Place> {
    const response = await this.fetchFn(authUrl(this.baseUrl, "/api/family/circle/places"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, address }),
    })
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "Add place failed"))
    }
    return (await response.json()) as Place
  }

  async updatePlace(
    accessToken: string,
    placeId: string,
    name: string,
    address: string,
  ): Promise<Place> {
    const response = await this.fetchFn(
      authUrl(this.baseUrl, `/api/family/circle/places/${placeId}`),
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, address }),
      },
    )
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "Update place failed"))
    }
    return (await response.json()) as Place
  }

  async deletePlace(accessToken: string, placeId: string): Promise<void> {
    const response = await this.fetchFn(
      authUrl(this.baseUrl, `/api/family/circle/places/${placeId}`),
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    )
    if (!response.ok && response.status !== 204) {
      throw new Error(await readErrorMessage(response, "Delete place failed"))
    }
  }

  async locatePlace(accessToken: string, placeId: string): Promise<Place> {
    const response = await this.fetchFn(
      authUrl(this.baseUrl, `/api/family/circle/places/${placeId}/locate`),
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    )
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "Locate place failed"))
    }
    return (await response.json()) as Place
  }

  async getGarage(accessToken: string): Promise<Garage> {
    const response = await this.fetchFn(authUrl(this.baseUrl, "/api/family/circle/garage"), {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "Get garage failed"))
    }
    return (await response.json()) as Garage
  }

  async patchGarageDrives(accessToken: string, drives: boolean): Promise<Garage> {
    const response = await this.fetchFn(authUrl(this.baseUrl, "/api/family/circle/garage/me"), {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ drives }),
    })
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "Update drives failed"))
    }
    return (await response.json()) as Garage
  }

  async listGarageMakes(accessToken: string): Promise<VehicleMake[]> {
    const response = await this.fetchFn(
      authUrl(this.baseUrl, "/api/family/circle/garage/makes"),
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    )
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "List vehicle makes failed"))
    }
    return (await response.json()) as VehicleMake[]
  }

  async listGarageModels(
    accessToken: string,
    year: number,
    make: string,
  ): Promise<VehicleModel[]> {
    const params = new URLSearchParams({ year: String(year), make })
    const response = await this.fetchFn(
      authUrl(this.baseUrl, `/api/family/circle/garage/models?${params}`),
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    )
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "List vehicle models failed"))
    }
    return (await response.json()) as VehicleModel[]
  }

  async suggestGarageSeats(
    accessToken: string,
    body: SuggestSeatsRequest,
  ): Promise<SuggestSeatsResponse> {
    const response = await this.fetchFn(
      authUrl(this.baseUrl, "/api/family/circle/garage/suggest-seats"),
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    )
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "Suggest seats failed"))
    }
    return (await response.json()) as SuggestSeatsResponse
  }

  async addVehicle(accessToken: string, body: CreateVehicleRequest): Promise<Vehicle> {
    const response = await this.fetchFn(
      authUrl(this.baseUrl, "/api/family/circle/garage/vehicles"),
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    )
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "Add vehicle failed"))
    }
    return (await response.json()) as Vehicle
  }

  async updateVehicle(
    accessToken: string,
    vehicleId: string,
    body: UpdateVehicleRequest,
  ): Promise<Vehicle> {
    const response = await this.fetchFn(
      authUrl(this.baseUrl, `/api/family/circle/garage/vehicles/${vehicleId}`),
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    )
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "Update vehicle failed"))
    }
    return (await response.json()) as Vehicle
  }

  async deleteVehicle(accessToken: string, vehicleId: string): Promise<void> {
    const response = await this.fetchFn(
      authUrl(this.baseUrl, `/api/family/circle/garage/vehicles/${vehicleId}`),
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    )
    if (!response.ok && response.status !== 204) {
      throw new Error(await readErrorMessage(response, "Delete vehicle failed"))
    }
  }

  async suggestVehicleSeats(
    accessToken: string,
    vehicleId: string,
  ): Promise<SuggestSeatsResponse> {
    const response = await this.fetchFn(
      authUrl(this.baseUrl, `/api/family/circle/garage/vehicles/${vehicleId}/suggest-seats`),
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    )
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "Suggest vehicle seats failed"))
    }
    return (await response.json()) as SuggestSeatsResponse
  }

  async setDefaultLeaveFrom(
    accessToken: string,
    body: SetDefaultLeaveFromRequest,
  ): Promise<FamilyCircle> {
    const response = await this.fetchFn(
      authUrl(this.baseUrl, "/api/family/circle/default-leave-from"),
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    )
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "Set default leave-from failed"))
    }
    return (await response.json()) as FamilyCircle
  }

  async listFeeds(accessToken: string): Promise<ActivityFeed[]> {
    const response = await this.fetchFn(authUrl(this.baseUrl, "/api/family/circle/feeds"), {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "List feeds failed"))
    }
    return (await response.json()) as ActivityFeed[]
  }

  async createFeed(
    accessToken: string,
    name: string,
    sourceUrl: string,
    kidIds: string[] = [],
  ): Promise<ActivityFeed> {
    const response = await this.fetchFn(authUrl(this.baseUrl, "/api/family/circle/feeds"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, sourceUrl, kidIds }),
    })
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "Create feed failed"))
    }
    return (await response.json()) as ActivityFeed
  }

  async updateFeed(
    accessToken: string,
    feedId: string,
    name: string,
    sourceUrl: string,
    kidIds: string[] = [],
  ): Promise<ActivityFeed> {
    const response = await this.fetchFn(
      authUrl(this.baseUrl, `/api/family/circle/feeds/${feedId}`),
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, sourceUrl, kidIds }),
      },
    )
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "Update feed failed"))
    }
    return (await response.json()) as ActivityFeed
  }

  async deleteFeed(accessToken: string, feedId: string): Promise<void> {
    const response = await this.fetchFn(
      authUrl(this.baseUrl, `/api/family/circle/feeds/${feedId}`),
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    )
    if (!response.ok && response.status !== 204) {
      throw new Error(await readErrorMessage(response, "Delete feed failed"))
    }
  }

  async syncFeed(accessToken: string, feedId: string): Promise<ActivityFeed> {
    const response = await this.fetchFn(
      authUrl(this.baseUrl, `/api/family/circle/feeds/${feedId}/sync`),
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    )
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "Sync feed failed"))
    }
    return (await response.json()) as ActivityFeed
  }

  async listCalendar(
    accessToken: string,
    from: string,
    to: string,
  ): Promise<CalendarItem[]> {
    const params = new URLSearchParams({ from, to })
    const response = await this.fetchFn(
      authUrl(this.baseUrl, `/api/family/circle/calendar?${params}`),
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    )
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "List calendar failed"))
    }
    return (await response.json()) as CalendarItem[]
  }

  async listCalendarLeaveBy(
    accessToken: string,
    from: string,
    to: string,
  ): Promise<CalendarLeaveBy[]> {
    const params = new URLSearchParams({ from, to })
    const response = await this.fetchFn(
      authUrl(this.baseUrl, `/api/family/circle/calendar/leave-by?${params}`),
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    )
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "List calendar leave-by failed"))
    }
    return (await response.json()) as CalendarLeaveBy[]
  }

  async setCalendarLeaveFrom(
    accessToken: string,
    source: CalendarItemSource,
    itemId: string,
    body: SetCalendarLeaveFromRequest,
  ): Promise<CalendarItem> {
    const response = await this.fetchFn(
      authUrl(
        this.baseUrl,
        `/api/family/circle/calendar/${source}/${itemId}/leave-from`,
      ),
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    )
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "Set leave-from failed"))
    }
    return (await response.json()) as CalendarItem
  }

  async assignCalendarCoverage(
    accessToken: string,
    source: CalendarItemSource,
    itemId: string,
    body: AssignCalendarCoverageRequest,
  ): Promise<CalendarItem> {
    const response = await this.fetchFn(
      authUrl(
        this.baseUrl,
        `/api/family/circle/calendar/${source}/${itemId}/coverages`,
      ),
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    )
    if (!response.ok) {
      const detail = await readErrorMessage(response, "Assign coverage failed")
      throw new Error(`${detail} (${source}/${itemId})`)
    }
    return (await response.json()) as CalendarItem
  }

  async reassignCalendarCoverage(
    accessToken: string,
    assignmentId: string,
    body: AssignCalendarCoverageRequest,
  ): Promise<CalendarItem> {
    const response = await this.fetchFn(
      authUrl(this.baseUrl, `/api/family/circle/calendar/coverages/${assignmentId}`),
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    )
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "Reassign coverage failed"))
    }
    return (await response.json()) as CalendarItem
  }

  async removeCalendarCoverage(
    accessToken: string,
    assignmentId: string,
  ): Promise<CalendarItem> {
    const response = await this.fetchFn(
      authUrl(this.baseUrl, `/api/family/circle/calendar/coverages/${assignmentId}`),
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    )
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "Remove coverage failed"))
    }
    return (await response.json()) as CalendarItem
  }

  async confirmCalendarCoverage(
    accessToken: string,
    assignmentId: string,
  ): Promise<CalendarItem> {
    const response = await this.fetchFn(
      authUrl(
        this.baseUrl,
        `/api/family/circle/calendar/coverages/${assignmentId}/confirm`,
      ),
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    )
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "Confirm coverage failed"))
    }
    return (await response.json()) as CalendarItem
  }

  async declineCalendarCoverage(
    accessToken: string,
    assignmentId: string,
  ): Promise<CalendarItem> {
    const response = await this.fetchFn(
      authUrl(
        this.baseUrl,
        `/api/family/circle/calendar/coverages/${assignmentId}/decline`,
      ),
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    )
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "Decline coverage failed"))
    }
    return (await response.json()) as CalendarItem
  }

  async setCalendarRsvp(
    accessToken: string,
    source: CalendarItemSource,
    itemId: string,
    kidId: string,
    body: SetCalendarRsvpRequest,
  ): Promise<CalendarItem> {
    const response = await this.fetchFn(
      authUrl(
        this.baseUrl,
        `/api/family/circle/calendar/${source}/${itemId}/rsvps/${kidId}`,
      ),
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    )
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "Set RSVP failed"))
    }
    return (await response.json()) as CalendarItem
  }

  async listEvents(accessToken: string): Promise<ManualEvent[]> {
    const response = await this.fetchFn(authUrl(this.baseUrl, "/api/family/circle/events"), {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "List events failed"))
    }
    return (await response.json()) as ManualEvent[]
  }

  async getEvent(accessToken: string, eventId: string): Promise<ManualEvent> {
    const response = await this.fetchFn(
      authUrl(this.baseUrl, `/api/family/circle/events/${eventId}`),
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    )
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "Get event failed"))
    }
    return (await response.json()) as ManualEvent
  }

  async createEvent(
    accessToken: string,
    title: string,
    startsAt: string,
    kidIds: string[],
    endsAt: string | null = null,
    location: string | null = null,
  ): Promise<ManualEvent> {
    const response = await this.fetchFn(authUrl(this.baseUrl, "/api/family/circle/events"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title, startsAt, endsAt, location, kidIds }),
    })
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "Create event failed"))
    }
    return (await response.json()) as ManualEvent
  }

  async updateEvent(
    accessToken: string,
    eventId: string,
    title: string,
    startsAt: string,
    kidIds: string[],
    endsAt: string | null = null,
    location: string | null = null,
  ): Promise<ManualEvent> {
    const response = await this.fetchFn(
      authUrl(this.baseUrl, `/api/family/circle/events/${eventId}`),
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title, startsAt, endsAt, location, kidIds }),
      },
    )
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "Update event failed"))
    }
    return (await response.json()) as ManualEvent
  }

  async deleteEvent(accessToken: string, eventId: string): Promise<void> {
    const response = await this.fetchFn(
      authUrl(this.baseUrl, `/api/family/circle/events/${eventId}`),
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    )
    if (!response.ok && response.status !== 204) {
      throw new Error(await readErrorMessage(response, "Delete event failed"))
    }
  }
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string }
    if (typeof body.message === "string" && body.message.length > 0) {
      return body.message
    }
  } catch {
    // ignore non-JSON error bodies
  }
  return `${fallback} (${response.status})`
}
