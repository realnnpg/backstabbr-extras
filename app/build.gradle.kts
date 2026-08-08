plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.backstabbr.extras"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.backstabbr.extras"
        minSdk = 24
        targetSdk = 34
        versionCode = 4
        versionName = "2.2"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.activity:activity-ktx:1.9.0")
    implementation("androidx.webkit:webkit:1.11.0")
}

// ---------------------------------------------------------------------------
// Single source of truth: pull the injected JS/CSS straight from the Chrome
// extension repo into app assets before every build. If the repo isn't found
// the committed snapshot in src/main/assets/bse is used instead.
// ---------------------------------------------------------------------------
val extensionDir = (project.findProperty("bse.extensionDir") as String?) ?: "${rootDir}/../backstabbr-extras"

tasks.register<Copy>("syncExtensionAssets") {
    description = "Copy extension JS/CSS from the Chrome extension repo into app assets."
    group = "bse"
    val src = file(extensionDir)
    onlyIf { src.exists() }
    from(src) {
        include("*.js", "*.css")
        // popup.* is replaced by loader/overlay.js on Android.
        exclude("popup.js", "popup.css")
    }
    into("src/main/assets/bse")
}

tasks.named("preBuild") {
    dependsOn("syncExtensionAssets")
}
