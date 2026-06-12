# --- ProGuard Rules ---

# Keep Dagger/Hilt
-keep class dagger.hilt.** { *; }
-keep class javax.inject.** { *; }
-keep class * extends dagger.hilt.android.internal.managers.ViewComponentManager$FragmentContextWrapper { *; }

# Keep Kotlin Serialization
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt
-keepclassmembers class kotlinx.serialization.json.** { *** Companion; }
-keepclasseswithmembers class kotlinx.serialization.json.** { kotlinx.serialization.KSerializer serializer(...); }
-keep,includedescriptorclasses class com.zhejiangjinmo.lingjing.**$$serializer { *; }
-keepclassmembers class com.zhejiangjinmo.lingjing.** { *** Companion; }
-keepclasseswithmembers class com.zhejiangjinmo.lingjing.** { kotlinx.serialization.KSerializer serializer(...); }

# Keep OkHttp
-dontwarn okhttp3.**
-dontwarn okio.**
-keep class okhttp3.** { *; }

# Keep Data model classes
-keep class com.zhejiangjinmo.lingjing.data.model.** { *; }

# Keep Compose
-keep class androidx.compose.** { *; }
