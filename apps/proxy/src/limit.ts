/**
 * Bound a response body by BYTES.
 *
 * Why this exists: the previous implementation compared
 * `controller.desiredSize` against a byte constant. desiredSize is a
 * backpressure signal measured in chunks (default highWaterMark = 1), not a
 * byte counter, so the comparison was always true and the stream was closed
 * after the very first chunk. Small fixtures hide that bug because they arrive
 * in one chunk; real pages and media do not.
 *
 * One reader per stream, created once. Creating a reader inside `pull()` would
 * throw on the second pull because the stream is already locked.
 */
export function limitBody(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number
): ReadableStream<Uint8Array> | null {
  if (!body) return null;
  const reader = body.getReader();
  let bytes = 0;

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) return controller.close();
      // Strict bound: drop the chunk that would cross it. Headers are already
      // committed at this point, so truncation is the only safe outcome —
      // but it guarantees total <= maxBytes even for a single huge chunk.
      if (bytes + value.byteLength > maxBytes) {
        void reader.cancel();
        return controller.close();
      }
      bytes += value.byteLength;
      controller.enqueue(value);
    },
    cancel() {
      void reader.cancel();
    },
  });
}
