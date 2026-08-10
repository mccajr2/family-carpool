package com.yourorg.quickapp.feeds;

import com.yourorg.quickapp.auth.AdultResponse;
import com.yourorg.quickapp.auth.AdultSessionApi;
import com.yourorg.quickapp.feeds.internal.FeedsService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/family/circle/feeds")
public class FeedsController {

    private final AdultSessionApi adultSessionApi;
    private final FeedsService feedsService;

    public FeedsController(AdultSessionApi adultSessionApi, FeedsService feedsService) {
        this.adultSessionApi = adultSessionApi;
        this.feedsService = feedsService;
    }

    @GetMapping
    public List<FeedResponse> list(HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return feedsService.list(adult);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public FeedResponse create(
            @Valid @RequestBody CreateFeedRequest request, HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return feedsService.create(adult, request);
    }

    @PutMapping("/{feedId}")
    public FeedResponse update(
            @PathVariable("feedId") UUID feedId,
            @Valid @RequestBody UpdateFeedRequest request,
            HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return feedsService.update(adult, feedId, request);
    }

    @PostMapping("/{feedId}/sync")
    public FeedResponse sync(
            @PathVariable("feedId") UUID feedId, HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return feedsService.sync(adult, feedId);
    }

    @DeleteMapping("/{feedId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable("feedId") UUID feedId, HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        feedsService.delete(adult, feedId);
    }
}
