package com.zhejiangjinmo.lingjing.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// ── 灵境深色主题对齐 qoder.apk 设计 ──
val DarkBg = Color(0xFF0D1117)
val DarkSurface = Color(0xFF161B22)
val DarkSurface2 = Color(0xFF21262D)
val DarkBorder = Color(0xFF30363D)
val DarkText = Color(0xFFC9D1D9)
val DarkTextSecondary = Color(0xFF8B949E)
val DarkTextTertiary = Color(0xFF6E7681)

val PrimaryBlue = Color(0xFF58A6FF)
val PrimaryBlueBg = Color(0x1A58A6FF)
val SuccessGreen = Color(0xFF3FB950)
val SuccessBg = Color(0x1A3FB950)
val WarningYellow = Color(0xFFD29922)
val WarningBg = Color(0x1AD29922)
val DangerRed = Color(0xFFF85149)
val DangerBg = Color(0x1AF85149)
val Purple = Color(0xFFA371F7)
val PurpleBg = Color(0x1AA371F7)

private val DarkColorScheme = darkColorScheme(
    primary = PrimaryBlue,
    onPrimary = Color.White,
    primaryContainer = PrimaryBlueBg,
    background = DarkBg,
    surface = DarkSurface,
    surfaceVariant = DarkSurface2,
    onBackground = DarkText,
    onSurface = DarkText,
    onSurfaceVariant = DarkTextSecondary,
    outline = DarkBorder,
    error = DangerRed,
    errorContainer = DangerBg,
)

private val LightColorScheme = lightColorScheme(
    primary = Color(0xFF0969DA),
    onPrimary = Color.White,
    primaryContainer = Color(0x140969DA),
    background = Color.White,
    surface = Color(0xFFF6F8FA),
    surfaceVariant = Color(0xFFEAEEF2),
    onBackground = Color(0xFF1F2328),
    onSurface = Color(0xFF1F2328),
    onSurfaceVariant = Color(0xFF656D76),
    outline = Color(0xFFD0D7DE),
)

@Composable
fun LingJingTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme,
        typography = Typography(),
        content = content
    )
}
