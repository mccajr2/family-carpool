import { describe, expect, it, vi } from "vitest"

import { AuthClient } from "@/api/authClient"

describe("AuthClient", () => {
  it("POSTs request-code and returns the body", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          email: "parent@example.com",
          expiresInSeconds: 600,
          devCode: "123456",
        }),
        { status: 202, headers: { "Content-Type": "application/json" } },
      ),
    )

    const client = new AuthClient("http://localhost:8080", fetchFn)
    const result = await client.requestCode("parent@example.com")

    expect(result.devCode).toBe("123456")
    expect(fetchFn).toHaveBeenCalledOnce()
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("http://localhost:8080/api/auth/request-code")
    expect(init.method).toBe("POST")
  })

  it("verifies a code and returns a Bearer session", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          accessToken: "tok",
          tokenType: "Bearer",
          adult: { id: "1", email: "parent@example.com", displayName: null },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    )

    const client = new AuthClient("http://localhost:8080", fetchFn)
    const session = await client.verifyCode("parent@example.com", "123456")

    expect(session.accessToken).toBe("tok")
    expect(session.adult.email).toBe("parent@example.com")
  })

  it("sends Bearer on me and logout", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ id: "1", email: "parent@example.com", displayName: null }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))

    const client = new AuthClient("http://localhost:8080", fetchFn)
    await client.getMe("tok")
    await client.logout("tok")

    expect(fetchFn.mock.calls[0]?.[1]).toMatchObject({
      headers: { Authorization: "Bearer tok" },
    })
    expect(fetchFn.mock.calls[1]?.[1]).toMatchObject({
      method: "POST",
      headers: { Authorization: "Bearer tok" },
    })
  })

  it("throws with server message when request fails", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "Too many code requests" }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      }),
    )
    const client = new AuthClient("http://localhost:8080", fetchFn)

    await expect(client.requestCode("parent@example.com")).rejects.toThrow(
      "Too many code requests",
    )
  })
})
