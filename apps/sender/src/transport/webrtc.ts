/**
 * Sender-side WebRTC peer.
 * Two modes:
 *  - stream mode: sends a MediaStream (screen mirror / camera) to the receiver
 *  - file mode:   hosts a DataChannel for chunked local-file transfer
 * ICE failure within 15s surfaces an error so callers can fall back to Path B.
 */
import { ICE_SERVERS } from "@streamcaster/shared";

export class SenderPeer {
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private stream: MediaStream | null = null;
  private watchDog: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly sendSignal: (kind: "offer" | "ice", payload: unknown) => void,
    private readonly onIceFailure: () => void
  ) {}

  get dataChannel(): RTCDataChannel | null {
    return this.dc;
  }

  /** Establish a connection for streaming the given MediaStream. */
  async startStream(stream: MediaStream): Promise<void> {
    this.setup();
    const pc = this.pc!;
    for (const track of stream.getTracks()) pc.addTrack(track, stream);
    await this.negotiate();
  }

  /** Establish a datachannel-only connection (local file transfer). */
  async startDataChannel(): Promise<RTCDataChannel> {
    this.setup();
    const dc = this.pc!.createDataChannel("file", { ordered: true });
    dc.binaryType = "arraybuffer";
    dc.bufferedAmountLowThreshold = 256 * 1024;
    this.dc = dc;
    await this.negotiate();
    return dc;
  }

  async handleSignal(kind: string, payload: unknown): Promise<void> {
    const pc = this.pc;
    if (!pc) return;
    if (kind === "answer") {
      await pc.setRemoteDescription(payload as RTCSessionDescriptionInit);
    } else if (kind === "ice") {
      await pc.addIceCandidate(payload as RTCIceCandidateInit).catch(() => undefined);
    }
  }

  async stop(): Promise<void> {
    if (this.watchDog) clearTimeout(this.watchDog);
    this.watchDog = null;
    this.dc?.close();
    this.dc = null;
    this.pc?.close();
    this.pc = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }

  // ------------------------------------------------------------------ internals

  private setup(): void {
    if (this.pc) return;
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.pc = pc;

    pc.onicecandidate = (ev) => {
      if (ev.candidate) this.sendSignal("ice", ev.candidate.toJSON());
    };

    // 15s watchdog: if we're not connected by then, report failure.
    // (STUN gathering can take several seconds on firewalled/slow networks.)
    if (this.watchDog) clearTimeout(this.watchDog);
    this.watchDog = setTimeout(() => {
      if (pc.connectionState !== "connected") {
        this.onIceFailure();
      }
    }, 15000);

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected" && this.watchDog) {
        clearTimeout(this.watchDog);
        this.watchDog = null;
      }
      if (pc.connectionState === "failed") this.onIceFailure();
    };
  }

  private async negotiate(): Promise<void> {
    const pc = this.pc!;
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this.sendSignal("offer", pc.localDescription?.toJSON() ?? offer);
  }
}
