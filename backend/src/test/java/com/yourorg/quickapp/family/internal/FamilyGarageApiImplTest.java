package com.yourorg.quickapp.family.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import com.yourorg.quickapp.family.FamilyAccessException;
import com.yourorg.quickapp.family.FamilyGarageApi;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
class FamilyGarageApiImplTest {

    @Mock
    private GarageService garageService;

    @Test
    void garageForCircleDelegates() {
        FamilyGarageApi api = new FamilyGarageApiImpl(garageService);
        UUID circleId = UUID.randomUUID();
        when(garageService.snapshotForCircle(circleId))
                .thenThrow(new FamilyAccessException(HttpStatus.NOT_FOUND, "Family circle not found"));

        assertThatThrownBy(() -> api.garageForCircle(circleId))
                .isInstanceOf(FamilyAccessException.class)
                .extracting(ex -> ((FamilyAccessException) ex).status())
                .isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void implIsWired() {
        assertThat(new FamilyGarageApiImpl(garageService)).isNotNull();
    }
}
