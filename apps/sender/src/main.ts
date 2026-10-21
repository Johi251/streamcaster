/**
 * StreamCaster sender — entry point + UI state machine.
 * Flow: pair (code / #join= deep link) -> connected view with sources
 * (URL cast, extract-from-page, local file, screen mirror, camera) + remote.
 * Transport arbitration: Chromecast (when available) vs receiver page.
 */
import {
  SignalingClient,
  isValidRoomCode,
  normalizeRoomCode,
  type PlaybackState,
  type ReceiverCaps,
  type ServerMessage,
  type SignalingStatus,
} from "@streamcaster/shared";
import { describeCaps, type RemoteState } from "./transport/cast.js";
import { CastCommands } from "./transport/cast.js";
import { RemoteTransport } from "./transport/remote.js";
import { ChromecastSender } from "./cast/chromecast.js";
import { SenderPeer } from "./transport/webrtc.js";
import { sendFile } from "./transport/file.js";
import { canMirror, captureCamera, captureScreen } from "./capture/capture.js";
import { extractBest, type ExtractResult } from "./extract/useExtract.js";
import { probeMedia } from "./extract/probe.js";

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
let transport: RemoteTransport | null = null;
let cc: ChromecastSender | null = null;
let castAvail = false;
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

function updateRemoteState(s: RemoteState): void {
  remote = s;
  const seek = document.getElementById("seek") as HTMLInputElement | null;
  if (seek && remote.duration && remote.position !== undefined) {
    seek.value = String(Math.round((remote.position / remote.duration) * 1000));
  }
}

function renderConnected(): void {
  connChip.textContent = "connected";
  connChip.className = "chip on";

  const targetChip = el("div", {
    class: "chip",
    id: "target-chip",
    style: "margin-left:8px",
  }, "target: receiver page");

  const mirrorBtn = el("button", { id: "mirror-btn" }, "Mirror screen");
  if (!canMirror()) {
    mirrorBtn.disabled = true;
    mirrorBtn.title = "Screen capture not available in this browser (iOS Safari limitation).";
  }

  const cameraBtn = el("button", { id: "camera-btn" }, "Camera");
  const fileBtn = el("button", { id: "file-btn" }, "Send local file");
  const urlInput = el("input", {
    type: "url",
    placeholder: "https://…/video.mp4 or .m3u8 — or paste any page URL",
    id: "url-input",
  }) as HTMLInputElement;
  const castUrlBtn = el("button", { class: "primary", id: "cast-url-btn" }, "Cast URL");
  const extractBtn = el("button", { id: "extract-btn" }, "Extract from page");
  const candidateList = el("div", { id: "candidates" });
  const stopBtn = el("button", { class: "danger", id: "stop-btn" }, "Stop");
  const playBtn = el("button", { id: "play-btn" }, "▶ Play");
  const pauseBtn = el("button", { id: "pause-btn" }, "⏸ Pause");
  const seek = el("input", { type: "range", min: "0", max: "1000", value: "0", id: "seek" }) as HTMLInputElement;
  const vol = el("input", { type: "range", min: "0", max: "100", value: "100", id: "vol" }) as HTMLInputElement;
  const now = el("div", { class: "now-title", id: "now-title" }, "Nothing playing");
  const subBtn = el("button", { id: "sub-btn" }, "Subtitles (.vtt)");

  const refreshTargetChip = (): void => {
    targetChip.textContent = "target: " + (transport?.target === "chromecast" ? "Chromecast" : "receiver page");
  };
  const syncMirrorCamera = (): void => {
    const streaming = transport?.castActive ?? false;
    mirrorBtn.disabled = !canMirror() || streaming;
    cameraBtn.disabled = streaming;
    mirrorBtn.title = streaming
      ? "Not available during a Chromecast session."
      : mirrorBtn.disabled
        ? "Screen capture not available in this browser (iOS Safari limitation)."
        : "";
  };

  seek.addEventListener("input", () => {
    if (remote.duration && transport) {
      transport.seek((Number(seek.value) / 1000) * remote.duration);
    }
  });
  vol.addEventListener("change", () => transport?.volume(Number(vol.value) / 100));
  playBtn.addEventListener("click", () => transport?.play());
  pauseBtn.addEventListener("click", () => transport?.pause());
  stopBtn.addEventListener("click", () => {
    transport?.stop();
    peer?.stop();
    peer = null;
    now.textContent = "Nothing playing";
  });
  castUrlBtn.addEventListener("click", () => void castUrl(urlInput.value.trim(), now));
  extractBtn.addEventListener("click", () => void runExtract(urlInput.value.trim(), candidateList, now));
  fileBtn.addEventListener("click", () => void pickAndSendFile(now));
  subBtn.addEventListener("click", () => void pickSubtitle());
  mirrorBtn.addEventListener("click", () => void startStreaming("screen", now));
  cameraBtn.addEventListener("click", () => void startStreaming("camera", now));

  const castBtn = castAvail
    ? el("button", { id: "cast-chromecast-btn", class: "primary" }, "📺 Cast to Chromecast")
    : null;
  castBtn?.addEventListener("click", () => {
    void (async () => {
      if (!cc) return;
      setStatus("Opening Chromecast picker…");
      const started = await cc.requestSession();
      if (started && transport) {
        transport.castActive = true;
        refreshTargetChip();
        syncMirrorCamera();
        setStatus("Casting to Chromecast.");
      } else {
        setStatus("No Chromecast selected.", true);
      }
    })();
  });

  const capsNote = describeCaps(receiverCaps);
  const capCard = capsNote ? [el("p", { class: "sub" }, capsNote)] : [];

  const castCard = el(
    "div",
    { class: "card" },
    el("h2", {}, "Cast a video"),
    el("p", { class: "sub" }, "Direct link to an mp4 or HLS stream — or paste any web page and extract the video from it."),
    urlInput,
    el("div", { class: "row" }, castUrlBtn, extractBtn),
    candidateList,
    ...capCard
  );

  if (castBtn) {
    castCard.append(
      el("p", { class: "sub" }, "Or cast natively to a Chromecast on your network:"),
      el("div", { class: "row" }, castBtn)
    );
  }

  view.replaceChildren(
    castCard,
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
      el("div", { class: "row" }, targetChip),
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
    commands = null;
    transport = null;
    peer?.stop();
    peer = null;
    connected = false;
    renderHome();
  });

  refreshTargetChip();
  syncMirrorCamera();
}

// ------------------------------------------------------------------ actions

async function castUrl(rawUrl: string, now: HTMLElement): Promise<void> {
  if (!rawUrl) return;
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    setStatus("That is not a valid URL.", true);
    return;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    setStatus("Only http(s) URLs are supported.", true);
    return;
  }

  // Looks like a page (no media extension) → extract automatically.
  if (!/\.(m3u8|mp4|webm|mpd|mov|m4v)(\?|#|$)/i.test(url.pathname) && !/\/hls\?url=|\/seg\?url=/.test(rawUrl)) {
    const results = await runExtract(rawUrl, document.getElementById("candidates") ?? el("div"), now);
    if (results.length === 0) setStatus("No video found on that page — try a direct media URL.", true);
    return;
  }

  setStatus("Probing media…");
  let mime: string | undefined = undefined;
  try {
    const probe = await probeMedia(rawUrl);
    if (probe.playable === "unsupported") {
      setStatus("DASH/DRM streams are not supported.", true);
      return;
    }
    mime = probe.mime || mime;
    transport?.load(probe.castUrl, undefined, probe.mime || undefined);
    now.textContent = probe.playable === "hls" && probe.castUrl !== rawUrl ? rawUrl + " (via proxy)" : rawUrl;
    setStatus("Sent to receiver.");
    return;
  } catch {
    // probe failed — fall back to extension heuristic
  }
  mime = /\.m3u8(\?|$)/i.test(rawUrl) ? "application/vnd.apple.mpegurl" : undefined;
  transport?.load(rawUrl, undefined, mime);
  now.textContent = rawUrl;
  setStatus("Sent to receiver.");
}

async function runExtract(pageUrl: string, listEl: HTMLElement, now: HTMLElement): Promise<ExtractResult[]> {
  if (!pageUrl) return [];
  setStatus("Extracting videos from page…");
  listEl.replaceChildren();
  let results: ExtractResult[] = [];
  try {
    results = await extractBest(pageUrl);
  } catch (e) {
    setStatus("Extraction failed: " + String(e), true);
    return [];
  }
  if (results.length === 0) {
    setStatus("No playable video found on that page.", true);
    return [];
  }
  for (const [i, r] of results.entries()) {
    const kind = r.probe.playable === "hls" ? "HLS" : "mp4";
    const via = r.probe.castUrl !== r.probe.url ? " · via proxy" : "";
    const btn = el(
      "button",
      { class: "candidate", style: "display:block;width:100%;margin:4px 0;text-align:left" },
      `${kind} · ${r.label}${via} — ${r.probe.url.length > 70 ? r.probe.url.slice(0, 70) + "…" : r.probe.url}`
    );
    btn.addEventListener("click", () => {
      transport?.load(r.probe.castUrl, undefined, r.probe.mime || undefined);
      now.textContent = r.probe.url;
      setStatus("Sent to receiver.");
    });
    listEl.append(btn);
    if (i === 0 && results.length === 1) {
      // Single candidate: cast immediately.
      transport?.load(r.probe.castUrl, undefined, r.probe.mime || undefined);
      now.textContent = r.probe.url;
      setStatus("Found one video — sent to receiver.");
    }
  }
  return results;
}

async function startStreaming(kind: "screen" | "camera", now: HTMLElement): Promise<void> {
  if (transport?.castActive) {
    setStatus("Live streaming is not available during a Chromecast session — use the receiver page target.", true);
    return;
  }
  try {
    setStatus("Starting " + kind + "…");
    const stream = kind === "screen" ? await captureScreen() : await captureCamera();
    peer = new SenderPeer(
      (k, p) => client?.send({ t: "webrtc", kind: k as "offer" | "ice", payload: p }),
      () => setStatus("WebRTC connection failed — make sure the receiver supports WebRTC or both devices are on the same Wi-Fi.", true)
    );
    peer.startStream(stream).catch((e) => setStatus("Stream failed: " + String(e), true));
    transport?.streamStart(kind);
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
      transport?.fileMeta(file.name, file.size, file.type || "video/mp4");
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
    if (transport?.castActive) {
      setStatus("Subtitles are not supported on Chromecast in v1.", true);
      return;
    }
    const content = await file.text();
    transport?.subtitle(content, file.name.replace(/\.vtt$/i, ""));
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
  transport = new RemoteTransport(commands, cc);
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
    case "state":
      updateRemoteState({
        paused: msg.state.paused,
        position: msg.state.position,
        duration: msg.state.duration,
        title: msg.state.title,
      });
      break;
    case "webrtc":
      // answer + ICE candidates from the receiver peer
      void peer?.handleSignal(msg.kind, msg.payload);
      break;
    case "error":
      setStatus(msg.message, true);
      break;
    default:
      break;
  }
}

// ---------------------------------------------------------------------- boot

void (async () => {
  cc = new ChromecastSender();
  castAvail = await cc.detect();
  if (castAvail) {
    try {
      cc.init();
      cc.onState(updateRemoteState);
    } catch {
      castAvail = false; // framework present but broken — fall back gracefully
    }
  }
  // Detection may finish after the user already connected — refresh the UI.
  if (connected) renderConnected();
})();

const hash = location.hash.match(/join=([0-9A-Za-z]+)/);
renderHome(hash ? normalizeRoomCode(hash[1]!) : "");
