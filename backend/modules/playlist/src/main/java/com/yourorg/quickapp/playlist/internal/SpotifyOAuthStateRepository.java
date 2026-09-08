package com.yourorg.quickapp.playlist.internal;

import org.springframework.data.jpa.repository.JpaRepository;

interface SpotifyOAuthStateRepository extends JpaRepository<SpotifyOAuthStateEntity, String> {}
