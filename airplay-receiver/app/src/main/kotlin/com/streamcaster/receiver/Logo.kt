package com.streamcaster.receiver

import androidx.compose.foundation.Canvas
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke

/** In-app StreamCaster mark: a screen, a play glyph and broadcast waves. */
@Composable
fun StreamCasterMark(modifier: Modifier = Modifier) {
    Canvas(modifier = modifier) {
        val w = size.width
        val h = size.height
        val stroke = w * 0.07f
        val screen = Size(w * 0.64f, h * 0.46f)
        val topLeft = Offset(w * 0.05f, h * 0.12f)
        drawRoundRect(
            color = Brand.Accent,
            topLeft = topLeft,
            size = screen,
            cornerRadius = CornerRadius(w * 0.09f, w * 0.09f),
            style = Stroke(width = stroke),
        )
        val play = Path().apply {
            moveTo(w * 0.31f, h * 0.25f)
            lineTo(w * 0.47f, h * 0.35f)
            lineTo(w * 0.31f, h * 0.45f)
            close()
        }
        drawPath(play, color = Brand.Text)

        // broadcast arcs, bottom-left
        val origin = Offset(w * 0.20f, h * 0.88f)
        drawCircle(color = Brand.Text, radius = w * 0.045f, center = origin)
        drawArc(
            color = Brand.Accent2,
            startAngle = 270f,
            sweepAngle = 90f,
            useCenter = false,
            topLeft = Offset(origin.x - w * 0.16f, origin.y - w * 0.16f),
            size = Size(w * 0.32f, w * 0.32f),
            style = Stroke(width = stroke * 0.8f),
        )
        drawArc(
            color = Color(0x664F8CFF),
            startAngle = 270f,
            sweepAngle = 90f,
            useCenter = false,
            topLeft = Offset(origin.x - w * 0.26f, origin.y - w * 0.26f),
            size = Size(w * 0.52f, w * 0.52f),
            style = Stroke(width = stroke * 0.8f),
        )
    }
}
