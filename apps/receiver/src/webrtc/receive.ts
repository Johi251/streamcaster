/**
 * Receiver peer for WebRTC screen mirroring & file transfer.
 *
 * Manages RTCPeerConnection lifecycle: answer offer, ICE exchange,
 * MediaStream attachment to receiver player, DataChannel file transfer.
 */

import type { ReceiverPlayer } from "../player/player.js";

export interface FileMeta {
  name: string;
  size: number;
  mime: string;
}

export class ReceiverPeer {
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private fileMeta: FileMeta | null = null;
  private received: ArrayBuffer[] = [];
  private receivedBytes = 0;

  constructor(
    private readonly player: ReceiverPlayer,
    private readonly sendSignal: (kind: "answer" | "ice", payload: unknown) => void,
    private readonly toast: (msg: string) => void,
    private readonly onState: (playing: boolean, position: number, duration: number) => void,
  ) {}

  get hasConnection(): boolean {
    return this.pc !== null;
  }

  async handleSignal(kind: string, payload: unknown): Promise<void> {
    if (kind === "offer") {
      await this.answerOffer(payload as RTCSessionDescriptionInit);
    } else if (kind === "ice") {
      await this.pc?.addIceCandidate(payload as RTCIceCandidateInit).catch(() => undefined);
    }
  }

  private async answerOffer(offer: RTCSessionDescriptionInit): Promise<void> {
    // Drop any previous connection before negotiating a new one.
    this.close();

    const pc = new RTCPeerConnection({ iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }] });
    this.pc = pc;

    // Attach the WebRTC MediaStream from the sender to the receiver player
    pc.ontrack = (ev) => {
      const stream = ev.streams[0] ?? new MediaStream([ev.track]);
      this.player.attachStream?.(stream);
      this.onState(true, 0, 0);
    };

    // Forward ICE candidates to the signaling server
    pc.onicecandidate = (ev) => {
      if (ev.candidate) this.sendSignal("ice", ev.candidate.toJSON());
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        this.toast("Mirror stream lost. Reconnecting…");
      }
    };

    // Wire DataChannel for file transfers
    pc.ondatachannel = (ev) => {
      this.dc = ev.channel;
      this.dc.binaryType = "arraybuffer";
      this.wireDataChannel();
    };

    await pc.setRemoteDescription(offer);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    this.sendSignal("answer", pc.localDescription?.toJSON() ?? answer);
  }

  private wireDataChannel(): void {
    const dc = this.dc;
    if (!dc) return;

    dc.onmessage = (ev) => {
      if (typeof ev.data === "string") {
        if (ev.data === "EOF") this.finishFile();
        return;
      }
      const buf = ev.data as ArrayBuffer;
      this.received.push(buf);
      this.receivedBytes += buf.byteLength;
      if (this.fileMeta) {
        const pct = Math.round((this.receivedBytes / this.fileMeta.size) * 100);
        if (pct % 25 === 0) {
          this.toast(`Receiving ${this.fileMeta.name}: ${pct}%`);
        }
      }
    };

    dc.onclose = () => {
      this.toast("Data channel closed.");
    };
  }

  setFileMeta(meta: FileMeta): void {
    this.fileMeta = meta;
    this.received = [];
    this.receivedBytes = 0;
  }

  private finishFile(): void {
    const meta = this.fileMeta;
    if (!meta) return;

    const blob = new Blob(this.received, { type: meta.mime || "video/mp4" });
    const url = URL.createObjectURL(blob);

    // Clear buffers to free memory
    this.received = [];
    this.receivedBytes = 0;

    // Clean up: revoke blob URL after a short delay (gives the player time to load)
    setTimeout(() => URL.revokeObjectURL(url), 5000);

    // `load` is optional on the player interface (a mirror-only player has
    // no file source), so fall back to a resolved promise.
    const loadPromise = this.player.load?.(url, meta.mime) ?? Promise.resolve();
    void loadPromise.then(() => {
      this.toast(`Received ${meta.name} (${(meta.size / 1e6).toFixed(1)} MB)`);
    });
  }

  /**
   * Reset the transfer buffers. Does NOT touch the connection — `close()`
   * calls this, so the reverse direction would recurse forever.
   */
  clear(): void {
    this.received = [];
    this.receivedBytes = 0;
    this.fileMeta = null;
  }

  /** Tear down the peer connection and the data channel. */
  close(): void {
    this.dc?.close();
    this.dc = null;
    this.pc?.close();
    this.pc = null;
    this.clear();
  }
}