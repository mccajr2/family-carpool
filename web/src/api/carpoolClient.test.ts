import { describe, expect, it, vi } from "vitest"

import { CarpoolClient } from "@/api/carpoolClient"
import type { CarpoolSpace, CarpoolSummary } from "@/api/types"

const sampleSpace: CarpoolSpace = {
  id: "s1",
  name: "Soccer",
  membership: "OWNER",
  inviteCode: "AB12CD34",
  callerFeedId: "f1",
  members: [
    { circleId: "c1", circleName: "House A", membership: "OWNER" },
  ],
  pendingRequests: [],
}

const sampleSummary: CarpoolSummary = {
  circleRole: "ORGANIZER",
  feeds: [
    {
      feedId: "f1",
      feedName: "Soccer",
      status: "NONE",
      spaceId: null,
      spaceName: null,
    },
  ],
  spaces: [],
}

describe("CarpoolClient", () => {
  it("loads summary with Bearer auth", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(sampleSummary), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )
    const client = new CarpoolClient("http://localhost:8080", fetchFn)

    const summary = await client.getSummary("tok")

    expect(summary.circleRole).toBe("ORGANIZER")
    expect(summary.feeds[0]?.status).toBe("NONE")
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("http://localhost:8080/api/carpool")
    expect(init.headers).toMatchObject({ Authorization: "Bearer tok" })
  })

  it("enables, joins, requests, admits, declines, regenerates, and leaves", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(sampleSpace), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ...sampleSpace, membership: "MEMBER" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(sampleSpace), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "r1",
            spaceId: "s1",
            circleId: "c2",
            circleName: "House B",
            requestedByAdultId: "a2",
            requestedByDisplayName: "Sam",
          }),
          { status: 201, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(sampleSpace), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: "XY98ZW76" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))

    const client = new CarpoolClient("http://localhost:8080", fetchFn)

    await client.enable("tok", "f1")
    await client.join("tok", "AB12CD34")
    await client.getSpace("tok", "s1")
    await client.createRequest("tok", "s1")
    await client.admit("tok", "s1", "r1")
    await client.decline("tok", "s1", "r1")
    const invite = await client.regenerateInvite("tok", "s1")
    await client.leave("tok", "s1")

    expect(invite.code).toBe("XY98ZW76")
    const urls = fetchFn.mock.calls.map((call) => (call as [string, RequestInit])[0])
    expect(urls).toEqual([
      "http://localhost:8080/api/carpool/enable",
      "http://localhost:8080/api/carpool/join",
      "http://localhost:8080/api/carpool/spaces/s1",
      "http://localhost:8080/api/carpool/spaces/s1/requests",
      "http://localhost:8080/api/carpool/spaces/s1/requests/r1/admit",
      "http://localhost:8080/api/carpool/spaces/s1/requests/r1/decline",
      "http://localhost:8080/api/carpool/spaces/s1/invite/regenerate",
      "http://localhost:8080/api/carpool/spaces/s1/leave",
    ])
    expect((fetchFn.mock.calls[0] as [string, RequestInit])[1].method).toBe("POST")
    expect((fetchFn.mock.calls[0] as [string, RequestInit])[1].body).toBe(
      JSON.stringify({ feedId: "f1" }),
    )
    expect((fetchFn.mock.calls[1] as [string, RequestInit])[1].body).toBe(
      JSON.stringify({ code: "AB12CD34" }),
    )
  })

  it("surfaces server error messages", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "Organizer role required" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }),
    )
    const client = new CarpoolClient("http://localhost:8080", fetchFn)

    await expect(client.enable("tok", "f1")).rejects.toThrow("Organizer role required")
  })
})
