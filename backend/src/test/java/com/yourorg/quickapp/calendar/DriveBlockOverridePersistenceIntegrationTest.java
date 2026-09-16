package com.yourorg.quickapp.calendar;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.yourorg.quickapp.PostgresTestcontainers;
import com.yourorg.quickapp.calendar.internal.DriveBlockOverrideService;
import com.yourorg.quickapp.carpool.CarpoolLegKind;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
class DriveBlockOverridePersistenceIntegrationTest {

    @DynamicPropertySource
    static void datasourceProps(DynamicPropertyRegistry registry) {
        PostgresTestcontainers.registerDatasource(registry);
    }

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private DriveBlockOverrideService overrideService;

    @Test
    void upsertClearAndListRoundTripForAdult() throws Exception {
        String token = signIn("drive-block-override@example.com");
        UUID adultId = currentAdultId(token);
        UUID leftId = UUID.randomUUID();
        UUID rightId = UUID.randomUUID();

        DriveBlockOverrideDto saved =
                overrideService.upsert(
                        adultId,
                        CarpoolLegKind.TO,
                        CalendarItemSource.FEED,
                        leftId,
                        CalendarItemSource.FEED,
                        rightId,
                        DriveBlockOverrideAction.FORCE_MERGE);

        assertThat(saved.id()).isNotNull();
        assertThat(saved.createdAt()).isNotNull();
        assertThat(saved.action()).isEqualTo(DriveBlockOverrideAction.FORCE_MERGE);

        List<DriveBlockOverrideDto> listed = overrideService.listForAdult(adultId);
        assertThat(listed).singleElement().satisfies(row -> {
            assertThat(row.id()).isEqualTo(saved.id());
            assertThat(row.leg()).isEqualTo(CarpoolLegKind.TO);
            assertThat(row.leftItemId()).isEqualTo(leftId);
            assertThat(row.rightItemId()).isEqualTo(rightId);
        });

        DriveBlockOverrideDto updated =
                overrideService.upsert(
                        adultId,
                        CarpoolLegKind.TO,
                        CalendarItemSource.FEED,
                        leftId,
                        CalendarItemSource.FEED,
                        rightId,
                        DriveBlockOverrideAction.FORCE_SPLIT);
        assertThat(updated.id()).isEqualTo(saved.id());
        assertThat(updated.action()).isEqualTo(DriveBlockOverrideAction.FORCE_SPLIT);
        assertThat(overrideService.listForAdult(adultId)).hasSize(1);

        assertThat(
                        overrideService.clear(
                                adultId,
                                CarpoolLegKind.TO,
                                CalendarItemSource.FEED,
                                leftId,
                                CalendarItemSource.FEED,
                                rightId))
                .isTrue();
        assertThat(overrideService.listForAdult(adultId)).isEmpty();
        assertThat(
                        overrideService.clear(
                                adultId,
                                CarpoolLegKind.TO,
                                CalendarItemSource.FEED,
                                leftId,
                                CalendarItemSource.FEED,
                                rightId))
                .isFalse();
    }

    private UUID currentAdultId(String token) throws Exception {
        MvcResult me =
                mockMvc.perform(
                                get("/api/auth/me")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(token)))
                        .andExpect(status().isOk())
                        .andReturn();
        return UUID.fromString(JsonPath.read(me.getResponse().getContentAsString(), "$.id"));
    }

    private String signIn(String email) throws Exception {
        MvcResult requestResult =
                mockMvc.perform(
                                post("/api/auth/request-code")
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content("{\"email\":\"" + email + "\"}"))
                        .andExpect(status().isAccepted())
                        .andReturn();
        String code = JsonPath.read(requestResult.getResponse().getContentAsString(), "$.devCode");

        MvcResult verifyResult =
                mockMvc.perform(
                                post("/api/auth/verify-code")
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                "{\"email\":\""
                                                        + email
                                                        + "\",\"code\":\""
                                                        + code
                                                        + "\"}"))
                        .andExpect(status().isOk())
                        .andReturn();
        return JsonPath.read(verifyResult.getResponse().getContentAsString(), "$.accessToken");
    }

    private static String bearer(String token) {
        return "Bearer " + token;
    }
}
