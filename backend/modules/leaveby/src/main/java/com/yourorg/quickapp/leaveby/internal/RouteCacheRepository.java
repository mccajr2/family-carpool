package com.yourorg.quickapp.leaveby.internal;

import org.springframework.data.jpa.repository.JpaRepository;

interface RouteCacheRepository extends JpaRepository<RouteCacheEntity, String> {}
