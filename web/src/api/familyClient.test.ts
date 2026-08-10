import { describe, expect, it, vi } from "vitest"

import { FamilyClient } from "@/api/familyClient"

const sampleCircle = {
  id: "c1",
  name: "Our house",
  role: "ORGANIZER" as const,
  members: [
    {
      adultId: "1",
      email: "a@example.com",
      displayName: "Alex",
      role: "ORGANIZER" as const,
    },
  ],
  kids: [],
  places: [],
}

describe("FamilyClient", () => {
  it("creates a circle with Bearer auth", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(sampleCircle), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    )

    const client = new FamilyClient("http://localhost:8080", fetchFn)
    const circle = await client.createCircle("tok", {
      adultDisplayName: "Alex",
      name: "Our house",
    })

    expect(circle.role).toBe("ORGANIZER")
    expect(circle.members).toHaveLength(1)
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

  it("joins with invite code and leaves", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ...sampleCircle,
            role: "CAREGIVER",
            members: [
              ...sampleCircle.members,
              {
                adultId: "2",
                email: "b@example.com",
                displayName: "Jordan",
                role: "CAREGIVER",
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))

    const client = new FamilyClient("http://localhost:8080", fetchFn)
    const joined = await client.joinCircle("tok", {
      code: "AB12CD34",
      adultDisplayName: "Jordan",
    })
    expect(joined.role).toBe("CAREGIVER")
    await client.leaveCircle("tok")

    expect(fetchFn.mock.calls[0]?.[0]).toBe("http://localhost:8080/api/family/circle/join")
    expect(fetchFn.mock.calls[1]?.[0]).toBe("http://localhost:8080/api/family/circle/leave")
  })

  it("gets and regenerates invite code", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: "AB12CD34" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: "XY98ZW76" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )

    const client = new FamilyClient("http://localhost:8080", fetchFn)
    await expect(client.getInvite("tok")).resolves.toEqual({ code: "AB12CD34" })
    await expect(client.regenerateInvite("tok")).resolves.toEqual({ code: "XY98ZW76" })
  })

  it("updates member role and removes a member", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(sampleCircle), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))

    const client = new FamilyClient("http://localhost:8080", fetchFn)
    await client.updateMemberRole("tok", "2", "ORGANIZER")
    await client.removeMember("tok", "2")

    expect(fetchFn.mock.calls[0]?.[0]).toBe(
      "http://localhost:8080/api/family/circle/members/2",
    )
    expect((fetchFn.mock.calls[0]?.[1] as RequestInit).method).toBe("PATCH")
    expect(fetchFn.mock.calls[1]?.[0]).toBe(
      "http://localhost:8080/api/family/circle/members/2",
    )
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

  it("adds updates and deletes places", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ id: "p1", name: "Mom's house", address: "123 Main St" }),
          {
            status: 201,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ id: "p1", name: "Mom's house", address: "456 Oak Ave" }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))

    const client = new FamilyClient("http://localhost:8080", fetchFn)
    await expect(client.addPlace("tok", "Mom's house", "123 Main St")).resolves.toMatchObject({
      name: "Mom's house",
      address: "123 Main St",
    })
    await expect(
      client.updatePlace("tok", "p1", "Mom's house", "456 Oak Ave"),
    ).resolves.toMatchObject({
      address: "456 Oak Ave",
    })
    await client.deletePlace("tok", "p1")

    expect(fetchFn.mock.calls[0]?.[0]).toBe("http://localhost:8080/api/family/circle/places")
    expect(fetchFn.mock.calls[2]?.[0]).toBe(
      "http://localhost:8080/api/family/circle/places/p1",
    )
  })
})
