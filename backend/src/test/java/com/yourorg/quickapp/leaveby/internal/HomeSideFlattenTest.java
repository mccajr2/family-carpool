package com.yourorg.quickapp.leaveby.internal;

import static org.assertj.core.api.Assertions.assertThat;

import com.yourorg.quickapp.family.GeoPointDto;
import com.yourorg.quickapp.leaveby.CalendarRoutePickupInput;
import com.yourorg.quickapp.leaveby.CalendarRouteStopKind;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class HomeSideFlattenTest {

    @Test
    void dropsMiddleWithSameNormalizedAddressAsHome() {
        List<CalendarRoutePickupInput> filtered =
                HomeSideFlatten.withoutMatchingHome(
                        List.of(
                                new CalendarRoutePickupInput(
                                        "Kid · Home", "1 Main", null, CalendarRouteStopKind.PICKUP),
                                new CalendarRoutePickupInput(
                                        "Afterschool",
                                        "10 Community",
                                        null,
                                        CalendarRouteStopKind.PICKUP)),
                        UUID.randomUUID(),
                        "1 Main",
                        40.1,
                        -74.1,
                        address -> Optional.empty());

        assertThat(filtered).singleElement().extracting(CalendarRoutePickupInput::address)
                .isEqualTo("10 Community");
    }

    @Test
    void dropsMiddleWithSameGeocodeAsHomeEvenWhenAddressTextDiffers() {
        List<CalendarRoutePickupInput> filtered =
                HomeSideFlatten.withoutMatchingHome(
                        List.of(
                                new CalendarRoutePickupInput(
                                        "Home alias",
                                        "Mom's house",
                                        null,
                                        CalendarRouteStopKind.DROPOFF),
                                new CalendarRoutePickupInput(
                                        "Friend", "22 Pine", null, CalendarRouteStopKind.DROPOFF)),
                        null,
                        "1 Main St",
                        40.1,
                        -74.1,
                        address -> {
                            if ("Mom's house".equals(address)) {
                                return Optional.of(new GeoPointDto(40.1, -74.1));
                            }
                            if ("22 Pine".equals(address)) {
                                return Optional.of(new GeoPointDto(40.2, -74.2));
                            }
                            return Optional.empty();
                        });

        assertThat(filtered).singleElement().extracting(CalendarRoutePickupInput::address)
                .isEqualTo("22 Pine");
    }

    @Test
    void keepsDistinctMiddles() {
        UUID homeId = UUID.randomUUID();
        List<CalendarRoutePickupInput> filtered =
                HomeSideFlatten.withoutMatchingHome(
                        List.of(
                                new CalendarRoutePickupInput("A", "12 Oak"),
                                new CalendarRoutePickupInput("B", "22 Pine")),
                        homeId,
                        "1 Main",
                        40.0,
                        -74.0,
                        address -> Optional.of(new GeoPointDto(40.5, -74.5)));

        assertThat(filtered).hasSize(2);
    }
}
