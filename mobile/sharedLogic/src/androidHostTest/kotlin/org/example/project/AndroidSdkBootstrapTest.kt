package org.example.project

import java.io.File
import kotlin.test.Test
import kotlin.test.assertTrue

class AndroidSdkBootstrapTest {

    @Test
    fun settingsAppliesBootstrapThatResolvesDefaultSdkLocations() {
        val startDir = File(System.getProperty("user.dir") ?: error("user.dir is not set"))
        val mobileRoot = generateSequence(startDir) { it.parentFile }
            .first {
                File(it, "settings.gradle.kts").isFile &&
                    File(it, "gradle").isDirectory &&
                    File(it, "sharedLogic").isDirectory
            }

        val settings = File(mobileRoot, "settings.gradle.kts").readText()
        assertTrue(
            settings.contains("androidSdkBootstrap.settings.gradle.kts"),
            "settings.gradle.kts must apply the Android SDK bootstrap on fresh clones",
        )

        val bootstrap = File(mobileRoot, "gradle/androidSdkBootstrap.settings.gradle.kts")
        assertTrue(bootstrap.isFile, "bootstrap script must exist at gradle/androidSdkBootstrap.settings.gradle.kts")

        val script = bootstrap.readText()
        assertTrue(script.contains("ANDROID_HOME"), "bootstrap must check ANDROID_HOME")
        assertTrue(script.contains("ANDROID_SDK_ROOT"), "bootstrap must check ANDROID_SDK_ROOT")
        assertTrue(script.contains("Library/Android/sdk"), "bootstrap must check macOS default SDK path")
        assertTrue(script.contains("Android/Sdk"), "bootstrap must check Linux default SDK path")
        assertTrue(script.contains("local.properties"), "bootstrap must write local.properties")
    }
}
