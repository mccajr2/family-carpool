plugins {
    java
    alias(libs.plugins.spring.boot)
    alias(libs.plugins.spring.dependency.management)
}

group = "com.yourorg.quickapp"
java { toolchain { languageVersion = JavaLanguageVersion.of(25) } }

dependencies {
    implementation(project(":greeting"))
    implementation(libs.spring.boot.starter.web)
    implementation(libs.spring.modulith.starter.core)
    testImplementation(libs.spring.boot.starter.test)
    testImplementation(libs.spring.boot.starter.webmvc.test)
    testImplementation(libs.spring.modulith.starter.test)
}

tasks.test {
    useJUnitPlatform()
}