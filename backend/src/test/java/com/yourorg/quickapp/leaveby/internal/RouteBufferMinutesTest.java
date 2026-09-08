package com.yourorg.quickapp.leaveby.internal;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class RouteBufferMinutesTest {

    @Test
    void practiceTitleUsesTwentyMinutes() {
        assertThat(RouteBufferMinutes.forTitle("Tuesday Practice")).isEqualTo(20);
        assertThat(RouteBufferMinutes.forTitle("pre-practice skate")).isEqualTo(20);
    }

    @Test
    void gameLikeTitleUsesFortyFiveMinutes() {
        assertThat(RouteBufferMinutes.forTitle("vs East Coast Thunder")).isEqualTo(45);
        assertThat(RouteBufferMinutes.forTitle("Game vs Blaze")).isEqualTo(45);
        assertThat(RouteBufferMinutes.forTitle("Match day")).isEqualTo(45);
        assertThat(RouteBufferMinutes.forTitle("versus Wolves")).isEqualTo(45);
    }

    @Test
    void practiceWinsWhenBothMatch() {
        assertThat(RouteBufferMinutes.forTitle("Practice vs Thunder")).isEqualTo(20);
    }

    @Test
    void otherTitlesUseZero() {
        assertThat(RouteBufferMinutes.forTitle("Dentist")).isEqualTo(0);
        assertThat(RouteBufferMinutes.forTitle(null)).isEqualTo(0);
        assertThat(RouteBufferMinutes.forTitle("  ")).isEqualTo(0);
    }
}
