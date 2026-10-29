/**
 * StreamCaster receiver entry point.
 * URL shape: /r/?code=<ROOMCODE> (a /r/<ROOMCODE> path segment is still read
 * for older links). The query form is the canonical one because it needs no
 * server-side rewrite: Cloudflare Pages serves /r/ as a real file, while
 * /r/<CODE> is not a file and falls through to the sender app on the host we
 * deploy to — a reload there would silently swap the TV into the phone UI.
 * Displays code + QR, connects to signaling, executes sender commands.
 */
import {
  SignalingClient,
  probeCapabilities,
  isValidRoomCode,
  normalizeRoomCode,
  generateRoomCode,
  type CommandOp,
  type ServerMessage,
  type PlaybackState,
} from "@streamcaster/shared";
import QRCode from "qrcode";
import { ReceiverPlayer } from "./player/player.js";
import { ReceiverPeer, type FileMeta } from "./webrtc/receive.js";

// --------------------------------------------------------------------- boot

const params = new URLSearchParams(location.search);
const pathCode = normalizeRoomCode(location.pathname.split("/").pop() ?? "");
const queryCode = normalizeRoomCode(params.get("code") ?? "");
let code = isValidRoomCode(pathCode) ? pathCode : isValidRoomCode(queryCode) ? queryCode : "";

const SIGNALING_URL =
  (import.meta.env.VITE_SIGNALING_URL as string | undefined) ??
  (params.get("ws") as string | undefined) ??
  "https://streamcaster-signaling.streamcaster.workers.dev";

const video = document.getElementById("player") as HTMLVideoElement;
const idle = document.getElementById("idle") as HTMLDivElement;
const statusEl = document.getElementById("status") as HTMLParagraphElement;
const codeEl = document.getElementById("room-code") as HTMLDivElement;
const qrEl = document.getElementById("qr") as HTMLDivElement;
const toastEl = document.getElementById("toast") as HTMLDivElement;

// Session state — declared BEFORE the boot block below, because start()
// (invoked synchronously during module evaluation) assigns `client`.
let client: SignalingClient | null = null;
let peer: ReceiverPeer | null = null;

let toastTimer: ReturnType<typeof setTimeout> | null = null;
function toast(msg: string): void {
  toastEl.textContent = msg;
  toastEl.classList.remove("hidden");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.add("hidden"), 4000);
}

if (!code) {
  // No code in URL → the receiver generates its own room code, displays it,
  // and connects. This is the normal flow when you open /r/ directly on a TV
  // browser (Fire TV Silk, Smart TV browser, Echo Show, etc.): you read the
  // code off the screen and type it into the sender on your phone.
  code = generateRoomCode();
  // Reflect the code in the URL so a page reload restores the same room
  // (instead of generating a new code and orphaning the sender). Query form:
  // /r/?code=XXXXXX always resolves to the real r/index.html file.
  history.replaceState(null, "", `./?code=${code}`);
}
codeEl.textContent = code;
void renderQr(code);
start();

async function renderQr(code: string): Promise<void> {
  const senderUrl = `${location.origin}/#join=${code}`;
  const canvas = document.createElement("canvas");
  await QRCode.toCanvas(canvas, senderUrl, { width: 180, margin: 0 });
  qrEl.replaceChildren(canvas);
}

// ------------------------------------------------------------------ session

const state: PlaybackState = {};
let stateDirty = false;

const player = new ReceiverPlayer(
  video,
  (playing, position, duration) => {
    state.paused = !playing;
    state.position = position;
    state.duration = duration || state.duration;
    stateDirty = true;
  },
  toast
);

// Periodic state push (receiver -> sender remote UI)
setInterval(() => {
  if (!stateDirty || !client) return;
  stateDirty = false;
  client.send({ t: "state", state });
}, 1000);

function sendSignal(kind: "answer" | "ice", payload: unknown): void {
  client?.send({ t: "webrtc", kind, payload });
}

function start(): void {
  client = new SignalingClient(SIGNALING_URL, {
    onMessage: handleMessage,
    onStatus: (s) => {
      if (s === "sse") statusEl.textContent = "Connected (compatibility mode)";
      else if (s === "ws") statusEl.textContent = "Connected";
      else if (s === "closed" || s === "error") statusEl.textContent = "Disconnected";
    },
  });
  client.connect(code, "receiver", probeCapabilities());
}

function handleMessage(msg: ServerMessage): void {
  switch (msg.t) {
    case "joined":
      statusEl.textContent = "Waiting for sender…";
      break;
    case "peer-joined":
      statusEl.textContent = "Sender connected";
      break;
    case "peer-left":
      statusEl.textContent = "Sender disconnected";
      break;
    case "cmd":
      void execute(msg.op);
      break;
    case "webrtc":
      peer ??= new ReceiverPeer(player, sendSignal, toast, (playing, position, duration) => {
        state.paused = !playing;
        state.position = position;
        state.duration = duration || state.duration;
        stateDirty = true;
      });
      void peer.handleSignal(msg.kind, msg.payload);
      break;
    case "state":
      // sender-acknowledged state (unused on receiver side for now)
      break;
    case "error":
      toast(`Signaling error: ${msg.message}`);
      break;
  }
}

async function execute(op: CommandOp): Promise<void> {
  switch (op.name) {
    case "load":
      state.currentUrl = op.url;
      state.title = op.title;
      idle.classList.add("hidden");
      await player.load(op.url, op.mime);
      break;
    case "play":
      player.play();
      break;
    case "pause":
      player.pause();
      break;
    case "seek":
      player.seek(op.time);
      break;
    case "volume":
      player.setVolume(op.value);
      break;
    case "stop":
      state.currentUrl = undefined;
      player.stop();
      peer?.close();
      idle.classList.remove("hidden");
      break;
    case "subtitle":
      if (op.content) player.addSubtitle(op.content, op.label ?? "Subtitles");
      else if (op.url) player.addSubtitleUrl(op.url, op.label ?? "Subtitles");
      break;
    case "file-meta":
      peer ??= new ReceiverPeer(player, sendSignal, toast, (playing, position, duration) => {
        state.paused = !playing;
        state.position = position;
        state.duration = duration || state.duration;
        stateDirty = true;
      });
      peer.setFileMeta({ name: op.filename, size: op.size, mime: op.mime } satisfies FileMeta);
      break;
    case "stream-start":
      idle.classList.add("hidden");
      toast(`Receiving ${op.kind} stream…`);
      break;
    case "stream-stop":
      player.stop();
      idle.classList.remove("hidden");
      break;
  }
}
