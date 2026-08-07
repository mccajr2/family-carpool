pluginManagement {
    includeBuild("build-logic")
}

rootProject.name = "quickapp"

dependencyResolutionManagement {
    repositories {
        mavenCentral()
    }
}

file("backend/modules").listFiles()?.filter { it.isDirectory }?.forEach { dir ->
    include(":${dir.name}")
    project(":${dir.name}").projectDir = dir
}

include(":backend")