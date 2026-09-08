import { afterEach, describe, expect, it, vi } from "vitest"

import { deliverRideReadyByNotify } from "@/components/rideNotify"

describe("deliverRideReadyByNotify", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("soft-succeeds with no network", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const result = await deliverRideReadyByNotify({
      channel: "push",
      to: "the Oseis",
      stopName: "Kwame (the Oseis)",
      readyByLabel: "3:40 PM",
    })

    expect(result).toEqual({ ok: true })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
