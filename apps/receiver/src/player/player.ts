/**
 * Receiver player: mp4 via <video src>, HLS via hls.js when MSE is present
 * but native HLS is not (Fire TV Silk, most TV browsers).
 * Autoplay: attempt muted; on block show "Tap to play" instead of failing.
 */
import Hls from "hls.js";

const PROXY_ORIGIN = (import.meta.env.VITE_PROXY_URL as string | undefined) ?? "";

export class ReceiverPlayer {
  readonly video: HTMLVideoElement;
  private hls: Hls | null = null;
  private subtitleUrl: string | null = null;
  /** URLs already retried through the proxy — prevents retry loops. */
  private proxiedRetries = new Set<string>();

  constructor(
    video: HTMLVideoElement,
    private readonly onStateChange: (playing: boolean, position: number, duration: number) => void,
    private readonly toast: (msg: string) => void
  ) {
    this.video = video;
    video.addEventListener("timeupdate", () => this.emitState());
    video.addEventListener("pause", () => this.emitState());
    video.addEventListener("play", () => this.emitState());
    video.addEventListener("ended", () => this.emitState());
  }

  show(): void {
    this.video.classList.add("active");
  }

  async load(url: string, mime?: string): Promise<void> {
    this.stop();
    this.show();
    const isHls = /\.m3u8(\?|$)/i.test(url) || mime === "application/vnd.apple.mpegurl";

    if (isHls && !this.video.canPlayType("application/vnd.apple.mpegurl") && Hls.isSupported()) {
      this.hls = new Hls({ enableWorker: true });
      this.hls.loadSource(url);
      this.hls.attachMedia(this.video);
      this.hls.on(Hls.Events.ERROR, (_e, data) => {
        if (!data.fatal) return;
        // Belt-and-braces: if a direct (non-proxied) HLS URL fails at network
        // level, retry once through the proxy (sender-side probe usually
        // routes CORS-blocked origins here already).
        if (
          data.type === Hls.ErrorTypes.NETWORK_ERROR &&
          PROXY_ORIGIN &&
          !url.includes("/hls?url=") &&
          !this.proxiedRetries.has(url)
        ) {
          this.proxiedRetries.add(url);
          this.toast("Retrying stream through proxy…");
          this.hls?.loadSource(`${PROXY_ORIGIN}/hls?url=${encodeURIComponent(url)}`);
          this.hls?.startLoad();
          return;
        }
        if (data.details === "keyLoadError" || data.details === "decryptError") {
          this.toast("Stream is DRM-protected — playback not possible.");
        } else {
          this.toast("Stream error: " + data.details + ". Source may block cross-origin playback.");
        }
      });
    } else {
      this.video.src = url;
    }

    try {
      await this.video.play();
    } catch {
      // Autoplay blocked — show tap overlay; also try muted autoplay as second chance.
      this.video.muted = true;
      try {
        await this.video.play();
        this.toast("Playing muted — press volume up on remote or tap to unmute.");
        this.video.addEventListener("click", () => (this.video.muted = false), { once: true });
      } catch {
        this.showTapToPlay();
      }
    }
  }

  addSubtitle(content: string, label: string): void {
    this.clearSubtitle();
    const blob = new Blob([content], { type: "text/vtt" });
    this.subtitleUrl = URL.createObjectURL(blob);
    const track = document.createElement("track");
    track.kind = "subtitles";
    track.label = label;
    track.srclang = "en";
    track.src = this.subtitleUrl;
    this.video.appendChild(track);
    track.addEventListener("load", () => {
      this.video.textTracks[0]!.mode = "showing";
    });
  }

  addSubtitleUrl(url: string, label: string): void {
    this.clearSubtitle();
    const track = document.createElement("track");
    track.kind = "subtitles";
    track.label = label;
    track.srclang = "en";
    track.src = url;
    this.video.appendChild(track);
    track.addEventListener("load", () => {
      this.video.textTracks[0]!.mode = "showing";
    });
  }

  play(): void {
    void this.video.play().catch(() => this.showTapToPlay());
  }

  pause(): void {
    this.video.pause();
  }

  seek(time: number): void {
    if (Number.isFinite(time)) this.video.currentTime = Math.max(0, time);
  }

  setVolume(v: number): void {
    this.video.volume = Math.min(1, Math.max(0, v));
    this.video.muted = v === 0;
  }

  stop(): void {
    this.hls?.destroy();
    this.hls = null;
    this.clearSubtitle();
    this.video.removeAttribute("src");
    this.video.load();
    this.video.classList.remove("active");
  }

  attachStream(stream: MediaStream): void {
    this.stop();
    this.show();
    this.video.srcObject = stream;
    void this.video.play().catch(() => this.showTapToPlay());
  }

  private clearSubtitle(): void {
    if (this.subtitleUrl) {
      URL.revokeObjectURL(this.subtitleUrl);
      this.subtitleUrl = null;
    }
    for (const t of [...this.video.querySelectorAll("track")]) t.remove();
  }

  private showTapToPlay(): void {
    const overlay = document.getElementById("tap-to-play");
    if (!overlay) return;
    overlay.classList.remove("hidden");
    overlay.onclick = () => {
      overlay.classList.add("hidden");
      this.video.muted = false;
      void this.video.play().catch(() => undefined);
    };
  }

  private emitState(): void {
    this.onStateChange(!this.video.paused, this.video.currentTime, this.video.duration || 0);
  }
}
