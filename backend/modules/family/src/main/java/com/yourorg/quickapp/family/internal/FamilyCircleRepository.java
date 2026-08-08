package com.yourorg.quickapp.family.internal;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface FamilyCircleRepository extends JpaRepository<FamilyCircleEntity, UUID> {}
