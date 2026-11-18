package com.streamcaster.receiver

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject
import java.util.concurrent.TimeUnit
import kotlin.math.min

/**
 * Long-lived StreamCaster signaling connection.
 *
 * Protocol (see packages/shared/src/protocol.ts):
 *  - The WebSocket only carries a role after the client sends `{t:"join"}`.
 *  - The room can hold exactly one sender and one receiver.
 *  - Commands arrive as `{t:"cmd", op:{...}}`; playback state is sent back
 *    as `{t:"state", state:{...}}` and persisted by the Durable Object.
 *
 * The session survives activity switches (Hub <-> player), so a running cast
 * is not interrupted by opening the player or the AirPlay settings screen.
 */
object StreamCasterSession {

    private const val TAG = "StreamCasterSession"
    private const val HTTP_BASE = "https://streamcaster-signaling.streamcaster.workers.dev"
    private const val WS_URL = "wss://streamcaster-signaling.streamcaster.workers.dev/ws"
    private const val MAX_RECONNECT_DELAY_MS = 20_000L

    enum class Connection { IDLE, CONNECTING, CONNECTED, RECONNECTING, ERROR }

    data class Status(
        val code: String = "",
        val connection: Connection = Connection.IDLE,
        val peerConnected: Boolean = false,
        val message: String? = null,
    )

    private val _status = MutableStateFlow(Status())
    val status = _status.asStateFlow()

    /** Raw CommandOp payloads from the sender. */
    private val _commands = MutableSharedFlow<JSONObject>(extraBufferCapacity = 64)
    val commands = _commands.asSharedFlow()

    /** Friendlier messages for the TV overlay (unsupported WebRTC, errors, ...). */
    private val _notice = MutableStateFlow<String?>(null)
    val notice = _notice.asStateFlow()

    private val mainHandler = Handler(Looper.getMainLooper())
    private var client: OkHttpClient? = null
    private var socket: WebSocket? = null
    private var roomCode: String = ""
    private var started = false
    private var attempts = 0
    private var generation = 0
    private var holdReconnect = false

    fun start(context: Context) {
        if (started) return
        started = true
        _notice.value = null
        client = OkHttpClient.Builder()
            .pingInterval(20, TimeUnit.SECONDS)
            .connectTimeout(10, TimeUnit.SECONDS)
            .build()
        roomCode = RoomCode.generate()
        connect(context.applicationContext)
    }

    fun newCode() {
        val ctx = appContext ?: return
        generation++
        holdReconnect = false
        socket?.close(1000, "new room code")
        socket = null
        attempts = 0
        holdReconnect = false
        roomCode = RoomCode.generate()
        _status.value = Status(code = roomCode, connection = Connection.CONNECTING)
        _notice.value = null
        connect(ctx)
    }

    fun setNotice(message: String?) {
        _notice.value = message
    }

    fun sendState(state: JSONObject) {
        send(JSONObject().put("t", "state").put("state", state))
    }

    fun close() {
        started = false
        generation++
        mainHandler.removeCallbacksAndMessages(null)
        socket?.close(1000, "app closing")
        socket = null
        client?.dispatcher?.executorService?.shutdown()
        client = null
        appContext = null
        _status.value = Status(roomCode, Connection.IDLE)
    }

    private var appContext: Context? = null

    private fun connect(context: Context) {
        appContext = context
        val ok = client ?: return
        val myGeneration = generation
        _status.value = _status.value.copy(
            code = roomCode,
            connection = if (attempts == 0) Connection.CONNECTING else Connection.RECONNECTING,
            peerConnected = false,
        )

        val request = Request.Builder()
            .url("$WS_URL?code=$roomCode&role=receiver")
            .build()

        val listener = object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                if (myGeneration != generation) return
                Log.i(TAG, "signaling open for $roomCode")
                send(JSONObject()
                    .put("t", "join")
                    .put("role", "receiver")
                    .put("code", roomCode)
                    .put("caps", caps()))
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                if (myGeneration != generation) return
                handle(text)
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                if (myGeneration != generation || !started) return
                Log.w(TAG, "signaling failure", t)
                scheduleReconnect(context, myGeneration)
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                if (myGeneration != generation || !started) return
                scheduleReconnect(context, myGeneration)
            }
        }

        socket = ok.newWebSocket(request, listener)
    }

    private fun scheduleReconnect(context: Context, myGeneration: Int) {
        socket = null
        if (!started || myGeneration != generation || holdReconnect) return
        attempts++
        val delayMs = min(MAX_RECONNECT_DELAY_MS, 1_000L shl min(attempts - 1, 5))
        _status.value = _status.value.copy(
            connection = Connection.RECONNECTING,
            peerConnected = false,
            message = "Verbindung getrennt – neuer Versuch…",
        )
        mainHandler.postDelayed({
            if (started && myGeneration == generation) connect(context)
        }, delayMs)
    }

    private fun handle(text: String) {
        val msg = try {
            JSONObject(text)
        } catch (e: Exception) {
            Log.w(TAG, "bad message", e)
            return
        }
        when (msg.optString("t")) {
            "joined" -> {
                attempts = 0
                holdReconnect = false
                val peers = msg.optInt("peers", 1)
                _status.value = _status.value.copy(
                    connection = Connection.CONNECTED,
                    peerConnected = peers > 1,
                    message = null,
                )
            }
            "peer-joined" -> {
                if (msg.optString("role") == "sender") {
                    _status.value = _status.value.copy(
                        connection = Connection.CONNECTED,
                        peerConnected = true,
                        message = null,
                    )
                    _notice.value = null
                }
            }
            "peer-left" -> {
                if (msg.optString("role") == "sender") {
                    _status.value = _status.value.copy(
                        peerConnected = false,
                        message = "Sender getrennt",
                    )
                }
            }
            "cmd" -> {
                val op = msg.optJSONObject("op") ?: return
                _commands.tryEmit(op)
            }
            "webrtc" -> {
                // The web sender negotiates screen/camera mirroring over WebRTC.
                // Native WebRTC decoding is not part of v1; AirPlay covers mirroring.
                _notice.value = "WebRTC-Mirroring wird von der TV-App noch nicht unterstützt – nutze AirPlay."
            }
            "error" -> {
                val code = msg.optString("code")
                val message = msg.optString("message", "Signaling-Fehler")
                _status.value = _status.value.copy(
                    connection = Connection.ERROR,
                    peerConnected = false,
                    message = message,
                )
                if (code == "role_taken") {
                    attempts = 0
                    holdReconnect = true
                    _notice.value = "Raum-Code belegt – tippe auf „Neuer Code“."
                }
            }
        }
    }

    private fun send(json: JSONObject): Boolean {
        val ws = socket ?: return false
        if (!ws.send(json.toString())) return false
        return true
    }

    private fun caps(): JSONObject = JSONObject()
        .put("rtc", false)
        .put("mse", true)
        .put("userAgent", "StreamCasterReceiver/1.0 (Android TV)")
        .put("canPlay", JSONObject()
            .put("video/mp4", "probably")
            .put("video/webm", "maybe")
            .put("application/vnd.apple.mpegurl", "probably")
            .put("application/x-mpegURL", "probably")
            .put("video/mp2t", "maybe"))
}
