package com.yourorg.quickapp;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class QuickappApplication {
    public static void main(String[] args) {
        SpringApplication.run(QuickappApplication.class, args);
    }
}