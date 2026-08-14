package com.yourorg.quickapp.family.internal;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.time.Instant;
import java.util.Objects;

@Entity
@Table(name = "vpic_seat_cache")
@IdClass(VpicSeatCacheEntity.Key.class)
class VpicSeatCacheEntity {

    @Id
    @Column(name = "make_normalized", nullable = false, length = 140)
    private String makeNormalized;

    @Id
    @Column(name = "model_normalized", nullable = false, length = 140)
    private String modelNormalized;

    @Id
    @Column(nullable = false)
    private int year;

    @Column(nullable = false)
    private int seats;

    @Column(name = "fetched_at", nullable = false)
    private Instant fetchedAt;

    protected VpicSeatCacheEntity() {}

    VpicSeatCacheEntity(
            String makeNormalized,
            String modelNormalized,
            int year,
            int seats,
            Instant fetchedAt) {
        this.makeNormalized = makeNormalized;
        this.modelNormalized = modelNormalized;
        this.year = year;
        this.seats = seats;
        this.fetchedAt = fetchedAt;
    }

    String makeNormalized() {
        return makeNormalized;
    }

    String modelNormalized() {
        return modelNormalized;
    }

    int year() {
        return year;
    }

    int seats() {
        return seats;
    }

    static final class Key implements Serializable {
        private String makeNormalized;
        private String modelNormalized;
        private int year;

        protected Key() {}

        Key(String makeNormalized, String modelNormalized, int year) {
            this.makeNormalized = makeNormalized;
            this.modelNormalized = modelNormalized;
            this.year = year;
        }

        @Override
        public boolean equals(Object o) {
            if (this == o) {
                return true;
            }
            if (!(o instanceof Key key)) {
                return false;
            }
            return year == key.year
                    && Objects.equals(makeNormalized, key.makeNormalized)
                    && Objects.equals(modelNormalized, key.modelNormalized);
        }

        @Override
        public int hashCode() {
            return Objects.hash(makeNormalized, modelNormalized, year);
        }
    }
}
