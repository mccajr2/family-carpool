package com.yourorg.quickapp.calendar.internal;

import static org.assertj.core.api.Assertions.assertThat;

import com.yourorg.quickapp.leaveby.CalendarRouteNotifyChannel;
import com.yourorg.quickapp.leaveby.CalendarRouteNotifyContact;
import com.yourorg.quickapp.leaveby.CalendarRoutePickupInput;
import com.yourorg.quickapp.leaveby.CalendarRouteStopKind;
import java.util.List;
import org.junit.jupiter.api.Test;

class BlockRouteAssemblerTest {

    @Test
    void mergeColocatedCombinesSiblingNamesAtSameAddress() {
        List<CalendarRoutePickupInput> merged =
                BlockRouteAssembler.mergeColocated(
                        List.of(
                                new CalendarRoutePickupInput(
                                        "Apollo",
                                        "12 Oak St",
                                        new CalendarRouteNotifyContact(
                                                CalendarRouteNotifyChannel.PUSH, "Family"),
                                        CalendarRouteStopKind.PICKUP),
                                new CalendarRoutePickupInput(
                                        "Atlas", "12 Oak St", null, CalendarRouteStopKind.PICKUP),
                                new CalendarRoutePickupInput(
                                        "Declan",
                                        "Russell CC",
                                        null,
                                        CalendarRouteStopKind.PICKUP)));

        assertThat(merged).hasSize(2);
        assertThat(merged.get(0).name()).isEqualTo("Apollo and Atlas");
        assertThat(merged.get(0).address()).isEqualTo("12 Oak St");
        assertThat(merged.get(1).name()).isEqualTo("Declan");
    }

    @Test
    void withoutAddressDropsHomeDuplicate() {
        List<CalendarRoutePickupInput> filtered =
                BlockRouteAssembler.withoutAddress(
                        List.of(
                                new CalendarRoutePickupInput("Home", "1 Main"),
                                new CalendarRoutePickupInput("School", "2 School")),
                        "1 Main");
        assertThat(filtered).singleElement().extracting(CalendarRoutePickupInput::address)
                .isEqualTo("2 School");
    }
}
