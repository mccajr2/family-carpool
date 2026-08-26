plugins {
    `kotlin-dsl`
    `java-gradle-plugin`
}

gradlePlugin {
    plugins {
        create("quickappModuleConventions") {
            id = "quickapp.module-conventions"
            implementationClass = "com.yourorg.quickapp.gradle.QuickappModuleConventionsPlugin"
        }
    }
}

repositories {
    mavenCentral()
    gradlePluginPortal()
}

dependencies {
    implementation("io.spring.gradle:dependency-management-plugin:1.1.7")
}