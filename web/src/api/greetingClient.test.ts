import { describe, expect, it, vi } from "vitest"

import { GreetingClient } from "@/api/greetingClient"

describe("GreetingClient", () => {
  it("calls GET /api/greeting with the name query param", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "Hello, Web, from a Spring Modulith module." }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )

    const client = new GreetingClient("http://localhost:8080", fetchFn)
    const message = await client.fetchGreeting("Web")

    expect(message).toBe("Hello, Web, from a Spring Modulith module.")
    expect(fetchFn).toHaveBeenCalledOnce()
    const requested = String(fetchFn.mock.calls[0]?.[0])
    expect(requested).toBe("http://localhost:8080/api/greeting?name=Web")
  })

  it("throws when the response is not ok", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("", { status: 500 }))
    const client = new GreetingClient("http://localhost:8080", fetchFn)

    await expect(client.fetchGreeting("Web")).rejects.toThrow(
      "Greeting request failed (500)",
    )
  })
})
