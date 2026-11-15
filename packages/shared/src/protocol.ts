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

/** Bound untrusted signalling frames. WebRTC SDP is the largest legit payload. */
export const MAX_MESSAGE_CHARS = 64 * 1024;

const CLIENT_TYPES = new Set(["join", "webrtc", "cmd", "state", "ping", "leave"]);
const SERVER_TYPES = new Set([
  "joined", "peer-joined", "peer-left", "error", "webrtc", "cmd", "state", "pong",
]);
const ROLES = new Set(["sender", "receiver"]);
const WEBRTC_KINDS = new Set(["offer", "answer", "ice"]);
const COMMAND_NAMES = new Set([
  "load", "play", "pause", "seek", "volume", "stop", "subtitle",
  "file-meta", "stream-start", "stream-stop",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Validate before casting to the union. A bare `"t" in data` check used to
 * accept `{"t":"cmd"}` with no `op`, which crashed the Room DO at
 * `msg.op.name` and killed the room's message loop. Every field the routing
 * switch dereferences is checked here.
 */
export function parseClientMessage(raw: string): ClientMessage | null {
  if (raw.length > MAX_MESSAGE_CHARS) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(data) || typeof data.t !== "string" || !CLIENT_TYPES.has(data.t)) return null;
  switch (data.t) {
    case "join":
      if (typeof data.role !== "string" || !ROLES.has(data.role)) return null;
      if (typeof data.code !== "string") return null;
      break;
    case "webrtc":
      if (typeof data.kind !== "string" || !WEBRTC_KINDS.has(data.kind)) return null;
      break;
    case "cmd":
      if (!isRecord(data.op) || typeof data.op.name !== "string" || !COMMAND_NAMES.has(data.op.name)) return null;
      break;
    case "state":
      if (!isRecord(data.state)) return null;
      break;
    case "ping":
      if (typeof data.ts !== "number") return null;
      break;
    case "leave":
      break;
  }
  return data as unknown as ClientMessage;
}

export function parseServerMessage(raw: string): ServerMessage | null {
  if (raw.length > MAX_MESSAGE_CHARS) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(data) || typeof data.t !== "string" || !SERVER_TYPES.has(data.t)) return null;
  return data as unknown as ServerMessage;
}
