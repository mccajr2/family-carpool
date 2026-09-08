plugins {
    id("quickapp.module-conventions")
}

dependencies {
    implementation(project(":family"))
    implementation(project(":events"))
    implementation(project(":feeds"))
    implementation(project(":coverage"))
    implementation(libs.spring.boot.starter.web)
    implementation(libs.spring.boot.starter.data.jpa)
    implementation(libs.spring.boot.starter.validation)
}
