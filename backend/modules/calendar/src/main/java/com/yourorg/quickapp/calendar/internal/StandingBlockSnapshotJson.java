package com.yourorg.quickapp.calendar.internal;

import com.yourorg.quickapp.calendar.StandingCoverageSnapshotDto;
import com.yourorg.quickapp.calendar.StandingRidePlanLegSnapshotDto;
import com.yourorg.quickapp.calendar.StandingRidePlanSnapshotDto;
import com.yourorg.quickapp.calendar.StandingRouteOriginSnapshotDto;
import com.yourorg.quickapp.carpool.CarpoolLegKind;
import com.yourorg.quickapp.carpool.CarpoolLegPhase;
import com.yourorg.quickapp.carpool.CarpoolMeetSide;
import com.yourorg.quickapp.coverage.CoverageStatus;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** JSON encode/decode for standing-block member snapshots. */
final class StandingBlockSnapshotJson {

    private static final JsonMapper MAPPER = JsonMapper.shared();

    private StandingBlockSnapshotJson() {}

    static String writeCoverages(List<StandingCoverageSnapshotDto> coverages) {
        List<CoverageWire> wires = new ArrayList<>();
        if (coverages != null) {
            for (StandingCoverageSnapshotDto row : coverages) {
                wires.add(
                        new CoverageWire(
                                str(row.coveringAdultId()),
                                str(row.assignedByAdultId()),
                                row.status() == null ? null : row.status().name(),
                                strList(row.kidIds()),
                                str(row.leaveFromPlaceId()),
                                row.leaveFromAddress()));
            }
        }
        return MAPPER.writeValueAsString(wires);
    }

    static List<StandingCoverageSnapshotDto> readCoverages(String json) {
        JsonNode root = MAPPER.readTree(json);
        List<StandingCoverageSnapshotDto> rows = new ArrayList<>();
        for (JsonNode node : root) {
            rows.add(
                    new StandingCoverageSnapshotDto(
                            uuidOrNull(node.get("coveringAdultId")),
                            uuidOrNull(node.get("assignedByAdultId")),
                            CoverageStatus.valueOf(node.get("status").asString()),
                            uuidList(node.get("kidIds")),
                            uuidOrNull(node.get("leaveFromPlaceId")),
                            textOrNull(node.get("leaveFromAddress"))));
        }
        return List.copyOf(rows);
    }

    static String writeRidePlans(List<StandingRidePlanSnapshotDto> plans) {
        List<RidePlanWire> wires = new ArrayList<>();
        if (plans != null) {
            for (StandingRidePlanSnapshotDto plan : plans) {
                List<RideLegWire> legs = new ArrayList<>();
                if (plan.legs() != null) {
                    for (StandingRidePlanLegSnapshotDto leg : plan.legs()) {
                        legs.add(
                                new RideLegWire(
                                        leg.kind() == null ? null : leg.kind().name(),
                                        leg.phase() == null ? null : leg.phase().name(),
                                        str(leg.assigneeAdultId()),
                                        str(leg.assigneeCircleId()),
                                        str(leg.placeId()),
                                        leg.placeName(),
                                        leg.placeAddress(),
                                        leg.meetSide() == null ? null : leg.meetSide().name()));
                    }
                }
                wires.add(new RidePlanWire(strList(plan.kidIds()), legs));
            }
        }
        return MAPPER.writeValueAsString(wires);
    }

    static List<StandingRidePlanSnapshotDto> readRidePlans(String json) {
        JsonNode root = MAPPER.readTree(json);
        List<StandingRidePlanSnapshotDto> plans = new ArrayList<>();
        for (JsonNode node : root) {
            List<StandingRidePlanLegSnapshotDto> legs = new ArrayList<>();
            JsonNode legsNode = node.get("legs");
            if (legsNode != null && legsNode.isArray()) {
                for (JsonNode leg : legsNode) {
                    legs.add(
                            new StandingRidePlanLegSnapshotDto(
                                    CarpoolLegKind.valueOf(leg.get("kind").asString()),
                                    CarpoolLegPhase.valueOf(leg.get("phase").asString()),
                                    uuidOrNull(leg.get("assigneeAdultId")),
                                    uuidOrNull(leg.get("assigneeCircleId")),
                                    uuidOrNull(leg.get("placeId")),
                                    textOrNull(leg.get("placeName")),
                                    textOrNull(leg.get("placeAddress")),
                                    enumOrNull(leg.get("meetSide"), CarpoolMeetSide.class)));
                }
            }
            plans.add(new StandingRidePlanSnapshotDto(uuidList(node.get("kidIds")), List.copyOf(legs)));
        }
        return List.copyOf(plans);
    }

    static String writeRouteOrigins(List<StandingRouteOriginSnapshotDto> origins) {
        List<RouteOriginWire> wires = new ArrayList<>();
        if (origins != null) {
            for (StandingRouteOriginSnapshotDto origin : origins) {
                wires.add(
                        new RouteOriginWire(
                                str(origin.adultId()),
                                origin.leg() == null ? null : origin.leg().name(),
                                str(origin.leaveFromPlaceId()),
                                origin.leaveFromPlaceName(),
                                origin.leaveFromAddress()));
            }
        }
        return MAPPER.writeValueAsString(wires);
    }

    static List<StandingRouteOriginSnapshotDto> readRouteOrigins(String json) {
        JsonNode root = MAPPER.readTree(json);
        List<StandingRouteOriginSnapshotDto> origins = new ArrayList<>();
        for (JsonNode node : root) {
            origins.add(
                    new StandingRouteOriginSnapshotDto(
                            uuidOrNull(node.get("adultId")),
                            CarpoolLegKind.valueOf(node.get("leg").asString()),
                            uuidOrNull(node.get("leaveFromPlaceId")),
                            textOrNull(node.get("leaveFromPlaceName")),
                            textOrNull(node.get("leaveFromAddress"))));
        }
        return List.copyOf(origins);
    }

    private static String str(UUID id) {
        return id == null ? null : id.toString();
    }

    private static List<String> strList(List<UUID> ids) {
        if (ids == null) {
            return List.of();
        }
        return ids.stream().map(StandingBlockSnapshotJson::str).toList();
    }

    private static List<UUID> uuidList(JsonNode node) {
        if (node == null || !node.isArray()) {
            return List.of();
        }
        List<UUID> ids = new ArrayList<>();
        for (JsonNode child : node) {
            ids.add(UUID.fromString(child.asString()));
        }
        return List.copyOf(ids);
    }

    private static UUID uuidOrNull(JsonNode node) {
        if (node == null || node.isNull()) {
            return null;
        }
        return UUID.fromString(node.asString());
    }

    private static String textOrNull(JsonNode node) {
        if (node == null || node.isNull()) {
            return null;
        }
        return node.asString();
    }

    private static <E extends Enum<E>> E enumOrNull(JsonNode node, Class<E> type) {
        if (node == null || node.isNull()) {
            return null;
        }
        return Enum.valueOf(type, node.asString());
    }

    private record CoverageWire(
            String coveringAdultId,
            String assignedByAdultId,
            String status,
            List<String> kidIds,
            String leaveFromPlaceId,
            String leaveFromAddress) {}

    private record RidePlanWire(List<String> kidIds, List<RideLegWire> legs) {}

    private record RideLegWire(
            String kind,
            String phase,
            String assigneeAdultId,
            String assigneeCircleId,
            String placeId,
            String placeName,
            String placeAddress,
            String meetSide) {}

    private record RouteOriginWire(
            String adultId,
            String leg,
            String leaveFromPlaceId,
            String leaveFromPlaceName,
            String leaveFromAddress) {}
}
