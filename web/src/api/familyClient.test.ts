import { describe, expect, it, vi } from "vitest"

import { FamilyClient } from "@/api/familyClient"

describe("FamilyClient", () => {
  it("creates a circle with Bearer auth", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "c1",
          name: "Our house",
          role: "ORGANIZER",
          kids: [],
        }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      ),
    )

    const client = new FamilyClient("http://localhost:8080", fetchFn)
    const circle = await client.createCircle("tok", {
      adultDisplayName: "Alex",
      name: "Our house",
    })

    expect(circle.role).toBe("ORGANIZER")
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("http://localhost:8080/api/family/circle")
    expect(init.method).toBe("POST")
    expect(init.headers).toMatchObject({ Authorization: "Bearer tok" })
  })

  it("returns null when get circle is 404", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response(null, { status: 404 }))
    const client = new FamilyClient("http://localhost:8080", fetchFn)

    await expect(client.getCircle("tok")).resolves.toBeNull()
  })

  it("adds renames and deletes kids", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "k1", displayName: "Sam" }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "k1", displayName: "Samantha" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))

    const client = new FamilyClient("http://localhost:8080", fetchFn)
    await expect(client.addKid("tok", "Sam")).resolves.toMatchObject({
      displayName: "Sam",
    })
    await expect(client.updateKid("tok", "k1", "Samantha")).resolves.toMatchObject({
      displayName: "Samantha",
    })
    await client.deleteKid("tok", "k1")

    expect(fetchFn.mock.calls[2]?.[0]).toBe(
      "http://localhost:8080/api/family/circle/kids/k1",
    )
  })
})
