import { describe, expect, it } from "vitest";
import { mimeToCastType, toCastIntent, castUaSupported } from "./chromecast.js";
import type { CommandOp } from "@streamcaster/shared";

// castUaSupported depends on navigator.userAgent — stub it.
function withUa(ua: string): boolean {
  const orig = navigator.userAgent;
  Object.defineProperty(navigator, "userAgent", { value: ua, configurable: true, writable: true });
  try {
    return castUaSupported();
  } finally {
    Object.defineProperty(navigator, "userAgent", { value: orig, configurable: true, writable: true });
  }
}

describe("castUaSupported", () => {
  it("accepts desktop Chrome", () => {
    expect(
      withUa(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
      )
    ).toBe(true);
  });
  it("accepts Android Chrome", () => {
    expect(
      withUa("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36")
    ).toBe(true);
  });
  it("rejects iOS Safari and iOS Chrome (CriOS)", () => {
    expect(
      withUa("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1")
    ).toBe(false);
    expect(
      withUa("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.0.0 Mobile/15E148 Safari/604.1")
    ).toBe(false);
  });
  it("rejects Firefox and Safari desktop", () => {
    expect(withUa("Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0")).toBe(false);
    expect(
      withUa("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15")
    ).toBe(false);
  });
});

describe("mimeToCastType", () => {
  it("maps HLS variants", () => {
    expect(mimeToCastType("application/vnd.apple.mpegurl")).toBe("application/x-mpegurl");
    expect(mimeToCastType(undefined, "https://x.example/a.m3u8?tok=1")).toBe("application/x-mpegurl");
  });
  it("maps mp4 and webm", () => {
    expect(mimeToCastType("video/mp4")).toBe("video/mp4");
    expect(mimeToCastType(undefined, "https://x.example/a.webm")).toBe("video/webm");
    expect(mimeToCastType(undefined, "https://x.example/a.mp4")).toBe("video/mp4");
  });
  it("defaults to mp4", () => {
    expect(mimeToCastType()).toBe("video/mp4");
  });
});

describe("toCastIntent", () => {
  it("maps load with mime detection", () => {
    const op: CommandOp = { name: "load", url: "https://x.example/v.m3u8" };
    const intent = toCastIntent(op);
    expect(intent).toEqual({
      kind: "load",
      url: "https://x.example/v.m3u8",
      contentType: "application/x-mpegurl",
      title: undefined,
    });
  });
  it("maps volume 0 to mute", () => {
    expect(toCastIntent({ name: "volume", value: 0 })).toEqual({ kind: "mute", muted: true });
  });
  it("maps volume 0.5 to level", () => {
    expect(toCastIntent({ name: "volume", value: 0.5 })).toEqual({ kind: "volume", level: 0.5 });
  });
  it("marks stream ops unsupported", () => {
    expect(toCastIntent({ name: "stream-start", kind: "screen" }).kind).toBe("unsupported");
    expect(toCastIntent({ name: "file-meta", filename: "a.mp4", size: 1, mime: "video/mp4" }).kind).toBe("unsupported");
    expect(toCastIntent({ name: "subtitle", content: "WEBVTT" }).kind).toBe("unsupported");
  });
  it("maps seek, play, pause, stop", () => {
    expect(toCastIntent({ name: "seek", time: 12.5 })).toEqual({ kind: "seek", time: 12.5 });
    expect(toCastIntent({ name: "play" }).kind).toBe("play");
    expect(toCastIntent({ name: "pause" }).kind).toBe("pause");
    expect(toCastIntent({ name: "stop" }).kind).toBe("stop");
  });
});
