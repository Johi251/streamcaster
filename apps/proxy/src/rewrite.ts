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

// --------------------------------------------------------------------- /browse

/**
 * Injected into every proxied page. Monkey-patches media playback so the real
 * media URL is reported up to the parent StreamCaster frame (which then offers
 * it as a cast candidate). Works for elements present at load, created later
 * (SPA players), and ones started via `.play()`.
 */
export const BROWSE_INJECT = `<script>(function(){
function report(u,t){if(!u)return;try{parent.postMessage({__sc:true,type:'media',url:u,title:t||document.title},'*');}catch(e){}}
function bind(v){if(v.__sc)return;v.__sc=true;
 v.addEventListener('loadstart',function(){report(this.currentSrc||this.src,document.title);});
 v.addEventListener('playing',function(){report(this.currentSrc||this.src,document.title);});
 var p=v.play;v.play=function(){try{report(this.currentSrc||this.src,document.title);}catch(e){}return p.apply(this,arguments);};}
 if(document.querySelectorAll){document.querySelectorAll('video,audio').forEach(bind);}
 try{new MutationObserver(function(muts){muts.forEach(function(m){m.addedNodes.forEach(function(n){if(n.nodeType!==1)return;var els=(n.tagName==='VIDEO'||n.tagName==='AUDIO')?[n]:(n.querySelectorAll?n.querySelectorAll('video,audio'):[]);if(els.forEach)els.forEach(bind);else for(var i=0;i<els.length;i++)bind(els[i]);});});}).observe(document.documentElement,{childList:true,subtree:true});}catch(e){}
})();</script>`;

export interface BrowseContext {
  /** Absolute origin of the page being proxied, e.g. https://aniworld.to */
  targetOrigin: string;
  /** This proxy's origin, e.g. https://streamcaster-proxy.workers.dev */
  proxyOrigin: string;
  /** Absolute URL the HTML was fetched from (resolution base for relatives). */
  base: string;
}

/**
 * Turn an attribute value into a proxied URL when it points at the same origin
 * (absolute or relative). Cross-origin values are left untouched.
 */
function absolutize(value: string, ctx: BrowseContext): string {
  const v = value.trim();
  if (!v || /^(#|javascript:|mailto:|tel:|data:|blob:)/i.test(v)) return v;
  let abs: string;
  try {
    abs = new URL(v, ctx.base).toString();
  } catch {
    return v;
  }
  const isRelative = /^\.{0,2}\//.test(v);
  if (abs.startsWith(ctx.targetOrigin) || isRelative) {
    return `${ctx.proxyOrigin}/browse?url=${encodeURIComponent(abs)}`;
  }
  return v; // cross-origin absolute — leave as-is
}

function rewriteAttr(html: string, attr: string, tagFilter: string | null, ctx: BrowseContext): string {
  const re = tagFilter
    ? new RegExp(`(<(?:${tagFilter})\\b[^>]*?)\\b${attr}\\s*=\\s*("([^"]*)"|'([^']*)')`, "gi")
    : new RegExp(`\\b${attr}\\s*=\\s*("([^"]*)"|'([^']*)')`, "gi");
  return html.replace(re, (...args: unknown[]) => {
    const m = args[0] as string;
    let pre = "";
    let dq: string | undefined;
    let sq: string | undefined;
    if (tagFilter) {
      pre = args[1] as string;
      dq = args[3] as string | undefined;
      sq = args[4] as string | undefined;
    } else {
      dq = args[2] as string | undefined;
      sq = args[3] as string | undefined;
    }
    const val = dq !== undefined ? dq : (sq ?? "");
    const quote = dq !== undefined ? '"' : "'";
    const newVal = absolutize(val, ctx);
    if (newVal === val) return m;
    return `${pre}${attr}=${quote}${newVal}${quote}`;
  });
}

/**
 * Rewrite a target page for in-proxy browsing:
 *  - links + form actions + media/iframe src that point at the same origin are
 *    re-routed through `/browse?url=` so navigation stays captured;
 *  - cross-origin links get `target="_blank"` so they don't break the proxy
 *    frame;
 *  - the media-capture script is injected so play() reveals the real URL.
 */
export function rewriteBrowseHtml(html: string, ctx: BrowseContext): string {
  let out = html;
  out = rewriteAttr(out, "href", null, ctx);
  out = rewriteAttr(out, "action", null, ctx);
  out = rewriteAttr(out, "src", "iframe|img|video|audio", ctx);

  // Open cross-origin anchors in a new tab (keep the proxy frame alive).
  out = out.replace(/(<a\b[^>]*?)\bhref\s*=\s*("https?:\/\/[^"]*"|'https?:\/\/[^']*')/gi, (m, pre: string, hrefq: string) => {
    const url = hrefq.slice(1, -1);
    try {
      if (new URL(url).host === new URL(ctx.targetOrigin).host) return m;
    } catch {
      return m;
    }
    if (/\btarget\s*=/.test(pre)) return m;
    return `${pre}target="_blank" rel="noopener noreferrer" href=${hrefq}`;
  });

  if (/<head[^>]*>/i.test(out)) {
    out = out.replace(/<head[^>]*>/i, (m) => m + BROWSE_INJECT);
  } else if (/<html[^>]*>/i.test(out)) {
    out = out.replace(/<html[^>]*>/i, (m) => m + BROWSE_INJECT);
  } else {
    out = BROWSE_INJECT + out;
  }
  return out;
}
