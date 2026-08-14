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

  it("adds updates deletes and locates places", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "p1",
            name: "Mom's house",
            address: "123 Main St",
            latitude: 40.1,
            longitude: -74.2,
          }),
          {
            status: 201,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "p1",
            name: "Mom's house",
            address: "456 Oak Ave",
            latitude: 40.2,
            longitude: -74.3,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "p2",
            name: "School",
            address: "1 Rd",
            latitude: null,
            longitude: null,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )

    const client = new FamilyClient("http://localhost:8080", fetchFn)
    await expect(client.addPlace("tok", "Mom's house", "123 Main St")).resolves.toMatchObject({
      name: "Mom's house",
      address: "123 Main St",
      latitude: 40.1,
      longitude: -74.2,
    })
    await expect(
      client.updatePlace("tok", "p1", "Mom's house", "456 Oak Ave"),
    ).resolves.toMatchObject({
      address: "456 Oak Ave",
      latitude: 40.2,
    })
    await client.deletePlace("tok", "p1")
    await expect(client.locatePlace("tok", "p2")).resolves.toMatchObject({
      latitude: null,
      longitude: null,
    })

    expect(fetchFn.mock.calls[0]?.[0]).toBe("http://localhost:8080/api/family/circle/places")
    expect(fetchFn.mock.calls[2]?.[0]).toBe(
      "http://localhost:8080/api/family/circle/places/p1",
    )
    expect(fetchFn.mock.calls[3]?.[0]).toBe(
      "http://localhost:8080/api/family/circle/places/p2/locate",
    )
    expect(fetchFn.mock.calls[3]?.[1]).toMatchObject({ method: "POST" })
  })

  it("lists creates updates deletes and syncs activity feeds", async () => {
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      })

    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        json([
          {
            id: "f1",
            name: "Soccer",
            sourceUrl: "https://example.com/team.ics",
            kidIds: ["k1"],
            lastSyncedAt: "2026-08-10T12:00:00Z",
            lastSyncError: null,
            eventCount: 2,
          },
        ]),
      )
      .mockResolvedValueOnce(
        json(
          {
            id: "f2",
            name: "U12",
            sourceUrl: "https://example.com/u12.ics",
            kidIds: [],
            lastSyncedAt: "2026-08-10T12:01:00Z",
            lastSyncError: null,
            eventCount: 5,
          },
          201,
        ),
      )
      .mockResolvedValueOnce(
        json({
          id: "f2",
          name: "U12 Travel",
          sourceUrl: "https://example.com/u12.ics",
          kidIds: ["k1"],
          lastSyncedAt: "2026-08-10T12:02:00Z",
          lastSyncError: null,
          eventCount: 5,
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        json({
          id: "f1",
          name: "Soccer",
          sourceUrl: "https://example.com/team.ics",
          kidIds: ["k1"],
          lastSyncedAt: "2026-08-10T12:05:00Z",
          lastSyncError: "Fetch failed",
          eventCount: 2,
        }),
      )

    const client = new FamilyClient("http://localhost:8080", fetchFn)
    await expect(client.listFeeds("tok")).resolves.toMatchObject([
      { id: "f1", eventCount: 2 },
    ])
    await expect(
      client.createFeed("tok", "U12", "https://example.com/u12.ics", []),
    ).resolves.toMatchObject({ name: "U12", eventCount: 5 })
    await expect(
      client.updateFeed("tok", "f2", "U12 Travel", "https://example.com/u12.ics", [
        "k1",
      ]),
    ).resolves.toMatchObject({ name: "U12 Travel" })
    await client.deleteFeed("tok", "f2")
    await expect(client.syncFeed("tok", "f1")).resolves.toMatchObject({
      lastSyncError: "Fetch failed",
    })

    expect(fetchFn.mock.calls[0]?.[0]).toBe("http://localhost:8080/api/family/circle/feeds")
    expect(fetchFn.mock.calls[1]?.[1]).toMatchObject({ method: "POST" })
    expect(fetchFn.mock.calls[2]?.[0]).toBe(
      "http://localhost:8080/api/family/circle/feeds/f2",
    )
    expect(fetchFn.mock.calls[2]?.[1]).toMatchObject({ method: "PUT" })
    expect(fetchFn.mock.calls[4]?.[0]).toBe(
      "http://localhost:8080/api/family/circle/feeds/f1/sync",
    )
  })

  it("lists creates updates gets and deletes manual events", async () => {
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      })

    const event = {
      id: "e1",
      title: "Dentist",
      startsAt: "2026-08-15T17:00:00Z",
      endsAt: "2026-08-15T18:00:00Z",
      location: "Clinic",
      kidIds: ["k1"],
    }

    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(json([event]))
      .mockResolvedValueOnce(json({ ...event, id: "e2" }, 201))
      .mockResolvedValueOnce(json({ ...event, title: "Dentist 2" }))
      .mockResolvedValueOnce(json(event))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))

    const client = new FamilyClient("http://localhost:8080", fetchFn)

    await expect(client.listEvents("tok")).resolves.toMatchObject([{ title: "Dentist" }])
    await expect(
      client.createEvent(
        "tok",
        "Dentist",
        "2026-08-15T17:00:00Z",
        ["k1"],
        "2026-08-15T18:00:00Z",
        "Clinic",
      ),
    ).resolves.toMatchObject({ id: "e2" })
    await expect(
      client.updateEvent("tok", "e1", "Dentist 2", "2026-08-15T17:00:00Z", ["k1"]),
    ).resolves.toMatchObject({ title: "Dentist 2" })
    await expect(client.getEvent("tok", "e1")).resolves.toMatchObject({ id: "e1" })
    await client.deleteEvent("tok", "e1")

    expect(fetchFn.mock.calls[0]?.[0]).toBe("http://localhost:8080/api/family/circle/events")
    expect(fetchFn.mock.calls[1]?.[1]).toMatchObject({ method: "POST" })
    expect(fetchFn.mock.calls[2]?.[0]).toBe(
      "http://localhost:8080/api/family/circle/events/e1",
    )
    expect(fetchFn.mock.calls[2]?.[1]).toMatchObject({ method: "PUT" })
    expect(fetchFn.mock.calls[3]?.[0]).toBe(
      "http://localhost:8080/api/family/circle/events/e1",
    )
    expect(fetchFn.mock.calls[4]?.[1]).toMatchObject({ method: "DELETE" })
  })

  it("lists unified calendar items for a time window", async () => {
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      })

    const items = [
      {
        id: "e1",
        source: "MANUAL",
        title: "Dentist",
        startsAt: "2026-08-15T16:00:00Z",
        endsAt: null,
        location: "Clinic",
        kidIds: ["k1"],
        feedId: null,
        feedName: null,
        leaveFromPlaceId: "p1",
        leaveFromPlaceName: "Mom's house",
        leaveByAt: "2026-08-15T15:25:00Z",
        leaveByStatus: "OK",
        leaveByReason: null,
        coverages: [],
        uncoveredKidIds: [],
        conflicts: [],
        rsvps: [],
      },
      {
        id: "fe1",
        source: "FEED",
        title: "Practice",
        startsAt: "2026-08-15T17:00:00Z",
        endsAt: "2026-08-15T18:00:00Z",
        location: "Field 3",
        kidIds: ["k1"],
        feedId: "f1",
        feedName: "U12",
        leaveFromPlaceId: null,
        leaveFromPlaceName: null,
        leaveByAt: null,
        leaveByStatus: "UNAVAILABLE",
        leaveByReason: "NO_ORIGIN",
        coverages: [],
        uncoveredKidIds: ["k1"],
        conflicts: [],
        rsvps: [],
      },
    ]

    const fetchFn = vi.fn().mockResolvedValueOnce(json(items))
    const client = new FamilyClient("http://localhost:8080", fetchFn)

    await expect(
      client.listCalendar("tok", "2026-08-01T00:00:00Z", "2026-09-01T00:00:00Z"),
    ).resolves.toMatchObject([
      { source: "MANUAL", leaveByStatus: "OK" },
      { source: "FEED", feedName: "U12", leaveByStatus: "UNAVAILABLE" },
    ])

    expect(fetchFn.mock.calls[0]?.[0]).toBe(
      "http://localhost:8080/api/family/circle/calendar?from=2026-08-01T00%3A00%3A00Z&to=2026-09-01T00%3A00%3A00Z",
    )
  })

  it("lists leave-by fill-in rows for a time window", async () => {
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      })

    const rows = [
      {
        id: "e1",
        source: "MANUAL",
        leaveFromPlaceId: "p1",
        leaveFromPlaceName: "Mom's house",
        leaveByAt: "2026-08-15T15:25:00Z",
        leaveByStatus: "OK",
        leaveByReason: null,
      },
    ]

    const fetchFn = vi.fn().mockResolvedValueOnce(json(rows))
    const client = new FamilyClient("http://localhost:8080", fetchFn)

    await expect(
      client.listCalendarLeaveBy("tok", "2026-08-01T00:00:00Z", "2026-09-01T00:00:00Z"),
    ).resolves.toMatchObject([{ source: "MANUAL", leaveByStatus: "OK" }])

    expect(fetchFn.mock.calls[0]?.[0]).toBe(
      "http://localhost:8080/api/family/circle/calendar/leave-by?from=2026-08-01T00%3A00%3A00Z&to=2026-09-01T00%3A00%3A00Z",
    )
  })

  it("sets leave-from for a calendar item", async () => {
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      })

    const item = {
      id: "e1",
      source: "MANUAL" as const,
      title: "Dentist",
      startsAt: "2026-08-15T16:00:00Z",
      endsAt: null,
      location: "Clinic",
      kidIds: ["k1"],
      feedId: null,
      feedName: null,
      leaveFromPlaceId: "p1",
      leaveFromPlaceName: "Mom's house",
      leaveByAt: "2026-08-15T15:25:00Z",
      leaveByStatus: "OK" as const,
      leaveByReason: null,
      coverages: [],
      uncoveredKidIds: [],
      conflicts: [],
      rsvps: [],
    }
    const fetchFn = vi.fn().mockResolvedValueOnce(json(item))
    const client = new FamilyClient("http://localhost:8080", fetchFn)

    await expect(
      client.setCalendarLeaveFrom("tok", "MANUAL", "e1", { leaveFromPlaceId: "p1" }),
    ).resolves.toMatchObject({ leaveFromPlaceId: "p1", leaveByStatus: "OK" })

    expect(fetchFn.mock.calls[0]?.[0]).toBe(
      "http://localhost:8080/api/family/circle/calendar/MANUAL/e1/leave-from",
    )
    expect(fetchFn.mock.calls[0]?.[1]).toMatchObject({ method: "PUT" })
  })

  it("sets default leave-from and clears it", async () => {
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      })

    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        json({
          ...sampleCircle,
          defaultLeaveFromPlaceId: "p1",
          defaultLeaveFromPlaceName: "Mom's house",
        }),
      )
      .mockResolvedValueOnce(
        json({
          ...sampleCircle,
          defaultLeaveFromPlaceId: null,
          defaultLeaveFromPlaceName: null,
        }),
      )

    const client = new FamilyClient("http://localhost:8080", fetchFn)

    await expect(
      client.setDefaultLeaveFrom("tok", { placeId: "p1" }),
    ).resolves.toMatchObject({
      defaultLeaveFromPlaceId: "p1",
      defaultLeaveFromPlaceName: "Mom's house",
    })
    await expect(client.setDefaultLeaveFrom("tok", { placeId: null })).resolves.toMatchObject({
      defaultLeaveFromPlaceId: null,
    })

    expect(fetchFn.mock.calls[0]?.[0]).toBe(
      "http://localhost:8080/api/family/circle/default-leave-from",
    )
    expect(fetchFn.mock.calls[0]?.[1]).toMatchObject({ method: "PATCH" })
    expect(JSON.parse((fetchFn.mock.calls[0]?.[1] as RequestInit).body as string)).toEqual({
      placeId: "p1",
    })
  })

  it("assigns calendar coverage", async () => {
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      })

    const item = {
      id: "e1",
      source: "MANUAL" as const,
      title: "Dentist",
      startsAt: "2026-08-15T16:00:00Z",
      endsAt: null,
      location: "Clinic",
      kidIds: ["k1"],
      feedId: null,
      feedName: null,
      leaveFromPlaceId: null,
      leaveFromPlaceName: null,
      leaveByAt: null,
      leaveByStatus: "UNAVAILABLE" as const,
      leaveByReason: "NO_ORIGIN",
      coverages: [
        {
          id: "a1",
          coveringAdultId: "2",
          coveringAdultDisplayName: "Sam",
          assignedByAdultId: "1",
          kidIds: ["k1"],
          status: "PENDING" as const,
        },
      ],
      uncoveredKidIds: [],
      conflicts: [],
      rsvps: [],
    }

    const fetchFn = vi.fn().mockResolvedValueOnce(json(item, 201))
    const client = new FamilyClient("http://localhost:8080", fetchFn)

    await expect(
      client.assignCalendarCoverage("tok", "MANUAL", "e1", {
        coveringAdultId: "2",
        kidIds: ["k1"],
      }),
    ).resolves.toMatchObject({
      coverages: [{ status: "PENDING", coveringAdultId: "2" }],
      uncoveredKidIds: [],
      conflicts: [],
      rsvps: [],
    })

    expect(fetchFn.mock.calls[0]?.[0]).toBe(
      "http://localhost:8080/api/family/circle/calendar/MANUAL/e1/coverages",
    )
    expect(fetchFn.mock.calls[0]?.[1]).toMatchObject({ method: "POST" })
  })

  it("includes source and itemId when assign coverage fails", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "Calendar item not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }),
    )
    const client = new FamilyClient("http://localhost:8080", fetchFn)

    await expect(
      client.assignCalendarCoverage("tok", "FEED", "stale-id", {
        coveringAdultId: "2",
        kidIds: ["k1"],
      }),
    ).rejects.toThrow("Calendar item not found (FEED/stale-id)")
  })

  it("sets calendar RSVP", async () => {
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      })

    const item = {
      id: "e1",
      source: "MANUAL" as const,
      title: "Dentist",
      startsAt: "2026-08-15T16:00:00Z",
      endsAt: null,
      location: "Clinic",
      kidIds: ["k1"],
      feedId: null,
      feedName: null,
      leaveFromPlaceId: null,
      leaveFromPlaceName: null,
      leaveByAt: null,
      leaveByStatus: "UNAVAILABLE" as const,
      leaveByReason: "NO_ORIGIN",
      coverages: [],
      uncoveredKidIds: [],
      conflicts: [],
      rsvps: [{ kidId: "k1", status: "NO" as const }],
    }

    const fetchFn = vi.fn().mockResolvedValueOnce(json(item))
    const client = new FamilyClient("http://localhost:8080", fetchFn)

    await expect(
      client.setCalendarRsvp("tok", "MANUAL", "e1", "k1", { status: "NO" }),
    ).resolves.toMatchObject({
      rsvps: [{ kidId: "k1", status: "NO" }],
    })

    expect(fetchFn.mock.calls[0]?.[0]).toBe(
      "http://localhost:8080/api/family/circle/calendar/MANUAL/e1/rsvps/k1",
    )
    expect(fetchFn.mock.calls[0]?.[1]).toMatchObject({ method: "PUT" })
    expect(JSON.parse(String(fetchFn.mock.calls[0]?.[1]?.body))).toEqual({
      status: "NO",
    })
  })

  it("gets garage, patches drives, lists makes/models, suggests seats, and CRUDs vehicles", async () => {
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      })
    const vehicle = {
      id: "v1",
      ownerAdultId: "1",
      driverAdultIds: ["1"],
      keptAtPlaceId: "p1",
      label: "Blue van",
      year: 2019,
      make: "HONDA",
      model: "Odyssey",
      seats: 8,
      suggestedSeats: 8,
    }
    const garage = {
      members: [{ adultId: "1", displayName: "Alex", drives: true }],
      vehicles: [vehicle],
    }
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(json(garage))
      .mockResolvedValueOnce(json({ ...garage, members: [{ ...garage.members[0], drives: false }] }))
      .mockResolvedValueOnce(json([{ name: "HONDA" }]))
      .mockResolvedValueOnce(json([{ name: "Odyssey" }]))
      .mockResolvedValueOnce(json({ seats: 8 }))
      .mockResolvedValueOnce(json(vehicle, 201))
      .mockResolvedValueOnce(json({ ...vehicle, seats: 7 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(json({ seats: null }))

    const client = new FamilyClient("http://localhost:8080", fetchFn)
    await expect(client.getGarage("tok")).resolves.toMatchObject({ vehicles: [vehicle] })
    await expect(client.patchGarageDrives("tok", false)).resolves.toMatchObject({
      members: [{ adultId: "1", drives: false }],
    })
    await expect(client.listGarageMakes("tok")).resolves.toEqual([{ name: "HONDA" }])
    await expect(client.listGarageModels("tok", 2019, "HONDA")).resolves.toEqual([
      { name: "Odyssey" },
    ])
    await expect(
      client.suggestGarageSeats("tok", { year: 2019, make: "HONDA", model: "Odyssey" }),
    ).resolves.toEqual({ seats: 8 })
    await expect(
      client.addVehicle("tok", {
        label: "Blue van",
        year: 2019,
        make: "HONDA",
        model: "Odyssey",
        seats: 8,
      }),
    ).resolves.toMatchObject({ id: "v1" })
    await expect(
      client.updateVehicle("tok", "v1", {
        label: "Blue van",
        year: 2019,
        make: "HONDA",
        model: "Odyssey",
        seats: 7,
        driverAdultIds: ["1"],
      }),
    ).resolves.toMatchObject({ seats: 7 })
    await client.deleteVehicle("tok", "v1")
    await expect(client.suggestVehicleSeats("tok", "v1")).resolves.toEqual({ seats: null })

    expect(fetchFn.mock.calls[0]?.[0]).toBe("http://localhost:8080/api/family/circle/garage")
    expect(fetchFn.mock.calls[1]?.[0]).toBe("http://localhost:8080/api/family/circle/garage/me")
    expect(fetchFn.mock.calls[1]?.[1]).toMatchObject({ method: "PATCH" })
    expect(JSON.parse(String(fetchFn.mock.calls[1]?.[1]?.body))).toEqual({ drives: false })
    expect(fetchFn.mock.calls[2]?.[0]).toBe(
      "http://localhost:8080/api/family/circle/garage/makes",
    )
    expect(fetchFn.mock.calls[3]?.[0]).toBe(
      "http://localhost:8080/api/family/circle/garage/models?year=2019&make=HONDA",
    )
    expect(fetchFn.mock.calls[4]?.[0]).toBe(
      "http://localhost:8080/api/family/circle/garage/suggest-seats",
    )
    expect(JSON.parse(String(fetchFn.mock.calls[4]?.[1]?.body))).not.toHaveProperty("vin")
    expect(fetchFn.mock.calls[5]?.[0]).toBe(
      "http://localhost:8080/api/family/circle/garage/vehicles",
    )
    expect(JSON.parse(String(fetchFn.mock.calls[5]?.[1]?.body))).not.toHaveProperty("vin")
    expect(fetchFn.mock.calls[6]?.[0]).toBe(
      "http://localhost:8080/api/family/circle/garage/vehicles/v1",
    )
    expect(fetchFn.mock.calls[7]?.[1]).toMatchObject({ method: "DELETE" })
    expect(fetchFn.mock.calls[8]?.[0]).toBe(
      "http://localhost:8080/api/family/circle/garage/vehicles/v1/suggest-seats",
    )
  })
})
