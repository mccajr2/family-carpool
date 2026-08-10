import { authUrl } from "@/api/authClient"
import type {
  ActivityFeed,
  CreateFamilyCircleRequest,
  FamilyCircle,
  FamilyInvite,
  FamilyRole,
  JoinFamilyCircleRequest,
  Kid,
  Place,
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
