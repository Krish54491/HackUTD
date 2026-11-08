package com.tango.app.ui

import androidx.compose.material3.*
import android.app.Activity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.*
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

enum class ThemeMode(val label: String) { SYSTEM("System"), LIGHT("Light"), DARK("Dark") }

data class ThemePreference(val mode: ThemeMode = ThemeMode.SYSTEM, val select: (ThemeMode) -> Unit = {})
val LocalThemePreference = staticCompositionLocalOf { ThemePreference() }

val Pink: Color @Composable get() = MaterialTheme.colorScheme.primary
val PinkTint: Color @Composable get() = MaterialTheme.colorScheme.primaryContainer
val Background: Color @Composable get() = MaterialTheme.colorScheme.background
val Ink: Color @Composable get() = MaterialTheme.colorScheme.onSurface
val Muted: Color @Composable get() = MaterialTheme.colorScheme.onSurfaceVariant
val Line: Color @Composable get() = MaterialTheme.colorScheme.outline
private val LocalDarkTheme = staticCompositionLocalOf { false }
val Green: Color @Composable get() = if (LocalDarkTheme.current) Color(0xFF83DDB4) else Color(0xFF287358)
val GreenTint: Color @Composable get() = if (LocalDarkTheme.current) Color(0xFF14372D) else Color(0xFFECF8F2)
val Amber: Color @Composable get() = if (LocalDarkTheme.current) Color(0xFFFDE68A) else Color(0xFF936016)
val AmberTint: Color @Composable get() = if (LocalDarkTheme.current) Color(0xFF392B18) else Color(0xFFFFF5E5)

@Composable
fun TangoTheme(content: @Composable () -> Unit) {
    val context = LocalContext.current
    val preferences = remember(context) { context.getSharedPreferences("appearance", 0) }
    var mode by remember { mutableStateOf(ThemeMode.entries.firstOrNull {
        it.name == preferences.getString("theme", null)
    } ?: ThemeMode.SYSTEM) }
    val dark = when (mode) {
        ThemeMode.SYSTEM -> isSystemInDarkTheme()
        ThemeMode.LIGHT -> false
        ThemeMode.DARK -> true
    }
    val view = LocalView.current
    if (!view.isInEditMode) SideEffect {
        (view.context as? Activity)?.window?.let { window ->
            WindowCompat.getInsetsController(window, view).apply {
                isAppearanceLightStatusBars = !dark
                isAppearanceLightNavigationBars = !dark
            }
        }
    }
    val colors = if (dark) darkColorScheme(
        primary = Color(0xFFFF4FD8), onPrimary = Color(0xFF240B23),
        primaryContainer = Color(0xFF35142F), onPrimaryContainer = Color(0xFFFFD6F5),
        secondary = Color(0xFFA855F7), secondaryContainer = Color(0xFF2D1945),
        onSecondaryContainer = Color(0xFFECE8FF),
        background = Color(0xFF06050B), onBackground = Color(0xFFECE8FF),
        surface = Color(0xFF110C20), onSurface = Color(0xFFECE8FF),
        surfaceVariant = Color(0xFF1C1334), onSurfaceVariant = Color(0xFF9A92B8),
        outline = Color(0xFF503362), outlineVariant = Color(0xFF362446),
    ) else lightColorScheme(
        primary = Color(0xFFE20074), onPrimary = Color.White,
        primaryContainer = Color(0xFFFFF0F8), onPrimaryContainer = Color(0xFF700039),
        background = Color(0xFFF5F5F8), surface = Color.White,
        onSurface = Color(0xFF18181D), onBackground = Color(0xFF18181D),
        surfaceVariant = Color(0xFFF5F5F8), onSurfaceVariant = Color(0xFF777782),
        outline = Color(0xFFE2E2E9),
    )
    CompositionLocalProvider(
        LocalDarkTheme provides dark,
        LocalThemePreference provides ThemePreference(mode) { selected ->
            mode = selected
            preferences.edit().putString("theme", selected.name).apply()
        },
    ) {
        MaterialTheme(
            colorScheme = colors,
            typography = Typography(
                headlineLarge = TextStyle(fontFamily = FontFamily.SansSerif, fontSize = 32.sp, lineHeight = 37.sp, fontWeight = FontWeight.Bold, letterSpacing = (-1).sp),
                headlineMedium = TextStyle(fontSize = 26.sp, lineHeight = 32.sp, fontWeight = FontWeight.Bold, letterSpacing = (-0.6).sp),
                titleLarge = TextStyle(fontSize = 20.sp, lineHeight = 25.sp, fontWeight = FontWeight.Bold),
                titleMedium = TextStyle(fontSize = 16.sp, lineHeight = 22.sp, fontWeight = FontWeight.SemiBold),
                bodyLarge = TextStyle(fontSize = 15.sp, lineHeight = 22.sp),
                bodyMedium = TextStyle(fontSize = 13.sp, lineHeight = 19.sp),
                bodySmall = TextStyle(fontSize = 11.sp, lineHeight = 16.sp),
                labelLarge = TextStyle(fontSize = 14.sp, fontWeight = FontWeight.SemiBold),
            ), content = content,
        )
    }
}
