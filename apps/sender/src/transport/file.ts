/**
 * Chunked file sender over an RTCDataChannel with backpressure.
 * 16 KiB chunks; waits for bufferedAmountLow when the send buffer fills.
 */
import { FILE_CHUNK_SIZE, FILE_BUFFER_LOW } from "@streamcaster/shared";

export async function sendFile(
  dc: RTCDataChannel,
  file: File,
  onProgress?: (sentBytes: number, total: number) => void
): Promise<void> {
  // Hold the receiver's slot: meta arrives as a cmd via signaling before this runs.
  const reader = file.stream().getReader();
  let sent = 0;

  // Wait until the channel opens.
  if (dc.readyState !== "open") {
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("Data channel did not open (WebRTC connection failed).")), 12_000);
      dc.addEventListener("open", () => {
        clearTimeout(t);
        resolve();
      }, { once: true });
      dc.addEventListener("error", () => {
        clearTimeout(t);
        reject(new Error("Data channel error."));
      }, { once: true });
    });
  }

  const waitDrain = (): Promise<void> =>
    new Promise((resolve) => {
      if (dc.bufferedAmount <= FILE_BUFFER_LOW) {
        resolve();
        return;
      }
      const onLow = () => {
        dc.removeEventListener("bufferedamountlow", onLow);
        resolve();
      };
      dc.addEventListener("bufferedamountlow", onLow);
    });

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      // value is a Uint8Array; send in FILE_CHUNK_SIZE slices
      for (let offset = 0; offset < value.byteLength; offset += FILE_CHUNK_SIZE) {
        const slice = value.subarray(offset, Math.min(offset + FILE_CHUNK_SIZE, value.byteLength));
        // Copy into a plain ArrayBuffer — structuredClone of subarrays can misbehave on some browsers
        const buf = slice.buffer.slice(slice.byteOffset, slice.byteOffset + slice.byteLength);
        dc.send(buf);
        sent += slice.byteLength;
        if (dc.bufferedAmount > FILE_BUFFER_LOW * 2) await waitDrain();
      }
      onProgress?.(sent, file.size);
    }
    dc.send("EOF");
    onProgress?.(file.size, file.size);
  } finally {
    reader.releaseLock();
  }
}
