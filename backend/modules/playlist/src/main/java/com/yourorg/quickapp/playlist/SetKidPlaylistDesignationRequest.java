package com.yourorg.quickapp.playlist;

import jakarta.validation.constraints.NotBlank;

public record SetKidPlaylistDesignationRequest(
        @NotBlank(message = "must not be blank") String spotifyPlaylistId) {}
