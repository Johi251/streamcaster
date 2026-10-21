/**
 * Chromecast sender via Google's official Cast Web Sender SDK.
 * Detection-gated: the SDK only works in desktop/Android Chrome — on iOS
 * Safari/Firefox `detect()` resolves false and the UI hides the Cast button.
 *
 * Design notes:
 * - The cast_sender.js script is injected dynamically (nothing hardcoded in
 *   index.html), only after a UA gate passes.
 * - Remote state is mapped onto the same `RemoteState` shape used by the
 *   signaling transport, so the sender UI is transport-agnostic.
 * - `stream-*` operations are unsupported over Cast (tab capture is a
 *   different API) — main.ts disables mirror/camera while a Cast session
 *   is active.
 */

import type { CommandOp, PlaybackState } from "@streamcaster/shared";
import type { RemoteState } from "../transport/cast.js";

const CAST_SCRIPT_URL =
  "https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1";
const DETECT_TIMEOUT_MS = 5000;

export function castUaSupported(): boolean {
  const ua = navigator.userAgent;
  // Desktop or Android Chrome(-like). Excludes iOS (CriOS/FxiOS/EdgiOS use
  // WKWebView — no cast framework) and non-Chromium browsers.
  if (/iPhone|iPad|iPod/i.test(ua)) return false;
  if (!/Chrome\//.test(ua) || /Edg\//.test(ua) || /OPR\//.test(ua)) return false;
  return true;
}

export function mimeToCastType(mime?: string, url?: string): string {
  if (mime === "application/vnd.apple.mpegurl" || mime === "application/x-mpegurl") {
    return "application/x-mpegurl";
  }
  if (mime === "application/dash+xml") return "application/dash+xml";
  if (mime?.startsWith("video/")) return mime;
  if (mime === "audio/mpegurl") return "application/x-mpegurl";
  if (url && /\.m3u8(\?|#|$)/i.test(url)) return "application/x-mpegurl";
  if (url && /\.(webm)(\?|#|$)/i.test(url)) return "video/webm";
  return "video/mp4";
}

/** Pure op -> cast-intent mapping (unit-tested). */
export type CastIntent =
  | { kind: "load"; url: string; contentType: string; title?: string }
  | { kind: "play" }
  | { kind: "pause" }
  | { kind: "seek"; time: number }
  | { kind: "volume"; level: number }
  | { kind: "mute"; muted: boolean }
  | { kind: "stop" }
  | { kind: "unsupported"; reason: string };

export function toCastIntent(op: CommandOp): CastIntent {
  switch (op.name) {
    case "load":
      return {
        kind: "load",
        url: op.url,
        contentType: mimeToCastType(op.mime, op.url),
        title: op.title,
      };
    case "play":
      return { kind: "play" };
    case "pause":
      return { kind: "pause" };
    case "seek":
      return { kind: "seek", time: op.time };
    case "volume":
      return op.value <= 0
        ? { kind: "mute", muted: true }
        : { kind: "volume", level: op.value };
    case "stop":
      return { kind: "stop" };
    case "subtitle":
      return { kind: "unsupported", reason: "Subtitles are not supported on Chromecast in v1." };
    case "file-meta":
    case "stream-start":
    case "stream-stop":
      return { kind: "unsupported", reason: "Local file and live streams need the receiver page." };
  }
}

export class ChromecastSender {
  private controller: cast.framework.RemotePlayerController | null = null;
  private player: cast.framework.RemotePlayer | null = null;
  private onStateCb: ((state: RemoteState) => void) | null = null;
  private onEndedCb: (() => void) | null = null;
  private sessionHandler: ((detail: { sessionState: cast.framework.SessionState }) => void) | null = null;

  /** True once `cast.framework` is actually available. */
  available = false;

  /**
   * UA gate + dynamic SDK injection. Resolves false when unsupported or when
   * the framework never shows up (offline, blocked by extension, etc.).
   */
  async detect(): Promise<boolean> {
    if (!castUaSupported()) return false;
    if (window.cast?.framework) {
      this.available = true;
      return true;
    }
    const ok = await new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), DETECT_TIMEOUT_MS);
      window.__onGCastApiAvailable = (available) => {
        clearTimeout(timer);
        resolve(available === true && !!window.cast?.framework);
      };
      const script = document.createElement("script");
      script.src = CAST_SCRIPT_URL;
      script.async = true;
      script.onerror = () => {
        clearTimeout(timer);
        resolve(false);
      };
      document.head.appendChild(script);
    });
    this.available = ok;
    return ok;
  }

  /** Register with the CastContext + start session/media listeners. */
  init(): void {
    if (!this.available) return;
    const fw = window.cast?.framework;
    if (!fw || !("CastContext" in fw)) return; // incomplete framework — click-time requestSession() will no-op gracefully
    const ctx = cast.framework.CastContext.getInstance();
    ctx.setOptions({
      receiverApplicationId: chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
      autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED,
    });

    this.player = new cast.framework.RemotePlayer();
    this.controller = new cast.framework.RemotePlayerController(this.player);

    this.sessionHandler = () => {
      if (ctx.getSessionState() === cast.framework.SessionState.SESSION_ENDED) {
        this.onStateCb?.({});
        this.onEndedCb?.();
      }
    };
    ctx.addEventListener("sessionstatechanged", this.sessionHandler);
  }

  onState(cb: (state: RemoteState) => void): void {
    this.onStateCb = cb;
  }

  onEnded(cb: () => void): void {
    this.onEndedCb = cb;
  }

  isCasting(): boolean {
    return (
      this.available &&
      cast.framework.CastContext.getInstance().getSessionState() ===
        cast.framework.SessionState.SESSION_STARTED
    );
  }

  /** Open the device picker (bound to the Cast button). */
  async requestSession(): Promise<boolean> {
    if (!this.available) return false;
    try {
      const session = await cast.framework.CastContext.getInstance().requestSession();
      return !!session;
    } catch {
      return false;
    }
  }

  /** Send a command through the Cast session. Returns false if unsupported. */
  async send(op: CommandOp): Promise<boolean> {
    const session = this.available
      ? cast.framework.CastContext.getInstance().getCurrentSession()
      : null;
    if (!session) return false;
    const intent = toCastIntent(op);
    if (intent.kind === "unsupported") return false;

    const media = session.getSessionObj().media[0];

    switch (intent.kind) {
      case "load": {
        const request: chrome.cast.LoadRequest = {
          contentId: intent.url,
          contentType: intent.contentType,
          autoplay: true,
        };
        if (intent.title) {
          request.metadata = { type: 0, title: intent.title }; // 0 = GENERIC
        }
        await session.loadMedia(request);
        return true;
      }
      case "play":
        await media?.play();
        return true;
      case "pause":
        await media?.pause();
        return true;
      case "seek":
        await media?.seek({ currentTime: intent.time });
        return true;
      case "volume":
        await media?.setVolume({ level: Math.min(1, Math.max(0, intent.level)) });
        return true;
      case "mute":
        await media?.setVolume({ muted: intent.muted });
        return true;
      case "stop":
        session.endSession(false);
        return true;
    }
  }

  /** Read the current remote state (used for seek-slider sync). */
  readState(): RemoteState {
    if (!this.player) return {};
    const p = this.player;
    const s: PlaybackState = {
      paused: p.isPaused,
      position: p.currentTime,
      duration: p.duration || undefined,
      title: p.title ?? undefined,
    };
    return s;
  }

  dispose(): void {
    if (this.sessionHandler) {
      cast.framework.CastContext.getInstance().removeEventListener("sessionstatechanged", this.sessionHandler);
      this.sessionHandler = null;
    }
    this.controller = null;
    this.player = null;
  }
}
