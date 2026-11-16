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
  // Prefer the back camera (environment); fall back to front (user) if unavailable.
  // On unsupported browsers, userMedia throws PermissionDeniedError — callers should
  // show a friendly message instead of the raw error message.
  try {
    return navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment", width: { ideal: 1280 } },
      audio: true,
    });
  } catch (err) {
    if (err instanceof PermissionDeniedError) {
      throw new Error(
        "Camera permission denied — the page needs access to your camera to mirror it. Check your settings."
      );
    }
    // Other devices may only have the front camera.
    if ((err as Error).code === "notsupported" || (err as Error).code === "invalid-arguments") {
      return navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 } },
        audio: true,
      });
    }
    throw err;
  }
}
