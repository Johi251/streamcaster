/**
 * StreamCaster signaling Worker.
 * Routes room-scoped requests to per-room Durable Objects:
 *   GET  /ws?code=&role=   -> WebSocket signaling (routed into Room DO)
 *   GET  /sse?code=&role=  -> SSE fallback stream
 *   POST /send?code=       -> ClientMessage from SSE-only clients
 *   GET  /health           -> liveness
 */
import { Room } from "./room.js";

export { Room };

export interface Env {
  ROOM: DurableObjectNamespace;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function normalizeCode(raw: string | null): string | null {
  if (!raw) return null;
  const code = raw.toUpperCase().replace(/[^0-9A-Z]/g, "");
  return code.length === 6 ? code : null;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }

    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ ok: true, ts: Date.now() }), {
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    const code = normalizeCode(url.searchParams.get("code"));
    if (!code) {
      return new Response(JSON.stringify({ t: "error", code: "bad_room", message: "Missing or invalid room code." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    const id = env.ROOM.idFromName(code);
    const stub = env.ROOM.get(id);

    // Rewrite the URL so the DO sees the logical endpoint without the query-based room key.
    const target = new URL(request.url);
    switch (url.pathname) {
      case "/ws":
        target.pathname = "/ws";
        break;
      case "/sse":
        target.pathname = "/sse";
        break;
      case "/send":
        target.pathname = "/send";
        break;
      case "/state":
        target.pathname = "/state";
        break;
      default:
        return new Response("not found", { status: 404, headers: CORS });
    }

    const roomRequest = new Request(target.toString(), request);
    const response = await stub.fetch(roomRequest);

    // WebSocket handshake must be passed through as a bare 101 with the socket.
    const ws = (response as unknown as { webSocket?: WebSocket }).webSocket;
    if (ws) return new Response(null, { status: 101, webSocket: ws });

    const headers = new Headers(response.headers);
    for (const [k, v] of Object.entries(CORS)) headers.set(k, v);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  },
} satisfies ExportedHandler<Env>;
