/**
 * StreamCaster Receiver — Fullstack-architektur, Clean Architecture.
 *
 * Architecture roles:
 *   Controller  main.ts — DOM events, signal routing, UI state orchestration
 *   Service     player/player.ts — HLS / MP4 / WebRTC playback encapsulated
 *   Infra       webrtc/receive.ts — RTCPeerConnection + DataChannel file-transfer
 *   Infra       signaling.ts — SignalingClient wrapper
 *
 * Signal flow:
 *   Server → handleCommand → updateUI  (single source of truth)
 *   DOM events → command via signaling
 *
 * Works on ANY browser with WebRTC + HLS support:
 *   Fire TV (Silk), iPhone Safari (URL-cast only, no screen mirror),
 *   Android Chrome, Desktop Chrome/Edge.
 */

import {
  generateRoomCode,
  isValidRoomCode,
  normalizeRoomCode,
  type CommandOp,
  type PlaybackState,
  type ReceiverCaps,
  type ServerMessage,
  type SignalingStatus,
} from "@streamcaster/shared";
import { ReceiverClient } from "./signaling.js";
import { createPlayer, type ReceiverPlayer, type PlayerType } from "./player/player.js";
import { ReceiverPeer } from "./webrtc/receive.js";
import QRCode from "qrcode";

// ═══════════════════════════════════════════════════════════
//  § 1  Constants & env
// ═══════════════════════════════════════════════════════════

const SIGNALING_URL =
  (import.meta.env.VITE_SIGNALING_URL as string | undefined) ??
  (new URLSearchParams(location.search).get("ws") as string | undefined) ??
  "https://streamcaster-signaling.streamcaster.workers.dev";

const ICE_SERVERS = [{ urls: ["stun:stun.l.google.com:19302"] }];

// ═══════════════════════════════════════════════════════════
//  § 2  App state — single source of truth
// ═══════════════════════════════════════════════════════════

export interface AppState {
  signalingStatus: SignalingStatus;
  peerStatus: "none" | "waiting" | "connected";
  roomCode: string;
  /** Which surface is on screen: the idle card or the player. */
  phase: "idle" | "playing";
  playing: boolean;
  position: number;
  duration: number;
  volume: number;
  title: string;
  playerUrl: string;
}

const initialState: AppState = {
  signalingStatus: "closed",
  peerStatus: "none",
  roomCode: "",
  phase: "idle",
  playing: false,
  position: 0,
  duration: 0,
  volume: 1,
  title: "",
  playerUrl: "",
};

let state = { ...initialState };
let qrcodePromise: Promise<string> | null = null;
let signalingClient: ReceiverClient | null = null;
let receiverPeer: ReceiverPeer | null = null;
let player: ReceiverPlayer | null = null;
let toastTimer: ReturnType<typeof setTimeout> | null = null;
let toastEl: HTMLElement | null = null;

// ═══════════════════════════════════════════════════════════
//  § 3  DOM references — lazy (null until mounted)
// ═══════════════════════════════════════════════════════════

interface DomRefs {
  statusEl: HTMLElement;
  codeEl: HTMLElement;
  idleEl: HTMLElement;
  idleTitleEl: HTMLElement;
  idleUrlEl: HTMLElement;
  toastEl: HTMLElement;
  videoEl: HTMLVideoElement;
  seekContainerEl: HTMLElement;
  seekBarEl: HTMLInputElement;
  currentPosEl: HTMLElement;
  totalDurationEl: HTMLElement;
  volumeRowEl: HTMLElement;
  volumeBarEl: HTMLInputElement;
  volumeLabelEl: HTMLElement;
  playPauseOverlayEl: HTMLElement;
  playPauseIconEl: HTMLElement;
  controlsEl: HTMLElement;
  seekBackEl: HTMLButtonElement;
  seekFwdEl: HTMLButtonElement;
  connectBtnEl: HTMLButtonElement;
}

const DOM: DomRefs = {} as DomRefs;

/** Typed query: fails loudly at mount time instead of silently returning null. */
function q<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing DOM element #${id}`);
  return found as T;
}

function resolveDOM() {
  DOM.statusEl = q("status");
  DOM.codeEl = q("room-code");
  DOM.idleEl = q("idle");
  DOM.idleTitleEl = q("idle-title");
  DOM.idleUrlEl = q("idle-url");
  DOM.toastEl = q("toast");
  DOM.videoEl = q<HTMLVideoElement>("player");
  DOM.seekContainerEl = q("seek-container");
  DOM.seekBarEl = q<HTMLInputElement>("seek");
  DOM.currentPosEl = q("current-pos");
  DOM.totalDurationEl = q("total-duration");
  DOM.volumeRowEl = q("volume-row");
  DOM.volumeBarEl = q<HTMLInputElement>("volume");
  DOM.volumeLabelEl = q("volume-label");
  DOM.playPauseOverlayEl = q("play-pause-overlay");
  DOM.playPauseIconEl = q("play-pause-icon");
  DOM.controlsEl = q("controls");
  DOM.seekBackEl = q<HTMLButtonElement>("seek-back");
  DOM.seekFwdEl = q<HTMLButtonElement>("seek-forward");
  DOM.connectBtnEl = q<HTMLButtonElement>("connect-btn");
}

// ═══════════════════════════════════════════════════════════
//  § 4  Room code — parse, generate, persist
// ═══════════════════════════════════════════════════════════

function parseRoomCode() {
  const pathCode = normalizeRoomCode(
    location.pathname.replace(new RegExp(/^\/r\/.*/), "")
  );
  const queryCode = normalizeRoomCode(
    new URLSearchParams(location.search).get("code") ?? ""
  );

  if (isValidRoomCode(pathCode)) return pathCode;
  if (isValidRoomCode(queryCode)) return queryCode;
  return "";
}

function ensureRoomCode() {
  if (state.roomCode) return;
  state.roomCode = generateRoomCode();
  history.replaceState(
    null,
    "StreamCaster",
    `${location.pathname}/r/${state.roomCode}`
  );
}

// ═══════════════════════════════════════════════════════════
//  § 5  Helpers — toast, time, URL parsing
// ═══════════════════════════════════════════════════════════

function toast(message: string) {
  if (!DOM.toastEl) return;
  DOM.toastEl.textContent = message;
  DOM.toastEl.classList.add("visible");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => DOM.toastEl.classList.remove("visible"), 3500);
}

export function formatTime(seconds: number): string {
  const m = Math.floor(Math.abs(seconds) / 60);
  const s = Math.floor(Math.abs(seconds) % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function parseUrl(url: string) {
  try {
    const u = new URL(url);
    return {
      host: u.hostname.replace(/^www\./, ""),
      origin: u.origin,
      title: u.pathname.split("/").pop() ?? u.hostname,
    };
  } catch {
    return { host: url, origin: url, title: url };
  }
}

// ═══════════════════════════════════════════════════════════
//  § 6  Signaling — connect, handle messages
// ═══════════════════════════════════════════════════════════

async function connectSignaling() {
  const caps: ReceiverCaps = {
    rtc: typeof RTCPeerConnection !== "undefined",
    mse: typeof MediaSource !== "undefined",
    canPlay: {},
    userAgent: navigator.userAgent,
  };

  signalingClient = new ReceiverClient(SIGNALING_URL, {
    onMessage: handleMessage,
    onStatus: (s: SignalingStatus) => {
      state.signalingStatus = s;
      if (DOM.toastEl) DOM.toastEl.textContent = "";
      render();
    },
    onError: (err: Error) => {
      state.signalingStatus = "error";
      if (DOM.toastEl) toast(`Signal connection failed: ${err.message}`);
      render();
    },
  });

  signalingClient.connect(state.roomCode, "receiver", caps);
}

async function handleMessage(msg: ServerMessage) {
  switch (msg.t) {
    case "joined":
      state.peerStatus = "waiting";
      render();
      break;

    case "peer-joined":
      state.peerStatus = "connected";
      render();
      renderConnected();
      break;

    case "peer-left":
      state.peerStatus = "none";
      player?.stop();
      player = null;
      receiverPeer?.clear();
      receiverPeer = null;
      renderIdle("Sender left", "");
      break;

    case "cmd":
      handleCommand(msg.op);
      break;

    case "webrtc":
      // The mirror can arrive before any "load" command -> create the player.
      if (!player) player = createPlayer("webrtc", "", DOM.videoEl);
      // Reuse the peer: a fresh ReceiverPeer per message would drop the
      // connection every time an ICE candidate came in.
      if (!receiverPeer) {
        receiverPeer = new ReceiverPeer(
          player,
          (kind, payload) => signalingClient?.sendSignal(kind, payload),
          toast,
          (playing, position, duration) => {
            state.playing = playing;
            state.position = position;
            state.duration = duration;
            render();
          },
        );
      }
      void receiverPeer.handleSignal(msg.kind, msg.payload);
      break;

    case "state":
      updateRemoteState(msg.state);
      break;

    case "error":
      toast(`Signaling error: ${msg.message}`);
      break;

    default:
      // Unknown message — log for debugging
      break;
  }
}

function updateRemoteState(remote: PlaybackState) {
  if (remote.paused !== undefined) {
    state.playing = !remote.paused;
    if (state.playing) playPlayer();
    else pausePlayer();
  }
  if (remote.duration !== undefined) state.duration = remote.duration;
  if (remote.position !== undefined) {
    state.position = remote.position;
    updateSeekBar();
  }
  if (remote.volume !== undefined) {
    state.volume = remote.volume;
    DOM.volumeBarEl.value = (remote.volume * 100).toFixed(0);
    DOM.volumeLabelEl.textContent = `${Math.round(remote.volume * 100)}%`;
  }
  if (remote.title) state.title = remote.title;
  render();
}

// ═══════════════════════════════════════════════════════════
//  § 7  Command handler — bridge signaling → UI/player
// ═══════════════════════════════════════════════════════════

function handleCommand(op: CommandOp) {
  switch (op.name) {
    case "load":
      loadPlayer(op.url, op.title ?? parseUrl(op.url).title);
      break;

    case "play":
      playPlayer();
      break;

    case "pause":
      pausePlayer();
      break;

    case "seek":
      state.position = op.time;
      player?.seek(op.time);
      updateSeekBar();
      break;

    case "volume":
      state.volume = op.value;
      player?.volume(op.value);
      DOM.volumeBarEl.value = (op.value * 100).toFixed(0);
      DOM.volumeLabelEl.textContent = `${Math.round(op.value * 100)}%`;
      break;

    case "stop":
      stopPlayer();
      break;

    case "file-meta":
      // Handled by ReceiverPeer DataChannel
      break;

    case "stream-start":
      renderIdle(
        op.kind === "screen"
          ? "Screen Mirroring (live)"
          : "Camera Capture (live)",
        ""
      );
      break;

    case "stream-stop":
      stopPlayer();
      break;

    default:
      // Unknown command — ignore for now
      break;
  }
}

// ═══════════════════════════════════════════════════════════
//  § 8  Player factory & control
// ═══════════════════════════════════════════════════════════

async function loadPlayer(url: string, title: string) {
  state.title = title;
  state.playerUrl = url;

  // Drop the previous source before the new one is attached.
  player?.stop();
  player = null;

  DOM.videoEl.style.display = "block";
  DOM.playPauseOverlayEl.classList.remove("visible");

  try {
    // Determine type from URL
    const type: PlayerType =
      url.startsWith("ws") || url.startsWith("wss")
        ? "webrtc"
        : url.endsWith(".m3u8") || url.includes("/hls")
          ? "hls"
          : "mp4";

    player = createPlayer(type, url, DOM.videoEl);
    state.playing = true;
    renderPlaying();
    void player.playing();
  } catch (err: any) {
    toast(`Failed to load media: ${err.message}`);
    DOM.videoEl.style.display = "none";
    renderIdle("Media load failed", url);
  }
}

function playPlayer() {
  state.playing = true;
  if (player) player.playing();
}

function pausePlayer() {
  state.playing = false;
  if (player) player.pause();
}

function stopPlayer() {
  state.playing = false;
  player?.stop();
  player = null;
  DOM.videoEl.style.display = "none";
  DOM.playPauseOverlayEl.classList.remove("visible");
  DOM.seekContainerEl.style.display = "none";
  renderIdle("No video playing", "");
}

// ═══════════════════════════════════════════════════════════
//  § 9  Rendering — declarative UI from state
// ═══════════════════════════════════════════════════════════

function render() {
  const { signalingStatus, peerStatus } = state;

  // Status chip color
  DOM.statusEl.className = `chip ${
    signalingStatus === "closed" || signalingStatus === "error"
      ? "offline"
      : signalingStatus === "ws" || signalingStatus === "sse"
      ? "connected"
      : "waiting"
  }`;
  DOM.statusEl.textContent =
    peerStatus === "none"
      ? "Offline"
      : peerStatus === "waiting"
      ? "Waiting for sender…"
      : peerStatus === "connected"
      ? "Connected"
      : "";

  // Show/hide idle screen vs player. The phase decides — deriving it from
  // `state.title` broke as soon as an idle message carried a title
  // ("No video playing"), which kept the player surface on screen.
  const showIdle = peerStatus !== "connected" || state.phase === "idle";

  if (showIdle) {
    DOM.idleEl.style.display = "flex";
    DOM.videoEl.style.display = "none";
    DOM.seekContainerEl.style.display = "none";
    DOM.controlsEl.style.display = "none";
    DOM.playPauseOverlayEl.classList.remove("visible");
    DOM.idleTitleEl.textContent =
      peerStatus === "waiting"
        ? "Waiting for sender…"
        : peerStatus === "none"
        ? "StreamCaster Receiver"
        : state.title || "StreamCaster";
    DOM.idleUrlEl.textContent =
      peerStatus === "waiting"
        ? `Room: ${state.roomCode}`
        : peerStatus === "none"
        ? "Open the sender app on your phone and enter this code"
        : state.title || "";
  } else {
    DOM.idleEl.style.display = "none";
    DOM.videoEl.style.display = "block";
    DOM.seekContainerEl.style.display = "flex";
    DOM.controlsEl.style.display = "flex";
  }
}

function renderConnected() {
  DOM.idleEl.style.display = "flex";
  DOM.idleTitleEl.textContent = `Connected to room ${state.roomCode}`;
  DOM.idleUrlEl.textContent = `Room: ${state.roomCode}`;
  DOM.codeEl.textContent = state.roomCode;

  // QR Code generation (lazy)
  if (!qrcodePromise && DOM.codeEl) {
    qrcodePromise = QRCode.toDataURL(`streamcaster://${state.roomCode}`, {
      width: 150,
      margin: 1,
    });
    qrcodePromise.then(async (dataUrl) => {
      const img = document.createElement("img");
      img.src = dataUrl;
      img.style.opacity = "0";
      img.style.transition = "opacity 0.5s";
      DOM.codeEl.style.display = "block";
      DOM.codeEl.appendChild(img);
      setTimeout(() => { img.style.opacity = "1"; }, 50);
    });
  }
}

function renderPlaying() {
  state.phase = "playing";
  DOM.playPauseOverlayEl.classList.add("visible");
  DOM.playPauseIconEl.textContent = state.playing ? "⏸" : "▶";
  DOM.seekContainerEl.style.display = "flex";
  DOM.controlsEl.style.display = "flex";
  DOM.totalDurationEl.textContent = formatTime(state.duration);
  updateSeekBar();
  render();
}

function renderIdle(title: string, url: string) {
  state.phase = "idle";
  state.title = title;
  render();
}

// ═══════════════════════════════════════════════════════════
//  § 10  DOM event binding
// ═══════════════════════════════════════════════════════════

function bindEvents() {
  // Seek bar
  DOM.seekBarEl.addEventListener("input", (e) => {
    const bar = e.target as HTMLInputElement;
    const time = (Number(bar.value) / 100) * state.duration;
    state.position = time;
    updateSeekBar();
    player?.seek(time);
  });

  // Volume
  DOM.volumeBarEl.addEventListener("input", (e) => {
    const bar = e.target as HTMLInputElement;
    state.volume = Number(bar.value) / 100;
    DOM.volumeLabelEl.textContent = `${Math.round(state.volume * 100)}%`;
    player?.volume(state.volume);
  });

  // Play/Pause overlay
  DOM.playPauseOverlayEl.addEventListener("click", () => {
    if (state.playing) pausePlayer();
    else playPlayer();
  });

  // Quick seek buttons
  DOM.seekBackEl.addEventListener("click", () => {
    const newPos = Math.max(0, state.position - 10);
    state.position = newPos;
    player?.seek(newPos);
    updateSeekBar();
  });

  DOM.seekFwdEl.addEventListener("click", () => {
    const newPos = Math.min(state.duration, state.position + 10);
    state.position = newPos;
    player?.seek(newPos);
    updateSeekBar();
  });

  // Connect button (reconnect on error)
  DOM.connectBtnEl.addEventListener("click", () => {
    if (signalingClient) {
      toast("Reconnecting…");
      connectSignaling();
    }
  });

  // Touch gestures for mobile (tap left/right to seek ±30s)
  let touchStartX: number | null = null;
  DOM.videoEl.addEventListener("touchstart", (e) => {
    touchStartX = e.touches[0]?.clientX ?? null;
  }, { passive: true });

  DOM.videoEl.addEventListener("touchend", (e) => {
    if (touchStartX === null) return;
    const touchEndX = e.changedTouches[0]?.clientX ?? 0;
    const diff = touchEndX - touchStartX;

    if (Math.abs(diff) > 40) {
      if (diff > 0) {
        // Swipe right → forward
        player?.seek(Math.min(state.duration, state.position + 30));
        toast("⏎ +30s");
      } else {
        // Swipe left → backward
        player?.seek(Math.max(0, state.position - 30));
        toast("⏪ -30s");
      }
    }
    touchStartX = null;
  }, { passive: true });

  // Keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    if (state.peerStatus !== "connected") return;

    switch (e.key) {
      case "Space":
        e.preventDefault();
        if (state.playing) pausePlayer();
        else playPlayer();
        break;
      case "ArrowLeft":
        e.preventDefault();
        player?.seek(Math.max(0, state.position - 10));
        updateSeekBar();
        break;
      case "ArrowRight":
        e.preventDefault();
        player?.seek(Math.min(state.duration, state.position + 10));
        updateSeekBar();
        break;
      case "ArrowUp":
        e.preventDefault();
        state.volume = Math.min(1, state.volume + 0.1);
        DOM.volumeBarEl.value = (state.volume * 100).toFixed(0);
        DOM.volumeLabelEl.textContent = `${Math.round(state.volume * 100)}%`;
        player?.volume(state.volume);
        break;
      case "ArrowDown":
        e.preventDefault();
        state.volume = Math.max(0, state.volume - 0.1);
        DOM.volumeBarEl.value = (state.volume * 100).toFixed(0);
        DOM.volumeLabelEl.textContent = `${Math.round(state.volume * 100)}%`;
        player?.volume(state.volume);
        break;
    }
  });

  // Video container: track position updates
  DOM.videoEl.addEventListener("timeupdate", () => {
    const pos = DOM.videoEl.currentTime;
    if (pos > 0 && pos !== state.position) {
      state.position = pos;
      updateSeekBar();
    }
  });

  DOM.videoEl.addEventListener("loadedmetadata", () => {
    state.duration = DOM.videoEl.duration;
    DOM.totalDurationEl.textContent = formatTime(state.duration);
    updateSeekBar();
  });
}

function updateSeekBar() {
  if (state.duration === 0) return;
  DOM.seekBarEl.value = String(Math.round((state.position / state.duration) * 100));
  DOM.currentPosEl.textContent = formatTime(state.position);
}

// ═══════════════════════════════════════════════════════════
//  § 11  Initialization & graceful shutdown
// ═══════════════════════════════════════════════════════════

async function bootstrap(): Promise<void> {
  ensureRoomCode();
  resolveDOM();
  bindEvents();

  // Register Service Worker for PWA
  if ("serviceWorker" in navigator) {
    try {
      const registration = await navigator.serviceWorker.register(
        "/service-worker.js"
      );
      toast("StreamCaster app installed ✅");
    } catch {
      // SW registration failed — proceed normally
    }
  }

  // Initial render
  render();
  renderIdle("StreamCaster — open sender on another device", "");

  // Connect to signaling server
  try {
    await connectSignaling();
  } catch (err: any) {
    state.signalingStatus = "error";
    render();
    renderIdle(
      "Connection failed",
      "Cannot reach signaling server. Try again later."
    );
    throw err;
  }
}

// Global error handler
window.addEventListener("error", (e: ErrorEvent) => {
  console.error("[StreamCaster] Unhandled error:", e.error);
  toast(`Error: ${e.message}`);
});

// Unloading: clean up
window.addEventListener("beforeunload", () => {
  player?.stop();
  receiverPeer?.clear();
});

// ── Launch ──
bootstrap().catch((err) => {
  console.error("[StreamCaster] Bootstrap failed:", err);
  renderIdle("Failed to start", "");
});