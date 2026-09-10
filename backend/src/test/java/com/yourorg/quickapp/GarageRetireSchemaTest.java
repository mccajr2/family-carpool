package com.yourorg.quickapp;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.Connection;
import java.sql.ResultSet;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * Fence until garage-capacity (or successor) revive: garage tables/columns must
 * stay dropped after Flyway migrates.
 */
@SpringBootTest
class GarageRetireSchemaTest {

    @DynamicPropertySource
    static void datasourceProps(DynamicPropertyRegistry registry) {
        PostgresTestcontainers.registerDatasource(registry);
    }

    @Autowired
    private DataSource dataSource;

    @Test
    void garageTablesColumnsAndVehicleIndexAreAbsent() throws Exception {
        try (Connection connection = dataSource.getConnection()) {
            assertThat(tableExists(connection, "family_vehicles")).isFalse();
            assertThat(tableExists(connection, "family_vehicle_drivers")).isFalse();
            assertThat(tableExists(connection, "vpic_seat_cache")).isFalse();
            assertThat(columnExists(connection, "family_memberships", "drives")).isFalse();
            assertThat(columnExists(connection, "carpool_ride_requests", "vehicle_id")).isFalse();
            assertThat(indexExists(connection, "carpool_ride_requests_vehicle_event_unique"))
                    .isFalse();
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

    private static boolean indexExists(Connection connection, String index) throws Exception {
        try (var statement =
                        connection.prepareStatement(
                                "SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = ?");
                ) {
            statement.setString(1, index);
            try (ResultSet rs = statement.executeQuery()) {
                return rs.next();
            }
        }
    }
}
