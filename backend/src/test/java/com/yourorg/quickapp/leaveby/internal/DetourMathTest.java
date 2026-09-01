package com.yourorg.quickapp.leaveby.internal;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Optional;
import org.junit.jupiter.api.Test;

class DetourMathTest {

    @Test
    void computesPositiveDetourMinutes() {
        assertThat(
                        DetourMath.detourMinutes(
                                Optional.of(600.0), Optional.of(300.0), Optional.of(900.0)))
                .isEqualTo(10);
    }

    @Test
    void clampsNegativeDeltaToZero() {
        assertThat(
                        DetourMath.detourMinutes(
                                Optional.of(1200.0), Optional.of(300.0), Optional.of(300.0)))
                .isZero();
    }

    @Test
    void returnsNullWhenAnyLegMissing() {
        assertThat(
                        DetourMath.detourMinutes(
                                Optional.empty(), Optional.of(300.0), Optional.of(900.0)))
                .isNull();
        assertThat(
                        DetourMath.detourMinutes(
                                Optional.of(600.0), Optional.empty(), Optional.of(900.0)))
                .isNull();
        assertThat(
                        DetourMath.detourMinutes(
                                Optional.of(600.0), Optional.of(300.0), Optional.empty()))
                .isNull();
    }
}
