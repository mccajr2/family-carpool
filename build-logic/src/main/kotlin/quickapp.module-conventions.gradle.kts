import org.gradle.kotlin.dsl.getByType

plugins {
    java
    id("io.spring.dependency-management")
}

val libs = extensions.getByType<VersionCatalogsExtension>().named("libs")

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(25)
    }
}

dependencyManagement {
    imports {
        mavenBom("org.springframework.boot:spring-boot-dependencies:${libs.findVersion("springBoot").get()}")
    }
}

dependencies {
    implementation("org.springframework:spring-context")
    testImplementation(libs.findLibrary("spring-boot-starter-test").get())
}

tasks.test {
    useJUnitPlatform()
}