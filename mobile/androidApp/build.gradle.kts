import java.io.File
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.androidApplication)
    alias(libs.plugins.composeMultiplatform)
    alias(libs.plugins.composeCompiler)
}

kotlin {
    compilerOptions {
        jvmTarget = JvmTarget.JVM_11
    }
}
dependencies {
    implementation(projects.sharedUI)

    implementation(libs.androidx.activity.compose)

    implementation(libs.compose.uiToolingPreview)
    debugImplementation(libs.compose.uiTooling)
}

android {
    namespace = "org.example.project"
    compileSdk = libs.versions.android.compileSdk.get().toInt()

    defaultConfig {
        applicationId = "org.example.project"
        minSdk = libs.versions.android.minSdk.get().toInt()
        targetSdk = libs.versions.android.targetSdk.get().toInt()
        versionCode = 1
        versionName = "1.0"
    }
    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
    buildTypes {
        getByName("release") {
            isMinifyEnabled = false
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
}

/**
 * Host-side port forward so the app's `http://127.0.0.1:8080` reaches the
 * machine's backend. Needed because modern emulator Wi‑Fi makes `10.0.2.2`
 * unreliable for app sockets. Reverse dies when the emulator/USB session
 * resets or when adb restarts — re-running install/run restores it. No-ops
 * when adb or a device is missing (CI / offline builds).
 */
val adbReverse =
    tasks.register("adbReverse") {
        group = "install"
        description = "adb reverse tcp:8080 tcp:8080 for local backend dogfood"
        notCompatibleWithConfigurationCache("runs host adb")
        val localPropertiesPath = rootProject.file("local.properties").absolutePath
        doLast {
            fun sdkAdb(sdkRoot: String?): String? =
                sdkRoot
                    ?.takeIf { it.isNotBlank() }
                    ?.let { "$it/platform-tools/adb" }
                    ?.takeIf { path -> File(path).canExecute() || File(path).exists() }

            fun localPropertiesSdkDir(): String? {
                val propsFile = File(localPropertiesPath)
                if (!propsFile.isFile) return null
                return propsFile
                    .readLines()
                    .map { it.trim() }
                    .firstOrNull { it.startsWith("sdk.dir=") }
                    ?.substringAfter("sdk.dir=")
                    ?.trim()
                    ?.removeSurrounding("\"")
                    ?.removeSurrounding("'")
                    ?.replace("\\:", ":")
            }

            val home = System.getProperty("user.home")
            val adb =
                sequenceOf(
                    sdkAdb(System.getenv("ANDROID_HOME")),
                    sdkAdb(System.getenv("ANDROID_SDK_ROOT")),
                    sdkAdb(localPropertiesSdkDir()),
                    sdkAdb("$home/Library/Android/sdk"),
                    sdkAdb("$home/Android/Sdk"),
                ).filterNotNull().firstOrNull() ?: "adb"

            fun runAdb(vararg args: String): Pair<Int, String>? {
                return try {
                    val proc =
                        ProcessBuilder(listOf(adb) + args.toList())
                            .redirectErrorStream(true)
                            .start()
                    val out = proc.inputStream.bufferedReader().readText().trim()
                    proc.waitFor() to out
                } catch (e: java.io.IOException) {
                    logger.lifecycle("adbReverse: skipped (adb not found at '$adb': ${e.message})")
                    null
                }
            }

            val devices = runAdb("devices") ?: return@doLast
            val (devicesCode, devicesOut) = devices
            if (devicesCode != 0) {
                logger.lifecycle("adbReverse: skipped (adb not usable: $devicesOut)")
                return@doLast
            }
            val hasDevice =
                devicesOut
                    .lineSequence()
                    .drop(1)
                    .any { line ->
                        val parts = line.trim().split(Regex("\\s+"))
                        parts.size >= 2 && parts[1] == "device"
                    }
            if (!hasDevice) {
                logger.lifecycle("adbReverse: skipped (no device/emulator)")
                return@doLast
            }
            val reverse = runAdb("reverse", "tcp:8080", "tcp:8080") ?: return@doLast
            val (code, out) = reverse
            if (code == 0) {
                logger.lifecycle("adbReverse: tcp:8080 -> host:8080 (via $adb)")
            } else {
                logger.warn("adbReverse: failed ($code): $out")
            }
        }
    }

listOf("installDebug", "installRelease").forEach { installName ->
    tasks.configureEach {
        if (name == installName) {
            dependsOn(adbReverse)
        }
    }
}
