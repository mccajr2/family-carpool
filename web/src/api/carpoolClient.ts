import { authUrl } from "@/api/authClient"
import type {
  CancelCarpoolRideRequest,
  CarpoolInvite,
  CarpoolJoinRequest,
  CarpoolRide,
  CarpoolRideEvent,
  CarpoolSpace,
  CarpoolSummary,
  ClearCarpoolRidePlanRequest,
  CreateCarpoolRideRequest,
  SaveCarpoolRidePlanLeg,
  SaveCarpoolRidePlanRequest,
  SaveCarpoolRidePlanResponse,
  WithdrawCarpoolRideRequest,
} from "@/api/types"
import { apiBaseUrl } from "@/config"

export class CarpoolClient {
  private readonly baseUrl: string
  private readonly fetchFn: typeof fetch

  constructor(
    baseUrl: string = apiBaseUrl,
    fetchFn: typeof fetch = globalThis.fetch.bind(globalThis),
  ) {
    this.baseUrl = baseUrl
    this.fetchFn = fetchFn
  }

  async getSummary(accessToken: string): Promise<CarpoolSummary> {
    const response = await this.fetchFn(authUrl(this.baseUrl, "/api/carpool"), {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "Get carpool summary failed"))
    }
    return (await response.json()) as CarpoolSummary
  }

  async enable(accessToken: string, feedId: string): Promise<CarpoolSpace> {
    const response = await this.fetchFn(authUrl(this.baseUrl, "/api/carpool/enable"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ feedId }),
    })
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "Enable carpool failed"))
    }
    return (await response.json()) as CarpoolSpace
  }

  async join(accessToken: string, code: string): Promise<CarpoolSpace> {
    const response = await this.fetchFn(authUrl(this.baseUrl, "/api/carpool/join"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code }),
    })
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "Join carpool failed"))
    }
    return (await response.json()) as CarpoolSpace
  }

  async getSpace(accessToken: string, spaceId: string): Promise<CarpoolSpace> {
    const response = await this.fetchFn(
      authUrl(this.baseUrl, `/api/carpool/spaces/${spaceId}`),
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    )
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "Get carpool space failed"))
    }
    return (await response.json()) as CarpoolSpace
  }

  async regenerateInvite(accessToken: string, spaceId: string): Promise<CarpoolInvite> {
    const response = await this.fetchFn(
      authUrl(this.baseUrl, `/api/carpool/spaces/${spaceId}/invite/regenerate`),
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    )
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "Regenerate carpool invite failed"))
    }
    return (await response.json()) as CarpoolInvite
  }

  async leave(accessToken: string, spaceId: string): Promise<void> {
    const response = await this.fetchFn(
      authUrl(this.baseUrl, `/api/carpool/spaces/${spaceId}/leave`),
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    )
    if (!response.ok && response.status !== 204) {
      throw new Error(await readErrorMessage(response, "Leave carpool failed"))
    }
  }

  async createRequest(accessToken: string, spaceId: string): Promise<CarpoolJoinRequest> {
    const response = await this.fetchFn(
      authUrl(this.baseUrl, `/api/carpool/spaces/${spaceId}/requests`),
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    )
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "Request to join carpool failed"))
    }
    return (await response.json()) as CarpoolJoinRequest
  }

  async admit(
    accessToken: string,
    spaceId: string,
    requestId: string,
  ): Promise<CarpoolSpace> {
    const response = await this.fetchFn(
      authUrl(this.baseUrl, `/api/carpool/spaces/${spaceId}/requests/${requestId}/admit`),
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    )
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "Admit carpool request failed"))
    }
    return (await response.json()) as CarpoolSpace
  }

  async decline(accessToken: string, spaceId: string, requestId: string): Promise<void> {
    const response = await this.fetchFn(
      authUrl(
        this.baseUrl,
        `/api/carpool/spaces/${spaceId}/requests/${requestId}/decline`,
      ),
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    )
    if (!response.ok && response.status !== 204) {
      throw new Error(await readErrorMessage(response, "Decline carpool request failed"))
    }
  }

  async listRides(
    accessToken: string,
    spaceId: string,
    from: string,
    to: string,
  ): Promise<CarpoolRideEvent[]> {
    const params = new URLSearchParams({ from, to })
    const response = await this.fetchFn(
      authUrl(this.baseUrl, `/api/carpool/spaces/${spaceId}/rides?${params}`),
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    )
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "List carpool rides failed"))
    }
    return (await response.json()) as CarpoolRideEvent[]
  }

  async createRide(
    accessToken: string,
    spaceId: string,
    request: CreateCarpoolRideRequest,
  ): Promise<CarpoolRide> {
    const body: CreateCarpoolRideRequest = { eventKey: request.eventKey }
    if (request.kidIds != null) {
      body.kidIds = request.kidIds
    }
    if (request.legs != null) {
      body.legs = request.legs
    }
    const response = await this.fetchFn(
      authUrl(this.baseUrl, `/api/carpool/spaces/${spaceId}/rides`),
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
      throw new Error(await readErrorMessage(response, "Request carpool ride failed"))
    }
    return (await response.json()) as CarpoolRide
  }

  async saveRidePlan(
    accessToken: string,
    spaceId: string,
    request: SaveCarpoolRidePlanRequest,
  ): Promise<SaveCarpoolRidePlanResponse> {
    const body: SaveCarpoolRidePlanRequest = {
      eventKey: request.eventKey,
      legs: request.legs.map((leg) => {
        const entry: SaveCarpoolRidePlanLeg = {
          kind: leg.kind,
          action: leg.action,
        }
        if (leg.assigneeAdultId != null) {
          entry.assigneeAdultId = leg.assigneeAdultId
        }
        return entry
      }),
    }
    if (request.kidIds != null) {
      body.kidIds = request.kidIds
    }
    const response = await this.fetchFn(
      authUrl(this.baseUrl, `/api/carpool/spaces/${spaceId}/ride-plans`),
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
      throw new Error(await readErrorMessage(response, "Save carpool ride plan failed"))
    }
    return (await response.json()) as SaveCarpoolRidePlanResponse
  }

  async confirmHouseholdRidePlan(
    accessToken: string,
    spaceId: string,
    request: { eventKey: string },
  ): Promise<SaveCarpoolRidePlanResponse> {
    const response = await this.fetchFn(
      authUrl(this.baseUrl, `/api/carpool/spaces/${spaceId}/ride-plans/confirm-household`),
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ eventKey: request.eventKey }),
      },
    )
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "Confirm household ride plan failed"))
    }
    return (await response.json()) as SaveCarpoolRidePlanResponse
  }

  async declineHouseholdRidePlan(
    accessToken: string,
    spaceId: string,
    request: { eventKey: string },
  ): Promise<SaveCarpoolRidePlanResponse> {
    const response = await this.fetchFn(
      authUrl(this.baseUrl, `/api/carpool/spaces/${spaceId}/ride-plans/decline-household`),
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ eventKey: request.eventKey }),
      },
    )
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "Decline household ride plan failed"))
    }
    return (await response.json()) as SaveCarpoolRidePlanResponse
  }

  async listCircleRidePlans(accessToken: string): Promise<CarpoolRideEvent[]> {
    const response = await this.fetchFn(authUrl(this.baseUrl, "/api/carpool/ride-plans"), {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "List circle ride plans failed"))
    }
    return (await response.json()) as CarpoolRideEvent[]
  }

  async saveCircleRidePlan(
    accessToken: string,
    request: SaveCarpoolRidePlanRequest,
  ): Promise<SaveCarpoolRidePlanResponse> {
    const body: SaveCarpoolRidePlanRequest = {
      eventKey: request.eventKey,
      legs: request.legs.map((leg) => {
        const entry: SaveCarpoolRidePlanLeg = {
          kind: leg.kind,
          action: leg.action,
        }
        if (leg.assigneeAdultId != null) {
          entry.assigneeAdultId = leg.assigneeAdultId
        }
        return entry
      }),
    }
    if (request.kidIds != null) {
      body.kidIds = request.kidIds
    }
    const response = await this.fetchFn(authUrl(this.baseUrl, "/api/carpool/ride-plans"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "Save circle ride plan failed"))
    }
    return (await response.json()) as SaveCarpoolRidePlanResponse
  }

  async confirmCircleHouseholdRidePlan(
    accessToken: string,
    request: { eventKey: string },
  ): Promise<SaveCarpoolRidePlanResponse> {
    const response = await this.fetchFn(
      authUrl(this.baseUrl, "/api/carpool/ride-plans/confirm-household"),
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ eventKey: request.eventKey }),
      },
    )
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "Confirm circle household ride plan failed"))
    }
    return (await response.json()) as SaveCarpoolRidePlanResponse
  }

  async declineCircleHouseholdRidePlan(
    accessToken: string,
    request: { eventKey: string },
  ): Promise<SaveCarpoolRidePlanResponse> {
    const response = await this.fetchFn(
      authUrl(this.baseUrl, "/api/carpool/ride-plans/decline-household"),
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ eventKey: request.eventKey }),
      },
    )
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "Decline circle household ride plan failed"))
    }
    return (await response.json()) as SaveCarpoolRidePlanResponse
  }

  async clearRidePlanLegs(
    accessToken: string,
    spaceId: string,
    request: ClearCarpoolRidePlanRequest,
  ): Promise<SaveCarpoolRidePlanResponse> {
    const response = await this.fetchFn(
      authUrl(this.baseUrl, `/api/carpool/spaces/${spaceId}/ride-plans/clear-legs`),
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      },
    )
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "Clear ride plan legs failed"))
    }
    return (await response.json()) as SaveCarpoolRidePlanResponse
  }

  async clearCircleRidePlanLegs(
    accessToken: string,
    request: ClearCarpoolRidePlanRequest,
  ): Promise<SaveCarpoolRidePlanResponse> {
    const response = await this.fetchFn(
      authUrl(this.baseUrl, "/api/carpool/ride-plans/clear-legs"),
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      },
    )
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "Clear circle ride plan legs failed"))
    }
    return (await response.json()) as SaveCarpoolRidePlanResponse
  }

  async acceptRide(
    accessToken: string,
    spaceId: string,
    rideId: string,
  ): Promise<CarpoolRide> {
    const response = await this.fetchFn(
      authUrl(this.baseUrl, `/api/carpool/spaces/${spaceId}/rides/${rideId}/accept`),
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    )
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "Accept carpool ride failed"))
    }
    return (await response.json()) as CarpoolRide
  }

  async passRide(accessToken: string, spaceId: string, rideId: string): Promise<CarpoolRide> {
    const response = await this.fetchFn(
      authUrl(this.baseUrl, `/api/carpool/spaces/${spaceId}/rides/${rideId}/pass`),
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    )
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "Pass carpool ride failed"))
    }
    return (await response.json()) as CarpoolRide
  }

  async cancelRide(
    accessToken: string,
    spaceId: string,
    rideId: string,
    request: CancelCarpoolRideRequest = {},
  ): Promise<CarpoolRide> {
    const hasLegs = request.legs != null
    const response = await this.fetchFn(
      authUrl(this.baseUrl, `/api/carpool/spaces/${spaceId}/rides/${rideId}/cancel`),
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...(hasLegs ? { "Content-Type": "application/json" } : {}),
        },
        ...(hasLegs ? { body: JSON.stringify({ legs: request.legs }) } : {}),
      },
    )
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "Cancel carpool ride failed"))
    }
    return (await response.json()) as CarpoolRide
  }

  async withdrawRide(
    accessToken: string,
    spaceId: string,
    rideId: string,
    request: WithdrawCarpoolRideRequest = {},
  ): Promise<CarpoolRide> {
    const hasLegs = request.legs != null
    const response = await this.fetchFn(
      authUrl(this.baseUrl, `/api/carpool/spaces/${spaceId}/rides/${rideId}/withdraw`),
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...(hasLegs ? { "Content-Type": "application/json" } : {}),
        },
        ...(hasLegs ? { body: JSON.stringify({ legs: request.legs }) } : {}),
      },
    )
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "Withdraw carpool ride failed"))
    }
    return (await response.json()) as CarpoolRide
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
