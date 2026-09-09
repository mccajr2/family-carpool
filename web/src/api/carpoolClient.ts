import { authUrl } from "@/api/authClient"
import type {
  CarpoolInvite,
  CarpoolJoinRequest,
  CarpoolRide,
  CarpoolRideEvent,
  CarpoolRequest,
  CarpoolSpace,
  CarpoolSummary,
  CreateCarpoolRequestRequest,
  CreateCarpoolRideRequest,
  PatchCarpoolRequestRequest,
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

  async createCarpoolRequest(
    accessToken: string,
    spaceId: string,
    request: CreateCarpoolRequestRequest,
  ): Promise<CarpoolRequest> {
    const response = await this.fetchFn(
      authUrl(this.baseUrl, `/api/carpool/spaces/${spaceId}/requests`),
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
      throw new Error(await readErrorMessage(response, "Request carpool ride failed"))
    }
    return (await response.json()) as CarpoolRequest
  }

  async patchCarpoolRequest(
    accessToken: string,
    spaceId: string,
    requestId: string,
    request: PatchCarpoolRequestRequest,
  ): Promise<CarpoolRequest> {
    const response = await this.fetchFn(
      authUrl(this.baseUrl, `/api/carpool/spaces/${spaceId}/requests/${requestId}`),
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      },
    )
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "Update carpool request failed"))
    }
    return (await response.json()) as CarpoolRequest
  }

  async createRide(
    accessToken: string,
    spaceId: string,
    request: CreateCarpoolRideRequest,
  ): Promise<CarpoolRide> {
    const response = await this.fetchFn(
      authUrl(this.baseUrl, `/api/carpool/spaces/${spaceId}/rides`),
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
      throw new Error(await readErrorMessage(response, "Create carpool ride failed"))
    }
    return (await response.json()) as CarpoolRide
  }

  async passRequest(
    accessToken: string,
    spaceId: string,
    requestId: string,
  ): Promise<CarpoolRequest> {
    const response = await this.fetchFn(
      authUrl(this.baseUrl, `/api/carpool/spaces/${spaceId}/requests/${requestId}/pass`),
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    )
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "Pass carpool request failed"))
    }
    return (await response.json()) as CarpoolRequest
  }

  async cancelRide(accessToken: string, spaceId: string, rideId: string): Promise<CarpoolRide> {
    const response = await this.fetchFn(
      authUrl(this.baseUrl, `/api/carpool/spaces/${spaceId}/rides/${rideId}/cancel`),
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
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
  ): Promise<CarpoolRide> {
    const response = await this.fetchFn(
      authUrl(this.baseUrl, `/api/carpool/spaces/${spaceId}/rides/${rideId}/withdraw`),
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    )
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "Withdraw carpool ride failed"))
    }
    return (await response.json()) as CarpoolRide
  }

  // Backward-compatible aliases for in-progress UI migration.
  async acceptRide(
    accessToken: string,
    spaceId: string,
    requestId: string,
    request: { vehicleId: string; eventKey?: string; leg?: "TO" | "FROM"; passengerRequestIds?: string[] },
  ): Promise<CarpoolRide> {
    if (request.eventKey == null || request.leg == null) {
      throw new Error("Accept carpool ride failed: eventKey and leg are required")
    }
    const createRequest: CreateCarpoolRideRequest = {
      eventKey: request.eventKey,
      leg: request.leg,
      vehicleId: request.vehicleId,
      passengerRequestIds: request.passengerRequestIds ?? [requestId],
    }
    return this.createRide(accessToken, spaceId, createRequest)
  }

  async passRide(accessToken: string, spaceId: string, rideId: string): Promise<CarpoolRequest> {
    return this.passRequest(accessToken, spaceId, rideId)
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
