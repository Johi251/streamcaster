/**
 * SSRF / abuse guards for the proxy Worker. Pure functions — unit-testable
 * outside the Workers runtime.
 */

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "[::1]",
  "metadata.google.internal",
  "169.254.169.254",
]);

/** Content types the proxy is willing to relay or rewrite. */
const ALLOWED_MIME_PATTERNS: RegExp[] = [
  /^text\/html/i,
  /^application\/json/i,
  /^application\/vnd\.apple\.mpegurl/i,
  /^application\/x-mpegurl/i,
  /^application\/dash\+xml/i,
  /^video\/mp4/i,
  /^video\/webm/i,
  /^video\/mp2t/i,
  /^audio\/mp2t/i,
  /^application\/octet-stream/i, // many CDNs serve segments with this
  /^binary\/octet-stream/i,
];

export interface GuardResult {
  ok: boolean;
  status: number;
  reason: string;
  url?: URL;
}

/** Validate a `url` query parameter for proxying. */
export function guardUrl(raw: string | null, opts: { httpsOnly?: boolean } = {}): GuardResult {
  if (!raw) return { ok: false, status: 400, reason: "missing url parameter" };
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, status: 400, reason: "invalid url" };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, status: 400, reason: "unsupported protocol" };
  }
  if (opts.httpsOnly !== false && url.protocol !== "https:") {
    return { ok: false, status: 400, reason: "https only" };
  }
  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(host)) {
    return { ok: false, status: 403, reason: "blocked host" };
  }
  // Block obvious private-range literals (IPv4 + bracketed IPv6).
  if (
    /^(10|127|0)\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^169\.254\./.test(host) ||
    host.startsWith("192.0.2.") ||
    host.endsWith(".internal") ||
    host.endsWith(".local")
  ) {
    return { ok: false, status: 403, reason: "private address blocked" };
  }
  return { ok: true, status: 200, reason: "", url };
}

/** Check an upstream response content type against the relay whitelist. */
export function isAllowedContentType(contentType: string | null): boolean {
  if (!contentType) return true; // some CDNs omit it; segments still work via /seg
  const mime = contentType.split(";")[0]!.trim().toLowerCase();
  return ALLOWED_MIME_PATTERNS.some((re) => re.test(mime));
}

/** Narrow a fetch Response's content-type for routing decisions. */
export function normalizeMime(contentType: string | null): string {
  if (!contentType) return "";
  return contentType.split(";")[0]!.trim().toLowerCase();
}
