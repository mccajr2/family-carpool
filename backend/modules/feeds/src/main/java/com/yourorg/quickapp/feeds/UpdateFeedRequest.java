package com.yourorg.quickapp.feeds;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;

public record UpdateFeedRequest(
        @NotBlank @Size(max = 80) String name,
        @NotBlank @Size(max = 2048) String sourceUrl,
        List<UUID> kidIds) {}
