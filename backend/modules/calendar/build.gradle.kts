plugins {
    id("quickapp.module-conventions")
}

dependencies {
    implementation(project(":auth"))
    implementation(project(":family"))
    implementation(project(":feeds"))
    implementation(project(":events"))
    implementation(project(":leaveby"))
    implementation(libs.spring.boot.starter.web)
    implementation(libs.spring.boot.starter.validation)
}
