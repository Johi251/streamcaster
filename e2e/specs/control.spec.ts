import { expect } from "@playwright/test";
import { test } from "./fixtures";
import { castUrl, pair } from "../helpers";

test("play/pause/seek/volume/stop round-trips", async ({ context, baseURL }) => {
  const { receiver, sender } = await pair(context);
  await castUrl(sender, `${baseURL}/r/media/sample.mp4`);

  const videoState = () =>
    receiver.evaluate(() => {
      const v = document.getElementById("player") as HTMLVideoElement;
      return { paused: v.paused, t: v.currentTime, vol: v.volume, hasSrc: v.src !== "" || !!v.srcObject };
    });

  await expect
    .poll(videoState, { timeout: 20_000 })
    .toMatchObject({ paused: false });

  await sender.locator("#pause-btn").click();
  await expect.poll(videoState, { timeout: 10_000 }).toMatchObject({ paused: true });

  await sender.locator("#play-btn").click();
  await expect.poll(videoState, { timeout: 10_000 }).toMatchObject({ paused: false });

  // seek near the end (4s asset → 3.2s)
  await sender.locator("#seek").evaluate((el: HTMLInputElement) => {
    el.value = "800";
    el.dispatchEvent(new Event("input"));
  });
  await expect.poll(async () => (await videoState()).t, { timeout: 10_000 }).toBeGreaterThan(2.5);

  await sender.locator("#vol").evaluate((el: HTMLInputElement) => {
    el.value = "30";
    el.dispatchEvent(new Event("change"));
  });
  await expect.poll(async () => (await videoState()).vol, { timeout: 10_000 }).toBeCloseTo(0.3);

  await sender.locator("#stop-btn").click();
  await expect(receiver.locator("#idle")).toBeVisible({ timeout: 10_000 });
});
