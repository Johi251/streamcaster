import { describe, expect, it } from "vitest";
import { limitBody } from "../src/limit.js";

/** A stream that emits one chunk per requested size. */
function chunked(sizes: number[]): ReadableStream<Uint8Array> {
  let i = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i >= sizes.length) return controller.close();
      controller.enqueue(new Uint8Array(sizes[i++]!));
    },
  });
}

async function totalBytes(stream: ReadableStream<Uint8Array> | null): Promise<number> {
  if (!stream) return -1;
  const reader = stream.getReader();
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return total;
    total += value.byteLength;
  }
}

describe("limitBody", () => {
  it("passes a multi-chunk body through unchanged when under the cap", async () => {
    // Regression: the old desiredSize check closed the stream after chunk #1.
    const out = limitBody(chunked([10, 20, 30]), 100);
    expect(await totalBytes(out)).toBe(60);
  });

  it("caps a large body at or below maxBytes", async () => {
    const out = limitBody(chunked([10, 20, 30, 40, 50]), 45);
    expect(await totalBytes(out)).toBeLessThanOrEqual(45);
  });

  it("does not enqueue a single oversized chunk", async () => {
    const out = limitBody(chunked([1000]), 32);
    expect(await totalBytes(out)).toBe(0);
  });

  it("returns null for a null body", () => {
    expect(limitBody(null, 100)).toBeNull();
  });
});
