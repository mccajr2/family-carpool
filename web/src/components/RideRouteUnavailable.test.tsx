import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import {
  RideRouteUnavailable,
  routeUnavailableLabel,
} from "@/components/RideRouteUnavailable"

describe("routeUnavailableLabel", () => {
  it("maps known soft-fail reasons", () => {
    expect(routeUnavailableLabel("NO_ORIGIN")).toMatch(/leave-from/i)
    expect(routeUnavailableLabel("NO_DESTINATION")).toMatch(/location/i)
    expect(routeUnavailableLabel("GEOCODE_FAILED")).toMatch(/locate/i)
    expect(routeUnavailableLabel("OSRM_UNAVAILABLE")).toMatch(/Driving times/i)
    expect(routeUnavailableLabel(null)).toBe("Route estimate unavailable.")
  })
})

describe("RideRouteUnavailable", () => {
  it("renders honest estimate copy without leave-by hero chrome", () => {
    render(<RideRouteUnavailable reason="OSRM_UNAVAILABLE" />)

    const panel = screen.getByTestId("ride-route-unavailable")
    expect(panel).toHaveTextContent("Driving times aren't available right now.")
    expect(panel).toHaveTextContent("estimate only")
    expect(panel).toHaveTextContent("never live traffic")
    expect(screen.queryByTestId("ride-route-tab")).not.toBeInTheDocument()
    expect(screen.queryByTestId("ride-route-leave-by")).not.toBeInTheDocument()
    expect(screen.queryByTestId("ride-route-start-nav")).not.toBeInTheDocument()
  })

  it("prefers fetch error message over API reason", () => {
    render(
      <RideRouteUnavailable
        reason="GEOCODE_FAILED"
        errorMessage="Get calendar route failed (403)"
      />,
    )
    expect(screen.getByTestId("ride-route-unavailable")).toHaveTextContent(
      "Get calendar route failed (403)",
    )
  })
})
