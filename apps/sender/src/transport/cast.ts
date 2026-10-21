/**
 * Path B transport: push media commands to the receiver over signaling.
 * Works on every TV browser — no WebRTC required, zero media bytes relayed.
 */
import type { CommandOp, PlaybackState, ReceiverCaps, SignalingClient } from "@streamcaster/shared";

export class CastCommands {
  constructor(private readonly client: SignalingClient) {}

  load(url: string, title?: string, mime?: string): void {
    this.op({ name: "load", url, title, mime });
  }

  play(): void {
    this.op({ name: "play" });
  }

  pause(): void {
    this.op({ name: "pause" });
  }

  seek(time: number): void {
    this.op({ name: "seek", time });
  }

  volume(value: number): void {
    this.op({ name: "volume", value });
  }

  stop(): void {
    this.op({ name: "stop" });
  }

  subtitle(content: string, label = "Subtitles"): void {
    this.op({ name: "subtitle", content, label });
  }

  fileMeta(name: string, size: number, mime: string): void {
    this.op({ name: "file-meta", name, size, mime });
  }

  streamStart(kind: "screen" | "camera"): void {
    this.op({ name: "stream-start", kind });
  }

  streamStop(): void {
    this.op({ name: "stream-stop" });
  }

  private op(op: CommandOp): void {
    this.client.send({ t: "cmd", op });
  }
}

export interface RemoteState {
  paused?: boolean;
  position?: number;
  duration?: number;
  title?: string;
}

export function stateFromPlayback(s: PlaybackState): RemoteState {
  return { paused: s.paused, position: s.position, duration: s.duration, title: s.title };
}

export function describeCaps(caps: ReceiverCaps | undefined): string {
  if (!caps) return "";
  const notes: string[] = [];
  if (!caps.rtc) notes.push("no WebRTC (URL/file casting only)");
  if (!caps.mse) notes.push("no MSE (only mp4 URLs, no HLS)");
  return notes.length ? "Receiver: " + notes.join(", ") : "";
}
