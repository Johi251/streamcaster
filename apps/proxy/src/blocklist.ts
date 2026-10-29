/**
 * Ad/tracker filtering for the /browse proxy.
 *
 * Scope, honestly stated: only the HTML document passes through this Worker.
 * Sub-resources (scripts, images, ad iframes) are fetched by the browser
 * straight from their own origins, so a hostname blocklist on the network
 * layer would never see them. What we *can* do without proxying every byte of
 * a page is refuse to hand the ad markup over in the first place: drop
 * <script>/<iframe>/<img>/<link> elements whose host is a known ad network and
 * hide the usual ad containers with CSS. That kills a large share of the junk
 * on ordinary streaming sites, and it degrades gracefully — a page whose ads
 * we cannot identify simply keeps them.
 */

/**
 * Bare domains. Matched against the exact host and any subdomain, so
 * "doubleclick.net" also covers "securepubads.g.doubleclick.net".
 * Exported because the injected runtime blocker uses the very same list —
 * two lists would drift, and a host that only one of them knows is a hole.
 */
export const AD_HOSTS: readonly string[] = [
  // Google ad stack (not googletagmanager: site owners use it for real logic)
  "doubleclick.net",
  "googlesyndication.com",
  "googleadservices.com",
  "googletagservices.com",
  "adservice.google.com",
  "2mdn.net",
  // Amazon
  "amazon-adsystem.com",
  "assoc-amazon.com",
  // Big SSP / DSP networks
  "adnxs.com",
  "rubiconproject.com",
  "pubmatic.com",
  "openx.net",
  "casalemedia.com",
  "33across.com",
  "smartadserver.com",
  "adform.net",
  "adsrvr.org",
  "criteo.com",
  "criteo.net",
  "media.net",
  "yieldmo.com",
  "sharethrough.com",
  "teads.tv",
  "spotxchange.com",
  "aniview.com",
  "adition.com",
  "serving-sys.com",
  // Native / content recommendation
  "taboola.com",
  "outbrain.com",
  "revcontent.com",
  "mgid.com",
  // Verification / tracking pixels
  "moatads.com",
  "adsafeprotected.com",
  "scorecardresearch.com",
  "quantserve.com",
  "imrworldwide.com",
  "doubleverify.com",
];

/** True when the URL's host is (a subdomain of) a known ad host. */
export function isAdHost(rawUrl: string): boolean {
  let host: string;
  try {
    // Protocol-relative URLs are common in ad tags.
    host = new URL(rawUrl.startsWith("//") ? "https:" + rawUrl : rawUrl).hostname.toLowerCase();
  } catch {
    return false;
  }
  if (!host) return false;
  return AD_HOSTS.some((d) => host === d || host.endsWith("." + d));
}

/** Reads the URL out of a raw attribute value, ignoring entities/quotes. */
function hostOf(attrValue: string): string {
  return attrValue.trim();
}

/**
 * Drop ad elements from a document. Returns the rewritten HTML plus how many
 * elements were removed (shown to the user, so the feature is not invisible).
 *
 * Only paired/self-closing element shapes are handled; a script that builds an
 * ad tag at runtime (`document.write('<script src=…>')`) is out of reach here.
 */
export function stripAdMarkup(html: string): { html: string; removed: number } {
  let removed = 0;
  const drop = (m: string, url: string): string => {
    if (!isAdHost(hostOf(url))) return m;
    removed++;
    return "";
  };

  let out = html;

  // <script src="…">…</script> — paired form first (non-greedy body).
  out = out.replace(
    /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>[\s\S]*?<\/script\s*>/gi,
    (m, url: string) => drop(m, url)
  );
  // …and the self-closed / unclosed variant.
  out = out.replace(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>\s*<\/script\s*>/gi, (m, url: string) =>
    drop(m, url)
  );

  // <iframe src="…">…</iframe>
  out = out.replace(
    /<iframe\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>[\s\S]*?<\/iframe\s*>/gi,
    (m, url: string) => drop(m, url)
  );

  // <img src="…"> (tracking pixels, ad creatives)
  out = out.replace(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi, (m, url: string) => drop(m, url));

  // <link href="…"> — preconnect/preload of ad hosts is a reliable tell.
  out = out.replace(/<link\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>/gi, (m, url: string) => drop(m, url));

  // Google AdSense slots are markup-only; the script that fills them is gone.
  out = out.replace(/<ins\b[^>]*\bclass\s*=\s*["'][^"']*\badsbygoogle\b[^"']*["'][^>]*>[\s\S]*?<\/ins\s*>/gi, () => {
    removed++;
    return "";
  });

  return { html: out, removed };
}

/**
 * Hides containers that are left behind after the tags are gone, plus the
 * ones that only become visible once an ad script runs. Deliberately narrow:
 * no `[class*="ad"]`, that would eat "advertorial" content and half of some
 * layouts.
 */
export const AD_CSS = `<style id="sc-adblock">ins.adsbygoogle,.adsbygoogle,[id^="google_ads"],[id^="div-gpt-ad"],[id^="ad-slot"],[data-ad-slot],[class^="ad-slot"],[class*=" ad-slot"],.ad-banner,.ad-wrapper,.advertisement,#advertisement,[aria-label="Advertisement"],iframe[src*="doubleclick.net"],iframe[src*="googlesyndication.com"]{display:none!important}</style>`;
