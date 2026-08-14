package org.example.project

const val MIN_VEHICLE_YEAR = 1996
const val MIN_SEATS = 2
const val MAX_SEATS = 18

data class VehiclePlaceGroup(
    val placeId: String?,
    val heading: String,
    val vehicles: List<Vehicle>,
)

fun vehicleYearOptions(utcYear: Int): List<Int> {
    val max = utcYear + 1
    return (max downTo MIN_VEHICLE_YEAR).toList()
}

fun groupVehiclesByKeptAt(
    vehicles: List<Vehicle>,
    places: List<Place>,
): List<VehiclePlaceGroup> {
    val remaining = vehicles.groupBy { it.keptAtPlaceId.orEmpty() }.toMutableMap()
    val groups = mutableListOf<VehiclePlaceGroup>()
    for (place in places) {
        val list = remaining.remove(place.id) ?: continue
        groups.add(
            VehiclePlaceGroup(
                placeId = place.id,
                heading = place.name,
                vehicles = list.sortedBy { it.label },
            ),
        )
    }
    val leftover = remaining.values.flatten()
    if (leftover.isNotEmpty()) {
        groups.add(
            VehiclePlaceGroup(
                placeId = null,
                heading = "Other",
                vehicles = leftover.sortedBy { it.label },
            ),
        )
    }
    return groups
}

fun drivenByLabel(
    vehicle: Vehicle,
    members: List<GarageMemberDrives>,
): String {
    val names =
        vehicle.driverAdultIds.map { id ->
            val name = members.find { it.adultId == id }?.displayName?.trim()
            if (name.isNullOrEmpty()) "Unknown" else name
        }
    return "Driven by ${names.joinToString(", ")}"
}
