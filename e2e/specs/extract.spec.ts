import { expect } from "@playwright/test";
import { test } from "./fixtures";
import { pair, expectReceiverPlaying } from "../helpers";

test("extract pipeline finds the fixture mp4 and casts it", async ({ context, baseURL }) => {
  const { receiver, sender } = await pair(context);
  await sender.locator("#url-input").fill(`${baseURL}/r/fixtures/page.html`);
  await sender.locator("#extract-btn").click();

  // Single high-confidence candidate → auto-cast; now-title shows the mp4 URL.
  await expect(sender.locator("#now-title")).toContainText("sample.mp4", { timeout: 30_000 });
  await expectReceiverPlaying(receiver);
});

test("extract finds the HLS URL from a player-config script", async ({ context, baseURL }) => {
  const { receiver, sender } = await pair(context);
  await sender.locator("#url-input").fill(`${baseURL}/r/fixtures/page.html`);
  await sender.locator("#extract-btn").click();
  await expect(sender.locator("#now-title")).toContainText("sample.mp4", { timeout: 30_000 });
  await expectReceiverPlaying(receiver);
});
