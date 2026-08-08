plugins {
    id("quickapp.module-conventions")
}

dependencies {
    implementation(project(":auth"))
    implementation(libs.spring.boot.starter.web)
    implementation(libs.spring.boot.starter.data.jpa)
    implementation(libs.spring.boot.starter.validation)
}
