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

  it("lists, creates, accepts, passes, cancels, and withdraws rides", async () => {
    const ride = {
      id: "ride-1",
      spaceId: "s1",
      eventKey: "UID:practice",
      requestingCircleId: "c2",
      requestingCircleName: "House B",
      requestedByAdultId: "a2",
      kidIds: ["k1"],
      kidFirstNames: ["Mia"],
      seats: 1,
      pickupPlaceName: "Home",
      pickupAddress: "1 Main St",
pickupTown: null,
detourMinutes: null,
      status: "PENDING",
      passedByMe: false,
      passedByAdultNames: [],
      acceptedByAdultId: null,
      acceptingCircleId: null,
      acceptingCircleName: null,
      vehicleId: null,
      vehicleLabel: null,
    }
    const event = {
      eventKey: "UID:practice",
      title: "Practice",
      startsAt: "2026-08-21T16:00:00Z",
      endsAt: null,
      defaultKidIds: ["k1"],
      ownRequest: null,
      otherRequests: [ride],
    }
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify([event]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(ride), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ...ride, status: "ACCEPTED", vehicleId: "v1" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ...ride, passedByMe: true, passedByAdultNames: ["Alex"] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ...ride, status: "CANCELLED" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ...ride, status: "PENDING" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
    const client = new CarpoolClient("http://localhost:8080", fetchFn)

    await expect(
      client.listRides("tok", "s1", "2026-08-01T00:00:00Z", "2026-08-31T00:00:00Z"),
    ).resolves.toMatchObject([{ title: "Practice" }])
    await expect(
      client.createRide("tok", "s1", { eventKey: "UID:practice" }),
    ).resolves.toMatchObject({ id: "ride-1", passedByMe: false })
    await expect(
      client.acceptRide("tok", "s1", "ride-1", { vehicleId: "v1" }),
    ).resolves.toMatchObject({ status: "ACCEPTED" })
    await expect(client.passRide("tok", "s1", "ride-1")).resolves.toMatchObject({
      passedByMe: true,
      passedByAdultNames: ["Alex"],
      status: "PENDING",
    })
    await expect(client.cancelRide("tok", "s1", "ride-1")).resolves.toMatchObject({
      status: "CANCELLED",
    })
    await expect(client.withdrawRide("tok", "s1", "ride-1")).resolves.toMatchObject({
      status: "PENDING",
    })

    const urls = fetchFn.mock.calls.map((call) => (call as [string, RequestInit])[0])
    expect(urls).toEqual([
      "http://localhost:8080/api/carpool/spaces/s1/rides?from=2026-08-01T00%3A00%3A00Z&to=2026-08-31T00%3A00%3A00Z",
      "http://localhost:8080/api/carpool/spaces/s1/rides",
      "http://localhost:8080/api/carpool/spaces/s1/rides/ride-1/accept",
      "http://localhost:8080/api/carpool/spaces/s1/rides/ride-1/pass",
      "http://localhost:8080/api/carpool/spaces/s1/rides/ride-1/cancel",
      "http://localhost:8080/api/carpool/spaces/s1/rides/ride-1/withdraw",
    ])
    expect((fetchFn.mock.calls[0] as [string, RequestInit])[1].headers).toMatchObject({
      Authorization: "Bearer tok",
    })
    expect((fetchFn.mock.calls[1] as [string, RequestInit])[1].body).toBe(
      JSON.stringify({ eventKey: "UID:practice" }),
    )
    expect((fetchFn.mock.calls[2] as [string, RequestInit])[1].body).toBe(
      JSON.stringify({ vehicleId: "v1" }),
    )
    expect((fetchFn.mock.calls[3] as [string, RequestInit])[1].method).toBe("POST")
    expect((fetchFn.mock.calls[3] as [string, RequestInit])[1].body).toBeUndefined()
  })
})
