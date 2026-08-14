package com.yourorg.quickapp.family.internal;

import java.util.List;
import java.util.Optional;

/** NHTSA vPIC lookups (HTTP adapter or test stub). Never collects a VIN from users. */
interface VpicPort {
    List<String> listMakes();

    List<String> listModels(String make, int year);

    Optional<Integer> suggestSeats(int year, String make, String model);
}
