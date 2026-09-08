package com.yourorg.quickapp.leaveby.internal;

import com.yourorg.quickapp.leaveby.CalendarRouteNotifyChannel;
import com.yourorg.quickapp.leaveby.CalendarRouteNotifyContact;
import com.yourorg.quickapp.leaveby.CalendarRouteStopDto;
import com.yourorg.quickapp.leaveby.CalendarRouteStopKind;
import java.util.ArrayList;
import java.util.List;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** JSON encode/decode for persisted itinerary stops and leg minutes. */
final class ItineraryJson {

    private static final JsonMapper MAPPER = JsonMapper.shared();

    private ItineraryJson() {}

    static String writeStops(List<CalendarRouteStopDto> stops) {
        List<StopWire> wires = new ArrayList<>(stops.size());
        for (CalendarRouteStopDto stop : stops) {
            String channel = null;
            String to = null;
            if (stop.contact() != null) {
                channel = stop.contact().channel().wireValue();
                to = stop.contact().to();
            }
            wires.add(
                    new StopWire(
                            stop.name(),
                            stop.address(),
                            stop.kind().wireValue(),
                            channel,
                            to));
        }
        return MAPPER.writeValueAsString(wires);
    }

    static List<CalendarRouteStopDto> readStops(String json) {
        JsonNode root = MAPPER.readTree(json);
        List<CalendarRouteStopDto> stops = new ArrayList<>();
        for (JsonNode node : root) {
            CalendarRouteNotifyContact contact = null;
            JsonNode channelNode = node.get("contactChannel");
            JsonNode toNode = node.get("contactTo");
            if (channelNode != null
                    && !channelNode.isNull()
                    && toNode != null
                    && !toNode.isNull()) {
                contact =
                        new CalendarRouteNotifyContact(
                                CalendarRouteNotifyChannel.fromWire(channelNode.asString()),
                                toNode.asString());
            }
            stops.add(
                    new CalendarRouteStopDto(
                            node.get("name").asString(),
                            node.get("address").asString(),
                            CalendarRouteStopKind.fromWire(node.get("kind").asString()),
                            contact));
        }
        return List.copyOf(stops);
    }

    static String writeLegMinutes(List<Integer> legMinutes) {
        return MAPPER.writeValueAsString(legMinutes);
    }

    static List<Integer> readLegMinutes(String json) {
        JsonNode root = MAPPER.readTree(json);
        List<Integer> minutes = new ArrayList<>();
        for (JsonNode node : root) {
            minutes.add(node.asInt());
        }
        return List.copyOf(minutes);
    }

    private record StopWire(
            String name, String address, String kind, String contactChannel, String contactTo) {}
}
