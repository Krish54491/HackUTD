plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}
android {
    namespace = "com.tango.app"
    compileSdk = 36
    defaultConfig {
        applicationId = "com.tango.app"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0"
        // "Report a hornet" server. Same database as the website and extension; override with
        // -Ptango.spacetimeHost=http://10.0.2.2:3000 -Ptango.spacetimeDb=<name> to test against a local SpacetimeDB.
        val spacetimeHost = providers.gradleProperty("tango.spacetimeHost").getOrElse("https://maincloud.spacetimedb.com")
        val spacetimeDb = providers.gradleProperty("tango.spacetimeDb").getOrElse("protego")
        buildConfigField("String", "SPACETIME_HOST", "\"$spacetimeHost\"")
        buildConfigField("String", "SPACETIME_DB", "\"$spacetimeDb\"")
    }
    buildFeatures { compose = true; buildConfig = true }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
dependencies {
    implementation(platform("androidx.compose:compose-bom:2025.08.01"))
    implementation("androidx.navigation:navigation-compose:2.9.3")
    implementation("androidx.activity:activity-compose:1.10.1")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.9.2")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.9.2")
    debugImplementation("androidx.compose.ui:ui-tooling")
    testImplementation("junit:junit:4.13.2")
}

kotlin { compilerOptions { jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17) } }
