package com.yourorg.quickapp.family;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.yourorg.quickapp.PostgresTestcontainers;
import java.util.List;
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
class FamilyControllerIntegrationTest {

    @DynamicPropertySource
    static void datasourceProps(DynamicPropertyRegistry registry) {
        PostgresTestcontainers.registerDatasource(registry);
    }

    @Autowired
    private MockMvc mockMvc;

    @Test
    void createGetKidsCrudAndConflict() throws Exception {
        String token = signIn("circle-parent@example.com");

        mockMvc.perform(get("/api/family/circle").header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isNotFound());

        mockMvc.perform(
                        post("/api/family/circle")
                                .header(HttpHeaders.AUTHORIZATION, bearer(token))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"adultDisplayName\":\"Alex\",\"name\":\"McCarthy house\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("McCarthy house"))
                .andExpect(jsonPath("$.role").value("ORGANIZER"))
                .andExpect(jsonPath("$.members").isArray())
                .andExpect(jsonPath("$.members[0].role").value("ORGANIZER"))
                .andExpect(jsonPath("$.kids").isEmpty());

        mockMvc.perform(get("/api/auth/me").header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.displayName").value("Alex"));

        mockMvc.perform(
                        post("/api/family/circle")
                                .header(HttpHeaders.AUTHORIZATION, bearer(token))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"adultDisplayName\":\"Alex\"}"))
                .andExpect(status().isConflict());

        MvcResult addKid =
                mockMvc.perform(
                                post("/api/family/circle/kids")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(token))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content("{\"displayName\":\"Sam\"}"))
                        .andExpect(status().isCreated())
                        .andExpect(jsonPath("$.displayName").value("Sam"))
                        .andReturn();
        String kidId = JsonPath.read(addKid.getResponse().getContentAsString(), "$.id");

        mockMvc.perform(
                        patch("/api/family/circle/kids/" + kidId)
                                .header(HttpHeaders.AUTHORIZATION, bearer(token))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"displayName\":\"Samantha\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.displayName").value("Samantha"));

        mockMvc.perform(get("/api/family/circle").header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.kids[0].displayName").value("Samantha"));

        mockMvc.perform(
                        patch("/api/family/circle")
                                .header(HttpHeaders.AUTHORIZATION, bearer(token))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"name\":null}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value((Object) null));

        mockMvc.perform(
                        delete("/api/family/circle/kids/" + kidId)
                                .header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/family/circle").header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.kids").isEmpty());
    }

    @Test
    void inviteJoinPromoteLeaveAndOrganizerOnlyWrites() throws Exception {
        String organizerToken = signIn("invite-org@example.com");
        String caregiverToken = signIn("invite-care@example.com");

        mockMvc.perform(
                        post("/api/family/circle")
                                .header(HttpHeaders.AUTHORIZATION, bearer(organizerToken))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"adultDisplayName\":\"Alex\",\"name\":\"House\"}"))
                .andExpect(status().isCreated());

        MvcResult invite =
                mockMvc.perform(
                                get("/api/family/circle/invite")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(organizerToken)))
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.code").isString())
                        .andReturn();
        String code = JsonPath.read(invite.getResponse().getContentAsString(), "$.code");

        mockMvc.perform(
                        get("/api/family/circle/invite")
                                .header(HttpHeaders.AUTHORIZATION, bearer(caregiverToken)))
                .andExpect(status().isNotFound());

        mockMvc.perform(
                        post("/api/family/circle/join")
                                .header(HttpHeaders.AUTHORIZATION, bearer(caregiverToken))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"code\":\""
                                                + code
                                                + "\",\"adultDisplayName\":\"Jordan\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("CAREGIVER"))
                .andExpect(jsonPath("$.members.length()").value(2));

        mockMvc.perform(
                        post("/api/family/circle/kids")
                                .header(HttpHeaders.AUTHORIZATION, bearer(caregiverToken))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"displayName\":\"Sam\"}"))
                .andExpect(status().isForbidden());

        mockMvc.perform(
                        get("/api/family/circle/invite")
                                .header(HttpHeaders.AUTHORIZATION, bearer(caregiverToken)))
                .andExpect(status().isForbidden());

        MvcResult circle =
                mockMvc.perform(
                                get("/api/family/circle")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(organizerToken)))
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.members.length()").value(2))
                        .andReturn();
        String content = circle.getResponse().getContentAsString();
        List<String> roles = JsonPath.read(content, "$.members[*].role");
        List<String> adultIds = JsonPath.read(content, "$.members[*].adultId");
        String careId = null;
        for (int i = 0; i < roles.size(); i++) {
            if ("CAREGIVER".equals(roles.get(i))) {
                careId = adultIds.get(i);
                break;
            }
        }
        if (careId == null) {
            throw new IllegalStateException("expected a caregiver member");
        }

        mockMvc.perform(
                        patch("/api/family/circle/members/" + careId)
                                .header(HttpHeaders.AUTHORIZATION, bearer(organizerToken))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"role\":\"ORGANIZER\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.members.length()").value(2));

        mockMvc.perform(
                        post("/api/family/circle/invite/regenerate")
                                .header(HttpHeaders.AUTHORIZATION, bearer(organizerToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").isString())
                .andExpect(jsonPath("$.code").value(org.hamcrest.Matchers.not(code)));

        String thirdToken = signIn("invite-third@example.com");
        mockMvc.perform(
                        post("/api/family/circle/join")
                                .header(HttpHeaders.AUTHORIZATION, bearer(thirdToken))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"code\":\""
                                                + code
                                                + "\",\"adultDisplayName\":\"Pat\"}"))
                .andExpect(status().isNotFound());

        mockMvc.perform(
                        post("/api/family/circle/leave")
                                .header(HttpHeaders.AUTHORIZATION, bearer(caregiverToken)))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/family/circle").header(HttpHeaders.AUTHORIZATION, bearer(caregiverToken)))
                .andExpect(status().isNotFound());
    }

    @Test
    void joinWhileAlreadyMemberReturns409AndCaregiverCannotRenameCircle() throws Exception {
        String organizerToken = signIn("authz-org@example.com");
        String caregiverToken = signIn("authz-care@example.com");

        mockMvc.perform(
                        post("/api/family/circle")
                                .header(HttpHeaders.AUTHORIZATION, bearer(organizerToken))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"adultDisplayName\":\"Alex\"}"))
                .andExpect(status().isCreated());

        String code =
                JsonPath.read(
                        mockMvc.perform(
                                        get("/api/family/circle/invite")
                                                .header(
                                                        HttpHeaders.AUTHORIZATION,
                                                        bearer(organizerToken)))
                                .andExpect(status().isOk())
                                .andReturn()
                                .getResponse()
                                .getContentAsString(),
                        "$.code");

        mockMvc.perform(
                        post("/api/family/circle/join")
                                .header(HttpHeaders.AUTHORIZATION, bearer(caregiverToken))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"code\":\""
                                                + code
                                                + "\",\"adultDisplayName\":\"Jordan\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(
                        post("/api/family/circle/join")
                                .header(HttpHeaders.AUTHORIZATION, bearer(caregiverToken))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"code\":\""
                                                + code
                                                + "\",\"adultDisplayName\":\"Jordan\"}"))
                .andExpect(status().isConflict());

        mockMvc.perform(
                        patch("/api/family/circle")
                                .header(HttpHeaders.AUTHORIZATION, bearer(caregiverToken))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"name\":\"Hijack\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void unauthenticatedFamilyCallsReturn401() throws Exception {
        mockMvc.perform(get("/api/family/circle")).andExpect(status().isUnauthorized());
        mockMvc.perform(
                        post("/api/family/circle")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"adultDisplayName\":\"Alex\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void kidFromAnotherCircleIsNotFound() throws Exception {
        String parentA = signIn("parent-a@example.com");
        String parentB = signIn("parent-b@example.com");

        mockMvc.perform(
                        post("/api/family/circle")
                                .header(HttpHeaders.AUTHORIZATION, bearer(parentA))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"adultDisplayName\":\"A\"}"))
                .andExpect(status().isCreated());
        mockMvc.perform(
                        post("/api/family/circle")
                                .header(HttpHeaders.AUTHORIZATION, bearer(parentB))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"adultDisplayName\":\"B\"}"))
                .andExpect(status().isCreated());

        MvcResult addKid =
                mockMvc.perform(
                                post("/api/family/circle/kids")
                                        .header(HttpHeaders.AUTHORIZATION, bearer(parentA))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content("{\"displayName\":\"KidA\"}"))
                        .andExpect(status().isCreated())
                        .andReturn();
        String kidId = JsonPath.read(addKid.getResponse().getContentAsString(), "$.id");

        mockMvc.perform(
                        patch("/api/family/circle/kids/" + kidId)
                                .header(HttpHeaders.AUTHORIZATION, bearer(parentB))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"displayName\":\"Hijack\"}"))
                .andExpect(status().isNotFound());

        mockMvc.perform(
                        delete("/api/family/circle/kids/" + kidId)
                                .header(HttpHeaders.AUTHORIZATION, bearer(parentB)))
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
