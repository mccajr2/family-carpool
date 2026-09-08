import { afterEach, describe, expect, it, vi } from "vitest"

import { deliverPlaylistConnectInvite } from "@/components/ridePlaylistInvite"

describe("deliverPlaylistConnectInvite", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("soft-succeeds with no network", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const result = await deliverPlaylistConnectInvite({
      channel: "push",
      to: "the Oseis",
      kidName: "Kwame",
    })

    expect(result).toEqual({ ok: true })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
