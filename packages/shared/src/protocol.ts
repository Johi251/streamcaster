/**
 * StreamCaster shared protocol.
 * Single discriminated union used over WebSocket (and SSE fallback)
 * between sender, receiver and the signaling Worker/Durable Object.
 */

export type Role = "sender" | "receiver";

/** Capability probe reported by the receiver on join. */
export interface ReceiverCaps {
  /** RTCPeerConnection available (WebRTC possible). */
  rtc: boolean;
  /** MediaSource Extensions available (hls.js possible). */
  mse: boolean;
  /** canPlayType matrix: type -> "" | "maybe" | "probably". */
  canPlay: Record<string, string>;
  userAgent: string;
}

export type WebRtcSignalKind = "offer" | "answer" | "ice";

/** Operations the sender can push to the receiver (Path B + control). */
export type CommandOp =
  | { name: "load"; url: string; title?: string; mime?: string }
  | { name: "play" }
  | { name: "pause" }
  | { name: "seek"; time: number }
  | { name: "volume"; value: number }
  | { name: "stop" }
  | { name: "subtitle"; url?: string; content?: string; label?: string }
  | { name: "file-meta"; filename: string; size: number; mime: string }
  | { name: "stream-start"; kind: "screen" | "camera" }
  | { name: "stream-stop" };

export interface PlaybackState {
  currentUrl?: string;
  title?: string;
  position?: number;
  duration?: number;
  paused?: boolean;
  volume?: number;
}

/** Messages client -> server (both roles). */
export type ClientMessage =
  | { t: "join"; role: Role; code: string; caps?: ReceiverCaps }
  | { t: "webrtc"; kind: WebRtcSignalKind; payload: unknown }
  | { t: "cmd"; op: CommandOp }
  | { t: "state"; state: PlaybackState }
  | { t: "ping"; ts: number }
  | { t: "leave" };

/** Messages server -> client. */
export type ServerMessage =
  | {
      t: "joined";
      code: string;
      role: Role;
      /** Everyone in the room, including the socket that just joined. */
      peers: number;
      /**
       * Whether the opposite role is already in the room. `peers` cannot answer
       * that on its own (it counts the joiner), and "my socket is open" says
       * nothing about the TV being there — which is how the sender used to end
       * up showing "connected" to an empty room.
       */
      peerPresent: boolean;
      state?: PlaybackState;
      peerCaps?: ReceiverCaps;
    }
  | { t: "peer-joined"; role: Role; caps?: ReceiverCaps }
  | { t: "peer-left"; role: Role }
  | { t: "error"; code: string; message: string }
  | { t: "webrtc"; kind: WebRtcSignalKind; payload: unknown }
  | { t: "cmd"; op: CommandOp }
  | { t: "state"; state: PlaybackState }
  | { t: "pong"; ts: number };

export function parseClientMessage(raw: string): ClientMessage | null {
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== "object" || data === null || !("t" in data)) return null;
    return data as ClientMessage;
  } catch {
    return null;
  }
}

export function parseServerMessage(raw: string): ServerMessage | null {
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== "object" || data === null || !("t" in data)) return null;
    return data as ServerMessage;
  } catch {
    return null;
  }
}
