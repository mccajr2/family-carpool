import { apiBaseUrl } from "@/config"
import type {
  Adult,
  AuthSessionResponse,
  RequestAuthCodeResponse,
} from "@/api/types"

export class AuthClient {
  private readonly baseUrl: string
  private readonly fetchFn: typeof fetch

  constructor(
    baseUrl: string = apiBaseUrl,
    fetchFn: typeof fetch = globalThis.fetch.bind(globalThis),
  ) {
    this.baseUrl = baseUrl
    this.fetchFn = fetchFn
  }

  async requestCode(email: string): Promise<RequestAuthCodeResponse> {
    const response = await this.fetchFn(authUrl(this.baseUrl, "/api/auth/request-code"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "Request code failed"))
    }
    return (await response.json()) as RequestAuthCodeResponse
  }

  async verifyCode(email: string, code: string): Promise<AuthSessionResponse> {
    const response = await this.fetchFn(authUrl(this.baseUrl, "/api/auth/verify-code"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    })
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "Verify code failed"))
    }
    return (await response.json()) as AuthSessionResponse
  }

  async getMe(accessToken: string): Promise<Adult> {
    const response = await this.fetchFn(authUrl(this.baseUrl, "/api/auth/me"), {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "Current adult failed"))
    }
    return (await response.json()) as Adult
  }

  async logout(accessToken: string): Promise<void> {
    const response = await this.fetchFn(authUrl(this.baseUrl, "/api/auth/logout"), {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!response.ok && response.status !== 204) {
      throw new Error(await readErrorMessage(response, "Logout failed"))
    }
  }
}

export function authUrl(baseUrl: string, path: string): string {
  if (!baseUrl) {
    return path
  }
  return new URL(path, `${baseUrl}/`).toString()
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
