package com.yourorg.quickapp.family;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.yourorg.quickapp.PostgresTestcontainers;
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
class FamilyGarageControllerIntegrationTest {

    @DynamicPropertySource
    static void datasourceProps(DynamicPropertyRegistry registry) {
        PostgresTestcontainers.registerDatasource(registry);
    }

    @Autowired
    private MockMvc mockMvc;

    @Test
    void garageCrudDriversSuggestAndLeaveCascade() throws Exception {
        String momToken = signIn("garage-mom@example.com");
        String dadToken = signIn("garage-dad@example.com");
        String nannyToken = signIn("garage-nanny@example.com");

        mockMvc.perform(get("/api/family/circle/garage").header(HttpHeaders.AUTHORIZATION, bearer(momToken)))
                .andExpect(status().isNotFound());

        mockMvc.perform(
                        post("/api/family/circle")
                                .header(HttpHeaders.AUTHORIZATION, bearer(momToken))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"adultDisplayName\":\"Mom\",\"name\":\"House\"}"))
                .andExpect(status().isCreated());

        MvcResult invite =
                mockMvc.perform(
                                get("/api/family/circle/invite")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(momToken)))
                        .andExpect(status().isOk())
                        .andReturn();
        String code = JsonPath.read(invite.getResponse().getContentAsString(), "$.code");

        mockMvc.perform(
                        post("/api/family/circle/join")
                                .header(HttpHeaders.AUTHORIZATION, bearer(dadToken))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"code\":\"" + code + "\",\"adultDisplayName\":\"Dad\"}"))
                .andExpect(status().isOk());
        mockMvc.perform(
                        post("/api/family/circle/join")
                                .header(HttpHeaders.AUTHORIZATION, bearer(nannyToken))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"code\":\""
                                                + code
                                                + "\",\"adultDisplayName\":\"Nanny\"}"))
                .andExpect(status().isOk());

        MvcResult me =
                mockMvc.perform(get("/api/auth/me").header(HttpHeaders.AUTHORIZATION, bearer(dadToken)))
                        .andExpect(status().isOk())
                        .andReturn();
        String dadId = JsonPath.read(me.getResponse().getContentAsString(), "$.id");

        mockMvc.perform(
                        get("/api/family/circle/garage/makes")
                                .header(HttpHeaders.AUTHORIZATION, bearer(momToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("HONDA"));

        mockMvc.perform(
                        get("/api/family/circle/garage/models?year=2020&make=HONDA")
                                .header(HttpHeaders.AUTHORIZATION, bearer(momToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("Odyssey"));

        mockMvc.perform(
                        post("/api/family/circle/garage/suggest-seats")
                                .header(HttpHeaders.AUTHORIZATION, bearer(momToken))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"year\":2020,\"make\":\"HONDA\",\"model\":\"Odyssey\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.seats").value(8));

        mockMvc.perform(
                        post("/api/family/circle/garage/suggest-seats")
                                .header(HttpHeaders.AUTHORIZATION, bearer(momToken))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"year\":2020,\"make\":\"HONDA\",\"model\":\"Unknown\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.seats").isEmpty());

        MvcResult created =
                mockMvc.perform(
                                post("/api/family/circle/garage/vehicles")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(momToken))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                "{\"label\":\"Blue van\",\"year\":2020,\"make\":\"HONDA\",\"model\":\"Odyssey\",\"seats\":7,\"driverAdultIds\":[\""
                                                        + dadId
                                                        + "\"]}"))
                        .andExpect(status().isCreated())
                        .andExpect(jsonPath("$.label").value("Blue van"))
                        .andExpect(jsonPath("$.seats").value(7))
                        .andExpect(jsonPath("$.suggestedSeats").value(8))
                        .andExpect(jsonPath("$.driverAdultIds.length()").value(2))
                        .andReturn();
        String vanId = JsonPath.read(created.getResponse().getContentAsString(), "$.id");

        mockMvc.perform(
                        post("/api/family/circle/garage/vehicles")
                                .header(HttpHeaders.AUTHORIZATION, bearer(momToken))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"label\":\"Blue van\",\"year\":2020,\"make\":\"HONDA\",\"model\":\"Civic\",\"seats\":5}"))
                .andExpect(status().isConflict());

        mockMvc.perform(
                        put("/api/family/circle/garage/vehicles/" + vanId)
                                .header(HttpHeaders.AUTHORIZATION, bearer(dadToken))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"label\":\"Blue van\",\"year\":2020,\"make\":\"HONDA\",\"model\":\"Odyssey\",\"seats\":8}"))
                .andExpect(status().isNotFound());

        mockMvc.perform(
                        post("/api/family/circle/garage/vehicles")
                                .header(HttpHeaders.AUTHORIZATION, bearer(nannyToken))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"label\":\"Civic\",\"year\":2020,\"make\":\"HONDA\",\"model\":\"Civic\",\"seats\":5}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.driverAdultIds.length()").value(1));

        mockMvc.perform(
                        get("/api/family/circle/garage")
                                .header(HttpHeaders.AUTHORIZATION, bearer(dadToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.vehicles.length()").value(2))
                .andExpect(jsonPath("$.members.length()").value(3))
                .andExpect(jsonPath("$.members[0].drives").value(true))
                .andExpect(jsonPath("$.vehicles[0].ownerAdultId").exists())
                .andExpect(jsonPath("$.vehicles[0].driverAdultIds").isArray());

        mockMvc.perform(
                        patch("/api/family/circle/garage/me")
                                .header(HttpHeaders.AUTHORIZATION, bearer(nannyToken))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"drives\":false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.vehicles.length()").value(2));

        mockMvc.perform(
                        post("/api/family/circle/leave")
                                .header(HttpHeaders.AUTHORIZATION, bearer(nannyToken)))
                .andExpect(status().isNoContent());

        mockMvc.perform(
                        get("/api/family/circle/garage")
                                .header(HttpHeaders.AUTHORIZATION, bearer(momToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.vehicles.length()").value(1))
                .andExpect(jsonPath("$.members.length()").value(2));

        mockMvc.perform(get("/api/family/circle/garage").header(HttpHeaders.AUTHORIZATION, "Bearer not-a-token"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void caregiverCanCreateVehicleAndUnauthenticatedIs401() throws Exception {
        String organizer = signIn("garage-care-org@example.com");
        String caregiver = signIn("garage-care-member@example.com");
        mockMvc.perform(
                        post("/api/family/circle")
                                .header(HttpHeaders.AUTHORIZATION, bearer(organizer))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"adultDisplayName\":\"Org\"}"))
                .andExpect(status().isCreated());
        MvcResult invite =
                mockMvc.perform(
                                get("/api/family/circle/invite")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(organizer)))
                        .andReturn();
        String code = JsonPath.read(invite.getResponse().getContentAsString(), "$.code");
        mockMvc.perform(
                        post("/api/family/circle/join")
                                .header(HttpHeaders.AUTHORIZATION, bearer(caregiver))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"code\":\"" + code + "\",\"adultDisplayName\":\"Care\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(
                        post("/api/family/circle/garage/vehicles")
                                .header(HttpHeaders.AUTHORIZATION, bearer(caregiver))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"label\":\"Mine\",\"year\":2020,\"make\":\"HONDA\",\"model\":\"Civic\",\"seats\":5}"))
                .andExpect(status().isCreated());

        mockMvc.perform(
                        delete("/api/family/circle/garage/vehicles/00000000-0000-0000-0000-000000000001")
                                .header(HttpHeaders.AUTHORIZATION, bearer(caregiver)))
                .andExpect(status().isNotFound());
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
