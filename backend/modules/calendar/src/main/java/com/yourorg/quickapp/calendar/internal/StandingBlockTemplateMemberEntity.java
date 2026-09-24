package com.yourorg.quickapp.calendar.internal;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.util.UUID;

@Entity
@Table(name = "standing_block_template_members")
class StandingBlockTemplateMemberEntity {

    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "template_id", nullable = false)
    private StandingBlockTemplateEntity template;

    @Column(nullable = false)
    private int position;

    @Column(name = "feed_id", nullable = false)
    private UUID feedId;

    @Column(name = "day_of_week", nullable = false, length = 16)
    private String dayOfWeek;

    @Column(name = "minute_of_day", nullable = false)
    private int minuteOfDay;

    @Column(name = "normalized_location", nullable = false, length = 500)
    private String normalizedLocation;

    @Column(name = "fingerprint_encoded", nullable = false, columnDefinition = "TEXT")
    private String fingerprintEncoded;

    @Column(name = "coverages_json", nullable = false, columnDefinition = "TEXT")
    private String coveragesJson;

    @Column(name = "ride_plans_json", nullable = false, columnDefinition = "TEXT")
    private String ridePlansJson;

    @Column(name = "route_origins_json", nullable = false, columnDefinition = "TEXT")
    private String routeOriginsJson;

    protected StandingBlockTemplateMemberEntity() {}

    StandingBlockTemplateMemberEntity(
            UUID id,
            int position,
            UUID feedId,
            String dayOfWeek,
            int minuteOfDay,
            String normalizedLocation,
            String fingerprintEncoded,
            String coveragesJson,
            String ridePlansJson,
            String routeOriginsJson) {
        this.id = id;
        this.position = position;
        this.feedId = feedId;
        this.dayOfWeek = dayOfWeek;
        this.minuteOfDay = minuteOfDay;
        this.normalizedLocation = normalizedLocation;
        this.fingerprintEncoded = fingerprintEncoded;
        this.coveragesJson = coveragesJson;
        this.ridePlansJson = ridePlansJson;
        this.routeOriginsJson = routeOriginsJson;
    }

    void setTemplate(StandingBlockTemplateEntity template) {
        this.template = template;
    }

    UUID id() {
        return id;
    }

    int position() {
        return position;
    }

    UUID feedId() {
        return feedId;
    }

    String dayOfWeek() {
        return dayOfWeek;
    }

    int minuteOfDay() {
        return minuteOfDay;
    }

    String normalizedLocation() {
        return normalizedLocation;
    }

    String fingerprintEncoded() {
        return fingerprintEncoded;
    }

    String coveragesJson() {
        return coveragesJson;
    }

    String ridePlansJson() {
        return ridePlansJson;
    }

    String routeOriginsJson() {
        return routeOriginsJson;
    }
}
