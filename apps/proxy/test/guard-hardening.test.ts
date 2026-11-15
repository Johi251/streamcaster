import { describe, expect, it } from "vitest";
import { guardUrl } from "../src/guard.js";

describe("guardUrl hardening (security review 2026-11-15)", () => {
  it("rejects credentials embedded in the URL", () => {
    expect(guardUrl("https://user:pass@example.com/video.mp4").ok).toBe(false);
  });

  it("rejects non-standard ports so the relay cannot scan ports", () => {
    expect(guardUrl("https://example.com:22/x").ok).toBe(false);
    expect(guardUrl("https://example.com:8080/x").ok).toBe(false);
    expect(guardUrl("https://example.com:443/x").ok).toBe(true);
  });

  it("blocks private/link-local/mapped IPv6 literals", () => {
    expect(guardUrl("https://[fc00::1]/x").ok).toBe(false);
    expect(guardUrl("https://[fe80::1]/x").ok).toBe(false);
    expect(guardUrl("https://[::1]/x").ok).toBe(false);
    expect(guardUrl("https://[::ffff:127.0.0.1]/x").ok).toBe(false);
  });

  it("blocks localhost variants", () => {
    expect(guardUrl("https://app.localhost/x").ok).toBe(false);
    expect(guardUrl("https://box.localdomain/x").ok).toBe(false);
  });

  it("blocks normalized IPv4 spellings (WHATWG collapses them to 127.0.0.1)", () => {
    expect(guardUrl("https://2130706433/x").ok).toBe(false);
    expect(guardUrl("https://0x7f000001/x").ok).toBe(false);
    expect(guardUrl("https://0177.0.0.1/x").ok).toBe(false);
  });

  it("still accepts ordinary public origins", () => {
    expect(guardUrl("https://cdn.example.com/master.m3u8?token=1").ok).toBe(true);
  });
});
