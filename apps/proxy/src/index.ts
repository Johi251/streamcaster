/**
 * StreamCaster media proxy Worker.
 *
 * Why: hls.js needs CORS headers on manifests and segments; many origins do
 * not send them. Also, sender-side page probing (`/fetch`) needs a CORS-safe
 * way to read third-party HTML. This Worker is the only sanctioned middleman.
 *
 * Free-tier design: manifest rewriting is CPU-light (string pass); segments
 * are pure streaming pass-through (~0 CPU). Direct-URL-first policy in the
 * sender keeps proxy volume minimal.
 *
 * Hardened against SSRF: https-only, private/loopback host block, redirect
 * cap, content-type whitelist, size caps. No caching layer (personal scale).
 */

import { guardUrl, isAllowedContentType, normalizeMime } from "./guard.js";
import { rewriteManifest } from "./rewrite.js";

const MAX_FETCH_BYTES = 2 * 1024 * 1024; // /fetch: HTML/JSON probes
const MAX_MANIFEST_BYTES = 1024 * 1024; // /hls: m3u8 manifests
const MAX_REDIRECTS = 3;
const CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, HEAD, OPTIONS",
  "access-control-allow-headers": "range, origin, content-type",
  "access-control-expose-headers": "content-length, content-range, content-type, accept-ranges",
};

interface Env {
  /** Set to "1" ONLY in dev/E2E to allow http + private hosts (local fixtures). */
  ALLOW_PRIVATE_TARGETS?: string;
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return json({ error: "method not allowed" }, 405);
    }

    const guardOpts = { httpsOnly: env.ALLOW_PRIVATE_TARGETS !== "1", allowPrivate: env.ALLOW_PRIVATE_TARGETS === "1" };
    const url = new URL(request.url);
    try {
      switch (url.pathname) {
        case "/health":
          return json({ ok: true, routes: ["/fetch", "/hls", "/seg", "/health"] });
        case "/fetch":
          return await handleFetch(request, guardOpts);
        case "/hls":
          return await handleHls(request, guardOpts);
        case "/seg":
          return await handleSeg(request, guardOpts);
        default:
          return json({ error: "not found" }, 404);
      }
    } catch (e) {
      return json({ error: String(e) }, 502);
    }
  },
};

// ------------------------------------------------------------------- /fetch

async function handleFetch(request: Request, guardOpts: { httpsOnly?: boolean; allowPrivate?: boolean }): Promise<Response> {
  const target = guardUrl(new URL(request.url).searchParams.get("url"), guardOpts);
  if (!target.ok || !target.url) return json({ error: target.reason }, target.status);

  const upstream = await fetchWithRedirectCap(
    target.url,
    { headers: { "user-agent": "Mozilla/5.0 (compatible; StreamCasterBot/1.0)" } },
    guardOpts
  );
  const mime = normalizeMime(upstream.headers.get("content-type"));
  if (!isAllowedContentType(upstream.headers.get("content-type"))) {
    return json({ error: "content type not allowed: " + mime }, 415);
  }

  const reader = upstream.body?.getReader();
  if (!reader) return json({ error: "upstream returned no body" }, 502);

  // Enforce the 2 MB cap while streaming through.
  const limited = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) return controller.close();
      controller.enqueue(value);
      if (controller.desiredSize !== null && controller.desiredSize > -MAX_FETCH_BYTES) {
        void reader.cancel();
        controller.close();
      }
    },
    cancel() {
      void reader.cancel();
    },
  });

  return new Response(limited, {
    status: upstream.status,
    headers: {
      ...CORS_HEADERS,
      "content-type": upstream.headers.get("content-type") ?? "text/html",
      "cache-control": "no-store",
    },
  });
}

// --------------------------------------------------------------------- /hls

async function handleHls(request: Request, guardOpts: { httpsOnly?: boolean; allowPrivate?: boolean }): Promise<Response> {
  const target = guardUrl(new URL(request.url).searchParams.get("url"), guardOpts);
  if (!target.ok || !target.url) return json({ error: target.reason }, target.status);

  const upstream = await fetchWithRedirectCap(target.url, {}, guardOpts);
  const mime = normalizeMime(upstream.headers.get("content-type"));
  if (!isAllowedContentType(upstream.headers.get("content-type"))) {
    return json({ error: "content type not allowed: " + mime }, 415);
  }

  const text = await upstream.text();
  if (text.length > MAX_MANIFEST_BYTES) {
    return json({ error: "manifest too large" }, 413);
  }

  const rewritten = rewriteManifest(text, {
    manifestUrl: upstream.url || target.url.toString(),
    proxyOrigin: new URL(request.url).origin,
  });

  return new Response(rewritten, {
    status: upstream.status,
    headers: {
      ...CORS_HEADERS,
      "content-type": "application/vnd.apple.mpegurl",
      "cache-control": "no-store",
    },
  });
}

// --------------------------------------------------------------------- /seg

async function handleSeg(request: Request, guardOpts: { httpsOnly?: boolean; allowPrivate?: boolean }): Promise<Response> {
  const target = guardUrl(new URL(request.url).searchParams.get("url"), guardOpts);
  if (!target.ok || !target.url) return json({ error: target.reason }, target.status);

  const range = request.headers.get("range");
  const upstream = await fetchWithRedirectCap(
    target.url,
    { headers: range ? { range } : {} },
    guardOpts
  );
  if (!isAllowedContentType(upstream.headers.get("content-type"))) {
    return json({ error: "content type not allowed" }, 415);
  }

  const headers: Record<string, string> = {
    ...CORS_HEADERS,
    "content-type": upstream.headers.get("content-type") ?? "application/octet-stream",
    "cache-control": "no-store",
  };
  const passThrough = ["content-length", "content-range", "accept-ranges"];
  for (const h of passThrough) {
    const v = upstream.headers.get(h);
    if (v) headers[h] = v;
  }

  return new Response(upstream.body, { status: upstream.status, headers });
}

// ------------------------------------------------------------------ helpers

/** fetch with manual redirect handling (cap 3) so we can re-check each hop. */
async function fetchWithRedirectCap(
  url: URL,
  init: RequestInit = {},
  guardOpts: { httpsOnly?: boolean; allowPrivate?: boolean } = {},
  depth = 0
): Promise<Response> {
  if (depth > MAX_REDIRECTS) throw new Error("too many redirects");
  const res = await fetch(url.toString(), { ...init, redirect: "manual" });
  if (res.status >= 300 && res.status < 400) {
    const loc = res.headers.get("location");
    if (!loc) return res;
    const next = new URL(loc, url);
    const check = guardUrl(next.toString(), guardOpts);
    if (!check.ok) throw new Error("redirect blocked: " + check.reason);
    void res.body?.cancel();
    return fetchWithRedirectCap(next, init, guardOpts, depth + 1);
  }
  return res;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "content-type": "application/json" },
  });
}
