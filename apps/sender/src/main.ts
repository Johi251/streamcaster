/**
 * StreamCaster sender — entry point + UI state machine.
 * Flow: pair (code / #join= deep link) -> connected view with sources
 * (URL cast, local file, screen mirror, camera) + remote control.
 */
import {
  SignalingClient,
  isValidRoomCode,
  normalizeRoomCode,
  probeCapabilities,
  type PlaybackState,
  type ReceiverCaps,
  type ServerMessage,
  type SignalingStatus,
} from "@streamcaster/shared";
import { CastCommands, describeCaps, type RemoteState } from "./transport/cast.js";
import { SenderPeer } from "./transport/webrtc.js";
import { sendFile } from "./transport/file.js";
import { canCamera, canMirror, captureCamera, captureScreen } from "./capture/capture.js";

const SIGNALING_URL =
  (import.meta.env.VITE_SIGNALING_URL as string | undefined) ??
  (new URLSearchParams(location.search).get("ws") as string | undefined) ??
  "https://streamcaster-signaling.johan.workers.dev";

// ------------------------------------------------------------------- elements

const view = document.getElementById("view") as HTMLElement;
const connChip = document.getElementById("conn-status") as HTMLElement;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  for (const c of children) node.append(c);
  return node;
}

function setStatus(text: string, isError = false): void {
  statusMsg.textContent = text;
  statusMsg.classList.toggle("err", isError);
}

// ------------------------------------------------------------------- app state

let client: SignalingClient | null = null;
let commands: CastCommands | null = null;
let peer: SenderPeer | null = null;
let code = "";
let receiverCaps: ReceiverCaps | undefined;
let remote: RemoteState = {};
let connected = false;

const statusMsg = el("div", { class: "status-msg" });

// --------------------------------------------------------------------- router

function renderHome(prefill = ""): void {
  connChip.textContent = "offline";
  connChip.className = "chip";

  view.replaceChildren(
    el(
      "div",
      { class: "card" },
      el("h2", {}, "Pair with your TV"),
      el("p", { class: "sub" }, "Open streamcaster receiver on your TV browser, then enter the 6-character code it shows."),
      el("input", {
        class: "code",
        type: "text",
        inputmode: "latin",
        maxlength: "6",
        placeholder: "······",
        id: "code-input",
        value: prefill,
        autocomplete: "off",
        autocorrect: "off",
        autocapitalize: "characters",
      }),
      el(
        "div",
        { class: "row" },
        el("button", { class: "primary big", id: "connect-btn" }, "Connect")
      ),
      statusMsg
    ),
    el(
      "div",
      { class: "card" },
      el("h2", {}, "No receiver open yet?"),
      el("p", { class: "sub" }, "On your TV, Fire Stick (Silk browser), Echo Show or any browser, open:"),
      el(
        "p",
        { style: "word-break: break-all; font-size: 13px; color: var(--accent-2);" },
        location.origin + "/r/"
      ),
      el(
        "p",
        { class: "sub" },
        "It shows a code and a QR. Scan the QR with your phone camera to skip typing."
      )
    )
  );

  const input = document.getElementById("code-input") as HTMLInputElement;
  const btn = document.getElementById("connect-btn") as HTMLButtonElement;

  const tryConnect = (): void => {
    const c = normalizeRoomCode(input.value);
    if (!isValidRoomCode(c)) {
      setStatus("Code must be 6 characters (A–Z, 2–9).", true);
      return;
    }
    connect(c);
  };

  btn.addEventListener("click", tryConnect);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") tryConnect();
  });
  if (prefill && isValidRoomCode(normalizeRoomCode(prefill))) connect(normalizeRoomCode(prefill));
}

function renderConnected(): void {
  connChip.textContent = "connected";
  connChip.className = "chip on";

  const mirrorBtn = el("button", { id: "mirror-btn" }, "Mirror screen");
  if (!canMirror()) {
    mirrorBtn.disabled = true;
    mirrorBtn.title = "Screen capture not available in this browser (iOS Safari limitation).";
  }

  const cameraBtn = el("button", { id: "camera-btn" }, "Camera");
  const fileBtn = el("button", { id: "file-btn" }, "Send local file");
  const urlInput = el("input", {
    type: "url",
    placeholder: "https://…/video.mp4 or .m3u8",
    id: "url-input",
  }) as HTMLInputElement;
  const castUrlBtn = el("button", { class: "primary", id: "cast-url-btn" }, "Cast URL");
  const stopBtn = el("button", { class: "danger", id: "stop-btn" }, "Stop");
  const playBtn = el("button", { id: "play-btn" }, "▶ Play");
  const pauseBtn = el("button", { id: "pause-btn" }, "⏸ Pause");
  const seek = el("input", { type: "range", min: "0", max: "1000", value: "0", id: "seek" }) as HTMLInputElement;
  const vol = el("input", { type: "range", min: "0", max: "100", value: "100", id: "vol" }) as HTMLInputElement;
  const now = el("div", { class: "now-title", id: "now-title" }, "Nothing playing");
  const subBtn = el("button", { id: "sub-btn" }, "Subtitles (.vtt)");

  seek.addEventListener("input", () => {
    if (remote.duration && commands) {
      commands.seek((Number(seek.value) / 1000) * remote.duration);
    }
  });
  vol.addEventListener("change", () => commands?.volume(Number(vol.value) / 100));
  playBtn.addEventListener("click", () => commands?.play());
  pauseBtn.addEventListener("click", () => commands?.pause());
  stopBtn.addEventListener("click", () => {
    commands?.stop();
    peer?.stop();
    peer = null;
    now.textContent = "Nothing playing";
  });
  castUrlBtn.addEventListener("click", () => {
    const url = urlInput.value.trim();
    if (!url) return;
    try {
      new URL(url);
    } catch {
      setStatus("That is not a valid URL.", true);
      return;
    }
    const mime = /\.m3u8(\?|$)/i.test(url) ? "application/vnd.apple.mpegurl" : undefined;
    commands?.load(url, undefined, mime);
    now.textContent = url;
    setStatus("Sent to receiver.");
  });
  fileBtn.addEventListener("click", () => void pickAndSendFile(now));
  subBtn.addEventListener("click", () => void pickSubtitle());
  mirrorBtn.addEventListener("click", () => void startStreaming("screen", now));
  cameraBtn.addEventListener("click", () => void startStreaming("camera", now));

  const capsNote = describeCaps(receiverCaps);
  const capCard = capsNote
    ? [el("p", { class: "sub" }, capsNote)]
    : [];

  view.replaceChildren(
    el(
      "div",
      { class: "card" },
      el("h2", {}, "Cast a video"),
      el("p", { class: "sub" }, "Direct link to an mp4 or HLS stream. Plays on the receiver — your phone is free."),
      urlInput,
      el("div", { class: "row" }, castUrlBtn),
      ...capCard
    ),
    el(
      "div",
      { class: "card" },
      el("h2", {}, "Sources"),
      el("p", { class: "sub" }, "Local files travel over your Wi-Fi (WebRTC). Screen mirroring needs Android/desktop Chrome."),
      el("div", { class: "actions" }, fileBtn, mirrorBtn, cameraBtn, subBtn)
    ),
    el(
      "div",
      { class: "card" },
      el("h2", {}, "Remote"),
      now,
      el("div", { class: "remote" }, seek),
      el("div", { class: "row" }, playBtn, pauseBtn),
      el("div", { class: "row" }, stopBtn),
      el("p", { class: "sub" }, "Volume"),
      vol,
      statusMsg
    ),
    el("div", { class: "row" }, el("button", { id: "disconnect-btn" }, "Disconnect"))
  );

  (document.getElementById("disconnect-btn") as HTMLButtonElement).addEventListener("click", () => {
    client?.close();
    client = null;
    peer?.stop();
    peer = null;
    connected = false;
    renderHome();
  });
}

// ------------------------------------------------------------------ actions

async function startStreaming(kind: "screen" | "camera", now: HTMLElement): Promise<void> {
  try {
    setStatus("Starting " + kind + "…");
    const stream = kind === "screen" ? await captureScreen() : await captureCamera();
    peer = new SenderPeer(
      (k, p) => client?.send({ t: "webrtc", kind: k as "offer" | "ice", payload: p }),
      () => setStatus("WebRTC connection failed — make sure the receiver supports WebRTC or both devices are on the same Wi-Fi.", true)
    );
    peer.startStream(stream).catch((e) => setStatus("Stream failed: " + String(e), true));
    commands?.streamStart(kind);
    now.textContent = kind === "screen" ? "Screen mirroring (live)" : "Camera (live)";
    setStatus("Negotiating stream… (best on same Wi-Fi)");
  } catch (e) {
    setStatus("Capture failed: " + String(e), true);
  }
}

async function pickAndSendFile(now: HTMLElement): Promise<void> {
  const picker = document.getElementById("hidden-file") as HTMLInputElement;
  picker.value = "";
  picker.click();
  picker.onchange = async () => {
    const file = picker.files?.[0];
    if (!file || !client) return;
    try {
      setStatus(`Sending ${file.name} (${(file.size / 1e6).toFixed(1)} MB)…`);
      peer = new SenderPeer(
        (k, p) => client?.send({ t: "webrtc", kind: k as "offer" | "ice", payload: p }),
        () => setStatus("WebRTC failed — local file transfer needs both devices on the same Wi-Fi.", true)
      );
      const dc = await peer.startDataChannel();
      commands?.fileMeta(file.name, file.size, file.type || "video/mp4");
      // small delay so file-meta lands before the first chunk
      await new Promise((r) => setTimeout(r, 150));
      await sendFile(dc, file, (sent, total) => {
        setStatus(`Sending ${file.name}: ${Math.round((sent / total) * 100)}%`);
      });
      now.textContent = file.name;
      setStatus("File sent — playing on receiver.");
    } catch (e) {
      setStatus("File transfer failed: " + String(e), true);
    }
  };
}

async function pickSubtitle(): Promise<void> {
  const picker = document.getElementById("hidden-sub") as HTMLInputElement;
  picker.value = "";
  picker.click();
  picker.onchange = async () => {
    const file = picker.files?.[0];
    if (!file || !commands) return;
    const content = await file.text();
    commands.subtitle(content, file.name.replace(/\.vtt$/i, ""));
    setStatus("Subtitles sent.");
  };
}

// ------------------------------------------------------------------ signaling

function connect(roomCode: string): void {
  code = roomCode;
  client = new SignalingClient(SIGNALING_URL, {
    onMessage: onMessage,
    onStatus: onStatus,
  });
  commands = new CastCommands(client);
  client.connect(code, "sender");
}

function onStatus(status: SignalingStatus): void {
  switch (status) {
    case "connecting":
      setStatus("Connecting…");
      connChip.textContent = "pairing";
      connChip.className = "chip warn";
      break;
    case "ws":
    case "sse":
      if (!connected) {
        connected = true;
        setStatus("");
        renderConnected();
      } else if (status === "sse") {
        setStatus("Connection degraded to compatibility mode — casting still works.", true);
      }
      break;
    case "closed":
      connChip.textContent = "offline";
      connChip.className = "chip";
      connected = false;
      break;
    case "error":
      setStatus("Connection error.", true);
      break;
  }
}

function onMessage(msg: ServerMessage): void {
  switch (msg.t) {
    case "joined":
      receiverCaps = msg.peerCaps;
      break;
    case "peer-joined":
      receiverCaps = msg.caps ?? receiverCaps;
      break;
    case "peer-left":
      setStatus("Receiver disconnected.", true);
      break;
    case "state": {
      const s: PlaybackState = msg.state;
      remote = { paused: s.paused, position: s.position, duration: s.duration, title: s.title };
      const seek = document.getElementById("seek") as HTMLInputElement | null;
      if (seek && remote.duration && remote.position !== undefined) {
        seek.value = String(Math.round((remote.position / remote.duration) * 1000));
      }
      break;
    }
    case "error":
      setStatus(msg.message, true);
      break;
    default:
      break;
  }
}

// ---------------------------------------------------------------------- boot

const hash = location.hash.match(/join=([0-9A-Za-z]+)/);
renderHome(hash ? normalizeRoomCode(hash[1]!) : "");
