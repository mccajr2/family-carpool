package com.yourorg.quickapp.leaveby.internal;

import static org.assertj.core.api.Assertions.assertThat;

import com.yourorg.quickapp.leaveby.CalendarRouteMemberRef;
import com.yourorg.quickapp.leaveby.LeaveByItemSource;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class MemberSetKeysTest {

    @Test
    void computeIsStableAcrossSameOrderedMembers() {
        UUID a = UUID.fromString("11111111-1111-1111-1111-111111111111");
        UUID b = UUID.fromString("22222222-2222-2222-2222-222222222222");
        List<CalendarRouteMemberRef> members =
                List.of(
                        new CalendarRouteMemberRef(LeaveByItemSource.FEED, a),
                        new CalendarRouteMemberRef(LeaveByItemSource.FEED, b));
        assertThat(MemberSetKeys.compute(members)).isEqualTo(MemberSetKeys.compute(members));
        assertThat(MemberSetKeys.compute(members))
                .isNotEqualTo(
                        MemberSetKeys.compute(
                                List.of(
                                        new CalendarRouteMemberRef(LeaveByItemSource.FEED, b),
                                        new CalendarRouteMemberRef(LeaveByItemSource.FEED, a))));
    }

    @Test
    void tokensContainMatchesMember() {
        UUID a = UUID.randomUUID();
        UUID b = UUID.randomUUID();
        String token =
                MemberSetKeys.membersToken(
                        List.of(
                                new CalendarRouteMemberRef(LeaveByItemSource.FEED, a),
                                new CalendarRouteMemberRef(LeaveByItemSource.FEED, b)));
        assertThat(MemberSetKeys.tokensContain(token, LeaveByItemSource.FEED, a)).isTrue();
        assertThat(MemberSetKeys.tokensContain(token, LeaveByItemSource.FEED, b)).isTrue();
        assertThat(MemberSetKeys.tokensContain(token, LeaveByItemSource.MANUAL, a)).isFalse();
    }
}
