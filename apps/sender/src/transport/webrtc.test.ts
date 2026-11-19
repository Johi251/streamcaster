import { afterEach, describe, expect, it, vi } from "vitest";
import { SenderPeer } from "./webrtc.js";

class FakePeerConnection {
  static last: FakePeerConnection | null = null;
  localDescription = { toJSON: () => ({ type: "offer", sdp: "fake" }) };
  connectionState = "new";
  added: unknown[] = [];
  closed = false;
  onicecandidate: unknown = null;
  onconnectionstatechange: unknown = null;

  constructor(_config?: unknown) {
    FakePeerConnection.last = this;
  }
  addTrack(track: unknown): void {
    this.added.push(track);
  }
  async createOffer(): Promise<{ type: "offer"; sdp: string }> {
    return { type: "offer", sdp: "fake" };
  }
  async setLocalDescription(_sdp: unknown): Promise<void> {}
  close(): void {
    this.closed = true;
  }
}

describe("SenderPeer media lifecycle", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    FakePeerConnection.last = null;
  });

  it("stops captured tracks on stop() — no lingering camera/screen capture", async () => {
    vi.stubGlobal("RTCPeerConnection", FakePeerConnection);
    const stop = vi.fn();
    const track = { kind: "video", stop } as unknown as MediaStreamTrack;
    const stream = { getTracks: () => [track] } as unknown as MediaStream;
    const peer = new SenderPeer(() => undefined, () => undefined);

    await peer.startStream(stream);
    expect(FakePeerConnection.last?.added).toEqual([track]);

    await peer.stop();
    expect(stop).toHaveBeenCalledTimes(1);
    expect(FakePeerConnection.last?.closed).toBe(true);
  });
});
