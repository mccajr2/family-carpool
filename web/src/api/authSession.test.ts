import { describe, expect, it } from "vitest"

import { AuthSessionHolder } from "@/api/authSession"

describe("AuthSessionHolder", () => {
  it("stores and clears an in-memory session", () => {
    const session = new AuthSessionHolder()
    expect(session.isSignedIn()).toBe(false)

    session.setSession("tok", {
      id: "1",
      email: "parent@example.com",
      displayName: null,
    })

    expect(session.isSignedIn()).toBe(true)
    expect(session.getAccessToken()).toBe("tok")
    expect(session.getAdult()?.email).toBe("parent@example.com")

    session.clear()
    expect(session.isSignedIn()).toBe(false)
    expect(session.getAccessToken()).toBeNull()
  })
})
