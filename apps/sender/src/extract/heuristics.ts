/**
 * Media-URL heuristics — data-driven from research/url-extraction-findings.md.
 * Ordered by priority; consumers stop at the first list that yields candidates
 * (but collect across all for ranking).
 */

export interface Candidate {
  url: string;
  mime?: string;
  /** Where it was found — used for ranking + UI hint. */
  source:
    | "video-src"
    | "video-source"
    | "url-regex"
    | "og-video"
    | "json-ld"
    | "twitter-stream"
    | "hls-alternate"
    | "player-config"
    | "data-attr";
  score: number;
}

export const MEDIA_EXT_RE =
  /https?:\/\/[^\s"'<>\\]+?\.(?:m3u8|mpd|mp4|webm)(?:\?[^\s"'<>\\]*)?/gi;

export const RANK: Record<Candidate["source"], number> = {
  "video-src": 100,
  "video-source": 95,
  "url-regex": 90,
  "og-video": 85,
  "json-ld": 80,
  "twitter-stream": 70,
  "hls-alternate": 65,
  "player-config": 50,
  "data-attr": 40,
};

export function scoreOf(source: Candidate["source"]): number {
  return RANK[source];
}

/** DOM selectors for <video>/<source> candidates. */
export const VIDEO_SELECTORS = ["video[src]", "video > source[src]", "audio > source[src]"];

/** Meta-tag property names carrying direct media URLs. */
export const OG_VIDEO_PROPS = ["og:video:url", "og:video:secure_url", "og:video"];

/** attribute names scanned on all elements (lazy-load conventions). */
export const DATA_ATTRS = ["data-video", "data-mp4", "data-src", "data-hls"];
