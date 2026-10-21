# Protocol reference (packages/shared/src/protocol.ts)

Single discriminated union over WebSocket (primary) with an SSE + POST
fallback for TV browsers with flaky WebSockets (e.g. Fire TV Silk).

## Roles

`sender` (phone/desktop browser) and `receiver` (TV browser). Max one of each
per room code. Room codes: 6 chars from a no-confusable alphabet
(no 0/O, no 1/I/L).

## Join flow

1. Receiver opens `/r/<CODE>` → WS `/ws?code=<CODE>` → sends
   `{t:"join", role:"receiver", caps}`. Server replies `joined`, persists caps,
   broadcasts `peer-joined` to any existing sender.
2. Sender opens `/#join=<CODE>` (QR target) → WS `/ws?code=<CODE>` →
   `{t:"join", role:"sender"}` → `joined` (includes `peerCaps` of receiver and
   persisted playback `state`).

Role conflicts are rejected with `{t:"error", code:"role_taken"}`.

## Commands (sender → receiver)

`CommandOp` union:

| Op | Fields | Effect |
|---|---|---|
| `load` | `url`, `title?`, `mime?` | Load media in receiver player (mp4 native / HLS via hls.js) |
| `play` / `pause` / `seek` / `volume` / `stop` | — | Playback control |
| `subtitle` | `url` or `content`, `label` | Add VTT subtitle track |
| `file-meta` | `filename`, `size`, `mime` | Begin local-file transfer (WebRTC datachannel) |
| `stream-start` / `stream-stop` | `kind: "screen"|"camera"` | Live stream (WebRTC) |

`load`/`stop` are persisted in the DO (SQLite kv) so a receiver refresh
resumes.

## State (receiver → sender)

Receiver pushes `{t:"state", state}` ~1×/s: `paused`, `position`, `duration`,
`title`, `volume`, `currentUrl`. Drives the sender's seek slider.

## WebRTC signaling

`{t:"webrtc", kind:"offer"|"answer"|"ice", payload}` — relayed across roles by
the DO. Sender is always the offerer.

## Chromecast mapping

On Chromecast targets (desktop/Android Chrome only) the same `CommandOp` set is
mapped to the Cast SDK (`toCastIntent()` in `apps/sender/src/cast/chromecast.ts`):

| CommandOp | Cast action |
|---|---|
| `load` | `session.loadMedia()` with content type derived from mime/extension (`application/x-mpegurl` for HLS, `video/mp4`, …) |
| `play`/`pause` | `media.play()` / `media.pause()` |
| `seek` | `media.seek({currentTime})` |
| `volume 0` | `setVolume({muted:true})` |
| `volume >0` | `setVolume({level})` |
| `stop` | `session.endSession()` |
| `subtitle`, `file-meta`, `stream-*` | unsupported (disabled during Cast sessions) |

## TTL

Rooms self-destruct 2h after last activity (DO alarm). Storage is wiped then.
