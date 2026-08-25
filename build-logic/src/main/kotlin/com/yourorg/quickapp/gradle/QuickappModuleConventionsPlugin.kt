package com.yourorg.quickapp.gradle

import io.spring.gradle.dependencymanagement.dsl.DependencyManagementExtension
import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.api.plugins.JavaPluginExtension
import org.gradle.api.tasks.testing.Test
import org.gradle.jvm.toolchain.JavaLanguageVersion
import org.gradle.kotlin.dsl.configure
import org.gradle.kotlin.dsl.dependencies
import org.gradle.kotlin.dsl.getByType
import org.gradle.kotlin.dsl.withType

class QuickappModuleConventionsPlugin : Plugin<Project> {
    override fun apply(project: Project) {
        project.pluginManager.apply("java")
        project.pluginManager.apply("io.spring.dependency-management")

        val libs = project.extensions.getByType<org.gradle.api.artifacts.VersionCatalogsExtension>().named("libs")

        project.extensions.configure<JavaPluginExtension> {
            toolchain {
                languageVersion.set(JavaLanguageVersion.of(25))
            }
        }

        project.extensions.configure<DependencyManagementExtension> {
            imports {
                mavenBom("org.springframework.boot:spring-boot-dependencies:${libs.findVersion("springBoot").get()}")
            }
        }

        project.dependencies {
            add("implementation", "org.springframework:spring-context")
            add("testImplementation", libs.findLibrary("spring-boot-starter-test").get())
        }

        project.tasks.withType<Test>().configureEach {
            useJUnitPlatform()
        }
    }
}
