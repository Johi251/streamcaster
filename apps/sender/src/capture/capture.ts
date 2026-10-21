/** Capture helpers with capability gating. */

export function canMirror(): boolean {
  return typeof navigator.mediaDevices !== "undefined" && typeof navigator.mediaDevices.getDisplayMedia === "function";
}

export function canCamera(): boolean {
  return typeof navigator.mediaDevices !== "undefined" && typeof navigator.mediaDevices.getUserMedia === "function";
}

export async function captureScreen(): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { frameRate: { ideal: 30, max: 30 } },
    audio: true,
  });
  // Auto-stop when the user ends sharing from the browser UI.
  stream.getVideoTracks()[0]?.addEventListener("ended", () => {
    stream.getTracks().forEach((t) => t.stop());
  });
  return stream;
}

export async function captureCamera(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    video: { facingMode: "environment", width: { ideal: 1280 } },
    audio: true,
  });
}
