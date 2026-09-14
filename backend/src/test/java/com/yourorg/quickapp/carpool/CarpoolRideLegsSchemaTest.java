package com.yourorg.quickapp.carpool;

import static org.assertj.core.api.Assertions.assertThat;

import com.yourorg.quickapp.PostgresTestcontainers;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.UUID;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * Flyway V24: per-leg slots exist and v1 PENDING/ACCEPTED rows remain readable
 * as TO/FROM phases after the migrate backfill.
 */
@SpringBootTest
class CarpoolRideLegsSchemaTest {

    @DynamicPropertySource
    static void datasourceProps(DynamicPropertyRegistry registry) {
        PostgresTestcontainers.registerDatasource(registry);
    }

    @Autowired
    private DataSource dataSource;

    @Test
    void legsTableExistsWithExpectedColumns() throws Exception {
        try (Connection connection = dataSource.getConnection()) {
            assertThat(tableExists(connection, "carpool_ride_request_legs")).isTrue();
            assertThat(columnExists(connection, "carpool_ride_request_legs", "ride_id")).isTrue();
            assertThat(columnExists(connection, "carpool_ride_request_legs", "sort_order"))
                    .isTrue();
            assertThat(columnExists(connection, "carpool_ride_request_legs", "kind")).isTrue();
            assertThat(columnExists(connection, "carpool_ride_request_legs", "phase")).isTrue();
            assertThat(columnExists(connection, "carpool_ride_request_legs", "assignee_adult_id"))
                    .isTrue();
            assertThat(columnExists(connection, "carpool_ride_request_legs", "assignee_circle_id"))
                    .isTrue();
        }
    }

    @Test
    void multiPlanMigrationDropsOneActivePlanUniqueIndexes() throws Exception {
        try (Connection connection = dataSource.getConnection()) {
            assertThat(indexExists(connection, "carpool_ride_requests_active_space_unique"))
                    .isFalse();
            assertThat(indexExists(connection, "carpool_ride_requests_active_circle_unique"))
                    .isFalse();

            UUID spaceId = insertMinimalSpace(connection);
            UUID circleId = insertMinimalCircle(connection, "Multi Plan House");
            UUID adultId =
                    insertMinimalAdult(
                            connection, "multi-plan-" + UUID.randomUUID() + "@example.com");
            String eventKey = "UID:multi-plan-" + UUID.randomUUID();

            insertRideWithoutLegs(
                    connection, spaceId, circleId, adultId, "PLAN", null, null, eventKey);
            insertRideWithoutLegs(
                    connection, spaceId, circleId, adultId, "PENDING", null, null, eventKey);

            try (PreparedStatement ps =
                    connection.prepareStatement(
                            """
                            SELECT COUNT(*) FROM carpool_ride_requests
                            WHERE space_id = ? AND event_key = ? AND requesting_circle_id = ?
                              AND status IN ('PENDING', 'ACCEPTED', 'PLAN')
                            """)) {
                ps.setObject(1, spaceId);
                ps.setString(2, eventKey);
                ps.setObject(3, circleId);
                try (ResultSet rs = ps.executeQuery()) {
                    assertThat(rs.next()).isTrue();
                    assertThat(rs.getInt(1)).isEqualTo(2);
                }
            }
        }
    }

    @Test
    void migratedPendingAndAcceptedRowsExposeBothLegPhases() throws Exception {
        try (Connection connection = dataSource.getConnection()) {
            UUID spaceId = insertMinimalSpace(connection);
            UUID circleId = insertMinimalCircle(connection, "Legs Migrate House");
            UUID adultId = insertMinimalAdult(connection, "legs-migrate-" + UUID.randomUUID() + "@example.com");
            UUID pendingRide =
                    insertRideWithoutLegs(
                            connection, spaceId, circleId, adultId, "PENDING", null, null);
            UUID acceptedRide =
                    insertRideWithoutLegs(
                            connection,
                            spaceId,
                            circleId,
                            adultId,
                            "ACCEPTED",
                            adultId,
                            circleId);

            backfillLegsLikeV24(connection);

            assertThat(legPhase(connection, pendingRide, "TO")).isEqualTo("ASKED_TEAM");
            assertThat(legPhase(connection, pendingRide, "FROM")).isEqualTo("ASKED_TEAM");
            assertThat(legAssigneeAdult(connection, pendingRide, "TO")).isNull();

            assertThat(legPhase(connection, acceptedRide, "TO")).isEqualTo("CONFIRMED");
            assertThat(legPhase(connection, acceptedRide, "FROM")).isEqualTo("CONFIRMED");
            assertThat(legAssigneeAdult(connection, acceptedRide, "TO")).isEqualTo(adultId);
            assertThat(legAssigneeCircle(connection, acceptedRide, "FROM")).isEqualTo(circleId);
        }
    }

    /**
     * Applies the same backfill as {@code V24__carpool_ride_legs.sql} for rides
     * that still lack leg rows (simulates pre-V24 data).
     */
    private static void backfillLegsLikeV24(Connection connection) throws Exception {
        try (var statement = connection.createStatement()) {
            statement.execute(
                    """
                    INSERT INTO carpool_ride_request_legs (
                        ride_id, sort_order, kind, phase, assignee_adult_id, assignee_circle_id
                    )
                    SELECT
                        r.id,
                        0,
                        'TO',
                        CASE r.status
                            WHEN 'PENDING' THEN 'ASKED_TEAM'
                            WHEN 'ACCEPTED' THEN 'CONFIRMED'
                            ELSE 'NEEDS_RIDE'
                        END,
                        CASE WHEN r.status = 'ACCEPTED' THEN r.accepted_by_adult_id ELSE NULL END,
                        CASE WHEN r.status = 'ACCEPTED' THEN r.accepting_circle_id ELSE NULL END
                    FROM carpool_ride_requests r
                    WHERE NOT EXISTS (
                        SELECT 1 FROM carpool_ride_request_legs l WHERE l.ride_id = r.id
                    )
                    """);
            statement.execute(
                    """
                    INSERT INTO carpool_ride_request_legs (
                        ride_id, sort_order, kind, phase, assignee_adult_id, assignee_circle_id
                    )
                    SELECT
                        r.id,
                        1,
                        'FROM',
                        CASE r.status
                            WHEN 'PENDING' THEN 'ASKED_TEAM'
                            WHEN 'ACCEPTED' THEN 'CONFIRMED'
                            ELSE 'NEEDS_RIDE'
                        END,
                        CASE WHEN r.status = 'ACCEPTED' THEN r.accepted_by_adult_id ELSE NULL END,
                        CASE WHEN r.status = 'ACCEPTED' THEN r.accepting_circle_id ELSE NULL END
                    FROM carpool_ride_requests r
                    WHERE NOT EXISTS (
                        SELECT 1 FROM carpool_ride_request_legs l
                        WHERE l.ride_id = r.id AND l.kind = 'FROM'
                    )
                    """);
        }
    }

    private static UUID insertMinimalAdult(Connection connection, String email) throws Exception {
        UUID id = UUID.randomUUID();
        try (PreparedStatement ps =
                connection.prepareStatement(
                        """
                        INSERT INTO adults (id, email, display_name, created_at)
                        VALUES (?, ?, 'Legs Adult', NOW())
                        """)) {
            ps.setObject(1, id);
            ps.setString(2, email);
            ps.executeUpdate();
        }
        return id;
    }

    private static UUID insertMinimalCircle(Connection connection, String name) throws Exception {
        UUID id = UUID.randomUUID();
        try (PreparedStatement ps =
                connection.prepareStatement(
                        """
                        INSERT INTO family_circles (id, name, invite_code, created_at)
                        VALUES (?, ?, ?, NOW())
                        """)) {
            ps.setObject(1, id);
            ps.setString(2, name);
            ps.setString(3, uniqueCode());
            ps.executeUpdate();
        }
        return id;
    }

    private static UUID insertMinimalSpace(Connection connection) throws Exception {
        UUID id = UUID.randomUUID();
        try (PreparedStatement ps =
                connection.prepareStatement(
                        """
                        INSERT INTO carpool_spaces (
                            id, name, normalized_source_url, invite_code, created_at
                        ) VALUES (?, 'Legs Space', ?, ?, NOW())
                        """)) {
            ps.setObject(1, id);
            ps.setString(2, "https://example.com/legs-" + id + ".ics");
            ps.setString(3, uniqueCode());
            ps.executeUpdate();
        }
        return id;
    }

    private static UUID insertRideWithoutLegs(
            Connection connection,
            UUID spaceId,
            UUID circleId,
            UUID adultId,
            String status,
            UUID acceptedByAdultId,
            UUID acceptingCircleId)
            throws Exception {
        return insertRideWithoutLegs(
                connection,
                spaceId,
                circleId,
                adultId,
                status,
                acceptedByAdultId,
                acceptingCircleId,
                "UID:legs-migrate-" + UUID.randomUUID());
    }

    private static UUID insertRideWithoutLegs(
            Connection connection,
            UUID spaceId,
            UUID circleId,
            UUID adultId,
            String status,
            UUID acceptedByAdultId,
            UUID acceptingCircleId,
            String eventKey)
            throws Exception {
        UUID id = UUID.randomUUID();
        try (PreparedStatement ps =
                connection.prepareStatement(
                        """
                        INSERT INTO carpool_ride_requests (
                            id, space_id, event_key, requesting_circle_id, requested_by_adult_id,
                            pickup_place_name, pickup_address, status,
                            accepted_by_adult_id, accepting_circle_id, created_at
                        ) VALUES (?, ?, ?, ?, ?, 'Home', '1 Main', ?, ?, ?, NOW())
                        """)) {
            ps.setObject(1, id);
            ps.setObject(2, spaceId);
            ps.setString(3, eventKey);
            ps.setObject(4, circleId);
            ps.setObject(5, adultId);
            ps.setString(6, status);
            ps.setObject(7, acceptedByAdultId);
            ps.setObject(8, acceptingCircleId);
            ps.executeUpdate();
        }
        return id;
    }

    private static boolean indexExists(Connection connection, String indexName) throws Exception {
        try (PreparedStatement ps =
                connection.prepareStatement(
                        """
                        SELECT 1 FROM pg_indexes
                        WHERE schemaname = 'public' AND indexname = ?
                        """)) {
            ps.setString(1, indexName);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next();
            }
        }
    }

    private static String uniqueCode() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase();
    }

    private static String legPhase(Connection connection, UUID rideId, String kind)
            throws Exception {
        try (PreparedStatement ps =
                connection.prepareStatement(
                        "SELECT phase FROM carpool_ride_request_legs WHERE ride_id = ? AND kind = ?")) {
            ps.setObject(1, rideId);
            ps.setString(2, kind);
            try (ResultSet rs = ps.executeQuery()) {
                assertThat(rs.next()).isTrue();
                return rs.getString(1);
            }
        }
    }

    private static UUID legAssigneeAdult(Connection connection, UUID rideId, String kind)
            throws Exception {
        try (PreparedStatement ps =
                connection.prepareStatement(
                        """
                        SELECT assignee_adult_id FROM carpool_ride_request_legs
                        WHERE ride_id = ? AND kind = ?
                        """)) {
            ps.setObject(1, rideId);
            ps.setString(2, kind);
            try (ResultSet rs = ps.executeQuery()) {
                assertThat(rs.next()).isTrue();
                return (UUID) rs.getObject(1);
            }
        }
    }

    private static UUID legAssigneeCircle(Connection connection, UUID rideId, String kind)
            throws Exception {
        try (PreparedStatement ps =
                connection.prepareStatement(
                        """
                        SELECT assignee_circle_id FROM carpool_ride_request_legs
                        WHERE ride_id = ? AND kind = ?
                        """)) {
            ps.setObject(1, rideId);
            ps.setString(2, kind);
            try (ResultSet rs = ps.executeQuery()) {
                assertThat(rs.next()).isTrue();
                return (UUID) rs.getObject(1);
            }
        }
    }

    private static boolean tableExists(Connection connection, String table) throws Exception {
        try (ResultSet rs =
                connection
                        .getMetaData()
                        .getTables(null, "public", table, new String[] {"TABLE"})) {
            return rs.next();
        }
    }

    private static boolean columnExists(Connection connection, String table, String column)
            throws Exception {
        try (ResultSet rs = connection.getMetaData().getColumns(null, "public", table, column)) {
            return rs.next();
        }
    }
}
