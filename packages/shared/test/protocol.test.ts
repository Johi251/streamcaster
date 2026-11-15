import { describe, expect, it } from "vitest";
import { parseClientMessage, parseServerMessage, MAX_MESSAGE_CHARS } from "../src/protocol.js";

describe("parseClientMessage validation (security review 2026-11-15)", () => {
  it("rejects malformed JSON and non-objects", () => {
    expect(parseClientMessage("{")).toBeNull();
    expect(parseClientMessage("null")).toBeNull();
    expect(parseClientMessage("[]")).toBeNull();
    expect(parseClientMessage("42")).toBeNull();
  });

  it("rejects unknown message types", () => {
    expect(parseClientMessage('{"t":"wipe"}')).toBeNull();
    expect(parseClientMessage('{"t":7}')).toBeNull();
    expect(parseClientMessage("{}")).toBeNull();
  });

  it("rejects a cmd frame without a valid op (used to crash the Room DO)", () => {
    expect(parseClientMessage('{"t":"cmd"}')).toBeNull();
    expect(parseClientMessage('{"t":"cmd","op":null}')).toBeNull();
    expect(parseClientMessage('{"t":"cmd","op":{"name":"unknown"}}')).toBeNull();
  });

  it("rejects invalid roles, kinds and ping payloads", () => {
    expect(parseClientMessage('{"t":"join","role":"admin","code":"ABC234"}')).toBeNull();
    expect(parseClientMessage('{"t":"webrtc","kind":"bogus"}')).toBeNull();
    expect(parseClientMessage('{"t":"ping","ts":"now"}')).toBeNull();
  });

  it("rejects oversized frames", () => {
    expect(parseClientMessage("x".repeat(MAX_MESSAGE_CHARS + 1))).toBeNull();
  });

  it("still accepts every legitimate frame shape", () => {
    expect(parseClientMessage('{"t":"join","role":"receiver","code":"ABC234"}')?.t).toBe("join");
    expect(parseClientMessage('{"t":"cmd","op":{"name":"play"}}')?.t).toBe("cmd");
    expect(parseClientMessage('{"t":"cmd","op":{"name":"load","url":"https://x/y.mp4"}}')?.t).toBe("cmd");
    expect(parseClientMessage('{"t":"state","state":{"paused":true}}')?.t).toBe("state");
    expect(parseClientMessage('{"t":"webrtc","kind":"offer","payload":{}}')?.t).toBe("webrtc");
    expect(parseClientMessage('{"t":"ping","ts":1}')?.t).toBe("ping");
    expect(parseClientMessage('{"t":"leave"}')?.t).toBe("leave");
  });
});

describe("parseServerMessage validation", () => {
  it("accepts known server frames and rejects unknown ones", () => {
    expect(parseServerMessage('{"t":"pong","ts":1}')?.t).toBe("pong");
    expect(parseServerMessage('{"t":"surprise"}')).toBeNull();
    expect(parseServerMessage("not json")).toBeNull();
  });
});
