/**
 * Room Durable Object: one instance per room code.
 * - WebSocket hibernation for cheap idle rooms (max 2 members: 1 sender, 1 receiver)
 * - SSE fallback stream for TV browsers with flaky WS (messages sent via POST /send)
 * - Playback state persisted in SQLite so a receiver refresh resumes
 * - Alarm-based TTL cleanup (2h after last activity)
 */
import type { ClientMessage, PlaybackState, ReceiverCaps, Role, ServerMessage } from "@streamcaster/shared";

const ROOM_TTL_MS = 2 * 60 * 60 * 1000; // 2h
const SSE_KEEPALIVE_MS = 25_000;

interface SocketAttachment {
  role: Role;
  /** Set when a newer socket for the same role took over this one. */
  replaced?: boolean;
}

/** An SSE client sink (browser EventSource can only receive). */
interface SseSink {
  role: Role;
  enqueue: (chunk: string) => void;
  close: () => void;
}

export class Room implements DurableObject {
  private readonly state: DurableObjectState;
  private sseSinks = new Set<SseSink>();
  private keepalive: ReturnType<typeof setInterval> | null = null;

  constructor(state: DurableObjectState, _env: unknown) {
    this.state = state;
    // Room schema: one row keyed store for persisted state.
    this.state.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL)`
    );
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    switch (url.pathname) {
      case "/ws":
        return this.handleWs(request);
      case "/sse":
        return this.handleSse(request);
      case "/send":
        return this.handleSend(request);
      case "/state":
        return this.handleGetState();
      default:
        return new Response("not found", { status: 404 });
    }
  }

  // ---------------------------------------------------------------- WebSockets

  private async handleWs(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("expected websocket upgrade", { status: 426 });
    }
    const pair = new WebSocketPair();
    const server = pair[1];
    this.state.acceptWebSocket(server);
    // Join happens on first message so we can attach the role.
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  private async handleJoin(ws: WebSocket, msg: Extract<ClientMessage, { t: "join" }>): Promise<void> {
    const role = msg.role;
    // Capacity: exactly one sender and one receiver per room.
    const existing = this.roleOfSocket(ws) ? null : this.findRole(role);
    if (existing) {
      // Takeover instead of rejection. A TV waking from standby (Silk, Tizen,
      // webOS) or a phone that switched Wi-Fi still holds a half-open socket
      // that the edge has not reaped yet — often for minutes. Refusing the
      // reconnect stranded that device on "offline" until the room expired,
      // so the newest socket wins and the stale one retires quietly.
      const staleWs = existing as WebSocket;
      if (typeof staleWs.close === "function" && typeof staleWs.serializeAttachment === "function") {
        try {
          staleWs.serializeAttachment({ role, replaced: true } satisfies SocketAttachment);
          staleWs.close(4001, "replaced by a newer connection");
        } catch {
          /* already gone — nothing to retire */
        }
      }
      for (const sink of [...this.sseSinks]) {
        if (sink.role !== role) continue;
        try {
          sink.close();
        } catch {
          /* already closed */
        }
        this.sseSinks.delete(sink);
      }
    }

    ws.serializeAttachment({ role } satisfies SocketAttachment);
    if (msg.caps) this.kvSet(`caps:${role}`, JSON.stringify(msg.caps));

    const peerRole: Role = role === "sender" ? "receiver" : "sender";
    const peerCapsRaw = this.kvGet(`caps:${peerRole}`);
    const persisted = this.loadState();

    this.sendTo(ws, {
      t: "joined",
      code: msg.code,
      role,
      peers: this.countPeers(),
      // Checked after the attachment is set, so the joiner can never be its own
      // "peer". findRole() also reports SSE sinks, which are not WebSockets.
      peerPresent: this.findRole(peerRole) !== null,
      state: role === "receiver" ? undefined : persisted ?? undefined,
      peerCaps: peerCapsRaw ? (JSON.parse(peerCapsRaw) as ReceiverCaps) : undefined,
    });
    this.notifyPeersOf(ws, { t: "peer-joined", role, caps: msg.caps });
    this.touchTtl();
  }

  // -------------------------------------------------------------------- SSE

  private handleSse(request: Request): Response {
    const role = (new URL(request.url).searchParams.get("role") as Role) || "receiver";
    const enc = new TextEncoder();
    let sink: SseSink | null = null;

    const stream = new ReadableStream({
      start: (controller) => {
        sink = {
          role,
          enqueue: (chunk) => controller.enqueue(enc.encode(chunk)),
          close: () => {
            try {
              controller.close();
            } catch {
              /* already closed */
            }
          },
        };
        this.sseSinks.add(sink);
        if (!this.keepalive) {
          this.keepalive = setInterval(() => {
            for (const s of this.sseSinks) s.enqueue(": ka\n\n");
          }, SSE_KEEPALIVE_MS);
        }
        sink.enqueue(`retry: 3000\n\n`);
      },
      cancel: () => {
        if (sink) this.sseSinks.delete(sink);
        if (this.sseSinks.size === 0 && this.keepalive) {
          clearInterval(this.keepalive);
          this.keepalive = null;
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  private async handleSend(request: Request): Promise<Response> {
    if (request.method === "OPTIONS") return this.preflight();
    const raw = await request.text();
    const { parseClientMessage } = await import("@streamcaster/shared");
    const msg = parseClientMessage(raw);
    if (!msg) return new Response("bad message", { status: 400 });
    await this.routeClientMessage(msg);
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  private async handleGetState(): Promise<Response> {
    const state = this.loadState();
    return new Response(JSON.stringify({ state }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  private preflight(): Response {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  // ------------------------------------------------------------- Message flow

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== "string") return;
    const { parseClientMessage } = await import("@streamcaster/shared");
    const msg = parseClientMessage(message);
    if (!msg) return;
    if (msg.t === "join" && !this.roleOfSocket(ws)) {
      await this.handleJoin(ws, msg);
      return;
    }
    await this.routeClientMessage(msg, ws);
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const att = this.tryAttachment(ws);
    // A socket retired by a takeover must not tell the peer the device left —
    // its replacement has already joined under the same role.
    if (att?.role && !att.replaced) {
      this.broadcastExcept(ws, { t: "peer-left", role: att.role });
    }
  }

  private async routeClientMessage(msg: ClientMessage, fromWs?: WebSocket): Promise<void> {
    switch (msg.t) {
      case "ping":
        this.replyToSource(fromWs, { t: "pong", ts: msg.ts });
        return;
      case "join":
        // SSE clients join via a synthetic path: register sink role
        this.registerSseJoin(msg);
        return;
      case "webrtc":
        this.forwardToPeer(msg, fromWs);
        return;
      case "cmd":
        if (msg.op.name === "load" || msg.op.name === "stop") {
          this.saveState({
            currentUrl: msg.op.name === "load" ? msg.op.url : undefined,
            title: msg.op.name === "load" ? msg.op.title : undefined,
          });
        }
        this.forwardToPeer(msg, fromWs);
        return;
      case "state":
        this.saveState(msg.state);
        this.forwardToPeer(msg, fromWs);
        return;
      case "leave":
        this.closeAll();
        return;
    }
  }

  private registerSseJoin(msg: Extract<ClientMessage, { t: "join" }>): void {
    const sink = [...this.sseSinks].find((s) => s.role === msg.role);
    if (msg.caps) this.kvSet(`caps:${msg.role}`, JSON.stringify(msg.caps));
    const peerRole: Role = msg.role === "sender" ? "receiver" : "sender";
    const peerCapsRaw = this.kvGet(`caps:${peerRole}`);
    if (sink) {
      sink.enqueue(
        `data: ${JSON.stringify({
          t: "joined",
          code: msg.code,
          role: msg.role,
          peers: this.countPeers(),
          peerPresent: this.findRole(peerRole) !== null,
          state: msg.role === "receiver" ? undefined : this.loadState() ?? undefined,
          peerCaps: peerCapsRaw ? JSON.parse(peerCapsRaw) : undefined,
        } satisfies ServerMessage)}\n\n`
      );
    }
    this.notifyPeersOf(null, { t: "peer-joined", role: msg.role, caps: msg.caps });
    this.touchTtl();
  }

  // ----------------------------------------------------------------- Helpers

  private replyToSource(fromWs: WebSocket | undefined, msg: ServerMessage): void {
    if (fromWs) {
      this.sendTo(fromWs, msg);
    } else {
      // came from POST /send (SSE client) — reply to all SSE sinks of that role
      for (const s of this.sseSinks) s.enqueue(`data: ${JSON.stringify(msg)}\n\n`);
    }
  }

  private forwardToPeer(msg: ServerMessage, fromWs: WebSocket | undefined): void {
    let delivered = false;
    for (const peer of this.state.getWebSockets()) {
      if (peer === fromWs) continue;
      const att = this.tryAttachment(peer);
      if (!att) continue;
      // Only forward across roles (sender<->receiver)
      const fromRole = fromWs ? this.roleOfSocket(fromWs) : undefined;
      if (fromRole && att.role === fromRole) continue;
      this.sendTo(peer, msg);
      delivered = true;
    }
    // SSE peers (receiver fallback path)
    const fromRole = fromWs ? this.roleOfSocket(fromWs) : undefined;
    for (const s of this.sseSinks) {
      if (fromRole && s.role === fromRole) continue;
      s.enqueue(`data: ${JSON.stringify(msg)}\n\n`);
      delivered = true;
    }
    if (!delivered) {
      // No peer connected; state commands are still persisted (handled upstream).
    }
  }

  private broadcastExcept(except: WebSocket | null, msg: ServerMessage): void {
    for (const peer of this.state.getWebSockets()) {
      if (peer !== except) this.sendTo(peer, msg);
    }
    for (const s of this.sseSinks) s.enqueue(`data: ${JSON.stringify(msg)}\n\n`);
  }

  private notifyPeersOf(joined: WebSocket | null, msg: ServerMessage): void {
    for (const peer of this.state.getWebSockets()) {
      if (peer !== joined) this.sendTo(peer, msg);
    }
    for (const s of this.sseSinks) s.enqueue(`data: ${JSON.stringify(msg)}\n\n`);
  }

  private sendTo(ws: WebSocket, msg: ServerMessage): void {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      /* socket closing */
    }
  }

  private roleOfSocket(ws: WebSocket): Role | null {
    return this.tryAttachment(ws)?.role ?? null;
  }

  private tryAttachment(ws: WebSocket): SocketAttachment | null {
    try {
      // workers-types historically types deserializeAttachment() without args;
      // the runtime accepts an optional attachment name.
      const api = ws as unknown as { deserializeAttachment(name?: string): unknown };
      return api.deserializeAttachment("role") as SocketAttachment;
    } catch {
      return null;
    }
  }

  /** Returns the WS occupying the role, or null if free. SSE sinks count as occupied. */
  private findRole(role: Role): WebSocket | null {
    for (const ws of this.state.getWebSockets()) {
      if (this.roleOfSocket(ws) === role) return ws;
    }
    const sseOccupied = [...this.sseSinks].some((s) => s.role === role);
    return sseOccupied ? ({} as WebSocket) : null; // occupied but not addressable as WS
  }

  private countPeers(): number {
    return this.state.getWebSockets().length + this.sseSinks.size;
  }

  private closeAll(): void {
    for (const ws of this.state.getWebSockets()) {
      try {
        ws.close(1000, "room closed");
      } catch {
        /* ignore */
      }
    }
    for (const s of this.sseSinks) s.close();
    this.sseSinks.clear();
  }

  // ------------------------------------------------------------------ Storage

  private kvGet(key: string): string | null {
    const row = this.state.storage.sql
      .exec<{ value: string }>(`SELECT value FROM kv WHERE key = ?`, key)
      .toArray()[0];
    return row?.value ?? null;
  }

  private kvSet(key: string, value: string): void {
    this.state.storage.sql.exec(
      `INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      key,
      value
    );
  }

  private loadState(): PlaybackState | null {
    const raw = this.kvGet("state");
    return raw ? (JSON.parse(raw) as PlaybackState) : null;
  }

  private saveState(state: PlaybackState): void {
    this.kvSet("state", JSON.stringify(state));
  }

  // --------------------------------------------------------------------- TTL

  private touchTtl(): void {
    this.kvSet("lastActivity", String(Date.now()));
    this.state.storage.setAlarm(Date.now() + ROOM_TTL_MS);
  }

  async alarm(): Promise<void> {
    const last = Number(this.kvGet("lastActivity") ?? "0");
    if (Date.now() - last >= ROOM_TTL_MS) {
      this.closeAll();
      this.state.storage.sql.exec(`DELETE FROM kv`);
      await this.state.storage.deleteAll();
    } else {
      this.state.storage.setAlarm(last + ROOM_TTL_MS);
    }
  }
}
