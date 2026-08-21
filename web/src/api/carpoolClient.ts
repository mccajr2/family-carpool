import { authUrl } from "@/api/authClient"
import type {
  AcceptCarpoolRideRequest,
  CarpoolInvite,
  CarpoolJoinRequest,
  CarpoolRide,
  CarpoolRideEvent,
  CarpoolSpace,
  CarpoolSummary,
  CreateCarpoolRideRequest,
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

  async acceptRide(
    accessToken: string,
    spaceId: string,
    rideId: string,
    request: AcceptCarpoolRideRequest,
  ): Promise<CarpoolRide> {
    const response = await this.fetchFn(
      authUrl(this.baseUrl, `/api/carpool/spaces/${spaceId}/rides/${rideId}/accept`),
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ vehicleId: request.vehicleId }),
      },
    )
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "Accept carpool ride failed"))
    }
    return (await response.json()) as CarpoolRide
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
