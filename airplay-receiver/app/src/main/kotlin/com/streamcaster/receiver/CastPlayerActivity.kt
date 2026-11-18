package com.streamcaster.receiver

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.KeyEvent
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.MimeTypes
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.io.File

/**
 * Plays media pushed by the StreamCaster sender (URL cast, file, HLS).
 * WebRTC screen/camera mirroring is intentionally not handled here; AirPlay
 * covers mirroring on this device.
 */
@androidx.annotation.OptIn(androidx.media3.common.util.UnstableApi::class)
class CastPlayerActivity : ComponentActivity() {

    private lateinit var player: ExoPlayer
    private var currentUrl: String = ""
    private var currentTitle: String = ""
    private var currentMime: String = ""
    private var subtitleConfig: MediaItem.SubtitleConfiguration? = null
    private var playbackError: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowInsetsControllerCompat(window, window.decorView).apply {
            hide(WindowInsetsCompat.Type.systemBars())
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }

        player = ExoPlayer.Builder(this).build().apply {
            setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(C.USAGE_MEDIA)
                    .setContentType(C.AUDIO_CONTENT_TYPE_MOVIE)
                    .build(),
                true,
            )
            setHandleAudioBecomingNoisy(true)
            addListener(object : Player.Listener {
                override fun onIsPlayingChanged(isPlaying: Boolean) = sendState()
                override fun onPlaybackStateChanged(playbackState: Int) = sendState()
                override fun onPlayerError(error: PlaybackException) {
                    playbackError = error.errorCodeName
                    sendState()
                }
            })
        }

        val url = intent.getStringExtra(EXTRA_URL).orEmpty()
        val title = intent.getStringExtra(EXTRA_TITLE).orEmpty()
        val mime = intent.getStringExtra(EXTRA_MIME).orEmpty()
        if (url.isNotBlank()) loadMedia(url, title, mime)

        startCommandCollection()
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                while (true) {
                    sendState()
                    delay(1_000)
                }
            }
        }

        setContent {
            StreamCasterTheme {
                PlayerScreen(player = player, title = currentTitle, error = playbackError)
            }
        }
    }

    private fun startCommandCollection() {
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                StreamCasterSession.commands.collect { op -> handleCommand(op) }
            }
        }
    }

    private fun handleCommand(op: JSONObject) {
        when (op.optString("name")) {
            "load" -> {
                val url = op.optString("url")
                if (url.isNotBlank()) {
                    loadMedia(url, op.optString("title"), op.optString("mime"))
                }
            }
            "play" -> player.play()
            "pause" -> player.pause()
            "seek" -> player.seekTo((op.optDouble("time", 0.0) * 1000).toLong().coerceAtLeast(0))
            "volume" -> player.volume = op.optDouble("value", 1.0).toFloat().coerceIn(0f, 1f)
            "stop" -> finish()
            "subtitle" -> {
                val url = op.optString("url")
                val content = op.optString("content")
                val label = op.optString("label", "Untertitel")
                applySubtitle(url, content, label)
            }
            "file-meta" -> Unit
            "stream-start" -> {
                StreamCasterSession.setNotice("WebRTC-Mirroring wird noch nicht unterstützt – nutze AirPlay.")
            }
            "stream-stop" -> Unit
        }
    }

    private fun loadMedia(url: String, title: String, mime: String) {
        currentUrl = url
        currentTitle = title
        currentMime = mime
        playbackError = null
        player.setMediaItem(buildItem(), 0L)
        player.prepare()
        player.playWhenReady = true
    }

    private fun buildItem(): MediaItem {
        val builder = MediaItem.Builder()
            .setUri(currentUrl)
            .setMediaMetadata(MediaMetadata.Builder().setTitle(currentTitle).build())
        val effectiveMime = when {
            currentMime.isNotBlank() -> currentMime
            currentUrl.contains("m3u8", ignoreCase = true) -> MimeTypes.APPLICATION_M3U8
            else -> ""
        }
        if (effectiveMime.isNotBlank()) builder.setMimeType(effectiveMime)
        subtitleConfig?.let { builder.setSubtitleConfigurations(listOf(it)) }
        return builder.build()
    }

    private fun applySubtitle(url: String, content: String, label: String) {
        val uri: Uri = when {
            url.isNotBlank() -> Uri.parse(url)
            content.isNotBlank() -> {
                val file = File(cacheDir, "cast-subtitle-${content.hashCode()}.vtt")
                if (!file.exists()) file.writeText(content)
                Uri.fromFile(file)
            }
            else -> {
                subtitleConfig = null
                reloadCurrent()
                return
            }
        }
        subtitleConfig = MediaItem.SubtitleConfiguration.Builder(uri)
            .setMimeType(MimeTypes.TEXT_VTT)
            .setLabel(label)
            .setSelectionFlags(C.SELECTION_FLAG_DEFAULT)
            .build()
        reloadCurrent()
    }

    private fun reloadCurrent() {
        if (currentUrl.isBlank()) return
        val position = player.currentPosition.coerceAtLeast(0)
        val play = player.playWhenReady
        player.setMediaItem(buildItem(), position)
        player.prepare()
        player.playWhenReady = play
    }

    private fun sendState() {
        if (currentUrl.isBlank() || player.mediaItemCount == 0) return
        val state = JSONObject()
            .put("paused", !player.isPlaying)
            .put("position", player.currentPosition / 1000.0)
            .put("currentUrl", currentUrl)
            .put("title", currentTitle)
            .put("volume", player.volume.toDouble())
        val duration = player.duration
        if (duration != C.TIME_UNSET && duration > 0) state.put("duration", duration / 1000.0)
        StreamCasterSession.sendState(state)
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (event.action == KeyEvent.ACTION_DOWN) {
            when (event.keyCode) {
                KeyEvent.KEYCODE_DPAD_CENTER, KeyEvent.KEYCODE_ENTER,
                KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE, KeyEvent.KEYCODE_HEADSETHOOK -> {
                    if (player.isPlaying) player.pause() else player.play()
                    return true
                }
                KeyEvent.KEYCODE_DPAD_LEFT, KeyEvent.KEYCODE_MEDIA_REWIND -> {
                    player.seekTo((player.currentPosition - 10_000).coerceAtLeast(0))
                    return true
                }
                KeyEvent.KEYCODE_DPAD_RIGHT, KeyEvent.KEYCODE_MEDIA_FAST_FORWARD -> {
                    val duration = player.duration
                    val target = player.currentPosition + 10_000
                    player.seekTo(if (duration == C.TIME_UNSET) target else target.coerceAtMost(duration))
                    return true
                }
            }
        }
        return super.dispatchKeyEvent(event)
    }

    override fun onStop() {
        if (!isChangingConfigurations) {
            player.pause()
            sendState()
        }
        super.onStop()
    }

    override fun onDestroy() {
        player.release()
        super.onDestroy()
    }

    companion object {
        const val EXTRA_URL = "com.streamcaster.receiver.extra.URL"
        const val EXTRA_TITLE = "com.streamcaster.receiver.extra.TITLE"
        const val EXTRA_MIME = "com.streamcaster.receiver.extra.MIME"

        fun intent(context: Context, url: String, title: String?, mime: String?): Intent =
            Intent(context, CastPlayerActivity::class.java)
                .putExtra(EXTRA_URL, url)
                .putExtra(EXTRA_TITLE, title)
                .putExtra(EXTRA_MIME, mime)
    }
}
