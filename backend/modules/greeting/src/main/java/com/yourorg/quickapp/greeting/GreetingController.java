package com.yourorg.quickapp.greeting;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class GreetingController {

    private final GreetingApi greetingApi;

    public GreetingController(GreetingApi greetingApi) {
        this.greetingApi = greetingApi;
    }

    @GetMapping("/api/greeting")
    public GreetingResponse greeting(@RequestParam("name") String name) {
        return new GreetingResponse(greetingApi.greet(name));
    }
}
