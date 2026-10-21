/**
 * Page-level media URL detection.
 * Fetch: direct first (many origins send CORS *), proxy /fetch fallback.
 * Parse: DOMParser scan + heuristics from research findings → ranked candidates.
 */

import type { Candidate } from "./heuristics.js";
import { DATA_ATTRS, MEDIA_EXT_RE, OG_VIDEO_PROPS, VIDEO_SELECTORS, scoreOf } from "./heuristics.js";

export interface DetectOptions {
  /** Proxy origin, e.g. https://streamcaster-proxy.example.workers.dev */
  proxyOrigin: string;
  signal?: AbortSignal;
}

export async function probePage(pageUrl: string, opts: DetectOptions): Promise<Candidate[]> {
  const html = await fetchPageHtml(pageUrl, opts);
  if (!html) return [];
  return rank(scanHtml(html, pageUrl));
}

async function fetchPageHtml(pageUrl: string, opts: DetectOptions): Promise<string | null> {
  // 1. direct
  try {
    const res = await fetch(pageUrl, { signal: opts.signal, redirect: "follow" });
    if (res.ok) {
      const mime = (res.headers.get("content-type") ?? "").split(";")[0]!.toLowerCase();
      if (mime.includes("html") || mime.includes("json") || mime === "") {
        const text = await res.text();
        if (text.length <= 2 * 1024 * 1024) return text;
      }
    }
  } catch {
    // CORS or network — fall through to proxy
  }
  // 2. proxy
  try {
    const res = await fetch(`${opts.proxyOrigin}/fetch?url=${encodeURIComponent(pageUrl)}`, {
      signal: opts.signal,
    });
    if (res.ok) return await res.text();
  } catch {
    // proxy unreachable — give up quietly
  }
  return null;
}

/** Pure: parse HTML text into ranked candidates. Exported for tests. */
export function scanHtml(html: string, pageUrl: string): Candidate[] {
  const candidates: Candidate[] = [];
  const base = pageUrl;

  const push = (raw: string, source: Candidate["source"], mime?: string): void => {
    try {
      const abs = new URL(raw, base).toString();
      if (abs.startsWith("https://") || abs.startsWith("http://")) {
        candidates.push({ url: abs, mime, source, score: scoreOf(source) });
      }
    } catch {
      // ignore malformed
    }
  };

  const doc = new DOMParser().parseFromString(html, "text/html");

  // <video src> / <source src>
  for (const sel of VIDEO_SELECTORS) {
    doc.querySelectorAll(sel).forEach((n) => {
      const src = n.getAttribute("src");
      if (src) {
        const type = n.getAttribute("type") ?? undefined;
        push(src, sel === "video[src]" ? "video-src" : "video-source", type || undefined);
      }
    });
  }

  // og:video meta tags
  for (const prop of OG_VIDEO_PROPS) {
    const meta = doc.querySelector(`meta[property="${prop}"], meta[name="${prop}"]`);
    const content = meta?.getAttribute("content");
    if (content) push(content, "og-video");
  }

  // twitter player stream
  const tw = doc.querySelector('meta[name="twitter:player:stream"]');
  const twContent = tw?.getAttribute("content");
  if (twContent) push(twContent, "twitter-stream");

  // JSON-LD VideoObject
  doc.querySelectorAll('script[type="application/ld+json"]').forEach((s) => {
    try {
      const data: unknown = JSON.parse(s.textContent ?? "");
      collectJsonLd(data, push);
    } catch {
      // malformed JSON-LD — skip
    }
  });

  // <link rel=alternate type=application/vnd.apple.mpegurl>
  doc.querySelectorAll('link[rel="alternate"]').forEach((l) => {
    const type = l.getAttribute("type") ?? "";
    if (/mpegurl/i.test(type) && l.getAttribute("href")) push(l.getAttribute("href")!, "hls-alternate", type);
  });

  // data-* lazy-load attrs
  doc.querySelectorAll("*").forEach((n) => {
    for (const attr of DATA_ATTRS) {
      const v = n.getAttribute(attr);
      if (v && /^(https?:)?\/\//.test(v)) push(v, "data-attr");
    }
  });

  // raw regex over the whole document (script configs, inline JSON)
  for (const match of html.matchAll(MEDIA_EXT_RE)) {
    push(match[0], "url-regex");
  }

  return candidates;
}

function collectJsonLd(
  node: unknown,
  push: (raw: string, source: Candidate["source"], mime?: string) => void
): void {
  if (Array.isArray(node)) {
    node.forEach((n) => collectJsonLd(n, push));
    return;
  }
  if (typeof node !== "object" || node === null) return;
  const obj = node as Record<string, unknown>;
  const types = obj["@type"];
  const isVideo =
    types === "VideoObject" ||
    (Array.isArray(types) && types.includes("VideoObject")) ||
    typeof obj.contentUrl === "string";
  if (isVideo) {
    if (typeof obj.contentUrl === "string") push(obj.contentUrl, "json-ld");
    else if (typeof obj.embedUrl === "string") push(obj.embedUrl, "json-ld");
  }
  for (const v of Object.values(obj)) collectJsonLd(v, push);
}

/** De-duplicate by URL, keep highest score, sort desc, cap at 8. */
export function rank(candidates: Candidate[]): Candidate[] {
  const best = new Map<string, Candidate>();
  for (const c of candidates) {
    const prev = best.get(c.url);
    if (!prev || c.score > prev.score) best.set(c.url, c);
  }
  return [...best.values()].sort((a, b) => b.score - a.score).slice(0, 8);
}

export function sourceLabel(c: Candidate): string {
  const labels: Record<Candidate["source"], string> = {
    "video-src": "video element",
    "video-source": "source element",
    "url-regex": "direct link",
    "og-video": "og:video",
    "json-ld": "JSON-LD",
    "twitter-stream": "twitter:stream",
    "hls-alternate": "HLS link",
    "player-config": "player config",
    "data-attr": "lazy-load attr",
  };
  return labels[c.source];
}
