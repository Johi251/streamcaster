/**
 * m3u8 manifest URL rewriter. Pure functions — unit-tested without Workers.
 *
 * Every URI inside the manifest (segments, keys, variant playlists, maps,
 * renditions) is rewritten to a URL on this proxy:
 *   - variant/media playlist references  ->  {BASE}/hls?url=<abs>
 *   - everything else (segments, keys)   ->  {BASE}/seg?url=<abs>
 * EXT-X-KEY contents are never modified beyond the URI — no key material is
 * touched (DRM-protected manifests fail naturally in the player).
 */

/** Manifest that references other playlists (master) vs. media playlist. */
export function isMasterPlaylist(manifest: string): boolean {
  return /^#EXT-X-STREAM-INF/m.test(manifest);
}

export interface RewriteContext {
  /** Absolute URL the manifest was fetched from (resolution base). */
  manifestUrl: string;
  /** Proxy origin, e.g. https://streamcaster-proxy.example.workers.dev */
  proxyOrigin: string;
}

/** Rewrite a single relative/absolute URI into a proxy URL. */
export function rewriteUri(uri: string, ctx: RewriteContext, isPlaylistRef: boolean): string {
  if (/^(data:|blob:)/i.test(uri)) return uri;
  const absolute = new URL(uri, ctx.manifestUrl).toString();
  const route = isPlaylistRef ? "hls" : "seg";
  return `${ctx.proxyOrigin}/${route}?url=${encodeURIComponent(absolute)}`;
}

/**
 * Rewrite all URIs in an m3u8 manifest. Handles the line-oriented tags that
 * carry URIs: EXT-X-STREAM-INF (next line), EXT-X-I-FRAME-STREAM-INF (attr),
 * EXT-X-MEDIA (attr URI=), EXT-X-KEY / EXT-X-MAP (attr URI=), and bare
 * segment lines.
 */
export function rewriteManifest(manifest: string, ctx: RewriteContext): string {
  const lines = manifest.split(/\r?\n/);
  const out: string[] = [];

  let pendingStreamInf = false;
  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("#EXT-X-STREAM-INF")) {
      pendingStreamInf = true;
      out.push(line);
      continue;
    }
    if (pendingStreamInf && trimmed !== "" && !trimmed.startsWith("#")) {
      out.push(rewriteUri(trimmed, ctx, true));
      pendingStreamInf = false;
      continue;
    }
    pendingStreamInf = false;

    if (trimmed.startsWith("#EXT-X-I-FRAME-STREAM-INF") || trimmed.startsWith("#EXT-X-MEDIA")) {
      out.push(rewriteAttrUri(trimmed, ctx, true));
      continue;
    }
    if (trimmed.startsWith("#EXT-X-KEY") || trimmed.startsWith("#EXT-X-MAP")) {
      out.push(rewriteAttrUri(trimmed, ctx, false));
      continue;
    }
    if (trimmed !== "" && !trimmed.startsWith("#")) {
      out.push(rewriteUri(trimmed, ctx, false));
      continue;
    }
    out.push(line);
  }
  return out.join("\n") + (manifest.endsWith("\n") ? "\n" : "");
}

/** Rewrite `URI="…"` inside a tag line (#EXT-X-KEY, #EXT-X-MAP, #EXT-X-MEDIA). */
function rewriteAttrUri(line: string, ctx: RewriteContext, isPlaylistRef: boolean): string {
  return line.replace(/URI="([^"]+)"/g, (_m, uri: string) => `URI="${rewriteUri(uri, ctx, isPlaylistRef)}"`);
}
