package com.streamcaster.receiver

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.Bundle
import android.os.IBinder
import android.util.Log
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import io.github.jqssun.airplay.MainActivity
import io.github.jqssun.airplay.Prefs
import io.github.jqssun.airplay.hasLocalNetwork
import io.github.jqssun.airplay.service.AirPlayService
import kotlinx.coroutines.launch
import org.json.JSONObject

/**
 * Launcher screen: shows the StreamCaster room code and the AirPlay status.
 *
 * AirPlay itself is served by the upstream AirPlayService, so the iPhone can
 * discover "StreamCaster TV" while this screen is visible. When a sender
 * connects, the service opens MainActivity for the fullscreen mirror.
 */
class HubActivity : ComponentActivity() {

    private var service: AirPlayService? = null
    private var airplayState by mutableStateOf<AirPlayService.ServerState?>(null)
    private var airplayConnections by mutableIntStateOf(0)
    private var localNotice by mutableStateOf<String?>(null)

    private val connection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, binder: IBinder?) {
            val svc = (binder as? AirPlayService.LocalBinder)?.service ?: return
            service = svc
            airplayState = svc.serverState.value
            airplayConnections = svc.connectionCount.value
            lifecycleScope.launch {
                repeatOnLifecycle(Lifecycle.State.STARTED) {
                    launch { svc.serverState.collect { airplayState = it } }
                    launch { svc.connectionCount.collect { airplayConnections = it } }
                }
            }
            maybeStartAirPlay()
        }

        override fun onServiceDisconnected(name: ComponentName?) {
            service = null
            airplayState = null
            airplayConnections = 0
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowInsetsControllerCompat(window, window.decorView).apply {
            hide(WindowInsetsCompat.Type.systemBars())
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }

        StreamCasterSession.start(applicationContext)
        bindService(Intent(this, AirPlayService::class.java), connection, Context.BIND_AUTO_CREATE)

        val lifecycleOwner = this
        setContent {
            StreamCasterTheme {
                val status by StreamCasterSession.status.collectAsState()
                val noticeFlow by StreamCasterSession.notice.collectAsState()
                val notice = localNotice ?: noticeFlow

                LaunchedEffect(Unit) {
                    lifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                        StreamCasterSession.commands.collect { op -> handleCommand(op) }
                    }
                }

                HubScreen(
                    code = status.code,
                    status = status,
                    notice = notice,
                    airplayState = airplayState,
                    airplayConnections = airplayConnections,
                    onNewCode = {
                        localNotice = null
                        StreamCasterSession.newCode()
                    },
                    onAirPlaySettings = {
                        startActivity(Intent(this@HubActivity, MainActivity::class.java))
                    },
                    onAirPlayStart = { startAirPlay() },
                )
            }
        }
    }

    override fun onStart() {
        super.onStart()
        maybeStartAirPlay()
    }

    private fun maybeStartAirPlay() {
        val prefs = getSharedPreferences(Prefs.NAME, Context.MODE_PRIVATE)
        if (!prefs.getBoolean(Prefs.AUTO_START.key, true)) return
        val state = airplayState
        if (state == AirPlayService.ServerState.RUNNING || state == AirPlayService.ServerState.ERROR) return
        if (!hasLocalNetwork()) {
            localNotice = "Zugriff auf lokales Netzwerk nötig, damit das iPhone den TV findet."
            return
        }
        startAirPlay()
    }

    private fun startAirPlay() {
        try {
            ContextCompat.startForegroundService(
                this,
                Intent(this, AirPlayService::class.java).setAction(AirPlayService.ACTION_START_SERVER),
            )
        } catch (e: Exception) {
            Log.w(TAG, "AirPlay start failed", e)
            localNotice = "AirPlay konnte nicht gestartet werden."
        }
    }

    private fun handleCommand(op: JSONObject) {
        when (op.optString("name")) {
            "load" -> {
                val url = op.optString("url")
                if (url.isBlank()) return
                localNotice = null
                startActivity(
                    Intent(this, CastPlayerActivity::class.java)
                        .putExtra(CastPlayerActivity.EXTRA_URL, url)
                        .putExtra(CastPlayerActivity.EXTRA_TITLE, op.optString("title"))
                        .putExtra(CastPlayerActivity.EXTRA_MIME, op.optString("mime"))
                )
            }
            "file-meta" -> {
                val name = op.optString("filename")
                if (name.isNotBlank()) localNotice = "Datei: $name"
            }
            "stream-start" -> {
                localNotice = "WebRTC-Mirroring wird noch nicht unterstützt – nutze AirPlay für Bildschirmspiegelung."
            }
            "stream-stop" -> localNotice = null
        }
    }

    override fun onDestroy() {
        try {
            unbindService(connection)
        } catch (_: Exception) {
        }
        super.onDestroy()
    }

    companion object {
        private const val TAG = "StreamCasterHub"
    }
}
