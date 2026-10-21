import type { ReceiverCaps } from "./protocol.js";

/** STUN servers (free, public). */
export const ICE_SERVERS: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun.cloudflare.com:3478"] },
];

/** Media types probed on the receiver to warn about codec gaps. */
export const PROBED_TYPES = [
  'video/mp4; codecs="avc1.42E01E, mp4a.40.2"', // H.264/AAC — universal target
  'video/mp4; codecs="hvc1.1.6.L93.B0"', // HEVC — often missing on TV browsers
  "video/webm; codecs=vp9",
  "application/vnd.apple.mpegurl", // native HLS
];

export function probeCapabilities(): ReceiverCaps {
  const v = document.createElement("video");
  const canPlay: Record<string, string> = {};
  for (const t of PROBED_TYPES) canPlay[t] = v.canPlayType(t) || "";
  return {
    rtc: typeof RTCPeerConnection !== "undefined",
    mse: typeof MediaSource !== "undefined" && MediaSource.isTypeSupported('video/mp4; codecs="avc1.42E01E, mp4a.40.2"'),
    canPlay,
    userAgent: navigator.userAgent,
  };
}

/** True if the receiver can likely play H.264/AAC (our universal target). */
export function supportsH264Aac(caps: ReceiverCaps): boolean {
  const h264 = PROBED_TYPES[0]!;
  const val = caps.canPlay[h264];
  return val === "probably" || val === "maybe";
}
