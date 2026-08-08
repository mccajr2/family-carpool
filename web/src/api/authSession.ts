import type { Adult } from "@/api/types"

/**
 * In-memory Bearer session for web v1 (not localStorage).
 * Hardening to HTTP-only cookies is a later roadmap slice.
 */
export class AuthSessionHolder {
  private accessToken: string | null = null
  private adult: Adult | null = null

  getAccessToken(): string | null {
    return this.accessToken
  }

  getAdult(): Adult | null {
    return this.adult
  }

  isSignedIn(): boolean {
    return this.accessToken !== null
  }

  setSession(accessToken: string, adult: Adult): void {
    this.accessToken = accessToken
    this.adult = adult
  }

  clear(): void {
    this.accessToken = null
    this.adult = null
  }
}

export const authSession = new AuthSessionHolder()
