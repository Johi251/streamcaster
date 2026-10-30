/**
 * StreamCaster receiver player.
 *
 * Handles three playback modes:
 *   1. WebRTC MediaStream (screen mirror / camera from sender)
 *   2. HLS (hls.js, direct or via /hls proxy)
 *   3. MP4/WebM (direct, or via /p proxy)
 *
 * The factory `createPlayer()` takes the **existing** <video> element and
 * drives it. It deliberately does not create a second video element: the
 * controller (main.ts) binds its media listeners (timeupdate, loadedmetadata,
 * touch gestures) to that one element, and a second <video> would leave those
 * listeners attached to an element that never plays anything.
 *
 * Exposes: playing(), pause(), seek(time), volume(value), stop(), url(newUrl),
 *          addSubtitle(), addSubtitleUrl(), attachStream(), load(url, mime)
 */

// ── HLS.js (CDN / npm) ─────────────────────────────────────────────────

let hlsHs: any = null;

async function loadHls(): Promise<any | null> {
  if (hlsHs) return hlsHs;
  try {
    const { default: HLS } = await import("hls.js");
    hlsHs = HLS;
    return HLS;
  } catch {
    return null;
  }
}

// ── HLS Player ─────────────────────────────────────────────────────────

class InternalHlsPlayer {
  private el: HTMLVideoElement;
  private hlsInstance: any = null;
  private _currentUrl: string = "";
  private vttTracks: HTMLTrackElement[] = [];

  constructor(url: string, videoEl: HTMLVideoElement) {
    this.el = videoEl;
    this.el.setAttribute("autoplay", "");
    this.el.setAttribute("playsinline", "");
    this.el.setAttribute("preload", "auto");
    this.el.removeAttribute("controls");
    this.el.style.width = "100%";
    this.el.style.height = "100%";
    this.el.style.display = "block";
    this.el.style.padding = "0";

    this._currentUrl = url;
    this.load(url);
  }

  get currentUrl() {
    return this._currentUrl;
  }

  get video() {
    return this.el;
  }

  async playing(): Promise<void> {
    try {
      const HLS = await loadHls();
      if (!HLS) {
        // Native HTML5 HLS fallback (Safari / newer Chrome)
        this.el.src = this._currentUrl;
        this.el.load();
        try {
          await this.el.play();
        } catch {
          // Autoplay with sound is refused until the page has a user gesture —
          // TV browsers never have one. Starting muted is always allowed, and
          // the first remote key restores the sound.
          this.el.muted = true;
          await this.el.play().catch(() => undefined);
        }
        return;
      }

      if (!this.hlsInstance) {
        this.hlsInstance = new HLS({
          enableNativeHls: true,
          maxBufferLength: 3,
          maxFragmentBufferLength: 1,
        });
        this.hlsInstance.loadSource(this._currentUrl);
        this.hlsInstance.attachMedia(this.el);
      } else {
        this.hlsInstance.loadSource(this._currentUrl);
      }
      await this.startPlayback();
    } catch (err) {
      console.error("[HLSPlayer] playing() failed:", err);
      throw err;
    }
  }

  /**
   * Play with a muted fallback. TV browsers (Silk, Tizen, webOS) refuse
   * autoplay with sound because the page has no user gesture, which left the
   * TV showing a black frame at 0:00 while the sender believed it was casting.
   */
  private async startPlayback(): Promise<void> {
    try {
      await this.el.play();
    } catch {
      this.el.muted = true;
      await this.el.play().catch(() => undefined);
    }
  }

  pause(): void {
    this.el.pause();
    if (this.hlsInstance) {
      (this.hlsInstance as any).pause();
    }
  }

  seek(time: number): void {
    this.el.currentTime = time;
    if (this.hlsInstance) {
      (this.hlsInstance as any).seek(time);
    }
  }

  stop(): void {
    if (this.hlsInstance) {
      try {
        (this.hlsInstance as any).destroy();
      } catch {
        /* already gone */
      }
      this.hlsInstance = null;
    }
    this.removeVttTracks();
    this.el.removeAttribute("src");
    this.el.srcObject = null;
    this.el.load();
    this._currentUrl = "";
  }

  url(newUrl: string): void {
    this._currentUrl = newUrl;
    this.load(newUrl);
  }

  volume(v: number): void {
    this.el.volume = v;
  }

  addSubtitle(vtt: string, label = "Subtitles"): void {
    this.addVttTrack(vtt, label);
  }

  async addSubtitleUrl(url: string, label = "Subtitles"): Promise<void> {
    try {
      const resp = await fetch(url);
      const vttText = await resp.text();
      this.addVttTrack(vttText, label);
    } catch {
      console.warn("[HLSPlayer] Could not load subtitle:", url);
    }
  }

  private removeVttTracks(): void {
    for (const t of this.vttTracks) {
      try {
        t.remove();
      } catch {
        /* track already detached */
      }
    }
    this.vttTracks = [];
  }

  private addVttTrack(vtt: string, label: string): void {
    const blob = new Blob([vtt], { type: "text/vtt" });
    const blobUrl = URL.createObjectURL(blob);
    // <track> elements are children of the <video>, not entries in a
    // `video.textTracks` list — addTrack()/removeTrack() do not exist.
    const track = document.createElement("track") as HTMLTrackElement;
    track.src = blobUrl;
    track.kind = "subtitles";
    track.srclang = "en";
    track.label = label;
    track.default = label === "Subtitles";
    this.el.appendChild(track);
    this.vttTracks.push(track);
  }

  private load(src: string): void {
    if (this.hlsInstance) {
      this.hlsInstance.loadSource(src);
    } else {
      this.el.src = src;
      this.el.load();
    }
  }
}

// ── MP4 Player ─────────────────────────────────────────────────────────

class InternalMpxPlayer {
  private el: HTMLVideoElement;
  private _currentUrl: string = "";
  private vttTracks: HTMLTrackElement[] = [];

  constructor(url: string, videoEl: HTMLVideoElement) {
    this.el = videoEl;
    this.el.setAttribute("autoplay", "");
    this.el.setAttribute("playsinline", "");
    this.el.setAttribute("preload", "auto");
    this.el.removeAttribute("controls");
    this.el.style.width = "100%";
    this.el.style.height = "100%";
    this.el.style.display = "block";
    this.el.style.padding = "0";

    this._currentUrl = url;
    this.el.src = url;
    this.el.load();
    this.el.play().catch(() => undefined);
  }

  get currentUrl() {
    return this._currentUrl;
  }

  get video() {
    return this.el;
  }

  playing(): void {
    this.el.play().catch(() => undefined);
  }

  pause(): void {
    this.el.pause();
  }

  seek(time: number): void {
    this.el.currentTime = time;
  }

  stop(): void {
    this.removeVttTracks();
    this.el.removeAttribute("src");
    this.el.srcObject = null;
    this.el.load();
    this._currentUrl = "";
  }

  url(newUrl: string): void {
    this._currentUrl = newUrl;
    this.el.src = newUrl;
    this.el.load();
  }

  volume(v: number): void {
    this.el.volume = v;
  }

  setVolume(v: number): void {
    this.volume(v);
  }

  addSubtitle(vtt: string, label = "Subtitles"): void {
    this.addVttTrack(vtt, label);
  }

  async addSubtitleUrl(url: string, label = "Subtitles"): Promise<void> {
    try {
      const resp = await fetch(url);
      const vttText = await resp.text();
      this.addVttTrack(vttText, label);
    } catch {
      console.warn("[MP4Player] Could not load subtitle:", url);
    }
  }

  private removeVttTracks(): void {
    for (const t of this.vttTracks) {
      try {
        t.remove();
      } catch {
        /* track already detached */
      }
    }
    this.vttTracks = [];
  }

  private addVttTrack(vtt: string, label: string): void {
    const blob = new Blob([vtt], { type: "text/vtt" });
    const blobUrl = URL.createObjectURL(blob);
    // <track> elements are children of the <video>, not entries in a
    // `video.textTracks` list — addTrack()/removeTrack() do not exist.
    const track = document.createElement("track") as HTMLTrackElement;
    track.src = blobUrl;
    track.kind = "subtitles";
    track.srclang = "en";
    track.label = label;
    track.default = label === "Subtitles";
    this.el.appendChild(track);
    this.vttTracks.push(track);
  }
}

// ── WebRTC Player ──────────────────────────────────────────────────────

class InternalWebRtcPlayer {
  private el: HTMLVideoElement;
  private _currentUrl: string = "";
  private vttTracks: HTMLTrackElement[] = [];

  constructor(videoEl: HTMLVideoElement) {
    this.el = videoEl;
    this.el.setAttribute("autoplay", "");
    this.el.setAttribute("playsinline", "");
    this.el.setAttribute("preload", "auto");
    this.el.removeAttribute("controls");
    this.el.style.width = "100%";
    this.el.style.height = "100%";
    this.el.style.display = "block";
    this.el.style.padding = "0";
  }

  get currentUrl() {
    return this._currentUrl;
  }

  get video() {
    return this.el;
  }

  async url(newUrl: string): Promise<void> {
    this._currentUrl = newUrl;
  }

  /**
   * Play a plain media URL (e.g. the blob: URL of a file transferred over the
   * DataChannel). Mirrors replace the live MediaStream, so the object URL has
   * to be dropped first — otherwise the <video> keeps the old stream and the
   * transferred file never appears.
   */
  async playFile(newUrl: string): Promise<void> {
    this._currentUrl = newUrl;
    this.el.srcObject = null;
    this.el.src = newUrl;
    this.el.load();
    await this.el.play().catch(() => undefined);
  }

  playing(): void {}
  pause(): void {}
  seek(): void {}

  stop(): void {
    this.removeVttTracks();
    this.el.removeAttribute("src");
    this.el.srcObject = null;
    this.el.load();
    this._currentUrl = "";
  }

  volume(v: number): void {
    this.el.volume = v;
  }

  setVolume(v: number): void {
    this.volume(v);
  }

  addSubtitle(vtt: string, label = "Subtitles"): void {
    this.addVttTrack(vtt, label);
  }

  async addSubtitleUrl(url: string, label = "Subtitles"): Promise<void> {
    try {
      const resp = await fetch(url);
      const vttText = await resp.text();
      this.addVttTrack(vttText, label);
    } catch {
      console.warn("[WebRtcPlayer] Could not load subtitle:", url);
    }
  }

  private removeVttTracks(): void {
    for (const t of this.vttTracks) {
      try {
        t.remove();
      } catch {
        /* track already detached */
      }
    }
    this.vttTracks = [];
  }

  private addVttTrack(vtt: string, label: string): void {
    const blob = new Blob([vtt], { type: "text/vtt" });
    const blobUrl = URL.createObjectURL(blob);
    // <track> elements are children of the <video>, not entries in a
    // `video.textTracks` list — addTrack()/removeTrack() do not exist.
    const track = document.createElement("track") as HTMLTrackElement;
    track.src = blobUrl;
    track.kind = "subtitles";
    track.srclang = "en";
    track.label = label;
    track.default = label === "Subtitles";
    this.el.appendChild(track);
    this.vttTracks.push(track);
  }

  attachStream(stream: MediaStream): void {
    if (!this.el.srcObject) {
      this.el.srcObject = stream;
      this.el.play().catch(() => undefined);
    }
  }
}

// ── Unified Player Interface ───────────────────────────────────────────

export type PlayerType = "hls" | "mp4" | "webrtc";

export interface ReceiverPlayer {
  readonly type: PlayerType;
  readonly currentUrl: string;
  /** The <video> element this player drives. */
  readonly video: HTMLVideoElement;
  /** HLS playback is async (hls.js load), MP4/WebRTC are sync — hence the union. */
  readonly playing: () => void | Promise<void>;
  readonly pause: () => void;
  readonly seek: (time: number) => void;
  readonly stop: () => void;
  readonly url: (newUrl: string) => void;
  readonly element: HTMLElement;
  readonly volume: (v: number) => void;
  readonly setVolume: (v: number) => void;
  addSubtitle?: (vtt: string, label?: string) => void;
  addSubtitleUrl?: (url: string, label?: string) => Promise<void>;
  attachStream?: (s: MediaStream) => void;
  load?: (url: string, mime?: string) => Promise<void>;
}

// ── Factory ────────────────────────────────────────────────────────────

export function createPlayer(
  type: PlayerType,
  url: string,
  videoEl: HTMLVideoElement,
  opts?: { onReady?: () => void; onError?: (e: Error) => void }
): ReceiverPlayer {
  switch (type) {
    case "hls": {
      const instance = new InternalHlsPlayer(url, videoEl);
      return {
        type,
        currentUrl: url,
        video: instance.video,
        playing: async () => instance.playing(),
        pause: () => instance.pause(),
        seek: (t) => instance.seek(t),
        stop: () => instance.stop(),
        url: (u) => instance.url(u),
        element: instance.video,
        volume: (v) => instance.volume(v),
        setVolume: (v) => instance.volume(v),
        addSubtitle: (vtt, label) => instance.addSubtitle(vtt, label),
        addSubtitleUrl: (u, l) => instance.addSubtitleUrl(u, l),
        load: async (newUrl, mime) => {
          instance.url(newUrl);
          await instance.playing();
          opts?.onReady?.();
        },
      };
    }
    case "mp4": {
      const instance = new InternalMpxPlayer(url, videoEl);
      return {
        type,
        currentUrl: url,
        video: instance.video,
        playing: () => instance.playing(),
        pause: () => instance.pause(),
        seek: (t) => instance.seek(t),
        stop: () => instance.stop(),
        url: (u) => instance.url(u),
        element: instance.video,
        volume: (v) => instance.volume(v),
        setVolume: (v) => instance.setVolume(v),
        addSubtitle: (vtt, label) => instance.addSubtitle(vtt, label),
        addSubtitleUrl: (u, l) => instance.addSubtitleUrl(u, l),
        load: async (newUrl, mime) => {
          instance.url(newUrl);
          opts?.onReady?.();
        },
      };
    }
    case "webrtc": {
      const instance = new InternalWebRtcPlayer(videoEl);
      return {
        type,
        currentUrl: url,
        video: instance.video,
        playing: () => instance.playing(),
        pause: () => instance.pause(),
        seek: () => instance.seek(),
        stop: () => instance.stop(),
        url: (u) => instance.url(u),
        element: instance.video,
        volume: (v) => instance.volume(v),
        setVolume: (v) => instance.setVolume(v),
        addSubtitle: (vtt, label) => instance.addSubtitle(vtt, label),
        addSubtitleUrl: (u, l) => instance.addSubtitleUrl(u, l),
        attachStream: (s) => instance.attachStream(s),
        load: async (newUrl, mime) => {
          await instance.playFile(newUrl);
          opts?.onReady?.();
        },
      };
    }
  }
}
