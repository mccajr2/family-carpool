package com.yourorg.quickapp.feeds.internal;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
@ConditionalOnProperty(name = "app.feeds.fetch-provider", havingValue = "http", matchIfMissing = true)
class HttpIcalFetchPort implements IcalFetchPort {

    private final RestClient restClient;
    private final String userAgent;

    HttpIcalFetchPort(
            @Value(
                            "${app.feeds.user-agent:family-carpool/0.1 (https://github.com/mccajr2/family-carpool)}")
                    String userAgent) {
        this.userAgent = userAgent;
        this.restClient = RestClient.builder().defaultHeader("User-Agent", userAgent).build();
    }

    @Override
    public String fetch(String httpsUrl) {
        return restClient
                .get()
                .uri(httpsUrl)
                .header("User-Agent", userAgent)
                .retrieve()
                .body(String.class);
    }
}
