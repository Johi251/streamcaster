import { expect } from "@playwright/test";
import { test } from "./fixtures";
import { pair } from "../helpers";

/**
 * Live-stream transport validation via WebRTC.
 *
 * Uses the Camera path with Chromium's fake device (--use-fake-device-for-
 * media-stream). Screen mirroring goes through the exact same
 * SenderPeer/ReceiverPeer negotiation — only the capture API differs
 * (getDisplayMedia), which headless Chromium cannot auto-confirm.
 * Manual check for screen mirroring: open sender in headed Chrome, click
 * "Mirror screen", accept the picker.
 */
test("live stream: sender camera reaches receiver via WebRTC", async ({ context }) => {
  const { receiver, sender } = await pair(context);

  await sender.locator("#camera-btn").click();
  await expect(sender.locator("#now-title")).toHaveText("Camera (live)", { timeout: 15_000 });

  await expect
    .poll(
      () =>
        receiver.evaluate(() => {
          const v = document.getElementById("player") as HTMLVideoElement;
          return { srcObject: !!v.srcObject, w: v.videoWidth, ready: v.readyState };
        }),
      { timeout: 30_000 }
    )
    .toMatchObject({ srcObject: true, w: 640 });
});
