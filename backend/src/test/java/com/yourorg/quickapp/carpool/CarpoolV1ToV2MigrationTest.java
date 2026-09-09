package com.yourorg.quickapp.carpool;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import com.yourorg.quickapp.PostgresTestcontainers;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * Seeds a v1 household ride request, applies V23, and asserts per-kid requests +
 * TO/FROM rides were created.
 */
class CarpoolV1ToV2MigrationTest {

    @Test
    void migratesAcceptedHouseholdRequestIntoPerKidRequestsAndTwoRides() throws Exception {
        assumeTrue(PostgresTestcontainers.dockerAvailable(), "Docker is required for Postgres");

        try (PostgreSQLContainer<?> postgres =
                new PostgreSQLContainer<>(DockerImageName.parse("postgres:16-alpine"))
                        .withDatabaseName("family_carpool_migration_test")
                        .withUsername("test")
                        .withPassword("test")) {
            postgres.start();

            Flyway.configure()
                    .dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
                    .locations("classpath:db/migration")
                    .target("22")
                    .load()
                    .migrate();

            UUID adultRequester = UUID.fromString("01900000-0000-7000-8000-000000000001");
            UUID adultDriver = UUID.fromString("01900000-0000-7000-8000-000000000002");
            UUID circleRequester = UUID.fromString("01900000-0000-7000-8000-000000000010");
            UUID circleDriver = UUID.fromString("01900000-0000-7000-8000-000000000011");
            UUID spaceId = UUID.fromString("01900000-0000-7000-8000-000000000080");
            UUID kidA = UUID.fromString("01900000-0000-7000-8000-000000000021");
            UUID kidB = UUID.fromString("01900000-0000-7000-8000-000000000022");
            UUID oldRideId = UUID.fromString("01900000-0000-7000-8000-000000000090");
            UUID vehicleId = UUID.fromString("01900000-0000-7000-8000-000000000071");
            UUID passerId = UUID.fromString("01900000-0000-7000-8000-000000000003");

            try (Connection conn =
                    DriverManager.getConnection(
                            postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())) {
                seedAdult(conn, adultRequester, "req@example.com", "Alex");
                seedAdult(conn, adultDriver, "drv@example.com", "Sam");
                seedAdult(conn, passerId, "pass@example.com", "Pat");
                seedCircle(conn, circleRequester, "House A");
                seedCircle(conn, circleDriver, "House B");
                seedSpace(conn, spaceId);
                seedMembership(conn, spaceId, circleRequester, "OWNER");
                seedMembership(conn, spaceId, circleDriver, "MEMBER");

                try (PreparedStatement ps =
                        conn.prepareStatement(
                                """
                                INSERT INTO carpool_ride_requests (
                                    id, space_id, event_key, requesting_circle_id,
                                    requested_by_adult_id, pickup_place_name, pickup_address,
                                    status, accepted_by_adult_id, accepting_circle_id, vehicle_id,
                                    created_at
                                ) VALUES (?, ?, 'UID:practice', ?, ?, 'Home', '1 Main St',
                                    'ACCEPTED', ?, ?, ?, NOW())
                                """)) {
                    ps.setObject(1, oldRideId);
                    ps.setObject(2, spaceId);
                    ps.setObject(3, circleRequester);
                    ps.setObject(4, adultRequester);
                    ps.setObject(5, adultDriver);
                    ps.setObject(6, circleDriver);
                    ps.setObject(7, vehicleId);
                    ps.executeUpdate();
                }

                try (PreparedStatement ps =
                        conn.prepareStatement(
                                """
                                INSERT INTO carpool_ride_request_kids (
                                    ride_id, sort_order, kid_id, first_name
                                ) VALUES (?, ?, ?, ?)
                                """)) {
                    ps.setObject(1, oldRideId);
                    ps.setInt(2, 0);
                    ps.setObject(3, kidA);
                    ps.setString(4, "Mia");
                    ps.executeUpdate();
                    ps.setObject(1, oldRideId);
                    ps.setInt(2, 1);
                    ps.setObject(3, kidB);
                    ps.setString(4, "Riley");
                    ps.executeUpdate();
                }

                // Passes only exist on PENDING in product, but copy path still must preserve rows.
                try (PreparedStatement ps =
                        conn.prepareStatement(
                                """
                                INSERT INTO carpool_ride_passes (id, ride_id, adult_id, created_at)
                                VALUES (?, ?, ?, NOW())
                                """)) {
                    ps.setObject(1, UUID.randomUUID());
                    ps.setObject(2, oldRideId);
                    ps.setObject(3, passerId);
                    ps.executeUpdate();
                }
            }

            Flyway.configure()
                    .dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
                    .locations("classpath:db/migration")
                    .target("23")
                    .load()
                    .migrate();

            try (Connection conn =
                    DriverManager.getConnection(
                            postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())) {
                Set<UUID> requestIds = new HashSet<>();
                try (PreparedStatement ps =
                                conn.prepareStatement(
                                        """
                                        SELECT id, kid_id, kid_first_name, requesting_circle_id,
                                               pickup_place_name, pickup_address
                                        FROM carpool_requests
                                        WHERE space_id = ? AND event_key = 'UID:practice'
                                        ORDER BY kid_first_name
                                        """);
                        ) {
                    ps.setObject(1, spaceId);
                    try (ResultSet rs = ps.executeQuery()) {
                        assertThat(rs.next()).isTrue();
                        requestIds.add(rs.getObject("id", UUID.class));
                        assertThat(rs.getObject("kid_id", UUID.class)).isEqualTo(kidA);
                        assertThat(rs.getString("kid_first_name")).isEqualTo("Mia");
                        assertThat(rs.getObject("requesting_circle_id", UUID.class))
                                .isEqualTo(circleRequester);
                        assertThat(rs.getString("pickup_place_name")).isEqualTo("Home");
                        assertThat(rs.getString("pickup_address")).isEqualTo("1 Main St");

                        assertThat(rs.next()).isTrue();
                        requestIds.add(rs.getObject("id", UUID.class));
                        assertThat(rs.getObject("kid_id", UUID.class)).isEqualTo(kidB);
                        assertThat(rs.getString("kid_first_name")).isEqualTo("Riley");
                        assertThat(rs.next()).isFalse();
                    }
                }

                try (PreparedStatement ps =
                        conn.prepareStatement(
                                """
                                SELECT request_id, array_agg(leg ORDER BY leg) AS legs
                                FROM carpool_request_legs_needed
                                WHERE request_id = ANY (?)
                                GROUP BY request_id
                                """)) {
                    ps.setArray(1, conn.createArrayOf("uuid", requestIds.toArray()));
                    try (ResultSet rs = ps.executeQuery()) {
                        int rows = 0;
                        while (rs.next()) {
                            rows++;
                            Object[] legs = (Object[]) rs.getArray("legs").getArray();
                            assertThat(legs).containsExactly("FROM", "TO");
                        }
                        assertThat(rows).isEqualTo(2);
                    }
                }

                Set<UUID> rideIds = new HashSet<>();
                try (PreparedStatement ps =
                        conn.prepareStatement(
                                """
                                SELECT id, leg, driver_adult_id, driving_circle_id, vehicle_id, status
                                FROM carpool_rides
                                WHERE space_id = ? AND event_key = 'UID:practice'
                                ORDER BY leg
                                """)) {
                    ps.setObject(1, spaceId);
                    try (ResultSet rs = ps.executeQuery()) {
                        assertThat(rs.next()).isTrue();
                        rideIds.add(rs.getObject("id", UUID.class));
                        assertThat(rs.getString("leg")).isEqualTo("FROM");
                        assertThat(rs.getObject("driver_adult_id", UUID.class)).isEqualTo(adultDriver);
                        assertThat(rs.getObject("driving_circle_id", UUID.class))
                                .isEqualTo(circleDriver);
                        assertThat(rs.getObject("vehicle_id", UUID.class)).isEqualTo(vehicleId);
                        assertThat(rs.getString("status")).isEqualTo("ACTIVE");

                        assertThat(rs.next()).isTrue();
                        rideIds.add(rs.getObject("id", UUID.class));
                        assertThat(rs.getString("leg")).isEqualTo("TO");
                        assertThat(rs.next()).isFalse();
                    }
                }

                try (PreparedStatement ps =
                        conn.prepareStatement(
                                """
                                SELECT ride_id, array_agg(request_id ORDER BY request_id) AS passengers
                                FROM carpool_ride_passengers
                                WHERE ride_id = ANY (?)
                                GROUP BY ride_id
                                """)) {
                    ps.setArray(1, conn.createArrayOf("uuid", rideIds.toArray()));
                    try (ResultSet rs = ps.executeQuery()) {
                        int rows = 0;
                        while (rs.next()) {
                            rows++;
                            Object[] passengers = (Object[]) rs.getArray("passengers").getArray();
                            assertThat(passengers).hasSize(2);
                            assertThat(Set.of(passengers)).isEqualTo(Set.copyOf(requestIds));
                        }
                        assertThat(rows).isEqualTo(2);
                    }
                }

                try (PreparedStatement ps =
                        conn.prepareStatement(
                                """
                                SELECT COUNT(*) FROM carpool_request_passes
                                WHERE adult_id = ? AND request_id = ANY (?)
                                """)) {
                    ps.setObject(1, passerId);
                    ps.setArray(2, conn.createArrayOf("uuid", requestIds.toArray()));
                    try (ResultSet rs = ps.executeQuery()) {
                        assertThat(rs.next()).isTrue();
                        assertThat(rs.getInt(1)).isEqualTo(2);
                    }
                }
            }
        }
    }

    private static void seedAdult(Connection conn, UUID id, String email, String name)
            throws Exception {
        try (PreparedStatement ps =
                conn.prepareStatement(
                        "INSERT INTO adults (id, email, display_name) VALUES (?, ?, ?)")) {
            ps.setObject(1, id);
            ps.setString(2, email);
            ps.setString(3, name);
            ps.executeUpdate();
        }
    }

    private static void seedCircle(Connection conn, UUID id, String name) throws Exception {
        try (PreparedStatement ps =
                conn.prepareStatement(
                        "INSERT INTO family_circles (id, name, invite_code) VALUES (?, ?, ?)")) {
            ps.setObject(1, id);
            ps.setString(2, name);
            ps.setString(3, name.equals("House A") ? "HOUSEA01" : "HOUSEB02");
            ps.executeUpdate();
        }
    }

    private static void seedSpace(Connection conn, UUID id) throws Exception {
        try (PreparedStatement ps =
                conn.prepareStatement(
                        """
                        INSERT INTO carpool_spaces (id, name, normalized_source_url, invite_code)
                        VALUES (?, 'Soccer', 'https://example.com/mig.ics', 'MIGCODE1')
                        """)) {
            ps.setObject(1, id);
            ps.executeUpdate();
        }
    }

    private static void seedMembership(Connection conn, UUID spaceId, UUID circleId, String role)
            throws Exception {
        try (PreparedStatement ps =
                conn.prepareStatement(
                        """
                        INSERT INTO carpool_space_memberships (id, space_id, circle_id, membership)
                        VALUES (?, ?, ?, ?)
                        """)) {
            ps.setObject(1, UUID.randomUUID());
            ps.setObject(2, spaceId);
            ps.setObject(3, circleId);
            ps.setString(4, role);
            ps.executeUpdate();
        }
    }
}
