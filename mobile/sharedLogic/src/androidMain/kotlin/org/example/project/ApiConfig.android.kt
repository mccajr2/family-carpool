package org.example.project

/** Host loopback via `adb reverse tcp:8080 tcp:8080` (emulator or USB device). */
actual fun apiBaseUrl(): String = "http://127.0.0.1:8080"
