package com.yourorg.quickapp.leaveby;

/** One inbound carpool row for viewer-specific detour enrichment. */
public record DetourItemInput(String pickupAddress, String eventLocation) {}
