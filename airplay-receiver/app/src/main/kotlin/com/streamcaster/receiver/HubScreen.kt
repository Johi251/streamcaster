package com.streamcaster.receiver

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.github.jqssun.airplay.service.AirPlayService

@Composable
fun HubScreen(
    code: String,
    status: StreamCasterSession.Status,
    notice: String?,
    airplayState: AirPlayService.ServerState?,
    airplayConnections: Int,
    onNewCode: () -> Unit,
    onAirPlaySettings: () -> Unit,
    onAirPlayStart: () -> Unit,
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.radialGradient(
                    colors = listOf(Color(0x264F8CFF), Color(0x0D8AB4FF), Brand.Bg),
                    radius = 1400f,
                )
            )
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 48.dp, vertical = 28.dp),
            verticalArrangement = Arrangement.SpaceBetween,
        ) {
            Header()

            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(
                    text = "MIT DEM FERNSEHER VERBINDEN",
                    color = Brand.Muted,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    letterSpacing = 2.6.sp,
                )
                Spacer(Modifier.height(12.dp))

                RoomCodeCard(code = code, peerConnected = status.peerConnected)
                Spacer(Modifier.height(16.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(14.dp),
                ) {
                    StatusCard(
                        modifier = Modifier.weight(1f),
                        title = "STREAMCASTER",
                        value = connectionLabel(status),
                        color = connectionColor(status),
                    )
                    StatusCard(
                        modifier = Modifier.weight(1f),
                        title = "AIRPLAY",
                        value = airPlayLabel(airplayState, airplayConnections),
                        color = airPlayColor(airplayState, airplayConnections),
                    )
                }

                if (notice != null) {
                    Spacer(Modifier.height(12.dp))
                    Surface(
                        color = Color(0x1FFFD479),
                        shape = Brand.CardShape,
                        border = BorderStroke(1.dp, Color(0x55FFD479)),
                    ) {
                        Text(
                            text = notice,
                            modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp),
                            color = Brand.Warn,
                            fontSize = 14.sp,
                            textAlign = TextAlign.Center,
                        )
                    }
                }
            }

            Footer(
                airplayState = airplayState,
                onNewCode = onNewCode,
                onAirPlaySettings = onAirPlaySettings,
                onAirPlayStart = onAirPlayStart,
            )
        }
    }
}

@Composable
private fun Header() {
    Row(verticalAlignment = Alignment.CenterVertically) {
        StreamCasterMark(Modifier.size(54.dp))
        Spacer(Modifier.width(14.dp))
        Column {
            Row {
                Text(
                    "Stream",
                    color = Brand.Text,
                    fontSize = 28.sp,
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = (-0.4).sp,
                )
                Text(
                    "Caster",
                    color = Brand.Accent,
                    fontSize = 28.sp,
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = (-0.4).sp,
                )
            }
            Text(
                "RECEIVER · FIRE TV",
                color = Brand.Muted,
                fontSize = 11.sp,
                fontWeight = FontWeight.Medium,
                letterSpacing = 2.sp,
            )
        }
        Spacer(Modifier.weight(1f))
        Surface(
            color = Color(0x14FFFFFF),
            shape = Brand.PillShape,
            border = BorderStroke(1.dp, Brand.Border),
        ) {
            Text(
                "AIRPLAY + CAST",
                modifier = Modifier.padding(horizontal = 14.dp, vertical = 7.dp),
                color = Brand.Accent2,
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = 1.4.sp,
            )
        }
    }
}

@Composable
private fun RoomCodeCard(code: String, peerConnected: Boolean) {
    Surface(
        color = Brand.Card,
        shape = Brand.CodeShape,
        border = BorderStroke(1.dp, Brand.Border),
        shadowElevation = 0.dp,
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 52.dp, vertical = 20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(
                "RAUM-CODE",
                color = Brand.Muted,
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = 3.sp,
            )
            Spacer(Modifier.height(6.dp))
            Text(
                text = code.ifEmpty { "••••••" },
                color = Brand.Text,
                fontFamily = FontFamily.Monospace,
                fontSize = 68.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 12.sp,
                lineHeight = 78.sp,
            )
            Text(
                text = if (peerConnected) "Sender verbunden" else "Auf dem Handy unter streamcaster.pages.dev eingeben",
                color = if (peerConnected) Brand.Ok else Brand.Muted,
                fontSize = 14.sp,
            )
        }
    }
}

@Composable
private fun StatusCard(
    modifier: Modifier = Modifier,
    title: String,
    value: String,
    color: Color,
) {
    Surface(
        modifier = modifier.heightIn(min = 76.dp),
        color = Brand.Card2,
        shape = Brand.CardShape,
        border = BorderStroke(1.dp, Brand.Border),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 18.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                Modifier
                    .size(9.dp)
                    .background(color, RoundedCornerShape(999.dp))
            )
            Spacer(Modifier.width(12.dp))
            Column {
                Text(
                    title,
                    color = Brand.Muted,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.SemiBold,
                    letterSpacing = 1.8.sp,
                )
                Spacer(Modifier.height(3.dp))
                Text(
                    value,
                    color = Brand.Text,
                    fontSize = 17.sp,
                    fontWeight = FontWeight.SemiBold,
                )
            }
        }
    }
}

@Composable
private fun Footer(
    airplayState: AirPlayService.ServerState?,
    onNewCode: () -> Unit,
    onAirPlaySettings: () -> Unit,
    onAirPlayStart: () -> Unit,
) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Button(
                onClick = onNewCode,
                shape = Brand.PillShape,
                colors = ButtonDefaults.buttonColors(
                    containerColor = Brand.Accent,
                    contentColor = Color.White,
                ),
                modifier = Modifier.height(50.dp),
            ) {
                Text("Neuer Code", fontWeight = FontWeight.SemiBold)
            }
            Spacer(Modifier.width(12.dp))
            if (airplayState == null || airplayState == AirPlayService.ServerState.STOPPED ||
                airplayState == AirPlayService.ServerState.ERROR
            ) {
                Button(
                    onClick = onAirPlayStart,
                    shape = Brand.PillShape,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color(0x1F4F8CFF),
                        contentColor = Brand.Accent2,
                    ),
                    modifier = Modifier.height(50.dp),
                ) {
                    Text("AirPlay starten", fontWeight = FontWeight.SemiBold)
                }
            } else {
                OutlinedButton(
                    onClick = onAirPlaySettings,
                    shape = Brand.PillShape,
                    border = BorderStroke(1.dp, Brand.Border),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = Brand.Text),
                    modifier = Modifier.height(50.dp),
                ) {
                    Text("AirPlay-Einstellungen", fontWeight = FontWeight.SemiBold)
                }
            }
        }
        Spacer(Modifier.height(12.dp))
        Text(
            text = "iPhone/iPad: Kontrollzentrum → Bildschirmspiegelung → „StreamCaster TV“   ·   streamcaster.pages.dev",
            color = Brand.Muted,
            fontSize = 13.sp,
            textAlign = TextAlign.Center,
        )
    }
}

private fun connectionLabel(status: StreamCasterSession.Status): String = when {
    status.connection == StreamCasterSession.Connection.CONNECTED && status.peerConnected -> "Sender verbunden"
    status.connection == StreamCasterSession.Connection.CONNECTED -> "Warte auf Sender"
    status.connection == StreamCasterSession.Connection.CONNECTING -> "Verbinde…"
    status.connection == StreamCasterSession.Connection.RECONNECTING -> "Verbinde neu…"
    status.connection == StreamCasterSession.Connection.ERROR -> "Fehler"
    else -> "Inaktiv"
}

private fun connectionColor(status: StreamCasterSession.Status): Color = when {
    status.connection == StreamCasterSession.Connection.CONNECTED && status.peerConnected -> Brand.Ok
    status.connection == StreamCasterSession.Connection.CONNECTED -> Brand.Accent
    status.connection == StreamCasterSession.Connection.CONNECTING ||
        status.connection == StreamCasterSession.Connection.RECONNECTING -> Brand.Warn
    status.connection == StreamCasterSession.Connection.ERROR -> Brand.Danger
    else -> Brand.Muted
}

private fun airPlayLabel(state: AirPlayService.ServerState?, connections: Int): String = when {
    state == null -> "Startet…"
    state == AirPlayService.ServerState.ERROR -> "Fehler"
    state == AirPlayService.ServerState.STOPPED -> "Nicht aktiv"
    connections > 0 -> "Verbunden ($connections)"
    else -> "Bereit"
}

private fun airPlayColor(state: AirPlayService.ServerState?, connections: Int): Color = when {
    state == null -> Brand.Warn
    state == AirPlayService.ServerState.ERROR -> Brand.Danger
    state == AirPlayService.ServerState.STOPPED -> Brand.Muted
    connections > 0 -> Brand.Ok
    else -> Brand.Ok
}
