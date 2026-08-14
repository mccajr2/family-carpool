import { describe, expect, it } from "vitest"

import type { GarageMemberDrives, Place, Vehicle } from "@/api/types"
import {
  drivenByLabel,
  groupVehiclesByKeptAt,
  vehicleYearOptions,
} from "@/components/garageDisplay"

function vehicle(partial: Partial<Vehicle> & Pick<Vehicle, "id" | "label">): Vehicle {
  return {
    ownerAdultId: "1",
    driverAdultIds: ["1"],
    keptAtPlaceId: null,
    year: 2019,
    make: "HONDA",
    model: "Civic",
    seats: 5,
    suggestedSeats: null,
    ...partial,
  }
}

describe("vehicleYearOptions", () => {
  it("runs from 1996 through the next UTC calendar year", () => {
    const years = vehicleYearOptions(new Date("2026-08-14T00:00:00Z"))
    expect(years[0]).toBe(2027)
    expect(years.at(-1)).toBe(1996)
    expect(years).toHaveLength(2027 - 1996 + 1)
  })
})

describe("groupVehiclesByKeptAt", () => {
  const mom: Place = {
    id: "p1",
    name: "Mom's house",
    address: "1 Rd",
    latitude: 1,
    longitude: 2,
  }
  const grandma: Place = {
    id: "p2",
    name: "Grandma's house",
    address: "2 Rd",
    latitude: 3,
    longitude: 4,
  }

  it("groups by kept-at place then Other, without sharing by house", () => {
    const vehicles = [
      vehicle({ id: "van", label: "Blue van", keptAtPlaceId: "p1" }),
      vehicle({ id: "camry", label: "Camry", keptAtPlaceId: "p2", ownerAdultId: "g" }),
      vehicle({ id: "truck", label: "Truck", keptAtPlaceId: "p2", ownerAdultId: "gp" }),
      vehicle({ id: "civic", label: "Civic", keptAtPlaceId: null, ownerAdultId: "n" }),
    ]
    const groups = groupVehiclesByKeptAt(vehicles, [mom, grandma])
    expect(groups.map((g) => g.heading)).toEqual(["Mom's house", "Grandma's house", "Other"])
    expect(groups[1]?.vehicles.map((v) => v.label)).toEqual(["Camry", "Truck"])
    expect(groups[2]?.vehicles.map((v) => v.label)).toEqual(["Civic"])
  })
})

describe("drivenByLabel", () => {
  const members: GarageMemberDrives[] = [
    { adultId: "1", displayName: "Mom", drives: true },
    { adultId: "2", displayName: "Dad", drives: true },
  ]

  it("lists driver display names", () => {
    expect(
      drivenByLabel(
        vehicle({ id: "v", label: "Van", driverAdultIds: ["1", "2"] }),
        members,
      ),
    ).toBe("Driven by Mom, Dad")
  })
})
