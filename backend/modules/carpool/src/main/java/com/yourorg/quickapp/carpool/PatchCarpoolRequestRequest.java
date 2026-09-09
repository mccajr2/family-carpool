package com.yourorg.quickapp.carpool;

import java.util.Set;

public record PatchCarpoolRequestRequest(CarpoolLeg legs, Set<CarpoolNeededLeg> legsNeeded) {}
