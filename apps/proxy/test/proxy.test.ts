import { describe, expect, it } from "vitest";
import { guardUrl, isAllowedContentType } from "../src/guard.js";
import { isMasterPlaylist, rewriteManifest, rewriteUri, rewriteBrowseHtml, BROWSE_INJECT } from "../src/rewrite.js";
import { isAdHost, stripAdMarkup } from "../src/blocklist.js";

describe("guardUrl", () => {
  it("accepts https URLs", () => {
    const r = guardUrl("https://example.com/video.m3u8");
    expect(r.ok).toBe(true);
  });
  it("rejects missing and malformed urls", () => {
    expect(guardUrl(null).ok).toBe(false);
    expect(guardUrl("not a url").ok).toBe(false);
    expect(guardUrl("ftp://example.com/x").ok).toBe(false);
  });
  it("rejects http when httpsOnly (default)", () => {
    expect(guardUrl("http://example.com/x").ok).toBe(false);
    expect(guardUrl("http://example.com/x", { httpsOnly: false }).ok).toBe(true);
  });
  it("blocks localhost and private ranges", () => {
    expect(guardUrl("https://localhost/x").ok).toBe(false);
    expect(guardUrl("https://127.0.0.1/x").ok).toBe(false);
    expect(guardUrl("https://10.0.0.5/x").ok).toBe(false);
    expect(guardUrl("https://192.168.1.1/x").ok).toBe(false);
    expect(guardUrl("https://172.16.0.1/x").ok).toBe(false);
    expect(guardUrl("https://169.254.169.254/latest/meta-data").ok).toBe(false);
    expect(guardUrl("https://box.internal/x").ok).toBe(false);
    expect(guardUrl("https://tv.local/x").ok).toBe(false);
  });
  it("allows public hosts", () => {
    expect(guardUrl("https://172.32.0.1/x").ok).toBe(true); // 172.32 is public
    expect(guardUrl("https://cdn.example.com/seg1.ts").ok).toBe(true);
  });
});

describe("isAllowedContentType", () => {
  it("allows media and document types", () => {
    expect(isAllowedContentType("text/html; charset=utf-8")).toBe(true);
    expect(isAllowedContentType("application/vnd.apple.mpegurl")).toBe(true);
    expect(isAllowedContentType("application/x-mpegurl")).toBe(true);
    expect(isAllowedContentType("video/mp4")).toBe(true);
    expect(isAllowedContentType("video/mp2t")).toBe(true);
    expect(isAllowedContentType("application/octet-stream")).toBe(true);
    expect(isAllowedContentType("application/json")).toBe(true);
  });
  it("rejects unknown types", () => {
    expect(isAllowedContentType("text/css")).toBe(false);
    expect(isAllowedContentType("application/wasm")).toBe(false);
  });
  it("allows missing content type (segments on some CDNs)", () => {
    expect(isAllowedContentType(null)).toBe(true);
  });
});

describe("isMasterPlaylist", () => {
  it("detects master playlists", () => {
    expect(isMasterPlaylist("#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1000\nv0.m3u8\n")).toBe(true);
  });
  it("detects media playlists", () => {
    expect(isMasterPlaylist("#EXTM3U\n#EXTINF:4.0,\nseg0.ts\n")).toBe(false);
  });
});

describe("rewriteUri", () => {
  const ctx = { manifestUrl: "https://cdn.example.com/live/master.m3u8", proxyOrigin: "https://p.example.workers.dev" };
  it("resolves relative URIs and wraps as seg", () => {
    expect(rewriteUri("seg0.ts", ctx, false)).toBe(
      "https://p.example.workers.dev/seg?url=" + encodeURIComponent("https://cdn.example.com/live/seg0.ts")
    );
  });
  it("wraps playlist refs as hls", () => {
    expect(rewriteUri("v0/index.m3u8", ctx, true)).toBe(
      "https://p.example.workers.dev/hls?url=" + encodeURIComponent("https://cdn.example.com/live/v0/index.m3u8")
    );
  });
  it("passes through data URIs", () => {
    expect(rewriteUri("data:text/plain,x", ctx, false)).toBe("data:text/plain,x");
  });
  it("resolves absolute URIs unchanged in target", () => {
    expect(rewriteUri("https://other.example.com/a.ts", ctx, false)).toBe(
      "https://p.example.workers.dev/seg?url=" + encodeURIComponent("https://other.example.com/a.ts")
    );
  });
});

describe("rewriteManifest", () => {
  const ctx = { manifestUrl: "https://cdn.example.com/live/master.m3u8", proxyOrigin: "https://p.example.workers.dev" };

  it("rewrites variant playlist lines after EXT-X-STREAM-INF", () => {
    const src = "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360\nv0.m3u8\n";
    const out = rewriteManifest(src, ctx);
    expect(out).toContain("/hls?url=" + encodeURIComponent("https://cdn.example.com/live/v0.m3u8"));
    expect(out).not.toMatch(/^v0\.m3u8$/m);
  });

  it("rewrites segment lines and preserves EXTINF", () => {
    const src = "#EXTM3U\n#EXTINF:4.0,\nseg0.ts\n#EXTINF:4.0,\nseg1.ts\n#EXT-X-ENDLIST\n";
    const out = rewriteManifest(src, ctx);
    expect(out).toContain("#EXTINF:4.0,");
    expect(out).toContain("/seg?url=" + encodeURIComponent("https://cdn.example.com/live/seg0.ts"));
    expect(out).toContain("#EXT-X-ENDLIST");
  });

  it("rewrites EXT-X-KEY and EXT-X-MAP URIs as seg without touching METHOD", () => {
    const src = '#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="key.bin",IV=0x1\n#EXT-X-MAP:URI="init.mp4"\nseg0.ts\n';
    const out = rewriteManifest(src, ctx);
    expect(out).toContain("METHOD=AES-128");
    expect(out).toContain('URI="' + "https://p.example.workers.dev/seg?url=" + encodeURIComponent("https://cdn.example.com/live/key.bin") + '"');
    expect(out).toContain(encodeURIComponent("https://cdn.example.com/live/init.mp4"));
  });

  it("rewrites EXT-X-MEDIA and I-FRAME-STREAM-INF URI attributes as hls", () => {
    const src = '#EXTM3U\n#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="aud",NAME="en",URI="audio.m3u8"\n' +
      '#EXT-X-I-FRAME-STREAM-INF:BANDWIDTH=90000,URI="iframe.m3u8"\n';
    const out = rewriteManifest(src, ctx);
    expect(out).toContain(encodeURIComponent("https://cdn.example.com/live/audio.m3u8"));
    expect(out).toContain(encodeURIComponent("https://cdn.example.com/live/iframe.m3u8"));
  });
});

describe("rewriteBrowseHtml", () => {
  const ctx = {
    targetOrigin: "https://aniworld.to",
    proxyOrigin: "https://streamcaster-proxy.workers.dev",
    base: "https://aniworld.to/anime/stream/foo/staffel-4/episode-18",
  };

  it("injects the media-capture script into <head>", () => {
    const html = "<html><head><title>x</title></head><body><video></video></body></html>";
    const out = rewriteBrowseHtml(html, ctx);
    expect(out).toContain(BROWSE_INJECT);
    expect(out.indexOf(BROWSE_INJECT)).toBeLessThan(out.indexOf("</head>"));
  });

  it("re-routes same-origin links through /browse", () => {
    const html = '<a href="/episode/19">next</a>';
    const out = rewriteBrowseHtml(html, ctx);
    expect(out).toContain("/browse?url=" + encodeURIComponent("https://aniworld.to/episode/19"));
  });

  it("re-routes root-relative iframe src through /browse", () => {
    const html = '<iframe src="/embed/player"></iframe>';
    const out = rewriteBrowseHtml(html, ctx);
    expect(out).toContain("/browse?url=" + encodeURIComponent("https://aniworld.to/embed/player"));
  });

  it("leaves cross-origin links alone but opens them in a new tab", () => {
    const html = '<a href="https://ads.example.com/x">ad</a>';
    const out = rewriteBrowseHtml(html, ctx);
    expect(out).not.toContain("/browse?url=");
    expect(out).toContain('target="_blank"');
    expect(out).toContain('rel="noopener noreferrer"');
  });

  it("does not rewrite cross-origin absolute img src", () => {
    const html = '<img src="https://cdn.other.com/poster.jpg">';
    const out = rewriteBrowseHtml(html, ctx);
    expect(out).toContain('src="https://cdn.other.com/poster.jpg"');
    expect(out).not.toContain("/browse?url=");
  });

  it("absolutizes same-origin absolute href", () => {
    const html = '<a href="https://aniworld.to/login">login</a>';
    const out = rewriteBrowseHtml(html, ctx);
    expect(out).toContain("/browse?url=" + encodeURIComponent("https://aniworld.to/login"));
  });
});

describe("ad filtering", () => {
  it("matches ad hosts and their subdomains only", () => {
    expect(isAdHost("https://securepubads.g.doubleclick.net/tag/js/gpt.js")).toBe(true);
    expect(isAdHost("//pagead2.googlesyndication.com/pagead/js/adsbygoogle.js")).toBe(true);
    expect(isAdHost("https://cdn.taboola.com/libtrc/x.js")).toBe(true);
    expect(isAdHost("https://aniworld.to/js/app.js")).toBe(false);
    // suffix match must not fire on a lookalike domain
    expect(isAdHost("https://notdoubleclick.net/x.js")).toBe(false);
    expect(isAdHost("nonsense")).toBe(false);
  });

  it("removes ad scripts, keeps the site's own", () => {
    const html =
      '<head><script src="https://securepubads.g.doubleclick.net/tag/js/gpt.js"></script>' +
      '<script src="/js/app.js"></script></head>';
    const { html: out, removed } = stripAdMarkup(html);
    expect(removed).toBe(1);
    expect(out).not.toContain("doubleclick");
    expect(out).toContain("/js/app.js");
  });

  it("removes ad iframes, pixels and preconnect links", () => {
    const html =
      '<iframe src="https://ads.example-adnet.com/frame"></iframe>' +
      '<img src="https://www.googleadservices.com/pagead/conversion/1">' +
      '<link rel="preconnect" href="https://adnxs.com">' +
      '<img src="/poster.jpg">';
    // example-adnet is not on the list; the other two are
    const { html: out, removed } = stripAdMarkup(html);
    expect(removed).toBe(2);
    expect(out).toContain("example-adnet"); // unknown host stays
    expect(out).not.toContain("googleadservices");
    expect(out).not.toContain("adnxs.com");
    expect(out).toContain("/poster.jpg");
  });

  it("drops adsbygoogle slots", () => {
    const { html: out, removed } = stripAdMarkup('<ins class="adsbygoogle" data-ad-slot="1"></ins>');
    expect(removed).toBe(1);
    expect(out).toBe("");
  });

  it("leaves a page without ads byte-identical apart from the injection", () => {
    const html = "<html><head></head><body><p>hi</p></body></html>";
    const out = rewriteBrowseHtml(html, {
      targetOrigin: "https://aniworld.to",
      proxyOrigin: "https://proxy.test",
      base: "https://aniworld.to/serie/1",
    });
    expect(out).toContain("<p>hi</p>");
    expect(out).toContain("sc-adblock");
    expect(out).toContain('"url":"https://aniworld.to/serie/1"');
    expect(out).toContain('"blocked":0');
  });

  it("reports the number of removed elements to the parent", () => {
    const html =
      '<html><head><script src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"></script></head><body></body></html>';
    const out = rewriteBrowseHtml(html, {
      targetOrigin: "https://aniworld.to",
      proxyOrigin: "https://proxy.test",
      base: "https://aniworld.to/",
    });
    expect(out).toContain('"blocked":1');
    // the script tag is gone (the CSS selector mentioning the host may remain)
    expect(out).not.toContain("pagead/js/adsbygoogle.js");
  });
});
