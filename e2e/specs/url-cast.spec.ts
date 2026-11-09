import { expect } from "@playwright/test";
import { test } from "./fixtures";
import { castUrl, expectReceiverPlaying, pair } from "../helpers";

test("mp4 URL cast plays on the receiver", async ({ context, baseURL }) => {
  const { receiver, sender } = await pair(context);
  await castUrl(sender, `${baseURL}/r/media/sample.mp4`);
  await expectReceiverPlaying(receiver);
});

test("link-preview modal cancel aborts the cast", async ({ context, baseURL }) => {
  const { sender } = await pair(context);
  await sender.locator("#url-input").fill(`${baseURL}/r/media/sample.mp4`);
  await sender.locator("#cast-url-btn").click();
  await expect(sender.locator(".preview-overlay")).toBeVisible();
  await sender.locator(".preview-btn-block").click();
  await expect(sender.locator(".preview-overlay")).toHaveCount(0);
  await expect(sender.locator("#now-title")).toHaveText("Nothing playing");
});
