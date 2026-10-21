/**
 * Media URL probing: confirm a candidate actually serves media and decide
 * direct vs. proxied playback routing.
 *
 * Policy (DECISIONS.md D5):
 * - mp4/webm → ALWAYS direct on the receiver (<video src> needs no CORS).
 * - HLS (m3u8) → direct if the origin allows CORS; otherwise proxy /hls.
 * - mpd (DASH) → not playable by the receiver player; reported as unsupported.
 */

export interface MediaProbe {
  url: string;
  mime: string;
  size?: number;
  corsOk: boolean;
  /** URL to hand to the receiver (may be proxy-rewritten). */
  castUrl: string;
  playable: "mp4" | "hls" | "unsupported";
}

const PROXY_ORIGIN =
  (import.meta.env.VITE_PROXY_URL as string | undefined) ?? "";

export async function probeMedia(url: string): Promise<MediaProbe> {
  const kind = classify(url);
  if (kind === "unsupported") {
    return { url, mime: "", corsOk: false, castUrl: url, playable: "unsupported" };
  }

  const { corsOk, mime, size } = await probeCors(url);

  if (kind === "mp4") {
    return { url, mime, size, corsOk, castUrl: url, playable: "mp4" };
  }
  // HLS
  if (corsOk || !PROXY_ORIGIN) {
    return { url, mime, size, corsOk, castUrl: url, playable: "hls" };
  }
  return {
    url,
    mime,
    size,
    corsOk,
    castUrl: `${PROXY_ORIGIN}/hls?url=${encodeURIComponent(url)}`,
    playable: "hls",
  };
}

export function classify(url: string): "mp4" | "hls" | "unsupported" {
  const clean = url.split("#")[0]!;
  if (/\.m3u8(\?|$)/i.test(clean)) return "hls";
  // Already-proxied manifest URLs (receiver/player route) count as HLS.
  if (/\/hls\?url=/i.test(clean)) return "hls";
  if (/\.(mp4|webm|mov|m4v)(\?|$)/i.test(clean)) return "mp4";
  if (/\.mpd(\?|$)/i.test(clean)) return "unsupported"; // DASH: needs MSE shim, out of scope
  return "mp4"; // extension-less: let <video> try
}

interface CorsProbeResult {
  corsOk: boolean;
  mime: string;
  size?: number;
}

/** Ranged GET (direct first, proxy HEAD fallback) to learn mime + CORS. */
async function probeCors(url: string): Promise<CorsProbeResult> {
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { range: "bytes=0-0" },
    });
    if (res.ok || res.status === 206) {
      void res.body?.cancel();
      const mime = (res.headers.get("content-type") ?? "").split(";")[0]!.trim();
      const cr = res.headers.get("content-range"); // bytes 0-0/12345
      const total = cr?.split("/")[1];
      return {
        corsOk: true,
        mime,
        size: total && /^\d+$/.test(total) ? Number(total) : undefined,
      };
    }
  } catch {
    // CORS-blocked or network error
  }
  // Proxy fallback: learn mime but CORS on receiver is still unknown → assume blocked.
  if (PROXY_ORIGIN) {
    try {
      const res = await fetch(`${PROXY_ORIGIN}/fetch?url=${encodeURIComponent(url)}`, {
        method: "HEAD",
      });
      if (res.ok) {
        return {
          corsOk: false,
          mime: (res.headers.get("content-type") ?? "").split(";")[0]!.trim(),
        };
      }
    } catch {
      // proxy down — treat as blocked, mp4 still plays direct
    }
  }
  return { corsOk: false, mime: "" };
}
