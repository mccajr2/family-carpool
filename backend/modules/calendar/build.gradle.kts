plugins {
    id("quickapp.module-conventions")
}

dependencies {
    implementation(project(":auth"))
    implementation(project(":family"))
    implementation(project(":feeds"))
    implementation(project(":events"))
    implementation(project(":leaveby"))
    implementation(project(":coverage"))
    implementation(project(":rsvp"))
    implementation(project(":carpool"))
    implementation(libs.spring.boot.starter.web)
    implementation(libs.spring.boot.starter.data.jpa)
    implementation(libs.spring.boot.starter.validation)
}
