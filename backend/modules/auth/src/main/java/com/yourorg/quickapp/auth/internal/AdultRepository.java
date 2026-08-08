package com.yourorg.quickapp.auth.internal;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface AdultRepository extends JpaRepository<AdultEntity, UUID> {
    Optional<AdultEntity> findByEmail(String email);
}
