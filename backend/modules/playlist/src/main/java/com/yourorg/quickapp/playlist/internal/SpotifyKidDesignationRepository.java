package com.yourorg.quickapp.playlist.internal;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface SpotifyKidDesignationRepository
        extends JpaRepository<SpotifyKidDesignationEntity, SpotifyKidDesignationEntity.Pk> {

    List<SpotifyKidDesignationEntity> findByAdultIdOrderByUpdatedAtDesc(UUID adultId);

    Optional<SpotifyKidDesignationEntity> findByAdultIdAndKidId(UUID adultId, UUID kidId);

    void deleteByAdultId(UUID adultId);

    void deleteByAdultIdAndKidId(UUID adultId, UUID kidId);

    List<SpotifyKidDesignationEntity> findByKidIdIn(List<UUID> kidIds);
}
