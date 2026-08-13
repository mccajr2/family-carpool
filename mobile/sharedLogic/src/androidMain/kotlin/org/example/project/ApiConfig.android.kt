package org.example.project

/**
 * Device/emulator loopback. Reach the host backend with
 * `adb reverse tcp:8080 tcp:8080` (Gradle `:androidApp:installDebug` / `:adbReverse`).
 *
 * Do not use `10.0.2.2` here: modern AVDs default to Wi‑Fi (`wlan0`), where that
 * address is only the gateway — OkHttp connect to host:8080 times out.
 */
actual fun apiBaseUrl(): String = "http://127.0.0.1:8080"
