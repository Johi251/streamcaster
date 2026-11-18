package com.streamcaster.receiver

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** Palette shared with the StreamCaster web app (apps/sender/public/style.css). */
object Brand {
    val Bg = Color(0xFF0B0D12)
    val BgGlow = Color(0x244F8CFF)
    val Card = Color(0xB3141822)
    val Card2 = Color(0xB31A2030)
    val Border = Color(0x17FFFFFF)
    val Text = Color(0xFFE8EBF2)
    val Muted = Color(0xFF8A93A6)
    val Accent = Color(0xFF4F8CFF)
    val Accent2 = Color(0xFF8AB4FF)
    val Ok = Color(0xFF7CE38B)
    val Warn = Color(0xFFFFD479)
    val Danger = Color(0xFFFF5F6D)
    // `.dp` matters: RoundedCornerShape has a second overload taking an Int
    // *percent*, and a bare literal like 999 binds to it. CornerSize(percent)
    // requires 0..100, so `RoundedCornerShape(999)` threw in this object's static
    // initializer and the app died before its first frame.
    val CodeShape = RoundedCornerShape(28.dp)
    val CardShape = RoundedCornerShape(20.dp)
    val PillShape = RoundedCornerShape(999.dp)
}

private val StreamCasterColors = darkColorScheme(
    primary = Brand.Accent,
    onPrimary = Color.White,
    primaryContainer = Brand.Accent,
    onPrimaryContainer = Color.White,
    secondary = Brand.Accent2,
    onSecondary = Brand.Bg,
    background = Brand.Bg,
    onBackground = Brand.Text,
    surface = Brand.Card,
    onSurface = Brand.Text,
    surfaceVariant = Brand.Card2,
    onSurfaceVariant = Brand.Muted,
    outline = Brand.Border,
    error = Brand.Danger,
)

private val StreamCasterTypography = Typography(
    displayLarge = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.ExtraBold,
        fontSize = 64.sp,
        letterSpacing = (-1).sp,
    ),
    headlineMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Bold,
        fontSize = 26.sp,
    ),
    titleLarge = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.SemiBold,
        fontSize = 20.sp,
    ),
    bodyLarge = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Normal,
        fontSize = 17.sp,
        lineHeight = 24.sp,
    ),
    bodyMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontSize = 14.sp,
        lineHeight = 20.sp,
    ),
    labelLarge = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.SemiBold,
        fontSize = 15.sp,
        letterSpacing = 0.2.sp,
    ),
)

@Composable
fun StreamCasterTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = StreamCasterColors,
        typography = StreamCasterTypography,
        content = content,
    )
}
