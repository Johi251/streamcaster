plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.ksp)
    alias(libs.plugins.hilt)
}

import java.util.Properties

val localProps = Properties().apply {
    rootProject.file("local.properties").takeIf { it.exists() }?.inputStream()?.use(::load)
}

// Most Fire TV Sticks run a 32-bit userspace (armeabi-v7a) even on 64-bit SoCs —
// the Fire TV Stick 4K 1st gen reports ro.product.cpu.abi=armeabi-v7a. Shipping
// only arm64-v8a made the APK uninstallable on those devices, so both ABIs are
// bundled. Costs ~5 MB more and roughly doubles the native build time.
val allAbis = listOf("arm64-v8a", "armeabi-v7a")

android {
    // The Kotlin package stays upstream-compatible: the JNI bridge binds native
    // symbols to io.github.jqssun.airplay.bridge.NativeBridge.
    namespace = "io.github.jqssun.airplay"
    compileSdk = 37
    ndkVersion = "27.0.12077973"

    if (localProps.containsKey("storeFile")) {
        signingConfigs {
            create("release") {
                storeFile = rootProject.file(localProps.getProperty("storeFile"))
                storePassword = localProps.getProperty("storePassword")
                keyAlias = localProps.getProperty("keyAlias")
                keyPassword = localProps.getProperty("keyPassword")
                // v1 (JAR signing) is mandatory below API 24: Android 5.x/6.x
                // cannot read the v2/v3 signature block and abort the install
                // with INSTALL_PARSE_FAILED_NO_CERTIFICATES ("Problem beim
                // Parsen des Pakets"). v2 stays on for API 24+, v3 for API 28+.
                enableV1Signing = true
                enableV2Signing = true
                enableV3Signing = true
            }
        }
    }

    defaultConfig {
        applicationId = "com.streamcaster.receiver"
        // Device coverage, oldest first:
        //   Fire OS 5  (Fire TV Stick 1st gen / Lite) = Android 5.1.1 = API 22
        //   Fire OS 6  (Fire TV Stick 4K 1st gen)     = Android 7.1.2 = API 25
        //   Fire OS 7/8                               = API 28/29
        // minSdk 28 made the package fail to parse on Fire OS 6; 24 was still
        // one step too high for Fire OS 5 sticks. 22 is the lowest level that
        // still gets v1 signing, and the NewApi lint gate in CI keeps every
        // API-23+ call out of the code path.
        minSdk = 22
        targetSdk = 34
        versionCode = 5
        versionName = "1.0.4"

        externalNativeBuild {
            cmake {
                arguments += "-DANDROID_STL=c++_shared"
                arguments += "-DANDROID_SUPPORT_FLEXIBLE_PAGE_SIZES=ON"
            }
        }
    }

    externalNativeBuild {
        cmake {
            path = file("src/main/cpp/CMakeLists.txt")
        }
    }

    buildTypes {
        debug {
            ndk { abiFilters += allAbis }
        }
        release {
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            signingConfigs.findByName("release")?.let { signingConfig = it }
            ndk { abiFilters += allAbis }
        }
        // debuggable build with HWASan (arm64) + UBSan in native code
        create("sanitize") {
            initWith(getByName("debug"))
            matchingFallbacks += "debug"
            ndk {
                abiFilters.clear()
                abiFilters += "arm64-v8a"
            }
            externalNativeBuild {
                cmake { arguments += "-DSANITIZE=ON" }
            }
        }
    }

    dependenciesInfo {
        includeInApk = false
        includeInBundle = false
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        compose = true
        prefab = true
    }
}

tasks.register("applyUxplayPatches") {
    doLast {
        fun git(vararg args: String): String {
            val proc = ProcessBuilder("git", "-C", "$projectDir/src/main/cpp/third_party/UxPlay", *args)
                .redirectErrorStream(true).start()
            val out = proc.inputStream.bufferedReader().readText()
            check(proc.waitFor() == 0) { "git ${args.joinToString(" ")} failed:\n$out" }
            return out
        }
        val patches = file("src/main/cpp/patches/UxPlay").listFiles { f -> f.extension == "patch" }!!.sorted()
        val touched = patches.flatMap { git("apply", "--numstat", it.path).trim().lines() }
            .map { it.substringAfterLast("\t") }.distinct()
        git("checkout", "--", *touched.toTypedArray())
        patches.forEach { git("apply", "--unidiff-zero", it.path) }
    }
}

tasks.configureEach {
    if (name.startsWith("configureCMake")) dependsOn("applyUxplayPatches")
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.runtime)
    implementation(libs.androidx.lifecycle.service)
    implementation(libs.androidx.lifecycle.viewmodel)
    implementation(libs.androidx.datastore.prefs)
    implementation(libs.androidx.media)
    implementation(libs.media3.exoplayer)
    implementation(libs.media3.exoplayer.hls)
    implementation(libs.media3.transformer)
    implementation(libs.kotlinx.coroutines)
    implementation(libs.oboe)

    // StreamCaster hub: WebSocket signaling + media player view
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation(libs.media3.ui)

    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui)
    implementation(libs.compose.ui.graphics)
    implementation(libs.compose.ui.tooling.preview)
    implementation(libs.compose.material3)
    implementation(libs.compose.material.icons)
    debugImplementation(libs.compose.ui.tooling)

    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)
    implementation(libs.hilt.navigation.compose)
}
