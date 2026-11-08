package com.protego.app.ui

import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

val Pink = Color(0xFFE20074)
val PinkTint = Color(0xFFFFF0F8)
val Background = Color(0xFFF5F5F8)
val Ink = Color(0xFF18181D)
val Muted = Color(0xFF777782)
val Green = Color(0xFF287358)
val GreenTint = Color(0xFFECF8F2)
val Amber = Color(0xFF936016)
val AmberTint = Color(0xFFFFF5E5)
val Line = Color(0xFFE2E2E9)

@Composable
fun ProtegoTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = lightColorScheme(primary = Pink, onPrimary = Color.White,
            background = Background, surface = Color.White, onSurface = Ink,
            onBackground = Ink, surfaceVariant = Background, onSurfaceVariant = Muted,
            outline = Line),
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
