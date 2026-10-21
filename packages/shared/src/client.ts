/**
 * Browser-side signaling client.
 * Connects via WebSocket; falls back to SSE (receive) + POST /send (transmit)
 * for TV browsers with unreliable WebSocket support (e.g. Fire TV Silk).
 */
import type { ClientMessage, ReceiverCaps, Role, ServerMessage } from "./protocol.js";

export type SignalingStatus = "connecting" | "ws" | "sse" | "closed" | "error";

export interface SignalingHandlers {
  onMessage: (msg: ServerMessage) => void;
  onStatus: (status: SignalingStatus) => void;
}

const WS_OPEN_TIMEOUT_MS = 5000;

export class SignalingClient {
  private ws: WebSocket | null = null;
  private es: EventSource | null = null;
  private code = "";
  private role: Role = "sender";
  private caps?: ReceiverCaps;
  private joined = false;
  private closedByUser = false;
  private heartbeat: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly baseUrl: string,
    private readonly handlers: SignalingHandlers
  ) {}

  connect(code: string, role: Role, caps?: ReceiverCaps): void {
    this.code = code;
    this.role = role;
    this.caps = caps;
    this.closedByUser = false;
    this.joined = false;
    this.handlers.onStatus("connecting");
    this.openWebSocket();
  }

  send(msg: ClientMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
      return;
    }
    if (this.es) {
      void fetch(`${this.baseUrl}/send?code=${this.code}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(msg),
      }).catch(() => undefined);
    }
  }

  close(): void {
    this.closedByUser = true;
    this.stopHeartbeat();
    this.ws?.close(1000, "bye");
    this.es?.close();
    this.ws = null;
    this.es = null;
    this.handlers.onStatus("closed");
  }

  // ------------------------------------------------------------------ paths

  private openWebSocket(): void {
    const wsUrl = this.baseUrl.replace(/^http/, "ws") + `/ws?code=${this.code}`;
    let settled = false;
    const ws = new WebSocket(wsUrl);
    this.ws = ws;

    const openTimeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        ws.close();
        this.openSse();
      }
    }, WS_OPEN_TIMEOUT_MS);

    ws.onopen = () => {
      // Wait for `joined` before declaring victory — some proxies accept the
      // upgrade then stall. The timeout above covers the stall case.
      ws.send(JSON.stringify({ t: "join", role: this.role, code: this.code, caps: this.caps }));
    };

    ws.onmessage = (ev) => {
      const msg = this.parse(ev.data as string);
      if (!msg) return;
      if (msg.t === "joined" && !this.joined) {
        this.joined = true;
        settled = true;
        clearTimeout(openTimeout);
        this.handlers.onStatus("ws");
        this.startHeartbeat();
      }
      this.handlers.onMessage(msg);
    };

    ws.onerror = () => {
      if (!settled) {
        settled = true;
        clearTimeout(openTimeout);
        this.openSse();
      }
    };

    ws.onclose = () => {
      this.stopHeartbeat();
      if (this.closedByUser) return;
      if (!settled) {
        settled = true;
        clearTimeout(openTimeout);
        this.openSse();
      } else if (this.joined) {
        // Dropped mid-session: degrade to SSE instead of dying.
        this.joined = false;
        this.openSse();
      }
    };
  }

  private openSse(): void {
    if (this.closedByUser) return;
    this.es?.close();
    this.handlers.onStatus("sse");
    const es = new EventSource(`${this.baseUrl}/sse?code=${this.code}&role=${this.role}`);
    this.es = es;

    es.onopen = () => {
      // SSE cannot send; register ourselves via POST.
      void fetch(`${this.baseUrl}/send?code=${this.code}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ t: "join", role: this.role, code: this.code, caps: this.caps }),
      });
    };

    es.onmessage = (ev) => {
      const msg = this.parse(ev.data);
      if (!msg) return;
      if (msg.t === "joined") this.joined = true;
      this.handlers.onMessage(msg);
    };

    es.onerror = () => {
      // EventSource auto-reconnects; nothing to do unless we never got in.
    };
  }

  // -------------------------------------------------------------- internals

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeat = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ t: "ping", ts: Date.now() }));
      }
    }, 30_000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeat) {
      clearInterval(this.heartbeat);
      this.heartbeat = null;
    }
  }

  private parse(raw: string): ServerMessage | null {
    try {
      const data: unknown = JSON.parse(raw);
      if (typeof data === "object" && data !== null && "t" in data) return data as ServerMessage;
      return null;
    } catch {
      return null;
    }
  }
}
