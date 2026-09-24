package com.yourorg.quickapp.feeds;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ForwardRecurrenceGateTest {

    private static final ZoneId EASTERN = ZoneId.of("America/New_York");
    private static final UUID FEED_ID = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private static final Instant HORIZON_START = Instant.parse("2026-09-01T04:00:00Z"); // local Sep 1
    private static final Instant HORIZON_END = Instant.parse("2026-10-01T04:00:00Z");

    @Test
    void singletonPassesWithThreeOtherUpcomingMatches() {
        FeedCalendarEventDto member = tuesdayPractice("2026-09-01T21:00:00Z");
        List<FeedCalendarEventDto> horizon =
                List.of(
                        member,
                        tuesdayPractice("2026-09-08T21:00:00Z"),
                        tuesdayPractice("2026-09-15T21:00:00Z"),
                        tuesdayPractice("2026-09-22T21:00:00Z"));

        assertThat(
                        ForwardRecurrenceGate.isLockEligible(
                                List.of(member), horizon, EASTERN, HORIZON_START, HORIZON_END))
                .isTrue();
        assertThat(
                        ForwardRecurrenceGate.countOtherMatches(
                                member, horizon, EASTERN, HORIZON_START, HORIZON_END))
                .isEqualTo(3);
    }

    @Test
    void failsWithOnlyTwoOtherMatches() {
        FeedCalendarEventDto member = tuesdayPractice("2026-09-01T21:00:00Z");
        List<FeedCalendarEventDto> horizon =
                List.of(
                        member,
                        tuesdayPractice("2026-09-08T21:00:00Z"),
                        tuesdayPractice("2026-09-15T21:00:00Z"));

        assertThat(
                        ForwardRecurrenceGate.isLockEligible(
                                List.of(member), horizon, EASTERN, HORIZON_START, HORIZON_END))
                .isFalse();
    }

    @Test
    void multiMemberBlockRequiresEveryFeedMemberToPass() {
        UUID feedKid1 = FEED_ID;
        UUID feedKid2 = UUID.fromString("cccccccc-cccc-cccc-cccc-cccccccccccc");
        FeedCalendarEventDto memberA =
                event(feedKid1, Instant.parse("2026-09-01T21:00:00Z"), "Community Center");
        FeedCalendarEventDto memberB =
                event(feedKid2, Instant.parse("2026-09-01T22:00:00Z"), "School");

        List<FeedCalendarEventDto> horizon = new ArrayList<>();
        horizon.add(memberA);
        horizon.add(memberB);
        // A has 3 others
        horizon.add(event(feedKid1, Instant.parse("2026-09-08T21:00:00Z"), "Community Center"));
        horizon.add(event(feedKid1, Instant.parse("2026-09-15T21:00:00Z"), "Community Center"));
        horizon.add(event(feedKid1, Instant.parse("2026-09-22T21:00:00Z"), "Community Center"));
        // B has only 2 others → gate fails
        horizon.add(event(feedKid2, Instant.parse("2026-09-08T22:00:00Z"), "School"));
        horizon.add(event(feedKid2, Instant.parse("2026-09-15T22:00:00Z"), "School"));

        assertThat(
                        ForwardRecurrenceGate.isLockEligible(
                                List.of(memberA, memberB),
                                horizon,
                                EASTERN,
                                HORIZON_START,
                                HORIZON_END))
                .isFalse();

        horizon.add(event(feedKid2, Instant.parse("2026-09-22T22:00:00Z"), "School"));
        assertThat(
                        ForwardRecurrenceGate.isLockEligible(
                                List.of(memberA, memberB),
                                horizon,
                                EASTERN,
                                HORIZON_START,
                                HORIZON_END))
                .isTrue();
    }

    @Test
    void emptyBlockMembersIsNotEligible() {
        assertThat(
                        ForwardRecurrenceGate.isLockEligible(
                                List.of(),
                                List.of(tuesdayPractice("2026-09-01T21:00:00Z")),
                                EASTERN,
                                HORIZON_START,
                                HORIZON_END))
                .isFalse();
    }

    @Test
    void sameTimeDifferentLocationDoesNotCount() {
        FeedCalendarEventDto member = tuesdayPractice("2026-09-01T21:00:00Z");
        List<FeedCalendarEventDto> horizon =
                List.of(
                        member,
                        event(FEED_ID, Instant.parse("2026-09-08T21:00:00Z"), "Other Rink"),
                        tuesdayPractice("2026-09-15T21:00:00Z"),
                        tuesdayPractice("2026-09-22T21:00:00Z"),
                        tuesdayPractice("2026-09-29T21:00:00Z"));

        // Only 3 true matches if Other Rink is excluded — wait, we have 3 others at Rink A
        // (15, 22, 29). Other Rink should not inflate the count.
        assertThat(
                        ForwardRecurrenceGate.countOtherMatches(
                                member, horizon, EASTERN, HORIZON_START, HORIZON_END))
                .isEqualTo(3);
        assertThat(
                        ForwardRecurrenceGate.isLockEligible(
                                List.of(member), horizon, EASTERN, HORIZON_START, HORIZON_END))
                .isTrue();

        List<FeedCalendarEventDto> shortHorizon =
                List.of(
                        member,
                        event(FEED_ID, Instant.parse("2026-09-08T21:00:00Z"), "Other Rink"),
                        tuesdayPractice("2026-09-15T21:00:00Z"),
                        tuesdayPractice("2026-09-22T21:00:00Z"));
        assertThat(
                        ForwardRecurrenceGate.countOtherMatches(
                                member, shortHorizon, EASTERN, HORIZON_START, HORIZON_END))
                .isEqualTo(2);
        assertThat(
                        ForwardRecurrenceGate.isLockEligible(
                                List.of(member),
                                shortHorizon,
                                EASTERN,
                                HORIZON_START,
                                HORIZON_END))
                .isFalse();
    }

    @Test
    void eventsOutsideHorizonDoNotCount() {
        FeedCalendarEventDto member = tuesdayPractice("2026-09-01T21:00:00Z");
        List<FeedCalendarEventDto> horizon =
                List.of(
                        member,
                        tuesdayPractice("2026-09-08T21:00:00Z"),
                        tuesdayPractice("2026-09-15T21:00:00Z"),
                        // before horizon
                        tuesdayPractice("2026-08-25T21:00:00Z"),
                        // at exclusive end
                        tuesdayPractice("2026-10-01T04:00:00Z"));

        assertThat(
                        ForwardRecurrenceGate.countOtherMatches(
                                member, horizon, EASTERN, HORIZON_START, HORIZON_END))
                .isEqualTo(2);
        assertThat(
                        ForwardRecurrenceGate.isLockEligible(
                                List.of(member), horizon, EASTERN, HORIZON_START, HORIZON_END))
                .isFalse();
    }

    @Test
    void differentFeedIdDoesNotCountAsMatch() {
        FeedCalendarEventDto member = tuesdayPractice("2026-09-01T21:00:00Z");
        UUID otherFeed = UUID.randomUUID();
        List<FeedCalendarEventDto> horizon =
                List.of(
                        member,
                        event(otherFeed, Instant.parse("2026-09-08T21:00:00Z"), "Rink A"),
                        tuesdayPractice("2026-09-15T21:00:00Z"),
                        tuesdayPractice("2026-09-22T21:00:00Z"),
                        tuesdayPractice("2026-09-29T21:00:00Z"));

        assertThat(
                        ForwardRecurrenceGate.countOtherMatches(
                                member, horizon, EASTERN, HORIZON_START, HORIZON_END))
                .isEqualTo(3);
    }

    private static FeedCalendarEventDto tuesdayPractice(String startsAtIso) {
        return event(FEED_ID, Instant.parse(startsAtIso), "Rink A");
    }

    private static FeedCalendarEventDto event(UUID feedId, Instant startsAt, String location) {
        return new FeedCalendarEventDto(
                UUID.randomUUID(),
                feedId,
                "Mites",
                "uid-" + UUID.randomUUID(),
                "Practice",
                startsAt,
                startsAt.plusSeconds(3600),
                location,
                List.of());
    }
}
