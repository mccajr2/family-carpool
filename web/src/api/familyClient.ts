import { authUrl } from "@/api/authClient"
import type {
  CreateFamilyCircleRequest,
  FamilyCircle,
  Kid,
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
