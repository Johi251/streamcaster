import { describe, it, expect } from "vitest";
import { parseSafeUrl } from "./linkPreview.js";

describe("parseSafeUrl", () => {
  it("accepts https and strips a leading www.", () => {
    const r = parseSafeUrl("https://www.example.com/path?x=1");
    expect(r.ok).toBe(true);
    expect(r.domain).toBe("example.com");
  });

  it("accepts http", () => {
    const r = parseSafeUrl("http://example.com");
    expect(r.ok).toBe(true);
    expect(r.domain).toBe("example.com");
  });

  it("rejects a string that is not a URL", () => {
    const r = parseSafeUrl("not a url");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("invalid");
  });

  it("rejects javascript: scheme", () => {
    const r = parseSafeUrl("javascript:alert(1)");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("scheme");
  });

  it("rejects data: scheme", () => {
    const r = parseSafeUrl("data:text/html,<script>");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("scheme");
  });

  it("rejects file: scheme", () => {
    const r = parseSafeUrl("file:///etc/passwd");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("scheme");
  });

  it("rejects the empty string", () => {
    const r = parseSafeUrl("");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("invalid");
  });

  it("keeps a subdomain as the domain", () => {
    const r = parseSafeUrl("https://watch.aniworld.to/foo");
    expect(r.ok).toBe(true);
    expect(r.domain).toBe("watch.aniworld.to");
  });
});
