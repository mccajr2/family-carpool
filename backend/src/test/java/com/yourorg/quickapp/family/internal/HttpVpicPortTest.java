package com.yourorg.quickapp.family.internal;

import static org.assertj.core.api.Assertions.assertThat;

import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class HttpVpicPortTest {

    private HttpServer server;
    private String baseUrl;

    @BeforeEach
    void startServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext(
                "/vehicles/GetAllMakes",
                exchange -> {
                    byte[] body =
                            """
                            {"Results":[{"Make_Name":"HONDA"},{"Make_Name":"TOYOTA"}]}
                            """
                                    .getBytes(StandardCharsets.UTF_8);
                    exchange.getResponseHeaders().add("Content-Type", "application/json");
                    exchange.sendResponseHeaders(200, body.length);
                    try (OutputStream out = exchange.getResponseBody()) {
                        out.write(body);
                    }
                });
        server.createContext(
                "/vehicles/GetModelsForMakeYear/make/HONDA/modelyear/2020",
                exchange -> {
                    byte[] body =
                            """
                            {"Results":[{"Model_Name":"Odyssey"},{"Model_Name":"Civic"}]}
                            """
                                    .getBytes(StandardCharsets.UTF_8);
                    exchange.getResponseHeaders().add("Content-Type", "application/json");
                    exchange.sendResponseHeaders(200, body.length);
                    try (OutputStream out = exchange.getResponseBody()) {
                        out.write(body);
                    }
                });
        server.createContext(
                "/vehicles/GetWMIsForManufacturer/HONDA",
                exchange -> {
                    byte[] body =
                            """
                            {"Results":[{"WMI":"5FN","VehicleType":"Multipurpose Passenger Vehicle (MPV)"}]}
                            """
                                    .getBytes(StandardCharsets.UTF_8);
                    exchange.getResponseHeaders().add("Content-Type", "application/json");
                    exchange.sendResponseHeaders(200, body.length);
                    try (OutputStream out = exchange.getResponseBody()) {
                        out.write(body);
                    }
                });
        server.createContext(
                "/vehicles/DecodeVinValues",
                exchange -> {
                    byte[] body =
                            """
                            {"Results":[{"Model":"Odyssey","Seats":"8"}]}
                            """
                                    .getBytes(StandardCharsets.UTF_8);
                    exchange.getResponseHeaders().add("Content-Type", "application/json");
                    exchange.sendResponseHeaders(200, body.length);
                    try (OutputStream out = exchange.getResponseBody()) {
                        out.write(body);
                    }
                });
        server.start();
        baseUrl = "http://127.0.0.1:" + server.getAddress().getPort();
    }

    @AfterEach
    void stopServer() {
        server.stop(0);
    }

    @Test
    void listMakesParsesNames() {
        HttpVpicPort port = new HttpVpicPort(baseUrl, "family-carpool-test/0.1", 0);
        assertThat(port.listMakes()).containsExactly("HONDA", "TOYOTA");
    }

    @Test
    void listModelsParsesNames() {
        HttpVpicPort port = new HttpVpicPort(baseUrl, "family-carpool-test/0.1", 0);
        assertThat(port.listModels("HONDA", 2020)).containsExactly("Civic", "Odyssey");
    }

    @Test
    void suggestSeatsFromPartialDecode() {
        HttpVpicPort port = new HttpVpicPort(baseUrl, "family-carpool-test/0.1", 0);
        Optional<Integer> seats = port.suggestSeats(2020, "HONDA", "Odyssey");
        assertThat(seats).contains(8);
    }

    @Test
    void listMakesSoftFails() throws IOException {
        server.stop(0);
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext(
                "/vehicles/GetAllMakes",
                exchange -> exchange.sendResponseHeaders(500, -1));
        server.start();
        baseUrl = "http://127.0.0.1:" + server.getAddress().getPort();

        HttpVpicPort port = new HttpVpicPort(baseUrl, "family-carpool-test/0.1", 0);
        assertThat(port.listMakes()).isEqualTo(List.of());
    }
}
