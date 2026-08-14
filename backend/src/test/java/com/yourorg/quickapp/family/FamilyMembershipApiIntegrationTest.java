package com.yourorg.quickapp.family;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.yourorg.quickapp.PostgresTestcontainers;
import com.yourorg.quickapp.auth.AdultSessionApi;
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
class FamilyMembershipApiIntegrationTest {

    @DynamicPropertySource
    static void datasourceProps(DynamicPropertyRegistry registry) {
        PostgresTestcontainers.registerDatasource(registry);
    }

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private FamilyMembershipApi familyMembershipApi;

    @Autowired
    private AdultSessionApi adultSessionApi;

    @Test
    void findCircleNamesAndAdultDisplayNameForCarpoolRendering() throws Exception {
        String namedToken = signIn("fam-api-named@example.com");
        String unnamedToken = signIn("fam-api-unnamed@example.com");

        mockMvc.perform(
                        post("/api/family/circle")
                                .header(HttpHeaders.AUTHORIZATION, bearer(namedToken))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"adultDisplayName\":\"Alex\",\"name\":\"McCarthy house\"}"))
                .andExpect(status().isCreated());

        mockMvc.perform(
                        post("/api/family/circle")
                                .header(HttpHeaders.AUTHORIZATION, bearer(unnamedToken))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"adultDisplayName\":\"Jordan\"}"))
                .andExpect(status().isCreated());

        UUID namedCircleId = circleId(namedToken);
        UUID unnamedCircleId = circleId(unnamedToken);
        UUID namedAdultId = adultId(namedToken);

        assertThat(familyMembershipApi.findCircle(namedCircleId))
                .contains(new FamilyCircleName(namedCircleId, "McCarthy house"));
        assertThat(familyMembershipApi.findCircle(unnamedCircleId))
                .hasValueSatisfying(
                        circle -> {
                            assertThat(circle.id()).isEqualTo(unnamedCircleId);
                            assertThat(circle.name()).isNull();
                        });
        assertThat(familyMembershipApi.findCircle(UUID.randomUUID())).isEmpty();

        assertThat(
                        familyMembershipApi.findCircles(
                                List.of(unnamedCircleId, UUID.randomUUID(), namedCircleId)))
                .extracting(FamilyCircleName::id)
                .containsExactly(unnamedCircleId, namedCircleId);

        assertThat(adultSessionApi.requireAdult(namedAdultId).displayName()).isEqualTo("Alex");
    }

    private UUID circleId(String accessToken) throws Exception {
        return UUID.fromString(
                JsonPath.read(
                        mockMvc.perform(
                                        get("/api/family/circle")
                                                .header(
                                                        HttpHeaders.AUTHORIZATION,
                                                        bearer(accessToken)))
                                .andExpect(status().isOk())
                                .andReturn()
                                .getResponse()
                                .getContentAsString(),
                        "$.id"));
    }

    private UUID adultId(String accessToken) throws Exception {
        return UUID.fromString(
                JsonPath.read(
                        mockMvc.perform(
                                        get("/api/auth/me")
                                                .header(
                                                        HttpHeaders.AUTHORIZATION,
                                                        bearer(accessToken)))
                                .andExpect(status().isOk())
                                .andReturn()
                                .getResponse()
                                .getContentAsString(),
                        "$.id"));
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
