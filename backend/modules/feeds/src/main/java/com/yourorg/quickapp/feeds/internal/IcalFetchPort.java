package com.yourorg.quickapp.feeds.internal;

import java.util.List;

/** Port for fetching calendar text from a URL (HTTP or test stub). */
interface IcalFetchPort {
    String fetch(String httpsUrl);
}
