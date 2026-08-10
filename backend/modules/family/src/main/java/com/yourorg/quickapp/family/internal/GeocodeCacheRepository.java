package com.yourorg.quickapp.family.internal;

import org.springframework.data.jpa.repository.JpaRepository;

interface GeocodeCacheRepository extends JpaRepository<GeocodeCacheEntity, String> {}
