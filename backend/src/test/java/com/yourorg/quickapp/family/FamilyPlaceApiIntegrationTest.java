package com.yourorg.quickapp.family;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.yourorg.quickapp.PostgresTestcontainers;
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
class FamilyPlaceApiIntegrationTest {

    @DynamicPropertySource
    static void datasourceProps(DynamicPropertyRegistry registry) {
        PostgresTestcontainers.registerDatasource(registry);
    }

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private FamilyPlaceApi familyPlaceApi;

    @Test
    void findPickupPlaceReturnsUnlocatedAddressedPlaceAndPrefersDefault() throws Exception {
        String token = signIn("fam-place-pickup@example.com");
        mockMvc.perform(
                        post("/api/family/circle")
                                .header(HttpHeaders.AUTHORIZATION, bearer(token))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"adultDisplayName\":\"Alex\",\"name\":\"McCarthy house\"}"))
                .andExpect(status().isCreated());
        UUID adultId = adultId(token);

        assertThat(familyPlaceApi.findPickupPlaceForMember(adultId)).isEmpty();

        addPlace(token, "Zebra", "Unlocateable Lane");
        UUID alphaId = addPlace(token, "alpha", "Unlocateable Court");

        CirclePlaceDto fallback = familyPlaceApi.findPickupPlaceForMember(adultId).orElseThrow();
        assertThat(fallback.id()).isEqualTo(alphaId);
        assertThat(fallback.address()).isEqualTo("Unlocateable Court");
        assertThat(fallback.located()).isFalse();

        UUID homeId = addPlace(token, "Home", "123 Main St");
        mockMvc.perform(
                        patch("/api/family/circle/default-leave-from")
                                .header(HttpHeaders.AUTHORIZATION, bearer(token))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"placeId\":\"" + homeId + "\"}"))
                .andExpect(status().isOk());

        CirclePlaceDto pickup = familyPlaceApi.findPickupPlaceForMember(adultId).orElseThrow();
        assertThat(pickup.id()).isEqualTo(homeId);
        assertThat(pickup.address()).isEqualTo("123 Main St");
        assertThat(pickup.located()).isTrue();
    }

    private UUID addPlace(String accessToken, String name, String address) throws Exception {
        return UUID.fromString(
                JsonPath.read(
                        mockMvc.perform(
                                        post("/api/family/circle/places")
                                                .header(
                                                        HttpHeaders.AUTHORIZATION,
                                                        bearer(accessToken))
                                                .contentType(MediaType.APPLICATION_JSON)
                                                .content(
                                                        "{\"name\":\""
                                                                + name
                                                                + "\",\"address\":\""
                                                                + address
                                                                + "\"}"))
                                .andExpect(status().isCreated())
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
