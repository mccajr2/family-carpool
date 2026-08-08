package com.yourorg.quickapp.auth.internal;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface AuthCodeRepository extends JpaRepository<AuthCodeEntity, UUID> {
    List<AuthCodeEntity> findByEmailOrderByCreatedAtDesc(String email);
}
