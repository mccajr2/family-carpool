import type { GarageMemberDrives, Place, Vehicle } from "@/api/types"

export const MIN_VEHICLE_YEAR = 1996
export const MIN_SEATS = 2
export const MAX_SEATS = 18

export type VehiclePlaceGroup = {
  placeId: string | null
  heading: string
  vehicles: Vehicle[]
}

export function vehicleYearOptions(now: Date = new Date()): number[] {
  const max = now.getUTCFullYear() + 1
  const years: number[] = []
  for (let year = max; year >= MIN_VEHICLE_YEAR; year -= 1) {
    years.push(year)
  }
  return years
}

function sortVehicles(vehicles: Vehicle[]): Vehicle[] {
  return [...vehicles].sort((a, b) => a.label.localeCompare(b.label))
}

export function groupVehiclesByKeptAt(
  vehicles: Vehicle[],
  places: Place[],
): VehiclePlaceGroup[] {
  const remaining = new Map<string, Vehicle[]>()
  for (const vehicle of vehicles) {
    const key = vehicle.keptAtPlaceId ?? ""
    const list = remaining.get(key) ?? []
    list.push(vehicle)
    remaining.set(key, list)
  }
  const groups: VehiclePlaceGroup[] = []
  for (const place of places) {
    const list = remaining.get(place.id)
    if (list) {
      groups.push({
        placeId: place.id,
        heading: place.name,
        vehicles: sortVehicles(list),
      })
      remaining.delete(place.id)
    }
  }
  const leftover = [...remaining.values()].flat()
  if (leftover.length > 0) {
    groups.push({
      placeId: null,
      heading: "Other",
      vehicles: sortVehicles(leftover),
    })
  }
  return groups
}

export function drivenByLabel(
  vehicle: Vehicle,
  members: GarageMemberDrives[],
): string {
  const names = vehicle.driverAdultIds.map((id) => {
    const member = members.find((item) => item.adultId === id)
    const name = member?.displayName?.trim()
    return name && name.length > 0 ? name : "Unknown"
  })
  return `Driven by ${names.join(", ")}`
}
