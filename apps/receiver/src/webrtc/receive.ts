/**
 * Receiver-side WebRTC: answers the sender's offer, renders the track.
 * Also hosts the `file` datachannel used for local-file streaming.
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
    private readonly onState: (playing: boolean, position: number, duration: number) => void
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
    this.close();
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.pc = pc;

    pc.ontrack = (ev) => {
      const stream = ev.streams[0] ?? new MediaStream([ev.track]);
      this.player.attachStream(stream);
      this.onState(true, 0, 0);
    };

    pc.onicecandidate = (ev) => {
      if (ev.candidate) this.sendSignal("ice", ev.candidate.toJSON());
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        this.toast("Mirror stream lost.");
      }
    };

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
        // control frames from the file sender
        if (ev.data === "EOF") this.finishFile();
        return;
      }
      const buf = ev.data as ArrayBuffer;
      this.received.push(buf);
      this.receivedBytes += buf.byteLength;
      if (this.fileMeta) {
        const pct = Math.round((this.receivedBytes / this.fileMeta.size) * 100);
        if (pct % 10 === 0) this.toast(`Receiving ${this.fileMeta.name}: ${pct}%`);
      }
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
    this.received = [];
    this.receivedBytes = 0;
    const url = URL.createObjectURL(blob);
    this.player.load(url, meta.mime).then(() => {
      // lifetime of the video session; revoke on next load via player.stop()
    });
    this.toast(`Received ${meta.name} (${(meta.size / 1e6).toFixed(1)} MB)`);
  }

  close(): void {
    this.dc?.close();
    this.dc = null;
    this.pc?.close();
    this.pc = null;
  }
}

export const ICE_SERVERS: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun.cloudflare.com:3478"] },
];
