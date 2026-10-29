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
import { rewriteManifest, rewriteBrowseHtml } from "./rewrite.js";

const MAX_FETCH_BYTES = 2 * 1024 * 1024; // /fetch: HTML/JSON probes
const MAX_MANIFEST_BYTES = 1024 * 1024; // /hls: m3u8 manifests
const MAX_BROWSE_BYTES = 5 * 1024 * 1024; // /browse: proxied page HTML
const MAX_PASSTHRU_BYTES = 32 * 1024 * 1024; // /p: arbitrary proxied resource
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
          return json({ ok: true, routes: ["/fetch", "/hls", "/seg", "/browse", "/p", "/health"] });
        case "/fetch":
          return await handleFetch(request, guardOpts);
        case "/hls":
          return await handleHls(request, guardOpts);
        case "/seg":
          return await handleSeg(request, guardOpts);
        case "/browse":
          return await handleBrowse(request, guardOpts);
        case "/p":
          return await handlePassthru(request, guardOpts);
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

// ------------------------------------------------------------------- /browse

/**
 * Load a third-party page through the proxy and rewrite it so:
 *  - the media-capture script is injected (reports real media URLs to the
 *    parent frame via postMessage);
 *  - same-origin links/forms/iframes stay routed through /browse, so the user
 *    can click around (pick an episode, hit play) and we keep capturing.
 *
 * Framing/CSP headers from the upstream are stripped so the page can be
 * embedded in our iframe and our injected script is allowed to run.
 */
async function handleBrowse(request: Request, guardOpts: { httpsOnly?: boolean; allowPrivate?: boolean }): Promise<Response> {
  const target = guardUrl(new URL(request.url).searchParams.get("url"), guardOpts);
  if (!target.ok || !target.url) return json({ error: target.reason }, target.status);

  const upstream = await fetchWithRedirectCap(target.url, {}, guardOpts);
  const ct = normalizeMime(upstream.headers.get("content-type")) || "text/html";
  if (!/^text\/html/i.test(ct) && !/application\/xhtml\+xml/i.test(ct)) {
    return json({ error: "not an HTML page: " + ct }, 415);
  }

  const text = await upstream.text();
  if (text.length > MAX_BROWSE_BYTES) {
    return json({ error: "page too large" }, 413);
  }

  const base = upstream.url || target.url.toString();
  const rewritten = rewriteBrowseHtml(text, {
    targetOrigin: new URL(base).origin,
    proxyOrigin: new URL(request.url).origin,
    base,
  });

  // Strip headers that would block iframing or block our injected script.
  const blockedHeaders = [
    "x-frame-options",
    "content-security-policy",
    "content-security-policy-report-only",
  ];
  const headers: Record<string, string> = {
    ...CORS_HEADERS,
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
  };
  for (const h of Object.keys(upstream.headers)) {
    if (blockedHeaders.includes(h.toLowerCase())) continue;
    const v = upstream.headers.get(h);
    if (v) headers[h] = v;
  }

  return new Response(rewritten, { status: 200, headers });
}

// ----------------------------------------------------------------------- /p

/**
 * Permissive passthrough proxy for any single resource (used to relay a media
 * URL or page the in-page capture script reports, and to serve captured assets
 * to the receiver). Forwards Range requests and streams the body with CORS.
 * Unlike /hls+/seg it does not restrict the content type, so it can carry
 * either media or an HTML page.
 */
async function handlePassthru(request: Request, guardOpts: { httpsOnly?: boolean; allowPrivate?: boolean }): Promise<Response> {
  const target = guardUrl(new URL(request.url).searchParams.get("url"), guardOpts);
  if (!target.ok || !target.url) return json({ error: target.reason }, target.status);

  const range = request.headers.get("range");
  const upstream = await fetchWithRedirectCap(
    target.url,
    { headers: range ? { range } : {} },
    guardOpts
  );

  const headers: Record<string, string> = {
    ...CORS_HEADERS,
    "content-type": upstream.headers.get("content-type") ?? "application/octet-stream",
    "cache-control": "no-store",
  };
  const passThrough = ["content-length", "content-range", "accept-ranges", "content-encoding", "content-disposition"];
  for (const h of passThrough) {
    const v = upstream.headers.get(h);
    if (v) headers[h] = v;
  }

  // Enforce an upper bound while streaming (32 MB) so a runaway asset can't
  // blow the Worker memory limit.
  const body = upstream.body;
  if (body && !upstream.headers.get("content-length")) {
    const limited = new ReadableStream<Uint8Array>({
      async pull(controller) {
        const { done, value } = await body.getReader().read();
        if (done) return controller.close();
        controller.enqueue(value);
        if (controller.desiredSize !== null && controller.desiredSize > -MAX_PASSTHRU_BYTES) {
          void body.cancel();
          controller.close();
        }
      },
      cancel() {
        void body.cancel();
      },
    });
    return new Response(limited, { status: upstream.status, headers });
  }
  return new Response(body, { status: upstream.status, headers });
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
